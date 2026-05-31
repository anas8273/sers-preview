/**
 * منصة الاختبارات - SERS
 * إنشاء اختبارات متنوعة مع:
 * - توليد أسئلة بالذكاء الاصطناعي
 * - معاينة حية بتصميم احترافي
 * - تصدير PDF
 * - 6 ثيمات/قوالب مختلفة
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, ClipboardCheck, Plus, Trash2, Save, Edit3,
  Search, ChevronDown, ChevronUp, Sparkles,
  CheckCircle2, XCircle, HelpCircle, Eye, Printer,
  FileDown, Maximize2, Minimize2, Loader2, ChevronLeft, ZoomIn, ZoomOut, RotateCcw
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

type QuestionType = "multiple-choice" | "true-false" | "essay" | "fill-blank";

interface Question {
  id: string;
  type: QuestionType;
  text: string;
  points: number;
  options?: string[];
  correctAnswer?: string;
  correctIndex?: number;
}

interface SavedExam {
  id: string;
  title: string;
  subject: string;
  grade: string;
  semester: string;
  duration: string;
  themeId: string;
  fontFamily: string;
  questions: Question[];
  createdAt: number;
}

const QUESTION_TYPES: { id: QuestionType; label: string; icon: React.ComponentType<any>; color: string }[] = [
  { id: "multiple-choice", label: "اختيار من متعدد", icon: CheckCircle2, color: "#0d9488" },
  { id: "true-false", label: "صح / خطأ", icon: HelpCircle, color: "#7c3aed" },
  { id: "essay", label: "مقالي", icon: Edit3, color: "#ea580c" },
  { id: "fill-blank", label: "أكمل الفراغ", icon: Sparkles, color: "#2563eb" },
];

const STORAGE_KEY = "sers-exams";
function loadExams(): SavedExam[] { try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch { } return []; }
function saveExamsToStorage(exams: SavedExam[]) { localStorage.setItem(STORAGE_KEY, JSON.stringify(exams)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ═══════════════════════════════════════════════════════════════
// Exam Preview Component
// ═══════════════════════════════════════════════════════════════

function ExamPreview({
  title, subject, grade, semester, duration, questions, theme, fontFamily, showAnswers,
}: {
  title: string; subject: string; grade: string; semester: string; duration: string;
  questions: Question[]; theme: ThemeConfig; fontFamily: string; showAnswers: boolean;
}) {
  const totalPoints = questions.reduce((s, q) => s + q.points, 0);
  const today = new Date().toLocaleDateString("ar-SA", { year: "numeric", month: "long", day: "numeric" });

  return (
    <div style={{ width: "210mm", minHeight: "297mm", fontFamily: `'${fontFamily}', sans-serif`, direction: "rtl", background: "#fff" }}>
      {/* Header */}
      <div data-pdf-header style={{
        background: `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`,
        color: theme.headerText, padding: "24px 32px",
      }}>
        <div style={{ textAlign: "center", marginBottom: "12px" }}>
          <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "12px", marginBottom: "6px" }}>
            <div style={{ width: "40px", height: "2px", backgroundColor: "rgba(255,255,255,0.3)" }} />
            <span style={{ fontSize: "11px", opacity: 0.7, letterSpacing: "2px" }}>بسم الله الرحمن الرحيم</span>
            <div style={{ width: "40px", height: "2px", backgroundColor: "rgba(255,255,255,0.3)" }} />
          </div>
          <h1 style={{ fontSize: "22px", fontWeight: "800", margin: "6px 0", fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
            {title || `اختبار ${subject || "..."}`}
          </h1>
          <p style={{ fontSize: "10px", opacity: 0.7 }}>نظام السجلات التعليمية الذكي - SERS</p>
        </div>

        {/* Exam info grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "11px" }}>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px" }}>
            <span style={{ opacity: 0.7 }}>المادة: </span><strong>{subject || "---"}</strong>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px" }}>
            <span style={{ opacity: 0.7 }}>الصف: </span><strong>{grade || "---"}</strong>
          </div>
          <div style={{ backgroundColor: "rgba(255,255,255,0.1)", borderRadius: "8px", padding: "8px 12px" }}>
            <span style={{ opacity: 0.7 }}>الفصل: </span><strong>{semester}</strong>
          </div>
        </div>
        <div style={{ display: "flex", justifyContent: "space-between", marginTop: "8px", fontSize: "11px", opacity: 0.8 }}>
          <span>المدة: {duration || "---"}</span>
          <span>الدرجة الكلية: {totalPoints}</span>
          <span>عدد الأسئلة: {questions.length}</span>
        </div>
      </div>

      {/* Student Info */}
      <div style={{ padding: "16px 32px", borderBottom: `2px solid ${theme.borderColor}`, display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "12px", fontSize: "12px" }}>
        <div>اسم الطالب: ............................................</div>
        <div>رقم الجلوس: ............................................</div>
        <div>التاريخ: {today}</div>
      </div>

      {/* Questions */}
      <div style={{ padding: "20px 32px" }}>
        {questions.map((q, idx) => {
          const qType = QUESTION_TYPES.find((t) => t.id === q.type);
          return (
            <div key={q.id} style={{ marginBottom: "20px", pageBreakInside: "avoid" }}>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", marginBottom: "8px" }}>
                <span data-pdf-accent style={{
                  display: "inline-flex", alignItems: "center", justifyContent: "center",
                  width: "26px", height: "26px", borderRadius: "50%",
                  backgroundColor: theme.primaryColor, color: "#fff",
                  fontSize: "11px", fontWeight: "700", flexShrink: 0,
                }}>
                  {idx + 1}
                </span>
                <p style={{ fontSize: "13px", fontWeight: "600", color: "#1f2937", margin: 0, flex: 1, lineHeight: "1.8" }}>
                  {q.text || "..."}
                </p>
                <span style={{ fontSize: "10px", color: "#9ca3af", whiteSpace: "nowrap" }}>({q.points} {q.points === 1 ? "درجة" : "درجات"})</span>
              </div>

              {q.type === "multiple-choice" && q.options && (
                <div style={{ paddingRight: "34px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px" }}>
                  {q.options.map((opt, i) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: "6px", padding: "6px 10px",
                      borderRadius: "6px", fontSize: "12px",
                      backgroundColor: showAnswers && q.correctIndex === i ? "#dcfce7" : "#f9fafb",
                      border: showAnswers && q.correctIndex === i ? "1px solid #86efac" : "1px solid #e5e7eb",
                    }}>
                      <span style={{ width: "18px", height: "18px", borderRadius: "50%", border: "1.5px solid #d1d5db", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", fontWeight: "600", color: "#6b7280", flexShrink: 0 }}>
                        {String.fromCharCode(1571 + i)}
                      </span>
                      <span>{opt || "..."}</span>
                    </div>
                  ))}
                </div>
              )}

              {q.type === "true-false" && (
                <div style={{ paddingRight: "34px", display: "flex", gap: "12px" }}>
                  {["صح", "خطأ"].map((opt) => (
                    <div key={opt} style={{
                      display: "flex", alignItems: "center", gap: "6px", padding: "6px 16px",
                      borderRadius: "6px", fontSize: "12px",
                      backgroundColor: showAnswers && q.correctAnswer === opt ? (opt === "صح" ? "#dcfce7" : "#fee2e2") : "#f9fafb",
                      border: showAnswers && q.correctAnswer === opt ? (opt === "صح" ? "1px solid #86efac" : "1px solid #fca5a5") : "1px solid #e5e7eb",
                    }}>
                      <span style={{ width: "14px", height: "14px", borderRadius: "50%", border: "1.5px solid #d1d5db" }} />
                      <span>{opt}</span>
                    </div>
                  ))}
                </div>
              )}

              {q.type === "essay" && (
                <div style={{ paddingRight: "34px" }}>
                  {showAnswers && q.correctAnswer ? (
                    <div style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", fontSize: "12px", color: "#166534", lineHeight: "1.8" }}>
                      <strong>نموذج الإجابة:</strong> {q.correctAnswer}
                    </div>
                  ) : (
                    <div style={{ borderBottom: "1px dashed #d1d5db", height: "60px" }} />
                  )}
                </div>
              )}

              {q.type === "fill-blank" && (
                <div style={{ paddingRight: "34px" }}>
                  {showAnswers && q.correctAnswer ? (
                    <span style={{ padding: "4px 12px", borderRadius: "4px", backgroundColor: "#dcfce7", color: "#166534", fontSize: "12px", fontWeight: "600" }}>
                      {q.correctAnswer}
                    </span>
                  ) : (
                    <span style={{ borderBottom: "2px dashed #d1d5db", display: "inline-block", width: "150px", height: "20px" }} />
                  )}
                </div>
              )}
            </div>
          );
        })}

        {questions.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <p style={{ fontSize: "14px" }}>لم يتم إضافة أسئلة بعد</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `2px solid ${theme.borderColor}`, padding: "12px 32px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
        <span>تم إنشاؤه بواسطة منصة SERS</span>
        <span>انتهت الأسئلة - مع تمنياتنا لكم بالتوفيق والنجاح</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function ExamBuilder() {
  const [, navigate] = useLocation();
  const [view, setView] = useState<"list" | "editor" | "preview">("list");
  const [exams, setExams] = useState<SavedExam[]>(loadExams);
  const [currentExam, setCurrentExam] = useState<SavedExam | null>(null);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("");
  const [grade, setGrade] = useState("");
  const [semester, setSemester] = useState("الأول");
  const [duration, setDuration] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>(THEMES[0]);
  const [selectedFont, setSelectedFont] = useState("Cairo");
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [showAnswers, setShowAnswers] = useState(false);

  const { containerRef: previewContainerRef, pageRef: previewPageRef, previewScale, wrapperWidth, wrapperHeight, zoomLevel, zoomIn, zoomOut, resetZoom } = usePreviewScale();

  const generateExamMutation = trpc.genAI.generateExamQuestions.useMutation();
  const totalPoints = useMemo(() => questions.reduce((s, q) => s + q.points, 0), [questions]);

  const startNew = useCallback(() => {
    setTitle(""); setSubject(""); setGrade(""); setSemester("الأول"); setDuration("");
    setQuestions([]); setCurrentExam(null); setView("editor");
  }, []);

  const editExam = useCallback((exam: SavedExam) => {
    setTitle(exam.title); setSubject(exam.subject); setGrade(exam.grade);
    setSemester(exam.semester); setDuration(exam.duration); setQuestions(exam.questions);
    setCurrentExam(exam);
    const t = THEMES.find((th) => th.id === exam.themeId);
    if (t) setSelectedTheme(t);
    if (exam.fontFamily) setSelectedFont(exam.fontFamily);
    setView("editor");
  }, []);

  const addQuestion = useCallback((type: QuestionType) => {
    const q: Question = { id: genId(), type, text: "", points: 1 };
    if (type === "multiple-choice") { q.options = ["", "", "", ""]; q.correctIndex = 0; }
    if (type === "true-false") { q.correctAnswer = "صح"; }
    setQuestions((prev) => [...prev, q]);
  }, []);

  const updateQuestion = useCallback((id: string, field: string, value: any) => {
    setQuestions((prev) => prev.map((q) => q.id === id ? { ...q, [field]: value } : q));
  }, []);

  const updateOption = useCallback((qId: string, index: number, value: string) => {
    setQuestions((prev) => prev.map((q) => {
      if (q.id !== qId || !q.options) return q;
      const opts = [...q.options]; opts[index] = value;
      return { ...q, options: opts };
    }));
  }, []);

  const removeQuestion = useCallback((id: string) => { setQuestions((prev) => prev.filter((q) => q.id !== id)); }, []);

  const moveQuestion = useCallback((index: number, dir: "up" | "down") => {
    setQuestions((prev) => {
      const arr = [...prev]; const target = dir === "up" ? index - 1 : index + 1;
      if (target < 0 || target >= arr.length) return prev;
      [arr[index], arr[target]] = [arr[target], arr[index]]; return arr;
    });
  }, []);

  const handleSave = useCallback(() => {
    const now = Date.now();
    const examTitle = title || `اختبار ${subject}`;
    if (currentExam) {
      const updated = exams.map((e) => e.id === currentExam.id ? { ...e, title: examTitle, subject, grade, semester, duration, themeId: selectedTheme.id, fontFamily: selectedFont, questions, createdAt: now } : e);
      setExams(updated); saveExamsToStorage(updated);
      setCurrentExam({ ...currentExam, title: examTitle, subject, grade, semester, duration, themeId: selectedTheme.id, fontFamily: selectedFont, questions, createdAt: now });
      toast.success("تم تحديث الاختبار بنجاح");
    } else {
      const newExam: SavedExam = { id: genId(), title: examTitle, subject, grade, semester, duration, themeId: selectedTheme.id, fontFamily: selectedFont, questions, createdAt: now };
      const updated = [newExam, ...exams]; setExams(updated); saveExamsToStorage(updated);
      setCurrentExam(newExam); toast.success("تم حفظ الاختبار بنجاح");
    }
  }, [currentExam, exams, title, subject, grade, semester, duration, selectedTheme, selectedFont, questions]);

  const handleDelete = useCallback((id: string) => {
    const updated = exams.filter((e) => e.id !== id); setExams(updated); saveExamsToStorage(updated); toast.success("تم حذف الاختبار");
  }, [exams]);

  const handleAIGenerate = useCallback(async () => {
    if (!subject || !grade) { toast.error("أدخل المادة والصف أولاً"); return; }
    setAiLoading(true);
    try {
      const result = await generateExamMutation.mutateAsync({
        subject, grade,
        topic: title || undefined,
        questionTypes: ["multiple-choice", "true-false", "essay"],
        count: 10,
        difficulty: "متوسط",
      });
      if (result.success && result.questions) {
        const newQuestions: Question[] = result.questions.map((q: any) => {
          const mapped: Question = { id: genId(), type: q.type || "essay", text: q.text || "", points: q.points || 1 };
          if (q.type === "multiple-choice" && q.options) { mapped.options = q.options; mapped.correctIndex = q.correctIndex ?? 0; }
          if (q.type === "true-false") { mapped.correctAnswer = q.correctAnswer || "صح"; }
          if (q.type === "essay" || q.type === "fill-blank") { mapped.correctAnswer = q.correctAnswer || ""; }
          return mapped;
        });
        setQuestions((prev) => [...prev, ...newQuestions]);
        toast.success(`تم توليد ${newQuestions.length} سؤال بالذكاء الاصطناعي`);
      }
    } catch { toast.error("حدث خطأ أثناء التوليد"); }
    finally { setAiLoading(false); }
  }, [subject, grade, title, generateExamMutation]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try { await exportToPDF("exam-preview-content", `${title || "اختبار"}.pdf`); toast.success("تم تصدير PDF بنجاح"); }
    catch { toast.error("حدث خطأ أثناء التصدير"); }
    finally { setExporting(false); }
  }, [title]);

  const handlePrint = useCallback(() => { try { printElement("exam-preview-content"); } catch { toast.error("حدث خطأ"); } }, []);

  const filteredExams = useMemo(() => {
    if (!searchQuery.trim()) return exams;
    const q = searchQuery.toLowerCase();
    return exams.filter((e) => e.title.includes(q) || e.subject.includes(q));
  }, [exams, searchQuery]);

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-[#F8FAFC]" dir="rtl">
      {/* Header */}
      <div className="w-full bg-gradient-to-l from-teal-700 via-teal-600 to-emerald-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
          </button>
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
              <ClipboardCheck className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>منصة الاختبارات</h1>
              <p className="text-white/80 text-sm mt-1">إنشاء اختبارات متنوعة مع دعم الذكاء الاصطناعي</p>
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
                <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>الاختبارات</h2>
                <div className="flex items-center gap-2">
                  <div className="relative w-48">
                    <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input type="text" placeholder="بحث..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pr-10 pl-3 py-2 rounded-lg bg-white border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <Button onClick={startNew} className="gap-1 bg-teal-600 hover:bg-teal-700 text-white">
                    <Plus className="w-4 h-4" /> اختبار جديد
                  </Button>
                </div>
              </div>
              {filteredExams.length === 0 ? (
                <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                  <ClipboardCheck className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <p className="text-gray-500 font-medium">لا توجد اختبارات محفوظة</p>
                  <Button onClick={startNew} variant="outline" size="sm" className="mt-3 gap-1"><Plus className="w-4 h-4" /> إنشاء اختبار جديد</Button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredExams.map((exam) => (
                    <div key={exam.id} className="bg-white rounded-xl border border-gray-100 p-5 group">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <h3 className="font-bold text-gray-800 text-sm">{exam.title}</h3>
                          <p className="text-xs text-gray-400 mt-1">{exam.subject} · {exam.grade} · {exam.questions.length} سؤال · {new Date(exam.createdAt).toLocaleDateString("ar-SA")}</p>
                        </div>
                        <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity">
                          <button onClick={() => editExam(exam)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-500" style={{ touchAction: 'manipulation' }}><Edit3 className="w-4 h-4" /></button>
                          <button onClick={() => handleDelete(exam.id)} className="p-1.5 rounded-lg hover:bg-red-50 text-red-400" style={{ touchAction: 'manipulation' }}><Trash2 className="w-4 h-4" /></button>
                        </div>
                      </div>
                      <div className="flex flex-wrap gap-1.5">
                        {QUESTION_TYPES.map((qt) => {
                          const count = exam.questions.filter((q) => q.type === qt.id).length;
                          if (count === 0) return null;
                          return <span key={qt.id} className="px-2 py-0.5 rounded-full text-[10px] font-medium" style={{ backgroundColor: qt.color + "12", color: qt.color }}>{qt.label}: {count}</span>;
                        })}
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
                  <span className="text-xs text-gray-500 bg-gray-100 px-2 py-1 rounded-full">{questions.length} سؤال · {totalPoints} درجة</span>
                  <Button onClick={handleAIGenerate} variant="outline" size="sm" disabled={aiLoading}
                    className="gap-1.5 border-purple-200 text-purple-600 hover:bg-purple-50">
                    {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                    {aiLoading ? "جاري التوليد..." : "توليد أسئلة AI"}
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

              {/* Exam info */}
              <div className="bg-white rounded-xl border border-gray-200 p-4 mb-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">عنوان الاختبار</label>
                    <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="اختبار نهائي..."
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">المادة</label>
                    <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="الرياضيات"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">الصف</label>
                    <input type="text" value={grade} onChange={(e) => setGrade(e.target.value)} placeholder="ثالث متوسط"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">الفصل الدراسي</label>
                    <select value={semester} onChange={(e) => setSemester(e.target.value)}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 bg-white">
                      <option value="الأول">الفصل الأول</option><option value="الثاني">الفصل الثاني</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1">مدة الاختبار</label>
                    <input type="text" value={duration} onChange={(e) => setDuration(e.target.value)} placeholder="ساعة ونصف"
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
                  </div>
                </div>
              </div>

              {/* Questions */}
              <div className="space-y-3 mb-4">
                {questions.map((q, index) => {
                  const qType = QUESTION_TYPES.find((t) => t.id === q.type);
                  const Icon = qType?.icon || HelpCircle;
                  const color = qType?.color || "#64748b";
                  return (
                    <div key={q.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100" style={{ backgroundColor: color + "06" }}>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveQuestion(index, "up")} disabled={index === 0} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronUp className="w-3 h-3" /></button>
                          <button onClick={() => moveQuestion(index, "down")} disabled={index === questions.length - 1} className="text-gray-400 hover:text-gray-600 disabled:opacity-30"><ChevronDown className="w-3 h-3" /></button>
                        </div>
                        <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: color + "15" }}>
                          <Icon className="w-4 h-4" style={{ color }} />
                        </div>
                        <span className="text-xs font-bold text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">س{index + 1}</span>
                        <span className="text-xs font-medium" style={{ color }}>{qType?.label}</span>
                        <div className="flex-1" />
                        <div className="flex items-center gap-1">
                          <input type="number" value={q.points} onChange={(e) => updateQuestion(q.id, "points", parseInt(e.target.value) || 1)} min={1}
                            className="w-12 px-1 py-0.5 rounded border border-gray-200 text-xs text-center focus:outline-none" />
                          <span className="text-[10px] text-gray-400">درجة</span>
                        </div>
                        <button onClick={() => removeQuestion(q.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                      </div>
                      <div className="p-4">
                        <textarea value={q.text} onChange={(e) => updateQuestion(q.id, "text", e.target.value)} placeholder="اكتب نص السؤال هنا..."
                          rows={2} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-gray-200 resize-y mb-3"
                          style={{ fontFamily: `'${selectedFont}', sans-serif` }} />

                        {q.type === "multiple-choice" && q.options && (
                          <div className="space-y-2">
                            {q.options.map((opt, i) => (
                              <div key={i} className="flex items-center gap-2">
                                <button onClick={() => updateQuestion(q.id, "correctIndex", i)}
                                  className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition-colors ${q.correctIndex === i ? "border-green-500 bg-green-500 text-white" : "border-gray-300 text-transparent"}`}>
                                  <CheckCircle2 className="w-3 h-3" />
                                </button>
                                <span className="text-xs text-gray-400 w-4">{String.fromCharCode(1571 + i)}</span>
                                <input type="text" value={opt} onChange={(e) => updateOption(q.id, i, e.target.value)} placeholder={`الخيار ${i + 1}`}
                                  className="flex-1 px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none" />
                              </div>
                            ))}
                          </div>
                        )}

                        {q.type === "true-false" && (
                          <div className="flex gap-3">
                            {["صح", "خطأ"].map((opt) => (
                              <button key={opt} onClick={() => updateQuestion(q.id, "correctAnswer", opt)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${q.correctAnswer === opt
                                    ? opt === "صح" ? "bg-green-100 text-green-700 border border-green-300" : "bg-red-100 text-red-700 border border-red-300"
                                    : "bg-gray-50 text-gray-500 border border-gray-200"
                                  }`}>
                                {opt === "صح" ? <CheckCircle2 className="w-4 h-4" /> : <XCircle className="w-4 h-4" />} {opt}
                              </button>
                            ))}
                          </div>
                        )}

                        {q.type === "fill-blank" && (
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">الإجابة الصحيحة:</label>
                            <input type="text" value={q.correctAnswer || ""} onChange={(e) => updateQuestion(q.id, "correctAnswer", e.target.value)} placeholder="الإجابة..."
                              className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none" />
                          </div>
                        )}

                        {q.type === "essay" && (
                          <div>
                            <label className="block text-[10px] text-gray-400 mb-1">نموذج الإجابة (اختياري):</label>
                            <textarea value={q.correctAnswer || ""} onChange={(e) => updateQuestion(q.id, "correctAnswer", e.target.value)} placeholder="نموذج الإجابة..."
                              rows={2} className="w-full px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none resize-y" />
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Add question */}
              <div className="bg-white rounded-xl border border-dashed border-gray-300 p-4">
                <p className="text-xs font-medium text-gray-500 mb-3">إضافة سؤال جديد:</p>
                <div className="flex flex-wrap gap-2">
                  {QUESTION_TYPES.map((qt) => {
                    const Icon = qt.icon;
                    return (
                      <button key={qt.id} onClick={() => addQuestion(qt.id)}
                        className="flex items-center gap-1.5 px-3 py-2.5 sm:py-1.5 rounded-lg text-xs font-medium border border-gray-200 hover:border-gray-300 transition-colors active:scale-95"
                        style={{ color: qt.color, touchAction: 'manipulation' }}>
                        <Icon className="w-3.5 h-3.5" /> {qt.label}
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
                    <span className="text-xs sm:text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة الاختبار</span>
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
                  <label className="flex items-center gap-1.5 text-xs text-gray-600 cursor-pointer px-2 py-1.5 rounded-lg hover:bg-gray-100 transition-colors shrink-0">
                    <input type="checkbox" checked={showAnswers} onChange={(e) => setShowAnswers(e.target.checked)} className="rounded border-gray-300" />
                    إظهار الإجابات
                  </label>
                  <Button variant="outline" size="sm" onClick={handlePrint} className="gap-1 text-xs h-8 shrink-0">
                    <Printer className="w-3.5 h-3.5" /><span className="hidden sm:inline">طباعة</span>
                  </Button>
                </div>
              </div>
              {/* Preview Content - A4 مضغوط بـ transform: scale() */}
              <div ref={previewContainerRef} className={`bg-gray-200 overflow-auto ${fullscreen ? "h-[calc(100vh-52px)]" : "max-h-[80vh] rounded-b-xl border-x border-b border-gray-200"}`} style={{ padding: '8px 4px', minHeight: '200px' }}>
                <div style={{ width: `${wrapperWidth}px`, height: `${wrapperHeight}px`, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ width: `${A4_WIDTH_PX}px`, transformOrigin: 'top right', transform: `scale(${previewScale})`, transition: 'transform 0.15s ease-out' }}>
                    <div id="exam-preview-content" ref={previewPageRef} style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', width: '210mm' }}>
                      <ExamPreview title={title} subject={subject} grade={grade} semester={semester} duration={duration}
                        questions={questions} theme={selectedTheme} fontFamily={selectedFont} showAnswers={showAnswers} />
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
