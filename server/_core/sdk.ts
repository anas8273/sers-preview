import { AXIOS_TIMEOUT_MS, COOKIE_NAME } from "@shared/const";
import { ForbiddenError } from "@shared/_core/errors";
import axios, { type AxiosInstance } from "axios";
import { parse as parseCookieHeader } from "cookie";
import type { Request } from "express";
import { SignJWT, jwtVerify } from "jose";
import type { User } from "../../drizzle/schema";
import * as db from "../db";
import { authCredential, createAuthSession, getActiveAuthSession, revokeAuthSession, validAuthCredential } from "../auth-session-db";
import { AUTH_SESSION_TTL_MS, ENV, getAuthConfig } from "./env";
import type { ExchangeTokenRequest, ExchangeTokenResponse, GetUserInfoResponse } from "./types/manusTypes";

const EXCHANGE_TOKEN_PATH = "/webdev.v1.WebDevAuthPublicService/ExchangeToken";
const GET_USER_INFO_PATH = "/webdev.v1.WebDevAuthPublicService/GetUserInfo";
export type SessionPayload = { openId: string; appId: string; name: string; sid: string; userId: number };

export class SDKServer {
  constructor(private readonly client: AxiosInstance = axios.create({ baseURL: ENV.oAuthServerUrl, timeout: AXIOS_TIMEOUT_MS, maxRedirects: 0, maxContentLength: 64 * 1024, maxBodyLength: 32 * 1024 })) {}

  private deriveLoginMethod(platforms: unknown, fallback: unknown): string | null {
    if (typeof fallback === "string" && fallback.length > 0 && fallback.length <= 64) return fallback;
    if (!Array.isArray(platforms)) return null;
    const set = new Set(platforms.filter((value): value is string => typeof value === "string"));
    for (const [platform, method] of [["REGISTERED_PLATFORM_EMAIL", "email"], ["REGISTERED_PLATFORM_GOOGLE", "google"], ["REGISTERED_PLATFORM_APPLE", "apple"], ["REGISTERED_PLATFORM_MICROSOFT", "microsoft"], ["REGISTERED_PLATFORM_AZURE", "microsoft"], ["REGISTERED_PLATFORM_GITHUB", "github"]]) {
      if (set.has(platform)) return method;
    }
    return null;
  }

  /** The redirect URI is server configuration, never decoded from callback state. */
  async exchangeCodeForToken(code: string, redirectUri: string): Promise<ExchangeTokenResponse> {
    const config = getAuthConfig();
    if (!code || code.length > 4096 || redirectUri !== config.redirectUri) throw new Error("Invalid authorization response");
    const payload: ExchangeTokenRequest = { clientId: config.appId, grantType: "authorization_code", code, redirectUri: config.redirectUri };
    try {
      const { data } = await this.client.post<ExchangeTokenResponse>(EXCHANGE_TOKEN_PATH, payload);
      if (typeof data?.accessToken !== "string" || !data.accessToken || data.accessToken.length > 16384) throw new Error();
      return data;
    } catch { throw new Error("Authorization provider unavailable"); }
  }

  async getUserInfo(accessToken: string): Promise<GetUserInfoResponse> {
    const config = getAuthConfig();
    if (!accessToken || accessToken.length > 16384) throw new Error("Authorization profile unavailable");
    try {
      const { data } = await this.client.post<GetUserInfoResponse & { platforms?: unknown }>(GET_USER_INFO_PATH, { accessToken });
      if (data?.projectId !== config.appId || typeof data.openId !== "string" || !data.openId || data.openId.length > 64 || /[\u0000-\u001f\u007f]/.test(data.openId)) throw new Error();
      const loginMethod = this.deriveLoginMethod(data.platforms, data.loginMethod ?? data.platform);
      return { openId: data.openId, projectId: data.projectId, name: typeof data.name === "string" ? data.name.slice(0, 1000) : "", email: typeof data.email === "string" && data.email.length <= 320 ? data.email : null, platform: loginMethod, loginMethod };
    } catch { throw new Error("Authorization profile unavailable"); }
  }

  private sessionCookie(req: Request) {
    try { return parseCookieHeader(req.headers.cookie ?? "")[COOKIE_NAME]; } catch { return undefined; }
  }

