type ReportAssetSnapshot = {
  id?: number;
  title?: string;
  kind?: string;
  mimeType?: string | null;
  role?: string;
  caption?: string | null;
};

type ReportDraftSnapshot = {
  templateId?: string;
  themeId?: string;
  fontFamily?: string;
  fields?: Record<string, unknown>;
  evidenceAssetIds?: unknown[];
  updatedAt?: string;
};

type ReportVersionSnapshot = {
  schemaVersion?: number;
  kind?: string;
  work?: {
    id?: number;
    title?: string;
    ownerType?: string;
    ownerUserId?: number | null;
    ownerOrganizationId?: number | null;
  };
  reportDraft?: ReportDraftSnapshot;
  assets?: ReportAssetSnapshot[];
  capturedAt?: string;
};

const FIELD_DEFINITIONS = [
  ["summary", "ملخص التقرير"],
  ["objectives", "الأهداف"],
  ["audience", "الفئة المستهدفة"],
  ["implementation", "آلية التنفيذ"],
  ["results", "النتائج والمخرجات"],
  ["impact", "قياس الأثر"],
  ["recommendations", "التوصيات والخطوات التالية"],
] as const;

const TEMPLATE_LABELS: Record<string, string> = {
  custom: "تقرير عام",
  "program-report": "تقرير برنامج",
  "initiative-report": "تقرير مبادرة",
  "workshop-report": "تقرير ورشة",
  "meeting-report": "محضر/تقرير اجتماع",
  "visit-report": "تقرير زيارة",
};

const THEME_COLORS: Record<string, { primary: string; accent: string; soft: string }> = {
  classic: { primary: "#0f172a", accent: "#0f766e", soft: "#f0fdfa" },
  formal: { primary: "#134e4a", accent: "#0f766e", soft: "#f0fdfa" },
  minimal: { primary: "#334155", accent: "#475569", soft: "#f8fafc" },
};

const ALLOWED_FONTS: Record<string, string> = {
  Cairo: "Cairo",
  Tajawal: "Tajawal",
  "Noto Kufi Arabic": "Cairo",
};

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function normalizeSnapshot(value: unknown): Required<Pick<ReportVersionSnapshot, "kind" | "work" | "reportDraft" | "assets">> & Pick<ReportVersionSnapshot, "capturedAt"> {
  if (!value || typeof value !== "object") throw new Error("WorkVersion snapshot is missing");
  const snapshot = value as ReportVersionSnapshot;
  if (snapshot.kind !== "report") throw new Error("WorkVersion is not a report snapshot");
  if (!snapshot.work || typeof snapshot.work !== "object") throw new Error("Report snapshot work metadata is missing");
  if (!snapshot.reportDraft || typeof snapshot.reportDraft !== "object") throw new Error("Report draft snapshot is missing");
  return {
    kind: "report",
    work: snapshot.work,
    reportDraft: snapshot.reportDraft,
    assets: Array.isArray(snapshot.assets) ? snapshot.assets : [],
    capturedAt: snapshot.capturedAt,
  };
}

function formatSnapshotDate(value?: string) {
  if (!value) return "غير محدد";
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) return "غير محدد";
  return new Intl.DateTimeFormat("ar-SA", {
    calendar: "gregory",
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  }).format(new Date(timestamp));
}

function pageFrame(inner: string, footer: string, palette: { primary: string; accent: string; soft: string }, font: string) {
  return `<div class="pdf-page" style="font-family:'${font}',sans-serif;background:#fff;color:#172033;">
    <div style="height:14mm;background:${palette.primary};"></div>
    <div style="padding:16mm 16mm 22mm;min-height:254mm;position:relative;">
      ${inner}
      <div style="position:absolute;right:16mm;left:16mm;bottom:9mm;border-top:1px solid #dbe3ea;padding-top:3mm;display:flex;justify-content:space-between;gap:8px;font-size:9px;color:#64748b;">
        <span>${footer}</span><span>SERS</span>
      </div>
    </div>
  </div>`;
}

