/**
 * شواهد الأداء الوظيفي - على نمط منصة معياري
 * رفع شواهد → تصنيف AI تلقائي → تحليل فجوات → ملف إنجاز PDF
 */
import { useState, useMemo, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowRight, ArrowLeft, Upload, Sparkles, Download, Eye,
  ChevronDown, ChevronUp, Plus, Loader2, BarChart3, FileText,
  Printer, Save, Home, X, CheckCircle, AlertTriangle, XCircle,
  Image, Link as LinkIcon, Video, QrCode, Trash2, Wand2,
  PlusCircle, Settings, User, BookOpen, Lightbulb
} from "lucide-react";
import {
  STANDARDS, TOTAL_INDICATORS,
  getStandardProgress, getOverallProgress, getStandardStatus,
  type Evidence, type UserProfile, type Standard
} from "@/lib/standards-data";
import EvidenceUploader from "@/components/evidence/EvidenceUploader";
import EvidenceCard from "@/components/evidence/EvidenceCard";
import GapAnalysis from "@/components/evidence/GapAnalysis";
import PortfolioPreview from "@/components/evidence/PortfolioPreview";
import { generateQRDataURL } from "@/lib/qr-utils";

// ===== الثيمات =====
const THEMES = [
  { id: "emerald", name: "أخضر رسمي", headerBg: "linear-gradient(135deg, #064E3B, #059669)", headerText: "#fff", accent: "#059669", borderColor: "#D1D5DB" },
  { id: "navy", name: "أزرق كلاسيكي", headerBg: "linear-gradient(135deg, #1E3A5F, #2563EB)", headerText: "#fff", accent: "#2563EB", borderColor: "#D1D5DB" },
  { id: "purple", name: "بنفسجي عصري", headerBg: "linear-gradient(135deg, #4C1D95, #7C3AED)", headerText: "#fff", accent: "#7C3AED", borderColor: "#D1D5DB" },
  { id: "warm", name: "ذهبي دافئ", headerBg: "linear-gradient(135deg, #78350F, #D97706)", headerText: "#fff", accent: "#D97706", borderColor: "#D1D5DB" },
  { id: "minimal", name: "أبيض بسيط", headerBg: "linear-gradient(135deg, #374151, #6B7280)", headerText: "#fff", accent: "#374151", borderColor: "#E5E7EB" },
];

type Step = "profile" | "dashboard" | "standard-detail" | "preview";

// ===== حفظ/استرجاع من localStorage =====
function loadSaved<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch { return fallback; }
}

function saveTo(key: string, data: unknown) {
  try { localStorage.setItem(key, JSON.stringify(data)); } catch {}
}

// ===== nanoid بسيط =====
function nid() {
  return Math.random().toString(36).substring(2, 10) + Date.now().toString(36);
}

