import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const schema = readFileSync(resolve(process.cwd(), "drizzle/domain-core.ts"), "utf8");
const router = readFileSync(resolve(process.cwd(), "server/domain-router.ts"), "utf8");
const service = readFileSync(resolve(process.cwd(), "server/review-output-db.ts"), "utf8");

describe("review/output domain invariants", () => {
  it("binds both reviews and outputs to immutable work versions", () => {
    expect(schema).toContain('workVersionId: int("workVersionId")');
    expect(schema).toContain('references(() => workVersions.id');
    expect(service).toContain("getWorkVersionForUser");
    expect(service).not.toMatch(/latestVersion|currentVersionId/);
  });

  it("keeps review and output procedures protected", () => {
    expect(router).toContain("review: router({");
    expect(router).toContain("output: router({");
    const reviewSection = router.split("review: router({")[1]?.split("output: router({")[0] ?? "";
    const outputSection = router.split("output: router({")[1]?.split("organization: router({")[0] ?? "";
    expect(reviewSection).not.toContain("publicProcedure");
    expect(outputSection).not.toContain("publicProcedure");
  });

  it("stores only password hashes for protected outputs", () => {
    expect(schema).toContain('passwordHash: varchar("passwordHash"');
    expect(router).toContain("hashOutputPassword");
    expect(service).toContain("passwordHash: input.passwordHash ?? null");
  });

  it("requires the assigned reviewer for review decisions", () => {
    expect(service).toContain("eq(reviews.reviewerUserId, userId)");
    expect(service).toContain('row.review.status !== "pending"');
  });
});
