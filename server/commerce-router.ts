import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import {
  executeSandboxPurchaseForUser,
  isCommerceSandboxEnabled,
  listActiveProducts,
  listUserEntitlements,
} from "./commerce-sandbox";

export const commerceRouter = router({
  status: protectedProcedure.query(() => ({
    sandboxEnabled: isCommerceSandboxEnabled(),
    mode: isCommerceSandboxEnabled() ? ("sandbox" as const) : ("display_only" as const),
  })),

  listProducts: protectedProcedure.query(() => listActiveProducts()),

  myEntitlements: protectedProcedure.query(({ ctx }) => listUserEntitlements(ctx.user.id)),

  sandboxPurchase: protectedProcedure
    .input(z.object({
      productId: z.number().int().positive(),
      idempotencyKey: z.string().trim().min(8).max(128),
    }).strict())
    .mutation(async ({ ctx, input }) => {
      if (!isCommerceSandboxEnabled()) {
        throw new TRPCError({
          code: "PRECONDITION_FAILED",
          message: "المتجر في وضع العرض فقط؛ الشراء التجريبي معطل في هذه البيئة.",
        });
      }
      try {
        const result = await executeSandboxPurchaseForUser(ctx.user.id, input);
        if (!result) throw new TRPCError({ code: "NOT_FOUND", message: "المنتج غير موجود أو غير نشط" });
        return result;
      } catch (error) {
        if (error instanceof Error && error.message === "IDEMPOTENCY_KEY_CONFLICT") {
          throw new TRPCError({ code: "CONFLICT", message: "مفتاح التكرار مستخدم لطلب آخر" });
        }
        throw error;
      }
    }),
});

export type CommerceRouter = typeof commerceRouter;
