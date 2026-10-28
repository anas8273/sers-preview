import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType,
  TableRow, TextRun, VerticalAlign, WidthType, type IParagraphOptions,
} from "docx";
import JSZip from "jszip";
import QRCode from "qrcode";
import { sanitizeInlinePng } from "./work-version-inline-image";

export class ReportDocxValidationError extends Error {}
type AssetSnapshot = {
  id?: number; title?: string; kind?: string; role?: string; caption?: string;
  preview?: { mimeType?: string; dataBase64?: string };
};
type ReportSnapshot = {
  kind?: string; work?: { title?: string };
  academicContext?: { yearLabel?: string; termLabel?: string | null };
  reportDraft?: { fields?: Record<string, unknown>; fontFamily?: string; evidenceAssetIds?: unknown[]; updatedAt?: string };
  assets?: AssetSnapshot[]; capturedAt?: string;
  shareReference?: { url?: string; label?: string };
};
const fields = [
  ["summary", "ملخص التقرير"], ["objectives", "الأهداف"], ["audience", "الفئة المستهدفة"],
  ["implementation", "آلية التنفيذ"], ["results", "النتائج والمخرجات"],
  ["impact", "قياس الأثر"], ["recommendations", "التوصيات والخطوات التالية"],
] as const;
function text(value: unknown, max = 40_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > max) throw new ReportDocxValidationError("Report text exceeds the export limit");
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
}
function normalize(value: unknown) {
  if (!value || typeof value !== "object") throw new ReportDocxValidationError("Missing report snapshot");
  const snapshot = value as ReportSnapshot;
  if (snapshot.kind !== "report" || !snapshot.work || !snapshot.reportDraft) throw new ReportDocxValidationError("WorkVersion is not a report snapshot");
  if (snapshot.assets && (!Array.isArray(snapshot.assets) || snapshot.assets.length > 100)) throw new ReportDocxValidationError("Too many report evidence entries");
  return snapshot;
}

/** All text comes from the immutable snapshot. No HTML evaluation, external
 * relationship, file URL or storage key is fetched or copied into the document. */
