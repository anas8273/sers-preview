import { createHmac, randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { decodeJwt } from "jose";
import type { Request } from "express";
import { authOAuthAttempts, authRateLimits, authSessions } from "../drizzle/auth";
import { users } from "../drizzle/schema";
import { COOKIE_NAME } from "../shared/const";
import { getDb } from "./db";
import { AuthRateLimitError, authCredential, consumeOAuthAttempt, createOAuthAttempt, getActiveAuthSession, hashAuthCredential } from "./auth-session-db";
import { ENV } from "./_core/env";
import { sdk } from "./_core/sdk";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("durable OAuth attempts and sessions on disposable MySQL", () => {
  const original = { ...ENV };
  const appId = `auth-ci-${randomUUID()}`;
  const secret = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGH";
  const origin = "https://auth-fixture.example.test";
  const redirectUri = `${origin}/api/oauth/callback`;
  const rateKeys = new Set<string>();
  let userId = 0;
  let openId = "";

  async function clean() {
    if (!userId) return;
    const db = (await getDb())!;
    await db.delete(authSessions).where(eq(authSessions.userId, userId));
    await db.delete(authOAuthAttempts).where(eq(authOAuthAttempts.appId, appId));
    if (rateKeys.size) await db.delete(authRateLimits).where(inArray(authRateLimits.keyHash, [...rateKeys]));
    rateKeys.clear();
  }
  function attempt(browser = authCredential()) {
    const input = { state: authCredential(), browser, address: "synthetic-fixture-address", appId, redirectUri, secret };
    for (const scope of ["global", `ip:${input.address}`, `browser:${browser}`]) rateKeys.add(createHmac("sha256", secret).update(`${appId}:${scope}`).digest("hex"));
    return input;
  }
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Auth integration requires disposable CI MySQL");
    const db = (await getDb())!;
    const [rows] = await db.execute(sql`SELECT DATABASE() AS dbName, VERSION() AS dbVersion`);
    expect((rows as unknown as { dbName: string; dbVersion: string }[])[0]).toMatchObject({ dbName: "sers_test", dbVersion: expect.stringMatching(/^8\.4\./) });
    Object.assign(ENV, { appId, cookieSecret: secret, appPublicOrigin: origin, oAuthPortalUrl: "https://issuer-fixture.example.test", oAuthServerUrl: "https://issuer-fixture.example.test", isProduction: true });
    openId = `auth-user-${randomUUID()}`;
    const [inserted] = await db.insert(users).values({ openId });
    userId = Number(inserted.insertId);
  });
  beforeEach(clean);
  afterAll(async () => { await clean(); if (userId) await (await getDb())!.delete(users).where(eq(users.id, userId)); Object.assign(ENV, original); });

  it("persists hashes and atomically consumes exactly one concurrent callback", async () => {
    const input = attempt();
    await createOAuthAttempt(input);
    const [row] = await (await getDb())!.select().from(authOAuthAttempts).where(eq(authOAuthAttempts.stateHash, hashAuthCredential(input.state)));
    expect(row.browserHash).toBe(hashAuthCredential(input.browser));
    expect(JSON.stringify(row)).not.toContain(input.state);
    expect(JSON.stringify(row)).not.toContain(input.browser);
    const outcomes = await Promise.all(Array.from({ length: 12 }, () => consumeOAuthAttempt(input)));
    expect(outcomes.filter(Boolean)).toHaveLength(1);
    expect(await consumeOAuthAttempt(input)).toBe(false);
  });

  it("rejects another browser, app, callback or expired attempt without consuming a valid attempt", async () => {
    const input = attempt(); await createOAuthAttempt(input);
    expect(await consumeOAuthAttempt({ ...input, browser: authCredential() })).toBe(false);
    expect(await consumeOAuthAttempt({ ...input, appId: "foreign-project" })).toBe(false);
    expect(await consumeOAuthAttempt({ ...input, redirectUri: "https://attacker.example/callback" })).toBe(false);
    const db = (await getDb())!;
    const [fresh] = await db.select().from(authOAuthAttempts).where(eq(authOAuthAttempts.stateHash, hashAuthCredential(input.state)));
    expect(fresh.consumedAt).toBeNull();
    await db.update(authOAuthAttempts).set({ expiresAt: new Date(Date.now() - 10_000) }).where(eq(authOAuthAttempts.stateHash, fresh.stateHash));
    expect(await consumeOAuthAttempt(input)).toBe(false);
  });

  it("enforces the browser attempt bound atomically across concurrent starts", async () => {
    const browser = authCredential();
    for (let index = 0; index < 4; index++) await createOAuthAttempt(attempt(browser));
    const results = await Promise.allSettled([createOAuthAttempt(attempt(browser)), createOAuthAttempt(attempt(browser))]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const rejected = results.find(result => result.status === "rejected") as PromiseRejectedResult;
    expect(rejected.reason).toBeInstanceOf(AuthRateLimitError);
    const records = await (await getDb())!.select().from(authOAuthAttempts).where(eq(authOAuthAttempts.appId, appId));
    expect(records).toHaveLength(5);
  });

  it("revokes only the selected durable session and rejects a replayed cookie", async () => {
    const first = await sdk.createSessionToken(openId), second = await sdk.createSessionToken(openId);
    const firstId = decodeJwt(first).sid as string;
    expect((await sdk.verifySession(first))?.userId).toBe(userId);
    const request = { headers: { cookie: `${COOKIE_NAME}=${first}`, origin } } as Request;
    await sdk.revokeSessionForRequest(request);
    expect(await sdk.verifySession(first)).toBeNull();
    await expect(sdk.authenticateRequest(request)).rejects.toThrow("Invalid session");
    expect(await sdk.verifySession(second)).toMatchObject({ openId, userId });
    const [stored] = await (await getDb())!.select().from(authSessions).where(eq(authSessions.idHash, hashAuthCredential(firstId)));
    expect(stored.revokedAt).toBeInstanceOf(Date);
    expect(JSON.stringify(stored)).not.toContain(firstId);
    await sdk.revokeSessionForRequest(request);
  });

  it("fails closed when the persisted session expires or disappears", async () => {
    const token = await sdk.createSessionToken(openId), sid = decodeJwt(token).sid as string;
    const db = (await getDb())!;
    await db.update(authSessions).set({ expiresAt: new Date(Date.now() - 10_000) }).where(eq(authSessions.idHash, hashAuthCredential(sid)));
    expect(await getActiveAuthSession(sid, appId)).toBeUndefined();
    expect(await sdk.verifySession(token)).toBeNull();
    await db.delete(authSessions).where(eq(authSessions.idHash, hashAuthCredential(sid)));
    expect(await sdk.verifySession(token)).toBeNull();
    expect((await db.select().from(users).where(eq(users.id, userId)))).toHaveLength(1);
  });
});
