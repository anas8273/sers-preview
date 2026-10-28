import { AsyncLocalStorage } from "node:async_hooks";

export type AiExecution = { requestId: string; providerInvoked: boolean; expiresAt: Date; deadlineMonotonic: number; returnedModel?: string; promptTokens?: number; completionTokens?: number };
const execution = new AsyncLocalStorage<AiExecution>();
export function runWithAiExecution<T>(value: AiExecution, operation: () => Promise<T>): Promise<T> { return execution.run(value, operation); }
export function remainingAiExecutionTimeMs() {
  const current = execution.getStore();
  // Both clocks matter: the monotonic ceiling starts before reservation, while
  // the database expiry also handles a suspended process resuming after a lease.
  return current ? Math.max(0, Math.min(current.deadlineMonotonic - performance.now(), current.expiresAt.getTime() - Date.now() - 5000)) : Infinity;
}
export function markAiProviderStarted() {
  const current = execution.getStore();
  if (current) {
    if (remainingAiExecutionTimeMs() <= 0 || current.providerInvoked) throw new Error("AI execution lease unavailable");
    current.providerInvoked = true;
  }
}
export function recordAiProviderResult(result: { model: string; usage?: { prompt_tokens?: number; completion_tokens?: number; total_tokens?: number } }) {
  const current = execution.getStore();
  if (!current) return;
  if (/^[A-Za-z0-9._:/-]{1,128}$/.test(result.model)) current.returnedModel = result.model;
  const bounded = (value: number | undefined) => Number.isSafeInteger(value) && value! >= 0 && value! <= 10_000_000 ? value : undefined;
  current.promptTokens = bounded(result.usage?.prompt_tokens);
  current.completionTokens = bounded(result.usage?.completion_tokens);
}
