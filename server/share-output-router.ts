import { nanoid } from "nanoid";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { protectedProcedure, router } from "./_core/trpc";
import { hashProtectedOutputPassword } from "./output-password";
import { createOutputForUser, OutputValidationError } from "./review-output-db";

const forbidden = (message: string) => new TRPCError({ code: "FORBIDDEN", message });
const badRequest = (message: string) => new TRPCError({ code: "BAD_REQUEST", message });

export const shareOutputRouter = router({
  create: protectedProcedure
    .input(z.object({
      workVersionId: z.number().int().positive(),
      type: z.enum(["link", "qr"]),
      visibility: z.enum(["public", "protected"]),
      password: z.string().min(6).max(128).optional(),
      expiresAt: z.coerce.date().optional(),
    }).superRefine((value, ctx) => {
      if (value.visibility === "protected" && !value.password) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["password"], message: "أدخل كلمة مرور للمخرج المحمي" });
      }
      if (value.expiresAt && value.expiresAt.getTime() <= Date.now()) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["expiresAt"], message: "يجب أن يكون تاريخ الانتهاء في المستقبل" });
      }
    }))
    .mutation(async ({ ctx, input }) => {
      try {
        const output = await createOutputForUser(ctx.user.id, {
          workVersionId: input.workVersionId,
          type: input.type,
          visibility: input.visibility,
          token: nanoid(32),
          passwordHash: input.visibility === "protected" && input.password
            ? hashProtectedOutputPassword(input.password)
            : undefined,
          expiresAt: input.expiresAt,
        });
        if (!output) throw forbidden("لا تملك صلاحية مشاركة هذه النسخة");
        return output;
      } catch (error) {
        if (error instanceof OutputValidationError) throw badRequest(error.message);
        throw error;
      }
    }),
});

export type ShareOutputRouter = typeof shareOutputRouter;
