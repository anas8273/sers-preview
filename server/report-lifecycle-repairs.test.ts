import { describe, expect, it } from "vitest";
import JSZip from "jszip";
import { ReportDraftSession } from "../client/src/lib/report-draft-session";
import { renderReportWorkVersionDocx } from "./work-version-docx-renderer";
import { renderReportWorkVersionHtml } from "./work-version-report-renderer";

const frozenFields = [
  { key: "summary", label: "عنوان تاريخي", type: "textarea" as const, rows: 6 },
  { key: "retiredField", label: "حقل لم يعد في registry", type: "text" as const, maxLength: 500 },
];

function frozenSnapshot() {
  return {
    kind: "report",
    work: { title: "تقرير schema v2" },
    reportDraft: {
      schemaVersion: 2,
      templateId: "retired-report",
      templateVersionId: "retired-report@7",
      themeId: "classic",
      fontFamily: "Noto Kufi Arabic",
      fieldDefinitions: frozenFields,
      fields: { summary: "نص ثابت", retiredField: "لا يجوز إسقاطي" },
      evidenceAssetIds: [],
      updatedAt: "2026-11-19T00:00:00.000Z",
    },
    assets: [],
    capturedAt: "2026-11-19T00:00:00.000Z",
  };
}

describe("report lifecycle repairs", () => {
  it("keeps frozen v2 descriptors and values through a reload/edit/save session", async () => {
    const initial = {
      schemaVersion: 2,
      templateId: "custom",
      templateVersionId: "custom@0",
      themeId: "classic",
      fontFamily: "Cairo",
      fieldDefinitions: frozenFields,
      fields: { summary: "قبل", retiredField: "لا تسقط" },
      evidenceAssetIds: [],
    };
    const session = new ReportDraftSession(7, initial);
    session.edit({ fields: { ...session.content.fields, summary: "بعد تعديل مستقل" } });
    let received: typeof initial | undefined;
    await session.flush(async content => {
      received = content as typeof initial;
      return { revision: 8, updatedAt: "2026-11-19T00:00:01.000Z" };
    }, () => undefined);
    expect(received?.schemaVersion).toBe(2);
    expect(received?.templateVersionId).toBe("custom@0");
    expect(received?.fieldDefinitions).toEqual(frozenFields);
    expect(received?.fields.retiredField).toBe("لا تسقط");
  });

  it("uses an allowlisted Noto Kufi font instead of silently replacing it", async () => {
    const snapshot = frozenSnapshot();
    const html = renderReportWorkVersionHtml(snapshot, 1);
    expect(html).toContain("@font-face { font-family: 'SERS Noto Kufi Arabic'");
    expect(html).toContain(".work-version-document { font-family: 'SERS Noto Kufi Arabic'");
    const docx = await renderReportWorkVersionDocx(snapshot, 1);
    const zip = await JSZip.loadAsync(docx);
    expect(await zip.file("word/document.xml")!.async("string")).toContain("Noto Kufi Arabic");
  });

  it("does not expose source URLs or private storage metadata in report output", async () => {
    const snapshot = { ...frozenSnapshot(), assets: [{ id: 1, title: "شاهد", kind: "file", externalUrl: "https://private.invalid/raw", storageKey: "private/key" }] };
    const html = renderReportWorkVersionHtml(snapshot, 1);
    expect(html).not.toContain("private.invalid");
    expect(html).not.toContain("private/key");
    const docx = await renderReportWorkVersionDocx(snapshot, 1);
    expect(docx.toString("base64")).not.toContain(Buffer.from("private/key").toString("base64"));
  });
});
