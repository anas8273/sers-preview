/*
 * شواهد الأداء الوظيفي - صفحة تفاعلية كاملة
 * المستخدم يختار الوظيفة → يدخل البنود → معاينة حية → تصدير PDF / طباعة
 */
import { useState, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, Download, Printer, Eye, ChevronDown, ChevronUp, Plus, Trash2, Upload, Link as LinkIcon, QrCode } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";

// بنود الأداء الوظيفي للمعلم (11 بند كما في الواقع)
const TEACHER_CRITERIA = [
  { id: "c1", title: "التمكن من المادة العلمية", maxScore: 5, description: "إلمام المعلم بمحتوى المادة الدراسية وتحديثاته" },
  { id: "c2", title: "التخطيط للدرس", maxScore: 5, description: "إعداد خطط دراسية واضحة ومتنوعة تراعي الفروق الفردية" },
  { id: "c3", title: "تنفيذ الدرس", maxScore: 5, description: "استخدام استراتيجيات تدريس فعالة ومتنوعة" },
  { id: "c4", title: "إدارة الصف", maxScore: 5, description: "تهيئة بيئة صفية آمنة ومحفزة للتعلم" },
  { id: "c5", title: "التقويم", maxScore: 5, description: "استخدام أدوات تقويم متنوعة لقياس تحصيل الطلاب" },
  { id: "c6", title: "الأنشطة المدرسية", maxScore: 5, description: "المشاركة الفاعلة في الأنشطة المدرسية اللاصفية" },
  { id: "c7", title: "التطوير المهني", maxScore: 5, description: "السعي المستمر لتطوير الأداء المهني" },
  { id: "c8", title: "استخدام التقنية", maxScore: 5, description: "توظيف التقنية في العملية التعليمية" },
  { id: "c9", title: "العلاقات المهنية", maxScore: 5, description: "بناء علاقات إيجابية مع الزملاء وأولياء الأمور" },
  { id: "c10", title: "الالتزام الوظيفي", maxScore: 5, description: "الالتزام بأوقات الدوام والأنظمة واللوائح" },
  { id: "c11", title: "المبادرات والإبداع", maxScore: 5, description: "تقديم مبادرات إبداعية تسهم في تطوير العمل" },
];

const PRINCIPAL_CRITERIA = [
  { id: "p1", title: "القيادة التربوية", maxScore: 5, description: "قيادة المدرسة بفاعلية نحو تحقيق الأهداف التعليمية" },
  { id: "p2", title: "التخطيط الاستراتيجي", maxScore: 5, description: "وضع خطط استراتيجية واضحة للمدرسة" },
  { id: "p3", title: "إدارة الموارد البشرية", maxScore: 5, description: "إدارة وتطوير الكوادر البشرية بالمدرسة" },
  { id: "p4", title: "الإشراف التربوي", maxScore: 5, description: "متابعة العملية التعليمية والإشراف على المعلمين" },
  { id: "p5", title: "البيئة المدرسية", maxScore: 5, description: "توفير بيئة مدرسية آمنة ومحفزة" },
  { id: "p6", title: "العلاقة مع المجتمع", maxScore: 5, description: "تعزيز الشراكة مع أولياء الأمور والمجتمع المحلي" },
  { id: "p7", title: "التطوير المهني", maxScore: 5, description: "دعم التطوير المهني للعاملين" },
  { id: "p8", title: "الإدارة المالية", maxScore: 5, description: "إدارة الميزانية والموارد المالية بكفاءة" },
  { id: "p9", title: "التقنية والتحول الرقمي", maxScore: 5, description: "قيادة التحول الرقمي في المدرسة" },
  { id: "p10", title: "الالتزام الوظيفي", maxScore: 5, description: "الالتزام بالأنظمة واللوائح والتعليمات" },
];

