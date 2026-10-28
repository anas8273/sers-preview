import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { beginUploadIntentForUser, cancelUploadIntentForUser, getUploadIntentForUser, provisionUploadBudgetForUser, UploadIntentAccessError, UploadIntentConflictError, UploadIntentQuotaError } from "./upload-intent-db";
import { completeUploadIntentForUser } from "./upload-lifecycle-service";
import { reconcileUploadIntentForUser } from "./upload-reception-service";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";
import { getUploadRuntime, SUPPORTED_EVIDENCE_MIME_TYPES, uploadPolicy, UploadRuntimeBusyError, UploadRuntimeUnavailableError, withUploadSlot } from "./upload-runtime";

export function uploadError(error: unknown): TRPCError {
  if (error instanceof TRPCError) return error;
  if (error instanceof UploadIntentAccessError) return new TRPCError({ code: "NOT_FOUND", message: "طلب الرفع غير متاح أو لم تعد تملك صلاحية الوصول إليه" });
  if (error instanceof UploadIntentConflictError) return new TRPCError({ code: "CONFLICT", message: "تغيرت حالة الرفع؛ حدّث الحالة ثم أعد المحاولة" });
  if (error instanceof UploadIntentQuotaError) return new TRPCError({ code: "TOO_MANY_REQUESTS", message: "الحصة المتاحة لا تكفي، أو بلغ عدد طلبات الرفع الحد المسموح" });
  if (error instanceof UploadRuntimeBusyError) return new TRPCError({ code: "TOO_MANY_REQUESTS", message: error.message });
  if (error instanceof UploadRuntimeUnavailableError) return new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
  return new TRPCError({ code: "INTERNAL_SERVER_ERROR", message: "تعذر إكمال العملية؛ تحقق من حالة الطلب قبل إعادة المحاولة" });
}
async function guarded<T>(operation: () => Promise<T>) {
  try { return await operation(); } catch (error) { throw uploadError(error); }
}
const intentId = z.string().uuid();
export const evidenceUploadRouter = router({
  capabilities: protectedProcedure.query(() => {
    try { uploadPolicy(); return { enabled: true, maxBytes: MAX_EVIDENCE_BYTES, mimeTypes: [...SUPPORTED_EVIDENCE_MIME_TYPES] }; }
    catch { return { enabled: false, maxBytes: MAX_EVIDENCE_BYTES, mimeTypes: [...SUPPORTED_EVIDENCE_MIME_TYPES] }; }
  }),
  begin: protectedProcedure.input(z.object({
    idempotencyKey: z.string().regex(/^[A-Za-z0-9_-]{16,128}$/),
    fileName: z.string().min(1).max(255).refine(value => !!value.trim() && !/[\\/\x00-\x1f\x7f:]/.test(value)),
    mimeType: z.enum(SUPPORTED_EVIDENCE_MIME_TYPES), expectedBytes: z.number().int().positive().max(MAX_EVIDENCE_BYTES),
    ownerType: z.enum(["personal", "organization"]).default("personal"), organizationId: z.number().int().positive().optional(), workId: z.number().int().positive().optional(),
  }).superRefine((value, context) => {
    if (value.ownerType === "organization" ? !value.organizationId : value.organizationId !== undefined) context.addIssue({ code: "custom", path: ["organizationId"], message: "نطاق الملكية غير صالح" });
  })).mutation(({ ctx, input }) => guarded(async () => {
    uploadPolicy();
    const runtime = await getUploadRuntime();
    await provisionUploadBudgetForUser(ctx.user.id, input, { limitBytes: input.ownerType === "organization" ? runtime.policy.schoolLimitBytes : runtime.policy.personalLimitBytes, maxActiveIntents: runtime.policy.maxActiveIntents });
    return beginUploadIntentForUser(ctx.user.id, input);
  })),
  status: protectedProcedure.input(z.object({ id: intentId })).query(({ ctx, input }) => guarded(async () => {
    const status = await getUploadIntentForUser(ctx.user.id, input.id);
    if (!status) throw new UploadIntentAccessError();
    return status;
  })),
  complete: protectedProcedure.input(z.object({ id: intentId })).mutation(({ ctx, input }) => guarded(() => withUploadSlot(ctx.user.id, async () => {
    const runtime = await getUploadRuntime();
    let status = await getUploadIntentForUser(ctx.user.id, input.id);
    if (!status) throw new UploadIntentAccessError();
    if (status.state === "receiving") {
      await reconcileUploadIntentForUser(ctx.user.id, input.id, runtime.storage);
      status = await getUploadIntentForUser(ctx.user.id, input.id);
    }
    if (status && ["quarantined", "validating"].includes(status.state)) return completeUploadIntentForUser(ctx.user.id, input.id, runtime);
    return status;
  }))),
  cancel: protectedProcedure.input(z.object({ id: intentId, expectedRevision: z.number().int().nonnegative() })).mutation(({ ctx, input }) => guarded(async () => {
    const status = await cancelUploadIntentForUser(ctx.user.id, input.id, input.expectedRevision);
    if (!status) throw new UploadIntentAccessError();
    return status;
  })),
});
