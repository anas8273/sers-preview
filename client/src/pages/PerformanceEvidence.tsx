/**
 * شواهد الأداء الوظيفي - SERS
 * المعلم/المعلمة → نظام المعايير الـ 11 (نمط معياري) مع 45 مؤشر
 * باقي الوظائف → النظام العادي (البنود) مع ميزات معياري
 */
import { useState, useMemo, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { usePortfolio } from "@/hooks/usePortfolio";
import { getLoginUrl } from "@/const";
import { generateQRDataURL } from "@/lib/qr-utils";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { STANDARDS, type Standard, type Indicator } from "@/lib/standards-data";
import {
  ArrowLeft, ArrowRight, Sparkles, Upload, Plus, Trash2, Save,
  Eye, Download, Printer, FileText, Image, Video, QrCode, Type,
  LinkIcon, Loader2, ChevronDown, ChevronUp, Layers, BarChart3,
  CheckCircle, AlertTriangle, XCircle, TrendingUp, Wand2, X,
  GraduationCap, Building2, Users, Heart, Search as SearchIcon,
  BookOpen, Baby, Accessibility, Briefcase, ClipboardList,
  ClipboardCheck, Handshake, UserCheck, Target,
  NotebookPen, Monitor, School, Award, PieChart, ListChecks
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

// خريطة أيقونات Lucide لاستبدال emoji
const STANDARD_ICONS: Record<string, LucideIcon> = {
  "std-1": ClipboardCheck,   // أداء الواجبات الوظيفية
  "std-2": Handshake,        // التفاعل مع المجتمع المهني
  "std-3": UserCheck,        // التفاعل مع أولياء الأمور
  "std-4": Target,           // التنويع في استراتيجيات التدريس
  "std-5": TrendingUp,       // تحسين نتائج المتعلمين
  "std-6": NotebookPen,      // إعداد وتنفيذ خطة التعلم
  "std-7": Monitor,          // توظيف تقنيات ووسائل التعلم
  "std-8": School,           // تهيئة البيئة التعليمية
  "std-9": Award,            // الإدارة الصفية
  "std-10": PieChart,        // تحليل نتائج المتعلمين
  "std-11": ListChecks,      // تنوع أساليب التقويم
};
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ===== أنواع البيانات =====
type EvidenceType = "text" | "image" | "link" | "file" | "video";
interface FormField { id: string; label: string; type: "text" | "textarea" | "date" | "number" | "select"; placeholder?: string; required?: boolean; options?: string[]; }
interface SubEvidence { id: string; title: string; description: string; type: "report" | "upload" | "both"; isCustom?: boolean; formFields?: FormField[]; }
interface Criterion { id: string; title: string; maxScore: number; description: string; subEvidences: SubEvidence[]; }
interface EvidenceItem {
  id: string; subEvidenceId: string; type: EvidenceType; text: string; link: string;
  fileData: string | null; fileName: string; displayAs: "image" | "qr"; formData?: Record<string, string>;
}
interface CriterionData { score: number; notes: string; evidences: EvidenceItem[]; customSubEvidences: SubEvidence[]; }

// ===== بناء البنود للوظائف غير المعلم =====
function makeSimpleCriteria(prefix: string, items: { id: string; title: string; desc: string; subTitle: string; formFields?: FormField[] }[]): Criterion[] {
  return items.map(item => ({
    id: `${prefix}_${item.id}`, title: item.title, maxScore: 5, description: item.desc,
    subEvidences: [{
      id: `${prefix}_${item.id}_sub`, title: item.subTitle, description: item.desc, type: "both" as const,
      formFields: item.formFields || [
        { id: "title", label: "العنوان", type: "text" as const, placeholder: "أدخل العنوان..." },
        { id: "date", label: "التاريخ", type: "date" as const },
        { id: "details", label: "التفاصيل", type: "textarea" as const, placeholder: "أدخل التفاصيل..." },
        { id: "notes", label: "ملاحظات", type: "textarea" as const, placeholder: "ملاحظات إضافية..." },
      ],
    }],
  }));
}

// ===== بنود المعلم/المعلمة (نظام المعايير الـ 11) =====
function buildTeacherCriteria(): Criterion[] {
  return STANDARDS.map(std => ({
    id: std.id,
    title: std.title,
    maxScore: 5,
    description: `${std.indicators.length} مؤشر · الوزن ${std.weight}%`,
    subEvidences: std.indicators.map(ind => ({
      id: ind.id,
      title: ind.text,
      description: ind.suggestedEvidence.join(" · "),
      type: "both" as const,
      formFields: [
        { id: "evidence_desc", label: "وصف الشاهد", type: "textarea" as const, placeholder: "اكتب وصفاً للشاهد المقدم..." },
        { id: "date", label: "التاريخ", type: "date" as const },
        { id: "notes", label: "ملاحظات", type: "textarea" as const, placeholder: "ملاحظات إضافية..." },
      ],
    })),
  }));
}

const TEACHER_CRITERIA = buildTeacherCriteria();

// ===== بنود الوظائف الأخرى =====
const PRINCIPAL_CRITERIA = makeSimpleCriteria("p", [
  { id: "1", title: "التخطيط المدرسي", desc: "إعداد الخطط التشغيلية والاستراتيجية", subTitle: "الخطة التشغيلية السنوية" },
  { id: "2", title: "القيادة التعليمية", desc: "قيادة العملية التعليمية وتطويرها", subTitle: "تقارير الزيارات الصفية" },
  { id: "3", title: "إدارة الموارد البشرية", desc: "إدارة وتطوير الكوادر", subTitle: "خطة التطوير المهني" },
  { id: "4", title: "البيئة المدرسية", desc: "تهيئة بيئة تعليمية آمنة وجاذبة", subTitle: "تقرير البيئة المدرسية" },
  { id: "5", title: "العلاقات المجتمعية", desc: "تعزيز الشراكة المجتمعية", subTitle: "سجل الشراكات المجتمعية" },
  { id: "6", title: "التقويم والمتابعة", desc: "متابعة وتقويم الأداء المدرسي", subTitle: "تقارير المتابعة الدورية" },
  { id: "7", title: "الإدارة المالية", desc: "إدارة الميزانية والموارد المالية", subTitle: "التقرير المالي" },
]);

const VICE_PRINCIPAL_CRITERIA = makeSimpleCriteria("v", [
  { id: "1", title: "المشاركة في التخطيط", desc: "المشاركة في إعداد الخطط", subTitle: "الخطة التشغيلية" },
  { id: "2", title: "متابعة الحضور والغياب", desc: "متابعة الحضور", subTitle: "سجل الحضور" },
  { id: "3", title: "الإشراف على الاختبارات", desc: "تنظيم الاختبارات", subTitle: "جدول الاختبارات" },
  { id: "4", title: "متابعة النظام والانضباط", desc: "الحفاظ على النظام", subTitle: "سجل الملاحظات السلوكية" },
  { id: "5", title: "إدارة شؤون الطلاب", desc: "إدارة الشؤون", subTitle: "سجل شؤون الطلاب" },
  { id: "6", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "7", title: "الإشراف على الأنشطة", desc: "الإشراف على الأنشطة", subTitle: "خطة الأنشطة" },
]);

const COUNSELOR_CRITERIA = makeSimpleCriteria("c", [
  { id: "1", title: "التوجيه والإرشاد الفردي", desc: "تقديم خدمات الإرشاد", subTitle: "سجل الحالات الفردية" },
  { id: "2", title: "التوجيه الجماعي", desc: "تنفيذ برامج جماعية", subTitle: "خطة البرامج الجماعية" },
  { id: "3", title: "البرامج الوقائية", desc: "تنفيذ البرامج الوقائية", subTitle: "خطة البرامج الوقائية" },
  { id: "4", title: "البرامج العلاجية", desc: "تنفيذ البرامج العلاجية", subTitle: "خطط العلاج" },
  { id: "5", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "6", title: "دراسة الحالات السلوكية", desc: "دراسة الحالات", subTitle: "ملفات الحالات" },
  { id: "7", title: "التقارير والإحصاءات", desc: "إعداد التقارير", subTitle: "التقارير الشهرية" },
]);

const HEALTH_COUNSELOR_CRITERIA = makeSimpleCriteria("h", [
  { id: "1", title: "التثقيف الصحي", desc: "تنفيذ برامج التثقيف", subTitle: "خطة التثقيف الصحي" },
  { id: "2", title: "الإسعافات الأولية", desc: "تقديم الإسعافات", subTitle: "سجل الإسعافات" },
  { id: "3", title: "البيئة الصحية", desc: "متابعة البيئة الصحية", subTitle: "تقارير المتابعة" },
  { id: "4", title: "متابعة الحالات الصحية", desc: "متابعة الحالات المزمنة", subTitle: "سجل الحالات" },
  { id: "5", title: "التقارير الصحية", desc: "إعداد التقارير", subTitle: "التقارير الشهرية" },
]);

const SUPERVISOR_CRITERIA = makeSimpleCriteria("s", [
  { id: "1", title: "التخطيط للإشراف", desc: "إعداد خطط إشرافية", subTitle: "الخطة الإشرافية" },
  { id: "2", title: "الزيارات الصفية", desc: "تنفيذ الزيارات", subTitle: "سجل الزيارات" },
  { id: "3", title: "تطوير المعلمين", desc: "دعم التطوير المهني", subTitle: "خطة التطوير" },
  { id: "4", title: "تحليل نتائج الطلاب", desc: "تحليل النتائج", subTitle: "تقارير التحليل" },
  { id: "5", title: "البرامج التدريبية", desc: "تنفيذ البرامج", subTitle: "خطة التدريب" },
]);

const LIBRARIAN_CRITERIA = makeSimpleCriteria("l", [
  { id: "1", title: "تنظيم مصادر التعلم", desc: "تنظيم وفهرسة المصادر", subTitle: "سجل المصادر" },
  { id: "2", title: "خدمة المستفيدين", desc: "تقديم خدمات متميزة", subTitle: "سجل الإعارة" },
  { id: "3", title: "التقنيات التعليمية", desc: "توظيف التقنيات", subTitle: "تقرير التقنيات" },
  { id: "4", title: "البرامج والأنشطة", desc: "تنفيذ البرامج", subTitle: "خطة البرامج" },
]);

const KINDERGARTEN_CRITERIA = makeSimpleCriteria("k", [
  { id: "1", title: "التخطيط للأنشطة", desc: "التخطيط لأنشطة تعليمية", subTitle: "خطة الأنشطة الأسبوعية" },
  { id: "2", title: "تنفيذ الأنشطة التعليمية", desc: "تنفيذ أنشطة إبداعية", subTitle: "صور الأنشطة" },
  { id: "3", title: "إدارة الصف", desc: "إدارة الصف بطريقة مناسبة", subTitle: "قوانين الصف" },
  { id: "4", title: "التقويم والمتابعة", desc: "تقويم نمو الأطفال", subTitle: "سجل الملاحظات" },
  { id: "5", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "6", title: "البيئة التعليمية", desc: "تهيئة بيئة آمنة", subTitle: "صور البيئة الصفية" },
]);

const SPECIAL_ED_CRITERIA = makeSimpleCriteria("se", [
  { id: "1", title: "إعداد الخطة التعليمية الفردية (IEP)", desc: "إعداد خطط فردية", subTitle: "الخطة التعليمية الفردية" },
  { id: "2", title: "تنفيذ البرامج التعليمية", desc: "تنفيذ البرامج", subTitle: "سجل الجلسات" },
  { id: "3", title: "التقييم والتشخيص", desc: "تقييم الاحتياجات", subTitle: "تقارير التقييم" },
  { id: "4", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "5", title: "التعديل السلوكي", desc: "تطبيق برامج التعديل", subTitle: "خطط التعديل السلوكي" },
  { id: "6", title: "التكامل مع المعلمين", desc: "التعاون مع معلمي التعليم العام", subTitle: "خطط الدمج" },
]);

const ADMIN_ASSISTANT_CRITERIA = makeSimpleCriteria("a", [
  { id: "1", title: "الأعمال الإدارية", desc: "تنفيذ الأعمال الإدارية", subTitle: "سجل المهام" },
  { id: "2", title: "المراسلات والتقارير", desc: "إعداد المراسلات", subTitle: "سجل الصادر والوارد" },
  { id: "3", title: "متابعة الحضور والغياب", desc: "متابعة الحضور", subTitle: "سجل الحضور" },
  { id: "4", title: "خدمة المراجعين", desc: "تقديم خدمة متميزة", subTitle: "سجل المراجعين" },
  { id: "5", title: "الأرشفة والتوثيق", desc: "أرشفة الملفات", subTitle: "نظام الأرشفة" },
]);

// ===== أنواع الوظائف =====
const JOB_TYPES = [
  { id: "teacher", title: "معلم / معلمة", icon: GraduationCap, emoji: "👨‍🏫", criteria: TEACHER_CRITERIA, isTeacher: true, color: "#059669" },
  { id: "principal", title: "مدير / مديرة مدرسة", icon: Building2, emoji: "👔", criteria: PRINCIPAL_CRITERIA, isTeacher: false, color: "#2563EB" },
  { id: "vice_principal", title: "وكيل / وكيلة مدرسة", icon: ClipboardList, emoji: "📋", criteria: VICE_PRINCIPAL_CRITERIA, isTeacher: false, color: "#7C3AED" },
  { id: "counselor", title: "موجه/ة طلابي/ة", icon: Users, emoji: "🤝", criteria: COUNSELOR_CRITERIA, isTeacher: false, color: "#0891B2" },
  { id: "health_counselor", title: "موجه/ة صحي/ة", icon: Heart, emoji: "🏥", criteria: HEALTH_COUNSELOR_CRITERIA, isTeacher: false, color: "#DC2626" },
  { id: "supervisor", title: "مشرف/ة تربوي/ة", icon: SearchIcon, emoji: "🔍", criteria: SUPERVISOR_CRITERIA, isTeacher: false, color: "#CA8A04" },
  { id: "librarian", title: "أمين/ة مصادر تعلم", icon: BookOpen, emoji: "📚", criteria: LIBRARIAN_CRITERIA, isTeacher: false, color: "#9333EA" },
  { id: "kindergarten", title: "معلمة رياض أطفال", icon: Baby, emoji: "🧒", criteria: KINDERGARTEN_CRITERIA, isTeacher: false, color: "#EC4899" },
  { id: "special_ed", title: "معلم/ة تربية خاصة", icon: Accessibility, emoji: "♿", criteria: SPECIAL_ED_CRITERIA, isTeacher: false, color: "#F97316" },
  { id: "admin_assistant", title: "مساعد/ة إداري/ة", icon: Briefcase, emoji: "🗂️", criteria: ADMIN_ASSISTANT_CRITERIA, isTeacher: false, color: "#6B7280" },
];

// ===== الثيمات =====
const THEMES = [
  { id: "official", name: "الهوية الرسمية", headerBg: "#1B5E20", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
  { id: "official-gradient", name: "تدرج رسمي", headerBg: "linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
  { id: "blue", name: "أزرق كلاسيكي", headerBg: "#0D47A1", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1" },
  { id: "purple", name: "بنفسجي أنيق", headerBg: "#4A148C", headerText: "#fff", accent: "#6A1B9A", borderColor: "#4A148C" },
  { id: "simple", name: "بسيط", headerBg: "#f8f9fa", headerText: "#1a1a1a", accent: "#059669", borderColor: "#e5e7eb" },
];

function createEmptyEvidence(subEvidenceId: string = ""): EvidenceItem {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    subEvidenceId, type: "text", text: "", link: "",
    fileData: null, fileName: "", displayAs: "image", formData: {},
  };
}

// ===== المكون الرئيسي =====
// ===== مفاتيح التخزين المحلي (localStorage يبقى حتى بعد إغلاق المتصفح) =====
const STORAGE_KEY = "sers_perf_state";
const STORAGE_PENDING_UPLOAD = "sers_pending_upload";
const STORAGE_AUTOSAVE_KEY = "sers_perf_autosave";

// ===== حفظ واستعادة الـ state من localStorage (يبقى حتى بعد إغلاق المتصفح) =====
function saveStateToStorage(data: {
  step: string; jobId: string; themeId: string;
  criteriaData: Record<string, CriterionData>; personalInfo: any;
  customCriteria: Criterion[]; currentCriterionIndex: number;
  activeTab: string; expandedSubEvidence: string | null;
}) {
  try {
    // حفظ الصور الصغيرة فقط لتجنب تجاوز حد localStorage
    const cleanCriteria: Record<string, any> = {};
    for (const [key, val] of Object.entries(data.criteriaData)) {
      cleanCriteria[key] = {
        ...val,
        evidences: val.evidences.map(ev => ({
          ...ev,
          fileData: ev.fileData && ev.fileData.length < 100000 ? ev.fileData : null,
          // حفظ معلومات الملف حتى لو لم نحفظ البيانات الكبيرة
          _hadFile: !!ev.fileData,
        })),
      };
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, criteriaData: cleanCriteria, timestamp: Date.now() }));
  } catch {
    // localStorage ممتلئ - حاول حذف البيانات القديمة
    try {
      localStorage.removeItem(STORAGE_AUTOSAVE_KEY);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...data, timestamp: Date.now() }));
    } catch { /* ignore */ }
  }
}

