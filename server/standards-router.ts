import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  getSmartEvidenceMatrixForUser,
  linkAssetToStandardForUser,
  listStandardsForAssetForUser,
  listStandardVersions,
  seedOfficialStandardsPacks,
  unlinkAssetFromStandardForUser,
} from "./standards-db";

const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });

export const standardsRouter = router({
  list: protectedProcedure
    .input(z.object({ activeOnly: z.boolean().default(true) }).strict().optional())
    .query(({ input }) => listStandardVersions(input?.activeOnly ?? true)),

  listForAsset: protectedProcedure
    .input(z.object({ assetId: z.number().int().positive() }).strict())
    .query(async ({ ctx, input }) => {
      const rows = await listStandardsForAssetForUser(ctx.user.id, input.assetId);
      if (!rows) throw forbidden("لا تملك صلاحية عرض معايير هذا الشاهد");
      return rows;
    }),

  linkAsset: protectedProcedure
    .input(z.object({
      assetId: z.number().int().positive(),
      standardVersionId: z.number().int().positive(),
      note: z.string().trim().max(1000).optional(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const result = await linkAssetToStandardForUser(ctx.user.id, input);
      if (result === undefined) throw forbidden("لا تملك صلاحية ربط هذا الشاهد");
      if (result === null) throw notFound("إصدار المعيار غير موجود أو غير نشط");
      return result;
    }),

  unlinkAsset: protectedProcedure
    .input(z.object({
      assetId: z.number().int().positive(),
      standardVersionId: z.number().int().positive(),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      const ok = await unlinkAssetFromStandardForUser(ctx.user.id, input);
      if (!ok) throw forbidden("لا تملك صلاحية فك ارتباط هذا الشاهد");
      return { success: true as const };
    }),

  seedOfficialPacks: protectedProcedure
    .input(z.object({
      packId: z.enum(["saudi-teacher-eval-7", "saudi-teacher-standards-11", "all"]).default("all"),
    }).strict().optional())
    .mutation(({ input }) => seedOfficialStandardsPacks(input?.packId ?? "all")),

  coverageMatrix: protectedProcedure
    .input(z.object({
      packId: z.enum(["saudi-teacher-eval-7", "saudi-teacher-standards-11", "all"]).default("saudi-teacher-eval-7"),
    }).strict().optional())
    .query(({ ctx, input }) => getSmartEvidenceMatrixForUser(ctx.user.id, input?.packId ?? "saudi-teacher-eval-7")),
});

export type StandardsRouter = typeof standardsRouter;
