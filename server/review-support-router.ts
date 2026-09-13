import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { workVersions } from "../drizzle/domain-core";
import { protectedProcedure, router } from "./_core/trpc";
import { assertWorkAccess } from "./domain-db";
import { getDb } from "./db";
import { listEligibleReviewersForUser } from "./review-output-db";

export const reviewSupportRouter = router({
  reviewers: protectedProcedure
    .input(z.object({ organizationId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const reviewers = await listEligibleReviewersForUser(ctx.user.id, input.organizationId);
      if (!reviewers) return [];
      return reviewers.filter(reviewer => reviewer.userId !== ctx.user.id);
    }),

  versions: protectedProcedure
    .input(z.object({ workItemId: z.number().int().positive() }))
    .query(async ({ ctx, input }) => {
      const work = await assertWorkAccess(ctx.user.id, input.workItemId, "read");
      if (!work) return [];
      const db = await getDb();
      if (!db) return [];
      return db
        .select({ id: workVersions.id, versionNumber: workVersions.versionNumber, reason: workVersions.reason, createdAt: workVersions.createdAt })
        .from(workVersions)
        .where(eq(workVersions.workItemId, input.workItemId))
        .orderBy(desc(workVersions.versionNumber));
    }),
});

export type ReviewSupportRouter = typeof reviewSupportRouter;
