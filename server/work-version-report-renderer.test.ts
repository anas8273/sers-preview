import { describe, expect, it } from "vitest";
import { renderReportWorkVersionHtml } from "./work-version-report-renderer";

const snapshot = {
  schemaVersion: 1,
  kind: "report",
  work: {
    id: 17,
    title: "تقرير <تجريبي>",
    ownerType: "personal",
    ownerUserId: 1,
    ownerOrganizationId: null,
  },
  reportDraft: {
    templateId: "program-report",
    themeId: "formal",
    fontFamily: "Cairo",
    fields: {
      summary: "ملخص <script>alert('x')</script>",
      objectives: "الهدف الأول\nالهدف الثاني",
      empty: "",
    },
    evidenceAssetIds: [10],
    updatedAt: "2026-10-19T20:00:00.000Z",
  },
  assets: [
    { id: 10, title: "شاهد <حقيقي>", kind: "link", role: "evidence", caption: "وصف موثق" },
    { id: 11, title: "شاهد غير مستخدم", kind: "text", role: "evidence" },
  ],
  capturedAt: "2026-10-19T20:00:00.000Z",
};

describe("immutable report version renderer", () => {
  it("renders the same HTML for the same immutable snapshot", () => {
    const first = renderReportWorkVersionHtml(snapshot, 3);
    const second = renderReportWorkVersionHtml(snapshot, 3);
    expect(first).toBe(second);
    expect(first).toContain("نسخة 3");
    expect(first).toContain("تقرير برنامج");
  });

  it("escapes user-controlled HTML instead of executing active content", () => {
    const html = renderReportWorkVersionHtml(snapshot, 3);
    expect(html).toContain("تقرير &lt;تجريبي&gt;");
    expect(html).toContain("&lt;script&gt;alert(&#039;x&#039;)&lt;/script&gt;");
    expect(html).not.toContain("<script>alert");
  });

  it("includes only evidence selected by the frozen report draft", () => {
    const html = renderReportWorkVersionHtml(snapshot, 3);
    expect(html).toContain("شاهد &lt;حقيقي&gt;");
    expect(html).toContain("وصف موثق");
    expect(html).not.toContain("شاهد غير مستخدم");
  });

  it("rejects snapshots that are not authoritative report versions", () => {
    expect(() => renderReportWorkVersionHtml({ kind: "portfolio" }, 1)).toThrow(/not a report snapshot/i);
    expect(() => renderReportWorkVersionHtml(undefined, 1)).toThrow(/snapshot is missing/i);
  });
});
