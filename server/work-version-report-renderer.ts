import qrcode from "qrcode-generator";
import { sanitizeInlinePng } from "./work-version-inline-image";
import { reportFontFamily, reportInstitution } from "../shared/report-appearance";
import { reportFontAssets, reportInstitutionLogos } from "./work-version-report-assets";

type ReportAssetSnapshot = {
  id?: number; title?: string; kind?: string; role?: string; caption?: string | null;
  preview?: { mimeType?: string; dataBase64?: string };
};
type ReportVersionSnapshot = {
  kind?: string; work?: { title?: string };
  reportDraft?: { templateId?: string; themeId?: string; fontFamily?: string; fields?: Record<string, unknown>; evidenceAssetIds?: unknown[]; updatedAt?: string };
  assets?: ReportAssetSnapshot[]; capturedAt?: string;
  academicContext?: { yearLabel?: string; termLabel?: string | null };
  shareReference?: { url?: string; label?: string };
};
const FIELD_DEFINITIONS = [
  ["summary", "ملخص التقرير"], ["objectives", "الأهداف"], ["audience", "الفئة المستهدفة"],
  ["implementation", "آلية التنفيذ"], ["results", "النتائج والمخرجات"], ["impact", "قياس الأثر"],
  ["recommendations", "التوصيات والخطوات التالية"],
] as const;
const TEMPLATE_LABELS: Record<string, string> = {
  custom: "تقرير عام", "program-report": "تقرير برنامج", "initiative-report": "تقرير مبادرة",
  "workshop-report": "تقرير ورشة", "meeting-report": "محضر/تقرير اجتماع", "visit-report": "تقرير زيارة",
};
const THEME_COLORS: Record<string, string> = { classic: "#0f172a", formal: "#134e4a", minimal: "#334155" };
function text(value: unknown, maximum = 40_000) {
  if (value === undefined || value === null) return "";
  if (typeof value !== "string" || value.length > maximum) throw new Error("Report text exceeds the PDF export limit");
  return value.replace(/[\x00-\x08\x0b\x0c\x0e-\x1f]/g, "").trim();
}
function escapeHtml(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#039;");
}
function normalizeSnapshot(value: unknown) {
  if (!value || typeof value !== "object") throw new Error("WorkVersion snapshot is missing");
  const snapshot = value as ReportVersionSnapshot;
  if (snapshot.kind !== "report") throw new Error("WorkVersion is not a report snapshot");
  if (!snapshot.work || typeof snapshot.work !== "object") throw new Error("Report snapshot work metadata is missing");
  if (!snapshot.reportDraft || typeof snapshot.reportDraft !== "object") throw new Error("Report draft snapshot is missing");
  if (snapshot.assets && (!Array.isArray(snapshot.assets) || snapshot.assets.length > 100)) throw new Error("Too many report evidence entries");
  return snapshot;
}
function formatSnapshotDate(value?: string) {
  if (!value || !Number.isFinite(Date.parse(value))) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", { calendar: "gregory", year: "numeric", month: "long", day: "numeric", timeZone: "UTC" }).format(new Date(value));
}

/** A flowing print document: page fragmentation belongs to Chromium, not a fixed
 * height overflow-hidden frame. All content is frozen text or bounded inline PNG;
 * source URLs and storage keys are never fetched or included. */
