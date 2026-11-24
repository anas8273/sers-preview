import { TRPCError } from "@trpc/server";
import { z } from "zod";
import {
  isReportIdentityFieldKey,
  REPORT_IDENTITY_FIELDS,
  REPORT_IDENTITY_TEXT_LIMIT,
  REPORT_SCHOOL_LOGO_MAX_BASE64,
} from "../shared/report-appearance";
import { protectedProcedure, router } from "./_core/trpc";
import { sanitizeReportSchoolLogo } from "./work-version-report-assets";
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

const reportIdentitySchema = z.object({
  version: z.literal("1").default("1"),
  schoolName: z.string().max(REPORT_IDENTITY_TEXT_LIMIT).optional(),
  reportPreparer: z.string().max(REPORT_IDENTITY_TEXT_LIMIT).optional(),
  schoolPrincipal: z.string().max(REPORT_IDENTITY_TEXT_LIMIT).optional(),
  ministryLogo: z.boolean().optional(),
  schoolLogoPng: z.string().max(REPORT_SCHOOL_LOGO_MAX_BASE64).optional(),
}).strict().optional();

const reportFieldsSchema = z.record(
  z.string().trim().min(1).max(128),
  z.union([
    z.string().max(REPORT_SCHOOL_LOGO_MAX_BASE64),
    z.number().finite(),
    z.array(z.string().max(2_000)).max(100),
  ]),
).refine(value => Object.keys(value).length <= 100, "عدد حقول التقرير أكبر من الحد المسموح")
  .refine(fields => Object.entries(fields).every(([key, value]) => {
    if (typeof value !== "string") return true;
    if (fields.reportIdentityVersion === "1") {
      if (key === "schoolLogoPng") return value.length <= REPORT_SCHOOL_LOGO_MAX_BASE64;
      if (REPORT_IDENTITY_FIELDS.some(field => field.key === key)) return value.length <= REPORT_IDENTITY_TEXT_LIMIT;
    }
    return value.length <= 20_000;
  }), "أحد حقول التقرير أطول من الحد المسموح");

const reportFieldDefinitionSchema = z.object({
  key: z.string().regex(/^[A-Za-z][A-Za-z0-9_-]{0,127}$/),
  label: z.string().trim().min(1).max(255),
  type: z.enum(["text", "textarea", "number", "date", "select", "list"]),
  placeholder: z.string().max(1000).optional(),
  options: z.array(z.string().max(255)).max(100).optional(),
  maxLength: z.number().int().positive().max(20_000).optional(),
  rows: z.number().int().positive().max(20).optional(),
});

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
      schemaVersion: z.number().int().min(1).max(2).optional(),
      templateId: z.string().trim().min(1).max(128).default("custom"),
      templateVersionId: z.string().trim().min(1).max(128).optional(),
      themeId: z.string().trim().min(1).max(128).default("classic"),
      fontFamily: z.string().trim().min(1).max(128).default("Cairo"),
      fields: reportFieldsSchema,
      reportIdentity: reportIdentitySchema,
      fieldDefinitions: z.array(reportFieldDefinitionSchema).max(100).optional(),
      evidenceAssetIds: z.array(z.number().int().positive()).max(100).default([]),
    }).superRefine((input, ctx) => {
      const hasFieldIdentityKeys = Object.keys(input.fields).some(isReportIdentityFieldKey);
      if (input.schemaVersion === 2 && hasFieldIdentityKeys) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["fields"],
          message: "لا يُسمح بحقول هوية التقرير داخل fields في إصدار المخطط 2؛ استخدم reportIdentity",
        });
      }
      if (input.reportIdentity !== undefined && hasFieldIdentityKeys) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["reportIdentity"],
          message: "لا يمكن إرسال هوية التقرير في reportIdentity و fields معًا",
        });
      }
      if (input.schemaVersion === 2) {
        for (const [key, value] of Object.entries(input.fields)) {
          if (typeof value === "string" && value.length > 20_000) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["fields", key],
              message: "أحد حقول التقرير أطول من الحد المسموح",
            });
          }
        }
      }
    }))
    .mutation(async ({ ctx, input }) => {
      const fields = { ...input.fields };
      let reportIdentity = input.reportIdentity ? { ...input.reportIdentity } : undefined;
      if (reportIdentity?.schoolLogoPng) {
        try {
          reportIdentity.schoolLogoPng = sanitizeReportSchoolLogo(reportIdentity.schoolLogoPng).bytes.toString("base64");
        } catch {
          throw badRequest("تعذّر حفظ شعار المدرسة. اختر صورة PNG صالحة ضمن الحجم المسموح.");
        }
      }
      if (input.schemaVersion !== 2 && fields.reportIdentityVersion === "1" && typeof fields.schoolLogoPng === "string" && fields.schoolLogoPng) {
        try {
          fields.schoolLogoPng = sanitizeReportSchoolLogo(fields.schoolLogoPng).bytes.toString("base64");
        } catch {
          throw badRequest("تعذّر حفظ شعار المدرسة. اختر صورة PNG صالحة ضمن الحجم المسموح.");
        }
      }
      try {
        return await saveReportDraftForUser(ctx.user.id, { ...input, fields, reportIdentity });
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
