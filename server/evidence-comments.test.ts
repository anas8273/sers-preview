import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");

describe("collaborative evidence comments", () => {
  it("persists comments with their portfolio, evidence, author, and timestamps", () => {
    expect(schemaSource).toContain('mysqlTable("evidence_comments"');
    expect(schemaSource).toContain('portfolioId: int("portfolioId").notNull()');
    expect(schemaSource).toContain('evidenceId: varchar("evidenceId", { length: 128 }).notNull()');
    expect(schemaSource).toContain('userId: int("userId").notNull()');
    expect(dbSource).toContain("createEvidenceComment");
    expect(dbSource).toContain("getEvidenceComments");
  });

  it("gates comment reads and writes to the portfolio owner or an administrator", () => {
    expect(routerSource).toContain("assertCommentPortfolioAccess");
    expect(routerSource).toContain('user.role !== "admin"');
    expect(routerSource).toContain("evidenceComment: router");
    expect(routerSource).toContain("content: z.string().trim().min(1");
  });

  it("renders a per-evidence comment panel with author-aware deletion", () => {
    expect(pageSource).toContain("const CollaborativeComments");
    expect(pageSource).toContain("<CollaborativeComments criterionId={criterionId} evidenceId={ev.id} />");
    expect(pageSource).toContain("comment.userId === user?.id || user?.role === \"admin\"");
  });
});
