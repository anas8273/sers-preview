/**
 * السيرة الذاتية الذكية - SERS
 * إنشاء سيرة ذاتية احترافية للمعلم/الإداري
 * مع قوالب متعددة + تعبئة AI + معاينة حية + تصدير PDF
 */
import { useState, useCallback, useMemo } from "react";
import { useLocation } from "wouter";
import {
  ArrowLeft, User, Plus, Trash2, Save, Edit3,
  Briefcase, GraduationCap, Award, Phone, Mail, MapPin,
  Star, BookOpen, Sparkles, Loader2, Eye, Printer,
  FileDown, Maximize2, Minimize2, ChevronLeft, ZoomIn, ZoomOut, RotateCcw, ScanSearch, CircleCheck, CircleAlert, Languages, Gem
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import TemplateSelector, { THEMES, type ThemeConfig } from "@/components/TemplateSelector";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { usePreviewScale } from "@/hooks/usePreviewScale";

const A4_WIDTH_PX = 793.7;

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

interface CVEntry {
  id: string;
  title: string;
  organization: string;
  period: string;
  description: string;
}

interface CVData {
  name: string;
  title: string;
  phone: string;
  email: string;
  city: string;
  summary: string;
  experience: CVEntry[];
  education: CVEntry[];
  skills: string[];
  courses: CVEntry[];
  achievements: string[];
}

type CVLanguage = "ar" | "en";

export interface ATSCheck {
  id: string;
  section: "personal" | "experience" | "education" | "skills" | "courses" | "achievements";
  label: string;
  recommendation: string;
  complete: boolean;
  weight: number;
}

export function calculateATSReadiness(data: CVData) {
  const detailedExperiences = data.experience.filter((entry) => entry.title.trim() && entry.organization.trim() && entry.description.trim().length >= 40);
  const checks: ATSCheck[] = [
    { id: "identity", section: "personal", label: "الاسم والمسمى الوظيفي", recommendation: "أضف الاسم الكامل ومسمى وظيفياً محدداً ومتوافقاً مع الوظيفة المستهدفة.", complete: Boolean(data.name.trim() && data.title.trim()), weight: 15 },
    { id: "contact", section: "personal", label: "بيانات التواصل", recommendation: "أضف بريداً إلكترونياً ورقم جوالاً صالحين ليسهل على جهة العمل التواصل معك.", complete: Boolean(data.email.trim() && data.phone.trim()), weight: 15 },
    { id: "summary", section: "personal", label: "ملخص مهني واضح", recommendation: "اكتب ملخصاً مهنياً لا يقل عن 80 حرفاً يتضمن التخصص والقيمة التي تقدمها.", complete: data.summary.trim().length >= 80, weight: 15 },
    { id: "experience", section: "experience", label: "خبرات قابلة للقراءة", recommendation: "أضف خبرة واحدة على الأقل مع المسمى والجهة ووصف منجزات واضح.", complete: detailedExperiences.length > 0, weight: 20 },
    { id: "education", section: "education", label: "المؤهلات العلمية", recommendation: "أضف مؤهلاً علمياً واحداً على الأقل مع الجهة والفترة الزمنية.", complete: data.education.some((entry) => entry.title.trim() && entry.organization.trim()), weight: 15 },
    { id: "skills", section: "skills", label: "الكلمات المفتاحية والمهارات", recommendation: "أضف خمس مهارات مهنية أو تقنية محددة لتعزيز مطابقة الكلمات المفتاحية.", complete: data.skills.filter((skill) => skill.trim()).length >= 5, weight: 20 },
  ];
  return { score: checks.reduce((total, check) => total + (check.complete ? check.weight : 0), 0), checks, completed: checks.filter((check) => check.complete).length };
}

const STORAGE_KEY = "sers-cv-data";
function loadCV(): CVData {
  try { const s = localStorage.getItem(STORAGE_KEY); if (s) return JSON.parse(s); } catch {}
  return { name: "", title: "", phone: "", email: "", city: "", summary: "", experience: [], education: [], skills: [], courses: [], achievements: [] };
}
function saveCV(data: CVData) { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }

// ═══════════════════════════════════════════════════════════════
// CV Preview Templates
// ═══════════════════════════════════════════════════════════════

function CVPreview({ data, theme, fontFamily, language, platinum }: { data: CVData; theme: ThemeConfig; fontFamily: string; language: CVLanguage; platinum: boolean }) {
  const hasContent = data.name || data.title || data.summary || data.experience.length > 0;
  const accentColor = platinum ? "#B9912B" : theme.primaryColor;
  const headerBackground = platinum ? "linear-gradient(135deg, #0F172A 0%, #475569 52%, #B9912B 100%)" : `linear-gradient(135deg, ${theme.primaryColor}, ${theme.secondaryColor})`;
  const labels = language === "en"
    ? { name: "Full Name", title: "Professional Title", summary: "Professional Summary", experience: "Work Experience", education: "Education", skills: "Skills", courses: "Training & Courses", achievements: "Achievements & Awards", empty: "Start adding your details to preview your résumé", created: "Created with SERS", locale: "en-US" }
    : { name: "الاسم الكامل", title: "المسمى الوظيفي", summary: "الملخص المهني", experience: "الخبرات العملية", education: "المؤهلات العلمية", skills: "المهارات", courses: "الدورات التدريبية", achievements: "الإنجازات والجوائز", empty: "ابدأ بتعبئة بياناتك لعرض المعاينة", created: "تم إنشاؤه بواسطة منصة SERS", locale: "ar-SA" };

  return (
    <div style={{ width: "210mm", minHeight: "297mm", fontFamily: `'${fontFamily}', sans-serif`, direction: language === "ar" ? "rtl" : "ltr", background: "#fff" }}>
      {/* Header */}
      <div data-pdf-header style={{
        background: headerBackground,
        color: theme.headerText, padding: "32px", display: "flex", alignItems: "center", gap: "24px",
      }}>
        <div style={{
          width: "80px", height: "80px", borderRadius: "50%", backgroundColor: "rgba(255,255,255,0.15)",
          display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
        }}>
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="12" cy="7" r="4" />
          </svg>
        </div>
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: "26px", fontWeight: "800", margin: "0 0 4px", fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
            {data.name || labels.name}
          </h1>
          <p style={{ fontSize: "14px", opacity: 0.9, margin: "0 0 8px" }}>{data.title || labels.title}</p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", fontSize: "11px", opacity: 0.8 }}>
            {data.phone && <span>📱 {data.phone}</span>}
            {data.email && <span>✉️ {data.email}</span>}
            {data.city && <span>📍 {data.city}</span>}
          </div>
        </div>
      </div>

      <div style={{ padding: "24px 32px" }}>
        {/* Summary */}
        {data.summary && (
          <div style={{ marginBottom: "24px" }}>
              <h2 data-pdf-accent style={{ fontSize: "15px", fontWeight: "700", color: accentColor, marginBottom: "8px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {labels.summary}
            </h2>
            <p style={{ fontSize: "12px", lineHeight: "2", color: "#374151", whiteSpace: "pre-wrap" }}>{data.summary}</p>
          </div>
        )}

        {/* Experience */}
        {data.experience.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 data-pdf-accent style={{ fontSize: "15px", fontWeight: "700", color: theme.primaryColor, marginBottom: "12px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {labels.experience}
            </h2>
            {data.experience.map((e) => (
              <div key={e.id} style={{ marginBottom: "14px", paddingRight: "12px", borderRight: `3px solid ${theme.primaryColor}30` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#1f2937", margin: 0 }}>{e.title}</h3>
                  <span style={{ fontSize: "10px", color: "#9ca3af" }}>{e.period}</span>
                </div>
                <p style={{ fontSize: "11px", color: theme.primaryColor, margin: "2px 0 4px", fontWeight: "600" }}>{e.organization}</p>
                {e.description && <p style={{ fontSize: "11px", lineHeight: "1.8", color: "#6b7280", margin: 0 }}>{e.description}</p>}
              </div>
            ))}
          </div>
        )}

        {/* Education */}
        {data.education.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 data-pdf-accent style={{ fontSize: "15px", fontWeight: "700", color: theme.primaryColor, marginBottom: "12px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {labels.education}
            </h2>
            {data.education.map((e) => (
              <div key={e.id} style={{ marginBottom: "10px", paddingRight: "12px", borderRight: `3px solid ${theme.primaryColor}30` }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <h3 style={{ fontSize: "13px", fontWeight: "700", color: "#1f2937", margin: 0 }}>{e.title}</h3>
                  <span style={{ fontSize: "10px", color: "#9ca3af" }}>{e.period}</span>
                </div>
                <p style={{ fontSize: "11px", color: theme.primaryColor, margin: "2px 0", fontWeight: "600" }}>{e.organization}</p>
              </div>
            ))}
          </div>
        )}

        {/* Skills */}
        {data.skills.filter(Boolean).length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 data-pdf-accent style={{ fontSize: "15px", fontWeight: "700", color: theme.primaryColor, marginBottom: "12px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {labels.skills}
            </h2>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {data.skills.filter(Boolean).map((s, i) => (
                <span key={i} style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "11px", fontWeight: "600", backgroundColor: theme.primaryColor + "12", color: theme.primaryColor, border: `1px solid ${theme.primaryColor}25` }}>
                  {s}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Courses */}
        {data.courses.length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 data-pdf-accent style={{ fontSize: "15px", fontWeight: "700", color: theme.primaryColor, marginBottom: "12px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {labels.courses}
            </h2>
            {data.courses.map((c) => (
              <div key={c.id} style={{ marginBottom: "8px", display: "flex", justifyContent: "space-between" }}>
                <div>
                  <span style={{ fontSize: "12px", fontWeight: "600", color: "#1f2937" }}>{c.title}</span>
                  <span style={{ fontSize: "11px", color: "#6b7280", marginRight: "8px" }}>- {c.organization}</span>
                </div>
                <span style={{ fontSize: "10px", color: "#9ca3af" }}>{c.period}</span>
              </div>
            ))}
          </div>
        )}

        {/* Achievements */}
        {data.achievements.filter(Boolean).length > 0 && (
          <div style={{ marginBottom: "24px" }}>
            <h2 data-pdf-accent style={{ fontSize: "15px", fontWeight: "700", color: theme.primaryColor, marginBottom: "12px", paddingBottom: "6px", borderBottom: `2px solid ${theme.borderColor}`, fontFamily: `'Tajawal', '${fontFamily}', sans-serif` }}>
              {labels.achievements}
            </h2>
            {data.achievements.filter(Boolean).map((a, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <span style={{ color: "#f59e0b", fontSize: "14px" }}>🏆</span>
                <span style={{ fontSize: "12px", color: "#374151" }}>{a}</span>
              </div>
            ))}
          </div>
        )}

        {!hasContent && (
          <div style={{ textAlign: "center", padding: "60px 0", color: "#9ca3af" }}>
            <p style={{ fontSize: "14px" }}>{labels.empty}</p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ borderTop: `2px solid ${theme.borderColor}`, padding: "12px 32px", display: "flex", justifyContent: "space-between", fontSize: "10px", color: "#9ca3af" }}>
        <span>{labels.created}</span>
        <span>{new Date().toLocaleDateString(labels.locale)}</span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Component
// ═══════════════════════════════════════════════════════════════

export default function SmartCV() {
  const [, navigate] = useLocation();
  const [cvData, setCvData] = useState<CVData>(loadCV);
  const [activeSection, setActiveSection] = useState("personal");
  const [selectedTheme, setSelectedTheme] = useState<ThemeConfig>(THEMES[0]);
  const [selectedFont, setSelectedFont] = useState("Cairo");
  const [previewLanguage, setPreviewLanguage] = useState<CVLanguage>("ar");
  const [platinumStyle, setPlatinumStyle] = useState(false);
  const [view, setView] = useState<"editor" | "preview">("editor");
  const [aiLoading, setAiLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [fullscreen, setFullscreen] = useState(false);
  const atsReadiness = useMemo(() => calculateATSReadiness(cvData), [cvData]);

  const { containerRef: previewContainerRef, pageRef: previewPageRef, previewScale, wrapperWidth, wrapperHeight, zoomLevel, zoomIn, zoomOut, resetZoom } = usePreviewScale();

  const generateCVMutation = trpc.genAI.generateCV.useMutation();

  const updateField = useCallback((field: keyof CVData, value: any) => {
    setCvData((prev) => ({ ...prev, [field]: value }));
  }, []);

  const addEntry = useCallback((field: "experience" | "education" | "courses") => {
    setCvData((prev) => ({ ...prev, [field]: [...prev[field], { id: genId(), title: "", organization: "", period: "", description: "" }] }));
  }, []);

  const updateEntry = useCallback((field: "experience" | "education" | "courses", id: string, key: keyof CVEntry, value: string) => {
    setCvData((prev) => ({ ...prev, [field]: prev[field].map((e) => e.id === id ? { ...e, [key]: value } : e) }));
  }, []);

  const removeEntry = useCallback((field: "experience" | "education" | "courses", id: string) => {
    setCvData((prev) => ({ ...prev, [field]: prev[field].filter((e) => e.id !== id) }));
  }, []);

  const addSkill = useCallback(() => { setCvData((prev) => ({ ...prev, skills: [...prev.skills, ""] })); }, []);
  const updateSkill = useCallback((i: number, v: string) => { setCvData((prev) => ({ ...prev, skills: prev.skills.map((s, idx) => idx === i ? v : s) })); }, []);
  const removeSkill = useCallback((i: number) => { setCvData((prev) => ({ ...prev, skills: prev.skills.filter((_, idx) => idx !== i) })); }, []);

  const addAchievement = useCallback(() => { setCvData((prev) => ({ ...prev, achievements: [...prev.achievements, ""] })); }, []);
  const updateAchievement = useCallback((i: number, v: string) => { setCvData((prev) => ({ ...prev, achievements: prev.achievements.map((a, idx) => idx === i ? v : a) })); }, []);
  const removeAchievement = useCallback((i: number) => { setCvData((prev) => ({ ...prev, achievements: prev.achievements.filter((_, idx) => idx !== i) })); }, []);

  const handleSave = useCallback(() => { saveCV(cvData); toast.success("تم حفظ السيرة الذاتية بنجاح"); }, [cvData]);

  const handleAIFill = useCallback(async () => {
    if (!cvData.name && !cvData.title) { toast.error("أدخل الاسم والمسمى الوظيفي أولاً"); return; }
    setAiLoading(true);
    try {
      const result = await generateCVMutation.mutateAsync({
        name: cvData.name,
        jobTitle: cvData.title,
        experience: cvData.experience.map((e) => e.title).filter(Boolean).join(", ") || undefined,
        education: cvData.education.map((e) => e.title).filter(Boolean).join(", ") || undefined,
        skills: cvData.skills.filter(Boolean).join(", ") || undefined,
      });
      if (result.success && result.cvData) {
        const ai = result.cvData as any;
        setCvData((prev) => ({
          ...prev,
          summary: ai.summary || prev.summary,
          experience: ai.experience?.length ? ai.experience.map((e: any) => ({ id: genId(), ...e })) : prev.experience,
          education: ai.education?.length ? ai.education.map((e: any) => ({ id: genId(), ...e })) : prev.education,
          skills: ai.skills?.length ? ai.skills : prev.skills,
          courses: ai.courses?.length ? ai.courses.map((c: any) => ({ id: genId(), ...c })) : prev.courses,
          achievements: ai.achievements?.length ? ai.achievements : prev.achievements,
        }));
        toast.success("تم توليد السيرة الذاتية بالذكاء الاصطناعي");
      }
    } catch { toast.error("حدث خطأ أثناء التوليد"); }
    finally { setAiLoading(false); }
  }, [cvData, generateCVMutation]);

  const handleExportPDF = useCallback(async () => {
    setExporting(true);
    try { await exportToPDF("cv-preview-content", `${cvData.name || "سيرة-ذاتية"}.pdf`); toast.success("تم تصدير PDF بنجاح"); }
    catch { toast.error("حدث خطأ أثناء التصدير"); }
    finally { setExporting(false); }
  }, [cvData.name]);

  const handlePrint = useCallback(() => { try { printElement("cv-preview-content"); } catch { toast.error("حدث خطأ"); } }, []);

  const sections = [
    { id: "personal", label: "البيانات الشخصية", icon: User },
    { id: "experience", label: "الخبرات", icon: Briefcase },
    { id: "education", label: "المؤهلات", icon: GraduationCap },
    { id: "skills", label: "المهارات", icon: Star },
    { id: "courses", label: "الدورات", icon: BookOpen },
    { id: "achievements", label: "الإنجازات", icon: Award },
  ];

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-[#F8FAFC]" dir="rtl">
      {/* Header */}
      <div className="w-full bg-gradient-to-l from-teal-700 via-teal-600 to-emerald-500">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-white/70 hover:text-white mb-3 transition-colors">
            <ChevronLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
          </button>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-2xl bg-white/15 backdrop-blur-sm flex items-center justify-center">
                <User className="w-7 h-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-black text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>السيرة الذاتية الذكية</h1>
                <p className="text-white/80 text-sm mt-1">إنشاء سيرة ذاتية احترافية مع دعم الذكاء الاصطناعي</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button onClick={handleAIFill} variant="outline" size="sm" disabled={aiLoading}
                className="gap-1.5 text-white border-white/30 hover:bg-white/10">
                {aiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                {aiLoading ? "جاري التوليد..." : "تعبئة AI"}
              </Button>
              <Button onClick={handleSave} variant="outline" size="sm" className="gap-1 text-white border-white/30 hover:bg-white/10">
                <Save className="w-4 h-4" /> حفظ
              </Button>
              {view === "editor" ? (
                <Button onClick={() => setView("preview")} size="sm" className="gap-1 bg-white text-teal-800 hover:bg-gray-100">
                  <Eye className="w-4 h-4" /> معاينة وتصدير
                </Button>
              ) : (
                <Button onClick={() => { setView("editor"); setFullscreen(false); }} size="sm" className="gap-1 bg-white text-teal-800 hover:bg-gray-100">
                  <Edit3 className="w-4 h-4" /> تعديل
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        <>
          {/* ═══ Editor View ═══ */}
          {view === "editor" && (
            <div key="editor">
              {/* Theme Selector */}
              <div className="mb-4">
                <TemplateSelector selectedTheme={selectedTheme} onThemeChange={setSelectedTheme} selectedFont={selectedFont} onFontChange={setSelectedFont} compact />
              </div>

              <section className="mb-4 flex flex-col gap-3 rounded-xl border border-slate-200 bg-gradient-to-l from-slate-50 to-white p-3 sm:flex-row sm:items-center sm:justify-between" aria-label="خيارات قالب ولغة السيرة">
                <div className="flex items-center gap-2">
                  <div className="grid h-9 w-9 place-items-center rounded-lg bg-slate-900 text-amber-300"><Gem className="h-4 w-4" /></div>
                  <div><h2 className="text-xs font-bold text-slate-800">القالب البلاتيني الثنائي</h2><p className="text-[10px] text-slate-500">تخطيط رسمي مهيأ للعربية والإنجليزية.</p></div>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="flex rounded-lg border border-slate-200 bg-white p-0.5" role="group" aria-label="لغة المعاينة">
                    <button type="button" onClick={() => setPreviewLanguage("ar")} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${previewLanguage === "ar" ? "bg-teal-600 text-white" : "text-slate-600"}`}>العربية</button>
                    <button type="button" onClick={() => setPreviewLanguage("en")} className={`rounded-md px-2.5 py-1 text-[11px] font-bold ${previewLanguage === "en" ? "bg-teal-600 text-white" : "text-slate-600"}`}>English</button>
                  </div>
                  <button type="button" onClick={() => setPlatinumStyle((value) => !value)} className={`flex items-center gap-1 rounded-lg border px-2.5 py-1.5 text-[11px] font-bold ${platinumStyle ? "border-amber-400 bg-amber-50 text-amber-800" : "border-slate-200 bg-white text-slate-600"}`}><Gem className="h-3.5 w-3.5" />{platinumStyle ? "البلاتيني مفعّل" : "تفعيل البلاتيني"}</button>
                </div>
              </section>

              <section className="mb-4 overflow-hidden rounded-xl border border-indigo-100 bg-gradient-to-l from-indigo-50 to-white p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <div className="grid h-12 w-12 shrink-0 place-items-center rounded-xl bg-indigo-100 text-indigo-700"><ScanSearch className="h-6 w-6" /></div>
                    <div>
                      <h2 className="text-sm font-bold text-slate-800">جاهزية السيرة الذاتية لأنظمة ATS</h2>
                      <p className="mt-0.5 text-[11px] leading-5 text-slate-500">فحص إرشادي لبنية السيرة وبياناتها الأساسية قبل التصدير أو التقديم.</p>
                    </div>
                  </div>
                  <div className="rounded-lg bg-white px-4 py-2 text-center shadow-sm ring-1 ring-indigo-100"><strong className="text-2xl font-black text-indigo-700">{atsReadiness.score}%</strong><span className="mr-1 text-[10px] text-slate-500">جاهزية</span></div>
                </div>
                <div className="mt-3 grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                  {atsReadiness.checks.map((check) => (
                    <button key={check.id} type="button" onClick={() => setActiveSection(check.section)} className={`flex items-start gap-1.5 rounded-lg border px-2.5 py-2 text-right transition-colors ${check.complete ? "border-emerald-100 bg-emerald-50/70" : "border-amber-100 bg-amber-50/60 hover:border-amber-300"}`}>
                      {check.complete ? <CircleCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                      <span><span className="block text-[11px] font-semibold text-slate-700">{check.label}</span>{!check.complete && <span className="mt-0.5 block text-[10px] leading-4 text-slate-500">{check.recommendation}</span>}</span>
                    </button>
                  ))}
                </div>
              </section>

              {/* Section tabs */}
              <div className="flex flex-wrap gap-1.5 mb-4">
                {sections.map((sec) => {
                  const Icon = sec.icon;
                  return (
                    <button key={sec.id} onClick={() => setActiveSection(sec.id)}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all ${
                        activeSection === sec.id ? "bg-teal-700 text-white" : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
                      }`}>
                      <Icon className="w-3.5 h-3.5" /> {sec.label}
                    </button>
                  );
                })}
              </div>

              {/* Section content */}
              <>
                <div key={activeSection}
                  className="bg-white rounded-xl border border-gray-200 p-5">
                  {activeSection === "personal" && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">الاسم الكامل</label>
                        <input type="text" value={cvData.name} onChange={(e) => updateField("name", e.target.value)} placeholder="محمد أحمد العلي"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">المسمى الوظيفي</label>
                        <input type="text" value={cvData.title} onChange={(e) => updateField("title", e.target.value)} placeholder="معلم رياضيات"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">رقم الجوال</label>
                        <input type="text" value={cvData.phone} onChange={(e) => updateField("phone", e.target.value)} placeholder="05XXXXXXXX"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">البريد الإلكتروني</label>
                        <input type="email" value={cvData.email} onChange={(e) => updateField("email", e.target.value)} placeholder="email@example.com"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-500 mb-1">المدينة</label>
                        <input type="text" value={cvData.city} onChange={(e) => updateField("city", e.target.value)} placeholder="الرياض"
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20" />
                      </div>
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-500 mb-1">نبذة مختصرة</label>
                        <textarea value={cvData.summary} onChange={(e) => updateField("summary", e.target.value)}
                          placeholder="نبذة مختصرة عن خبراتك وتخصصك..." rows={3}
                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-slate-500/20 resize-y" />
                      </div>
                    </div>
                  )}

                  {(activeSection === "experience" || activeSection === "education" || activeSection === "courses") && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                          {sections.find((s) => s.id === activeSection)?.label}
                        </h3>
                        <Button onClick={() => addEntry(activeSection as any)} variant="outline" size="sm" className="gap-1">
                          <Plus className="w-3 h-3" /> إضافة
                        </Button>
                      </div>
                      <div className="space-y-3">
                        {cvData[activeSection as "experience" | "education" | "courses"].map((entry) => (
                          <div key={entry.id} className="border border-gray-100 rounded-lg p-3">
                            <div className="flex items-center justify-between mb-2">
                              <input type="text" value={entry.title} onChange={(e) => updateEntry(activeSection as any, entry.id, "title", e.target.value)}
                                placeholder="المسمى / الدرجة" className="flex-1 bg-transparent text-sm font-bold text-gray-800 focus:outline-none" />
                              <button onClick={() => removeEntry(activeSection as any, entry.id)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-4 h-4" /></button>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <input type="text" value={entry.organization} onChange={(e) => updateEntry(activeSection as any, entry.id, "organization", e.target.value)}
                                placeholder="الجهة / المؤسسة" className="px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none" />
                              <input type="text" value={entry.period} onChange={(e) => updateEntry(activeSection as any, entry.id, "period", e.target.value)}
                                placeholder="الفترة (من - إلى)" className="px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none" />
                            </div>
                            <textarea value={entry.description} onChange={(e) => updateEntry(activeSection as any, entry.id, "description", e.target.value)}
                              placeholder="وصف مختصر..." rows={2} className="w-full mt-2 px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none resize-none" />
                          </div>
                        ))}
                        {cvData[activeSection as "experience" | "education" | "courses"].length === 0 && (
                          <p className="text-center text-gray-400 text-sm py-6">لا توجد عناصر. اضغط "إضافة" للبدء.</p>
                        )}
                      </div>
                    </div>
                  )}

                  {activeSection === "skills" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>المهارات</h3>
                        <Button onClick={addSkill} variant="outline" size="sm" className="gap-1"><Plus className="w-3 h-3" /> إضافة</Button>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {cvData.skills.map((skill, i) => (
                          <div key={i} className="flex items-center gap-1 bg-gray-50 rounded-lg px-2 py-1 border border-gray-200">
                            <input type="text" value={skill} onChange={(e) => updateSkill(i, e.target.value)} placeholder="مهارة..."
                              className="bg-transparent text-xs w-28 focus:outline-none" />
                            <button onClick={() => removeSkill(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {activeSection === "achievements" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>الإنجازات</h3>
                        <Button onClick={addAchievement} variant="outline" size="sm" className="gap-1"><Plus className="w-3 h-3" /> إضافة</Button>
                      </div>
                      <div className="space-y-2">
                        {cvData.achievements.map((ach, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <Award className="w-4 h-4 text-amber-500 shrink-0" />
                            <input type="text" value={ach} onChange={(e) => updateAchievement(i, e.target.value)} placeholder="إنجاز أو جائزة..."
                              className="flex-1 px-2 py-1.5 rounded-md border border-gray-200 text-xs focus:outline-none" />
                            <button onClick={() => removeAchievement(i)} className="text-gray-400 hover:text-red-500"><Trash2 className="w-3 h-3" /></button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </>
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
                    <span className="text-xs sm:text-sm font-semibold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>معاينة السيرة الذاتية</span>
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
              <div ref={previewContainerRef} className={`bg-gray-200 overflow-auto ${fullscreen ? "h-[calc(100vh-52px)]" : "max-h-[80vh] rounded-b-xl border-x border-b border-gray-200"}`} style={{ padding: '8px 4px', minHeight: '200px' }}>
                <div style={{ width: `${wrapperWidth}px`, height: `${wrapperHeight}px`, margin: '0 auto', position: 'relative', overflow: 'hidden' }}>
                  <div style={{ width: `${A4_WIDTH_PX}px`, transformOrigin: 'top right', transform: `scale(${previewScale})`, transition: 'transform 0.15s ease-out' }}>
                    <div id="cv-preview-content" ref={previewPageRef} style={{ fontFamily: "'Cairo', sans-serif", direction: 'rtl', width: '210mm' }}>
                      <CVPreview data={cvData} theme={selectedTheme} fontFamily={selectedFont} language={previewLanguage} platinum={platinumStyle} />
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
