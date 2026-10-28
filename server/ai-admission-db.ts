import { randomUUID } from "node:crypto";
import { and, eq, gt, lte, sql } from "drizzle-orm";
import { aiProviderState, aiRequestBudgets, aiRequests } from "../drizzle/ai";
import { getDb } from "./db";
import { AI_CIRCUIT_FAILURES, AI_CIRCUIT_OPEN_MS, AI_CONFIGURED_MODEL, AI_LEASE_MS, AI_OPERATIONS, AI_PROMPT_VERSION, AI_PROVIDER, getAiLimits, type AiLimits, type AiOperation } from "./ai-policy";

export class AiAdmissionError extends Error {
  constructor(readonly kind: "budget" | "busy" | "circuit" | "unavailable") { super("AI request unavailable"); this.name = "AiAdmissionError"; }
}
async function database() { const db = await getDb(); if (!db) throw new AiAdmissionError("unavailable"); return db; }
const validLimits = (limits: AiLimits) => Object.values(limits).every(value => Number.isSafeInteger(value) && value >= 1 && value <= 10000) && limits.globalConcurrency <= 32 && limits.userConcurrency <= 4;

export async function reserveAiRequest(input: { userId: number; operation: AiOperation; limits?: AiLimits }) {
  if (!Number.isSafeInteger(input.userId) || input.userId < 1 || !AI_OPERATIONS.includes(input.operation)) throw new AiAdmissionError("unavailable");
  const limits = input.limits ?? getAiLimits();
  if (!validLimits(limits)) throw new AiAdmissionError("unavailable");
  const db = await database(), requestId = randomUUID();
  return db.transaction(async tx => {
    // One provider row is the ordering lock for admission, lease cleanup and
    // completion across every process. No provider call holds this transaction.
    await tx.insert(aiProviderState).values({ provider: AI_PROVIDER }).onDuplicateKeyUpdate({ set: { provider: AI_PROVIDER } });
    const [state] = await tx.select().from(aiProviderState).where(eq(aiProviderState.provider, AI_PROVIDER)).for("update");
    const [clock] = await tx.select({ milliseconds: sql<number>`UNIX_TIMESTAMP(CURRENT_TIMESTAMP) * 1000` }).from(aiProviderState).where(eq(aiProviderState.provider, AI_PROVIDER));
    const now = new Date(Number(clock.milliseconds)), expiresAt = new Date(now.getTime() + AI_LEASE_MS);
    if (!Number.isFinite(now.getTime())) throw new AiAdmissionError("unavailable");
    if (state.openUntil && state.openUntil > now) throw new AiAdmissionError("circuit");
    const halfOpen = state.failureCount >= AI_CIRCUIT_FAILURES;
    if (halfOpen && state.probeRequestId && state.probeExpiresAt && state.probeExpiresAt > now) throw new AiAdmissionError("circuit");
    await tx.update(aiRequests).set({ status: "abandoned", completedAt: now, errorCode: "lease_expired" }).where(and(eq(aiRequests.provider, AI_PROVIDER), eq(aiRequests.status, "active"), lte(aiRequests.expiresAt, now))).limit(100);
    const active = await tx.select({ userId: aiRequests.userId }).from(aiRequests).where(and(eq(aiRequests.provider, AI_PROVIDER), eq(aiRequests.status, "active"), gt(aiRequests.expiresAt, now))).limit(33);
    if (active.length >= limits.globalConcurrency || active.filter(row => row.userId === input.userId).length >= limits.userConcurrency) throw new AiAdmissionError("busy");
    const day = Math.floor(now.getTime() / 86_400_000) * 86_400_000, minute = Math.floor(now.getTime() / 60_000) * 60_000;
    const buckets = [
      { key: `global:day:${day}`, start: day, duration: 86_400_000, max: limits.globalDaily },
      { key: `user:${input.userId}:day:${day}`, start: day, duration: 86_400_000, max: limits.userDaily },
      { key: `user:${input.userId}:minute:${minute}`, start: minute, duration: 60_000, max: limits.userMinute },
    ].sort((a, b) => a.key.localeCompare(b.key));
    for (const bucket of buckets) {
      await tx.insert(aiRequestBudgets).values({ key: bucket.key, windowStart: new Date(bucket.start), expiresAt: new Date(bucket.start + bucket.duration) }).onDuplicateKeyUpdate({ set: { key: bucket.key } });
      const [row] = await tx.select().from(aiRequestBudgets).where(eq(aiRequestBudgets.key, bucket.key)).for("update");
      if (row.requestCount >= bucket.max) throw new AiAdmissionError("budget");
      await tx.update(aiRequestBudgets).set({ requestCount: row.requestCount + 1 }).where(eq(aiRequestBudgets.key, bucket.key));
    }
    await tx.insert(aiRequests).values({ id: requestId, userId: input.userId, operation: input.operation, status: "active", provider: AI_PROVIDER, configuredModel: AI_CONFIGURED_MODEL, promptVersion: AI_PROMPT_VERSION, startedAt: now, expiresAt });
    if (halfOpen) await tx.update(aiProviderState).set({ probeRequestId: requestId, probeExpiresAt: expiresAt }).where(eq(aiProviderState.provider, AI_PROVIDER));
    await tx.delete(aiRequestBudgets).where(lte(aiRequestBudgets.expiresAt, now)).limit(100);
    return { requestId, expiresAt };
  });
}

