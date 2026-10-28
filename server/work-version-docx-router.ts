import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { generatePrivateDocxForWorkVersion, getPrivateDocxDownloadForUser, OutputArtifactUnavailableError, PrivateDocxStorageUnavailableError } from "./work-version-output-service";
import { ReportDocxValidationError } from "./work-version-docx-renderer";

export const workVersionDocxRouter = router({
  generatePrivateDocx: protectedProcedure.input(z.object({ workVersionId: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await generatePrivateDocxForWorkVersion(ctx.user.id, input.workVersionId);
      if (!result) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية إنشاء Word لهذه النسخة" });
      return result;
    } catch (error) {
      if (error instanceof PrivateDocxStorageUnavailableError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
      if (error instanceof OutputArtifactUnavailableError) throw new TRPCError({ code: "CONFLICT", message: error.message });
      if (error instanceof ReportDocxValidationError) throw new TRPCError({ code: "BAD_REQUEST", message: "محتوى النسخة غير صالح لتصدير Word" });
      throw error;
    }
  }),
  getPrivateDocxDownload: protectedProcedure.input(z.object({ id: z.number().int().positive() })).mutation(async ({ ctx, input }) => {
    try {
      const result = await getPrivateDocxDownloadForUser(ctx.user.id, input.id);
      if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "المخرج غير متاح أو لا تملك صلاحية تنزيله" });
      return result;
    } catch (error) {
      if (error instanceof PrivateDocxStorageUnavailableError) throw new TRPCError({ code: "PRECONDITION_FAILED", message: error.message });
      if (error instanceof OutputArtifactUnavailableError) throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
      throw error;
    }
  }),
});
