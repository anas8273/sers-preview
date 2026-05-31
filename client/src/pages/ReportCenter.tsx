/**
 * مركز التقارير الشامل - SERS
 * موحد مع شواهد الأداء الوظيفي: ترويسة رسمية، مرفقات + باركود QR، معاينة حية
 */
import React, { useState, useMemo, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Plus, Trash2, Eye, Save, Users, Building2, BookOpen,
  Star, Search, Edit3, Sparkles, Loader2, Printer, FileDown, Maximize2,
  Minimize2, ChevronLeft, ChevronDown, ChevronUp, ZoomIn, ZoomOut, RotateCcw,
  Upload, Image as ImageIcon, Paperclip, CheckCircle2, Clock, FileCheck,
  Link as LinkIcon, X, QrCode
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import TemplateSelector, { THEMES, type ThemeConfig } from "@/components/TemplateSelector";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import OfficialHeader from "@/components/OfficialHeader";
import { usePreviewScale } from "@/hooks/usePreviewScale";
import { saveFileToIDB, getFileFromIDB, deleteFileFromIDB } from "@/hooks/useIndexedDB";
import { generateQRDataURL } from "@/lib/qr-utils";
import { useUserStore, DEFAULT_PERSONAL_INFO } from "@/stores/userStore";

const A4_WIDTH_PX = 793.7;
const MOE_LOGO = "https://d2xsxph8kpxj0f.cloudfront.net/310519663047121386/h34s4aPNVyHXdtjgZ7eNNf/UntiTtled-1-1568x1192_bfb97198.png";
const MAX_ATTACHMENTS = 5;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

// ═══════════════════════════════════════════════════════════════
// Types — fully dynamic, no hardcoded IDs
// ═══════════════════════════════════════════════════════════════

interface ReportField {
  id: string; label: string; type: "text" | "textarea" | "select" | "date" | "number";
  placeholder?: string; options?: string[]; required?: boolean;
}
interface ReportTemplate {
  id: string; title: string; description: string;
  icon: React.ComponentType<any>; color: string; fields: ReportField[];
  isCustom?: boolean;
}
interface ReportAttachment {
  id: string; fileName: string; fileType: string; idbKey: string;
  displayAs: "image" | "qr"; showBarcode: boolean;
  uploadedUrl?: string; linkUrl?: string;
}
interface ReportPersonalInfo {
  department: string; year: string; preparer: string;
}
interface SavedReport {
  id: string; templateId: string; title: string; data: Record<string, string>;
  themeId: string; fontFamily: string; createdAt: number; updatedAt: number;
  wasExported: boolean; attachments: ReportAttachment[]; personalInfo: ReportPersonalInfo;
}
type ReportStatus = "draft" | "complete" | "exported";

const DEFAULT_PERSONAL: ReportPersonalInfo = {
  department: DEFAULT_PERSONAL_INFO.department, year: DEFAULT_PERSONAL_INFO.year, preparer: DEFAULT_PERSONAL_INFO.preparer,
};

// Dynamic template registry — future: load from API
const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "student-performance", title: "تقرير أداء الطلاب", description: "تقرير شامل عن مستوى أداء الطلاب في المادة", icon: Users, color: "#0d9488",
    fields: [
      { id: "subject", label: "المادة", type: "text", placeholder: "اسم المادة", required: true },
      { id: "class", label: "الصف / الفصل", type: "text", placeholder: "مثال: ثالث متوسط - أ", required: true },
      { id: "semester", label: "الفصل الدراسي", type: "select", options: ["الأول", "الثاني", "الثالث"], required: true },
      { id: "year", label: "العام الدراسي", type: "text", placeholder: "1446هـ" },
      { id: "totalStudents", label: "عدد الطلاب", type: "number", placeholder: "30" },
      { id: "excellentCount", label: "عدد المتفوقين", type: "number", placeholder: "5" },
      { id: "failCount", label: "عدد المتعثرين", type: "number", placeholder: "3" },
      { id: "average", label: "متوسط الدرجات", type: "number", placeholder: "78" },
      { id: "strengths", label: "نقاط القوة", type: "textarea", placeholder: "أبرز نقاط القوة لدى الطلاب..." },
      { id: "weaknesses", label: "نقاط الضعف", type: "textarea", placeholder: "أبرز نقاط الضعف والتحديات..." },
      { id: "recommendations", label: "التوصيات", type: "textarea", placeholder: "التوصيات والمقترحات لتحسين الأداء..." },
    ]
  },
  {
    id: "teacher-activity", title: "تقرير النشاط المهني", description: "توثيق الأنشطة والإنجازات المهنية للمعلم", icon: Star, color: "#7c3aed",
    fields: [
      { id: "teacherName", label: "اسم المعلم", type: "text", required: true },
      { id: "period", label: "الفترة", type: "text", placeholder: "من - إلى" },
      { id: "trainings", label: "الدورات التدريبية", type: "textarea", placeholder: "الدورات التي حضرها أو قدمها..." },
      { id: "activities", label: "الأنشطة المنفذة", type: "textarea", placeholder: "الأنشطة الصفية واللاصفية..." },
      { id: "innovations", label: "المبادرات والابتكارات", type: "textarea", placeholder: "أي مبادرات أو أفكار إبداعية..." },
      { id: "challenges", label: "التحديات", type: "textarea", placeholder: "التحديات التي واجهها..." },
      { id: "goals", label: "الأهداف المستقبلية", type: "textarea", placeholder: "الأهداف للفترة القادمة..." },
    ]
  },
  {
    id: "admin-weekly", title: "التقرير الإداري الأسبوعي", description: "تقرير أسبوعي عن سير العمل في المدرسة", icon: Building2, color: "#ea580c",
    fields: [
      { id: "school", label: "المدرسة", type: "text", required: true },
      { id: "weekDate", label: "الأسبوع", type: "text", placeholder: "من الأحد XX إلى الخميس XX" },
      { id: "attendance", label: "نسبة الحضور", type: "text", placeholder: "95%" },
      { id: "events", label: "الفعاليات والأنشطة", type: "textarea", placeholder: "الفعاليات التي تمت خلال الأسبوع..." },
      { id: "issues", label: "الملاحظات والمشكلات", type: "textarea", placeholder: "أي ملاحظات أو مشكلات..." },
      { id: "decisions", label: "القرارات المتخذة", type: "textarea", placeholder: "القرارات الإدارية..." },
      { id: "nextWeek", label: "خطة الأسبوع القادم", type: "textarea", placeholder: "ما هو مخطط للأسبوع القادم..." },
    ]
  },
  {
    id: "department", title: "تقرير القسم / الشعبة", description: "تقرير دوري عن أداء القسم التعليمي", icon: BookOpen, color: "#2563eb",
    fields: [
      { id: "deptName", label: "اسم القسم", type: "text", required: true },
      { id: "head", label: "رئيس القسم", type: "text" },
      { id: "period", label: "الفترة", type: "text", placeholder: "الفصل الدراسي / الشهر" },
      { id: "teacherCount", label: "عدد المعلمين", type: "number" },
      { id: "meetings", label: "الاجتماعات المنعقدة", type: "textarea", placeholder: "ملخص الاجتماعات..." },
      { id: "achievements", label: "الإنجازات", type: "textarea", placeholder: "إنجازات القسم..." },
      { id: "plans", label: "الخطط المستقبلية", type: "textarea", placeholder: "خطط القسم القادمة..." },
    ]
  },
  {
    id: "custom", title: "تقرير مخصص", description: "إنشاء تقرير بحقول مخصصة حسب الحاجة", icon: Edit3, color: "#64748b", isCustom: true,
    fields: [
      { id: "title", label: "عنوان التقرير", type: "text", required: true },
      { id: "date", label: "التاريخ", type: "text" },
      { id: "content", label: "المحتوى", type: "textarea", placeholder: "اكتب محتوى التقرير هنا..." },
      { id: "notes", label: "ملاحظات", type: "textarea" },
    ]
  },
];