const JOB_TYPES = [
  { id: "teacher", title: "معلم / معلمة", criteria: TEACHER_CRITERIA },
  { id: "principal", title: "مدير / مديرة مدرسة", criteria: PRINCIPAL_CRITERIA },
  { id: "vice_principal", title: "وكيل / وكيلة مدرسة", criteria: PRINCIPAL_CRITERIA },
  { id: "counselor", title: "موجه طلابي / موجهة", criteria: TEACHER_CRITERIA },
  { id: "health_counselor", title: "موجه صحي / موجهة صحية", criteria: TEACHER_CRITERIA },
  { id: "supervisor", title: "مشرف تربوي / مشرفة", criteria: PRINCIPAL_CRITERIA },
  { id: "librarian", title: "أمين مصادر تعلم", criteria: TEACHER_CRITERIA },
  { id: "kindergarten", title: "معلمة رياض أطفال", criteria: TEACHER_CRITERIA },
  { id: "special_ed", title: "معلم تربية خاصة", criteria: TEACHER_CRITERIA },
  { id: "admin_assistant", title: "مساعد إداري / مساعدة", criteria: PRINCIPAL_CRITERIA },
];

interface EvidenceItem {
  id: string;
  text: string;
  link: string;
  file: string | null;
}

interface CriterionData {
  score: number;
  notes: string;
  evidences: EvidenceItem[];
}