  async createSessionToken(openId: string, options: { expiresInMs?: number; name?: string } = {}): Promise<string> {
    const config = getAuthConfig();
    const user = await db.getUserByOpenId(openId);
    if (!user) throw new Error("Session identity unavailable");
    const lifetime = options.expiresInMs ?? AUTH_SESSION_TTL_MS;
    if (!Number.isFinite(lifetime) || lifetime < 1000 || lifetime > AUTH_SESSION_TTL_MS) throw new Error("Invalid session lifetime");
    const issuedAt = Math.floor(Date.now() / 1000);
    const expiresAt = issuedAt + Math.floor(lifetime / 1000);
    const sid = authCredential();
    const token = await new SignJWT({ openId, appId: config.appId, name: (options.name ?? user.name ?? "").slice(0, 1000), sid, sessionVersion: 2 })
      .setProtectedHeader({ alg: "HS256", typ: "sers-session+jwt" }).setIssuer(config.publicOrigin).setAudience(config.appId)
      .setSubject(String(user.id)).setIssuedAt(issuedAt).setExpirationTime(expiresAt).sign(new TextEncoder().encode(config.secret));
    await createAuthSession({ id: sid, userId: user.id, appId: config.appId, expiresAt: new Date(expiresAt * 1000) });
    return token;
  }

  private async signedSession(cookie: string | undefined | null): Promise<(SessionPayload & { expiresAt: number }) | null> {
    if (!cookie || cookie.length > 16384) return null;
    try {
      const config = getAuthConfig();
      const { payload, protectedHeader } = await jwtVerify(cookie, new TextEncoder().encode(config.secret), { algorithms: ["HS256"], issuer: config.publicOrigin, audience: config.appId, requiredClaims: ["sub", "iat", "exp"] });
      const userId = Number(payload.sub);
      if (protectedHeader.typ !== "sers-session+jwt" || payload.sessionVersion !== 2 || payload.appId !== config.appId || !validAuthCredential(payload.sid) || typeof payload.openId !== "string" || !payload.openId || payload.openId.length > 64 || typeof payload.name !== "string" || !Number.isSafeInteger(userId) || userId < 1 || String(userId) !== payload.sub || typeof payload.iat !== "number" || typeof payload.exp !== "number" || payload.iat > Math.floor(Date.now() / 1000) + 5 || payload.exp <= payload.iat || (payload.exp - payload.iat) * 1000 > AUTH_SESSION_TTL_MS) return null;
      return { openId: payload.openId, appId: config.appId, name: payload.name, sid: payload.sid, userId, expiresAt: payload.exp * 1000 };
    } catch { return null; }
  }

  /** Legacy unbound JWTs deliberately fail here and require a new sign-in. */
  async verifySession(cookie: string | undefined | null): Promise<SessionPayload | null> {
    const session = await this.signedSession(cookie);
    if (!session) return null;
    try {
      const registered = await getActiveAuthSession(session.sid, session.appId);
      if (!registered || registered.user.id !== session.userId || registered.user.openId !== session.openId || registered.session.expiresAt.getTime() !== session.expiresAt) return null;
      return { openId: session.openId, appId: session.appId, name: session.name, sid: session.sid, userId: session.userId };
    } catch { return null; }
  }

  /** Invalid cookies are harmless; valid sessions must be durably revoked before success. */
  async revokeSessionForRequest(req: Request) {
    const cookie = this.sessionCookie(req);
    if (!cookie) return;
    const config = getAuthConfig();
    if (req.headers.origin !== config.publicOrigin) throw ForbiddenError("Invalid request origin");
    const session = await this.signedSession(cookie);
    if (!session) return;
    try { await revokeAuthSession(session.sid, session.appId, session.userId); }
    catch { throw new Error("Session revocation unavailable"); }
  }

  async authenticateRequest(req: Request): Promise<User> {
    const session = await this.verifySession(this.sessionCookie(req));
    if (!session) throw ForbiddenError("Invalid session cookie");
    const user = await db.getUserByOpenId(session.openId);
    if (!user || user.id !== session.userId) throw ForbiddenError("Session identity unavailable");
    // Provider synchronization happens only after a successful OAuth callback.
    return user;
  }
}

export const sdk = new SDKServer();
