import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { aiProviderState, aiRequestBudgets, aiRequests } from "../drizzle/ai";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { AiAdmissionError, finishAiRequest, reserveAiRequest } from "./ai-admission-db";
import { type AiLimits } from "./ai-policy";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite.sequential("durable AI admission under concurrency on disposable MySQL", () => {
  let db: NonNullable<Awaited<ReturnType<typeof getDb>>>;
  const userIds: number[] = [];
  const limits: AiLimits = { userDaily: 50, globalDaily: 100, userMinute: 60, userConcurrency: 4, globalConcurrency: 8 };
  async function guard() {
    expect(process.env.GITHUB_ACTIONS).toBe("true");
    expect(process.env.DATABASE_URL).toBe("mysql://root:root@127.0.0.1:3306/sers_test");
    const [rows] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    expect((rows as unknown as Array<{ name: string; version: string }>)[0]).toMatchObject({ name: "sers_test", version: expect.stringMatching(/^8\.4\./) });
  }
  async function reset() {
    await guard();
    await db.delete(aiRequests); await db.delete(aiRequestBudgets); await db.delete(aiProviderState);
  }
  const reserve = (userId = userIds[0], overrides: Partial<AiLimits> = {}) => reserveAiRequest({ userId, operation: "suggest", limits: { ...limits, ...overrides } });
  const finish = (requestId: string) => finishAiRequest({ requestId, outcome: "succeeded", providerInvoked: true, returnedModel: "gemini-2.5-flash", promptTokens: 10, completionTokens: 5 });
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("AI admission proof requires disposable CI MySQL");
    const database = await getDb(); expect(database).not.toBeNull(); db = database!; await guard();
    for (let index = 0; index < 3; index++) {
      const [inserted] = await db.insert(users).values({ openId: `ai-admission-${randomUUID()}` }); userIds.push(Number(inserted.insertId));
    }
  });
  beforeEach(reset);
  afterAll(async () => { if (db) { await reset(); if (userIds.length) await db.delete(users).where(inArray(users.id, userIds)); } });

  it("serializes the last global daily slot and rolls back every rejected request's counters", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => reserve(userIds[index % userIds.length], { globalDaily: 1 })));
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    for (const result of results) if (result.status === "rejected") { expect(result.reason).toBeInstanceOf(AiAdmissionError); expect(result.reason.kind).toBe("budget"); }
    expect(await db.select().from(aiRequests)).toHaveLength(1);
    const budgets = await db.select().from(aiRequestBudgets);
    expect(budgets).toHaveLength(3); expect(budgets.every(row => row.requestCount === 1)).toBe(true);
  });

  it("bounds aggregate concurrency across users and restores capacity only after durable completion", async () => {
    const results = await Promise.allSettled(Array.from({ length: 12 }, (_, index) => reserve(userIds[index % userIds.length], { globalConcurrency: 2 })));
    const accepted = results.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>> => result.status === "fulfilled");
    expect(accepted).toHaveLength(2);
    for (const result of results) if (result.status === "rejected") expect(result.reason).toMatchObject({ kind: "busy" });
    const before = await db.select().from(aiRequests); expect(before).toHaveLength(2); expect(before.every(row => row.status === "active")).toBe(true);
    expect(await finish(accepted[0].value.requestId)).toBe(true);
    const replacement = await reserve(userIds[2], { globalConcurrency: 2 }); expect(replacement.requestId).not.toBe(accepted[0].value.requestId);
    expect((await db.select().from(aiRequests).where(eq(aiRequests.status, "active")))).toHaveLength(2);
  });

  it("maintains separate personal and global daily budgets after requests finish", async () => {
    const bounded = { userDaily: 2, globalDaily: 4 };
    for (const userId of userIds.slice(0, 2)) {
      for (let count = 0; count < 2; count++) { const request = await reserve(userId, bounded); await finish(request.requestId); }
      await expect(reserve(userId, bounded)).rejects.toMatchObject({ kind: "budget" });
    }
    await expect(reserve(userIds[2], bounded)).rejects.toMatchObject({ kind: "budget" });
    expect(await db.select().from(aiRequests)).toHaveLength(4);
    const budgets = await db.select().from(aiRequestBudgets);
    expect(budgets.find(row => row.key.startsWith("global:day:"))?.requestCount).toBe(4);
    expect(budgets.filter(row => row.key.startsWith(`user:${userIds[2]}:`))).toHaveLength(0);
  });

  it("settles once under concurrent duplicate completion and persists no free-form error payload", async () => {
    const reservation = await reserve();
    const results = await Promise.all(Array.from({ length: 10 }, () => finishAiRequest({ requestId: reservation.requestId,
      outcome: "failed", providerInvoked: true, errorCode: "PRIVATE_PROVIDER_BODY", returnedModel: "PRIVATE MODEL WITH SPACES", promptTokens: -1, completionTokens: NaN })));
    expect(results.filter(Boolean)).toHaveLength(1);
    const [row] = await db.select().from(aiRequests).where(eq(aiRequests.id, reservation.requestId));
    expect(row).toMatchObject({ status: "failed", errorCode: "failed", returnedModel: null, promptTokens: null, completionTokens: null });
    expect(row.completedAt).toBeInstanceOf(Date); expect(JSON.stringify(row)).not.toContain("PRIVATE_");
    const [state] = await db.select().from(aiProviderState); expect(state.failureCount).toBe(1);
  });

  it("recovers an expired lease without refunding its uncertain request or accepting a late result", async () => {
    const first = await reserve(userIds[0], { userConcurrency: 1 });
    await db.update(aiRequests).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(aiRequests.id, first.requestId));
    const second = await reserve(userIds[0], { userConcurrency: 1 });
    const [abandoned] = await db.select().from(aiRequests).where(eq(aiRequests.id, first.requestId));
    expect(abandoned).toMatchObject({ status: "abandoned", errorCode: "lease_expired" });
    expect(await finish(first.requestId)).toBe(false);
    expect((await db.select().from(aiRequests).where(eq(aiRequests.id, second.requestId)))[0].status).toBe("active");
    expect((await db.select().from(aiRequestBudgets)).find(row => row.key.startsWith("global:day:"))?.requestCount).toBe(2);
  });

  it("allows exactly one half-open probe and ignores late successful calls from before circuit opening", async () => {
    const older = await reserve(userIds[1]);
    for (let count = 0; count < 3; count++) {
      const failed = await reserve(); await finishAiRequest({ requestId: failed.requestId, outcome: "failed", providerInvoked: true, errorCode: "unavailable" });
    }
    await expect(reserve()).rejects.toMatchObject({ kind: "circuit" });
    expect(await finish(older.requestId)).toBe(true);
    await expect(reserve()).rejects.toMatchObject({ kind: "circuit" });
    await db.update(aiProviderState).set({ openUntil: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(aiProviderState.provider, "manus-forge"));
    const attempts = await Promise.allSettled(Array.from({ length: 8 }, (_, index) => reserve(userIds[index % userIds.length])));
    const accepted = attempts.filter((result): result is PromiseFulfilledResult<Awaited<ReturnType<typeof reserve>>> => result.status === "fulfilled");
    expect(accepted).toHaveLength(1);
    for (const result of attempts) if (result.status === "rejected") expect(result.reason).toMatchObject({ kind: "circuit" });
    const [probing] = await db.select().from(aiProviderState); expect(probing.probeRequestId).toBe(accepted[0].value.requestId);
    expect(await finish(accepted[0].value.requestId)).toBe(true);
    const [recovered] = await db.select().from(aiProviderState); expect(recovered).toMatchObject({ failureCount: 0, openUntil: null, probeRequestId: null });
    await expect(reserve()).resolves.toHaveProperty("requestId");
  });

  it("does not use a locally refused half-open probe as proof that the provider recovered", async () => {
    await db.insert(aiProviderState).values({ provider: "manus-forge", failureCount: 3, openUntil: new Date(Date.now() - 10_000) });
    const probe = await reserve();
    expect(await finishAiRequest({ requestId: probe.requestId, outcome: "failed", providerInvoked: false, errorCode: "invalid_request" })).toBe(true);
    const [state] = await db.select().from(aiProviderState); expect(state.failureCount).toBe(3); expect(state.probeRequestId).toBeNull();
    const replacement = await reserve();
    expect((await db.select().from(aiProviderState))[0].probeRequestId).toBe(replacement.requestId);
  });

  it("rolls back admission and counters when a real foreign-key insert fails", async () => {
    const [missing] = await db.select({ id: users.id }).from(users).where(eq(users.id, 2_147_483_647)); expect(missing).toBeUndefined();
    await expect(reserve(2_147_483_647)).rejects.toThrow();
    expect(await db.select().from(aiRequests)).toEqual([]); expect(await db.select().from(aiRequestBudgets)).toEqual([]);
    const good = await reserve(); expect(good.requestId).toMatch(/^[a-f0-9-]{36}$/);
  });

  it("fails closed during a real admission-table outage and resumes after the table is restored", async () => {
    await guard(); const unavailable = sql.identifier(`ai_requests_unavailable_${randomUUID().replaceAll("-", "")}`); let renamed = false;
    try {
      await db.execute(sql`RENAME TABLE ${aiRequests} TO ${unavailable}`); renamed = true;
      await expect(reserve()).rejects.toThrow(); expect(await db.select().from(aiRequestBudgets)).toEqual([]);
    } finally { if (renamed) await db.execute(sql`RENAME TABLE ${unavailable} TO ${aiRequests}`); }
    await expect(reserve()).resolves.toHaveProperty("requestId");
  });
});
