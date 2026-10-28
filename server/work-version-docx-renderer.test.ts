import { describe, expect, it, vi } from "vitest";
import JSZip from "jszip";
import QRCode from "qrcode";
import { renderReportWorkVersionDocx, ReportDocxValidationError } from "./work-version-docx-renderer";
import { sanitizeInlinePng } from "./work-version-inline-image";

const snapshot = () => ({ kind: "report", academicContext: { yearLabel: "١٤٤٨ هـ", termLabel: "الفصل الدراسي الأول" }, capturedAt: "2026-10-28T05:00:00Z", work: { title: "تقرير تنمية مهارات القراءة" }, reportDraft: {
  fontFamily: "Arial", fields: { summary: "النص العربي ثابت وقابل للتحرير في Word.", objectives: "هدف أول\nهدف ثان" }, evidenceAssetIds: [1],
}, assets: [{ id: 1, title: "شاهد مختار", caption: "نتائج النشاط", storageKey: "private/secret-object", externalUrl: "https://secret.example/original" }, { id: 2, title: "شاهد غير مختار" }] });
async function unpack(buffer: Buffer) {
  const zip = await JSZip.loadAsync(buffer);
  return { zip, document: await zip.file("word/document.xml")!.async("string") };
}

describe("editable immutable WorkVersion DOCX", () => {
  it("uses native Arabic paragraphs, RTL evidence tables, headers, footers and page breaks", async () => {
    const { zip, document } = await unpack(await renderReportWorkVersionDocx(snapshot(), 3));
    expect(document.replace(/<[^>]+>/g, "")).toContain("النص العربي ثابت وقابل للتحرير في Word.");
    expect(document).toContain("العام الدراسي ١٤٤٨ هـ");
    expect(document).toContain("الفصل الدراسي الأول");
    expect(document).toContain('<w:jc w:val="start"/>');
    expect(document).toContain("<w:bidi/>");
    expect(document).toContain("<w:rtl/>");
    expect(document).toContain("<w:bidiVisual/>");
    expect(document).toContain("<w:tblHeader/>");
    expect(document).toContain("<w:pageBreakBefore/>");
    expect(document).toContain("شاهد مختار");
    expect(document).not.toContain("شاهد غير مختار");
    expect(document).not.toContain("private/secret-object");
    expect(document).not.toContain("secret.example");
    expect(document).not.toContain("w:altChunk");
    expect(document).not.toContain("w:drawing");
    expect(await zip.file("word/header1.xml")!.async("string")).toContain("تقرير تنمية مهارات القراءة");
    expect((await zip.file("word/footer1.xml")!.async("string")).replace(/<[^>]+>/g, "")).toContain("نسخة 3");
    expect(await zip.file("word/footer1.xml")!.async("string")).toContain("PAGE");
  });

  it("is byte-stable for the same frozen snapshot and version", async () => {
    const value = snapshot();
    const before = JSON.stringify(value);
    const first = await renderReportWorkVersionDocx(value, 1);
    await new Promise(resolve => setTimeout(resolve, 5));
    expect(await renderReportWorkVersionDocx(value, 1)).toEqual(first);
    expect(JSON.stringify(value)).toBe(before);
    expect(await renderReportWorkVersionDocx(value, 2)).not.toEqual(first);
  });

  it("treats markup and source fields as plain text without making network requests", async () => {
    const fetch = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("No network allowed"));
    try {
      const value = snapshot();
      value.reportDraft.fields.summary = '<script>alert("x")</script> & <img src="http://127.0.0.1/private">';
      const { zip, document } = await unpack(await renderReportWorkVersionDocx(value, 1));
      expect(document.replace(/<[^>]+>/g, "")).toContain("&lt;script&gt;");
      expect(document).not.toContain("<script>");
      expect(await zip.file("word/_rels/document.xml.rels")!.async("string")).not.toContain('TargetMode="External"');
      expect(fetch).not.toHaveBeenCalled();
    } finally { fetch.mockRestore(); }
  });

  it("embeds only bounded sanitized selected PNG previews and an explicit share QR", async () => {
    const preview = await QRCode.toBuffer("synthetic-preview", { type: "png", width: 128 });
    const value = { ...snapshot(), shareReference: { url: "https://demo.example/output/abcdefghijklmnopqrstuvwx", label: "رابط التقرير" },
      assets: [{ id: 1, title: "صورة ثابتة", preview: { mimeType: "image/png", dataBase64: preview.toString("base64") } },
        { id: 2, title: "غير مختارة", preview: { mimeType: "image/png", dataBase64: "not-valid" } }],
    };
    const { zip, document } = await unpack(await renderReportWorkVersionDocx(value, 1));
    expect(document.match(/<w:drawing>/g)).toHaveLength(2);
    expect(Object.keys(zip.files).filter(path => path.startsWith("word/media/") && path.endsWith(".png"))).toHaveLength(2);
    expect(document).toContain("رابط التقرير");
    expect(await renderReportWorkVersionDocx(value, 1)).toEqual(await renderReportWorkVersionDocx(value, 1));
  });

  it.each(["file:///etc/passwd", "http://localhost/output/abcdefghijklmnopqrst", "https://demo.example/private/source", "https://demo.example/output/abcdefghijklmnopqrst?password=secret"])("rejects an invalid snapshotted share reference %s", async url => {
    await expect(renderReportWorkVersionDocx({ ...snapshot(), shareReference: { url } }, 1)).rejects.toBeInstanceOf(ReportDocxValidationError);
  });

  it("rejects oversize text and malformed/bomb PNG previews without silent truncation", async () => {
    const value = snapshot(); value.reportDraft.fields.summary = "x".repeat(40_001);
    await expect(renderReportWorkVersionDocx(value, 1)).rejects.toBeInstanceOf(ReportDocxValidationError);
    expect(() => sanitizeInlinePng(Buffer.from("not a PNG").toString("base64"))).toThrow();
    const large = await QRCode.toBuffer("oversize preview", { type: "png", width: 2000 });
    expect(() => sanitizeInlinePng(large.toString("base64"))).toThrow(/dimensions/);
    const valid = await QRCode.toBuffer("CRC", { type: "png", width: 128 });
    valid[valid.length - 1] ^= 1;
    expect(() => sanitizeInlinePng(valid.toString("base64"))).toThrow(/checksum/);
  });
});
