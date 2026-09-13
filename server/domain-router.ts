import { createHash } from "node:crypto";
import { nanoid } from "nanoid";
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
import {
  addReviewCommentForUser,
  createOutputForUser,
  createReviewForUser,
  decideReviewForUser,
  getReviewForUser,
  listOutputsForWorkForUser,
  listReviewsForUser,
  revokeOutputForUser,
} from "./review-output-db";

const notFound = (message: string) => new TRPCError({ code: "NOT_FOUND", message });
const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });
const hashOutputPassword = (value: string) => createHash("sha256").update(value, "utf8").digest("hex");

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
      .input(z.object({ workItemId: z.number().int().positive(), assetId: z.number().int().positive(), role: z.string().trim().min(1).max(64).default("evidence"), caption: z.string().trim().max(1000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const linked = await linkAssetToWorkForUser(ctx.user.id, input);
        if (!linked) throw forbidden("لا تملك صلاحية ربط هذا الشاهد بهذا العمل");
        return linked;
      }),

    unlinkFromWork: protectedProcedure
      .input(z.object({ workItemId: z.number().int().positive(), assetId: z.number().int().positive(), role: z.string().trim().min(1).max(64).default("evidence") }))
      .mutation(async ({ ctx, input }) => {
        const removed = await unlinkAssetFromWorkForUser(ctx.user.id, input);
        if (!removed) throw forbidden("لا تملك صلاحية إزالة هذا الربط");
        return { success: true } as const;
      }),
  }),

  review: router({
    list: protectedProcedure.query(({ ctx }) => listReviewsForUser(ctx.user.id)),
    get: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const review = await getReviewForUser(ctx.user.id, input.id);
        if (!review) throw notFound("المراجعة غير موجودة أو لا تملك صلاحية عرضها");
        return review;
      }),
    request: protectedProcedure
      .input(z.object({ workVersionId: z.number().int().positive(), reviewerUserId: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        try {
          const review = await createReviewForUser(ctx.user.id, input.workVersionId, input.reviewerUserId);
          if (!review) throw forbidden("لا تملك صلاحية إرسال هذه النسخة للمراجعة");
          return review;
        } catch (error) {
          if (error instanceof Error && error.message.includes("organization")) throw badRequest("يجب أن يكون العمل مملوكًا لمدرسة وأن يكون المراجع عضوًا نشطًا فيها");
          if (error instanceof Error && error.message.includes("another user")) throw badRequest("اختر مراجعًا آخر");
          throw error;
        }
      }),
    comment: protectedProcedure
      .input(z.object({ reviewId: z.number().int().positive(), content: z.string().trim().min(1).max(4000), anchor: z.record(z.string(), z.unknown()).optional() }))
      .mutation(async ({ ctx, input }) => {
        const comment = await addReviewCommentForUser(ctx.user.id, input.reviewId, input.content, input.anchor);
        if (!comment) throw forbidden("لا تملك صلاحية التعليق على هذه المراجعة");
        return comment;
      }),
    decide: protectedProcedure
      .input(z.object({ reviewId: z.number().int().positive(), decision: z.enum(["approved", "changes_requested", "rejected"]), note: z.string().trim().max(4000).optional() }))
      .mutation(async ({ ctx, input }) => {
        const decided = await decideReviewForUser(ctx.user.id, input.reviewId, input.decision, input.note);
        if (!decided) throw forbidden("أنت لست المراجع المكلّف بهذه النسخة");
        return decided;
      }),
  }),

  output: router({
    listForWork: protectedProcedure
      .input(z.object({ workItemId: z.number().int().positive() }))
      .query(async ({ ctx, input }) => {
        const list = await listOutputsForWorkForUser(ctx.user.id, input.workItemId);
        if (!list) throw forbidden("لا تملك صلاحية عرض مخرجات هذا العمل");
        return list;
      }),
    create: protectedProcedure
      .input(z.object({
        workVersionId: z.number().int().positive(),
        type: z.enum(["pdf", "link", "qr"]),
        visibility: z.enum(["private", "protected", "public"]).default("private"),
        password: z.string().min(6).max(128).optional(),
        expiresAt: z.coerce.date().optional(),
      }).superRefine((value, ctx) => {
        if (value.visibility === "protected" && !value.password) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "أدخل رمز حماية للمخرج" });
        if (value.type === "pdf" && value.visibility !== "private") ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["visibility"], message: "مخرج PDF في هذه المرحلة خاص ويحتاج مسار تخزين آمن قبل المشاركة" });
      }))
      .mutation(async ({ ctx, input }) => {
        const token = input.type === "link" || input.type === "qr" ? nanoid(32) : undefined;
        const output = await createOutputForUser(ctx.user.id, {
          workVersionId: input.workVersionId,
          type: input.type,
          visibility: input.visibility,
          token,
          passwordHash: input.password ? hashOutputPassword(input.password) : undefined,
          expiresAt: input.expiresAt,
        });
        if (!output) throw forbidden("لا تملك صلاحية إنشاء مخرج لهذه النسخة");
        return output;
      }),
    revoke: protectedProcedure
      .input(z.object({ id: z.number().int().positive() }))
      .mutation(async ({ ctx, input }) => {
        const revoked = await revokeOutputForUser(ctx.user.id, input.id);
        if (!revoked) throw forbidden("لا تملك صلاحية إلغاء هذا المخرج");
        return { success: true } as const;
      }),
  }),

  organization: router({
    listMine: protectedProcedure.query(({ ctx }) => listOrganizationsForUser(ctx.user.id)),
  }),
});

export type DomainRouter = typeof domainRouter;