export default function PerformanceEvidence() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<Step>(() => {
    const saved = loadSaved<UserProfile>("sers-profile", { name: "", school: "", subject: "", grade: "", year: "1447", role: "معلم" });
    return saved.name ? "dashboard" : "profile";
  });

  // البيانات الشخصية
  const [profile, setProfile] = useState<UserProfile>(() =>
    loadSaved("sers-profile", { name: "", school: "", subject: "", grade: "", year: "1447", role: "معلم" })
  );

  // الشواهد
  const [evidences, setEvidences] = useState<Evidence[]>(() => loadSaved("sers-evidences", []));

  // الثيم
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);

  // المعيار المحدد
  const [selectedStandardId, setSelectedStandardId] = useState<string | null>(null);

  // حالة التصنيف
  const [isClassifying, setIsClassifying] = useState(false);

  // AI mutations
  const classifyMutation = trpc.ai.classifyEvidence.useMutation();
  const suggestMutation = trpc.ai.suggest.useMutation();
  const gapsMutation = trpc.ai.analyzeGaps.useMutation();

  // حفظ تلقائي
  const saveEvidences = useCallback((newEvidences: Evidence[]) => {
    setEvidences(newEvidences);
    saveTo("sers-evidences", newEvidences);
  }, []);

  const saveProfile = useCallback((newProfile: UserProfile) => {
    setProfile(newProfile);
    saveTo("sers-profile", newProfile);
  }, []);

  // إحصائيات
  const overall = useMemo(() => getOverallProgress(evidences), [evidences]);

  // إضافة شاهد مع تصنيف AI تلقائي
  const addEvidence = useCallback(async (ev: Omit<Evidence, "id" | "createdAt">, autoClassify = true) => {
    const newEv: Evidence = { ...ev, id: nid(), createdAt: Date.now() };

    // إذا كان الشاهد يحتاج تصنيف تلقائي (بدون معيار محدد)
    if (autoClassify && ev.standardId === "auto") {
      setIsClassifying(true);
      try {
        const result = await classifyMutation.mutateAsync({
          description: ev.title,
          fileName: ev.title,
          fileType: ev.type,
        });
        if (result.success && result.classification) {
          const c = result.classification;
          const stdId = c.standardId;
          const std = STANDARDS.find(s => s.id === stdId);
          if (std) {
            const indIdx = Math.min(Math.max((c.indicatorIndex || 1) - 1, 0), std.indicators.length - 1);
            newEv.standardId = stdId;
            newEv.indicatorId = std.indicators[indIdx].id;
            toast.success(`تم تصنيف الشاهد تلقائياً`, {
              description: `${std.title} → ${std.indicators[indIdx].text.substring(0, 50)}...`,
            });
          }
        }
      } catch (err) {
        toast.error("تعذر التصنيف التلقائي، يرجى التصنيف يدوياً");
      }
      setIsClassifying(false);
    }

    saveEvidences([...evidences, newEv]);
  }, [evidences, classifyMutation, saveEvidences]);

  // إضافة شاهد لمعيار/مؤشر محدد
  const addEvidenceToIndicator = useCallback((standardId: string, indicatorId: string, ev: Omit<Evidence, "id" | "createdAt">) => {
    const newEv: Evidence = {
      ...ev,
      id: nid(),
      createdAt: Date.now(),
      standardId,
      indicatorId,
    };
    saveEvidences([...evidences, newEv]);
    toast.success("تم إضافة الشاهد بنجاح");
  }, [evidences, saveEvidences]);

  // حذف شاهد
  const removeEvidence = useCallback((id: string) => {
    saveEvidences(evidences.filter(e => e.id !== id));
    toast.info("تم حذف الشاهد");
  }, [evidences, saveEvidences]);

  // تبديل عرض الصورة (صورة/QR)
  const toggleDisplay = useCallback((id: string) => {
    const updated = evidences.map(e =>
      e.id === id ? { ...e, displayAs: (e.displayAs === "image" ? "qr" : "image") as "image" | "qr" } : e
    );
    saveEvidences(updated);
  }, [evidences, saveEvidences]);

  // تصدير PDF
  const handleExportPDF = useCallback(async () => {
    const el = document.getElementById("portfolio-preview");
    if (!el) return;
    toast.info("جاري تصدير الملف...");
    try {
      const html2canvas = (await import("html2canvas")).default;
      const jsPDF = (await import("jspdf")).default;
      const canvas = await html2canvas(el, { scale: 2, useCORS: true, logging: false });
      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const pdf = new jsPDF("p", "mm", "a4");
      const pW = pdf.internal.pageSize.getWidth();
      const pH = pdf.internal.pageSize.getHeight();
      const imgW = pW;
      const imgH = (canvas.height * pW) / canvas.width;
      let y = 0;
      while (y < imgH) {
        if (y > 0) pdf.addPage();
        pdf.addImage(imgData, "JPEG", 0, -y, imgW, imgH);
        y += pH;
      }
      pdf.save(`شواهد_الأداء_${profile.name || "ملف"}_${profile.year}.pdf`);
      toast.success("تم تصدير الملف بنجاح");
    } catch (err) {
      toast.error("حدث خطأ أثناء التصدير");
    }
  }, [profile]);

  // طباعة
  const handlePrint = useCallback(() => {
    const el = document.getElementById("portfolio-preview");
    if (!el) return;
    const w = window.open("", "_blank");
    if (!w) return;
    w.document.write(`
      <html dir="rtl"><head>
        <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;700;900&family=Tajawal:wght@400;700;900&display=swap" rel="stylesheet">
        <style>body{margin:0;font-family:'Cairo','Tajawal',sans-serif} @media print{.page-break-inside-avoid{page-break-inside:avoid}}</style>
      </head><body>${el.innerHTML}</body></html>
    `);
    w.document.close();
    w.onload = () => { w.print(); w.close(); };
  }, []);

  // ===== Step 1: البيانات الشخصية =====
  if (step === "profile") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <div className="max-w-lg mx-auto">
          <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-6">
            <ArrowRight className="w-4 h-4" />الرئيسية
          </button>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200 p-6 shadow-sm"
          >
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-3">
                <User className="w-8 h-8 text-emerald-600" />
              </div>
              <h1 className="text-2xl font-black text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                ملف شواهد الأداء الوظيفي
              </h1>
              <p className="text-sm text-gray-500 mt-1">أدخل بياناتك لبدء إنشاء ملف الإنجاز</p>
            </div>

            <div className="space-y-4">
              {[
                { key: "name", label: "الاسم الكامل", placeholder: "أدخل اسمك الرباعي" },
                { key: "school", label: "المدرسة", placeholder: "اسم المدرسة" },
                { key: "subject", label: "المادة", placeholder: "المادة الدراسية" },
                { key: "grade", label: "الصف", placeholder: "الصف الدراسي" },
                { key: "role", label: "الوظيفة", placeholder: "معلم / وكيل / مرشد" },
                { key: "year", label: "العام الدراسي", placeholder: "1447" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={(profile as any)[field.key]}
                    onChange={(e) => setProfile(p => ({ ...p, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  />
                </div>
              ))}
            </div>

            <button
              onClick={() => {
                if (!profile.name.trim()) {
                  toast.error("يرجى إدخال الاسم");
                  return;
                }
                saveProfile(profile);
                setStep("dashboard");
              }}
              className="w-full mt-6 py-3 rounded-xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
            >
              <Sparkles className="w-4 h-4" />
              بدء إنشاء ملف الإنجاز
            </button>
          </motion.div>
        </div>
      </div>
    );
  }

  // ===== Step 2: لوحة التحكم الرئيسية (على نمط معياري) =====
  if (step === "dashboard") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => navigate("/")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
              <Home className="w-4 h-4" />الرئيسية
            </button>
            <div className="flex gap-2">
              <button onClick={() => setStep("profile")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
                <Settings className="w-4 h-4" />البيانات
              </button>
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-bold hover:bg-emerald-700"
              >
                <Eye className="w-4 h-4" />معاينة وتصدير
              </button>
            </div>
          </div>

          {/* ترحيب + نسبة الجاهزية */}
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-2xl border border-gray-200 p-6 mb-5"
          >
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <h1 className="text-xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                  مرحباً، {profile.name.split(" ")[0]}
                </h1>
                <p className="text-sm text-gray-500">
                  {profile.role} · {profile.school} · {profile.year}
                </p>
              </div>
              <div className="text-center">
                <div className="relative w-20 h-20">
                  <svg className="w-20 h-20 -rotate-90" viewBox="0 0 80 80">
                    <circle cx="40" cy="40" r="35" fill="none" stroke="#E5E7EB" strokeWidth="6" />
                    <circle
                      cx="40" cy="40" r="35" fill="none"
                      stroke={overall.percentage >= 80 ? "#059669" : overall.percentage >= 50 ? "#D97706" : "#EF4444"}
                      strokeWidth="6"
                      strokeLinecap="round"
                      strokeDasharray={`${(overall.percentage / 100) * 220} 220`}
                    />
                  </svg>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-lg font-black text-gray-900">{overall.percentage}%</span>
                  </div>
                </div>
                <p className="text-[10px] text-gray-500 mt-1">نسبة الجاهزية</p>
              </div>
            </div>

            {/* إحصائيات سريعة */}
            <div className="grid grid-cols-4 gap-3 mt-4">
              <div className="bg-gray-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-gray-900">{evidences.length}</p>
                <p className="text-[10px] text-gray-500">شاهد مرفوع</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-emerald-600">{overall.coveredIndicators}</p>
                <p className="text-[10px] text-gray-500">مؤشر مغطى</p>
              </div>
              <div className="bg-emerald-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-emerald-600">{overall.coveredStandards}</p>
                <p className="text-[10px] text-gray-500">معيار مكتمل</p>
              </div>
              <div className="bg-red-50 rounded-xl p-3 text-center">
                <p className="text-lg font-black text-red-500">{overall.missingStandards}</p>
                <p className="text-[10px] text-gray-500">معيار مفقود</p>
              </div>
            </div>
          </motion.div>

          {/* زر الرفع السريع مع تصنيف AI */}
          <QuickUploadSection
            onAdd={(ev) => addEvidence(ev, true)}
            isClassifying={isClassifying}
          />

          {/* تحليل الفجوات */}
          <div className="mt-5">
            <GapAnalysis
              evidences={evidences}
              onSelectStandard={(id) => {
                setSelectedStandardId(id);
                setStep("standard-detail");
              }}
            />
          </div>

          {/* توصيات AI */}
          <AIRecommendations
            evidences={evidences}
            gapsMutation={gapsMutation}
          />
        </div>
      </div>
    );
  }

  // ===== Step 3: تفاصيل المعيار =====
  if (step === "standard-detail" && selectedStandardId) {
    const std = STANDARDS.find(s => s.id === selectedStandardId);
    if (!std) { setStep("dashboard"); return null; }

    return (
      <StandardDetailView
        standard={std}
        evidences={evidences}
        onBack={() => setStep("dashboard")}
        onAddEvidence={addEvidenceToIndicator}
        onRemoveEvidence={removeEvidence}
        onToggleDisplay={toggleDisplay}
        isClassifying={isClassifying}
        suggestMutation={suggestMutation}
      />
    );
  }

  // ===== Step 4: المعاينة والتصدير =====
  if (step === "preview") {
    return (
      <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
        <div className="max-w-4xl mx-auto">
          {/* شريط الأدوات */}
          <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-200 sticky top-2 z-10">
            <button onClick={() => setStep("dashboard")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm">
              <ArrowRight className="w-4 h-4" />العودة
            </button>
            <div className="flex items-center gap-2 flex-wrap">
              {/* اختيار الثيم */}
              <div className="flex gap-1">
                {THEMES.map(t => (
                  <button
                    key={t.id}
                    onClick={() => setSelectedTheme(t)}
                    className={`w-6 h-6 rounded-full border-2 transition-all ${
                      selectedTheme.id === t.id ? "border-gray-900 scale-110" : "border-gray-300"
                    }`}
                    style={{ background: t.accent }}
                    title={t.name}
                  />
                ))}
              </div>
              <button
                onClick={handlePrint}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-3 py-2 rounded-lg text-xs font-medium hover:bg-blue-700"
              >
                <Printer className="w-3.5 h-3.5" />طباعة
              </button>
              <button
                onClick={handleExportPDF}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-xs font-bold hover:bg-emerald-700"
              >
                <Download className="w-3.5 h-3.5" />تحميل PDF
              </button>
            </div>
          </div>

          {/* المعاينة */}
          <div className="bg-white rounded-xl shadow-lg overflow-hidden">
            <PortfolioPreview
              evidences={evidences}
              profile={profile}
              theme={selectedTheme}
            />
          </div>
        </div>
      </div>
    );
  }

  return null;
}

// ===== مكون الرفع السريع مع تصنيف AI =====
function QuickUploadSection({ onAdd, isClassifying }: {
  onAdd: (ev: Omit<Evidence, "id" | "createdAt">) => void;
  isClassifying: boolean;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [showLink, setShowLink] = useState(false);
  const [linkUrl, setLinkUrl] = useState("");
  const [linkTitle, setLinkTitle] = useState("");

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      const reader = new FileReader();
      reader.onload = () => {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        onAdd({
          standardId: "auto",
          indicatorId: "auto",
          type: isImage ? "image" : isVideo ? "video" : "file",
          content: reader.result as string,
          displayAs: isImage ? "image" : "qr",
          title: file.name,
        });
      };
      reader.readAsDataURL(file);
    });
    e.target.value = "";
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-2xl border-2 border-dashed border-emerald-300 p-5"
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="w-10 h-10 bg-emerald-100 rounded-xl flex items-center justify-center">
          <Sparkles className="w-5 h-5 text-emerald-600" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            رفع شاهد مع تصنيف ذكي
          </h2>
          <p className="text-[10px] text-gray-500">ارفع صورة أو ملف والذكاء الاصطناعي يصنفه تلقائياً للمعيار المناسب</p>
        </div>
      </div>

      <input
        type="file"
        ref={fileRef}
        className="hidden"
        accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
        multiple
        onChange={handleFile}
      />

      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          disabled={isClassifying}
          className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors disabled:opacity-50"
        >
          {isClassifying ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              جاري التصنيف الذكي...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              رفع شاهد جديد
            </>
          )}
        </button>

        <button
          onClick={() => setShowLink(!showLink)}
          className="flex items-center gap-2 px-4 py-3 rounded-xl border border-purple-300 text-purple-600 text-sm font-medium hover:bg-purple-50 transition-colors"
        >
          <LinkIcon className="w-4 h-4" />
          إضافة رابط
        </button>
      </div>

      <AnimatePresence>
        {showLink && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-purple-50 rounded-xl p-3 border border-purple-200 mt-3 space-y-2">
              <input
                type="text"
                value={linkTitle}
                onChange={(e) => setLinkTitle(e.target.value)}
                placeholder="عنوان الرابط (اختياري)"
                className="w-full px-3 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
              />
              <div className="flex gap-2">
                <input
                  type="url"
                  value={linkUrl}
                  onChange={(e) => setLinkUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                  className="flex-1 px-3 py-2 rounded-lg border border-purple-200 text-sm focus:outline-none focus:ring-2 focus:ring-purple-500/20 bg-white"
                />
                <button
                  onClick={() => {
                    if (!linkUrl.trim()) return;
                    onAdd({
                      standardId: "auto",
                      indicatorId: "auto",
                      type: "link",
                      content: linkUrl.trim(),
                      displayAs: "qr",
                      title: linkTitle.trim() || linkUrl.trim(),
                    });
                    setLinkUrl("");
                    setLinkTitle("");
                    setShowLink(false);
                  }}
                  className="px-4 py-2 rounded-lg bg-purple-600 text-white text-xs font-medium hover:bg-purple-700"
                >
                  إضافة
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===== مكون توصيات AI =====
function AIRecommendations({ evidences, gapsMutation }: {
  evidences: Evidence[];
  gapsMutation: ReturnType<typeof trpc.ai.analyzeGaps.useMutation>;
}) {
  const [recommendations, setRecommendations] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleAnalyze = async () => {
    setLoading(true);
    try {
      const coveredIndicators: string[] = [];
      for (const std of STANDARDS) {
        for (const ind of std.indicators) {
          if (evidences.some(e => e.indicatorId === ind.id)) {
            coveredIndicators.push(`${std.title}: ${ind.text}`);
          }
        }
      }
      const result = await gapsMutation.mutateAsync({
        coveredIndicators,
        totalIndicators: TOTAL_INDICATORS,
      });
      setRecommendations(result.recommendations);
    } catch {
      toast.error("تعذر تحليل الفجوات");
    }
    setLoading(false);
  };

  return (
    <div className="mt-5 bg-white rounded-2xl border border-gray-200 p-5">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-amber-500" />
          <h3 className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            توصيات الذكاء الاصطناعي
          </h3>
        </div>
        <button
          onClick={handleAnalyze}
          disabled={loading}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-amber-100 text-amber-700 text-xs font-medium hover:bg-amber-200 disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
          {loading ? "جاري التحليل..." : "تحليل الفجوات"}
        </button>
      </div>

      {recommendations ? (
        <div className="bg-amber-50 rounded-xl p-4 text-sm text-gray-700 leading-relaxed whitespace-pre-line">
          {recommendations}
        </div>
      ) : (
        <p className="text-xs text-gray-400 text-center py-4">
          اضغط "تحليل الفجوات" للحصول على توصيات مخصصة لتحسين ملف الإنجاز
        </p>
      )}
    </div>
  );
}

// ===== مكون تفاصيل المعيار =====
function StandardDetailView({ standard, evidences, onBack, onAddEvidence, onRemoveEvidence, onToggleDisplay, isClassifying, suggestMutation }: {
  standard: Standard;
  evidences: Evidence[];
  onBack: () => void;
  onAddEvidence: (standardId: string, indicatorId: string, ev: Omit<Evidence, "id" | "createdAt">) => void;
  onRemoveEvidence: (id: string) => void;
  onToggleDisplay: (id: string) => void;
  isClassifying: boolean;
  suggestMutation: ReturnType<typeof trpc.ai.suggest.useMutation>;
}) {
  const [expandedIndicator, setExpandedIndicator] = useState<string | null>(null);
  const [aiSuggestions, setAiSuggestions] = useState<Record<string, string>>({});
  const [loadingSuggestion, setLoadingSuggestion] = useState<string | null>(null);
  const progress = getStandardProgress(standard.id, evidences);

  const getSuggestions = async (indicatorId: string, indicatorText: string) => {
    setLoadingSuggestion(indicatorId);
    try {
      const result = await suggestMutation.mutateAsync({
        prompt: `اقترح 3-5 شواهد عملية ومحددة يمكن للمعلم رفعها لتغطية هذا المؤشر: "${indicatorText}" ضمن معيار "${standard.title}". اذكر نوع الشاهد (صورة/ملف/رابط) مع وصف مختصر.`,
        context: `معيار الأداء الوظيفي: ${standard.title}`,
      });
      setAiSuggestions(prev => ({ ...prev, [indicatorId]: result.content }));
    } catch {
      toast.error("تعذر الحصول على اقتراحات");
    }
    setLoadingSuggestion(null);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <button onClick={onBack} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm mb-4">
          <ArrowRight className="w-4 h-4" />العودة للوحة التحكم
        </button>

        {/* معلومات المعيار */}
        <div className="bg-white rounded-2xl border border-gray-200 p-5 mb-5">
          <div className="flex items-center gap-4 mb-4">
            <div className="text-3xl">{standard.icon}</div>
            <div className="flex-1">
              <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                {standard.number}. {standard.title}
              </h1>
              <p className="text-sm text-gray-500">الوزن: {standard.weight}% · {standard.indicators.length} مؤشرات</p>
            </div>
            <div className="text-center">
              <div className="text-2xl font-black" style={{ color: standard.color }}>
                {progress.percentage}%
              </div>
              <p className="text-[10px] text-gray-500">{progress.covered}/{progress.total} مؤشر</p>
            </div>
          </div>

          {/* شريط التقدم */}
          <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{ width: `${progress.percentage}%`, backgroundColor: standard.color }}
            />
          </div>
        </div>

        {/* المؤشرات */}
        <div className="space-y-3">
          {standard.indicators.map((ind, idx) => {
            const indEvidences = evidences.filter(e => e.standardId === standard.id && e.indicatorId === ind.id);
            const isCovered = indEvidences.length > 0;
            const isExpanded = expandedIndicator === ind.id;

            return (
              <motion.div
                key={ind.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.05 }}
                className={`bg-white rounded-xl border transition-all ${
                  isCovered ? "border-emerald-200" : "border-gray-200"
                }`}
              >
                {/* رأس المؤشر */}
                <button
                  onClick={() => setExpandedIndicator(isExpanded ? null : ind.id)}
                  className="w-full flex items-center gap-3 p-4 text-right"
                >
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${
                    isCovered ? "bg-emerald-100" : "bg-gray-100"
                  }`}>
                    {isCovered ? (
                      <CheckCircle className="w-4 h-4 text-emerald-600" />
                    ) : (
                      <span className="text-xs font-bold text-gray-400">{idx + 1}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-medium ${isCovered ? "text-gray-800" : "text-gray-600"}`}>
                      {ind.text}
                    </p>
                    {indEvidences.length > 0 && (
                      <p className="text-[10px] text-emerald-600 mt-0.5">{indEvidences.length} شاهد مرفق</p>
                    )}
                  </div>
                  {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                {/* محتوى المؤشر */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="px-4 pb-4 border-t border-gray-100 pt-3">
                        {/* الشواهد المقترحة */}
                        <div className="mb-3">
                          <p className="text-[10px] font-bold text-gray-400 uppercase mb-1.5">شواهد مقترحة:</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ind.suggestedEvidence.map((sug, i) => (
                              <span key={i} className="text-[10px] bg-gray-100 text-gray-600 px-2 py-1 rounded-md">
                                {sug}
                              </span>
                            ))}
                          </div>
                        </div>

                        {/* الشواهد المرفوعة */}
                        {indEvidences.length > 0 && (
                          <div className="space-y-2 mb-3">
                            {indEvidences.map(ev => (
                              <EvidenceCard
                                key={ev.id}
                                evidence={ev}
                                onRemove={onRemoveEvidence}
                                onToggleDisplay={ev.type === "image" ? onToggleDisplay : undefined}
                              />
                            ))}
                          </div>
                        )}

                        {/* رفع شاهد */}
                        <EvidenceUploader
                          standardId={standard.id}
                          indicatorId={ind.id}
                          onAdd={(ev) => onAddEvidence(standard.id, ind.id, ev)}
                          isClassifying={isClassifying}
                        />

                        {/* اقتراحات AI */}
                        <div className="mt-3 border-t border-gray-100 pt-3">
                          <button
                            onClick={() => getSuggestions(ind.id, ind.text)}
                            disabled={loadingSuggestion === ind.id}
                            className="flex items-center gap-1.5 text-xs text-amber-600 hover:text-amber-700"
                          >
                            {loadingSuggestion === ind.id ? (
                              <Loader2 className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Wand2 className="w-3.5 h-3.5" />
                            )}
                            اقتراحات الذكاء الاصطناعي
                          </button>
                          {aiSuggestions[ind.id] && (
                            <div className="mt-2 bg-amber-50 rounded-lg p-3 text-xs text-gray-700 leading-relaxed whitespace-pre-line">
                              {aiSuggestions[ind.id]}
                            </div>
                          )}
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
