import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SignJWT, decodeJwt } from "jose";
import type { AxiosInstance } from "axios";
import type { Request } from "express";
import { COOKIE_NAME } from "../shared/const";
import { AUTH_SESSION_TTL_MS, ENV, getAuthConfig } from "./_core/env";
import { getOAuthAttemptCookieOptions, getSessionCookieOptions } from "./_core/cookies";

const mocks = vi.hoisted(() => ({ user: vi.fn(), create: vi.fn(), active: vi.fn(), revoke: vi.fn() }));
vi.mock("./db", () => ({ getUserByOpenId: mocks.user }));
vi.mock("./auth-session-db", async importOriginal => ({ ...await importOriginal<typeof import("./auth-session-db")>(), createAuthSession: mocks.create, getActiveAuthSession: mocks.active, revokeAuthSession: mocks.revoke }));
import { SDKServer } from "./_core/sdk";

const configured = { ...ENV, appId: "auth-test-project", cookieSecret: "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH", appPublicOrigin: "https://app.example.test", oAuthServerUrl: "https://issuer.example.test", oAuthPortalUrl: "https://portal.example.test", isProduction: true };
const original = { ...ENV };
const user = { id: 7, openId: "provider-user", name: null, email: null, loginMethod: "email", role: "user" as const, createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() };
const sid = "a".repeat(43);
const request = (cookie: string, origin: string | undefined = configured.appPublicOrigin) => ({ headers: { cookie: `${COOKIE_NAME}=${cookie}`, ...(origin ? { origin } : {}) } }) as Request;
async function signed(overrides: Record<string, unknown> = {}, options: { issuer?: string; audience?: string; legacy?: boolean } = {}) {
  const now = Math.floor(Date.now() / 1000);
  return new SignJWT({ openId: user.openId, appId: configured.appId, name: "", sid, sessionVersion: 2, ...overrides })
    .setProtectedHeader({ alg: "HS256", typ: options.legacy ? "JWT" : "sers-session+jwt" }).setIssuer(options.issuer ?? configured.appPublicOrigin)
    .setAudience(options.audience ?? configured.appId).setSubject(String(user.id)).setIssuedAt(now).setExpirationTime(now + 3600)
    .sign(new TextEncoder().encode(configured.cookieSecret));
}

beforeEach(() => { Object.assign(ENV, configured); vi.clearAllMocks(); mocks.user.mockResolvedValue(user); mocks.create.mockResolvedValue(undefined); mocks.revoke.mockResolvedValue(undefined); });
afterEach(() => Object.assign(ENV, original));

describe("auth configuration and cookies", () => {
  it("uses a canonical configured callback and rejects weak secrets or unsafe deployment URLs", () => {
    expect(getAuthConfig(configured).redirectUri).toBe("https://app.example.test/api/oauth/callback");
    for (const patch of [{ cookieSecret: "" }, { cookieSecret: "a".repeat(64) }, { appId: "" }, { appPublicOrigin: "https://app.example.test/path" }, { appPublicOrigin: "http://app.example.test" }, { oAuthServerUrl: "https://secret@issuer.example.test" }, { oAuthPortalUrl: "javascript:alert(1)" }]) expect(() => getAuthConfig({ ...configured, ...patch })).toThrow("configuration");
    expect(() => getAuthConfig({ ...configured, appPublicOrigin: "http://127.0.0.1:9999", isProduction: false })).not.toThrow();
    expect(() => getAuthConfig({ ...configured, appPublicOrigin: "http://127.0.0.1:9999" })).toThrow();
  });

  it("ignores forwarded headers and sets host-only HttpOnly Lax cookies", () => {
    expect(getSessionCookieOptions({ protocol: "http", headers: { "x-forwarded-proto": "http" } } as Request)).toEqual({ httpOnly: true, path: "/", sameSite: "lax", secure: true });
    Object.assign(ENV, { appPublicOrigin: "http://127.0.0.1:9000", isProduction: false });
    expect(getSessionCookieOptions({ protocol: "https", headers: { "x-forwarded-proto": "https" } } as Request).secure).toBe(false);
    expect(getOAuthAttemptCookieOptions().path).toBe("/api/oauth");
  });
});

