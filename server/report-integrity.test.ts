import { describe, expect, it } from "vitest";
import {
  normalizeReportDraft,
  projectReportDocument,
  REPORT_SCHEMA_VERSION,
  REPORT_TEMPLATE_DEFINITIONS,
} from "../shared/report-projection";
import { projectReportSnapshot } from "./public-output-service";
import { renderReportWorkVersionDocx } from "./work-version-docx-renderer";
import { renderReportWorkVersionHtml } from "./work-version-report-renderer";
import { sanitizeEvidenceImage } from "./work-version-inline-image";
import { PNG } from "pngjs";

function tinyPng() {
  const png = new PNG({ width: 3, height: 2 });
  png.data.fill(220);
  return PNG.sync.write(png);
}

function snapshot() {
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    kind: "report",
    work: { title: "تقرير parity اصطناعي" },
    reportDraft: {
      schemaVersion: REPORT_SCHEMA_VERSION,
      templateId: "workshop-report",
      templateVersionId: "workshop-report@1",
      themeId: "formal",
      fontFamily: "Arial",
      fields: {
        summary: "فقرة عربية طويلة قابلة للعرض.",
        workshopDate: "2026-11-18",
        participantsCount: 24,
        materials: ["قياس الأثر", "حفظ الشاهد"],
      },
      evidenceAssetIds: [7],
      fieldDefinitions: REPORT_TEMPLATE_DEFINITIONS["workshop-report"].fields,
      updatedAt: "2026-11-18T00:00:00.000Z",
    },
    assets: [{
      id: 7,
      title: "صورة مجمدة",
      kind: "file",
      caption: "معاينة ثابتة",
      frozen: {
        referenceVersion: "11111111-1111-4111-8111-111111111111",
        digest: "a".repeat(64),
        bytes: tinyPng().length,
        contentType: "image/png" as const,
        sourceAssetId: 7,
        sourceUploadIntentId: "11111111-1111-4111-8111-111111111111",
        preview: { mimeType: "image/png" as const, dataBase64: tinyPng().toString("base64"), width: 3, height: 2 },
      },
      storageKey: "private/should-never-appear",
      externalUrl: "https://private.invalid/raw?sig=secret",
    }],
    capturedAt: "2026-11-18T00:00:00.000Z",
  };
}

describe("report-integrity vertical slice", () => {
  it("normalizes typed fields and rejects unknown fields instead of dropping them", () => {
    const normalized = normalizeReportDraft({
      schemaVersion: 1,
      templateId: "workshop-report",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: { materials: ["دليل"], participantsCount: 12, workshopDate: "2026-11-18" },
      evidenceAssetIds: [],
    });
    expect(normalized.schemaVersion).toBe(REPORT_SCHEMA_VERSION);
    expect(normalized.migratedFromSchemaVersion).toBe(1);
    expect(normalized.fields.materials).toEqual(["دليل"]);
    expect(() => normalizeReportDraft({ templateId: "program-report", fields: { silentlyLost: "x" } })).toThrow(/Unknown report field/);
    expect(() => normalizeReportDraft({ schemaVersion: REPORT_SCHEMA_VERSION, templateId: "workshop-report", fields: {}, fieldDefinitions: [] })).toThrow(/Schema v2 requires/);
    expect(() => normalizeReportDraft({ schemaVersion: REPORT_SCHEMA_VERSION, templateId: "workshop-report", fields: {}, fieldDefinitions: [{ key: "bad key", label: "x", type: "text" }] })).toThrow(/invalid frozen field/);
  });

  it("uses one projection for all known fields and selected frozen evidence", () => {
    const value = snapshot();
    const model = projectReportDocument(value);
    expect(model.fields.map(field => field.key)).toEqual(["summary", "workshopDate", "participantsCount", "materials"]);
    expect(model.evidence).toHaveLength(1);
    expect(model.evidence[0].frozen?.referenceVersion).toMatch(/^1111/);
  });

  it("uses the same typed projection for public output without private metadata", () => {
    const report = projectReportSnapshot(snapshot());
    expect(report?.fields).toEqual(expect.arrayContaining([
      expect.objectContaining({ key: "workshopDate", type: "date", value: "2026-11-18" }),
      expect.objectContaining({ key: "participantsCount", type: "number", value: 24 }),
      expect.objectContaining({ key: "materials", type: "list", value: ["قياس الأثر", "حفظ الشاهد"] }),
    ]));
    const serialized = JSON.stringify(report);
    expect(serialized).not.toContain("storageKey");
    expect(serialized).not.toContain("externalUrl");
    expect(serialized).not.toContain("private.invalid");
  });

  it("keeps HTML and editable DOCX on the same field/evidence projection", async () => {
    const value = snapshot();
    const html = renderReportWorkVersionHtml(value, 4);
    const docx = await renderReportWorkVersionDocx(value, 4);
    expect(html).toContain("تاريخ الورشة");
    expect(html).toContain("2026-11-18");
    expect(html).toContain("قياس الأثر");
    expect(html).not.toContain("private/should-never-appear");
    expect(docx.length).toBeGreaterThan(1000);
  });

  it("sanitizes a bounded PNG into a metadata-free preview and rejects bombs", () => {
    const bytes = tinyPng();
    const result = sanitizeEvidenceImage(bytes, "image/png");
    expect(result.width).toBe(3);
    expect(result.height).toBe(2);
    expect(result.bytes.length).toBeGreaterThan(0);
    expect(() => sanitizeEvidenceImage(Buffer.alloc(6 * 1024 * 1024 + 1), "image/png")).toThrow(/preview limit/);
  });
});