export async function renderReportWorkVersionDocx(value: unknown, versionNumber: number) {
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) throw new ReportDocxValidationError("Invalid version number");
  const snapshot = normalize(value), draft = snapshot.reportDraft!;
  const title = text(snapshot.work!.title, 255) || "تقرير";
  const font = ["Cairo", "Tajawal", "Arial"].includes(draft.fontFamily || "") ? draft.fontFamily! : "Arial";
  const captured = snapshot.capturedAt || draft.updatedAt;
  const timestamp = captured && Number.isFinite(Date.parse(captured)) ? new Date(captured) : new Date("2000-01-01T00:00:00Z");
  const dateLabel = new Intl.DateTimeFormat("ar-SA", { calendar: "gregory", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(timestamp);
  const runs = (value: string, options: { bold?: boolean; color?: string; size?: number } = {}) =>
    value.split(/([A-Za-z0-9]+(?:[ \t]*[A-Za-z0-9.,:%/–—_-]+)*)/g).filter(Boolean).map(part => new TextRun({
      text: /^[0-9][0-9.,:%/–—_-]+$/.test(part) ? `\u200e${part}\u200e` : part, font, size: options.size ?? 24, sizeComplexScript: options.size ?? 24,
      // Native runs keep Latin identifiers and numeric ranges in their own order.
      rightToLeft: !/^[A-Za-z0-9]/.test(part), language: { value: "ar-SA", bidirectional: "ar-SA" },
      bold: options.bold, boldComplexScript: options.bold, color: options.color ?? "263445",
    }));
  const paragraph = (value: string, options: IParagraphOptions = {}) => new Paragraph({
    bidirectional: true, alignment: AlignmentType.START, spacing: { after: 140, line: 360 },
    widowControl: true, children: runs(value), ...options,
  });
  const heading = (value: string, pageBreakBefore = false) => paragraph(value, {
    heading: HeadingLevel.HEADING_1, pageBreakBefore, keepNext: true,
    spacing: { before: 260, after: 180 }, children: runs(value, { bold: true, size: 32, color: "000000" }),
  });
  const contents: (Paragraph | Table)[] = [
    paragraph("SERS", { alignment: AlignmentType.CENTER, spacing: { before: 900, after: 360 }, children: runs("SERS", { bold: true, color: "000000", size: 28 }) }),
    paragraph(title, { heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, spacing: { after: 400 }, children: runs(title, { bold: true, size: 44, color: "000000" }) }),
    paragraph(`نسخة ${versionNumber}`, { alignment: AlignmentType.CENTER }),
    paragraph(dateLabel, { alignment: AlignmentType.CENTER }),
  ];
  const yearLabel = text(snapshot.academicContext?.yearLabel, 100);
  const termLabel = text(snapshot.academicContext?.termLabel, 100);
  if (yearLabel) contents.push(paragraph(`العام الدراسي ${yearLabel}`, { alignment: AlignmentType.CENTER }));
  if (termLabel) contents.push(paragraph(termLabel, { alignment: AlignmentType.CENTER }));
  let populated = 0, totalText = 0;
  for (const [key, label] of fields) {
    const content = text(draft.fields?.[key]);
    totalText += content.length;
    if (totalText > 180_000) throw new ReportDocxValidationError("Report text exceeds the export limit");
    if (!content) continue;
    contents.push(heading(label, populated++ === 0));
    for (const line of content.split(/\r?\n/)) contents.push(paragraph(line || " "));
  }
  if (!populated) contents.push(heading("محتوى التقرير", true), paragraph("لا يوجد محتوى نصي مثبت في هذه النسخة."));

  const selectedIds = new Set((Array.isArray(draft.evidenceAssetIds) ? draft.evidenceAssetIds : []).filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0));
  const selected = (snapshot.assets ?? []).filter(asset => asset && typeof asset.id === "number" && selectedIds.has(asset.id));
  if (selected.length) {
    contents.push(heading("الشواهد المستخدمة", true));
    const cell = (value: string, header = false, width = 4500) => new TableCell({
      width: { size: width, type: WidthType.DXA }, verticalAlign: VerticalAlign.CENTER, margins: { top: 100, bottom: 100, left: 140, right: 140 },
      shading: header ? { type: ShadingType.CLEAR, fill: "EAF1F8" } : undefined,
      children: [paragraph(value, { children: runs(value, { bold: header, size: 22 }), spacing: { after: 0, line: 320 } })],
    });
    const rows = [new TableRow({ tableHeader: true, children: [cell("الشاهد", true, 3500), cell("الوصف", true, 5500)] })];
    for (const [index, asset] of Array.from(selected.entries())) {
      rows.push(new TableRow({ children: [cell(`${index + 1}. ${text(asset.title, 255) || "شاهد"}`, false, 3500), cell(text(asset.caption, 4000) || "—", false, 5500)] }));
    }
    contents.push(new Table({ rows, visuallyRightToLeft: true, width: { size: 9000, type: WidthType.DXA }, columnWidths: [3500, 5500], layout: TableLayoutType.FIXED,
      borders: Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(key => [key, { style: BorderStyle.SINGLE, size: 3, color: "D9D9D9" }])),
    }));
    let images = 0;
    for (const asset of selected) {
      if (!asset.preview) continue;
      if (++images > 4 || asset.preview.mimeType !== "image/png" || typeof asset.preview.dataBase64 !== "string") throw new ReportDocxValidationError("Unsupported report preview");
      let preview;
      try { preview = sanitizeInlinePng(asset.preview.dataBase64); } catch { throw new ReportDocxValidationError("Invalid report preview"); }
      const scale = Math.min(1, 470 / preview.width, 400 / preview.height);
      contents.push(paragraph(text(asset.title, 255) || "صورة الشاهد", { pageBreakBefore: images === 1, keepNext: true, children: runs(text(asset.title, 255) || "صورة الشاهد", { bold: true }) }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: preview.bytes, transformation: { width: Math.round(preview.width * scale), height: Math.round(preview.height * scale) }, altText: { name: `evidence-${images}`, title: text(asset.title, 255) || "صورة الشاهد", description: text(asset.caption, 1000) } })] }));
    }
  }
  if (snapshot.shareReference) {
    const reference = snapshot.shareReference;
    let url: URL;
    try { url = new URL(text(reference.url, 512)); } catch { throw new ReportDocxValidationError("Invalid report share reference"); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !/^\/output\/[A-Za-z0-9_-]{20,128}$/.test(url.pathname)) throw new ReportDocxValidationError("Invalid report share reference");
    const qr = await QRCode.toBuffer(url.href, { type: "png", width: 256, margin: 2, errorCorrectionLevel: "M" });
    const label = text(reference.label, 255) || "رابط النسخة المشتركة";
    contents.push(heading(label, true), new Paragraph({ alignment: AlignmentType.CENTER, children: [new ImageRun({ type: "png", data: qr, transformation: { width: 160, height: 160 }, altText: { name: "report-share-qr", title: label } })] }), paragraph(url.href, { alignment: AlignmentType.CENTER, children: [new TextRun({ text: url.href, font, size: 16, rightToLeft: false })] }));
  }

  const doc = new Document({ creator: "SERS", lastModifiedBy: "SERS", title, subject: `نسخة التقرير ${versionNumber}`, revision: versionNumber,
    styles: { default: { document: { run: { font, size: 24, sizeComplexScript: 24, language: { value: "ar-SA", bidirectional: "ar-SA" } }, paragraph: { alignment: AlignmentType.START, spacing: { after: 140, line: 360 } } } } },
    sections: [{ properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1100, bottom: 1100, left: 1453, right: 1453, header: 500, footer: 500 } } },
      headers: { default: new Header({ children: [paragraph(title, { children: runs(title, { color: "000000", size: 18 }), spacing: { after: 0 } })] }) },
      footers: { default: new Footer({ children: [paragraph(`نسخة ${versionNumber}`, { alignment: AlignmentType.CENTER, children: [...runs(`نسخة ${versionNumber}   |   `, { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) },
      children: contents,
    }],
  });
  // Stabilize archive metadata as well as the visible snapshot content. It also
  // prevents concurrent retries from writing byte-distinct copies of one version.
  const packed = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(packed);
  const corePath = "docProps/core.xml";
  const core = await zip.file(corePath)!.async("string");
  zip.file(corePath, core.replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]*(<\/dcterms:(?:created|modified)>)/g, `$1${timestamp.toISOString()}$2`));
  const epoch = new Date("2000-01-01T00:00:00Z");
  for (const item of Object.values(zip.files)) item.date = epoch;
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
