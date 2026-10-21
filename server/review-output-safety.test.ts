import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "drizzle/domain-core.ts"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/domain-router.ts"), "utf8");
const domainService = readFileSync(resolve(process.cwd(), "server/domain-db.ts"), "utf8");
const reviewService = readFileSync(resolve(process.cwd(), "server/review-output-db.ts"), "utf8");

describe("review/output domain invariants", () => {
  it("binds both reviews and outputs to immutable work versions", () => {
    expect(schema).toContain('workVersionId: int("workVersionId")');
    expect(schema).toContain('references(() => workVersions.id');
    expect(reviewService).toContain("getWorkVersionForUser");
    expect(reviewService).not.toMatch(/latestVersion|currentVersionId/);
  });

  it("keeps review and output procedures protected", () => {
    expect(router).toContain("review: router({");
    expect(router).toContain("output: router({");
    const reviewSection = router.split("review: router({")[1]?.split("output: router({")[0] ?? "";
    const outputSection = router.split("output: router({")[1]?.split("organization: router({")[0] ?? "";
    expect(reviewSection).not.toContain("publicProcedure");
    expect(outputSection).not.toContain("publicProcedure");
  });

  it("does not expose approval through the generic work update mutation", () => {
    const updateSection = router.split("update: protectedProcedure")[1]?.split("createVersion: protectedProcedure")[0] ?? "";
    expect(updateSection).not.toContain('z.enum(["draft", "in_review", "approved", "archived"])');
    expect(updateSection).not.toContain("status:");
    expect(domainService).toContain("patch: { title?: string }");
  });

  it("uses compare-and-swap retries for unique work version numbers", () => {
    expect(domainService).toContain("eq(workItems.currentVersionNumber, expectedVersion)");
    expect(domainService).toContain("getAffectedRows(updated) !== 1");
    expect(domainService).toContain("WorkVersionConflictError");
  });

  it("prevents implicit evidence sharing across ownership scopes", () => {
    expect(domainService).toContain("sameOwnershipScope(work, asset)");
  });

  it("stores only password hashes for protected outputs", () => {
    expect(schema).toContain('passwordHash: varchar("passwordHash"');
    expect(router).toContain("hashProtectedOutputPassword");
    expect(reviewService).toContain("passwordHash: input.passwordHash ?? null");
  });

  it("rechecks reviewer capability and decides pending reviews conditionally", () => {
    expect(reviewService).toContain("!canReviewOrganization(membership.role)");
    expect(reviewService).toContain('eq(reviews.status, "pending")');
    expect(reviewService).toContain("getAffectedRows(updatedReview) !== 1");
  });

  it("does not let an older reviewed version change the current work state", () => {
    expect(reviewService).toContain("row.version.versionNumber === row.work.currentVersionNumber");
  });

  it("requires exact-version approval before creating shared outputs", () => {
    expect(reviewService).toContain('visibility !== "private"');
    expect(reviewService).toContain('eq(reviews.workVersionId, input.workVersionId)');
    expect(reviewService).toContain('eq(reviews.status, "approved")');
    expect(reviewService).toContain("Shared outputs require an approved review for this exact version");
  });
});
