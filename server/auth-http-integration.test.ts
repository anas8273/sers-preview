import { createHash, randomBytes } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, like, sql } from "drizzle-orm";
import { decodeJwt, decodeProtectedHeader, SignJWT } from "jose";
import { users } from "../drizzle/schema";
import { authRpc, sessionCookie, startAuthHarness } from "../tests/fixtures/auth-http-harness";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite.sequential("production OAuth HTTP routes with real MySQL and a synthetic Manus-contract issuer", () => {
  let harness: Awaited<ReturnType<typeof startAuthHarness>>;
  let auth: typeof import("../drizzle/auth");
  const hash = (value: string) => createHash("sha256").update(value).digest("hex");
  const callback = (url: string, cookie?: string) => fetch(url, { redirect: "manual", headers: cookie ? { cookie } : {} });
  async function persisted() {
    const accounts = await harness.db.select({ id: users.id }).from(users).where(like(users.openId, `${harness.prefix}%`));
    const sessions = await harness.db.select({ id: auth.authSessions.idHash }).from(auth.authSessions)
      .innerJoin(users, eq(users.id, auth.authSessions.userId)).where(like(users.openId, `${harness.prefix}%`));
    return { users: accounts.length, sessions: sessions.length };
  }
  async function rejected(response: Response, code: string, state: string, expectedStatus = 400) {
    expect(response.status).toBe(expectedStatus);
    expect(sessionCookie(response)).toBeUndefined();
    const body = await response.text(); expect(body).not.toContain(code); expect(body).not.toContain(state);
  }
  async function signedIn() {
    const attempt = await harness.begin();
    const response = await callback(attempt.callback, attempt.cookie);
    expect(response.status).toBe(302);
    const cookie = sessionCookie(response); expect(cookie).toBeDefined();
    return { attempt, response, cookie: cookie! };
  }
  beforeAll(async () => { harness = await startAuthHarness(); auth = await import("../drizzle/auth"); }, 30_000);
  afterAll(async () => { await harness?.close(); });

  it("atomically consumes a concurrent callback once, persists one session and redirects without secrets", async () => {
    const before = await persisted(), attempt = await harness.begin();
    expect(attempt.startResponse.headers.getSetCookie().join(";")).toMatch(/HttpOnly/i);
    expect(attempt.startResponse.headers.getSetCookie().join(";")).toMatch(/SameSite=Lax/i);
    const results = await Promise.all([callback(attempt.callback, attempt.cookie), callback(attempt.callback, attempt.cookie)]);
    const successful = results.filter(response => response.status === 302); expect(successful).toHaveLength(1);
    const failure = results.find(response => response.status !== 302)!;
    await rejected(failure, attempt.code, attempt.state);
    expect(await persisted()).toEqual({ users: before.users + 1, sessions: before.sessions + 1 });
    const response = successful[0], cookie = sessionCookie(response)!;
    const [storedAttempt] = await harness.db.select().from(auth.authOAuthAttempts).where(eq(auth.authOAuthAttempts.stateHash, hash(attempt.state)));
    expect(storedAttempt.consumedAt).toBeInstanceOf(Date);
    expect(storedAttempt.browserHash).toBe(hash(attempt.cookie.slice("oauth_attempt=".length)));
    expect(response.headers.get("location")).toBe("/");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    expect(response.headers.get("cache-control")).toContain("no-store");
    expect(await response.text()).not.toContain(attempt.code);
    expect(harness.exchanged.filter(value => value.code === attempt.code)).toEqual([{ code: attempt.code, clientId: harness.appId,
      grantType: "authorization_code", redirectUri: `${harness.base}/api/oauth/callback` }]);
    const account = await authRpc(harness.base, "account.overview", cookie);
    expect(account.response.status).toBe(200); expect(account.data.user.name).toBe("حساب مصادقة تجريبي");
    await rejected(await callback(attempt.callback, attempt.cookie), attempt.code, attempt.state);
    expect(await persisted()).toEqual({ users: before.users + 1, sessions: before.sessions + 1 });
  });

  it("rejects missing, forged and different-browser state before contacting the provider", async () => {
    const before = await persisted(), first = await harness.begin(), otherBrowser = await harness.begin();
    const exchanges = harness.exchanged.length;
    await rejected(await callback(`${harness.base}/api/oauth/callback?code=${first.code}`, first.cookie), first.code, first.state);
    const forged = new URL(first.callback); forged.searchParams.set("state", "a".repeat(43));
    await rejected(await callback(forged.href, first.cookie), first.code, first.state);
    await rejected(await callback(first.callback), first.code, first.state);
    await rejected(await callback(first.callback, otherBrowser.cookie), first.code, first.state);
    expect(harness.exchanged).toHaveLength(exchanges); expect(await persisted()).toEqual(before);
    // A foreign browser must not consume the legitimate browser's attempt.
    expect((await callback(first.callback, first.cookie)).status).toBe(302);
  });

  it("rejects expired durable state even with the correct browser cookie", async () => {
    const before = await persisted(), attempt = await harness.begin(), exchanges = harness.exchanged.length;
    await harness.db.update(auth.authOAuthAttempts).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` })
      .where(eq(auth.authOAuthAttempts.stateHash, hash(attempt.state)));
    await rejected(await callback(attempt.callback, attempt.cookie), attempt.code, attempt.state);
    expect(harness.exchanged).toHaveLength(exchanges); expect(await persisted()).toEqual(before);
  });

  for (const mode of ["token_failure", "profile_failure", "wrong_project", "oversized_profile"] as const) it(`fails closed on ${mode} without creating a user or session`, async () => {
    const before = await persisted(); harness.nextMode(mode); const attempt = await harness.begin();
    await rejected(await callback(attempt.callback, attempt.cookie), attempt.code, attempt.state, 503);
    expect(await persisted()).toEqual(before);
    const exchanges = harness.exchanged.length;
    await rejected(await callback(attempt.callback, attempt.cookie), attempt.code, attempt.state);
    expect(harness.exchanged).toHaveLength(exchanges); expect(await persisted()).toEqual(before);
  });

  it("uses configured origin and cookie policy despite forged forwarding headers", async () => {
    const attempt = await harness.begin({ "x-forwarded-host": "attacker.invalid", "x-forwarded-proto": "https", host: "attacker.invalid" });
    expect(harness.authorizations.at(-1)?.callback).toBe(attempt.callback);
    expect(new URL(attempt.callback).origin).toBe(harness.base);
    const cookies = attempt.startResponse.headers.getSetCookie().join(";");
    expect(cookies).not.toMatch(/Domain=/i); expect(cookies).not.toMatch(/;\s*Secure/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect((await callback(attempt.callback, attempt.cookie)).status).toBe(302);
  });

  it("requires the right app binding and a live durable session registry", async () => {
    const { cookie } = await signedIn(), token = cookie.slice("app_session_id=".length), payload = decodeJwt(token);
    expect(typeof payload.sid).toBe("string");
    const secret = new TextEncoder().encode(process.env.JWT_SECRET);
    const decodedHeader = decodeProtectedHeader(token);
    expect(decodedHeader).toEqual({ alg: "HS256", typ: "sers-session+jwt" });
    const header = { alg: "HS256", typ: decodedHeader.typ };
    const wrongApp = await new SignJWT({ ...payload, appId: "unrelated-application" }).setProtectedHeader(header).sign(secret);
    expect((await authRpc(harness.base, "account.overview", `app_session_id=${wrongApp}`)).response.status).toBe(401);
    const missingSession = await new SignJWT({ ...payload, sid: "b".repeat(43) }).setProtectedHeader(header).sign(secret);
    expect((await authRpc(harness.base, "account.overview", `app_session_id=${missingSession}`)).response.status).toBe(401);
    await harness.db.delete(auth.authSessions).where(eq(auth.authSessions.idHash, hash(payload.sid as string)));
    expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(401);
    expect((await authRpc(harness.base, "auth.me", cookie)).data).toBeNull();
  });

  it("does not revoke a valid session through absent or foreign logout origins", async () => {
    const { cookie } = await signedIn();
    for (const origin of [undefined, "https://attacker.invalid", "null"]) {
      const response = await fetch(`${harness.base}/api/trpc/auth.logout`, { method: "POST",
        headers: { cookie, "content-type": "application/json", ...(origin ? { origin } : {}) }, body: JSON.stringify({ json: null }) });
      expect(response.status).toBe(403); expect(sessionCookie(response)).toBeUndefined();
      expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(200);
    }
    expect((await authRpc(harness.base, "auth.logout", cookie, undefined, "POST")).response.status).toBe(200);
    expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(401);
  });

  it("fails closed on an actual registry outage and preserves the cookie until revocation can persist", async () => {
    const { cookie } = await signedIn();
    // This suite runs alone against the explicitly guarded disposable CI DB.
    // Renaming preserves every row and is always reversed before the next case.
    const [rows] = await harness.db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    expect((rows as unknown as Array<{ name: string; version: string }>)[0]).toMatchObject({ name: "sers_test", version: expect.stringMatching(/^8\.4\./) });
    const unavailable = sql.identifier(`auth_sessions_unavailable_${randomBytes(8).toString("hex")}`);
    let renamed = false;
    try {
      await harness.db.execute(sql`RENAME TABLE ${auth.authSessions} TO ${unavailable}`); renamed = true;
      expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(401);
      const result = await authRpc(harness.base, "auth.logout", cookie, undefined, "POST");
      expect(result.response.status).toBe(500);
      expect(result.data).toBeUndefined(); expect(result.response.headers.getSetCookie()).toEqual([]);
    } finally {
      if (renamed) await harness.db.execute(sql`RENAME TABLE ${unavailable} TO ${auth.authSessions}`);
    }
    expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(200);
    expect((await authRpc(harness.base, "auth.logout", cookie, undefined, "POST")).response.status).toBe(200);
    expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(401);
  });

  it("durably revokes before logout succeeds, including concurrent logout and cookie replay", async () => {
    const { cookie } = await signedIn(), payload = decodeJwt(cookie.slice("app_session_id=".length));
    const results = await Promise.all([authRpc(harness.base, "auth.logout", cookie, undefined, "POST"), authRpc(harness.base, "auth.logout", cookie, undefined, "POST")]);
    for (const result of results) {
      expect(result.response.status).toBe(200); expect(result.data).toEqual({ success: true });
      expect(result.response.headers.getSetCookie().join(";")).toMatch(/app_session_id=;/);
    }
    const [session] = await harness.db.select().from(auth.authSessions).where(eq(auth.authSessions.idHash, hash(payload.sid as string)));
    expect(session.revokedAt).toBeInstanceOf(Date);
    expect((await authRpc(harness.base, "account.overview", cookie)).response.status).toBe(401);
    const blocked = await authRpc(harness.base, "account.createSchool", cookie, { name: "Should not be created" }, "POST");
    expect(blocked.response.status).toBe(401);
    expect((await authRpc(harness.base, "auth.me", cookie)).data).toBeNull();
  });
});