export function renderReportWorkVersionHtml(snapshotValue: unknown, versionNumber: number) {
  const snapshot = normalizeSnapshot(snapshotValue);
  const workTitle = escapeHtml(snapshot.work.title || "تقرير بدون عنوان");
  const draft = snapshot.reportDraft;
  const fields = draft.fields && typeof draft.fields === "object" ? draft.fields : {};
  const palette = THEME_COLORS[draft.themeId || "classic"] || THEME_COLORS.classic;
  const font = ALLOWED_FONTS[draft.fontFamily || "Cairo"] || "Cairo";
  const templateLabel = escapeHtml(TEMPLATE_LABELS[draft.templateId || "custom"] || "تقرير");
  const capturedAt = formatSnapshotDate(snapshot.capturedAt || draft.updatedAt);
  const footer = `نسخة ${versionNumber} · ${escapeHtml(capturedAt)}`;

  const cover = pageFrame(`
    <div style="display:flex;min-height:210mm;flex-direction:column;align-items:center;justify-content:center;text-align:center;">
      <div style="display:inline-flex;align-items:center;justify-content:center;border-radius:999px;background:${palette.soft};color:${palette.accent};padding:3mm 7mm;font-size:12px;font-weight:800;">${templateLabel}</div>
      <div style="margin-top:14mm;width:28mm;height:2mm;background:${palette.accent};border-radius:999px;"></div>
      <h1 style="margin:12mm auto 0;max-width:155mm;font-size:30px;line-height:1.65;color:${palette.primary};font-weight:900;">${workTitle}</h1>
      <p style="margin-top:8mm;font-size:13px;color:#64748b;">نسخة ثابتة مرتبطة ببيانات العمل والشواهد</p>
      <div style="margin-top:18mm;border:1px solid #dbe3ea;border-radius:16px;padding:6mm 10mm;background:#f8fafc;font-size:11px;color:#475569;">
        رقم النسخة: <strong>${versionNumber}</strong><br/>تاريخ تثبيت المحتوى: <strong>${escapeHtml(capturedAt)}</strong>
      </div>
    </div>`, footer, palette, font);

  const contentPages = FIELD_DEFINITIONS.flatMap(([key, label]) => {
    const rawValue = fields[key];
    if (typeof rawValue !== "string" || !rawValue.trim()) return [];
    const paragraphs = escapeHtml(rawValue.trim()).replace(/\r?\n/g, "<br/>");
    return [pageFrame(`
      <div style="display:flex;align-items:center;gap:4mm;">
        <span style="width:5mm;height:16mm;border-radius:999px;background:${palette.accent};"></span>
        <div>
          <p style="font-size:10px;font-weight:800;color:${palette.accent};">محتوى التقرير</p>
          <h2 style="margin-top:1mm;font-size:22px;line-height:1.5;color:${palette.primary};">${escapeHtml(label)}</h2>
        </div>
      </div>
      <div style="margin-top:10mm;border:1px solid #e2e8f0;border-radius:18px;padding:9mm;background:#fff;font-size:14px;line-height:2.15;color:#334155;white-space:normal;overflow-wrap:anywhere;">${paragraphs}</div>
    `, footer, palette, font)];
  });

  const selectedIds = new Set(
    Array.isArray(draft.evidenceAssetIds)
      ? draft.evidenceAssetIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
      : [],
  );
  const selectedAssets = snapshot.assets.filter(asset => typeof asset.id === "number" && selectedIds.has(asset.id));
  const evidencePage = selectedAssets.length > 0
    ? pageFrame(`
      <div style="display:flex;align-items:center;gap:4mm;">
        <span style="width:5mm;height:16mm;border-radius:999px;background:${palette.accent};"></span>
        <div><p style="font-size:10px;font-weight:800;color:${palette.accent};">مصادر مرتبطة بالنسخة</p><h2 style="margin-top:1mm;font-size:22px;color:${palette.primary};">الشواهد المستخدمة</h2></div>
      </div>
      <div style="margin-top:10mm;display:grid;gap:4mm;">
        ${selectedAssets.map((asset, index) => `<div style="display:flex;gap:5mm;border:1px solid #e2e8f0;border-radius:14px;padding:5mm;background:${index % 2 === 0 ? "#fff" : palette.soft};">
          <div style="display:flex;width:10mm;height:10mm;align-items:center;justify-content:center;border-radius:10px;background:${palette.accent};color:#fff;font-size:11px;font-weight:900;">${index + 1}</div>
          <div style="min-width:0;flex:1;"><div style="font-size:13px;font-weight:800;color:#1e293b;">${escapeHtml(asset.title || `شاهد ${index + 1}`)}</div>
          <div style="margin-top:1.5mm;font-size:10px;color:#64748b;">${escapeHtml(asset.kind || "asset")} · ${escapeHtml(asset.role || "evidence")}</div>
          ${asset.caption ? `<div style="margin-top:2mm;font-size:11px;line-height:1.8;color:#475569;">${escapeHtml(asset.caption)}</div>` : ""}</div>
        </div>`).join("")}
      </div>
      <div style="margin-top:8mm;border-radius:14px;background:#fff7ed;padding:5mm;font-size:10px;line-height:1.9;color:#9a3412;">هذه الصفحة تسجل الشواهد المرتبطة بالنسخة. لا تدّعي أن محتوى الشاهد صحيح أو أن النشاط نُفّذ إلا بعد المراجعة البشرية والاعتماد.</div>
    `, footer, palette, font)
    : "";

  const emptyPage = contentPages.length === 0
    ? pageFrame(`<div style="display:flex;min-height:205mm;align-items:center;justify-content:center;text-align:center;"><div><h2 style="font-size:22px;color:${palette.primary};">لا يوجد محتوى نصي مثبت في هذه النسخة</h2><p style="margin-top:4mm;font-size:12px;color:#64748b;">ارجع إلى مسودة التقرير وأضف البيانات ثم أنشئ نسخة جديدة.</p></div></div>`, footer, palette, font)
    : "";

  return `<div>${cover}${contentPages.join("")}${evidencePage}${emptyPage}</div>`;
}