const errorCodes = new Set(["timeout", "unavailable", "response_too_large", "invalid_response", "invalid_request", "invalid_output", "failed"]);
export async function finishAiRequest(input: { requestId: string; outcome: "succeeded" | "failed"; errorCode?: string; providerInvoked?: boolean; returnedModel?: string; promptTokens?: number; completionTokens?: number }) {
  if (!/^[a-f0-9-]{36}$/.test(input.requestId)) return false;
  const db = await database();
  return db.transaction(async tx => {
    const [state] = await tx.select().from(aiProviderState).where(eq(aiProviderState.provider, AI_PROVIDER)).for("update");
    if (!state) return false;
    const [request] = await tx.select().from(aiRequests).where(eq(aiRequests.id, input.requestId)).for("update");
    if (!request || request.status !== "active") return false;
    const [clock] = await tx.select({ milliseconds: sql<number>`UNIX_TIMESTAMP(CURRENT_TIMESTAMP) * 1000` }).from(aiProviderState).where(eq(aiProviderState.provider, AI_PROVIDER));
    const now = new Date(Number(clock.milliseconds));
    if (request.expiresAt <= now) {
      await tx.update(aiRequests).set({ status: "abandoned", completedAt: now, errorCode: "lease_expired" }).where(eq(aiRequests.id, input.requestId));
      return false;
    }
    const tokens = (value: number | undefined) => Number.isSafeInteger(value) && value! >= 0 && value! <= 10_000_000 ? value : null;
    await tx.update(aiRequests).set({ status: input.outcome, completedAt: now, providerInvoked: input.providerInvoked === true,
      returnedModel: input.returnedModel && /^[A-Za-z0-9._:/-]{1,128}$/.test(input.returnedModel) ? input.returnedModel : null,
      promptTokens: tokens(input.promptTokens), completionTokens: tokens(input.completionTokens),
      errorCode: input.outcome === "failed" ? errorCodes.has(input.errorCode ?? "") ? input.errorCode! : "failed" : null,
    }).where(eq(aiRequests.id, input.requestId));
    if (input.providerInvoked) {
      // Ignore results from older closed-state requests after a circuit has
      // opened; only the admitted recovery probe may close the open circuit.
      const controlsCircuit = state.probeRequestId ? state.probeRequestId === input.requestId : !state.openUntil;
      if (controlsCircuit) {
        const failureCount = input.outcome === "succeeded" ? 0 : state.failureCount + 1;
        await tx.update(aiProviderState).set({ failureCount, openUntil: failureCount >= AI_CIRCUIT_FAILURES ? new Date(now.getTime() + AI_CIRCUIT_OPEN_MS) : null, probeRequestId: null, probeExpiresAt: null }).where(eq(aiProviderState.provider, AI_PROVIDER));
      }
    } else if (state.probeRequestId === input.requestId) {
      // A local validation/configuration refusal is not evidence of recovery.
      await tx.update(aiProviderState).set({ probeRequestId: null, probeExpiresAt: null }).where(eq(aiProviderState.provider, AI_PROVIDER));
    }
    return true;
  });
}
