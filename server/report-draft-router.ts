import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createReportDraftVersionForUser,
  getReportDraftForUser,
  ReportDraftAccessError,
  ReportDraftConflictError,
  ReportDraftValidationError,
  ReportEvidenceFreezeError,
  saveReportDraftForUser,
} from "./work-report-draft-db";

const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });
const conflict = (message: string) => new TRPCError({ code: "CONFLICT", message });
const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

const reportFieldsSchema = z.record(
  z.string().trim().min(1).max(128),
  z.union([
    z.string().max(20_000),
    z.number().finite(),
    z.array(z.string().max(2_000)).max(100),
  ]),
).refine(value => Object.keys(value).length <= 100, "عدد حقول التقرير أكبر من الحد المسموح");

export const reportDraftRouter = router({
  get: protectedProcedure
    .input(z.object({ workItemId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      try {
        const result = await getReportDraftForUser(ctx.user.id, input.workItemId);
        if (!result) throw notFound("التقرير غير موجود أو لا تملك صلاحية الوصول إليه");
        return result;
      } catch (error) {
        if (error instanceof ReportDraftAccessError) throw forbidden(error.message);
        if (error instanceof ReportDraftValidationError) throw badRequest(error.message);
        throw error;
      }
    }),

  save: protectedProcedure
    .input(z.object({
      workItemId: z.number().int().positive(),
      expectedRevision: z.number().int().min(0),
      templateId: z.string().trim().min(1).max(128).default("custom"),
      themeId: z.string().trim().min(1).max(128).default("classic"),
      fontFamily: z.string().trim().min(1).max(128).default("Cairo"),
      fields: reportFieldsSchema,
      evidenceAssetIds: z.array(z.number().int().positive()).max(100).default([]),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveReportDraftForUser(ctx.user.id, input);
      } catch (error) {
        if (error instanceof ReportDraftAccessError) throw forbidden(error.message);
        if (error instanceof ReportDraftConflictError) {
          throw conflict("تغير التقرير في جلسة أخرى؛ حدّث الصفحة ثم راجع التغييرات قبل الحفظ");
        }
        if (error instanceof ReportDraftValidationError) throw badRequest(error.message);
        throw error;
      }
    }),

  createVersion: protectedProcedure
    .input(z.object({
      workItemId: z.number().int().positive(),
      expectedRevision: z.number().int().min(1),
      reason: z.string().trim().max(255).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        return await createReportDraftVersionForUser(ctx.user.id, input);
      } catch (error) {
        if (error instanceof ReportDraftAccessError) throw forbidden(error.message);
        if (error instanceof ReportDraftConflictError) throw conflict(error.message);
        if (error instanceof ReportDraftValidationError) throw badRequest(error.message);
        if (error instanceof ReportEvidenceFreezeError) throw conflict(error.message);
        throw error;
      }
    }),
});

export type ReportDraftRouter = typeof reportDraftRouter;