// ═══════════════════════════════════════════════════════════════
// Utilities — generic, no template/theme ID coupling
// ═══════════════════════════════════════════════════════════════

const STORAGE_KEY = "sers-reports";
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

function loadReports(): SavedReport[] {
  try {
    const s = localStorage.getItem(STORAGE_KEY); if (!s) return [];
    return (JSON.parse(s) as any[]).map((r: any) => ({
      ...r, wasExported: r.wasExported ?? false, attachments: r.attachments ?? [],
      personalInfo: r.personalInfo ?? { ...DEFAULT_PERSONAL },
    }));
  } catch { return []; }
}
function saveReportsLS(reports: SavedReport[]) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(reports)); }
  catch { toast.error("تعذر حفظ التقارير — المساحة ممتلئة"); }
}

function computeStatus(tmpl: ReportTemplate, data: Record<string, string>, wasExported: boolean): ReportStatus {
  if (wasExported) return "exported";
  const reqOk = tmpl.fields.filter(f => f.required).every(f => data[f.id]?.trim());
  const anyText = tmpl.fields.filter(f => f.type === "textarea").some(f => data[f.id]?.trim());
  return reqOk && anyText ? "complete" : "draft";
}

const STATUS_CFG: Record<ReportStatus, { label: string; bg: string; tx: string; Icon: React.ComponentType<any> }> = {
  draft: { label: "مسودة", bg: "bg-amber-100", tx: "text-amber-700", Icon: Clock },
  complete: { label: "مكتمل", bg: "bg-green-100", tx: "text-green-700", Icon: CheckCircle2 },
  exported: { label: "تم التصدير", bg: "bg-blue-100", tx: "text-blue-700", Icon: FileCheck },
};

/** Maps any ThemeConfig → OfficialHeader props. Works for any theme. */
function themeToHeader(t: ThemeConfig) {
  return { accentColor: t.primaryColor, headerBg: t.headerBg, headerText: t.headerText, borderColor: t.borderColor };
}

// ═══════════════════════════════════════════════════════════════
// PersonalInfoPanel
// ═══════════════════════════════════════════════════════════════

