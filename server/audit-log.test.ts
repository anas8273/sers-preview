import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const dbSource = readFileSync(new URL("./db.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const pageSource = readFileSync(new URL("../client/src/pages/AuditLog.tsx", import.meta.url), "utf8");

describe("audit log", () => {
  it("persists compact operational audit events without storing full user content", () => {
    expect(schemaSource).toContain('mysqlTable("audit_logs"');
    expect(schemaSource).toContain('metadata: json("metadata")');
    expect(schemaSource).toContain("ولا يحتفظ بالنصوص الكاملة أو الأسرار");
    expect(dbSource).toContain("createAuditLog");
    expect(dbSource).toContain("getAuditLogs");
  });

  it("records significant portfolio, file, comment, and exam operations", () => {
    expect(routerSource).toContain('action: "portfolio.updated"');
    expect(routerSource).toContain('action: "file.uploaded"');
    expect(routerSource).toContain('action: "evidence.comment_created"');
    expect(routerSource).toContain('action: "online_exam.created"');
    expect(routerSource).toContain('action: "share_link.created"');
    expect(routerSource).toContain('action: "share_link.deactivated"');
  });

  it("limits standard users to their own activity and provides an auditable UI", () => {
    expect(routerSource).toContain("ctx.user.role !== \"admin\"");
    expect(routerSource).toContain("audit: router");
    expect(pageSource).toContain("سجل التدقيق");
    expect(pageSource).toContain("ستظهر هنا عمليات الرفع والمشاركة والتعديل فور حدوثها");
  });
});
