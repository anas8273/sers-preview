import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, publicProcedure, router } from "./_core/trpc";
import { AiAdmissionError, finishAiRequest, reserveAiRequest } from "./ai-admission-db";
import { remainingAiExecutionTimeMs, runWithAiExecution, type AiExecution } from "./ai-execution-context";
import { aiAvailability, type AiOperation } from "./ai-policy";

function unavailable() { return new TRPCError({ code: "SERVICE_UNAVAILABLE", message: "المساعد غير متاح الآن. يمكنك متابعة العمل يدويًا والمحاولة لاحقًا." }); }
export function isAiRequestOrigin(origin: string | undefined) {
  const configured = process.env.APP_PUBLIC_ORIGIN;
  if (!configured || !origin) return false;
  try { const url = new URL(configured); return !url.username && !url.password && !url.search && !url.hash && url.pathname === "/" && origin === url.origin && (url.protocol === "https:" || (process.env.NODE_ENV !== "production" && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname))); } catch { return false; }
}
export function aiProcedure<T extends z.ZodTypeAny>(operation: AiOperation, schema: T) {
  return protectedProcedure.input(schema).use(async ({ ctx, next }) => {
    if (!isAiRequestOrigin(ctx.req.headers.origin)) throw new TRPCError({ code: "FORBIDDEN", message: "مصدر الطلب غير صالح" });
    if (!aiAvailability(true).available) throw new TRPCError({ code: "PRECONDITION_FAILED", message: "المساعد غير مفعّل لهذه البيئة. يمكنك متابعة العمل يدويًا." });
    const started = performance.now();
    let admission: Awaited<ReturnType<typeof reserveAiRequest>>;
    try { admission = await reserveAiRequest({ userId: ctx.user.id, operation }); }
    catch (error) {
      if (error instanceof AiAdmissionError && ["budget", "busy"].includes(error.kind)) throw new TRPCError({ code: "TOO_MANY_REQUESTS", message: "بلغت حد طلبات المساعد أو الطلبات المتزامنة. تابع يدويًا وحاول لاحقًا." });
      throw unavailable();
    }
    const execution: AiExecution = { requestId: admission.requestId, providerInvoked: false, expiresAt: admission.expiresAt, deadlineMonotonic: started + 80_000 };
    let result: Awaited<ReturnType<typeof next>>;
    try { result = await runWithAiExecution(execution, () => {
      if (remainingAiExecutionTimeMs() <= 0) throw unavailable();
      return next();
    }); }
    catch {
      try { await finishAiRequest({ ...execution, outcome: "failed", errorCode: "failed" }); } catch { /* Lease remains held until expiry. */ }
      throw unavailable();
    }
    const invalidOutput = result.ok && typeof result.data === "object" && result.data !== null && "success" in result.data && result.data.success === false;
    const kind = !result.ok && result.error.cause && typeof result.error.cause === "object" && "kind" in result.error.cause ? String(result.error.cause.kind) : "failed";
    try {
      const completed = await finishAiRequest({ ...execution, outcome: result.ok && !invalidOutput ? "succeeded" : "failed", errorCode: invalidOutput ? "invalid_output" : kind });
      if (!completed) throw new Error("Admission completion unavailable");
    } catch { throw unavailable(); }
    if (!result.ok) throw unavailable();
    return result;
  });
}

export const aiAccessRouter = router({ status: publicProcedure.query(({ ctx }) => {
  ctx.res.setHeader?.("Cache-Control", "private, no-store");
  return aiAvailability(Boolean(ctx.user));
}) });
