import { createHash } from "node:crypto";
import {
  AlignmentType, BorderStyle, Document, Footer, Header, HeadingLevel, ImageRun,
  Packer, PageNumber, Paragraph, ShadingType, Table, TableCell, TableLayoutType,
  TableRow, TextRun, VerticalAlign, WidthType, type IParagraphOptions,
} from "docx";
import JSZip from "jszip";
import QRCode from "qrcode";
import { reportFontFamily, reportInstitution, type ReportFontFamily } from "../shared/report-appearance";
import { sanitizeInlinePng } from "./work-version-inline-image";
import { reportFontAssets, reportInstitutionLogos } from "./work-version-report-assets";

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

async function embedReportFonts(zip: JSZip, family: ReportFontFamily) {
  const fonts = reportFontAssets(family);
  if (!fonts) return;
  const part = "word/fontTable.xml", relationships = "word/_rels/fontTable.xml.rels";
  const fontTable = await zip.file(part)!.async("string"), rels = await zip.file(relationships)!.async("string");
  if (!fontTable.endsWith("/>") || !rels.endsWith("/>") || fontTable.includes("<w:font ") || rels.includes("<Relationship ")) throw new Error("Unexpected generated font table");
  const entries = Object.entries(fonts).map(([weight, source], index) => {
    const id = `rId${index + 1}`, target = `fonts/report-${weight}.odttf`;
    const guid = createHash("sha256").update(source).digest().subarray(0, 16);
    guid[6] = (guid[6] & 0x0f) | 0x40;
    guid[8] = (guid[8] & 0x3f) | 0x80;
    const hex = guid.toString("hex").toUpperCase();
    const key = `{${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}}`;
    const bytes = Buffer.from(source), mask = Buffer.from(hex, "hex").reverse();
    for (let i = 0; i < 32; i++) bytes[i] ^= mask[i % 16];
    zip.file(`word/${target}`, bytes);
    return {
      reference: `<w:embed${weight === "regular" ? "Regular" : "Bold"} r:id="${id}" w:fontKey="${key}"/>`,
      relationship: `<Relationship Id="${id}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/font" Target="${target}"/>`,
    };
  });
  zip.file(part, `${fontTable.slice(0, -2)}><w:font w:name="${family}">${entries.map(entry => entry.reference).join("")}</w:font></w:fonts>`);
  zip.file(relationships, `${rels.slice(0, -2)}>${entries.map(entry => entry.relationship).join("")}</Relationships>`);
  const settings = await zip.file("word/settings.xml")!.async("string");
  zip.file("word/settings.xml", settings.replace("<w:evenAndOddHeaders", "<w:embedTrueTypeFonts/><w:evenAndOddHeaders"));
}

/** All text comes from the immutable snapshot. No HTML evaluation, external
 * relationship, file URL or storage key is fetched or copied into the document. */
