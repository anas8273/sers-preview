/**
 * ReportEditor - واجهة موحدة تجمع بين نموذج الإدخال والمعاينة الحية
 * يدعم: تبديل بين الإدخال والمعاينة، تصدير PDF، مشاركة
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Eye, Edit3, Download, Share2, Save, Loader2,
  FileText, Palette, ChevronDown, Check
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import ReportForm, { type ReportFormData } from "./ReportForm";
import ReportPreview, { type ReportPreviewHandle } from "./ReportPreview";
import type { ReportField, ReportLayout, PdfTemplate } from "../../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────
interface ReportEditorProps {
  templateId: number;
  templateName: string;
  fields: ReportField[];
  layout: ReportLayout;
  defaultThemeId?: number;
  // Context
  personalInfo?: {
    schoolName?: string;
    region?: string;
    teacherName?: string;
    principalName?: string;
    semester?: string;
    year?: string;
  };
  context?: {
    jobTitle?: string;
    criterionName?: string;
    subEvidenceName?: string;
    criterionId?: string;
    subEvidenceId?: string;
    evidenceId?: string;
    portfolioId?: number;
  };
  // Existing report data (for editing)
  existingReportId?: number;
  existingData?: ReportFormData;
  existingTitle?: string;
  // Callbacks
  onBack?: () => void;
  onSaved?: (reportId: number) => void;
  onFileUpload?: (file: File) => Promise<string>;
}

type EditorTab = "form" | "preview";

// ─── Main Component ──────────────────────────────────────────
export default function ReportEditor({
  templateId,
  templateName,
  fields,
  layout,
  defaultThemeId,
  personalInfo,
  context,
  existingReportId,
  existingData,
  existingTitle,
  onBack,
  onSaved,
  onFileUpload,
}: ReportEditorProps) {
  const [activeTab, setActiveTab] = useState<EditorTab>("form");
  const [data, setData] = useState<ReportFormData>(existingData || {});
  const [title, setTitle] = useState(existingTitle || templateName);
  const [isSaving, setIsSaving] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [reportId, setReportId] = useState<number | undefined>(existingReportId);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [selectedThemeId, setSelectedThemeId] = useState<number | undefined>(defaultThemeId);

  const previewRef = useRef<ReportPreviewHandle>(null);

  // Fetch available themes
  const { data: themes } = trpc.templates.list.useQuery();
  const selectedTheme = themes?.find((t: PdfTemplate) => t.id === selectedThemeId);

  const themeColors = selectedTheme ? {
    headerBg: selectedTheme.headerBg,
    headerText: selectedTheme.headerText,
    accent: selectedTheme.accent,
    borderColor: selectedTheme.borderColor,
    bodyBg: selectedTheme.bodyBg,
  } : undefined;

  // Mutations
  const createReport = trpc.userReport.create.useMutation();
  const updateReport = trpc.userReport.update.useMutation();

  // Save report
  const handleSave = useCallback(async (status: "draft" | "completed" = "draft") => {
    setIsSaving(true);
    try {
      if (reportId) {
        await updateReport.mutateAsync({
          id: reportId,
          title,
          data,
          themeId: selectedThemeId,
          status,
        });
        toast.success("تم حفظ التقرير بنجاح");
      } else {
        const result = await createReport.mutateAsync({
          reportTemplateId: templateId,
          portfolioId: context?.portfolioId,
          themeId: selectedThemeId,
          title,
          data,
          criterionId: context?.criterionId,
          subEvidenceId: context?.subEvidenceId,
          evidenceId: context?.evidenceId,
          status,
        });
        if (result?.id) {
          setReportId(result.id);
          onSaved?.(result.id);
        }
        toast.success("تم إنشاء التقرير بنجاح");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء الحفظ");
    }
    setIsSaving(false);
  }, [reportId, title, data, selectedThemeId, templateId, context, createReport, updateReport, onSaved]);

  // Export PDF
  const handleExportPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const el = previewRef.current?.getPreviewElement();
      if (!el) {
        toast.error("لا يمكن العثور على عنصر المعاينة");
        setIsExporting(false);
        return;
      }

      // Dynamic import html2canvas + jspdf
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import("html2canvas"),
        import("jspdf"),
      ]);

      const canvas = await html2canvas(el, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
      });

      const imgData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4",
      });

      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight) {
        pdf.addImage(imgData, "PNG", 0, 0, pdfWidth, scaledHeight);
      } else {
        // Multi-page
        let y = 0;
        while (y < imgHeight) {
          const pageCanvas = document.createElement("canvas");
          pageCanvas.width = imgWidth;
          pageCanvas.height = Math.min(pdfHeight / ratio, imgHeight - y);
          const ctx = pageCanvas.getContext("2d")!;
          ctx.drawImage(canvas, 0, -y);
          const pageData = pageCanvas.toDataURL("image/png");
          if (y > 0) pdf.addPage();
          pdf.addImage(pageData, "PNG", 0, 0, pdfWidth, pageCanvas.height * ratio);
          y += pageCanvas.height;
        }
      }

      pdf.save(`${title || "تقرير"}.pdf`);
      toast.success("تم تصدير PDF بنجاح");
    } catch (err) {
      console.error("PDF export error:", err);
      toast.error("حدث خطأ أثناء التصدير");
    }
    setIsExporting(false);
  }, [title]);

  // Share
  const handleShare = useCallback(() => {
    toast.info("خاصية المشاركة قيد التطوير");
  }, []);

  // Count filled fields
  const filledCount = fields.filter(f => {
    const v = data[f.id];
    if (Array.isArray(v)) return v.some(Boolean);
    return !!v;
  }).length;
  const totalRequired = fields.filter(f => f.required).length;
  const filledRequired = fields.filter(f => f.required && data[f.id]).length;
  const progress = fields.length > 0 ? Math.round((filledCount / fields.length) * 100) : 0;

  return (
    <div className="min-h-screen bg-gray-50" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-20 bg-white border-b border-gray-200 shadow-sm">
        <div className="max-w-6xl mx-auto px-4 py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {onBack && (
                <button onClick={onBack} className="p-2 hover:bg-gray-100 rounded-lg transition-colors">
                  <ArrowLeft className="w-5 h-5 text-gray-600" />
                </button>
              )}
              <div>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-bold text-gray-900 text-sm bg-transparent border-none outline-none focus:ring-0 p-0 w-full"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                  placeholder="عنوان التقرير"
                />
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-[10px] text-gray-400">{filledCount}/{fields.length} حقل مكتمل</span>
                  <div className="w-20 h-1 bg-gray-200 rounded-full overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${progress}%`, backgroundColor: progress === 100 ? "#059669" : "#f59e0b" }}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              {/* Theme picker */}
              <div className="relative">
                <button
                  onClick={() => setShowThemePicker(!showThemePicker)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-gray-200 text-xs text-gray-600 hover:bg-gray-50 transition-colors"
                >
                  <Palette className="w-3.5 h-3.5" />
                  {selectedTheme?.name || "القالب الافتراضي"}
                  <ChevronDown className="w-3 h-3" />
                </button>
                {showThemePicker && themes && (
                  <div className="absolute top-full left-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg z-30 w-48 py-1">
                    {themes.map((theme: PdfTemplate) => (
                      <button
                        key={theme.id}
                        onClick={() => {
                          setSelectedThemeId(theme.id);
                          setShowThemePicker(false);
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        <div className="w-4 h-4 rounded-full border" style={{ background: theme.headerBg }} />
                        {theme.name}
                        {selectedThemeId === theme.id && <Check className="w-3 h-3 text-emerald-500 mr-auto" />}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              {/* Tab switcher */}
              <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
                <button
                  onClick={() => setActiveTab("form")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === "form"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  إدخال
                </button>
                <button
                  onClick={() => setActiveTab("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium transition-all ${
                    activeTab === "preview"
                      ? "bg-white text-emerald-700 shadow-sm"
                      : "text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Eye className="w-3.5 h-3.5" />
                  معاينة
                </button>
              </div>

              {/* Save */}
              <Button
                size="sm"
                onClick={() => handleSave("draft")}
                disabled={isSaving}
                className="text-xs gap-1.5 bg-emerald-600 hover:bg-emerald-700"
              >
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                حفظ
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 py-6">
        <AnimatePresence mode="wait">
          {activeTab === "form" ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              transition={{ duration: 0.2 }}
            >
              <div className="bg-white rounded-xl border border-gray-200 p-6 shadow-sm">
                <ReportForm
                  fields={fields}
                  data={data}
                  onChange={setData}
                  templateName={templateName}
                  context={context}
                  onFileUpload={onFileUpload}
                />
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="preview"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.2 }}
            >
              <ReportPreview
                ref={previewRef}
                fields={fields}
                layout={layout}
                data={data}
                title={title}
                personalInfo={personalInfo}
                themeColors={themeColors}
                onExportPDF={handleExportPDF}
                onShare={handleShare}
                isExporting={isExporting}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