describe("app-bound durable sessions", () => {
  it("registers a new opaque session and permits an empty display name", async () => {
    const sdk = new SDKServer();
    const token = await sdk.createSessionToken(user.openId, { name: "" });
    const claims = decodeJwt(token);
    expect(claims).toMatchObject({ iss: configured.appPublicOrigin, aud: configured.appId, appId: configured.appId, sub: "7", sessionVersion: 2, name: "" });
    expect(claims.sid).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(Number(claims.exp) - Number(claims.iat)).toBe(AUTH_SESSION_TTL_MS / 1000);
    expect(mocks.create).toHaveBeenCalledWith({ id: claims.sid, userId: user.id, appId: configured.appId, expiresAt: new Date(Number(claims.exp) * 1000) });
    mocks.active.mockResolvedValue({ user, session: { expiresAt: new Date(Number(claims.exp) * 1000) } });
    expect(await sdk.verifySession(token)).toMatchObject({ openId: user.openId, userId: user.id, name: "" });
  });

  it("rejects legacy, wrong-app, wrong-audience and wrong-issuer JWTs before registry access", async () => {
    const sdk = new SDKServer();
    for (const token of [await signed({}, { legacy: true }), await signed({ appId: "other-project" }), await signed({}, { audience: "other-project" }), await signed({}, { issuer: "https://other.example.test" }), await signed({ sessionVersion: 1 })]) expect(await sdk.verifySession(token)).toBeNull();
    expect(mocks.active).not.toHaveBeenCalled();
  });

  it("fails closed for absent, revoked, mismatched or unavailable registry records", async () => {
    const sdk = new SDKServer(), token = await signed(), claims = decodeJwt(token);
    mocks.active.mockResolvedValue(undefined);
    expect(await sdk.verifySession(token)).toBeNull();
    mocks.active.mockResolvedValue({ user: { ...user, openId: "different-provider-user" }, session: { expiresAt: new Date(Number(claims.exp) * 1000) } });
    expect(await sdk.verifySession(token)).toBeNull();
    mocks.active.mockRejectedValue(new Error("synthetic database failure"));
    expect(await sdk.verifySession(token)).toBeNull();
    await expect(sdk.authenticateRequest(request(token))).rejects.toThrow("Invalid session");
  });

  it("requires same-origin logout and propagates durable revocation failures", async () => {
    const sdk = new SDKServer(), token = await signed();
    await expect(sdk.revokeSessionForRequest(request(token, "https://attacker.example"))).rejects.toThrow("origin");
    await expect(sdk.revokeSessionForRequest(request(token, ""))).rejects.toThrow("origin");
    expect(mocks.revoke).not.toHaveBeenCalled();
    await sdk.revokeSessionForRequest(request(token));
    expect(mocks.revoke).toHaveBeenCalledWith(sid, configured.appId, user.id);
    mocks.revoke.mockRejectedValue(new Error("synthetic database failure"));
    await expect(sdk.revokeSessionForRequest(request(token))).rejects.toThrow("revocation unavailable");
  });
});

describe("existing provider contract", () => {
  it("exchanges against the configured callback and never decodes arbitrary state", async () => {
    const post = vi.fn().mockResolvedValue({ data: { accessToken: "synthetic-access" } });
    const sdk = new SDKServer({ post } as unknown as AxiosInstance);
    await expect(sdk.exchangeCodeForToken("code", "https://attacker.example/callback")).rejects.toThrow("Invalid authorization");
    expect(post).not.toHaveBeenCalled();
    await sdk.exchangeCodeForToken("code", getAuthConfig().redirectUri);
    expect(post).toHaveBeenCalledWith("/webdev.v1.WebDevAuthPublicService/ExchangeToken", { clientId: configured.appId, grantType: "authorization_code", code: "code", redirectUri: getAuthConfig().redirectUri });
  });

  it("rejects a foreign provider project and never returns raw provider errors", async () => {
    const post = vi.fn().mockResolvedValue({ data: { openId: user.openId, projectId: "foreign-project", name: "Wrong identity" } });
    const sdk = new SDKServer({ post } as unknown as AxiosInstance);
    await expect(sdk.getUserInfo("synthetic-access")).rejects.toThrow("Authorization profile unavailable");
    post.mockRejectedValue(new Error("secret-provider-token"));
    await expect(sdk.exchangeCodeForToken("code", getAuthConfig().redirectUri)).rejects.toThrow(/^Authorization provider unavailable$/);
    post.mockResolvedValue({ data: { openId: user.openId, projectId: configured.appId, name: null } });
    expect(await sdk.getUserInfo("synthetic-access")).toMatchObject({ openId: user.openId, name: "" });
  });
});
