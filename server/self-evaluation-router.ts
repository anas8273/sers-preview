import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { AccountAccessError, AccountValidationError } from "./account-db";
import {
  SELF_EVALUATION_DOMAINS,
  SELF_EVALUATION_FRAMEWORK_ID,
  SELF_EVALUATION_FRAMEWORK_META,
  SELF_EVALUATION_INDICATORS,
  SELF_EVALUATION_LEVELS,
  SELF_EVALUATION_STANDARDS,
  SelfEvaluationValidationError,
} from "../shared/self-evaluation";
import {
  createReportFromImprovementActionForUser,
  createSelfEvaluationCycleForUser,
  getSelfEvaluationCycleForUser,
  listSelfEvaluationCyclesForUser,
  saveSelfEvaluationCycleForUser,
  SelfEvaluationAccessError,
  SelfEvaluationConflictError,
} from "./self-evaluation-db";

const assessmentSchema = z.object({
  indicatorKey: z.string().trim().min(2).max(64),
  level: z.union([z.literal(1), z.literal(2), z.literal(3), z.literal(4)]).nullable(),
  rationale: z.string().max(3000),
  evidenceAssetIds: z.array(z.number().int().positive()).max(25),
});

const actionSchema = z.object({
  id: z.string().trim().min(2).max(64),
  indicatorKey: z.string().trim().min(2).max(64),
  // Length >= 3 is enforced by `normalizeSelfEvaluationDraft(..., { strictValidation: true })`
  // so users receive a clear Arabic validation message rather than raw Zod JSON.
  goal: z.string().max(300).default(""),
  action: z.string().max(600).default(""),
  ownerName: z.string().max(120).default(""),
  dueDate: z.string().max(16).default(""),
  status: z.enum(["planned", "in_progress", "completed"]).default("planned"),
  linkedWorkItemId: z.number().int().positive().nullable().default(null),
});

function mapError(error: unknown): never {
  if (error instanceof SelfEvaluationAccessError || error instanceof AccountAccessError) {
    throw new TRPCError({ code: "FORBIDDEN", message: error.message || "لا تملك صلاحية تنفيذ هذه العملية" });
  }
  if (error instanceof SelfEvaluationConflictError) {
    throw new TRPCError({ code: "CONFLICT", message: error.message });
  }
  if (error instanceof SelfEvaluationValidationError || error instanceof AccountValidationError) {
    throw new TRPCError({ code: "BAD_REQUEST", message: error.message });
  }
  throw error;
}

export const selfEvaluationRouter = router({
  framework: protectedProcedure.query(() => ({
    frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
    meta: SELF_EVALUATION_FRAMEWORK_META,
    domains: SELF_EVALUATION_DOMAINS,
    standards: SELF_EVALUATION_STANDARDS,
    indicators: SELF_EVALUATION_INDICATORS,
    levels: SELF_EVALUATION_LEVELS,
  })),

  listCycles: protectedProcedure.query(({ ctx }) => listSelfEvaluationCyclesForUser(ctx.user.id)),

  getCycle: protectedProcedure
    .input(z.object({ workItemId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const cycle = await getSelfEvaluationCycleForUser(ctx.user.id, input.workItemId);
      if (!cycle) {
        throw new TRPCError({ code: "NOT_FOUND", message: "دورة التقويم الذاتي غير موجودة أو لا تملك صلاحية عرضها" });
      }
      return cycle;
    }),

  createCycle: protectedProcedure
    .input(
      z
        .object({
          title: z.string().trim().min(3).max(255),
          ownerType: z.enum(["personal", "organization"]).default("organization"),
          schoolCategory: z.enum(["government", "private_international"]).default("government"),
          organizationId: z.number().int().positive().optional(),
          academicYearId: z.number().int().positive().optional(),
          academicTermId: z.number().int().positive().optional(),
        })
        .superRefine((val, ctx) => {
          if (val.ownerType === "organization" && !val.organizationId) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ["organizationId"],
              message: "اختر المدرسة المالكة لدورة التقويم الذاتي",
            });
          }
        }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createSelfEvaluationCycleForUser(ctx.user.id, input);
      } catch (error) {
        mapError(error);
      }
    }),

  saveCycle: protectedProcedure
    .input(
      z.object({
        workItemId: z.number().int().positive(),
        expectedRevision: z.number().int().positive(),
        schoolCategory: z.enum(["government", "private_international"]).optional(),
        executiveSummary: z.string().max(4000).default(""),
        assessments: z.record(z.string(), assessmentSchema),
        improvementActions: z.array(actionSchema).max(100),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await saveSelfEvaluationCycleForUser(ctx.user.id, input);
      } catch (error) {
        mapError(error);
      }
    }),

  createActionReport: protectedProcedure
    .input(
      z.object({
        workItemId: z.number().int().positive(),
        expectedRevision: z.number().int().positive(),
        actionId: z.string().trim().min(2).max(64),
      }),
    )
    .mutation(async ({ ctx, input }) => {
      try {
        return await createReportFromImprovementActionForUser(ctx.user.id, input);
      } catch (error) {
        mapError(error);
      }
    }),
});