export function renderReportWorkVersionHtml(snapshotValue: unknown, versionNumber: number) {
  if (!Number.isSafeInteger(versionNumber) || versionNumber < 1) throw new Error("Invalid version number");
  const snapshot = normalizeSnapshot(snapshotValue), draft = snapshot.reportDraft!;
  const title = escapeHtml(text(snapshot.work!.title, 255) || "تقرير بدون عنوان");
  const templateLabel = escapeHtml(TEMPLATE_LABELS[draft.templateId || "custom"] || "تقرير");
  const color = THEME_COLORS[draft.themeId || "classic"] || THEME_COLORS.classic;
  const font = reportFontFamily(draft.fontFamily);
  const fonts = reportFontAssets(font);
  const printFont = fonts ? `'SERS ${font}'` : "Arial";
  const fontFaces = fonts ? Object.entries(fonts).map(([weight, bytes]) => `@font-face { font-family: ${printFont}; src: url(data:font/ttf;base64,${bytes.toString("base64")}) format('truetype'); font-weight: ${weight === "regular" ? 400 : 700}; }`).join("\n") : "";
  const institution = reportInstitution(draft.fields);
  const logos = reportInstitutionLogos(institution).map(logo => `<img src="data:image/png;base64,${logo.bytes.toString("base64")}" width="${logo.width}" height="${logo.height}" alt="${logo.alt}"/>`).join("");
  const date = escapeHtml(formatSnapshotDate(snapshot.capturedAt || draft.updatedAt));
  // Numeric ranges need their own LTR isolate inside an otherwise Arabic label.
  const year = escapeHtml(text(snapshot.academicContext?.yearLabel, 100)).replace(/[0-9٠-٩]+(?:[-–—/][0-9٠-٩]+)+/g, range => `<bdi dir="ltr">${range}</bdi>`);
  const term = escapeHtml(text(snapshot.academicContext?.termLabel, 100));
  let totalText = 0;
  const sections = FIELD_DEFINITIONS.flatMap(([key, label]) => {
    const value = text(draft.fields?.[key]); totalText += value.length;
    if (totalText > 180_000) throw new Error("Report text exceeds the PDF export limit");
    if (!value) return [];
    return [`<section class="report-section"><h2>${label}</h2>${value.split(/\r?\n/).map(line => `<p>${escapeHtml(line) || "&nbsp;"}</p>`).join("")}</section>`];
  });
  if (!sections.length) sections.push('<section class="report-section"><h2>لا يوجد محتوى نصي مثبت في هذه النسخة</h2></section>');
  const selectedIds = new Set((Array.isArray(draft.evidenceAssetIds) ? draft.evidenceAssetIds : []).filter((id): id is number => Number.isSafeInteger(id) && Number(id) > 0));
  const selected = (snapshot.assets ?? []).filter(asset => asset && typeof asset.id === "number" && selectedIds.has(asset.id));
  if (selected.length) {
    sections.push(`<section class="report-section report-page-start"><h2>الشواهد المستخدمة</h2><table><thead><tr><th>الشاهد</th><th>الوصف</th></tr></thead><tbody>${selected.map((asset, index) => `<tr><td>${index + 1}. ${escapeHtml(text(asset.title, 255) || "شاهد")}</td><td>${escapeHtml(text(asset.caption, 4000)) || "—"}</td></tr>`).join("")}</tbody></table></section>`);
    const images: string[] = [];
    for (const asset of selected) {
      if (!asset.preview) continue;
      if (images.length >= 4 || asset.preview.mimeType !== "image/png" || typeof asset.preview.dataBase64 !== "string") throw new Error("Unsupported report preview");
      const preview = sanitizeInlinePng(asset.preview.dataBase64);
      images.push(`<figure><figcaption>${escapeHtml(text(asset.title, 255) || "صورة الشاهد")}</figcaption><img src="data:image/png;base64,${preview.bytes.toString("base64")}" width="${preview.width}" height="${preview.height}" alt="${escapeHtml(text(asset.title, 255))}"/></figure>`);
    }
    if (images.length) sections.push(`<section class="report-section report-page-start report-previews"><h2>صور الشواهد</h2>${images.join("")}</section>`);
  }
  if (institution.visible) sections.push(`<section class="report-section report-signatures" aria-label="التوقيعات">${institution.signers.map(({ label, name }) => `<div><strong>${label}</strong><p>${escapeHtml(name) || "&nbsp;"}</p><span></span></div>`).join("")}</section>`);
  if (snapshot.shareReference) {
    const reference = snapshot.shareReference;
    let url: URL;
    try { url = new URL(text(reference.url, 512)); } catch { throw new Error("Invalid report share reference"); }
    if (url.protocol !== "https:" || url.username || url.password || url.search || url.hash || !/^\/output\/[A-Za-z0-9_-]{20,128}$/.test(url.pathname)) throw new Error("Invalid report share reference");
    const code = qrcode(0, "M"); code.addData(url.href, "Byte"); code.make();
    sections.push(`<section class="report-section report-page-start report-share"><h2>${escapeHtml(text(reference.label, 255) || "رابط النسخة المشتركة")}</h2><div class="report-qr">${code.createSvgTag({ cellSize: 4, margin: 16, scalable: true })}</div><p dir="ltr">${escapeHtml(url.href)}</p></section>`);
  }
  return `<style>
    ${fontFaces}
    @page { size: A4; margin: 18mm 16mm; @top-right { content: "SERS"; font: 9pt ${printFont}; color: #64748b; } @bottom-center { content: "نسخة ${versionNumber} · " counter(page); font: 9pt ${printFont}; color: #64748b; } }
    body { width: auto; min-height: 0; }
    .work-version-document { font-family: ${printFont}, 'Noto Naskh Arabic', 'DejaVu Sans', sans-serif; direction: rtl; color: #263445; font-size: 12pt; line-height: 1.8; overflow-wrap: anywhere; }
    .work-version-document h1, .work-version-document h2 { font-family: inherit; color: ${color}; break-after: avoid; }
    .work-version-document h1 { font-size: 24pt; line-height: 1.65; margin: 12mm 0; }
    .work-version-document h2 { font-size: 18pt; line-height: 1.5; margin: 0 0 8mm; }
    .work-version-document p { margin: 0 0 5mm; orphans: 3; widows: 3; }
    .report-cover { min-height: 250mm; display: flex; flex-direction: column; align-items: center; justify-content: center; text-align: center; }
    .report-cover + .report-section, .report-page-start { break-before: page; }
    .report-section + .report-section:not(.report-page-start) { margin-top: 8mm; }
    .work-version-document table { width: 100%; table-layout: fixed; border-collapse: collapse; font-size: 11pt; }
    .work-version-document thead { display: table-header-group; }
    .work-version-document th, .work-version-document td { border: 1px solid #d9d9d9; padding: 3mm; vertical-align: middle; text-align: right; }
    .work-version-document th:first-child { width: 39%; }
    .work-version-document th { background: #eaf1f8; color: #000; font-weight: bold; }
    .work-version-document tr { break-inside: avoid; }
    .work-version-document figure { margin: 0 0 8mm; break-inside: avoid; text-align: center; }
    .work-version-document figcaption { text-align: right; font-weight: bold; margin-bottom: 4mm; }
    .work-version-document img { width: auto; height: auto; max-width: 100%; max-height: 180mm; object-fit: contain; }
    .report-cover-logos { display: flex; align-items: center; justify-content: center; gap: 12mm; margin-bottom: 7mm; }
    .report-cover-logos img { max-width: 35mm; max-height: 24mm; }
    .report-signatures { display: flex; gap: 14mm; text-align: center; break-inside: avoid; border-top: 1px solid #d9d9d9; padding-top: 5mm; }
    .report-signatures div { flex: 1; min-width: 0; }
    .report-signatures p { margin: 2mm 0 6mm; }
    .report-signatures span { display: block; width: 65%; margin: auto; border-bottom: 1px solid #94a3b8; }
    .report-qr { width: 48mm; height: 48mm; margin: 12mm auto 6mm; }
    .report-qr svg { width: 100%; height: 100%; }
    .report-share p { text-align: center; font-size: 9pt; }
  </style><article class="work-version-document" dir="rtl"><header class="report-cover">${logos ? `<div class="report-cover-logos">${logos}</div>` : ""}${institution.schoolName ? `<p><strong>${escapeHtml(institution.schoolName)}</strong></p>` : ""}<p>SERS · ${templateLabel}</p><h1>${title}</h1><p>نسخة ${versionNumber}</p><p>${date}</p>${year ? `<p>العام الدراسي <bdi>${year}</bdi></p>` : ""}${term ? `<p>${term}</p>` : ""}</header>${sections.join("")}</article>`;
}