function loadStateFromStorage(): any | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw);
    // تجاهل البيانات القديمة (أكثر من 24 ساعة)
    if (Date.now() - (data.timestamp || 0) > 86400000) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return data;
  } catch { return null; }
}

function clearStorageState() {
  try {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(STORAGE_PENDING_UPLOAD);
  } catch { /* ignore */ }
}

export default function PerformanceEvidence() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated, loading: authLoading } = useAuth();
  const portfolio = usePortfolio(isAuthenticated);
  const [step, setStep] = useState<"select" | "dashboard" | "criterion-detail" | "final-review" | "preview">("select");
  const [selectedJob, setSelectedJob] = useState<typeof JOB_TYPES[0] | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[0]);
  const [portfolioId, setPortfolioId] = useState<number | null>(null);
  const [currentCriterionIndex, setCurrentCriterionIndex] = useState(0);
  const [expandedSubEvidence, setExpandedSubEvidence] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [activeTab, setActiveTab] = useState("criteria");
  const [stateRestored, setStateRestored] = useState(false);

  // AI State
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiChat, setAiChat] = useState<Record<string, string[]>>({});
  const [aiPrompt, setAiPrompt] = useState("");

  // tRPC AI mutations
  const suggestMutation = trpc.ai.suggest.useMutation();
  const fillFormMutation = trpc.ai.fillFormFields.useMutation();
  const improveMutation = trpc.ai.improveText.useMutation();
  const classifyMutation = trpc.ai.classifyEvidence.useMutation();

  // Custom sections
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [showAddMainSection, setShowAddMainSection] = useState(false);
  const [newMainSectionTitle, setNewMainSectionTitle] = useState("");
  const [newMainSectionDesc, setNewMainSectionDesc] = useState("");
  const [customCriteria, setCustomCriteria] = useState<Criterion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadRef = useRef<{ criterionId: string; subEvidenceId: string } | null>(null);
  const smartUploadRef = useRef<HTMLInputElement>(null);

  const [personalInfo, setPersonalInfo] = useState({
    name: "", school: "",
    department: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة",
    year: "١٤٤٧هـ", semester: "الفصل الدراسي الثاني",
    evaluator: "", evaluatorRole: "مدير المدرسة", date: "",
  });

  const [criteriaData, setCriteriaData] = useState<Record<string, CriterionData>>({});

  const allCriteria = useMemo(() => [...(selectedJob?.criteria || []), ...customCriteria], [selectedJob, customCriteria]);

  const initCriteriaData = (criteria: Criterion[]) => {
    const data: Record<string, CriterionData> = {};
    criteria.forEach((c) => {
      data[c.id] = { score: 0, notes: "", evidences: [], customSubEvidences: [] };
    });
    setCriteriaData(data);
  };

  const handleSelectJob = (job: typeof JOB_TYPES[0]) => {
    setSelectedJob(job);
    setCustomCriteria([]);
    initCriteriaData(job.criteria);
    setStep("dashboard");
  };

  // ===== استعادة الـ state من localStorage عند تحميل الصفحة (حل مشكلة الجوال + إغلاق المتصفح) =====
  useEffect(() => {
    if (stateRestored) return;
    const saved = loadStateFromStorage();
    if (saved && saved.jobId) {
      const job = JOB_TYPES.find(j => j.id === saved.jobId);
      if (job) {
        setSelectedJob(job);
        setStep((saved.step as any) || "dashboard");
        setCurrentCriterionIndex(saved.currentCriterionIndex || 0);
        setActiveTab(saved.activeTab || "criteria");
        setExpandedSubEvidence(saved.expandedSubEvidence || null);
        if (saved.personalInfo) setPersonalInfo(saved.personalInfo);
        if (saved.customCriteria) setCustomCriteria(saved.customCriteria);
        if (saved.themeId) {
          const theme = THEMES.find(t => t.id === saved.themeId);
          if (theme) setSelectedTheme(theme);
        }
        // استعادة criteriaData - دمج مع البيانات الافتراضية
        if (saved.criteriaData) {
          const allCrit = [...job.criteria, ...(saved.customCriteria || [])];
          const merged: Record<string, CriterionData> = {};
          allCrit.forEach(c => {
            merged[c.id] = saved.criteriaData[c.id] || { score: 0, notes: "", evidences: [], customSubEvidences: [] };
          });
          setCriteriaData(merged);
        } else {
          initCriteriaData(job.criteria);
        }
        // إظهار رسالة استعادة
        const wasPendingUpload = localStorage.getItem(STORAGE_PENDING_UPLOAD);
        if (wasPendingUpload) {
          toast.info("تم استعادة بياناتك بعد العودة", {
            description: "يرجى رفع الشاهد مرة أخرى - المتصفح أعاد تحميل الصفحة",
            duration: 6000,
          });
          localStorage.removeItem(STORAGE_PENDING_UPLOAD);
        } else {
          toast.success("تم استعادة بياناتك السابقة تلقائياً", { duration: 3000 });
        }
      }
    }
    setStateRestored(true);
  }, [stateRestored]);

  // ===== حفظ الـ state تلقائياً عند كل تغيير =====
  useEffect(() => {
    if (!selectedJob || step === "select") return;
    saveStateToStorage({
      step, jobId: selectedJob.id, themeId: selectedTheme.id,
      criteriaData, personalInfo, customCriteria,
      currentCriterionIndex, activeTab, expandedSubEvidence,
    });
  }, [step, selectedJob, selectedTheme, criteriaData, personalInfo, customCriteria, currentCriterionIndex, activeTab, expandedSubEvidence]);

  // ===== حفظ تلقائي عند إغلاق المتصفح أو الانتقال =====
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!selectedJob || step === "select") return;
      saveStateToStorage({
        step, jobId: selectedJob.id, themeId: selectedTheme.id,
        criteriaData, personalInfo, customCriteria,
        currentCriterionIndex, activeTab, expandedSubEvidence,
      });
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    // حفظ عند visibilitychange (عندما ينتقل المستخدم لتطبيق آخر على الجوال)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && selectedJob && step !== "select") {
        saveStateToStorage({
          step, jobId: selectedJob.id, themeId: selectedTheme.id,
          criteriaData, personalInfo, customCriteria,
          currentCriterionIndex, activeTab, expandedSubEvidence,
        });
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  });

  // ===== حسابات تحليل الفجوات =====
  const gapAnalysis = useMemo(() => {
    let totalEvidences = 0;
    let coveredCriteria = 0;
    let partialCriteria = 0;
    let missedCriteria = 0;

    allCriteria.forEach((c) => {
      const data = criteriaData[c.id];
      if (!data) { missedCriteria++; return; }
      const evCount = data.evidences.length;
      totalEvidences += evCount;
      if (data.score >= 4 && evCount > 0) coveredCriteria++;
      else if (evCount > 0 || data.score > 0) partialCriteria++;
      else missedCriteria++;
    });

    const percentage = allCriteria.length > 0
      ? Math.round(((coveredCriteria + partialCriteria * 0.5) / allCriteria.length) * 100)
      : 0;

    return { totalEvidences, coveredCriteria, partialCriteria, missedCriteria, percentage };
  }, [allCriteria, criteriaData]);

  // ===== عدد المؤشرات المغطاة (للمعلم) =====
  const indicatorsCoverage = useMemo(() => {
    if (!selectedJob?.isTeacher) return null;
    let totalIndicators = 0;
    let coveredIndicators = 0;
    STANDARDS.forEach(std => {
      std.indicators.forEach(ind => {
        totalIndicators++;
        const data = criteriaData[std.id];
        if (data && data.evidences.some(e => e.subEvidenceId === ind.id)) {
          coveredIndicators++;
        }
      });
    });
    return { total: totalIndicators, covered: coveredIndicators, percentage: totalIndicators > 0 ? Math.round((coveredIndicators / totalIndicators) * 100) : 0 };
  }, [selectedJob, criteriaData]);

  const updateScore = (criterionId: string, score: number) => {
    setCriteriaData((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], score } }));
  };

  const addEvidence = (criterionId: string, subEvidenceId: string, type: EvidenceType = "text") => {
    const ev = createEmptyEvidence(subEvidenceId);
    ev.type = type;
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, ev] },
    }));
  };

  const removeEvidence = (criterionId: string, evidenceId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: prev[criterionId].evidences.filter((e) => e.id !== evidenceId) },
    }));
  };

  const updateEvidence = (criterionId: string, evidenceId: string, updates: Partial<EvidenceItem>) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: prev[criterionId].evidences.map((e) => (e.id === evidenceId ? { ...e, ...updates } : e)) },
    }));
  };

  const updateFormField = (criterionId: string, evidenceId: string, fieldId: string, value: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: prev[criterionId].evidences.map((e) =>
          e.id === evidenceId ? { ...e, formData: { ...e.formData, [fieldId]: value } } : e
        ),
      },
    }));
  };

  const addCustomSubEvidence = (criterionId: string) => {
    if (!newSubTitle.trim()) return;
    const newSub: SubEvidence = {
      id: `custom_${Date.now()}`, title: newSubTitle.trim(),
      description: "قسم فرعي مخصص", type: "both", isCustom: true,
      formFields: [{ id: "content", label: "المحتوى", type: "textarea", placeholder: "أدخل المحتوى..." }],
    };
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], customSubEvidences: [...prev[criterionId].customSubEvidences, newSub] },
    }));
    setNewSubTitle("");
    setShowAddSub(null);
  };

  const addCustomMainSection = () => {
    if (!newMainSectionTitle.trim()) return;
    const newCriterion: Criterion = {
      id: `custom_main_${Date.now()}`, title: newMainSectionTitle.trim(), maxScore: 5,
      description: newMainSectionDesc.trim() || "قسم رئيسي مخصص",
      subEvidences: [{ id: `custom_main_${Date.now()}_sub1`, title: "شاهد عام", description: "شاهد عام", type: "both", formFields: [{ id: "content", label: "المحتوى", type: "textarea", placeholder: "أدخل التفاصيل..." }] }],
    };
    setCustomCriteria(prev => [...prev, newCriterion]);
    setCriteriaData(prev => ({ ...prev, [newCriterion.id]: { score: 0, notes: "", evidences: [], customSubEvidences: [] } }));
    setNewMainSectionTitle("");
    setNewMainSectionDesc("");
    setShowAddMainSection(false);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file || !activeUploadRef.current) return;
    
    // التحقق من حجم الملف
    if (file.size > 16 * 1024 * 1024) {
      toast.error("حجم الملف كبير جداً", { description: "الحد الأقصى 16 ميجابايت" });
      e.target.value = "";
      return;
    }
    
    const { criterionId, subEvidenceId } = activeUploadRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const newEv = createEmptyEvidence(subEvidenceId);
      newEv.type = isImage ? "image" : isVideo ? "video" : "file";
      newEv.fileData = reader.result as string;
      newEv.fileName = file.name;
      newEv.text = file.name;
      newEv.displayAs = isImage ? "image" : "qr";
      setCriteriaData((prev) => ({
        ...prev,
        [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, newEv] },
      }));
      toast.success("تم إضافة الشاهد بنجاح", { description: file.name, duration: 3000 });
    };
    reader.onerror = () => {
      toast.error("فشل قراءة الملف", { description: "يرجى المحاولة مرة أخرى" });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    try { localStorage.removeItem(STORAGE_PENDING_UPLOAD); } catch {}
  }, []);

  const triggerFileUpload = (criterionId: string, subEvidenceId: string) => {
    activeUploadRef.current = { criterionId, subEvidenceId };
    try { localStorage.setItem(STORAGE_PENDING_UPLOAD, "file"); } catch {}
    fileInputRef.current?.click();
  };

  // ===== رفع ذكي مع تصنيف AI تلقائي =====
  const [isSmartUploading, setIsSmartUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ stage: string; percent: number } | null>(null);

  // ===== ضغط الصورة قبل إرسالها للـ AI =====
  const compressImage = useCallback((base64: string, maxWidth = 800, quality = 0.6): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let w = img.width, h = img.height;
        if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
        canvas.width = w; canvas.height = h;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(base64); // fallback to original
      img.src = base64;
    });
  }, []);

  const handleSmartUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const file = e.target.files?.[0];
    if (!file) return;
    
    // التحقق من حجم الملف (16MB حد أقصى)
    if (file.size > 16 * 1024 * 1024) {
      toast.error("حجم الملف كبير جداً", { description: "الحد الأقصى 16 ميجابايت. يرجى اختيار ملف أصغر." });
      e.target.value = "";
      return;
    }
    
    setIsSmartUploading(true);
    setUploadProgress({ stage: "جاري قراءة الملف...", percent: 10 });
    
    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const originalBase64 = reader.result as string;
        
        setUploadProgress({ stage: "جاري معالجة الملف...", percent: 30 });
        
        // ضغط الصورة قبل إرسالها للـ AI لتقليل حجم الـ payload
        let aiImageUrl: string | undefined;
        if (isImage) {
          setUploadProgress({ stage: "جاري ضغط الصورة...", percent: 40 });
          aiImageUrl = await compressImage(originalBase64, 800, 0.5);
        }

        setUploadProgress({ stage: "جاري التصنيف بالذكاء الاصطناعي...", percent: 60 });
        
        // إرسال للـ AI للتحليل (publicProcedure - لا يحتاج تسجيل دخول)
        const result = await classifyMutation.mutateAsync({
          fileName: file.name,
          fileType: file.type,
          description: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
          fileUrl: aiImageUrl,
        });

        setUploadProgress({ stage: "جاري إضافة الشاهد...", percent: 85 });
        
        if (result.success && result.classification) {
          const cls = result.classification;
          const targetCriterion = allCriteria.find(c =>
            c.id === cls.standardId || c.title.includes(cls.standardName) || cls.standardName.includes(c.title)
          );
          if (targetCriterion && criteriaData[targetCriterion.id]) {
            const subs = [...targetCriterion.subEvidences, ...(criteriaData[targetCriterion.id]?.customSubEvidences || [])];
            const targetSub = (cls.indicatorIndex > 0 && subs[cls.indicatorIndex - 1]) ? subs[cls.indicatorIndex - 1] : subs[0];
            const newEv = createEmptyEvidence(targetSub?.id || "");
            newEv.type = isImage ? "image" : isVideo ? "video" : "file";
            newEv.fileData = originalBase64; // حفظ الصورة الأصلية بدون ضغط
            newEv.fileName = file.name;
            newEv.text = cls.contentDescription || file.name;
            newEv.displayAs = isImage ? "image" : "qr";
            setCriteriaData((prev) => ({
              ...prev,
              [targetCriterion.id]: { ...prev[targetCriterion.id], evidences: [...prev[targetCriterion.id].evidences, newEv] },
            }));
            toast.success(`تم تصنيف الشاهد تلقائياً`, {
              description: `البند: ${targetCriterion.title}\nالمؤشر: ${cls.indicatorText}\nالثقة: ${Math.round(cls.confidence * 100)}%`,
              duration: 6000,
            });
          } else {
            toast.info("لم يتم العثور على بند مطابق، تم إضافته للبند الأول");
            const firstCriterion = allCriteria[0];
            if (firstCriterion) {
              const newEv = createEmptyEvidence(firstCriterion.subEvidences[0]?.id || "");
              newEv.type = isImage ? "image" : isVideo ? "video" : "file";
              newEv.fileData = originalBase64;
              newEv.fileName = file.name;
              newEv.displayAs = isImage ? "image" : "qr";
              setCriteriaData((prev) => ({
                ...prev, [firstCriterion.id]: { ...prev[firstCriterion.id], evidences: [...prev[firstCriterion.id].evidences, newEv] },
              }));
            }
          }
        } else {
          // حتى لو فشل التصنيف، نضيف الشاهد للبند الأول
          toast.warning("لم يتمكن النظام من تصنيف الشاهد تلقائياً", {
            description: "تم إضافته للبند الأول. يمكنك نقله يدوياً للبند المناسب.",
            duration: 5000,
          });
          const firstCriterion = allCriteria[0];
          if (firstCriterion) {
            const newEv = createEmptyEvidence(firstCriterion.subEvidences[0]?.id || "");
            newEv.type = isImage ? "image" : isVideo ? "video" : "file";
            newEv.fileData = originalBase64;
            newEv.fileName = file.name;
            newEv.displayAs = isImage ? "image" : "qr";
            setCriteriaData((prev) => ({
              ...prev, [firstCriterion.id]: { ...prev[firstCriterion.id], evidences: [...prev[firstCriterion.id].evidences, newEv] },
            }));
          }
        }
      } catch (err: any) {
        console.error("Smart upload error:", err);
        // منع الرجوع لصفحة تسجيل الدخول - إضافة الشاهد يدوياً
        const isImage = file.type.startsWith("image/");
        const isVideo = file.type.startsWith("video/");
        const originalBase64 = reader.result as string;
        
        toast.warning("فشل التصنيف التلقائي", {
          description: "تم إضافة الملف للبند الأول. يمكنك نقله يدوياً.",
          duration: 5000,
        });
        
        // إضافة الشاهد للبند الأول كـ fallback
        const firstCriterion = allCriteria[0];
        if (firstCriterion) {
          const newEv = createEmptyEvidence(firstCriterion.subEvidences[0]?.id || "");
          newEv.type = isImage ? "image" : isVideo ? "video" : "file";
          newEv.fileData = originalBase64;
          newEv.fileName = file.name;
          newEv.displayAs = isImage ? "image" : "qr";
          setCriteriaData((prev) => ({
            ...prev, [firstCriterion.id]: { ...prev[firstCriterion.id], evidences: [...prev[firstCriterion.id].evidences, newEv] },
          }));
        }
      } finally {
        setUploadProgress({ stage: "اكتمل!", percent: 100 });
        setTimeout(() => { setUploadProgress(null); setIsSmartUploading(false); }, 1000);
      }
    };
    reader.onerror = () => {
      toast.error("فشل قراءة الملف", { description: "يرجى المحاولة مرة أخرى" });
      setUploadProgress(null);
      setIsSmartUploading(false);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
    // إزالة pending upload flag بعد بدء الرفع بنجاح
    try { localStorage.removeItem(STORAGE_PENDING_UPLOAD); } catch {}
  }, [allCriteria, criteriaData, classifyMutation, compressImage]);

  // ===== AI Functions =====
  const callAI = async (criterionId: string, subId: string, userPrompt: string) => {
    const key = `${criterionId}_${subId}`;
    setAiLoading(key);
    try {
      const currentCrit = allCriteria.find(c => c.id === criterionId);
      const allSubs = [...(currentCrit?.subEvidences || []), ...(criteriaData[criterionId]?.customSubEvidences || [])];
      const currentSub = allSubs.find(s => s.id === subId);
      const result = await suggestMutation.mutateAsync({
        prompt: userPrompt || `اقترح شاهد أداء وظيفي لبند "${currentCrit?.title}" - ${currentSub?.title}`,
        context: `الوظيفة: ${selectedJob?.title}, البند: ${currentCrit?.title}, الشاهد الفرعي: ${currentSub?.title}`,
      });
      if (result.content) {
        setAiChat((prev) => ({ ...prev, [key]: [...(prev[key] || []), result.content] }));
      }
    } catch {
      setAiChat((prev) => ({ ...prev, [key]: [...(prev[key] || []), "حدث خطأ في الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى."] }));
    }
    setAiLoading(null);
    setAiPrompt("");
  };

  const fillFormWithAI = async (criterionId: string, subId: string, evId: string, fields: FormField[]) => {
    const key = `fill_${evId}`;
    setAiLoading(key);
    try {
      const currentCrit = allCriteria.find(c => c.id === criterionId);
      const allSubs = [...(currentCrit?.subEvidences || []), ...(criteriaData[criterionId]?.customSubEvidences || [])];
      const currentSub = allSubs.find(s => s.id === subId);
      const result = await fillFormMutation.mutateAsync({
        jobTitle: selectedJob?.title || "", criterionName: currentCrit?.title || "",
        subEvidenceName: currentSub?.title || "",
        formFields: fields.map(f => ({ id: f.id, label: f.label, type: f.type })),
      });
      if (result.success && result.filledData) {
        Object.entries(result.filledData).forEach(([fieldId, value]) => {
          updateFormField(criterionId, evId, fieldId, String(value));
        });
        toast.success("تم تعبئة النموذج بالذكاء الاصطناعي");
      }
    } catch { toast.error("فشل تعبئة النموذج"); }
    setAiLoading(null);
  };

  const improveFieldText = async (criterionId: string, evId: string, fieldId: string, currentText: string) => {
    if (!currentText.trim()) return;
    const key = `improve_${evId}_${fieldId}`;
    setAiLoading(key);
    try {
      const result = await improveMutation.mutateAsync({ text: currentText, context: `شاهد أداء وظيفي - ${selectedJob?.title}` });
      if (result.improved) {
        updateFormField(criterionId, evId, fieldId, result.improved);
        toast.success("تم تحسين النص");
      }
    } catch { /* ignore */ }
    setAiLoading(null);
  };

  // ===== Save & Calculations =====
  const [isSaving, setIsSaving] = useState(false);

  const saveReport = async () => {
    if (!selectedJob) return;
    if (!isAuthenticated) {
      // حفظ محلي كاحتياطي للمستخدمين غير المسجلين
      const data = { personalInfo, criteriaData, jobId: selectedJob?.id, themeId: selectedTheme.id, customCriteria };
      localStorage.setItem(`sers_perf_${personalInfo.name || "draft"}`, JSON.stringify(data));
      toast.success("تم حفظ البيانات محلياً! سجل دخولك لحفظها في السحابة.");
      return;
    }
    setIsSaving(true);
    try {
      const success = await portfolio.savePortfolio({
        jobId: selectedJob.id,
        jobTitle: selectedJob.title,
        personalInfo,
        criteriaData,
        customCriteria,
        themeId: selectedTheme.id,
        completionPercentage: percentage,
      });
      if (success) {
        toast.success("تم حفظ البيانات في السحابة بنجاح!");
      }
    } catch {
      toast.error("فشل الحفظ، يرجى المحاولة مرة أخرى");
    }
    setIsSaving(false);
  };

  const totalScore = Object.values(criteriaData).reduce((sum, c) => sum + c.score, 0);
  const maxScore = allCriteria.length * 5;
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
    await exportToPDF("preview-content", `شواهد_الأداء_${personalInfo.name || "مستند"}.pdf`);
    setIsExporting(false);
  };

  const currentCriterion = allCriteria[currentCriterionIndex];

  // ===== Render Evidence Item =====
  const renderEvidenceItem = (ev: EvidenceItem, criterionId: string) => (
    <motion.div key={ev.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      className="bg-muted/50 rounded-xl p-4 border border-border group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {ev.type === 'text' && <Type className="w-4 h-4 text-muted-foreground" />}
          {ev.type === 'image' && <Image className="w-4 h-4 text-blue-500" />}
          {ev.type === 'link' && <LinkIcon className="w-4 h-4 text-purple-500" />}
          {ev.type === 'file' && <FileText className="w-4 h-4 text-orange-500" />}
          {ev.type === 'video' && <Video className="w-4 h-4 text-red-500" />}
          <span className="text-xs font-medium text-muted-foreground">
            {ev.type === 'text' ? 'نص' : ev.type === 'image' ? 'صورة' : ev.type === 'link' ? 'رابط' : ev.type === 'file' ? 'ملف' : 'فيديو'}
          </span>
          {ev.fileName && <span className="text-xs text-muted-foreground/70">({ev.fileName})</span>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {ev.type === 'image' && (
            <Tooltip>
              <TooltipTrigger asChild>
                <button type="button" onClick={() => updateEvidence(criterionId, ev.id, { displayAs: ev.displayAs === 'image' ? 'qr' : 'image' })}
                  className={`p-1.5 rounded-lg text-xs ${ev.displayAs === 'qr' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}>
                  {ev.displayAs === 'image' ? <QrCode className="w-3.5 h-3.5" /> : <Image className="w-3.5 h-3.5" />}
                </button>
              </TooltipTrigger>
              <TooltipContent>{ev.displayAs === 'image' ? 'تحويل لباركود QR' : 'عرض كصورة'}</TooltipContent>
            </Tooltip>
          )}
          <button type="button" onClick={() => removeEvidence(criterionId, ev.id)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {ev.type === 'text' && !ev.formData && (
        <textarea value={ev.text} onChange={(e) => updateEvidence(criterionId, ev.id, { text: e.target.value })}
          placeholder="اكتب نص الشاهد هنا..." rows={2}
          className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
      )}

      {ev.type === 'link' && (
        <input type="url" value={ev.link} onChange={(e) => updateEvidence(criterionId, ev.id, { link: e.target.value })}
          placeholder="https://example.com" dir="ltr"
          className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
      )}

      {(ev.type === 'image' || ev.type === 'video' || ev.type === 'file') && ev.fileData && (
        <div className="mt-2">
          {ev.type === 'image' && ev.displayAs === 'image' && (
            <img src={ev.fileData} alt="" className="max-h-48 rounded-lg border border-border" />
          )}
          {ev.type === 'image' && ev.displayAs === 'qr' && (
            <div className="flex items-center gap-3 bg-violet-50 p-3 rounded-lg">
              <img src={generateQRDataURL(ev.fileData.substring(0, 200))} alt="QR" className="w-16 h-16" />
              <span className="text-xs text-violet-600">سيظهر كباركود QR عند الطباعة</span>
            </div>
          )}
          {ev.type === 'video' && (
            <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg">
              <Video className="w-8 h-8 text-red-500" />
              <div><p className="text-sm font-medium">{ev.fileName}</p><p className="text-xs text-red-500">سيتحول لباركود QR عند الطباعة</p></div>
            </div>
          )}
          {ev.type === 'file' && (
            <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-lg">
              <FileText className="w-8 h-8 text-orange-500" />
              <div><p className="text-sm font-medium">{ev.fileName}</p><p className="text-xs text-orange-500">سيتحول لباركود QR عند الطباعة</p></div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  // ======================================================================
  // ===== الخطوة 1: اختيار الوظيفة =====
  // ======================================================================
  if (step === "select") {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-3 sm:p-4 md:p-8" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-1.5 sm:gap-2 text-muted-foreground hover:text-foreground mb-5 sm:mb-8 transition-colors group">
            <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 transition-transform group-hover:-translate-x-1" /><span className="text-xs sm:text-sm">العودة للرئيسية</span>
          </button>

          {/* Hero Section - Mobile Optimized */}
          <div className="text-center mb-6 sm:mb-10">
            <div className="relative w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center mx-auto mb-3 sm:mb-5 shadow-lg shadow-emerald-500/20">
              <BarChart3 className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
            </div>
            <h1 className="text-xl sm:text-3xl md:text-4xl font-black text-foreground mb-2 sm:mb-3" style={{ fontFamily: "var(--font-heading)" }}>
              شواهد الأداء الوظيفي
            </h1>
            <p className="text-muted-foreground max-w-lg mx-auto leading-relaxed text-xs sm:text-sm px-2">
              اختر وظيفتك لبدء إعداد ملف الإنجاز. يتضمن النظام ذكاء اصطناعي تفاعلي لتصنيف الشواهد وتعبئة النماذج تلقائياً.
            </p>
            <div className="flex items-center justify-center gap-2 mt-3 sm:mt-4">
              <Badge variant="secondary" className="gap-1 sm:gap-1.5 py-1 sm:py-1.5 px-3 sm:px-4 text-[10px] sm:text-xs">
                <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-violet-500" />
                ذكاء اصطناعي مفعّل تلقائياً
              </Badge>
            </div>
          </div>

          {/* Featured: معلم/معلمة */}
          <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-4 sm:mb-6">
            <Card className="cursor-pointer hover:shadow-xl transition-all duration-300 border-emerald-200 bg-gradient-to-l from-emerald-50/80 to-background hover:border-emerald-300 overflow-hidden relative group"
              onClick={() => handleSelectJob(JOB_TYPES[0])}>
              <CardContent className="p-4 sm:p-6 md:p-8">
                <div className="flex items-center gap-3 sm:gap-5">
                  <div className="w-12 h-12 sm:w-16 sm:h-16 rounded-xl sm:rounded-2xl bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center shrink-0 shadow-md shadow-emerald-500/20 group-hover:scale-105 transition-transform">
                    <GraduationCap className="w-6 h-6 sm:w-8 sm:h-8 text-white" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5 sm:mb-1 flex-wrap">
                      <h3 className="text-base sm:text-xl font-black text-foreground" style={{ fontFamily: "var(--font-heading)" }}>معلم / معلمة</h3>
                      <Badge className="bg-emerald-600 text-white text-[9px] sm:text-[10px] hover:bg-emerald-700">الأكثر استخداماً</Badge>
                    </div>
                    <p className="text-[11px] sm:text-sm text-muted-foreground mb-1.5 sm:mb-2 line-clamp-2">نظام شامل يغطي 11 معيار و 45 مؤشر أداء وفق وزارة التعليم 1447هـ</p>
                    <div className="flex items-center gap-1.5 sm:gap-3 flex-wrap">
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] gap-0.5 sm:gap-1 border-emerald-300 text-emerald-700">
                        <Sparkles className="w-2.5 h-2.5 sm:w-3 sm:h-3" />11 معيار
                      </Badge>
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] gap-0.5 sm:gap-1 border-emerald-300 text-emerald-700">
                        45 مؤشر
                      </Badge>
                      <Badge variant="outline" className="text-[9px] sm:text-[10px] gap-0.5 sm:gap-1 border-emerald-300 text-emerald-700">
                        11 بند تقييم
                      </Badge>
                    </div>
                  </div>
                  <ArrowLeft className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground group-hover:text-emerald-600 transition-colors shrink-0" />
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* باقي الوظائف */}
          <div className="mb-3 sm:mb-4">
            <h2 className="text-xs sm:text-sm font-bold text-muted-foreground mb-2 sm:mb-3" style={{ fontFamily: "var(--font-heading)" }}>وظائف أخرى</h2>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 sm:gap-3">
            {JOB_TYPES.slice(1).map((job, i) => {
              const Icon = job.icon;
              return (
                <motion.div key={job.id} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: (i + 1) * 0.04 }}>
                  <Card className="cursor-pointer hover:shadow-md hover:-translate-y-0.5 transition-all duration-200 border-border/60 hover:border-opacity-100 h-full group"
                    style={{ ['--hover-border' as string]: job.color }}
                    onClick={() => handleSelectJob(job)}>
                    <CardContent className="p-3 sm:p-4">
                      <div className="flex items-center gap-2.5 sm:gap-3">
                        <div className="w-9 h-9 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 transition-transform group-hover:scale-105"
                          style={{ backgroundColor: job.color + "12", border: `1.5px solid ${job.color}25` }}>
                          <Icon className="w-4 h-4 sm:w-5 sm:h-5" style={{ color: job.color }} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <h3 className="font-bold text-foreground text-xs sm:text-sm truncate" style={{ fontFamily: "var(--font-heading)" }}>{job.title}</h3>
                          <p className="text-[10px] sm:text-[11px] text-muted-foreground">{job.criteria.length} بند تقييم</p>
                        </div>
                        <ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-muted-foreground/50 group-hover:text-foreground transition-colors shrink-0" />
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ======================================================================
  // ===== الخطوة 2: لوحة التحكم الرئيسية =====
  // ======================================================================
  if (step === "dashboard") {
    const grade = getGrade(percentage);
    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6" dir="rtl">
        <input type="file" ref={smartUploadRef} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleSmartUpload} />
        <div className="max-w-6xl mx-auto">

          {/* ===== Header Bar - Mobile Optimized ===== */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-4 sm:mb-6 bg-card/80 backdrop-blur-sm rounded-xl p-2.5 sm:p-3 border border-border/40 shadow-sm">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="ghost" size="sm" onClick={() => { clearStorageState(); setStep("select"); }} className="gap-1 sm:gap-1.5 text-muted-foreground hover:text-foreground text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" />تغيير الوظيفة
              </Button>
              <div className="w-px h-4 sm:h-5 bg-border/60" />
              <Button variant="ghost" size="sm" onClick={saveReport} disabled={isSaving} className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
                {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                <span className="hidden xs:inline">{isSaving ? "جاري الحفظ..." : "حفظ"}</span>
              </Button>
            </div>
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="flex items-center gap-1.5 sm:gap-2 px-2.5 sm:px-3 py-1 sm:py-1.5 rounded-lg" style={{ backgroundColor: grade.color + '12' }}>
                <span className="text-base sm:text-xl font-black" style={{ color: grade.color }}>{percentage}%</span>
                <span className="text-[10px] sm:text-xs font-medium" style={{ color: grade.color }}>{grade.label}</span>
              </div>
              <Button onClick={() => setStep("final-review")} size="sm" className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 sm:h-9 px-2.5 sm:px-3">
                <Eye className="w-3.5 h-3.5 sm:w-4 sm:h-4" /><span className="hidden sm:inline">التقييم النهائي</span><span className="sm:hidden">التقييم</span>
              </Button>
            </div>
          </div>

          {/* ===== Title - Mobile Optimized ===== */}
          <div className="mb-4 sm:mb-6">
            <div className="flex items-center gap-2.5 sm:gap-3">
              {selectedJob && (
                <div className="w-9 h-9 sm:w-10 sm:h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: selectedJob.color + '15' }}>
                  <selectedJob.icon className="w-4.5 h-4.5 sm:w-5 sm:h-5" style={{ color: selectedJob.color }} />
                </div>
              )}
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl md:text-2xl font-black text-foreground truncate" style={{ fontFamily: "var(--font-heading)" }}>
                  {selectedJob?.title}
                </h1>
                {selectedJob?.isTeacher && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">نظام المعايير الـ 11 · {indicatorsCoverage?.covered || 0}/{indicatorsCoverage?.total || 45} مؤشر مغطى</p>
                )}
              </div>
            </div>
          </div>

          {/* ===== لوحة تحليل الفجوات - Mobile Optimized ===== */}
          <Card className="mb-4 sm:mb-6 border-border/40 shadow-sm">
            <CardContent className="p-3 sm:p-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3 mb-3 sm:mb-4">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <TrendingUp className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                  </div>
                  <h2 className="font-bold text-foreground text-xs sm:text-sm" style={{ fontFamily: "var(--font-heading)" }}>تحليل الجاهزية</h2>
                </div>
                <Button onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { localStorage.setItem(STORAGE_PENDING_UPLOAD, "smart"); } catch {} smartUploadRef.current?.click(); }} disabled={isSmartUploading}
                  variant="default" size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 shadow-sm text-xs h-8 sm:h-9 w-full sm:w-auto">
                  {isSmartUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                  {isSmartUploading ? "جاري التصنيف..." : "رفع شاهد مع تصنيف ذكي"}
                </Button>
              </div>

              {/* شريط تقدم التصنيف الذكي */}
              {uploadProgress && (
                <div className="mb-3 sm:mb-4 bg-violet-50 dark:bg-violet-950/30 rounded-lg p-3 border border-violet-200/50 animate-in fade-in duration-300">
                  <div className="flex items-center justify-between text-xs mb-2">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-3.5 h-3.5 text-violet-600 animate-spin" />
                      <span className="font-medium text-violet-700 dark:text-violet-400">{uploadProgress.stage}</span>
                    </div>
                    <span className="font-bold text-violet-600">{uploadProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-violet-200/50 dark:bg-violet-800/30 rounded-full h-2 overflow-hidden">
                    <div className="h-full bg-violet-600 rounded-full transition-all duration-500 ease-out" style={{ width: `${uploadProgress.percent}%` }} />
                  </div>
                </div>
              )}

              {/* شريط التقدم العام */}
              <div className="mb-3 sm:mb-4">
                <div className="flex items-center justify-between text-xs sm:text-sm mb-1.5 sm:mb-2">
                  <span className="font-bold" style={{ color: grade.color }}>{gapAnalysis.percentage}% جاهزية</span>
                  <span className="text-[10px] sm:text-xs text-muted-foreground">{gapAnalysis.totalEvidences} شاهد مرفوع</span>
                </div>
                <Progress value={gapAnalysis.percentage} className="h-2 sm:h-2.5" />
              </div>

              {/* إحصائيات سريعة - Mobile Grid */}
              <div className="grid grid-cols-3 gap-2 sm:gap-3">
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 bg-emerald-50 dark:bg-emerald-950/30 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-emerald-200/50 text-center sm:text-right">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center shrink-0">
                    <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-black text-emerald-700 dark:text-emerald-400 leading-none">{gapAnalysis.coveredCriteria}</p>
                    <p className="text-[9px] sm:text-[10px] text-emerald-600 dark:text-emerald-500 mt-0.5">مكتمل</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 bg-amber-50 dark:bg-amber-950/30 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-amber-200/50 text-center sm:text-right">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center shrink-0">
                    <AlertTriangle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-black text-amber-700 dark:text-amber-400 leading-none">{gapAnalysis.partialCriteria}</p>
                    <p className="text-[9px] sm:text-[10px] text-amber-600 dark:text-amber-500 mt-0.5">جزئي</p>
                  </div>
                </div>
                <div className="flex flex-col sm:flex-row items-center sm:items-center gap-1.5 sm:gap-3 bg-red-50 dark:bg-red-950/30 rounded-lg sm:rounded-xl p-2 sm:p-3 border border-red-200/50 text-center sm:text-right">
                  <div className="w-7 h-7 sm:w-9 sm:h-9 rounded-lg bg-red-100 dark:bg-red-900/50 flex items-center justify-center shrink-0">
                    <XCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-red-500" />
                  </div>
                  <div>
                    <p className="text-base sm:text-lg font-black text-red-600 dark:text-red-400 leading-none">{gapAnalysis.missedCriteria}</p>
                    <p className="text-[9px] sm:text-[10px] text-red-500 dark:text-red-400 mt-0.5">مفقود</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* ===== Tabs ===== */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-4">
              <TabsTrigger value="criteria">البنود ({allCriteria.length})</TabsTrigger>
              <TabsTrigger value="info">البيانات الشخصية</TabsTrigger>
            </TabsList>

            {/* ===== تبويب البنود ===== */}
            <TabsContent value="criteria">
              {/* قائمة البنود */}
              <div className="space-y-3">
                {allCriteria.map((criterion, index) => {
                  const data = criteriaData[criterion.id];
                  if (!data) return null;
                  const evidenceCount = data.evidences.length;
                  const isCustom = criterion.id.startsWith("custom_main_");
                  const status = data.score >= 4 && evidenceCount > 0 ? "complete" : evidenceCount > 0 || data.score > 0 ? "partial" : "missing";
                  const isTeacherStandard = selectedJob?.isTeacher && criterion.id.startsWith("std-");
                  const standard = isTeacherStandard ? STANDARDS.find(s => s.id === criterion.id) : null;
                  const indicatorProgress = isTeacherStandard && standard ? (() => {
                    const covered = standard.indicators.filter(ind => data.evidences.some(e => e.subEvidenceId === ind.id)).length;
                    return { covered, total: standard.indicators.length, pct: standard.indicators.length > 0 ? Math.round((covered / standard.indicators.length) * 100) : 0 };
                  })() : null;

                  return (
                    <Card key={criterion.id}
                      className={`cursor-pointer hover:shadow-md transition-all duration-200 group ${
                        status === "complete" ? "border-emerald-300 bg-emerald-50/20 hover:border-emerald-400"
                        : status === "partial" ? "border-amber-300 bg-amber-50/20 hover:border-amber-400"
                        : "border-border/50 hover:border-primary/30"
                      }`}
                      onClick={() => { setCurrentCriterionIndex(index); setStep("criterion-detail"); }}>
                      <CardContent className="p-3 sm:p-4">
                        <div className="flex items-start sm:items-center gap-2.5 sm:gap-4">
                          {/* رقم البند / أيقونة */}
                          <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center font-bold text-base sm:text-lg shrink-0 transition-transform group-hover:scale-105 ${
                            isCustom ? "bg-violet-100 text-violet-700" : ""
                          }`}
                            style={standard ? { backgroundColor: standard.color + "15" } : !isCustom ? (
                              status === "complete" ? { backgroundColor: "#dcfce7" } : status === "partial" ? { backgroundColor: "#fef3c7" } : { backgroundColor: "#f1f5f9" }
                            ) : undefined}>
                            {standard ? (() => { const StdIcon = STANDARD_ICONS[standard.id]; return StdIcon ? <StdIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: standard.color }} /> : <span className="text-base sm:text-lg font-bold" style={{ color: standard.color }}>{standard.number}</span>; })() : isCustom ? <Plus className="w-4 h-4 sm:w-5 sm:h-5" /> : <span className="text-base sm:text-lg font-bold" style={{ color: status === "complete" ? "#16a34a" : status === "partial" ? "#ca8a04" : "#64748b" }}>{index + 1}</span>}
                          </div>

                          {/* المحتوى */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 sm:gap-2 mb-0.5">
                              <h3 className="font-bold text-foreground text-xs sm:text-sm truncate" style={{ fontFamily: "var(--font-heading)" }}>
                                {criterion.title}
                              </h3>
                              {isCustom && <Badge variant="outline" className="text-[9px] sm:text-[10px] shrink-0">مخصص</Badge>}
                            </div>
                            {isTeacherStandard && standard && indicatorProgress ? (
                              <div className="flex items-center gap-1.5 sm:gap-2 mt-0.5 sm:mt-1">
                                <span className="text-[10px] sm:text-[11px] text-muted-foreground shrink-0">{indicatorProgress.covered}/{indicatorProgress.total} مؤشر</span>
                                <div className="flex-1 h-1 sm:h-1.5 bg-muted rounded-full overflow-hidden max-w-[80px] sm:max-w-[120px]">
                                  <div className="h-full rounded-full transition-all duration-300" style={{ width: `${indicatorProgress.pct}%`, backgroundColor: standard.color }} />
                                </div>
                                <span className="text-[9px] sm:text-[10px] font-medium hidden sm:inline" style={{ color: standard.color }}>الوزن {standard.weight}%</span>
                              </div>
                            ) : (
                              <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{criterion.description}</p>
                            )}
                            {/* Mobile: إحصائيات مصغرة */}
                            <div className="flex items-center gap-2 mt-1.5 sm:hidden">
                              <span className="text-[10px] font-bold" style={{ color: status === "complete" ? "#16A34A" : status === "partial" ? "#CA8A04" : "#9CA3AF" }}>
                                {data.score}/{criterion.maxScore}
                              </span>
                              <span className="text-[10px] text-muted-foreground">{evidenceCount} شاهد</span>
                              {status === "complete" && <CheckCircle className="w-3 h-3 text-emerald-500" />}
                              {status === "partial" && <AlertTriangle className="w-3 h-3 text-amber-500" />}
                              {status === "missing" && <XCircle className="w-3 h-3 text-red-400" />}
                            </div>
                          </div>

                          {/* الإحصائيات - Desktop Only */}
                          <div className="hidden sm:flex items-center gap-4 shrink-0">
                            <div className="flex items-center gap-1.5">
                              {status === "complete" && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                              {status === "partial" && <AlertTriangle className="w-4 h-4 text-amber-500" />}
                              {status === "missing" && <XCircle className="w-4 h-4 text-red-400" />}
                              <div className="text-center">
                                <p className="text-sm font-bold" style={{ color: status === "complete" ? "#16A34A" : status === "partial" ? "#CA8A04" : "#9CA3AF" }}>
                                  {data.score}/{criterion.maxScore}
                                </p>
                              </div>
                            </div>
                            <div className="text-center border-r border-border/50 pr-3">
                              <p className="text-xs font-bold text-foreground">{evidenceCount}</p>
                              <p className="text-[10px] text-muted-foreground">شاهد</p>
                            </div>
                            <ArrowLeft className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                          </div>
                          {/* Mobile arrow */}
                          <ArrowLeft className="w-4 h-4 text-muted-foreground sm:hidden shrink-0 mt-3" />
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              {/* إضافة قسم رئيسي مخصص */}
              {!showAddMainSection ? (
                <Button variant="outline" className="w-full mt-4 border-dashed gap-2" onClick={() => setShowAddMainSection(true)}>
                  <Plus className="w-4 h-4" />إضافة قسم رئيسي مخصص
                </Button>
              ) : (
                <Card className="mt-4 border-violet-200 bg-violet-50/30">
                  <CardContent className="p-4 space-y-3">
                    <input type="text" value={newMainSectionTitle} onChange={(e) => setNewMainSectionTitle(e.target.value)}
                      placeholder="اسم القسم الرئيسي" className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <input type="text" value={newMainSectionDesc} onChange={(e) => setNewMainSectionDesc(e.target.value)}
                      placeholder="وصف مختصر (اختياري)" className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                    <div className="flex gap-2">
                      <Button size="sm" onClick={addCustomMainSection} disabled={!newMainSectionTitle.trim()}>إضافة</Button>
                      <Button size="sm" variant="ghost" onClick={() => setShowAddMainSection(false)}>إلغاء</Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* ===== تبويب البيانات الشخصية ===== */}
            <TabsContent value="info">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="w-5 h-5 text-primary" />البيانات الأساسية
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {[
                      { key: "name", label: "الاسم الكامل", placeholder: "أدخل الاسم الرباعي" },
                      { key: "school", label: "المدرسة", placeholder: "اسم المدرسة" },
                      { key: "year", label: "العام الدراسي", placeholder: "١٤٤٧هـ" },
                      { key: "semester", label: "الفصل الدراسي", placeholder: "الفصل الدراسي الثاني" },
                      { key: "evaluator", label: "اسم المقيّم", placeholder: "اسم المقيّم" },
                      { key: "evaluatorRole", label: "صفة المقيّم", placeholder: "مدير المدرسة" },
                      { key: "date", label: "تاريخ التقييم", placeholder: "١٤٤٧/٠٦/١٥" },
                    ].map((field) => (
                      <div key={field.key}>
                        <label className="block text-sm font-medium text-foreground mb-1.5">{field.label}</label>
                        <input type="text" value={(personalInfo as any)[field.key]}
                          onChange={(e) => setPersonalInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40" />
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    );
  }

  // ======================================================================
  // ===== الخطوة 3: تفاصيل البند =====
  // ======================================================================
  if (step === "criterion-detail" && currentCriterion) {
    const data = criteriaData[currentCriterion.id] || { score: 0, notes: "", evidences: [], customSubEvidences: [] };
    const allSubEvidences = [...(currentCriterion.subEvidences || []), ...(data.customSubEvidences || [])];
    const isTeacherStandard = selectedJob?.isTeacher && currentCriterion.id.startsWith("std-");
    const standard = isTeacherStandard ? STANDARDS.find(s => s.id === currentCriterion.id) : null;

    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6" dir="rtl">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleFileUpload} />
        <div className="max-w-4xl mx-auto">

          {/* Header - Mobile Optimized */}
          <div className="flex items-center justify-between mb-4 sm:mb-5 gap-2">
            <div className="flex items-center gap-1.5 sm:gap-2">
              <Button variant="outline" size="sm" onClick={() => setStep("dashboard")} className="text-xs sm:text-sm h-8 sm:h-9 px-2 sm:px-3">
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" /><span className="hidden sm:inline">العودة للبنود</span><span className="sm:hidden">البنود</span>
              </Button>
              <div className="flex gap-0.5 sm:gap-1">
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" disabled={currentCriterionIndex === 0}
                  onClick={() => setCurrentCriterionIndex(i => i - 1)}><ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
                <Button variant="outline" size="icon" className="h-8 w-8 sm:h-9 sm:w-9" disabled={currentCriterionIndex === allCriteria.length - 1}
                  onClick={() => setCurrentCriterionIndex(i => i + 1)}><ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4" /></Button>
              </div>
            </div>
            <Badge variant="secondary" className="text-[10px] sm:text-xs">{currentCriterionIndex + 1} / {allCriteria.length}</Badge>
          </div>

          {/* Criterion Header Card - Mobile Optimized */}
          <Card className="mb-4 sm:mb-5">
            <CardContent className="p-3 sm:p-5">
              {/* Mobile: Stack layout */}
              <div className="flex flex-col gap-3">
                <div className="flex items-start gap-2.5 sm:gap-3">
                  <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center text-base sm:text-lg shrink-0"
                    style={{ backgroundColor: (standard?.color || selectedJob?.color || "#059669") + "15" }}>
                    {standard ? (() => { const StdIcon = STANDARD_ICONS[standard.id]; return StdIcon ? <StdIcon className="w-5 h-5 sm:w-6 sm:h-6" style={{ color: standard.color }} /> : <span className="text-base sm:text-lg font-bold">{standard.number}</span>; })() : <span className="text-base sm:text-lg font-bold">{currentCriterionIndex + 1}</span>}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h1 className="text-base sm:text-xl font-black text-foreground mb-0.5 sm:mb-1 leading-snug" style={{ fontFamily: "var(--font-heading)" }}>
                      {currentCriterion.title}
                    </h1>
                    <p className="text-[11px] sm:text-sm text-muted-foreground leading-relaxed">{currentCriterion.description}</p>
                    {isTeacherStandard && standard && (
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                        <Badge variant="outline" className="text-[9px] sm:text-[10px]">الوزن: {standard.weight}%</Badge>
                        <Badge variant="outline" className="text-[9px] sm:text-[10px]">{standard.indicators.length} مؤشر</Badge>
                      </div>
                    )}
                  </div>
                </div>
                {/* الدرجة - منفصلة على الجوال */}
                <div className="flex items-center justify-between bg-muted/30 rounded-lg p-2.5 sm:p-3 border border-border/30">
                  <label className="text-xs text-muted-foreground font-medium">الدرجة</label>
                  <div className="flex gap-1 sm:gap-1.5">
                    {[1, 2, 3, 4, 5].map((s) => (
                      <button type="button" key={s} onClick={(e) => { e.stopPropagation(); updateScore(currentCriterion.id, s); }}
                        className={`w-8 h-8 sm:w-9 sm:h-9 rounded-lg text-xs sm:text-sm font-bold transition-all ${data.score >= s ? 'bg-primary text-primary-foreground shadow-md' : 'bg-background text-muted-foreground hover:bg-muted/80 border border-border/50'}`}>{s}</button>
                    ))}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Sub-Evidences */}
          <div className="space-y-3">
            {allSubEvidences.map((sub) => {
              const subEvidences = data.evidences.filter(e => e.subEvidenceId === sub.id);
              const isExpanded = expandedSubEvidence === sub.id;
              const aiKey = `${currentCriterion.id}_${sub.id}`;
              const aiMessages = aiChat[aiKey] || [];
              const hasFormEvidence = subEvidences.some(e => e.formData && Object.keys(e.formData).length > 0);

              return (
                <Card key={sub.id} className={`overflow-hidden transition-all ${isExpanded ? 'border-primary/30 shadow-sm' : 'border-border/50'}`}>
                  <div role="button" tabIndex={0} onClick={() => {
                    setExpandedSubEvidence(isExpanded ? null : sub.id);
                    if (!isExpanded && (sub.type === 'report' || sub.type === 'both') && sub.formFields && !hasFormEvidence) {
                      addEvidence(currentCriterion.id, sub.id, "text");
                    }
                  }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedSubEvidence(isExpanded ? null : sub.id); }}
                    className="w-full flex items-center justify-between p-3 sm:p-4 hover:bg-muted/30 transition-colors text-right cursor-pointer">
                    <div className="flex items-center gap-2 sm:gap-3 min-w-0">
                      <div className={`w-7 h-7 sm:w-8 sm:h-8 rounded-lg flex items-center justify-center text-sm shrink-0 ${
                        subEvidences.length > 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-muted text-muted-foreground'
                      }`}>
                        {subEvidences.length > 0 ? <CheckCircle className="w-3.5 h-3.5 sm:w-4 sm:h-4" /> : <Layers className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                      </div>
                      <div className="min-w-0">
                        <h3 className="font-bold text-foreground text-xs sm:text-sm truncate">
                          {sub.title}
                          {sub.isCustom && <Badge variant="outline" className="mr-1 text-[8px] sm:text-[9px]">مخصص</Badge>}
                        </h3>
                        <p className="text-[10px] sm:text-xs text-muted-foreground truncate">{subEvidences.length} شاهد مرفق</p>
                      </div>
                    </div>
                    {isExpanded ? <ChevronUp className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" /> : <ChevronDown className="w-4 h-4 sm:w-5 sm:h-5 text-muted-foreground shrink-0" />}
                  </div>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-border overflow-hidden">
                        <div className="p-4 space-y-4">
                          {/* Form Fields */}
                          {(sub.type === 'report' || sub.type === 'both') && sub.formFields && (() => {
                            const formEv = subEvidences.find(e => e.formData !== undefined);
                            if (!formEv) return null;
                            return (
                              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                                    <FileText className="w-4 h-4 text-primary" />نموذج التقرير
                                  </h4>
                                  <Button variant="secondary" size="sm" className="gap-1.5 text-xs"
                                    onClick={() => fillFormWithAI(currentCriterion.id, sub.id, formEv.id, sub.formFields!)}
                                    disabled={aiLoading === `fill_${formEv.id}`}>
                                    {aiLoading === `fill_${formEv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-violet-500" />}
                                    تعبئة بالذكاء الاصطناعي
                                  </Button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {sub.formFields.map((field: FormField) => (
                                    <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-medium text-foreground">
                                          {field.label} {field.required && <span className="text-destructive">*</span>}
                                        </label>
                                        {field.type === 'textarea' && formEv.formData?.[field.id] && (
                                          <button type="button" onClick={() => improveFieldText(currentCriterion.id, formEv.id, field.id, formEv.formData?.[field.id] || '')}
                                            disabled={aiLoading === `improve_${formEv.id}_${field.id}`}
                                            className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1">
                                            {aiLoading === `improve_${formEv.id}_${field.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                                            تحسين
                                          </button>
                                        )}
                                      </div>
                                      {field.type === 'textarea' ? (
                                        <textarea value={formEv.formData?.[field.id] || ''} onChange={(e) => updateFormField(currentCriterion.id, formEv.id, field.id, e.target.value)}
                                          placeholder={field.placeholder} rows={3}
                                          className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
                                      ) : field.type === 'select' ? (
                                        <select value={formEv.formData?.[field.id] || ''} onChange={(e) => updateFormField(currentCriterion.id, formEv.id, field.id, e.target.value)}
                                          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background">
                                          <option value="">اختر...</option>
                                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : (
                                        <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                          value={formEv.formData?.[field.id] || ''} onChange={(e) => updateFormField(currentCriterion.id, formEv.id, field.id, e.target.value)}
                                          placeholder={field.placeholder}
                                          className="w-full px-3 py-2.5 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Evidences List */}
                          {subEvidences.filter(e => {
                            if (e.formData && Object.keys(e.formData).some(k => e.formData![k])) return false;
                            if (e.type === 'text' && !e.text && e.formData) return false;
                            return true;
                          }).map((ev) => renderEvidenceItem(ev, currentCriterion.id))}

                          {/* Add Evidence Buttons */}
                          <div className="flex flex-wrap gap-1.5 sm:gap-2">
                            <Button variant="outline" size="sm" className="gap-1 sm:gap-1.5 border-dashed border-primary/40 text-primary text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                              onClick={() => addEvidence(currentCriterion.id, sub.id, "text")}>
                              <Plus className="w-3 h-3 sm:w-3.5 sm:h-3.5" />شاهد نصي
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 sm:gap-1.5 border-dashed border-blue-400 text-blue-600 text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                              onClick={(e) => { e.preventDefault(); e.stopPropagation(); triggerFileUpload(currentCriterion.id, sub.id); }}>
                              <Upload className="w-3 h-3 sm:w-3.5 sm:h-3.5" /><span className="hidden sm:inline">صورة / ملف / فيديو</span><span className="sm:hidden">ملف</span>
                            </Button>
                            <Button variant="outline" size="sm" className="gap-1 sm:gap-1.5 border-dashed border-purple-400 text-purple-600 text-[10px] sm:text-xs h-7 sm:h-8 px-2 sm:px-3"
                              onClick={() => addEvidence(currentCriterion.id, sub.id, "link")}>
                              <LinkIcon className="w-3 h-3 sm:w-3.5 sm:h-3.5" />رابط
                            </Button>
                          </div>

                          {/* AI Assistant */}
                          <div className="bg-violet-50/50 rounded-lg sm:rounded-xl p-3 sm:p-4 border border-violet-200/50">
                            <h4 className="text-[10px] sm:text-xs font-bold text-violet-700 flex items-center gap-1 sm:gap-1.5 mb-2 sm:mb-3">
                              <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />مساعد الذكاء الاصطناعي
                            </h4>
                            {aiMessages.length > 0 && (
                              <div className="space-y-2 mb-2 sm:mb-3 max-h-32 sm:max-h-40 overflow-y-auto">
                                {aiMessages.map((msg, i) => (
                                  <div key={i} className="bg-white rounded-lg p-2.5 sm:p-3 text-[10px] sm:text-xs text-foreground leading-relaxed border border-violet-100">
                                    {msg}
                                    <button type="button" onClick={() => { const ev = createEmptyEvidence(sub.id); ev.text = msg; setCriteriaData(prev => ({ ...prev, [currentCriterion.id]: { ...prev[currentCriterion.id], evidences: [...prev[currentCriterion.id].evidences, ev] } })); toast.success("تم إضافة النص كشاهد"); }}
                                      className="mt-1.5 text-[9px] sm:text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1">
                                      <Plus className="w-2.5 h-2.5 sm:w-3 sm:h-3" />استخدام كشاهد
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-1.5 sm:gap-2">
                              <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') callAI(currentCriterion.id, sub.id, aiPrompt); }}
                                placeholder="اسأل الذكاء الاصطناعي..."
                                className="flex-1 px-2.5 sm:px-3 py-1.5 sm:py-2 rounded-lg border border-violet-200 text-xs sm:text-sm bg-white focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                              <Button size="sm" className="bg-violet-600 hover:bg-violet-700 gap-1.5 h-8 sm:h-9 px-2.5 sm:px-3"
                                onClick={() => callAI(currentCriterion.id, sub.id, aiPrompt)}
                                disabled={aiLoading === `${currentCriterion.id}_${sub.id}`}>
                                {aiLoading === `${currentCriterion.id}_${sub.id}` ? <Loader2 className="w-3 h-3 sm:w-3.5 sm:h-3.5 animate-spin" /> : <Sparkles className="w-3 h-3 sm:w-3.5 sm:h-3.5" />}
                              </Button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </Card>
              );
            })}
          </div>

          {/* إضافة قسم فرعي مخصص */}
          {showAddSub === currentCriterion.id ? (
            <Card className="mt-3 border-violet-200">
              <CardContent className="p-4 flex gap-2">
                <input type="text" value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)}
                  placeholder="اسم القسم الفرعي الجديد"
                  className="flex-1 px-3 py-2 rounded-lg border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20" />
                <Button size="sm" onClick={() => addCustomSubEvidence(currentCriterion.id)} disabled={!newSubTitle.trim()}>إضافة</Button>
                <Button size="sm" variant="ghost" onClick={() => setShowAddSub(null)}>إلغاء</Button>
              </CardContent>
            </Card>
          ) : (
            <Button variant="outline" size="sm" className="mt-3 gap-1.5 border-dashed" onClick={() => setShowAddSub(currentCriterion.id)}>
              <Plus className="w-3.5 h-3.5" />إضافة قسم فرعي مخصص
            </Button>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-4 sm:mt-6 gap-2">
            {currentCriterionIndex > 0 ? (
              <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => setCurrentCriterionIndex(i => i - 1)}>
                <ArrowRight className="w-3.5 h-3.5 sm:w-4 sm:h-4 ml-0.5 sm:ml-1" /><span className="hidden sm:inline">البند السابق</span><span className="sm:hidden">السابق</span>
              </Button>
            ) : <div />}
            {currentCriterionIndex < allCriteria.length - 1 ? (
              <Button variant="outline" size="sm" className="text-xs sm:text-sm h-8 sm:h-9" onClick={() => setCurrentCriterionIndex(i => i + 1)}>
                <span className="hidden sm:inline">البند التالي</span><span className="sm:hidden">التالي</span><ArrowLeft className="w-3.5 h-3.5 sm:w-4 sm:h-4 mr-0.5 sm:mr-1" />
              </Button>
            ) : (
              <Button size="sm" className="gap-1 sm:gap-1.5 text-xs sm:text-sm h-8 sm:h-9" onClick={() => setStep('final-review')}>
                <BarChart3 className="w-3.5 h-3.5 sm:w-4 sm:h-4" />التقييم النهائي
              </Button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ======================================================================
  // ===== الخطوة 4: التقييم النهائي =====
  // ======================================================================
  if (step === 'final-review') {
    const grade = getGrade(percentage);
    return (
      <div className="min-h-screen bg-background p-4 md:p-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <Button variant="outline" size="sm" onClick={() => setStep('dashboard')}>
              <ArrowRight className="w-4 h-4 ml-1" />العودة للبنود
            </Button>
            <div className="flex gap-2">
              <Button variant="outline" size="sm" onClick={saveReport} disabled={isSaving} className="gap-1.5">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {isSaving ? "جاري الحفظ..." : "حفظ"}
              </Button>
              {isAuthenticated && portfolio.id && (
                <Button variant="outline" size="sm" onClick={portfolio.submitForReview} className="gap-1.5 text-emerald-600 border-emerald-200 hover:bg-emerald-50">
                  <CheckCircle className="w-4 h-4" />تقديم للمراجعة
                </Button>
              )}
              <Button size="sm" onClick={() => setStep('preview')} className="gap-1.5">
                <Eye className="w-4 h-4" />معاينة وتصدير
              </Button>
            </div>
          </div>

          {/* ملخص التقييم */}
          <Card className="mb-5">
            <CardContent className="p-6 text-center">
              <h1 className="text-2xl font-black text-foreground mb-4" style={{ fontFamily: "var(--font-heading)" }}>ملخص التقييم النهائي</h1>
              <div className="flex items-center justify-center gap-8">
                <div>
                  <div className="text-5xl font-black" style={{ color: grade.color }}>{percentage}%</div>
                  <div className="text-lg font-bold mt-1" style={{ color: grade.color }}>{grade.label}</div>
                </div>
                <div className="text-right space-y-1">
                  <p className="text-sm text-muted-foreground">المجموع: <strong className="text-foreground">{totalScore}</strong> من <strong className="text-foreground">{maxScore}</strong></p>
                  <p className="text-sm text-muted-foreground">الوظيفة: <strong className="text-foreground">{selectedJob?.title}</strong></p>
                  <p className="text-sm text-muted-foreground">الاسم: <strong className="text-foreground">{personalInfo.name || '—'}</strong></p>
                  {indicatorsCoverage && (
                    <p className="text-sm text-muted-foreground">المؤشرات: <strong className="text-foreground">{indicatorsCoverage.covered}/{indicatorsCoverage.total}</strong></p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* جدول البنود */}
          <Card className="mb-5 overflow-hidden">
            <table className="w-full">
              <thead className="bg-muted">
                <tr>
                  <th className="text-right text-xs font-bold text-muted-foreground p-3">م</th>
                  <th className="text-right text-xs font-bold text-muted-foreground p-3">البند</th>
                  <th className="text-center text-xs font-bold text-muted-foreground p-3">الدرجة</th>
                  <th className="text-center text-xs font-bold text-muted-foreground p-3">الشواهد</th>
                  <th className="text-center text-xs font-bold text-muted-foreground p-3">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {allCriteria.map((c, i) => {
                  const d = criteriaData[c.id];
                  const evCount = d?.evidences.length || 0;
                  const status = (d?.score || 0) >= 4 && evCount > 0 ? "complete" : evCount > 0 || (d?.score || 0) > 0 ? "partial" : "missing";
                  return (
                    <tr key={c.id} className="border-t border-border hover:bg-muted/30 cursor-pointer transition-colors"
                      onClick={() => { setCurrentCriterionIndex(i); setStep('criterion-detail'); }}>
                      <td className="p-3 text-sm text-muted-foreground">{i + 1}</td>
                      <td className="p-3 text-sm font-medium text-foreground">{c.title}</td>
                      <td className="p-3 text-center">
                        <Badge variant={((d?.score || 0) >= 4) ? "default" : ((d?.score || 0) >= 3) ? "secondary" : "outline"}>
                          {d?.score || 0}/{c.maxScore}
                        </Badge>
                      </td>
                      <td className="p-3 text-center text-sm text-muted-foreground">{evCount}</td>
                      <td className="p-3 text-center">
                        {status === "complete" && <CheckCircle className="w-4 h-4 text-emerald-500 mx-auto" />}
                        {status === "partial" && <AlertTriangle className="w-4 h-4 text-amber-500 mx-auto" />}
                        {status === "missing" && <XCircle className="w-4 h-4 text-red-400 mx-auto" />}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Card>

          {/* اختيار الثيم */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">اختر ثيم التصدير</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap gap-2">
                {THEMES.map((t) => (
                  <Button key={t.id} variant={selectedTheme.id === t.id ? "default" : "outline"} size="sm"
                    onClick={() => setSelectedTheme(t)}>{t.name}</Button>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  // ======================================================================
  // ===== الخطوة 5: المعاينة والتصدير =====
  // ======================================================================
  if (step === 'preview') {
    const grade = getGrade(percentage);
    const theme = selectedTheme;
    return (
      <div className="min-h-screen bg-muted p-4" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4 bg-background rounded-xl p-4 shadow-sm border border-border sticky top-2 z-10">
            <Button variant="outline" size="sm" onClick={() => setStep('final-review')}>
              <ArrowRight className="w-4 h-4 ml-1" />العودة
            </Button>
            <div className="flex gap-2">
              <Button size="sm" onClick={handleExportPDF} disabled={isExporting} className="gap-1.5">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'جاري التصدير...' : 'تحميل PDF'}
              </Button>
              <Button size="sm" variant="outline" onClick={() => printElement('preview-content')} className="gap-1.5">
                <Printer className="w-4 h-4" />طباعة
              </Button>
            </div>
          </div>

          <div id="preview-content" className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
            {/* Header */}
            <div style={{ background: theme.headerBg, color: theme.headerText, padding: '2rem', textAlign: 'center' }}>
              <p className="text-sm opacity-80 mb-1" style={{ whiteSpace: 'pre-line' }}>{personalInfo.department}</p>
              <h1 className="text-2xl font-black mb-1">شواهد الأداء الوظيفي</h1>
              <p className="text-lg font-bold">{selectedJob?.title}</p>
              <p className="text-sm opacity-80 mt-1">{personalInfo.year} - {personalInfo.semester}</p>
            </div>

            {/* Personal Info */}
            <div className="p-6 border-b" style={{ borderColor: theme.borderColor }}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">الاسم:</span> <strong>{personalInfo.name || '—'}</strong></div>
                <div><span className="text-gray-500">المدرسة:</span> <strong>{personalInfo.school || '—'}</strong></div>
                <div><span className="text-gray-500">المقيّم:</span> <strong>{personalInfo.evaluator || '—'}</strong></div>
                <div><span className="text-gray-500">التاريخ:</span> <strong>{personalInfo.date || '—'}</strong></div>
              </div>
            </div>

            {/* Criteria Table */}
            <div className="p-6">
              <table className="w-full border-collapse text-sm" style={{ borderColor: theme.borderColor }}>
                <thead>
                  <tr style={{ background: theme.accent, color: '#fff' }}>
                    <th className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>م</th>
                    <th className="p-2 border text-right" style={{ borderColor: theme.borderColor }}>البند</th>
                    <th className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>الدرجة</th>
                  </tr>
                </thead>
                <tbody>
                  {allCriteria.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>{i + 1}</td>
                      <td className="p-2 border" style={{ borderColor: theme.borderColor }}>{c.title}</td>
                      <td className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{criteriaData[c.id]?.score || 0}/{c.maxScore}</td>
                    </tr>
                  ))}
                  <tr style={{ background: theme.accent, color: '#fff' }}>
                    <td colSpan={2} className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>المجموع</td>
                    <td className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{totalScore}/{maxScore}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center mt-6 p-4 rounded-xl" style={{ background: `${grade.color}15` }}>
                <p className="text-sm text-gray-600">التقدير النهائي</p>
                <p className="text-3xl font-black" style={{ color: grade.color }}>{percentage}% - {grade.label}</p>
              </div>

              {/* Evidences */}
              {allCriteria.map((c, i) => {
                const d = criteriaData[c.id];
                if (!d || d.evidences.length === 0) return null;
                return (
                  <div key={c.id} className="mt-6" style={{ pageBreakInside: 'avoid' }}>
                    <h3 className="font-bold text-sm mb-2" style={{ color: theme.accent }}>{i + 1}. {c.title}</h3>
                    <div className="space-y-2">
                      {d.evidences.map((ev) => (
                        <div key={ev.id} className="p-3 rounded-lg border" style={{ borderColor: theme.borderColor }}>
                          {ev.type === 'text' && ev.text && <p className="text-sm">{ev.text}</p>}
                          {ev.type === 'link' && ev.link && (
                            <div className="flex items-center gap-3">
                              <img src={generateQRDataURL(ev.link)} alt="QR" className="w-16 h-16" />
                              <span className="text-xs text-gray-500">{ev.link}</span>
                            </div>
                          )}
                          {ev.type === 'image' && ev.fileData && (
                            ev.displayAs === 'image'
                              ? <img src={ev.fileData} alt="" className="max-h-40 rounded" />
                              : <div className="flex items-center gap-3">
                                  <img src={generateQRDataURL(ev.fileData.substring(0, 200))} alt="QR" className="w-16 h-16" />
                                  <span className="text-xs text-gray-500">{ev.fileName}</span>
                                </div>
                          )}
                          {(ev.type === 'video' || ev.type === 'file') && ev.fileData && (
                            <div className="flex items-center gap-3">
                              <img src={generateQRDataURL(ev.fileName || 'file')} alt="QR" className="w-16 h-16" />
                              <span className="text-xs text-gray-500">{ev.fileName}</span>
                            </div>
                          )}
                          {ev.formData && Object.entries(ev.formData).some(([, v]) => v) && (
                            <div className="text-sm space-y-1">
                              {Object.entries(ev.formData).filter(([, v]) => v).map(([key, val]) => (
                                <p key={key}><span className="text-gray-500">{key}:</span> {val}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Signatures */}
              <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
                <div>
                  <p className="text-gray-500 mb-8">توقيع المقيّم</p>
                  <div className="border-t border-gray-300 pt-2">{personalInfo.evaluator || '____________'}</div>
                  <p className="text-xs text-gray-400 mt-1">{personalInfo.evaluatorRole}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-8">توقيع الموظف</p>
                  <div className="border-t border-gray-300 pt-2">{personalInfo.name || '____________'}</div>
                  <p className="text-xs text-gray-400 mt-1">{selectedJob?.title}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
