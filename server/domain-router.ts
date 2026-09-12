import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  createAssetForUser,
  createWorkItemForUser,
  createWorkVersionForUser,
  getWorkItemForUser,
  linkAssetToWorkForUser,
  listAssetsForUser,
  listOrganizationsForUser,
  listWorkItemsForUser,
  softDeleteWorkItemForUser,
  unlinkAssetFromWorkForUser,
  updateWorkItemForUser,
} from "./domain-db";

const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });
const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });

export const domainRouter = router({
  work: router({
    list: protectedProcedure.query(({ ctx }) => listWorkItemsForUser(ctx.user.id)),

    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const work = await getWorkItemForUser(ctx.user.id, input.id);
        if (!work) throw notFound("العمل غير موجود أو لا تملك صلاحية الوصول إليه");
        return work;
      }),

    create: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(2).max(255),
        type: z.enum(["report", "portfolio"]),
        ownerType: z.enum(["personal", "organization"]).default("personal"),
        organizationId: z.number().int().positive().optional(),
      }).superRefine((value, ctx) => {
        if (value.ownerType === "organization" && !value.organizationId) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["organizationId"], message: "اختر المدرسة المالكة للعمل" });
        }
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await createWorkItemForUser(ctx.user.id, input);
        } catch (error) {
          if (error instanceof Error && error.message.includes("access denied")) throw forbidden("لا تملك صلاحية إنشاء عمل لهذه المدرسة");
          throw error;
        }
      }),

    update: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        title: z.string().trim().min(2).max(255).optional(),
        status: z.enum(["draft", "in_review", "approved", "archived"]).optional(),
      }).refine(value => value.title !== undefined || value.status !== undefined, { message: "لا توجد تغييرات للحفظ" }))
      .mutation(async ({ ctx, input }) => {
        const { id, ...patch } = input;
        const updated = await updateWorkItemForUser(ctx.user.id, id, patch);
        if (!updated) throw forbidden("لا تملك صلاحية تعديل هذا العمل");
        return updated;
      }),

    createVersion: protectedProcedure
      .input(z.object({
        id: z.number().int().positive(),
        reason: z.string().trim().max(255).optional(),
        snapshot: z.record(z.string(), z.unknown()),
      }))
      .mutation(async ({ ctx, input }) => {
        const version = await createWorkVersionForUser(ctx.user.id, input.id, input.snapshot, input.reason);
        if (!version) throw forbidden("لا تملك صلاحية إنشاء نسخة لهذا العمل");
        return version;
      }),

    remove: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const removed = await softDeleteWorkItemForUser(ctx.user.id, input.id);
        if (!removed) throw forbidden("لا تملك صلاحية حذف هذا العمل");
        return { success: true } as const;
      }),
  }),

  asset: router({
    list: protectedProcedure.query(({ ctx }) => listAssetsForUser(ctx.user.id)),

    createReference: protectedProcedure
      .input(z.object({
        title: z.string().trim().min(2).max(255),
        kind: z.enum(["link", "text"]),
        externalUrl: z.string().url().max(2000).optional(),
        text: z.string().trim().max(10000).optional(),
        ownerType: z.enum(["personal", "organization"]).default("personal"),
        organizationId: z.number().int().positive().optional(),
      }).superRefine((value, ctx) => {
        if (value.kind === "link" && !value.externalUrl) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["externalUrl"], message: "أدخل رابط الشاهد" });
        if (value.kind === "text" && !value.text) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["text"], message: "أدخل نص الشاهد" });
        if (value.ownerType === "organization" && !value.organizationId) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["organizationId"], message: "اختر المدرسة المالكة للشاهد" });
      }))
      .mutation(async ({ ctx, input }) => {
        try {
          return await createAssetForUser(ctx.user.id, {
            title: input.title,
            kind: input.kind,
            ownerType: input.ownerType,
            organizationId: input.organizationId,
            externalUrl: input.externalUrl,
            metadata: input.kind === "text" ? { text: input.text } : undefined,
          });
        } catch (error) {
          if (error instanceof Error && error.message.includes("access denied")) throw forbidden("لا تملك صلاحية إضافة شاهد لهذه المدرسة");
          throw error;
        }
      }),

    linkToWork: protectedProcedure
      .input(z.object({
        workItemId: z.number().int().positive(),
        assetId: z.number().int().positive(),
        role: z.string().trim().min(1).max(64).default("evidence"),
        caption: z.string().trim().max(1000).optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const linked = await linkAssetToWorkForUser(ctx.user.id, input);
        if (!linked) throw forbidden("لا تملك صلاحية ربط هذا الشاهد بهذا العمل");
        return linked;
      }),

    unlinkFromWork: protectedProcedure
      .input(z.object({
        workItemId: z.number().int().positive(),
        assetId: z.number().int().positive(),
        role: z.string().trim().min(1).max(64).default("evidence"),
      }))
      .mutation(async ({ ctx, input }) => {
        const removed = await unlinkAssetFromWorkForUser(ctx.user.id, input);
        if (!removed) throw forbidden("لا تملك صلاحية إزالة هذا الربط");
        return { success: true } as const;
      }),
  }),

  organization: router({
    listMine: protectedProcedure.query(({ ctx }) => listOrganizationsForUser(ctx.user.id)),
  }),
});

export type DomainRouter = typeof domainRouter;