const THEMES = [
  { id: "official", name: "الهوية الرسمية", headerBg: "#1B5E20", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
  { id: "blue", name: "الأزرق الكلاسيكي", headerBg: "#0D47A1", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1" },
  { id: "purple", name: "البنفسجي الأنيق", headerBg: "#4A148C", headerText: "#fff", accent: "#6A1B9A", borderColor: "#4A148C" },
  { id: "teal", name: "التيل العصري", headerBg: "#00695C", headerText: "#fff", accent: "#00897B", borderColor: "#00695C" },
];

export default function PerformanceEvidence() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"select" | "fill" | "preview">("select");
  const [selectedJob, setSelectedJob] = useState<typeof JOB_TYPES[0] | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // بيانات المستخدم
  const [personalInfo, setPersonalInfo] = useState({
    name: "",
    school: "",
    department: "",
    year: "1446-1447",
    semester: "الأول",
    evaluator: "",
    evaluatorRole: "",
    date: "",
  });

  const [criteriaData, setCriteriaData] = useState<Record<string, CriterionData>>({});

  const initCriteriaData = (criteria: typeof TEACHER_CRITERIA) => {
    const data: Record<string, CriterionData> = {};
    criteria.forEach((c) => {
      data[c.id] = { score: 0, notes: "", evidences: [{ id: "e1", text: "", link: "", file: null }] };
    });
    setCriteriaData(data);
  };

  const handleSelectJob = (job: typeof JOB_TYPES[0]) => {
    setSelectedJob(job);
    initCriteriaData(job.criteria);
    setStep("fill");
  };

  const updateScore = (criterionId: string, score: number) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], score },
    }));
  };

  const updateNotes = (criterionId: string, notes: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], notes },
    }));
  };

  const addEvidence = (criterionId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: [...prev[criterionId].evidences, { id: `e${Date.now()}`, text: "", link: "", file: null }],
      },
    }));
  };

  const removeEvidence = (criterionId: string, evidenceId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: prev[criterionId].evidences.filter((e) => e.id !== evidenceId),
      },
    }));
  };

  const updateEvidence = (criterionId: string, evidenceId: string, field: keyof EvidenceItem, value: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: prev[criterionId].evidences.map((e) => (e.id === evidenceId ? { ...e, [field]: value } : e)),
      },
    }));
  };

  const totalScore = Object.values(criteriaData).reduce((sum, c) => sum + c.score, 0);
  const maxScore = selectedJob ? selectedJob.criteria.length * 5 : 0;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: "ممتاز", color: "#16A34A" };
    if (pct >= 80) return { label: "جيد جداً", color: "#2563EB" };
    if (pct >= 70) return { label: "جيد", color: "#CA8A04" };
    if (pct >= 60) return { label: "مقبول", color: "#EA580C" };
    return { label: "ضعيف", color: "#DC2626" };
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    await exportToPDF("preview-content", `شواهد_الأداء_الوظيفي_${personalInfo.name || "مستند"}.pdf`);
    setIsExporting(false);
  };

  // Step 1: اختيار الوظيفة
  if (step === "select") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">العودة للرئيسية</span>
          </button>

          <div className="text-center mb-8">
            <h1 className="text-3xl font-black text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              شواهد الأداء الوظيفي
            </h1>
            <p className="text-gray-500">اختر الوظيفة لبدء إعداد شواهد الأداء الوظيفي</p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {JOB_TYPES.map((job, i) => (
              <motion.button
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.05 }}
                whileHover={{ y: -4, boxShadow: "0 12px 30px rgba(0,0,0,0.1)" }}
                onClick={() => handleSelectJob(job)}
                className="bg-white rounded-xl p-6 border border-gray-200 text-right hover:border-emerald-300 transition-all group"
              >
                <div className="w-12 h-12 rounded-lg bg-emerald-50 flex items-center justify-center mb-3 group-hover:bg-emerald-100 transition-colors">
                  <span className="text-2xl">👤</span>
                </div>
                <h3 className="font-bold text-gray-800 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>{job.title}</h3>
                <p className="text-xs text-gray-500">{job.criteria.length} بند تقييم</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // Step 2: إدخال البيانات
  if (step === "fill") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <button onClick={() => setStep("select")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" />
              <span className="text-sm">تغيير الوظيفة</span>
            </button>
            <div className="flex items-center gap-3">
              <div className="text-left">
                <div className="text-2xl font-black" style={{ color: getGrade(percentage).color }}>{percentage}%</div>
                <div className="text-xs text-gray-500">{getGrade(percentage).label}</div>
              </div>
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
              >
                <Eye className="w-4 h-4" />
                معاينة
              </button>
            </div>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            شواهد الأداء الوظيفي - {selectedJob?.title}
          </h1>
          <p className="text-sm text-gray-500 mb-6">{selectedJob?.criteria.length} بند تقييم · أدخل البيانات ثم اضغط معاينة</p>

          {/* البيانات الشخصية */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="font-bold text-gray-800 mb-4 text-lg" style={{ fontFamily: "'Tajawal', sans-serif" }}>البيانات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "name", label: "الاسم الكامل", placeholder: "أدخل الاسم الرباعي" },
                { key: "school", label: "المدرسة", placeholder: "اسم المدرسة" },
                { key: "department", label: "إدارة التعليم", placeholder: "مثال: إدارة تعليم الرياض" },
                { key: "year", label: "العام الدراسي", placeholder: "1446-1447" },
                { key: "semester", label: "الفصل الدراسي", placeholder: "الأول / الثاني / الثالث" },
                { key: "evaluator", label: "اسم المقيّم", placeholder: "اسم المقيّم" },
                { key: "evaluatorRole", label: "صفة المقيّم", placeholder: "مدير المدرسة / المشرف التربوي" },
                { key: "date", label: "تاريخ التقييم", placeholder: "1446/06/15" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input
                    type="text"
                    value={(personalInfo as any)[field.key]}
                    onChange={(e) => setPersonalInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                  />
                </div>
              ))}
            </div>
          </div>

          {/* اختيار الثيم */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6">
            <h2 className="font-bold text-gray-800 mb-3 text-lg" style={{ fontFamily: "'Tajawal', sans-serif" }}>ثيم التصدير</h2>
            <div className="flex gap-3 flex-wrap">
              {THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg border-2 text-sm font-medium transition-all ${
                    selectedTheme.id === theme.id ? "border-gray-900 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-5 h-5 rounded-full" style={{ backgroundColor: theme.headerBg }} />
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* البنود */}
          <div className="space-y-3">
            {selectedJob?.criteria.map((criterion, index) => {
              const data = criteriaData[criterion.id];
              const isExpanded = expandedCriterion === criterion.id;
              if (!data) return null;
              return (
                <motion.div
                  key={criterion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.03 }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedCriterion(isExpanded ? null : criterion.id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 text-right">
                      <h3 className="font-semibold text-gray-800 text-sm">{criterion.title}</h3>
                      <p className="text-xs text-gray-500">{criterion.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <div className="text-lg font-bold" style={{ color: data.score >= 4 ? "#16A34A" : data.score >= 3 ? "#CA8A04" : "#9CA3AF" }}>
                          {data.score}
                        </div>
                        <div className="text-[10px] text-gray-400">/ {criterion.maxScore}</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-4 border-t border-gray-100 pt-4">
                          {/* الدرجة */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">الدرجة</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <button
                                  key={score}
                                  onClick={() => updateScore(criterion.id, score)}
                                  className={`w-12 h-12 rounded-lg font-bold text-lg transition-all ${
                                    data.score === score
                                      ? "bg-emerald-600 text-white shadow-md scale-110"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  }`}
                                >
                                  {score}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* ملاحظات */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                            <textarea
                              value={data.notes}
                              onChange={(e) => updateNotes(criterion.id, e.target.value)}
                              placeholder="أضف ملاحظاتك هنا..."
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                            />
                          </div>

                          {/* الشواهد */}
                          <div>
                            <div className="flex items-center justify-between mb-2">
                              <label className="text-sm font-medium text-gray-700">الشواهد والأدلة</label>
                              <button
                                onClick={() => addEvidence(criterion.id)}
                                className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700"
                              >
                                <Plus className="w-3 h-3" />
                                إضافة شاهد
                              </button>
                            </div>
                            <div className="space-y-2">
                              {data.evidences.map((evidence, ei) => (
                                <div key={evidence.id} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs text-gray-400 mt-2 shrink-0">#{ei + 1}</span>
                                    <input
                                      type="text"
                                      value={evidence.text}
                                      onChange={(e) => updateEvidence(criterion.id, evidence.id, "text", e.target.value)}
                                      placeholder="وصف الشاهد..."
                                      className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                    />
                                    {data.evidences.length > 1 && (
                                      <button onClick={() => removeEvidence(criterion.id, evidence.id)} className="text-red-400 hover:text-red-600 mt-2">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>
                                  <div className="flex gap-2 mr-6">
                                    <div className="flex-1 relative">
                                      <LinkIcon className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                      <input
                                        type="url"
                                        value={evidence.link}
                                        onChange={(e) => updateEvidence(criterion.id, evidence.id, "link", e.target.value)}
                                        placeholder="رابط الشاهد (اختياري)..."
                                        className="w-full pr-7 pl-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                      />
                                    </div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* زر المعاينة */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setStep("preview")}
              className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl text-base font-bold hover:bg-emerald-700 transition-colors shadow-lg"
            >
              <Eye className="w-5 h-5" />
              معاينة وتصدير
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Step 3: المعاينة والتصدير
  const grade = getGrade(percentage);
  const qrData = generateQRDataURL(`SERS-PERF|${personalInfo.name}|${selectedJob?.title}|${totalScore}/${maxScore}|${personalInfo.date}`);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* أزرار التحكم */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3 bg-white rounded-xl p-4 shadow-sm">
          <button onClick={() => setStep("fill")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">تعديل البيانات</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => printElement("preview-content")}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "جاري التصدير..." : "تحميل PDF"}
            </button>
          </div>
        </div>

        {/* المعاينة الحية */}
        <div id="preview-content" className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
          {/* الهيدر */}
          <div className="p-6 text-center text-white" style={{ backgroundColor: selectedTheme.headerBg }}>
            <div className="flex items-center justify-between mb-4">
              <img src={qrData} alt="QR" className="w-16 h-16 rounded" />
              <div>
                <h1 className="text-2xl font-black mb-1">شواهد الأداء الوظيفي</h1>
                <p className="text-sm opacity-80">{selectedJob?.title}</p>
              </div>
              <div className="text-left">
                <div className="text-xs opacity-70">SERS</div>
                <div className="text-xs opacity-70">نظام السجلات التعليمية الذكي</div>
              </div>
            </div>
          </div>

          {/* البيانات الشخصية */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
              {[
                { label: "الاسم", value: personalInfo.name || "---" },
                { label: "المدرسة", value: personalInfo.school || "---" },
                { label: "إدارة التعليم", value: personalInfo.department || "---" },
                { label: "العام الدراسي", value: personalInfo.year || "---" },
                { label: "الفصل", value: personalInfo.semester || "---" },
                { label: "المقيّم", value: personalInfo.evaluator || "---" },
                { label: "صفة المقيّم", value: personalInfo.evaluatorRole || "---" },
                { label: "التاريخ", value: personalInfo.date || "---" },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3">
                  <div className="text-[10px] text-gray-400 mb-1">{item.label}</div>
                  <div className="font-semibold text-gray-800">{item.value}</div>
                </div>
              ))}
            </div>

            {/* النتيجة */}
            <div className="flex items-center justify-center gap-8 mb-6 p-4 rounded-xl" style={{ backgroundColor: grade.color + "10", border: `2px solid ${grade.color}30` }}>
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: grade.color }}>{totalScore}</div>
                <div className="text-xs text-gray-500">من {maxScore}</div>
              </div>
              <div className="text-center">
                <div className="text-4xl font-black" style={{ color: grade.color }}>{percentage}%</div>
                <div className="text-xs text-gray-500">النسبة</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-black" style={{ color: grade.color }}>{grade.label}</div>
                <div className="text-xs text-gray-500">التقدير</div>
              </div>
            </div>

            {/* جدول البنود */}
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr style={{ backgroundColor: selectedTheme.headerBg }}>
                  <th className="text-white p-2 text-right text-xs">م</th>
                  <th className="text-white p-2 text-right text-xs">البند</th>
                  <th className="text-white p-2 text-center text-xs">الدرجة</th>
                  <th className="text-white p-2 text-right text-xs">الملاحظات</th>
                  <th className="text-white p-2 text-right text-xs">الشواهد</th>
                </tr>
              </thead>
              <tbody>
                {selectedJob?.criteria.map((criterion, index) => {
                  const data = criteriaData[criterion.id];
                  if (!data) return null;
                  return (
                    <tr key={criterion.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 text-center border border-gray-200 font-bold" style={{ color: selectedTheme.accent }}>{index + 1}</td>
                      <td className="p-2 border border-gray-200">
                        <div className="font-semibold text-gray-800">{criterion.title}</div>
                      </td>
                      <td className="p-2 text-center border border-gray-200">
                        <span className="inline-flex items-center justify-center w-8 h-8 rounded-full font-bold text-white text-sm" style={{ backgroundColor: data.score >= 4 ? "#16A34A" : data.score >= 3 ? "#CA8A04" : data.score >= 1 ? "#EA580C" : "#9CA3AF" }}>
                          {data.score}
                        </span>
                      </td>
                      <td className="p-2 border border-gray-200 text-xs text-gray-600">{data.notes || "---"}</td>
                      <td className="p-2 border border-gray-200 text-xs">
                        {data.evidences.filter((e) => e.text).map((e, i) => (
                          <div key={e.id} className="mb-1">
                            <span className="text-gray-800">• {e.text}</span>
                            {e.link && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <QrCode className="w-3 h-3 text-gray-400" />
                                <span className="text-blue-600 text-[10px] break-all">{e.link}</span>
                              </div>
                            )}
                          </div>
                        ))}
                        {data.evidences.filter((e) => e.text).length === 0 && <span className="text-gray-400">---</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* التوقيعات */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-8">توقيع المقيّم</div>
                <div className="border-t border-gray-300 pt-2 text-sm font-medium">{personalInfo.evaluator || "_______________"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-8">توقيع المعلم</div>
                <div className="border-t border-gray-300 pt-2 text-sm font-medium">{personalInfo.name || "_______________"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-8">اعتماد مدير المدرسة</div>
                <div className="border-t border-gray-300 pt-2 text-sm font-medium">_______________</div>
              </div>
            </div>

            {/* الفوتر */}
            <div className="mt-6 pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400">
              تم إنشاء هذا المستند بواسطة نظام SERS - السجلات التعليمية الذكية
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
