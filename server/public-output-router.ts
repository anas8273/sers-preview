import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import { createPublicOutputRateLimiter } from "./public-output-rate-limit";
import {
  PublicOutputNotFoundError,
  PublicOutputPasswordInvalidError,
  PublicOutputPasswordRequiredError,
  resolvePublicOutput,
} from "./public-output-service";

const rateLimiter = createPublicOutputRateLimiter();

function assertRateLimit(ip: string | undefined, token: string) {
  if (!rateLimiter.allow(ip, token)) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "تم تجاوز عدد المحاولات المسموح. حاول لاحقًا.",
    });
  }
}

export const publicOutputRouter = router({
  resolve: publicProcedure
    .input(z.object({
      token: z.string().trim().min(20).max(255),
      password: z.string().min(1).max(128).optional(),
    }))
    .mutation(async ({ ctx, input }) => {
      assertRateLimit(ctx.req.ip, input.token);
      try {
        return await resolvePublicOutput(input.token, input.password);
      } catch (error) {
        if (error instanceof PublicOutputPasswordRequiredError) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "هذا المخرج محمي بكلمة مرور.",
            cause: { reason: "PASSWORD_REQUIRED" },
          });
        }
        if (error instanceof PublicOutputPasswordInvalidError) {
          throw new TRPCError({
            code: "UNAUTHORIZED",
            message: "كلمة المرور غير صحيحة.",
            cause: { reason: "PASSWORD_INVALID" },
          });
        }
        if (error instanceof PublicOutputNotFoundError) {
          throw new TRPCError({
            code: "NOT_FOUND",
            message: "المخرج غير متاح أو انتهت صلاحيته.",
          });
        }
        throw error;
      }
    }),
});

export type PublicOutputRouter = typeof publicOutputRouter;
