/**
 * مركز التقارير الشامل - SERS
 * يتيح إنشاء تقارير متنوعة مع:
 * - تعبئة بالذكاء الاصطناعي
 * - معاينة حية بتصميم احترافي
 * - تصدير PDF
 * - 6 ثيمات/قوالب مختلفة
 * - اختيار الخط
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, FileText, Plus, Trash2, Download, Eye, Save,
  Users, Building2, BookOpen, Star, Search, X, Edit3,
  Sparkles, Loader2, Printer, FileDown, Maximize2, Minimize2,
  ClipboardCheck, ChevronLeft, ZoomIn, ZoomOut, RotateCcw, AlertTriangle
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import TemplateSelector, { THEMES, FONT_OPTIONS, type ThemeConfig } from "@/components/TemplateSelector";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import OfficialHeader from "@/components/OfficialHeader";
import { usePreviewScale } from "@/hooks/usePreviewScale";

const A4_WIDTH_PX = 793.7;

// ═══════════════════════════════════════════════════════════════
// Types & Data
// ═══════════════════════════════════════════════════════════════

type ReportType = "student-performance" | "teacher-activity" | "admin-weekly" | "department" | "custom";

interface ReportField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number";
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface ReportTemplate {
  id: ReportType;
  title: string;
  description: string;
  icon: React.ComponentType<any>;
  color: string;
  fields: ReportField[];
}

interface SavedReport {
  id: string;
  templateId: ReportType;
  title: string;
  data: Record<string, string>;
  themeId: string;
  fontFamily: string;
  createdAt: number;
  updatedAt: number;
}

const REPORT_TEMPLATES: ReportTemplate[] = [
  {
    id: "student-performance",
    title: "تقرير أداء الطلاب",
    description: "تقرير شامل عن مستوى أداء الطلاب في المادة",
    icon: Users,
    color: "#0d9488",
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
    ],
  },
  {
    id: "teacher-activity",
    title: "تقرير النشاط المهني",
    description: "توثيق الأنشطة والإنجازات المهنية للمعلم",
    icon: Star,
    color: "#7c3aed",
    fields: [
      { id: "teacherName", label: "اسم المعلم", type: "text", required: true },
      { id: "period", label: "الفترة", type: "text", placeholder: "من - إلى" },
      { id: "trainings", label: "الدورات التدريبية", type: "textarea", placeholder: "الدورات التي حضرها أو قدمها..." },
      { id: "activities", label: "الأنشطة المنفذة", type: "textarea", placeholder: "الأنشطة الصفية واللاصفية..." },
      { id: "innovations", label: "المبادرات والابتكارات", type: "textarea", placeholder: "أي مبادرات أو أفكار إبداعية..." },
      { id: "challenges", label: "التحديات", type: "textarea", placeholder: "التحديات التي واجهها..." },
      { id: "goals", label: "الأهداف المستقبلية", type: "textarea", placeholder: "الأهداف للفترة القادمة..." },
    ],
  },
  {
    id: "admin-weekly",
    title: "التقرير الإداري الأسبوعي",
    description: "تقرير أسبوعي عن سير العمل في المدرسة",
    icon: Building2,
    color: "#ea580c",
    fields: [
      { id: "school", label: "المدرسة", type: "text", required: true },
      { id: "weekDate", label: "الأسبوع", type: "text", placeholder: "من الأحد XX إلى الخميس XX" },
      { id: "attendance", label: "نسبة الحضور", type: "text", placeholder: "95%" },
      { id: "events", label: "الفعاليات والأنشطة", type: "textarea", placeholder: "الفعاليات التي تمت خلال الأسبوع..." },
      { id: "issues", label: "الملاحظات والمشكلات", type: "textarea", placeholder: "أي ملاحظات أو مشكلات..." },
      { id: "decisions", label: "القرارات المتخذة", type: "textarea", placeholder: "القرارات الإدارية..." },
      { id: "nextWeek", label: "خطة الأسبوع القادم", type: "textarea", placeholder: "ما هو مخطط للأسبوع القادم..." },
    ],
  },
  {
    id: "department",
    title: "تقرير القسم / الشعبة",
    description: "تقرير دوري عن أداء القسم التعليمي",
    icon: BookOpen,
    color: "#2563eb",
    fields: [
      { id: "deptName", label: "اسم القسم", type: "text", required: true },
      { id: "head", label: "رئيس القسم", type: "text" },
      { id: "period", label: "الفترة", type: "text", placeholder: "الفصل الدراسي / الشهر" },
      { id: "teacherCount", label: "عدد المعلمين", type: "number" },
      { id: "meetings", label: "الاجتماعات المنعقدة", type: "textarea", placeholder: "ملخص الاجتماعات..." },
      { id: "achievements", label: "الإنجازات", type: "textarea", placeholder: "إنجازات القسم..." },
      { id: "plans", label: "الخطط المستقبلية", type: "textarea", placeholder: "خطط القسم القادمة..." },
    ],
  },
  {
    id: "custom",
    title: "تقرير مخصص",
    description: "إنشاء تقرير بحقول مخصصة حسب الحاجة",
    icon: Edit3,
    color: "#64748b",
    fields: [
      { id: "title", label: "عنوان التقرير", type: "text", required: true },
      { id: "date", label: "التاريخ", type: "text" },
      { id: "content", label: "المحتوى", type: "textarea", placeholder: "اكتب محتوى التقرير هنا..." },
      { id: "notes", label: "ملاحظات", type: "textarea" },
    ],
  },
];

const STORAGE_KEY = "sers-reports";
function loadReports(): SavedReport[] {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {} return [];
}
function saveReportsToStorage(reports: SavedReport[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(reports));
}
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ═══════════════════════════════════════════════════════════════
// Preview Component - معاينة التقرير بتصميم احترافي
// ═══════════════════════════════════════════════════════════════

function ReportPreview({
  template, data, theme, fontFamily,
}: {
  template: ReportTemplate;
  data: Record<string, string>;
  theme: ThemeConfig;
  fontFamily: string;
}) {
  const Icon = template.icon;
  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div
      className="bg-white shadow-lg"
      style={{
        width: "210mm",
        minHeight: "297mm",
        fontFamily: `'${fontFamily}', sans-serif`,
        direction: "rtl",
        padding: "0",
      }}
    >
      {/* Header */}
      <div
        data-pdf-header
        style={{
          background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
          color: theme.headerText,
          padding: "24px 32px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: "800", margin: "0 0 4px 0", fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {template.title}
            </h1>
            <p style={{ fontSize: "12px", opacity: 0.85, margin: 0 }}>
              نظام السجلات التعليمية الذكي - SERS
            </p>
          </div>
          <div style={{ textAlign: "left", fontSize: "11px", opacity: 0.8 }}>
            <div>{today}</div>
            <div style={{ marginTop: "4px" }}>
              {data.year || data.period || data.weekDate || ""}
            </div>
          </div>
        </div>
      </div>

      {/* Body */}
      <div style={{ padding: "24px 32px" }}>
        {/* Info Summary Bar */}
        <div
          style={{
            display: "flex",
            gap: "12px",
            flexWrap: "wrap",
            marginBottom: "24px",
            padding: "12px 16px",
            backgroundColor: theme.primaryColor + "08",
            borderRadius: "8px",
            border: `1px solid ${theme.borderColor}`,
          }}
        >
          {template.fields
            .filter((f) => f.type !== "textarea" && data[f.id])
            .map((field) => (
              <div key={field.id} style={{ flex: "1 1 auto", minWidth: "120px" }}>
                <div style={{ fontSize: "10px", color: "#6b7280", marginBottom: "2px" }}>{field.label}</div>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#1f2937" }}>{data[field.id]}</div>
              </div>
            ))}
        </div>

        {/* Content Sections */}
        {template.fields
          .filter((f) => f.type === "textarea" && data[f.id])
          .map((field, idx) => (
            <div key={field.id} style={{ marginBottom: "20px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  marginBottom: "8px",
                  paddingBottom: "6px",
                  borderBottom: `2px solid ${theme.borderColor}`,
                }}
              >
                <div
                  style={{
                    width: "6px",
                    height: "6px",
                    borderRadius: "50%",
                    backgroundColor: theme.primaryColor,
                  }}
                />
                <h3
                  data-pdf-accent
                  style={{
                    fontSize: "14px",
                    fontWeight: "700",
                    color: theme.primaryColor,
                    margin: 0,
                    fontFamily: `'Tajawal', '${fontFamily}', sans-serif`,
                  }}
                >
                  {field.label}
                </h3>
              </div>
              <p
                style={{
                  fontSize: "13px",
                  lineHeight: "1.8",
                  color: "#374151",
                  margin: 0,
                  whiteSpace: "pre-wrap",
                  paddingRight: "14px",
                }}
              >
                {data[field.id]}
              </p>
            </div>
          ))}

        {/* Empty state */}
        {template.fields.filter((f) => f.type === "textarea" && data[f.id]).length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
            <p style={{ fontSize: "14px" }}>لم يتم إدخال محتوى بعد</p>
            <p style={{ fontSize: "12px" }}>قم بملء الحقول أو استخدم التعبئة بالذكاء الاصطناعي</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div
        style={{
          borderTop: `2px solid ${theme.borderColor}`,
          padding: "12px 32px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          fontSize: "10px",
          color: "#9ca3af",
          marginTop: "auto",
        }}
      >
        <span>تم إنشاؤه بواسطة منصة SERS</span>
        <span>{today}</span>
      </div>
    </div>
  );
}

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
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { containerRef: previewContainerRef, pageRef: previewPageRef, previewScale, wrapperWidth, wrapperHeight, zoomLevel, zoomIn, zoomOut, resetZoom } = usePreviewScale();

  const fillReportMutation = trpc.genAI.fillReport.useMutation();

  const startNewReport = useCallback((template: ReportTemplate) => {
    setSelectedTemplate(template);
    setFormData({});
    setCurrentReport(null);
    setView("editor");
  }, []);

  const editReport = useCallback((report: SavedReport) => {
    const template = REPORT_TEMPLATES.find((t) => t.id === report.templateId);
    if (!template) return;
    setSelectedTemplate(template);
    setFormData(report.data);
    setCurrentReport(report);
    const theme = THEMES.find((t) => t.id === report.themeId);
    if (theme) setSelectedTheme(theme);
    if (report.fontFamily) setSelectedFont(report.fontFamily);
    setView("editor");
  }, []);

  const handleSave = useCallback(() => {
    if (!selectedTemplate) return;
    const missing = selectedTemplate.fields.filter((field) => field.required && !formData[field.id]?.trim());
    if (missing.length) {
      toast.error(`أكمل الحقول الإلزامية: ${missing.map((field) => field.label).join("، ")}`);
      return;
    }
    const title = formData.title || formData.subject || formData.teacherName || formData.school || formData.deptName || selectedTemplate.title;
    const now = Date.now();

    if (currentReport) {
      const updated = savedReports.map((r) =>
        r.id === currentReport.id ? { ...r, title, data: formData, themeId: selectedTheme.id, fontFamily: selectedFont, updatedAt: now } : r
      );
      setSavedReports(updated);
      saveReportsToStorage(updated);
      setCurrentReport({ ...currentReport, title, data: formData, themeId: selectedTheme.id, fontFamily: selectedFont, updatedAt: now });
      toast.success("تم تحديث التقرير بنجاح");
    } else {
      const newReport: SavedReport = {
        id: generateId(), templateId: selectedTemplate.id, title, data: formData,
        themeId: selectedTheme.id, fontFamily: selectedFont, createdAt: now, updatedAt: now,
      };
      const updated = [newReport, ...savedReports];
      setSavedReports(updated);
      saveReportsToStorage(updated);
      setCurrentReport(newReport);
      toast.success("تم حفظ التقرير بنجاح");
    }
  }, [selectedTemplate, formData, currentReport, savedReports, selectedTheme, selectedFont]);

  const handleDelete = useCallback((id: string) => {
    const updated = savedReports.filter((r) => r.id !== id);
    setSavedReports(updated);
    saveReportsToStorage(updated);
    toast.success("تم حذف التقرير");
  }, [savedReports]);

  const handleAIFill = useCallback(async () => {
    if (!selectedTemplate) return;
    setAiLoading(true);
    try {
      const result = await fillReportMutation.mutateAsync({
        templateName: selectedTemplate.title,
        fields: selectedTemplate.fields.map((f) => ({ id: f.id, label: f.label, type: f.type })),
        context: Object.entries(formData).filter(([, v]) => v).map(([k, v]) => `${k}: ${v}`).join("\n") || undefined,
      });
      if (result.success && result.filledData) {
        setFormData((prev) => {
          const merged = { ...prev };
          for (const [key, value] of Object.entries(result.filledData)) {
            if (!merged[key] || merged[key].trim() === "") {
              merged[key] = value as string;
            }
          }
          return merged;
        });
        toast.success("تم التعبئة بالذكاء الاصطناعي بنجاح");
      } else {
        toast.error("لم تنجح التعبئة، حاول مرة أخرى");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء التعبئة بالذكاء الاصطناعي");
    } finally {
      setAiLoading(false);
    }
  }, [selectedTemplate, formData, fillReportMutation]);

  const handleExportPDF = useCallback(async () => {
    if (selectedTemplate) {
      const missing = selectedTemplate.fields.filter((field) => field.required && !formData[field.id]?.trim());
      if (missing.length) {
        toast.error(`لا يمكن التصدير قبل إكمال: ${missing.map((field) => field.label).join("، ")}`);
        return;
      }
    }
    setExporting(true);
    try {
      await exportToPDF("report-preview-content", `${selectedTemplate?.title || "تقرير"}.pdf`);
      toast.success("تم تصدير PDF بنجاح");
    } catch (err) {
      toast.error("حدث خطأ أثناء التصدير");
    } finally {
      setExporting(false);
    }
  }, [selectedTemplate, formData]);

  const handlePrint = useCallback(() => {
    try { printElement("report-preview-content"); } catch { toast.error("حدث خطأ أثناء الطباعة"); }
  }, []);

  const filteredReports = useMemo(() => {
    if (!searchQuery.trim()) return savedReports;
    const q = searchQuery.toLowerCase();
    return savedReports.filter((r) => r.title.toLowerCase().includes(q) || r.templateId.includes(q));
  }, [savedReports, searchQuery]);

  const filledFieldsCount = selectedTemplate
    ? selectedTemplate.fields.filter((f) => formData[f.id] && formData[f.id].trim() !== "").length
    : 0;
  const missingRequiredFields = selectedTemplate
    ? selectedTemplate.fields.filter((field) => field.required && !formData[field.id]?.trim())
    : [];

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-[#F8FAFC]" dir="rtl">
      {/* Header */}
      <div className="w-full bg-gradient-to-l from-teal-700 via-teal-600 to-emerald-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" />
            <span className="text-sm">العودة للرئيسية</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <FileText className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                مركز التقارير
              </h1>
              <p className="text-white/80 text-sm mt-1">إنشاء وإدارة التقارير التعليمية والإدارية مع دعم الذكاء الاصطناعي</p>
            </div>
          </div>
          <div className="flex items-center gap-2 mt-4 flex-wrap">
            {[
              { id: "templates" as const, label: "قوالب جديدة", icon: Plus },
              { id: "saved" as const, label: `المحفوظة (${savedReports.length})`, icon: FileText },
            ].map((tab) => {
              const Icon = tab.icon;
              const isActive = view === tab.id || (view === "editor" && tab.id === "templates") || (view === "preview" && tab.id === "templates");
              return (
                <button key={tab.id} onClick={() => setView(tab.id)}
                  className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? "bg-white text-teal-700" : "bg-white/15 text-white hover:bg-white/25"}`}>
                  <Icon className="w-4 h-4" /> {tab.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <>
          {/* ═══ Templates View ═══ */}
          {view === "templates" && (
            <div key="templates">
              <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>اختر نوع التقرير</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {REPORT_TEMPLATES.map((template) => {
                  const Icon = template.icon;
                  return (
                    <button key={template.id}
                      onClick={() => startNewReport(template)} className="bg-white rounded-xl border border-gray-100 p-5 text-right transition-all group">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-3" style={{ backgroundColor: template.color + "12" }}>
                        <Icon className="w-6 h-6" style={{ color: template.color }} />
                      </div>
                      <h3 className="font-bold text-gray-800 text-sm mb-1 group-hover:text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>{template.title}</h3>
                      <p className="text-xs text-gray-500 leading-relaxed">{template.description}</p>
                      <div className="mt-3 flex items-center justify-between">
                        <span className="text-xs text-gray-400">{template.fields.length} حقل</span>
                        <span className="text-xs font-medium flex items-center gap-1" style={{ color: template.color }}>
                          <Plus className="w-3 h-3" /> إنشاء
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* ═══ Editor View ═══ */}
          {view === "editor" && selectedTemplate && (
            <div key="editor">
              {/* Toolbar */}
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <div className="flex items-center gap-3">
                  <button onClick={() => setView("templates")} className="text-gray-400 hover:text-gray-600">
                    <ArrowLeft className="w-5 h-5" />
                  </button>
                  <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>{selectedTemplate.title}</h2>
                  <span className="text-xs bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full">{filledFieldsCount}/{selectedTemplate.fields.length} حقل</span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={handleAIFill} variant="outline" size="sm" disabled={aiLoading}
                    className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? "جاري التوليد..." : "تعبئة بالذكاء الاصطناعي"}
                  </Button>
                  <Button onClick={handleSave} variant="outline" size="sm" className="gap-1">
                    <Save className="w-4 h-4" /> حفظ
                  </Button>
                  <Button onClick={() => setView("preview")} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white">
                    <Eye className="w-4 h-4" /> معاينة وتصدير
                  </Button>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="mb-4">
                <TemplateSelector
                  selectedTheme={selectedTheme}
                  onThemeChange={setSelectedTheme}
                  selectedFont={selectedFont}
                  onFontChange={setSelectedFont}
                  compact
                />
              </div>

              {missingRequiredFields.length > 0 && (
                <div className="mb-4 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs text-amber-800">
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
                  <span>قبل الحفظ أو التصدير، أكمل الحقول الإلزامية التالية: <strong>{missingRequiredFields.map((field) => field.label).join("، ")}</strong>.</span>
                </div>
              )}

              {/* Form Fields */}
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {selectedTemplate.fields.map((field) => (
                    <div key={field.id} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                      <label className="block text-xs font-medium text-gray-600 mb-1.5">
                        {field.label} {field.required && <span className="text-red-500">*</span>}
                      </label>
                      {field.type === "textarea" ? (
                        <textarea
                          value={formData[field.id] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          rows={4}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all resize-y"
                          style={{ fontFamily: `'${selectedFont}', sans-serif` }}
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={formData[field.id] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white"
                        >
                          <option value="">اختر...</option>
                          {field.options?.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type === "number" ? "number" : "text"}
                          value={formData[field.id] || ""}
                          onChange={(e) => setFormData({ ...formData, [field.id]: e.target.value })}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                        />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Preview View ═══ */}
          {view === "preview" && selectedTemplate && (
            <div key="preview"
              className={fullscreen ? "fixed inset-0 z-50 bg-gray-100 overflow-auto" : ""}>
              {/* Preview Toolbar */}
              <div className={`bg-white border-b border-gray-200 ${fullscreen ? "sticky top-0 z-10 shadow-sm" : "rounded-t-xl border border-gray-200"}`}>
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={() => { setView("editor"); setFullscreen(false); }} className="text-gray-400 hover:text-gray-600">
                      <ArrowLeft className="w-5 h-5" />
                    </button>
                    <Eye className="w-4 h-4 text-teal-500 hidden sm:block" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة التقرير</span>
                  </div>
                  <div className="flex items-center gap-1.5 sm:gap-2">
                    <Button size="sm" onClick={handleExportPDF} disabled={exporting} className="gap-1 sm:gap-1.5 text-xs h-8 sm:h-9 bg-teal-600 hover:bg-teal-700 text-white">
                      {exporting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
                      <span className="hidden sm:inline">{exporting ? 'جاري التصدير...' : 'تصدير PDF'}</span>
                      <span className="sm:hidden">PDF</span>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={() => setFullscreen(!fullscreen)} className="p-1.5 h-8 sm:h-9">
                      {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 sm:gap-2 px-3 sm:px-4 pb-2 sm:pb-3 overflow-x-auto" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
                  <div className="flex items-center gap-0.5 bg-white/90 backdrop-blur-sm border border-gray-200 rounded-lg shadow-sm px-1 py-0.5 shrink-0">
                    <button onClick={zoomOut} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95" title="تصغير">
                      <ZoomOut className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <div className="px-1.5 min-w-[2.5rem] text-center">
                      <span className="text-[10px] font-mono text-gray-700 font-medium">{zoomLevel}%</span>
                    </div>
                    <button onClick={zoomIn} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95" title="تكبير">
                      <ZoomIn className="w-3.5 h-3.5 text-gray-600" />
                    </button>
                    <div className="w-px h-4 bg-gray-200 mx-0.5" />
                    <button onClick={resetZoom} className="p-1.5 hover:bg-gray-100 rounded-md transition-colors active:scale-95" title="إعادة الحجم الأصلي">
                      <RotateCcw className="w-3 h-3 text-gray-500" />
                    </button>
                  </div>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-xs h-8 shrink-0">
                    <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">طباعة</span>
                  </Button>
                </div>
              </div>
              {/* Preview Content - A4 مضغوط بـ transform: scale() */}
              <div ref={previewContainerRef} className={`bg-gray-200 overflow-auto ${fullscreen ? "h-[calc(100vh-52px)]" : "max-h-[75vh] rounded-b-xl border-x border-b border-gray-200"}`} style={{ padding: '8px 4px', minHeight: '200px' }}>
                <div style={{ width: `${wrapperWidth}px`, height: `${wrapperHeight}px`, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ width: `${A4_WIDTH_PX}px`, transformOrigin: 'top right', transform: `scale(${previewScale})`, transition: 'transform 0.15s ease-out' }}>
                    <div id="report-preview-content" ref={previewPageRef} style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', width: '210mm' }}>
                      <ReportPreview template={selectedTemplate} data={formData} theme={selectedTheme} fontFamily={selectedFont} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ═══ Saved Reports View ═══ */}
          {view === "saved" && (
            <div key="saved">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>التقارير المحفوظة</h2>
                <div className="relative w-64">
                  <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pr-10 pl-4 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                </div>
              </div>
              {filteredReports.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                  <FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">لا توجد تقارير محفوظة</p>
                  <Button onClick={() => setView("templates")} variant="outline" size="sm" className="mt-3 gap-1">
                    <Plus className="w-4 h-4" /> إنشاء تقرير جديد
                  </Button>
                </div>
              ) : (
                <div className="space-y-3">
                  {filteredReports.map((report) => {
                    const template = REPORT_TEMPLATES.find((t) => t.id === report.templateId);
                    const Icon = template?.icon || FileText;
                    const color = template?.color || "#64748b";
                    const theme = THEMES.find((t) => t.id === report.themeId);
                    return (
                      <div key={report.id}
                        className="bg-white rounded-xl border border-gray-100 p-4 flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "12" }}>
                            <Icon className="w-5 h-5" style={{ color }} />
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800 text-sm">{report.title}</h3>
                            <p className="text-xs text-gray-400 flex items-center gap-2">
                              <span>{template?.title}</span>
                              <span>·</span>
                              <span>{new Date(report.updatedAt).toLocaleDateString("ar-SA")}</span>
                              {theme && (
                                <>
                                  <span>·</span>
                                  <span className="flex items-center gap-1">
                                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: theme.primaryColor }} />
                                    {theme.name}
                                  </span>
                                </>
                              )}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button onClick={() => editReport(report)} variant="outline" size="sm" className="gap-1">
                            <Edit3 className="w-3 h-3" /> تعديل
                          </Button>
                          <Button onClick={() => handleDelete(report.id)} variant="outline" size="sm" className="gap-1 text-red-500 hover:text-red-600">
                            <Trash2 className="w-3 h-3" /> حذف
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      </div>
    </div>
  );
}
