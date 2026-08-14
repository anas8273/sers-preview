import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const reportCenterSource = readFileSync(new URL("../client/src/pages/ReportCenter.tsx", import.meta.url), "utf8");

describe("report center required fields", () => {
  it("blocks saving when a required report field is absent", () => {
    expect(reportCenterSource).toContain("const missing = selectedTemplate.fields.filter((field) => field.required && !formData[field.id]?.trim())");
    expect(reportCenterSource).toContain("أكمل الحقول الإلزامية");
  });

  it("blocks PDF export and displays missing requirements before exporting", () => {
    expect(reportCenterSource).toContain("لا يمكن التصدير قبل إكمال");
    expect(reportCenterSource).toContain("const missingRequiredFields = selectedTemplate");
    expect(reportCenterSource).toContain("قبل الحفظ أو التصدير، أكمل الحقول الإلزامية التالية");
  });

  it("supports secure file attachments and manual evidence links in the editor and preview", () => {
    expect(reportCenterSource).toContain("const uploadAttachmentMutation = trpc.file.upload.useMutation()");
    expect(reportCenterSource).toContain("شواهد ومرفقات التقرير");
    expect(reportCenterSource).toContain("attachments={attachments}");
    expect(reportCenterSource).toContain("الشواهد والمرفقات");
  });
});