export async function renderReportWorkVersionDocx(value: unknown, versionNumber: number) {
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) throw new ReportDocxValidationError("Invalid version number");
  const snapshot = normalize(value), draft = snapshot.reportDraft!;
  const title = text(snapshot.work!.title, 255) || "تقرير";
  // A running header is a locator, not a second copy of the cover. Repeating a
  // 255-character title can consume several lines on every page in Word.
  const headerTitle = Array.from(title.replace(/\s+/g, " "));
  const headerPrefix = headerTitle.slice(0, 63).join("").trimEnd();
  const headerBreak = headerPrefix.lastIndexOf(" ");
  const runningTitle = headerTitle.length > 64
    ? `${headerBreak >= 40 ? headerPrefix.slice(0, headerBreak) : headerPrefix}…`
    : headerTitle.join("");
  const font = reportFontFamily(draft.fontFamily, "Arial");
  const institution = reportInstitution(draft.fields);
  const compactCover = title.length > 120 || institution.schoolName.length > 80;
  const coverTitleSize = title.length > 180 ? 34 : title.length > 120 ? 38 : 44;
  const captured = snapshot.capturedAt || draft.updatedAt;
  const timestamp = captured && Number.isFinite(Date.parse(captured)) ? new Date(captured) : new Date("2000-01-01T00:00:00Z");
  const dateLabel = new Intl.DateTimeFormat("ar-SA", { calendar: "gregory", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(timestamp);
  const numericRange = /^[0-9٠-٩۰-۹]+(?:[-–—/][0-9٠-٩۰-۹]+)+$/;
  const runs = (value: string, options: { bold?: boolean; color?: string; size?: number } = {}) =>
    value.split(/([0-9٠-٩۰-۹]+(?:[-–—/][0-9٠-٩۰-۹]+)+|[A-Za-z0-9]+(?:[ \t]*[A-Za-z0-9.,:%/–—_-]+)*)/g).filter(Boolean).map(part => new TextRun({
      // Explicit LTR direction alone does not preserve AN-class Arabic digits
      // across separators. Apply an override to numeric-only ranges, with a
      // closing PDF control so it cannot affect the surrounding Arabic text.
      text: numericRange.test(part) ? `\u202d${part}\u202c` : /^[0-9][0-9.,:%/–—_-]+$/.test(part) ? `\u200e${part}\u200e` : part, font, size: options.size ?? 24, sizeComplexScript: options.size ?? 24,
      // Native runs keep Latin identifiers and numeric ranges in their own order.
      rightToLeft: !numericRange.test(part) && !/^[A-Za-z0-9]/.test(part), language: { value: "ar-SA", bidirectional: "ar-SA" },
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
    paragraph("SERS", { alignment: AlignmentType.CENTER, spacing: { before: compactCover ? 300 : 900, after: compactCover ? 200 : 360, line: 280 }, children: runs("SERS", { bold: true, color: "000000", size: 28 }) }),
    paragraph(title, { heading: HeadingLevel.TITLE, alignment: AlignmentType.CENTER, keepNext: true, keepLines: true,
      spacing: { after: compactCover ? 240 : 400, line: compactCover ? 280 : 320 }, children: runs(title, { bold: true, size: coverTitleSize, color: "000000" }) }),
    paragraph(`نسخة ${versionNumber}`, { alignment: AlignmentType.CENTER }),
    paragraph(dateLabel, { alignment: AlignmentType.CENTER }),
  ];
  const logos = (() => {
    try { return reportInstitutionLogos(institution); } catch { throw new ReportDocxValidationError("Invalid report logo"); }
  })();
  if (institution.schoolName) contents.unshift(paragraph(institution.schoolName, { alignment: AlignmentType.CENTER, children: runs(institution.schoolName, { bold: true, size: 26 }) }));
  if (logos.length) contents.unshift(new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 500, after: 300 }, children: logos.slice().reverse().flatMap((logo, index) => {
    const scale = Math.min(115 / logo.width, 76 / logo.height);
    const image = new ImageRun({ type: "png", data: logo.bytes, transformation: { width: Math.max(1, Math.round(logo.width * scale)), height: Math.max(1, Math.round(logo.height * scale)) }, altText: { name: `report-logo-${index}`, title: logo.alt } });
    return index ? [new TextRun({ text: "        ", font }), image] : [image];
  }) }));
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
  if (institution.visible) {
    const cells = institution.signers.map(({ label, name }) => new TableCell({
      width: { size: 4500, type: WidthType.DXA },
      margins: { top: 140, bottom: 100, left: 200, right: 200 },
      children: [
        paragraph(label, { alignment: AlignmentType.CENTER, children: runs(label, { bold: true }), keepNext: true }),
        paragraph(name || " ", { alignment: AlignmentType.CENTER, keepNext: true }),
        paragraph(" ", { alignment: AlignmentType.CENTER, indent: { left: 550, right: 550 }, border: { bottom: { style: BorderStyle.SINGLE, color: "94A3B8", size: 4 } } }),
      ],
    }));
    const borders = Object.fromEntries(["top", "bottom", "left", "right", "insideHorizontal", "insideVertical"].map(key => [key, { style: BorderStyle.NONE }]));
    contents.push(new Table({ rows: [new TableRow({ children: cells, cantSplit: true })], visuallyRightToLeft: true, width: { size: 9000, type: WidthType.DXA }, columnWidths: [4500, 4500], layout: TableLayoutType.FIXED, borders }));
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
      headers: { default: new Header({ children: [paragraph(runningTitle, { children: runs(runningTitle, { color: "000000", size: 18 }), spacing: { after: 0, line: 240 } })] }) },
      footers: { default: new Footer({ children: [paragraph(`نسخة ${versionNumber}`, { alignment: AlignmentType.CENTER, children: [...runs(`نسخة ${versionNumber}   |   `, { size: 18 }), new TextRun({ children: [PageNumber.CURRENT], size: 18 })] })] }) },
      children: contents,
    }],
  });
  // Stabilize archive metadata as well as the visible snapshot content. It also
  // prevents concurrent retries from writing byte-distinct copies of one version.
  const packed = await Packer.toBuffer(doc);
  const zip = await JSZip.loadAsync(packed);
  await embedReportFonts(zip, font);
  const corePath = "docProps/core.xml";
  const core = await zip.file(corePath)!.async("string");
  zip.file(corePath, core.replace(/(<dcterms:(?:created|modified)[^>]*>)[^<]*(<\/dcterms:(?:created|modified)>)/g, `$1${timestamp.toISOString()}$2`));
  const epoch = new Date("2000-01-01T00:00:00Z");
  for (const item of Object.values(zip.files)) item.date = epoch;
  return zip.generateAsync({ type: "nodebuffer", compression: "DEFLATE", compressionOptions: { level: 6 } });
}