function PersonalInfoPanel({ info, onChange }: { info: ReportPersonalInfo; onChange: (i: ReportPersonalInfo) => void }) {
  const [open, setOpen] = useState(true);
  const set = (k: keyof ReportPersonalInfo, v: string) => onChange({ ...info, [k]: v });
  const inputCls = "w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40";
  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden mb-4">
      <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2">
          <FileText className="w-4 h-4 text-teal-600" />
          <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>البيانات الأساسية</span>
        </div>
        {open ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
      </button>
      {open && (
        <div className="px-4 pb-4 border-t border-gray-100 pt-3">
          <p className="text-xs text-gray-500 mb-3">هذه البيانات ستظهر في رأس التقرير والملف المصدّر</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">معد التقرير</label>
              <input value={info.preparer} onChange={e => set("preparer", e.target.value)} placeholder="الاسم الكامل..." className={inputCls} /></div>
            <div><label className="block text-xs font-medium text-gray-600 mb-1.5">العام الدراسي</label>
              <input value={info.year} onChange={e => set("year", e.target.value)} placeholder="مثال: ١٤٤٧هـ" className={inputCls} /></div>
            <div className="sm:col-span-2">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">الجهة / الإدارة</label>
              <textarea value={info.department} onChange={e => set("department", e.target.value)} rows={3}
                placeholder="المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة..."
                className={inputCls + " resize-none"} />
              <p className="text-[10px] text-gray-400 mt-1">يظهر في رأس التقرير (سطر لكل مستوى)</p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// AttachmentPanel — PE-aligned: files, images, links + QR toggle
// ═══════════════════════════════════════════════════════════════

function AttachmentPanel({ attachments, onAdd, onRemove, onUpdate, disabled }: {
  attachments: ReportAttachment[]; onAdd: (a: ReportAttachment) => void;
  onRemove: (id: string) => void; onUpdate: (id: string, patch: Partial<ReportAttachment>) => void; disabled?: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > MAX_FILE_SIZE) { toast.error("حجم الملف يتجاوز 10MB"); e.target.value = ""; return; }
    if (attachments.length >= MAX_ATTACHMENTS) { toast.error(`الحد الأقصى ${MAX_ATTACHMENTS} مرفقات`); e.target.value = ""; return; }
    setUploading(true);
    try {
      const b64 = await new Promise<string>((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result as string); r.onerror = () => rej(r.error); r.readAsDataURL(file); });
      const id = genId(); const idbKey = `reportAttach_${id}`;
      await saveFileToIDB({ id: idbKey, data: b64, fileName: file.name, fileType: file.type, timestamp: Date.now() });
      const isImg = file.type.startsWith("image/");
      onAdd({ id, fileName: file.name, fileType: file.type, idbKey, displayAs: isImg ? "image" : "qr", showBarcode: true });
      toast.success("تم إضافة المرفق");
    } catch { toast.error("تعذر حفظ المرفق"); }
    finally { setUploading(false); e.target.value = ""; }
  };

  const handleLink = () => {
    if (!linkUrl.trim() || attachments.length >= MAX_ATTACHMENTS) return;
    onAdd({ id: genId(), fileName: linkTitle.trim() || linkUrl.trim(), fileType: "link", idbKey: "", displayAs: "qr", showBarcode: true, linkUrl: linkUrl.trim() });
    setLinkUrl(""); setLinkTitle(""); setShowLink(false); toast.success("تم إضافة الرابط");
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mt-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Paperclip className="w-4 h-4 text-gray-500" />
          <span className="text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>المرفقات</span>
          <span className="text-[10px] bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full">{attachments.length}/{MAX_ATTACHMENTS}</span>
        </div>
        <input type="file" ref={fileRef} className="hidden" accept="image/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleFile} />
        <div className="flex gap-1.5">
          <button onClick={() => fileRef.current?.click()} disabled={disabled || uploading || attachments.length >= MAX_ATTACHMENTS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-teal-300 text-teal-600 hover:bg-teal-50 text-xs font-medium transition-colors disabled:opacity-50">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            {uploading ? "جاري الرفع..." : "رفع ملف"}
          </button>
          <button onClick={() => setShowLink(!showLink)} disabled={attachments.length >= MAX_ATTACHMENTS}
            className="flex items-center gap-1.5 px-3 py-2 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 text-xs font-medium transition-colors disabled:opacity-50">
            <LinkIcon className="w-3.5 h-3.5" /> إضافة رابط
          </button>
        </div>
      </div>
      {showLink && (
        <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 space-y-2 mb-3">
          <input value={linkTitle} onChange={e => setLinkTitle(e.target.value)} placeholder="عنوان الرابط (اختياري)"
            className="w-full px-3 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white" />
          <div className="flex gap-2">
            <input type="url" value={linkUrl} onChange={e => setLinkUrl(e.target.value)} placeholder="https://..." dir="ltr"
              className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
              onKeyDown={e => { if (e.key === "Enter") handleLink(); }} />
            <button onClick={handleLink} className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700">إضافة</button>
            <button onClick={() => { setShowLink(false); setLinkUrl(""); setLinkTitle(""); }} className="p-2 rounded-lg bg-gray-100 text-gray-500 hover:bg-gray-200"><X className="w-4 h-4" /></button>
          </div>
        </div>
      )}
      {attachments.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3">لا توجد مرفقات — يمكنك إضافة صور أو ملفات أو روابط</p>
      ) : (
        <div className="space-y-2">
          {attachments.map(att => {
            const isImg = att.fileType.startsWith("image/");
            const isLink = att.fileType === "link";
            return (
              <div key={att.id} className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  {isLink ? <LinkIcon className="w-4 h-4 text-purple-500 shrink-0" /> : isImg ? <ImageIcon className="w-4 h-4 text-teal-500 shrink-0" /> : <FileText className="w-4 h-4 text-blue-500 shrink-0" />}
                  <span className="text-xs text-gray-700 truncate">{att.fileName}</span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {/* PE-style displayAs toggle for images */}
                  {isImg && (
                    <button onClick={() => onUpdate(att.id, { displayAs: att.displayAs === "image" ? "qr" : "image" })}
                      className={`p-1.5 rounded-lg text-xs ${att.displayAs === "qr" ? "bg-violet-100 text-violet-600" : "bg-blue-100 text-blue-600"}`}
                      title={att.displayAs === "image" ? "تحويل لباركود QR" : "عرض كصورة"}>
                      {att.displayAs === "image" ? <QrCode className="w-3.5 h-3.5" /> : <ImageIcon className="w-3.5 h-3.5" />}
                    </button>
                  )}
                  {/* PE-style showBarcode toggle */}
                  <button onClick={() => onUpdate(att.id, { showBarcode: !att.showBarcode })}
                    className={`p-1.5 rounded-lg text-[10px] ${att.showBarcode ? "bg-violet-100 text-violet-600" : "bg-gray-100 text-gray-400"}`}
                    title={att.showBarcode ? "الباركود مفعّل" : "الباركود معطّل"}>
                    <QrCode className="w-3 h-3" />
                  </button>
                  <button onClick={() => onRemove(att.id)} className="text-gray-400 hover:text-red-500 p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// ReportPreview — Memoized, PE-aligned A4 preview
// ═══════════════════════════════════════════════════════════════

interface PreviewProps {
  template: ReportTemplate; data: Record<string, string>; theme: ThemeConfig;
  fontFamily: string; personalInfo: ReportPersonalInfo;
  resolvedAttachments: { att: ReportAttachment; src: string | null }[];
}

const ReportPreview = React.memo(function ReportPreview({ template, data, theme, fontFamily, personalInfo, resolvedAttachments }: PreviewProps) {
  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });
  const deptLines = useMemo(() => (personalInfo.department || "").split("\n").filter(l => l.trim()), [personalInfo.department]);
  const hProps = useMemo(() => themeToHeader(theme), [theme]);

  return (
    <div className="bg-white shadow-lg" style={{ width: "210mm", minHeight: "297mm", fontFamily: `'${fontFamily}', sans-serif`, direction: "rtl", padding: 0 }}>
      <OfficialHeader deptLines={deptLines} logoUrl={MOE_LOGO} variant="full" pageTitle={template.title} {...hProps} />
      <div style={{ padding: "24px 32px" }}>
        {/* Summary Bar — ALL fields shown */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", marginBottom: "24px", padding: "12px 16px", backgroundColor: theme.primaryColor + "08", borderRadius: "8px", border: `1px solid ${theme.borderColor}` }}>
          <div style={{ flex: "1 1 auto", minWidth: "120px" }}><div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>معد التقرير</div><div style={{ fontSize: "13px", fontWeight: 600, color: personalInfo.preparer ? "#1f2937" : "#d1d5db" }}>{personalInfo.preparer || "لم يحدد"}</div></div>
          <div style={{ flex: "1 1 auto", minWidth: "120px" }}><div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>العام الدراسي</div><div style={{ fontSize: "13px", fontWeight: 600, color: personalInfo.year ? "#1f2937" : "#d1d5db" }}>{personalInfo.year || "لم يحدد"}</div></div>
          {template.fields.filter(f => f.type !== "textarea").map(f => (
            <div key={f.id} style={{ flex: "1 1 auto", minWidth: "120px" }}><div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>{f.label}</div><div style={{ fontSize: "13px", fontWeight: 600, color: data[f.id] ? "#1f2937" : "#d1d5db" }}>{data[f.id] || "لم يحدد"}</div></div>
          ))}
        </div>
        {/* Content Sections — ALL shown */}
        {template.fields.filter(f => f.type === "textarea").map(f => (
          <div key={f.id} style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}` }}>
              <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: theme.primaryColor }} />
              <h3 style={{ fontSize: "14px", fontWeight: 700, color: theme.primaryColor, margin: 0, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>{f.label}</h3>
            </div>
            <p style={{ fontSize: "13px", lineHeight: "1.8", color: data[f.id] ? "#374151" : "#d1d5db", margin: 0, whiteSpace: "pre-wrap", paddingRight: "14px", fontStyle: data[f.id] ? "normal" : "italic" }}>{data[f.id] || "لم يتم الإدخال بعد..."}</p>
          </div>
        ))}
        {/* Attachments — PE-exact rendering */}
        {resolvedAttachments.length > 0 && (
          <div style={{ marginTop: "24px", paddingTop: "16px", borderTop: `1px dashed ${theme.borderColor}` }}>
            <h3 style={{ fontSize: "13px", fontWeight: 700, color: theme.primaryColor, marginBottom: "12px", fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>المرفقات</h3>
            <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
              {resolvedAttachments.map(({ att, src }, idx) => {
                const isImg = att.fileType.startsWith("image/");
                const isLink = att.fileType === "link";
                return (
                  <div key={att.id} style={{ padding: "0.75rem", borderRadius: "8px", border: `1.5px solid ${theme.borderColor}`, borderRight: `4px solid ${theme.primaryColor}`, pageBreakInside: "avoid", backgroundColor: "#FAFBFC" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.5rem" }}>
                      <span style={{ fontSize: "0.65rem", fontWeight: 700, color: "#9CA3AF" }}>مرفق {idx + 1}</span>
                    </div>
                    {/* Link — same as PE ev.type==='link' */}
                    {isLink && att.linkUrl && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {att.showBarcode && <img src={generateQRDataURL(att.linkUrl)} alt="QR" style={{ width: "80px", height: "80px", borderRadius: "4px" }} />}
                        <div>
                          <span style={{ fontSize: "0.7rem", color: "#6B7280", display: "block" }}>رابط إلكتروني</span>
                          <span style={{ fontSize: "0.7rem", color: "#2563EB", wordBreak: "break-all" as const }}>{att.linkUrl}</span>
                        </div>
                      </div>
                    )}
                    {/* Image — same as PE ev.type==='image' */}
                    {isImg && src && att.displayAs === "image" && (
                      <img src={src} alt="" style={{ maxHeight: "200px", borderRadius: "8px", border: "1px solid #E5E7EB" }} />
                    )}
                    {isImg && att.displayAs === "qr" && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {att.showBarcode && <img src={generateQRDataURL(att.uploadedUrl || att.fileName || "file")} alt="QR" style={{ width: "80px", height: "80px", borderRadius: "4px" }} />}
                        <div>
                          <span style={{ fontSize: "0.7rem", color: "#6B7280", display: "block" }}>صورة {att.showBarcode ? "(باركود)" : ""}</span>
                          <span style={{ fontSize: "0.7rem", color: "#4B5563" }}>{att.fileName}</span>
                        </div>
                      </div>
                    )}
                    {/* File (PDF/doc/etc) — same as PE ev.type==='file' */}
                    {!isImg && !isLink && (
                      <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
                        {att.showBarcode && <img src={generateQRDataURL(att.uploadedUrl || att.fileName || "file")} alt="QR" style={{ width: "80px", height: "80px", borderRadius: "4px" }} />}
                        <div>
                          <span style={{ fontSize: "0.7rem", color: "#6B7280", display: "block" }}>ملف مرفق</span>
                          <span style={{ fontSize: "0.7rem", color: "#4B5563" }}>{att.fileName}</span>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
      {/* Footer */}
      <div style={{ borderTop: `2px solid ${theme.borderColor}`, padding: "12px 32px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af", marginTop: "auto" }}>
        <span>تم إنشاؤه بواسطة منصة SERS</span><span>{today}</span>
      </div>
    </div>
  );
});

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function ReportCenter() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"templates" | "editor" | "preview" | "saved">("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<ReportTemplate | null>(null);
  const [currentReport, setCurrentReport] = useState<SavedReport | null>(null);
  const [formData, setFormData] = useState<Record<string, string>>({});
  const [savedReports, setSavedReports] = useState<SavedReport[]>(loadReports);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>(THEMES[0]);
  const [selectedFont, setSelectedFont] = useState("Cairo");

  // Load custom report templates from DB
  const { data: customConfigs } = trpc.sectionConfigs.getActive.useQuery({ sectionId: "reports" });
  const allTemplates = useMemo(() => {
    const base = [...REPORT_TEMPLATES];
    if (customConfigs) {
      for (const cfg of customConfigs) {
        if (cfg.configType === "template" && cfg.data) {
          const d = cfg.data as Record<string, any>;
          const fields: ReportField[] = (d.fields || []).map((f: any) => ({
            id: f.id || "", label: f.label || "", type: f.type || "text",
            placeholder: f.placeholder, required: f.required, options: f.options,
          }));
          base.push({
            id: `custom-${cfg.id}`, title: cfg.name, description: cfg.description || "",
            icon: Edit3, color: d.color || "#64748b", fields, isCustom: true,
          });
        }
      }
    }
    return base;
  }, [customConfigs]);
  // Zustand: shared personalInfo across all sections
  const storePI = useUserStore((s) => s.personalInfo);
  const setStorePI = useUserStore((s) => s.setPersonalInfo);
  const [personalInfo, setPersonalInfoLocal] = useState<ReportPersonalInfo>(() => ({
    department: storePI.department || DEFAULT_PERSONAL.department,
    year: storePI.year || DEFAULT_PERSONAL.year,
    preparer: storePI.preparer || DEFAULT_PERSONAL.preparer,
  }));
  // Sync local → global store on change
  const setPersonalInfo = useCallback((val: ReportPersonalInfo | ((prev: ReportPersonalInfo) => ReportPersonalInfo)) => {
    setPersonalInfoLocal((prev) => {
      const next = typeof val === 'function' ? val(prev) : val;
      setStorePI(next);
      return next;
    });
  }, [setStorePI]);
  const [attachments, setAttachments] = useState<ReportAttachment[]>([]);
  const [resolvedAtts, setResolvedAtts] = useState<{ att: ReportAttachment; src: string | null }[]>([]);
  const [wasExported, setWasExported] = useState(false);
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [statusCache] = useState(() => {
    const m = new Map<string, ReportStatus>();
    const reps = loadReports();
    reps.forEach(r => { const t = allTemplates.find(x => x.id === r.templateId); if (t) m.set(r.id, computeStatus(t, r.data, r.wasExported)); });
    return m;
  });

  const { containerRef: pvRef, pageRef: pvPage, previewScale, wrapperWidth, wrapperHeight, zoomLevel, zoomIn, zoomOut, resetZoom } = usePreviewScale();
  const fillMut = trpc.genAI.fillReport.useMutation();

  // Resolve attachment images from IDB
  useEffect(() => {
    let c = false;
    (async () => {
      const res: { att: ReportAttachment; src: string | null }[] = [];
      for (const att of attachments) {
        if (att.fileType === "link" || !att.idbKey) { res.push({ att, src: null }); continue; }
        try { const f = await getFileFromIDB(att.idbKey); res.push({ att, src: f?.data || null }); }
        catch { res.push({ att, src: null }); }
      }
      if (!c) setResolvedAtts(res);
    })();
    return () => { c = true; };
  }, [attachments]);

  const memoPI = useMemo(() => personalInfo, [personalInfo.department, personalInfo.year, personalInfo.preparer]); // eslint-disable-line

  const startNew = useCallback((t: ReportTemplate) => {
    setSelectedTemplate(t); setFormData({}); setCurrentReport(null);
    setAttachments([]); setWasExported(false); setPersonalInfo({ ...DEFAULT_PERSONAL }); setView("editor");
  }, []);

  const editReport = useCallback((r: SavedReport) => {
    const t = allTemplates.find(x => x.id === r.templateId); if (!t) return;
    setSelectedTemplate(t); setFormData(r.data); setCurrentReport(r);
    setAttachments(r.attachments); setWasExported(r.wasExported); setPersonalInfo(r.personalInfo);
    const th = THEMES.find(x => x.id === r.themeId); if (th) setSelectedTheme(th);
    if (r.fontFamily) setSelectedFont(r.fontFamily); setView("editor");
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedTemplate) return;
    const title = formData.title || formData.subject || formData.teacherName || formData.school || formData.deptName || selectedTemplate.title;
    const now = Date.now(); const st = computeStatus(selectedTemplate, formData, wasExported);
    if (currentReport) {
      const u: SavedReport = { ...currentReport, title, data: formData, themeId: selectedTheme.id, fontFamily: selectedFont, updatedAt: now, wasExported, attachments, personalInfo };
      const all = savedReports.map(r => r.id === currentReport.id ? u : r);
      setSavedReports(all); saveReportsLS(all); setCurrentReport(u); statusCache.set(currentReport.id, st); toast.success("تم تحديث التقرير");
    } else {
      const n: SavedReport = { id: genId(), templateId: selectedTemplate.id, title, data: formData, themeId: selectedTheme.id, fontFamily: selectedFont, createdAt: now, updatedAt: now, wasExported, attachments, personalInfo };
      const all = [n, ...savedReports]; setSavedReports(all); saveReportsLS(all); setCurrentReport(n); statusCache.set(n.id, st); toast.success("تم حفظ التقرير");
    }
  }, [selectedTemplate, formData, currentReport, savedReports, selectedTheme, selectedFont, wasExported, attachments, personalInfo, statusCache]);

  const handleDelete = useCallback(async (id: string) => {
    const r = savedReports.find(x => x.id === id);
    if (r) for (const a of r.attachments) { try { if (a.idbKey) await deleteFileFromIDB(a.idbKey); } catch { /* skip */ } }
    const all = savedReports.filter(x => x.id !== id); setSavedReports(all); saveReportsLS(all); statusCache.delete(id); toast.success("تم حذف التقرير");
  }, [savedReports, statusCache]);

  const onAddAtt = useCallback((a: ReportAttachment) => setAttachments(p => [...p, a]), []);
  const onRemoveAtt = useCallback(async (id: string) => {
    const a = attachments.find(x => x.id === id);
    if (a?.idbKey) { try { await deleteFileFromIDB(a.idbKey); } catch { /* skip */ } }
    setAttachments(p => p.filter(x => x.id !== id));
  }, [attachments]);
  const onUpdateAtt = useCallback((id: string, patch: Partial<ReportAttachment>) => {
    setAttachments(p => p.map(a => a.id === id ? { ...a, ...patch } : a));
  }, []);

  const handleAI = useCallback(async () => {
    if (!selectedTemplate) return; setAiLoading(true);
    try {
      const res = await fillMut.mutateAsync({ templateName: selectedTemplate.title, fields: selectedTemplate.fields.map(f => ({ id: f.id, label: f.label, type: f.type })), context: Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || undefined });
      if (res.success && res.filledData) { setFormData(p => { const m = { ...p }; for (const [k, v] of Object.entries(res.filledData)) { if (!m[k]?.trim()) m[k] = v as string; } return m; }); toast.success("تم التعبئة بالذكاء الاصطناعي"); }
      else toast.error("لم تنجح التعبئة");
    } catch { toast.error("حدث خطأ أثناء التعبئة"); } finally { setAiLoading(false); }
  }, [selectedTemplate, formData, fillMut]);

  const handleExport = useCallback(async () => {
    setExporting(true);
    try { await exportToPDF("report-preview-content", `${selectedTemplate?.title || "تقرير"}.pdf`); setWasExported(true); toast.success("تم تصدير PDF"); }
    catch { toast.error("خطأ أثناء التصدير"); } finally { setExporting(false); }
  }, [selectedTemplate]);

  const handlePrint = useCallback(() => { try { printElement("report-preview-content"); } catch { toast.error("خطأ أثناء الطباعة"); } }, []);

  const filtered = useMemo(() => {
    if (!searchQuery.trim()) return savedReports;
    const q = searchQuery.toLowerCase();
    return savedReports.filter(r => r.title.toLowerCase().includes(q) || r.templateId.includes(q));
  }, [savedReports, searchQuery]);

  const filled = selectedTemplate ? selectedTemplate.fields.filter(f => formData[f.id]?.trim()).length : 0;

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-[#F8FAFC]" dir="rtl">
      {/* Header */}
      <div className="w-full bg-gradient-to-l from-teal-700 via-teal-600 to-emerald-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center"><FileText className="w-7 h-7 text-white" /></div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>مركز التقارير</h1>
              <p className="text-white/80 text-sm mt-1">إنشاء وإدارة التقارير التعليمية والإدارية مع دعم الذكاء الاصطناعي</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {[{ id: "templates" as const, label: "القوالب", icon: BookOpen }, { id: "saved" as const, label: `المحفوظة (${savedReports.length})`, icon: FileText }].map(tab => {
              const TI = tab.icon; const active = view === tab.id || ((view === "editor" || view === "preview") && tab.id === "templates");
              return <button key={tab.id} onClick={() => setView(tab.id)} className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${active ? "bg-white text-teal-700" : "bg-white/15 text-white hover:bg-white/25"}`}><TI className="w-4 h-4" /> {tab.label}</button>;
            })}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {/* Templates */}
        {view === "templates" && (
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>اختر نوع التقرير</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {allTemplates.map(t => {
                const TI = t.icon; return (
                  <button key={t.id} onClick={() => startNew(t)} className="bg-white rounded-xl border border-gray-100 p-5 text-right transition-all hover:shadow-md hover:border-gray-200 group">
                    <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: t.color + "12" }}><TI className="w-6 h-6" style={{ color: t.color }} /></div>
                    <h3 className="font-bold text-gray-800 text-sm mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>{t.title}</h3>
                    <p className="text-xs text-gray-500 leading-relaxed">{t.description}</p>
                    <div className="mt-3 flex items-center justify-between"><span className="text-xs text-gray-400">{t.fields.length} حقل</span><span className="text-xs font-medium flex items-center gap-1" style={{ color: t.color }}><Plus className="w-3 h-3" /> إنشاء</span></div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Editor */}
        {view === "editor" && selectedTemplate && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <button onClick={() => setView("templates")} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>{selectedTemplate.title}</h2>
                <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{filled}/{selectedTemplate.fields.length}</span>
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                <Button onClick={handleAI} variant="outline" size="sm" disabled={aiLoading} className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50">
                  {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />} {aiLoading ? "جاري التوليد..." : "تعبئة بالذكاء الاصطناعي"}
                </Button>
                <Button onClick={handleSave} variant="outline" size="sm" className="gap-1"><Save className="w-4 h-4" /> حفظ</Button>
                <Button onClick={() => setView("preview")} size="sm" className="gap-1.5 bg-teal-600 hover:bg-teal-700 text-white"><Eye className="w-4 h-4" /> معاينة وتصدير</Button>
              </div>
            </div>
            <div className="max-w-3xl mx-auto">
              <PersonalInfoPanel info={personalInfo} onChange={setPersonalInfo} />
              <div className="mb-4"><TemplateSelector selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} selectedFont={selectedFont} onFontChange={setSelectedFont} compact /></div>
              <div className="bg-white rounded-xl border border-gray-200 p-4 sm:p-6">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  {selectedTemplate.fields.map(f => (
                    <div key={f.id} className={f.type === "textarea" ? "sm:col-span-2" : ""}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">{f.label} {f.required && <span className="text-red-500">*</span>}</label>
                      {f.type === "textarea" ? <textarea value={formData[f.id] || ""} onChange={e => setFormData({ ...formData, [f.id]: e.target.value })} placeholder={f.placeholder} rows={4} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-y" style={{ fontFamily: `'${selectedFont}', sans-serif` }} />
                      : f.type === "select" ? <select value={formData[f.id] || ""} onChange={e => setFormData({ ...formData, [f.id]: e.target.value })} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"><option value="">اختر...</option>{f.options?.map(o => <option key={o} value={o}>{o}</option>)}</select>
                      : <input type={f.type === "number" ? "number" : "text"} value={formData[f.id] || ""} onChange={e => setFormData({ ...formData, [f.id]: e.target.value })} placeholder={f.placeholder} className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400" />}
                    </div>
                  ))}
                </div>
              </div>
              <AttachmentPanel attachments={attachments} onAdd={onAddAtt} onRemove={onRemoveAtt} onUpdate={onUpdateAtt} />
              {/* Tip */}
              <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-start gap-2">
                <Sparkles className="w-4 h-4 shrink-0 mt-0.5" />
                <span>جميع البيانات التي تدخلها ستظهر تلقائياً في المعاينة والتصدير. يمكنك استخدام التعبئة بالذكاء الاصطناعي لملء الحقول تلقائياً.</span>
              </div>
            </div>
          </div>
        )}

        {/* Preview */}
        {view === "preview" && selectedTemplate && (
          <div className={fullscreen ? "fixed inset-0 z-50 bg-gray-100 overflow-auto" : ""}>
            <div className={`bg-white border-b border-gray-200 ${fullscreen ? "sticky top-0 z-10 shadow-sm" : "rounded-t-xl border border-gray-200"}`}>
              <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2">
                <div className="flex items-center gap-2 sm:gap-3">
                  <button onClick={() => { setView("editor"); setFullscreen(false); }} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
                  <Eye className="w-4 h-4 text-teal-500 hidden sm:block" />
                  <span className="text-xs sm:text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة التقرير</span>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2">
                  <Button size="sm" onClick={handleExport} disabled={exporting} className="gap-1 text-xs h-8 sm:h-9 bg-teal-600 hover:bg-teal-700 text-white">
                    {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                    <span className="hidden sm:inline">{exporting ? "جاري التصدير..." : "تصدير PDF"}</span><span className="sm:hidden">PDF</span>
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="p-1.5 h-8 sm:h-9">
                    {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
              <div className="flex items-center gap-1.5 px-3 sm:px-4 pb-2 sm:pb-3 overflow-x-auto" style={{ scrollbarWidth: "none" }}>
                <div className="flex items-center gap-0.5 bg-white/90 border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 shrink-0">
                  <button onClick={zoomOut} className="p-1.5 hover:bg-gray-100 rounded-md"><ZoomOut className="w-3.5 h-3.5 text-gray-600" /></button>
                  <div className="px-1.5 min-w-[2.5rem] text-center"><span className="text-[10px] font-mono text-gray-700 font-medium">{zoomLevel}%</span></div>
                  <button onClick={zoomIn} className="p-1.5 hover:bg-gray-100 rounded-md"><ZoomIn className="w-3.5 h-3.5 text-gray-600" /></button>
                  <div className="w-px h-4 bg-gray-200 mx-0.5" />
                  <button onClick={resetZoom} className="p-1.5 hover:bg-gray-100 rounded-md"><RotateCcw className="w-3 h-3 text-gray-500" /></button>
                </div>
                <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-xs h-8 shrink-0"><Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">طباعة</span></Button>
              </div>
            </div>
            <div ref={pvRef} className={`bg-gray-200 overflow-auto ${fullscreen ? "h-[calc(100vh-52px)]" : "max-h-[75vh] rounded-b-xl border-x border-b border-gray-200"}`} style={{ padding: "8px 4px", minHeight: "200px" }}>
              <div style={{ width: `${wrapperWidth}px`, height: `${wrapperHeight}px`, margin: "0 auto", position: "relative", overflow: "hidden" }}>
                <div style={{ width: `${A4_WIDTH_PX}px`, transformOrigin: "top right", transform: `scale(${previewScale})`, transition: "transform 0.15s ease-out" }}>
                  <div id="report-preview-content" ref={pvPage} style={{ fontFamily: "'Cairo', sans-serif", direction: "rtl", width: "210mm" }}>
                    <ReportPreview template={selectedTemplate} data={formData} theme={selectedTheme} fontFamily={selectedFont} personalInfo={memoPI} resolvedAttachments={resolvedAtts} />
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Saved Reports */}
        {view === "saved" && (
          <div>
            <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>التقارير المحفوظة</h2>
              <div className="relative w-64">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input type="text" placeholder="بحث..." value={searchQuery} onChange={e => setSearchQuery(e.target.value)} className="w-full pr-10 pl-4 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
              </div>
            </div>
            {filtered.length === 0 ? (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 font-medium">لا توجد تقارير محفوظة</p>
                <Button onClick={() => setView("templates")} variant="outline" size="sm" className="mt-3 gap-1"><Plus className="w-4 h-4" /> إنشاء تقرير جديد</Button>
              </div>
            ) : (
              <div className="space-y-3">
                {filtered.map(r => {
                  const t = allTemplates.find(x => x.id === r.templateId);
                  const RI = t?.icon || FileText; const col = t?.color || "#64748b";
                  const th = THEMES.find(x => x.id === r.themeId);
                  const st = statusCache.get(r.id) || "draft"; const sc = STATUS_CFG[st]; const SI = sc.Icon;
                  const fc = t ? t.fields.filter(f => r.data[f.id]?.trim()).length : 0;
                  const tc = t?.fields.length || 1;
                  return (
                    <div key={r.id} className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between group hover:shadow-sm transition-shadow">
                      <div className="flex items-center gap-4 min-w-0">
                        <div className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: col + "12" }}><RI className="w-5 h-5" style={{ color: col }} /></div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 mb-0.5">
                            <h3 className="font-bold text-gray-800 text-sm truncate">{r.title}</h3>
                            <span className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${sc.bg} ${sc.tx}`}><SI className="w-3 h-3" />{sc.label}</span>
                          </div>
                          <p className="text-xs text-gray-400 flex items-center gap-2 flex-wrap">
                            <span>{t?.title}</span><span>·</span><span>{new Date(r.updatedAt).toLocaleDateString("ar-SA")}</span>
                            <span>·</span><span>{fc}/{tc} حقل</span>
                            {r.attachments.length > 0 && <><span>·</span><span className="flex items-center gap-0.5"><Paperclip className="w-3 h-3" />{r.attachments.length}</span></>}
                            {th && <><span>·</span><span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full" style={{ backgroundColor: th.primaryColor }} />{th.name}</span></>}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity shrink-0">
                        <Button onClick={() => editReport(r)} variant="outline" size="sm" className="gap-1"><Edit3 className="w-3 h-3" /> تعديل</Button>
                        <Button onClick={() => handleDelete(r.id)} variant="outline" size="sm" className="gap-1 text-red-500 hover:text-red-600"><Trash2 className="w-3 h-3" /> حذف</Button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
