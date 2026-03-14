/**
 * صانع الإذاعة المدرسية - SERS
 * إنشاء برنامج إذاعة مدرسية متكامل مع:
 * - تعبئة بالذكاء الاصطناعي لكل فقرة
 * - معاينة حية بتصميم احترافي
 * - تصدير PDF
 * - 6 ثيمات/قوالب مختلفة
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, Radio, Plus, Trash2, Save, Edit3,
  ChevronDown, ChevronUp, Sparkles, BookOpen,
  Mic, Heart, Lightbulb, Clock, Search,
  Copy, Loader2, Eye, Printer, FileDown, Maximize2, Minimize2,
  Star, Quote, ChevronLeft, ZoomIn, ZoomOut, RotateCcw
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import TemplateSelector, { THEMES, type ThemeConfig } from "@/components/TemplateSelector";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { usePreviewScale } from "@/hooks/usePreviewScale";

const A4_WIDTH_PX = 793.7;

// ═══════════════════════════════════════════════════════════════
// Types & Data
// ═══════════════════════════════════════════════════════════════

interface RadioSegment {
  id: string;
  type: SegmentType;
  title: string;
  content: string;
  presenter?: string;
}

type SegmentType = "quran" | "hadith" | "wisdom" | "poem" | "info" | "news" | "dua" | "custom";

interface SavedRadio {
  id: string;
  title: string;
  date: string;
  theme: string;
  themeId: string;
  fontFamily: string;
  segments: RadioSegment[];
  createdAt: number;
}

const SEGMENT_TYPES: { id: SegmentType; label: string; icon: React.ComponentType<any>; color: string; defaultTitle: string }[] = [
  { id: "quran", label: "القرآن الكريم", icon: BookOpen, color: "#0d9488", defaultTitle: "آيات من الذكر الحكيم" },
  { id: "hadith", label: "الحديث الشريف", icon: Star, color: "#7c3aed", defaultTitle: "من السنة النبوية" },
  { id: "wisdom", label: "حكمة اليوم", icon: Lightbulb, color: "#ea580c", defaultTitle: "حكمة اليوم" },
  { id: "poem", label: "فقرة شعرية", icon: Quote, color: "#2563eb", defaultTitle: "أبيات شعرية" },
  { id: "info", label: "هل تعلم", icon: Sparkles, color: "#059669", defaultTitle: "هل تعلم؟" },
  { id: "news", label: "أخبار المدرسة", icon: Radio, color: "#dc2626", defaultTitle: "أخبار المدرسة" },
  { id: "dua", label: "دعاء", icon: Heart, color: "#8b5cf6", defaultTitle: "دعاء الختام" },
  { id: "custom", label: "فقرة مخصصة", icon: Edit3, color: "#64748b", defaultTitle: "فقرة مخصصة" },
];

const RADIO_THEMES = [
  "العلم والمعرفة", "الأخلاق والقيم", "الوطن والانتماء", "البيئة والصحة",
  "التقنية والابتكار", "اليوم الوطني", "يوم المعلم", "بداية العام الدراسي",
  "الاختبارات والاستعداد", "السلامة المرورية", "حقوق الطفل", "مخصص",
];

const STORAGE_KEY = "sers-radio-programs";
function loadPrograms(): SavedRadio[] { try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {} return []; }
function saveProgramsToStorage(programs: SavedRadio[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(programs)); }
function generateId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ═══════════════════════════════════════════════════════════════
// Preview Component
// ═══════════════════════════════════════════════════════════════

function RadioPreview({
  title, date, radioTheme, segments, theme, fontFamily,
}: {
  title: string; date: string; radioTheme: string; segments: RadioSegment[];
  theme: ThemeConfig; fontFamily: string;
}) {
  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ width: "210mm", minHeight: "297mm", fontFamily: `'${fontFamily}', sans-serif`, direction: "rtl", background: "#fff" }}>
      {/* Header */}
      <div data-pdf-header style={{
        background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
        color: theme.headerText, padding: "28px 32px", textAlign: "center",
      }}>
        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
          <div style={{ width: "40px", height: "2px", backgroundColor: "rgba(255,255,255,0.4)" }} />
          <div style={{ fontSize: "11px", opacity: 0.8, letterSpacing: "2px" }}>بسم الله الرحمن الرحيم</div>
          <div style={{ width: "40px", height: "2px", backgroundColor: "rgba(255,255,255,0.4)" }} />
        </div>
        <h1 style={{ fontSize: "24px", fontWeight: "800", margin: "8px 0 4px", fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>{title}</h1>
        <p style={{ fontSize: "12px", opacity: 0.85, margin: "4px 0" }}>
          {radioTheme && `موضوع: ${radioTheme}`}
          {date && ` | التاريخ: ${date}`}
        </p>
        <p style={{ fontSize: "10px", opacity: 0.6, margin: "4px 0 0" }}>نظام السجلات التعليمية الذكي - SERS</p>
      </div>

      {/* Body */}
      <div style={{ padding: "24px 32px" }}>
        {segments.map((seg, idx) => {
          const segType = SEGMENT_TYPES.find((s) => s.id === seg.type);
          const segColor = segType?.color || theme.primaryColor;
          return (
            <div key={seg.id} style={{ marginBottom: "20px" }}>
              {/* Segment Header */}
              <div style={{
                display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px",
                paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`,
              }}>
                <div style={{
                  width: "28px", height: "28px", borderRadius: "8px",
                  backgroundColor: segColor + "15", display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: "12px", fontWeight: "700", color: segColor,
                }}>
                  {idx + 1}
                </div>
                <h3 data-pdf-accent style={{
                  fontSize: "14px", fontWeight: "700", color: theme.primaryColor, margin: 0,
                  fontFamily: `'Tajawal', '${fontFamily}', sans-serif`,
                }}>
                  {seg.title}
                </h3>
                {seg.presenter && (
                  <span style={{ fontSize: "10px", color: "#9ca3af", marginRight: "auto" }}>
                    تقديم: {seg.presenter}
                  </span>
                )}
              </div>
              {/* Segment Content */}
              <p style={{
                fontSize: "13px", lineHeight: "2", color: "#374151", margin: 0,
                whiteSpace: "pre-wrap", paddingRight: "38px",
              }}>
                {seg.content || "..."}
              </p>
            </div>
          );
        })}

        {segments.length === 0 && (
          <div style={{ textAlign: "center", padding: "40px 0", color: "#9ca3af" }}>
            <p style={{ fontSize: "14px" }}>لم يتم إضافة فقرات بعد</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        borderTop: `2px solid ${theme.borderColor}`, padding: "12px 32px",
        display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af",
      }}>
        <span>تم إنشاؤه بواسطة منصة SERS</span>
        <span>{today}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function SchoolRadio() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"list" | "editor" | "preview">("list");
  const [programs, setPrograms] = useState<SavedRadio[]>(loadPrograms);
  const [currentProgram, setCurrentProgram] = useState<SavedRadio | null>(null);
  const [title, setTitle] = useState("الإذاعة المدرسية");
  const [date, setDate] = useState("");
  const [radioTheme, setRadioTheme] = useState("العلم والمعرفة");
  const [segments, setSegments] = useState<RadioSegment[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>(THEMES[0]);
  const [selectedFont, setSelectedFont] = useState("Cairo");
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);

  const { containerRef: previewContainerRef, pageRef: previewPageRef, previewScale, wrapperWidth, wrapperHeight, zoomLevel, zoomIn, zoomOut, resetZoom } = usePreviewScale();

  const generateRadioMutation = trpc.genAI.generateRadio.useMutation();

  const startNew = useCallback(() => {
    setTitle("الإذاعة المدرسية");
    setDate("");
    setRadioTheme("العلم والمعرفة");
    setSegments([
      { id: generateId(), type: "quran", title: "آيات من الذكر الحكيم", content: "", presenter: "" },
      { id: generateId(), type: "hadith", title: "من السنة النبوية", content: "", presenter: "" },
      { id: generateId(), type: "wisdom", title: "حكمة اليوم", content: "", presenter: "" },
      { id: generateId(), type: "info", title: "هل تعلم؟", content: "", presenter: "" },
      { id: generateId(), type: "dua", title: "دعاء الختام", content: "", presenter: "" },
    ]);
    setCurrentProgram(null);
    setView("editor");
  }, []);

  const editProgram = useCallback((prog: SavedRadio) => {
    setTitle(prog.title);
    setDate(prog.date);
    setRadioTheme(prog.theme);
    setSegments(prog.segments);
    setCurrentProgram(prog);
    const theme = THEMES.find((t) => t.id === prog.themeId);
    if (theme) setSelectedTheme(theme);
    if (prog.fontFamily) setSelectedFont(prog.fontFamily);
    setView("editor");
  }, []);

  const addSegment = useCallback((type: SegmentType) => {
    const segType = SEGMENT_TYPES.find((s) => s.id === type);
    if (!segType) return;
    setSegments((prev) => [...prev, { id: generateId(), type, title: segType.defaultTitle, content: "", presenter: "" }]);
  }, []);

  const updateSegment = useCallback((id: string, field: keyof RadioSegment, value: string) => {
    setSegments((prev) => prev.map((s) => s.id === id ? { ...s, [field]: value } : s));
  }, []);

  const removeSegment = useCallback((id: string) => {
    setSegments((prev) => prev.filter((s) => s.id !== id));
  }, []);

  const moveSegment = useCallback((index: number, dir: "up" | "down") => {
    setSegments((prev) => {
      const arr = [...prev];
      const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]];
      return arr;
    });
  }, []);

  const handleSave = useCallback(() => {
    const now = Date.now();
    if (currentProgram) {
      const updated = programs.map((p) =>
        p.id === currentProgram.id ? { ...p, title, date, theme: radioTheme, themeId: selectedTheme.id, fontFamily: selectedFont, segments, createdAt: now } : p
      );
      setPrograms(updated);
      saveProgramsToStorage(updated);
      setCurrentProgram({ ...currentProgram, title, date, theme: radioTheme, themeId: selectedTheme.id, fontFamily: selectedFont, segments, createdAt: now });
      toast.success("تم تحديث البرنامج بنجاح");
    } else {
      const newProg: SavedRadio = { id: generateId(), title, date, theme: radioTheme, themeId: selectedTheme.id, fontFamily: selectedFont, segments, createdAt: now };
      const updated = [newProg, ...programs];
      setPrograms(updated);
      saveProgramsToStorage(updated);
      setCurrentProgram(newProg);
      toast.success("تم حفظ البرنامج بنجاح");
    }
  }, [currentProgram, programs, title, date, radioTheme, selectedTheme, selectedFont, segments]);

  const handleDelete = useCallback((id: string) => {
    const updated = programs.filter((p) => p.id !== id);
    setPrograms(updated);
    saveProgramsToStorage(updated);
    toast.success("تم حذف البرنامج");
  }, [programs]);

  const handleAIFill = useCallback(async () => {
    if (segments.length === 0) { toast.error("أضف فقرات أولاً"); return; }
    setAiLoading(true);
    try {
      const result = await generateRadioMutation.mutateAsync({
        theme: radioTheme,
        segments: segments.map((s) => s.title),
        additionalNotes: title !== "الإذاعة المدرسية" ? title : undefined,
      });
      if (result.success && result.segments) {
        setSegments((prev) => prev.map((seg, i) => {
          const aiSeg = result.segments[i];
          if (aiSeg && (!seg.content || seg.content.trim() === "")) {
            return { ...seg, content: aiSeg.content, title: aiSeg.title || seg.title };
          }
          return seg;
        }));
        toast.success("تم توليد المحتوى بالذكاء الاصطناعي بنجاح");
      }
    } catch (err) {
      toast.error("حدث خطأ أثناء التوليد بالذكاء الاصطناعي");
    } finally {
      setAiLoading(false);
    }
  }, [segments, radioTheme, title, generateRadioMutation]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try {
      await exportToPDF("radio-preview-content", `${title}.pdf`);
      toast.success("تم تصدير PDF بنجاح");
    } catch { toast.error("حدث خطأ أثناء التصدير"); }
    finally { setExporting(false); }
  }, [title]);

  const handlePrint = useCallback(() => {
    try { printElement("radio-preview-content"); } catch { toast.error("حدث خطأ أثناء الطباعة"); }
  }, []);

  const copyToClipboard = useCallback((text: string) => {
    navigator.clipboard.writeText(text);
    toast.success("تم النسخ");
  }, []);

  const filteredPrograms = useMemo(() => {
    if (!searchQuery.trim()) return programs;
    const q = searchQuery.toLowerCase();
    return programs.filter((p) => p.title.includes(q) || p.theme.includes(q));
  }, [programs, searchQuery]);

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
              <Radio className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>صانع الإذاعة المدرسية</h1>
              <p className="text-white/80 text-sm mt-1">إنشاء برنامج إذاعة مدرسية متكامل مع دعم الذكاء الاصطناعي</p>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <>
          {/* ═══ List View ═══ */}
          {view === "list" && (
            <div key="list">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>برامج الإذاعة</h2>
                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <Button onClick={startNew} className="gap-1 bg-teal-600 hover:bg-teal-700 text-white">
                    <Plus className="w-4 h-4" /> إذاعة جديدة
                  </Button>
                </div>
              </div>
              {filteredPrograms.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                  <Radio className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">لا توجد برامج إذاعة محفوظة</p>
                  <Button onClick={startNew} variant="outline" size="sm" className="mt-3 gap-1"><Plus className="w-4 h-4" /> إنشاء إذاعة جديدة</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredPrograms.map((prog) => (
                    <div key={prog.id} className="bg-white rounded-xl border border-gray-100 p-5 group">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm">{prog.title}</h3>
                          <p className="text-xs text-gray-400 mt-1">{prog.theme} · {prog.segments.length} فقرات · {new Date(prog.createdAt).toLocaleDateString("ar-SA")}</p>
                        </div>
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => editProgram(prog)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500"><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(prog.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400"><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {prog.segments.slice(0, 5).map((seg) => {
                          const segType = SEGMENT_TYPES.find((s) => s.id === seg.type);
                          return <span key={seg.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: (segType?.color || "#64748b") + "12", color: segType?.color }}>{seg.title}</span>;
                        })}
                        {prog.segments.length > 5 && <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-gray-100 text-gray-500">+{prog.segments.length - 5}</span>}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ═══ Editor View ═══ */}
          {view === "editor" && (
            <div key="editor">
              <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
                <button onClick={() => setView("list")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
                  <ArrowLeft className="w-4 h-4" /><span className="text-sm">العودة للقائمة</span>
                </button>
                <div className="flex items-center gap-2 flex-wrap">
                  <Button onClick={handleAIFill} variant="outline" size="sm" disabled={aiLoading}
                    className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? "جاري التوليد..." : "تعبئة بالذكاء الاصطناعي"}
                  </Button>
                  <Button onClick={handleSave} variant="outline" size="sm" className="gap-1"><Save className="w-4 h-4" /> حفظ</Button>
                  <Button onClick={() => setView("preview")} size="sm" className="gap-1 bg-teal-600 hover:bg-teal-700 text-white">
                    <Eye className="w-4 h-4" /> معاينة وتصدير
                  </Button>
                </div>
              </div>

              {/* Theme Selector */}
              <div className="mb-4">
                <TemplateSelector selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} selectedFont={selectedFont} onFontChange={setSelectedFont} compact />
              </div>

              {/* Program Info */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">عنوان الإذاعة</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">التاريخ</label>
                    <input type="text" value={date} onChange={(e) => setDate(e.target.value)} placeholder="مثال: الأحد 1446/5/15"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">الموضوع</label>
                    <select value={radioTheme} onChange={(e) => setRadioTheme(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white">
                      {RADIO_THEMES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                  </div>
                </div>
              </div>

              {/* Segments */}
              <div className="space-y-3 mb-4">
                {segments.map((seg, index) => {
                  const segType = SEGMENT_TYPES.find((s) => s.id === seg.type);
                  const Icon = segType?.icon || Edit3;
                  const color = segType?.color || "#64748b";
                  return (
                    <div key={seg.id}
                      className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100" style={{ backgroundColor: color + "06" }}>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveSegment(index, "up")} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                          <button onClick={() => moveSegment(index, "down")} disabled={index === segments.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                        </div>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">{index + 1}</span>
                        <input type="text" value={seg.title} onChange={(e) => updateSegment(seg.id, "title", e.target.value)}
                          className="flex-1 bg-transparent text-sm font-bold text-gray-800 focus:outline-none" style={{ fontFamily: "'Tajawal', sans-serif" }} />
                        <input type="text" value={seg.presenter || ""} onChange={(e) => updateSegment(seg.id, "presenter", e.target.value)}
                          placeholder="اسم المقدم" className="w-32 bg-white/80 px-2 py-1 rounded-md text-xs border border-gray-200 focus:outline-none focus:ring-1 focus:ring-gray-300" />
                        <button onClick={() => removeSegment(seg.id)} className="text-gray-400 hover:text-red-500 transition-colors"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="p-4">
                        <textarea value={seg.content} onChange={(e) => updateSegment(seg.id, "content", e.target.value)}
                          placeholder="اكتب محتوى الفقرة هنا أو استخدم التعبئة بالذكاء الاصطناعي..." rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y"
                          style={{ fontFamily: `'${selectedFont}', sans-serif` }} />
                        {seg.content && (
                          <button onClick={() => copyToClipboard(seg.content)} className="mt-2 text-xs text-gray-400 hover:text-gray-600 flex items-center gap-1">
                            <Copy className="w-3 h-3" /> نسخ المحتوى
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add segment */}
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">إضافة فقرة جديدة:</p>
                <div className="flex flex-wrap gap-2">
                  {SEGMENT_TYPES.map((segType) => {
                    const Icon = segType.icon;
                    return (
                      <button key={segType.id} onClick={() => addSegment(segType.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-gray-300 transition-colors"
                        style={{ color: segType.color }}>
                        <Icon className="w-3.5 h-3.5" /> {segType.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ═══ Preview View ═══ */}
          {view === "preview" && (
            <div key="preview"
              className={fullscreen ? "fixed inset-0 z-50 bg-gray-100 overflow-auto" : ""}>
              <div className={`bg-white border-b border-gray-200 ${fullscreen ? "sticky top-0 z-10 shadow-sm" : "rounded-t-xl border border-gray-200"}`}>
                <div className="flex items-center justify-between px-3 sm:px-4 py-2 sm:py-3 gap-2">
                  <div className="flex items-center gap-2 sm:gap-3">
                    <button onClick={() => { setView("editor"); setFullscreen(false); }} className="text-gray-400 hover:text-gray-600"><ArrowLeft className="w-5 h-5" /></button>
                    <Eye className="w-4 h-4 text-teal-500 hidden sm:block" />
                    <span className="text-xs sm:text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة الإذاعة</span>
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
                    <div id="radio-preview-content" ref={previewPageRef} style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', width: '210mm' }}>
                      <RadioPreview title={title} date={date} radioTheme={radioTheme} segments={segments} theme={selectedTheme} fontFamily={selectedFont} />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      </div>
    </div>
  );
}
