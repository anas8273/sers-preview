import { createHash, createHmac, randomBytes } from "node:crypto";
import { and, eq, gt, isNull, lt, sql } from "drizzle-orm";
import { authOAuthAttempts, authRateLimits, authSessions } from "../drizzle/auth";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { OAUTH_ATTEMPT_TTL_MS } from "./_core/env";
import { safeAuthReturnPath } from "../shared/auth-return-path";

export const authCredential = () => randomBytes(32).toString("base64url");
export const validAuthCredential = (value: unknown): value is string => typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);
export const hashAuthCredential = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");
export class AuthRateLimitError extends Error { constructor() { super("Too many sign-in attempts"); this.name = "AuthRateLimitError"; } }

async function database() { const db = await getDb(); if (!db) throw new Error("Authentication database unavailable"); return db; }
function affectedRows(value: unknown) { const result = Array.isArray(value) ? value[0] : value; return result && typeof result === "object" && "affectedRows" in result ? Number(result.affectedRows) : 0; }

export async function createOAuthAttempt(input: { state: string; browser: string; address: string; appId: string; redirectUri: string; secret: string; returnTo?: string }) {
  if (!validAuthCredential(input.state) || !validAuthCredential(input.browser)) throw new Error("Invalid authentication attempt");
  const db = await database();
  const now = new Date(Math.floor(Date.now() / 1000) * 1000);
  const expiresAt = new Date(now.getTime() + OAUTH_ATTEMPT_TTL_MS);
  const hashRateKey = (value: string) => createHmac("sha256", input.secret).update(`${input.appId}:${value}`).digest("hex");
  const limits = [{ keyHash: hashRateKey("global"), max: 600 }, { keyHash: hashRateKey(`ip:${input.address}`), max: 30 }, { keyHash: hashRateKey(`browser:${input.browser}`), max: 5 }].sort((a, b) => a.keyHash.localeCompare(b.keyHash));
  await db.transaction(async tx => {
    // Fixed ordering makes all application instances share the same durable bounds.
    for (const limit of limits) {
      await tx.insert(authRateLimits).values({ keyHash: limit.keyHash, windowStartedAt: now, count: 0, expiresAt }).onDuplicateKeyUpdate({ set: { keyHash: limit.keyHash } });
      const [row] = await tx.select().from(authRateLimits).where(eq(authRateLimits.keyHash, limit.keyHash)).for("update");
      const expired = row.expiresAt.getTime() <= now.getTime();
      if (!expired && row.count >= limit.max) throw new AuthRateLimitError();
      await tx.update(authRateLimits).set({ count: expired ? 1 : row.count + 1, ...(expired ? { windowStartedAt: now, expiresAt } : {}) }).where(eq(authRateLimits.keyHash, limit.keyHash));
    }
    await tx.insert(authOAuthAttempts).values({ stateHash: hashAuthCredential(input.state), browserHash: hashAuthCredential(input.browser), appId: input.appId, redirectUri: input.redirectUri, returnTo: safeAuthReturnPath(input.returnTo), expiresAt });
  });
  // Bounded opportunistic expiry cleanup contains abandoned attempts and rate rows.
  await db.delete(authOAuthAttempts).where(lt(authOAuthAttempts.expiresAt, now)).limit(100);
  await db.delete(authRateLimits).where(lt(authRateLimits.expiresAt, now)).limit(100);
  await db.delete(authSessions).where(lt(authSessions.expiresAt, now)).limit(100);
  return { expiresAt };
}

/** One conditional update consumes a browser-bound attempt before any provider I/O. */
export async function consumeOAuthAttempt(input: { state: string; browser: string; appId: string; redirectUri: string }) {
  if (!validAuthCredential(input.state) || !validAuthCredential(input.browser)) return false;
  const db = await database();
  const consumed = affectedRows(await db.update(authOAuthAttempts).set({ consumedAt: sql`CURRENT_TIMESTAMP` }).where(and(
    eq(authOAuthAttempts.stateHash, hashAuthCredential(input.state)), eq(authOAuthAttempts.browserHash, hashAuthCredential(input.browser)),
    eq(authOAuthAttempts.appId, input.appId), eq(authOAuthAttempts.redirectUri, input.redirectUri), isNull(authOAuthAttempts.consumedAt), gt(authOAuthAttempts.expiresAt, sql`CURRENT_TIMESTAMP`),
  ))) === 1;
  if (!consumed) return false;
  const [attempt] = await db.select({ returnTo: authOAuthAttempts.returnTo }).from(authOAuthAttempts)
    .where(eq(authOAuthAttempts.stateHash, hashAuthCredential(input.state))).limit(1);
  return { returnTo: safeAuthReturnPath(attempt?.returnTo) };
}

export async function createAuthSession(input: { id: string; userId: number; appId: string; expiresAt: Date }) {
  if (!validAuthCredential(input.id)) throw new Error("Invalid session identifier");
  await (await database()).insert(authSessions).values({ idHash: hashAuthCredential(input.id), userId: input.userId, appId: input.appId, expiresAt: input.expiresAt });
}

export async function getActiveAuthSession(id: string, appId: string) {
  if (!validAuthCredential(id)) return undefined;
  const [row] = await (await database()).select({ session: authSessions, user: users }).from(authSessions).innerJoin(users, eq(users.id, authSessions.userId)).where(and(
    eq(authSessions.idHash, hashAuthCredential(id)), eq(authSessions.appId, appId), isNull(authSessions.revokedAt), gt(authSessions.expiresAt, sql`CURRENT_TIMESTAMP`),
  )).limit(1);
  return row;
}

export async function revokeAuthSession(id: string, appId: string, userId: number) {
  if (!validAuthCredential(id)) return;
  await (await database()).update(authSessions).set({ revokedAt: sql`CURRENT_TIMESTAMP` }).where(and(eq(authSessions.idHash, hashAuthCredential(id)), eq(authSessions.appId, appId), eq(authSessions.userId, userId), isNull(authSessions.revokedAt)));
}
