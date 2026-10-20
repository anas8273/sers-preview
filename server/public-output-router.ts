import { createHash } from "node:crypto";
import { TRPCError } from "@trpc/server";
import { z } from "zod";
import { publicProcedure, router } from "./_core/trpc";
import {
  PublicOutputNotFoundError,
  PublicOutputPasswordInvalidError,
  PublicOutputPasswordRequiredError,
  resolvePublicOutput,
} from "./public-output-service";

type RateBucket = { count: number; resetAt: number };
const buckets = new Map<string, RateBucket>();
const WINDOW_MS = 5 * 60_000;
const MAX_ATTEMPTS = 30;

function requestIdentity(ip: string | undefined, token: string) {
  const tokenDigest = createHash("sha256").update(token, "utf8").digest("hex").slice(0, 20);
  return `${ip || "unknown"}:${tokenDigest}`;
}

function assertRateLimit(ip: string | undefined, token: string) {
  const now = Date.now();
  const key = requestIdentity(ip, token);
  const existing = buckets.get(key);
  const bucket = !existing || existing.resetAt <= now
    ? { count: 0, resetAt: now + WINDOW_MS }
    : existing;
  bucket.count += 1;
  buckets.set(key, bucket);

  if (bucket.count > MAX_ATTEMPTS) {
    throw new TRPCError({
      code: "TOO_MANY_REQUESTS",
      message: "تم تجاوز عدد المحاولات المسموح. حاول لاحقًا.",
    });
  }

  if (buckets.size > 10_000) {
    for (const [bucketKey, value] of Array.from(buckets.entries())) {
      if (value.resetAt <= now) buckets.delete(bucketKey);
    }
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
