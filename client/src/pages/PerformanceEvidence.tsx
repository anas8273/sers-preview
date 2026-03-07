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
import { useOfflineSync } from "@/hooks/useOfflineSync";
import { saveFileToIDB, getFileFromIDB, deleteFileFromIDB, cleanOldFiles } from "@/hooks/useIndexedDB";
import { getLoginUrl } from "@/const";
import { generateQRDataURL } from "@/lib/qr-utils";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { STANDARDS, type Standard, type Indicator } from "@/lib/standards-data";
import {
  PRINCIPAL_STANDARDS, VICE_PRINCIPAL_STANDARDS, COUNSELOR_STANDARDS,
  HEALTH_COUNSELOR_STANDARDS, ACTIVITY_LEADER_STANDARDS, LAB_TECHNICIAN_STANDARDS,
  KINDERGARTEN_STANDARDS, SUPERVISOR_STANDARDS, getStandardsForJob,
} from "@/lib/all-jobs-standards";
import {
  ArrowLeft, ArrowRight, Sparkles, Upload, Plus, Trash2, Save,
  Eye, Download, Printer, FileText, Image, Video, QrCode, Type,
  LinkIcon, Loader2, ChevronDown, ChevronUp, Layers, BarChart3,
  CheckCircle, AlertTriangle, XCircle, TrendingUp, Wand2, X,
  GraduationCap, Building2, Users, Heart, Search as SearchIcon,
  BookOpen, Baby, Accessibility, Briefcase, ClipboardList,
  ClipboardCheck, Handshake, UserCheck, Target,
  NotebookPen, Monitor, School, Award, PieChart, ListChecks,
  GripVertical, Move, FlaskConical, Activity, Megaphone
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
type EvidencePriority = "essential" | "supporting" | "additional";
interface FormField { id: string; label: string; type: "text" | "textarea" | "date" | "number" | "select"; placeholder?: string; required?: boolean; options?: string[]; }
interface SubEvidence { id: string; title: string; description: string; type: "report" | "upload" | "both"; isCustom?: boolean; formFields?: FormField[]; }
interface Criterion { id: string; title: string; maxScore: number; description: string; subEvidences: SubEvidence[]; }
interface EvidenceItem {
  id: string; subEvidenceId: string; type: EvidenceType; text: string; link: string;
  fileData: string | null; fileName: string; displayAs: "image" | "qr"; formData?: Record<string, string>;
  comment?: string; priority?: EvidencePriority; keywords?: string[];
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
    description: `${std.items.length} بند · الوزن ${std.weight}%`,
    subEvidences: std.items.map(item => ({
      id: item.id,
      title: item.text,
      description: item.suggestedEvidence.join(" · "),
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

// ===== دالة عامة لبناء بنود أي وظيفة من النظام المعياري (3 مستويات) =====
function buildStandardsCriteria(standards: Standard[]): Criterion[] {
  return standards.map(std => ({
    id: std.id,
    title: std.title,
    maxScore: 5,
    description: `${std.items.length} بند \u00B7 الوزن ${std.weight}%`,
    subEvidences: std.items.flatMap(item => [
      {
        id: item.id,
        title: item.text,
        description: item.suggestedEvidence.join(" \u00B7 "),
        type: "both" as const,
        formFields: [
          { id: "evidence_desc", label: "\u0648\u0635\u0641 \u0627\u0644\u0634\u0627\u0647\u062F", type: "textarea" as const, placeholder: "\u0627\u0643\u062A\u0628 \u0648\u0635\u0641\u0627\u064B \u0644\u0644\u0634\u0627\u0647\u062F \u0627\u0644\u0645\u0642\u062F\u0645..." },
          { id: "date", label: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", type: "date" as const },
          { id: "notes", label: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", type: "textarea" as const, placeholder: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629..." },
        ],
      },
      ...(item.subItems || []).map(sub => ({
        id: sub.id,
        title: sub.title,
        description: sub.suggestedEvidence.join(" \u00B7 "),
        type: "both" as const,
        formFields: [
          { id: "evidence_desc", label: "\u0648\u0635\u0641 \u0627\u0644\u0634\u0627\u0647\u062F", type: "textarea" as const, placeholder: "\u0627\u0643\u062A\u0628 \u0648\u0635\u0641\u0627\u064B \u0644\u0644\u0634\u0627\u0647\u062F \u0627\u0644\u0645\u0642\u062F\u0645..." },
          { id: "date", label: "\u0627\u0644\u062A\u0627\u0631\u064A\u062E", type: "date" as const },
          { id: "notes", label: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A", type: "textarea" as const, placeholder: "\u0645\u0644\u0627\u062D\u0638\u0627\u062A \u0625\u0636\u0627\u0641\u064A\u0629..." },
        ],
      })),
    ]),
  }));
}

// ===== بنود الوظائف (نظام معياري رسمي - 3 مستويات) =====
const PRINCIPAL_CRITERIA = buildStandardsCriteria(PRINCIPAL_STANDARDS);
const VICE_PRINCIPAL_CRITERIA = buildStandardsCriteria(VICE_PRINCIPAL_STANDARDS);
const COUNSELOR_CRITERIA = buildStandardsCriteria(COUNSELOR_STANDARDS);
const HEALTH_COUNSELOR_CRITERIA = buildStandardsCriteria(HEALTH_COUNSELOR_STANDARDS);
const ACTIVITY_LEADER_CRITERIA = buildStandardsCriteria(ACTIVITY_LEADER_STANDARDS);
const LAB_TECHNICIAN_CRITERIA = buildStandardsCriteria(LAB_TECHNICIAN_STANDARDS);
const KINDERGARTEN_CRITERIA = buildStandardsCriteria(KINDERGARTEN_STANDARDS);
const SUPERVISOR_CRITERIA = buildStandardsCriteria(SUPERVISOR_STANDARDS);

// ===== بنود الوظائف التي ليس لها معايير رسمية (تبقى بسيطة) =====
const LIBRARIAN_CRITERIA = makeSimpleCriteria("l", [
  { id: "1", title: "تنظيم مصادر التعلم", desc: "تنظيم وفهرسة المصادر", subTitle: "سجل المصادر" },
  { id: "2", title: "خدمة المستفيدين", desc: "تقديم خدمات متميزة", subTitle: "سجل الإعارة" },
  { id: "3", title: "التقنيات التعليمية", desc: "توظيف التقنيات", subTitle: "تقرير التقنيات" },
  { id: "4", title: "البرامج والأنشطة", desc: "تنفيذ البرامج", subTitle: "خطة البرامج" },
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
  { id: "teacher", title: "معلم / معلمة", icon: GraduationCap, emoji: "👨‍🏫", criteria: TEACHER_CRITERIA, hasStandards: true, color: "#059669" },
  { id: "principal", title: "مدير / مديرة مدرسة", icon: Building2, emoji: "👔", criteria: PRINCIPAL_CRITERIA, hasStandards: true, color: "#2563EB" },
  { id: "vice_principal", title: "وكيل / وكيلة مدرسة", icon: ClipboardList, emoji: "📋", criteria: VICE_PRINCIPAL_CRITERIA, hasStandards: true, color: "#7C3AED" },
  { id: "counselor", title: "موجه/ة طلابي/ة", icon: Users, emoji: "🤝", criteria: COUNSELOR_CRITERIA, hasStandards: true, color: "#0891B2" },
  { id: "health_counselor", title: "معلم/ة مسند له توجيه صحي", icon: Heart, emoji: "🏥", criteria: HEALTH_COUNSELOR_CRITERIA, hasStandards: true, color: "#DC2626" },
  { id: "activity_leader", title: "معلم/ة مسند له نشاط (رائد/ة نشاط)", icon: Megaphone, emoji: "🏆", criteria: ACTIVITY_LEADER_CRITERIA, hasStandards: true, color: "#F59E0B" },
  { id: "lab_technician", title: "محضر/ة مختبر", icon: FlaskConical, emoji: "🧪", criteria: LAB_TECHNICIAN_CRITERIA, hasStandards: true, color: "#8B5CF6" },
  { id: "supervisor", title: "مشرف/ة تربوي/ة (التشكيلات الإشرافية)", icon: SearchIcon, emoji: "🔍", criteria: SUPERVISOR_CRITERIA, hasStandards: true, color: "#CA8A04" },
  { id: "kindergarten", title: "معلمة رياض أطفال", icon: Baby, emoji: "🧒", criteria: KINDERGARTEN_CRITERIA, hasStandards: true, color: "#EC4899" },
  { id: "librarian", title: "أمين/ة مصادر تعلم", icon: BookOpen, emoji: "📚", criteria: LIBRARIAN_CRITERIA, hasStandards: false, color: "#9333EA" },
  { id: "special_ed", title: "معلم/ة تربية خاصة", icon: Accessibility, emoji: "♿", criteria: SPECIAL_ED_CRITERIA, hasStandards: false, color: "#F97316" },
  { id: "admin_assistant", title: "مساعد/ة إداري/ة", icon: Briefcase, emoji: "🗂️", criteria: ADMIN_ASSISTANT_CRITERIA, hasStandards: false, color: "#6B7280" },
];

// ===== الثيمات =====
const THEMES = [
  { id: "official", name: "الهوية الرسمية", headerBg: "#1B5E20", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
  { id: "official-gradient", name: "تدرج رسمي", headerBg: "linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20" },
  { id: "blue", name: "أزرق كلاسيكي", headerBg: "#0D47A1", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1" },
  { id: "purple", name: "بنفسجي أنيق", headerBg: "#4A148C", headerText: "#fff", accent: "#6A1B9A", borderColor: "#4A148C" },
  { id: "simple", name: "بسيط", headerBg: "#f8f9fa", headerText: "#1a1a1a", accent: "#059669", borderColor: "#e5e7eb" },
];

// ===== إعدادات الأولوية =====
const PRIORITY_CONFIG: Record<EvidencePriority, { label: string; color: string; bgColor: string; borderColor: string; icon: string }> = {
  essential: { label: "أساسي", color: "#059669", bgColor: "bg-emerald-50 dark:bg-emerald-950/30", borderColor: "border-emerald-300", icon: "★" },
  supporting: { label: "داعم", color: "#2563EB", bgColor: "bg-blue-50 dark:bg-blue-950/30", borderColor: "border-blue-300", icon: "◆" },
  additional: { label: "إضافي", color: "#9333EA", bgColor: "bg-violet-50 dark:bg-violet-950/30", borderColor: "border-violet-300", icon: "○" },
};

function createEmptyEvidence(subEvidenceId: string = ""): EvidenceItem {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    subEvidenceId, type: "text", text: "", link: "",
    fileData: null, fileName: "", displayAs: "image", formData: {},
    priority: "essential", keywords: [],
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
    // مراجع idb:// تُحفظ كما هي (حجمها صغير جداً)
    const cleanCriteria: Record<string, any> = {};
    for (const [key, val] of Object.entries(data.criteriaData)) {
      cleanCriteria[key] = {
        ...val,
        evidences: val.evidences.map(ev => {
          // إذا كان الملف محفوظ في IndexedDB، نحفظ المرجع فقط
          const isIdbRef = ev.fileData?.startsWith('idb://');
          return {
            ...ev,
            fileData: isIdbRef ? ev.fileData : (ev.fileData && ev.fileData.length < 100000 ? ev.fileData : null),
            _hadFile: !!ev.fileData,
          };
        }),
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
  const { isOnline, isSyncing, pendingCount, saveOfflineData, getOfflineData } = useOfflineSync();
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

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPriority, setFilterPriority] = useState<EvidencePriority | "all">("all");

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

  // ===== تنظيف ملفات IndexedDB القديمة =====
  useEffect(() => {
    cleanOldFiles().catch(() => {});
  }, []);

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

  // ===== حفظ الـ state تلقائياً عند كل تغيير (مع تأجيل أثناء الرفع) =====
  useEffect(() => {
    if (!selectedJob || step === "select") return;
    // لا نحفظ أثناء عملية الرفع لتجنب crash من حجم base64 الكبير
    if (isUploadingRef.current) return;
    // تأخير الحفظ لتجنب الحفظ المتكرر السريع
    const timer = setTimeout(() => {
      if (!isUploadingRef.current) {
        saveStateToStorage({
          step, jobId: selectedJob.id, themeId: selectedTheme.id,
          criteriaData, personalInfo, customCriteria,
          currentCriterionIndex, activeTab, expandedSubEvidence,
        });
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [step, selectedJob, selectedTheme, criteriaData, personalInfo, customCriteria, currentCriterionIndex, activeTab, expandedSubEvidence]);

  // ===== حفظ تلقائي عند إغلاق المتصفح أو الانتقال =====
  useEffect(() => {
    const handleBeforeUnload = () => {
      if (!selectedJob || step === "select") return;
      try {
        saveStateToStorage({
          step, jobId: selectedJob.id, themeId: selectedTheme.id,
          criteriaData, personalInfo, customCriteria,
          currentCriterionIndex, activeTab, expandedSubEvidence,
        });
      } catch { /* ignore - localStorage might be full */ }
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    // حفظ عند visibilitychange (عندما ينتقل المستخدم لتطبيق آخر على الجوال)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden" && selectedJob && step !== "select") {
        try {
          saveStateToStorage({
            step, jobId: selectedJob.id, themeId: selectedTheme.id,
            criteriaData, personalInfo, customCriteria,
            currentCriterionIndex, activeTab, expandedSubEvidence,
          });
        } catch { /* ignore */ }
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [selectedJob, step, selectedTheme, criteriaData, personalInfo, customCriteria, currentCriterionIndex, activeTab, expandedSubEvidence]);

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
    if (!selectedJob?.hasStandards) return null;
    const jobStds = selectedJob.id === "teacher" ? STANDARDS : getStandardsForJob(selectedJob.id);
    let totalIndicators = 0;
    let coveredIndicators = 0;
    jobStds.forEach(std => {
      std.items.forEach(item => {
        totalIndicators++;
        const data = criteriaData[std.id];
        if (data && data.evidences.some(e => e.subEvidenceId === item.id)) {
          coveredIndicators++;
        }
        // حساب البنود الفرعية أيضاً
        (item.subItems || []).forEach(sub => {
          totalIndicators++;
          if (data && data.evidences.some(e => e.subEvidenceId === sub.id)) {
            coveredIndicators++;
          }
        });
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

  // ===== سحب وإفلات الشواهد بين البنود =====
  const [draggedEvidence, setDraggedEvidence] = useState<{ evidence: EvidenceItem; fromCriterionId: string; fromSubId: string } | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<{ criterionId: string; subId: string } | null>(null);
  const [showMoveDialog, setShowMoveDialog] = useState<{ evidence: EvidenceItem; fromCriterionId: string } | null>(null);
  const [showCoverageReport, setShowCoverageReport] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);

  const handleDragStart = useCallback((ev: EvidenceItem, criterionId: string, subId: string) => {
    setDraggedEvidence({ evidence: ev, fromCriterionId: criterionId, fromSubId: subId });
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent, criterionId: string, subId: string) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDragOverTarget({ criterionId, subId });
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverTarget(null);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent, toCriterionId: string, toSubId: string) => {
    e.preventDefault();
    setDragOverTarget(null);
    if (!draggedEvidence) return;
    const { evidence, fromCriterionId } = draggedEvidence;
    if (fromCriterionId === toCriterionId && evidence.subEvidenceId === toSubId) {
      setDraggedEvidence(null);
      return;
    }
    // نقل الشاهد: حذف من المصدر وإضافة للهدف
    const movedEvidence = { ...evidence, subEvidenceId: toSubId };
    setCriteriaData(prev => {
      const updated = { ...prev };
      // حذف من المصدر
      updated[fromCriterionId] = {
        ...updated[fromCriterionId],
        evidences: updated[fromCriterionId].evidences.filter(e => e.id !== evidence.id),
      };
      // إضافة للهدف
      updated[toCriterionId] = {
        ...updated[toCriterionId],
        evidences: [...updated[toCriterionId].evidences, movedEvidence],
      };
      return updated;
    });
    const toCrit = allCriteria.find(c => c.id === toCriterionId);
    toast.success("تم نقل الشاهد بنجاح", {
      description: `تم النقل إلى: ${toCrit?.title || 'بند آخر'}`,
      duration: 3000,
    });
    setDraggedEvidence(null);
  }, [draggedEvidence, allCriteria]);

  const handleDragEnd = useCallback(() => {
    setDraggedEvidence(null);
    setDragOverTarget(null);
  }, []);

  const moveEvidenceToCriterion = useCallback((evidence: EvidenceItem, fromCriterionId: string, toCriterionId: string, toSubId: string) => {
    if (fromCriterionId === toCriterionId && evidence.subEvidenceId === toSubId) return;
    const movedEvidence = { ...evidence, subEvidenceId: toSubId };
    setCriteriaData(prev => {
      const updated = { ...prev };
      updated[fromCriterionId] = {
        ...updated[fromCriterionId],
        evidences: updated[fromCriterionId].evidences.filter(e => e.id !== evidence.id),
      };
      updated[toCriterionId] = {
        ...updated[toCriterionId],
        evidences: [...updated[toCriterionId].evidences, movedEvidence],
      };
      return updated;
    });
    const toCrit = allCriteria.find(c => c.id === toCriterionId);
    toast.success("تم نقل الشاهد بنجاح", {
      description: `تم النقل إلى: ${toCrit?.title || 'بند آخر'}`,
      duration: 3000,
    });
    setShowMoveDialog(null);
  }, [allCriteria]);

  // ===== رفع ذكي مع تصنيف AI تلقائي =====
  const [isSmartUploading, setIsSmartUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{ stage: string; percent: number } | null>(null);
  const isUploadingRef = useRef(false); // flag لمنع حفظ localStorage أثناء الرفع

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

  // ===== ضغط الصورة للحفظ في state (جودة متوسطة لتقليل استهلاك الذاكرة) =====
  const compressImageForStorage = useCallback((base64: string, maxWidth = 1200, quality = 0.7): Promise<string> => {
    return new Promise((resolve) => {
      const img = document.createElement('img');
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          let w = img.width, h = img.height;
          if (w > maxWidth) { h = (maxWidth / w) * h; w = maxWidth; }
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, w, h);
          const compressed = canvas.toDataURL('image/jpeg', quality);
          resolve(compressed);
        } catch {
          resolve(base64); // fallback to original
        }
      };
      img.onerror = () => resolve(base64);
      img.src = base64;
    });
  }, []);

  // ===== دالة مساعدة لإضافة شاهد لبند معين =====
  const addEvidenceToCriterion = useCallback((criterionId: string, newEv: EvidenceItem) => {
    setCriteriaData((prev) => {
      const existing = prev[criterionId];
      if (!existing) return prev;
      return {
        ...prev,
        [criterionId]: { ...existing, evidences: [...existing.evidences, newEv] },
      };
    });
  }, []);

  // ===== معالجة ملف واحد للتصنيف الذكي =====
  const processSmartFile = useCallback(async (file: File, fileIndex: number, totalFiles: number): Promise<{ success: boolean; criterion?: string; indicator?: string }> => {
    const isImage = file.type.startsWith("image/");
    const isVideo = file.type.startsWith("video/");
    const batchPrefix = totalFiles > 1 ? `[ملف ${fileIndex + 1}/${totalFiles}] ` : "";

    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const rawBase64 = reader.result as string;
          let storageBase64 = rawBase64;
          let aiImageUrl: string | undefined;
          
          if (isImage) {
            storageBase64 = await compressImageForStorage(rawBase64, 1200, 0.7);
            aiImageUrl = await compressImage(rawBase64, 800, 0.5);
          }

          let targetCriterionId: string | null = null;
          let targetSubId: string = "";
          let contentDesc: string = file.name;
          let classificationSuccess = false;
          let criterionTitle = "";
          let indicatorText = "";
          
          try {
            const result = await classifyMutation.mutateAsync({
              fileName: file.name,
              fileType: file.type,
              description: file.name.replace(/\.[^/.]+$/, "").replace(/[-_]/g, " "),
              fileUrl: aiImageUrl,
            });

            if (result.success && result.classification) {
              const cls = result.classification;
              const targetCriterion = allCriteria.find(c =>
                c.id === cls.standardId || c.title.includes(cls.standardName) || cls.standardName.includes(c.title)
              );
              if (targetCriterion && criteriaData[targetCriterion.id]) {
                const subs = [...targetCriterion.subEvidences, ...(criteriaData[targetCriterion.id]?.customSubEvidences || [])];
                const targetSub = (cls.indicatorIndex > 0 && subs[cls.indicatorIndex - 1]) ? subs[cls.indicatorIndex - 1] : subs[0];
                targetCriterionId = targetCriterion.id;
                targetSubId = targetSub?.id || "";
                contentDesc = cls.contentDescription || file.name;
                classificationSuccess = true;
                criterionTitle = targetCriterion.title;
                indicatorText = cls.indicatorText;
              }
            }
          } catch (aiErr) {
            console.error("AI classification error:", aiErr);
          }
          
          if (!classificationSuccess) {
            const firstCriterion = allCriteria[0];
            if (firstCriterion) {
              targetCriterionId = firstCriterion.id;
              targetSubId = firstCriterion.subEvidences[0]?.id || "";
              criterionTitle = firstCriterion.title;
            }
          }
          
          if (targetCriterionId) {
            const evId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const newEv = createEmptyEvidence(targetSubId);
            newEv.id = evId;
            newEv.type = isImage ? "image" : isVideo ? "video" : "file";
            newEv.fileName = file.name;
            newEv.text = contentDesc;
            newEv.displayAs = isImage ? "image" : "qr";
            
            try {
              await saveFileToIDB({
                id: evId,
                data: storageBase64,
                fileName: file.name,
                fileType: file.type,
                timestamp: Date.now(),
              });
              if (isImage && storageBase64.length < 200000) {
                newEv.fileData = storageBase64;
              } else {
                newEv.fileData = `idb://${evId}`;
              }
            } catch {
              newEv.fileData = storageBase64;
            }
            
            addEvidenceToCriterion(targetCriterionId, newEv);
            resolve({ success: classificationSuccess, criterion: criterionTitle, indicator: indicatorText });
          } else {
            resolve({ success: false });
          }
        } catch (err) {
          console.error("Smart upload error:", err);
          resolve({ success: false });
        }
      };
      reader.onerror = () => resolve({ success: false });
      reader.readAsDataURL(file);
    });
  }, [allCriteria, criteriaData, classifyMutation, compressImage, compressImageForStorage, addEvidenceToCriterion]);

  const handleSmartUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.target.files;
    if (!files || files.length === 0) {
      return;
    }
    
    // مسح قيمة input فوراً
    const fileList = Array.from(files);
    e.target.value = "";
    
    // التحقق من حجم الملفات
    const oversized = fileList.filter(f => f.size > 16 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} ملف تجاوز الحد الأقصى (16MB)`, { description: oversized.map(f => f.name).join(', ') });
    }
    const validFiles = fileList.filter(f => f.size <= 16 * 1024 * 1024);
    if (validFiles.length === 0) return;
    
    // تفعيل flag منع الحفظ أثناء الرفع
    isUploadingRef.current = true;
    setIsSmartUploading(true);
    
    // إزالة pending upload flag
    try { localStorage.removeItem(STORAGE_PENDING_UPLOAD); } catch {}
    
    const totalFiles = validFiles.length;
    const results: { success: boolean; criterion?: string; indicator?: string; fileName: string }[] = [];
    
    for (let i = 0; i < totalFiles; i++) {
      const currentFile = validFiles[i];
      setUploadProgress({
        stage: totalFiles > 1 
          ? `جاري معالجة الملف ${i + 1} من ${totalFiles}: ${currentFile.name}`
          : `جاري معالجة: ${currentFile.name}`,
        percent: Math.round(10 + (80 * i / totalFiles)),
      });
      
      const result = await processSmartFile(currentFile, i, totalFiles);
      results.push({ ...result, fileName: currentFile.name });
    }
    
    // عرض ملخص النتائج
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    if (totalFiles === 1) {
      const r = results[0];
      if (r.success) {
        toast.success(`تم تصنيف الشاهد تلقائياً`, {
          description: `البند: ${r.criterion}${r.indicator ? `\nالمؤشر: ${r.indicator}` : ''}`,
          duration: 6000,
        });
      } else {
        toast.warning("لم يتمكن النظام من تصنيف الشاهد تلقائياً", {
          description: "تم إضافته للبند الأول. يمكنك نقله يدوياً.",
          duration: 5000,
        });
      }
    } else {
      // ملخص الدفعة
      const summaryLines = results.map(r => 
        `${r.success ? '✅' : '⚠️'} ${r.fileName} → ${r.criterion || 'البند الأول'}`
      ).join('\n');
      
      if (successCount === totalFiles) {
        toast.success(`تم تصنيف ${totalFiles} شواهد بنجاح!`, {
          description: summaryLines,
          duration: 8000,
        });
      } else if (successCount > 0) {
        toast.info(`تم تصنيف ${successCount} من ${totalFiles} شواهد`, {
          description: summaryLines,
          duration: 8000,
        });
      } else {
        toast.warning(`تم إضافة ${totalFiles} شواهد للبند الأول`, {
          description: "لم يتمكن النظام من تصنيفها تلقائياً. يمكنك نقلها يدوياً.",
          duration: 6000,
        });
      }
    }
    
    setUploadProgress({ stage: "اكتمل!", percent: 100 });
    setTimeout(() => {
      setUploadProgress(null);
      setIsSmartUploading(false);
      isUploadingRef.current = false;
    }, 1000);
  }, [processSmartFile]);

  // ===== رفع ملف عادي (بدون تصنيف ذكي) - يدعم رفع متعدد =====
  const handleFileUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    e.stopPropagation();
    const files = e.target.files;
    if (!files || files.length === 0 || !activeUploadRef.current) return;
    
    // مسح قيمة input فوراً
    const fileList = Array.from(files);
    e.target.value = "";
    
    // التحقق من حجم الملفات
    const oversized = fileList.filter(f => f.size > 16 * 1024 * 1024);
    if (oversized.length > 0) {
      toast.error(`${oversized.length} ملف تجاوز الحد الأقصى (16MB)`, { description: oversized.map(f => f.name).join(', ') });
    }
    const validFiles = fileList.filter(f => f.size <= 16 * 1024 * 1024);
    if (validFiles.length === 0) return;
    
    // تفعيل flag منع الحفظ أثناء الرفع
    isUploadingRef.current = true;
    
    const { criterionId, subEvidenceId } = activeUploadRef.current;
    let addedCount = 0;
    
    for (const file of validFiles) {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      
      try {
        const fileData = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(new Error('Failed to read file'));
          reader.readAsDataURL(file);
        });
        
        let processedData = fileData;
        if (isImage) {
          processedData = await compressImageForStorage(fileData, 1200, 0.7);
        }
        
        const evId = `ev_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        const newEv = createEmptyEvidence(subEvidenceId);
        newEv.id = evId;
        newEv.type = isImage ? "image" : isVideo ? "video" : "file";
        newEv.fileName = file.name;
        newEv.text = file.name;
        newEv.displayAs = isImage ? "image" : "qr";
        
        // حفظ في IndexedDB للملفات الكبيرة
        try {
          await saveFileToIDB({
            id: evId,
            data: processedData,
            fileName: file.name,
            fileType: file.type,
            timestamp: Date.now(),
          });
          if (isImage && processedData.length < 200000) {
            newEv.fileData = processedData;
          } else {
            newEv.fileData = `idb://${evId}`;
          }
        } catch {
          newEv.fileData = processedData;
        }
        
        addEvidenceToCriterion(criterionId, newEv);
        addedCount++;
      } catch {
        toast.error(`فشل معالجة: ${file.name}`);
      }
    }
    
    isUploadingRef.current = false;
    if (addedCount > 0) {
      toast.success(
        addedCount === 1 ? "تم إضافة الشاهد بنجاح" : `تم إضافة ${addedCount} شواهد بنجاح`,
        { description: validFiles.map(f => f.name).join(', '), duration: 3000 }
      );
    }
    try { localStorage.removeItem(STORAGE_PENDING_UPLOAD); } catch {}
  }, [compressImageForStorage, addEvidenceToCriterion]);

  const triggerFileUpload = (criterionId: string, subEvidenceId: string) => {
    activeUploadRef.current = { criterionId, subEvidenceId };
    try { localStorage.setItem(STORAGE_PENDING_UPLOAD, "file"); } catch {}
    fileInputRef.current?.click();
  };

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
  // ===== مكون عرض ملف الشاهد (يدعم IndexedDB references) =====
  const EvidenceFilePreview = ({ ev, criterionId }: { ev: EvidenceItem; criterionId: string }) => {
    const [resolvedData, setResolvedData] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);
    
    useEffect(() => {
      if (ev.fileData?.startsWith('idb://')) {
        setLoading(true);
        const idbId = ev.fileData.replace('idb://', '');
        getFileFromIDB(idbId).then(file => {
          if (file) {
            setResolvedData(file.data);
          }
          setLoading(false);
        }).catch(() => setLoading(false));
      } else {
        setResolvedData(ev.fileData);
      }
    }, [ev.fileData]);
    
    if (loading) {
      return (
        <div className="mt-2 flex items-center gap-2 p-3 bg-muted/50 rounded-lg">
          <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          <span className="text-xs text-muted-foreground">جاري تحميل الملف...</span>
        </div>
      );
    }
    
    const displayData = resolvedData || ev.fileData;
    if (!displayData) return null;
    
    return (
      <div className="mt-2">
        {ev.type === 'image' && ev.displayAs === 'image' && (
          <img src={displayData.startsWith('idb://') ? '' : displayData} alt="" className="max-h-48 rounded-lg border border-border" />
        )}
        {ev.type === 'image' && ev.displayAs === 'qr' && (
          <div className="flex items-center gap-3 bg-violet-50 dark:bg-violet-950/30 p-3 rounded-lg">
            <img src={generateQRDataURL((displayData.startsWith('idb://') ? ev.fileName : displayData).substring(0, 200))} alt="QR" className="w-16 h-16" />
            <span className="text-xs text-violet-600">سيظهر كباركود QR عند الطباعة</span>
          </div>
        )}
        {ev.type === 'video' && (
          <div className="flex items-center gap-3 bg-red-50 dark:bg-red-950/30 p-3 rounded-lg">
            <Video className="w-8 h-8 text-red-500" />
            <div><p className="text-sm font-medium">{ev.fileName}</p><p className="text-xs text-red-500">سيتحول لباركود QR عند الطباعة</p></div>
          </div>
        )}
        {ev.type === 'file' && (
          <div className="flex items-center gap-3 bg-orange-50 dark:bg-orange-950/30 p-3 rounded-lg">
            <FileText className="w-8 h-8 text-orange-500" />
            <div><p className="text-sm font-medium">{ev.fileName}</p><p className="text-xs text-orange-500">سيتحول لباركود QR عند الطباعة</p></div>
          </div>
        )}
      </div>
    );
  };

  const renderEvidenceItem = (ev: EvidenceItem, criterionId: string) => {
    const priority = ev.priority || 'essential';
    const priorityConfig = PRIORITY_CONFIG[priority];
    return (
    <motion.div key={ev.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      draggable
      onDragStart={() => handleDragStart(ev, criterionId, ev.subEvidenceId)}
      onDragEnd={handleDragEnd}
      className={`bg-muted/50 rounded-xl p-4 border group cursor-grab active:cursor-grabbing transition-all ${draggedEvidence?.evidence.id === ev.id ? 'opacity-40 scale-95 border-dashed border-primary' : priorityConfig.borderColor}`}>
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div className="cursor-grab active:cursor-grabbing text-muted-foreground/50 hover:text-muted-foreground transition-colors" title="اسحب لنقل الشاهد">
            <GripVertical className="w-4 h-4" />
          </div>
          {ev.type === 'text' && <Type className="w-4 h-4 text-muted-foreground" />}
          {ev.type === 'image' && <Image className="w-4 h-4 text-blue-500" />}
          {ev.type === 'link' && <LinkIcon className="w-4 h-4 text-purple-500" />}
          {ev.type === 'file' && <FileText className="w-4 h-4 text-orange-500" />}
          {ev.type === 'video' && <Video className="w-4 h-4 text-red-500" />}
          <span className="text-xs font-medium text-muted-foreground">
            {ev.type === 'text' ? 'نص' : ev.type === 'image' ? 'صورة' : ev.type === 'link' ? 'رابط' : ev.type === 'file' ? 'ملف' : 'فيديو'}
          </span>
          {ev.fileName && <span className="text-xs text-muted-foreground/70">({ev.fileName})</span>}
          {/* شارة الأولوية */}
          <select
            value={priority}
            onChange={(e) => updateEvidence(criterionId, ev.id, { priority: e.target.value as EvidencePriority })}
            className="text-[10px] px-1.5 py-0.5 rounded-full border-0 font-medium cursor-pointer focus:outline-none focus:ring-1 focus:ring-primary/30"
            style={{ backgroundColor: priorityConfig.color + '15', color: priorityConfig.color }}
            onClick={(e) => e.stopPropagation()}
          >
            {(Object.entries(PRIORITY_CONFIG) as [EvidencePriority, typeof PRIORITY_CONFIG[EvidencePriority]][]).map(([k, v]) => (
              <option key={k} value={k}>{v.icon} {v.label}</option>
            ))}
          </select>
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
          <Tooltip>
            <TooltipTrigger asChild>
              <button type="button" onClick={() => setShowMoveDialog({ evidence: ev, fromCriterionId: criterionId })}
                className="p-1.5 rounded-lg text-blue-400 hover:text-blue-600 hover:bg-blue-50">
                <Move className="w-3.5 h-3.5" />
              </button>
            </TooltipTrigger>
            <TooltipContent>نقل إلى بند آخر</TooltipContent>
          </Tooltip>
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
        <EvidenceFilePreview ev={ev} criterionId={criterionId} />
      )}

      {/* تعليق نصي */}
      <div className="mt-2">
        {ev.comment !== undefined && ev.comment !== '' ? (
          <div className="bg-amber-50/50 dark:bg-amber-950/20 rounded-lg p-2.5 border border-amber-200/30">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-medium text-amber-700 dark:text-amber-400">تعليق</span>
              <button type="button" onClick={() => updateEvidence(criterionId, ev.id, { comment: '' })}
                className="text-[10px] text-muted-foreground hover:text-red-500 transition-colors">حذف</button>
            </div>
            <textarea value={ev.comment} onChange={(e) => updateEvidence(criterionId, ev.id, { comment: e.target.value })}
              placeholder="أضف تعليقك هنا..." rows={2}
              className="w-full px-2 py-1.5 rounded-md border border-amber-200/50 text-xs resize-none focus:outline-none focus:ring-1 focus:ring-amber-400/30 bg-white/50 dark:bg-background/50" />
          </div>
        ) : (
          <button type="button" onClick={() => updateEvidence(criterionId, ev.id, { comment: ' ' })}
            className="text-[10px] text-muted-foreground hover:text-amber-600 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <Plus className="w-3 h-3" />إضافة تعليق
          </button>
        )}
      </div>

      {/* كلمات مفتاحية */}
      <div className="mt-2">
        {ev.keywords && ev.keywords.length > 0 ? (
          <div className="flex items-center gap-1 flex-wrap">
            {ev.keywords.map((kw, ki) => (
              <span key={ki} className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full text-[9px] font-medium bg-sky-50 dark:bg-sky-950/30 text-sky-700 dark:text-sky-400 border border-sky-200/50">
                {kw}
                <button type="button" onClick={() => updateEvidence(criterionId, ev.id, { keywords: ev.keywords?.filter((_, idx) => idx !== ki) })}
                  className="text-sky-400 hover:text-red-500 mr-0.5">
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))}
            <button type="button" onClick={() => {
              const kw = prompt('أضف كلمة مفتاحية:');
              if (kw?.trim()) updateEvidence(criterionId, ev.id, { keywords: [...(ev.keywords || []), kw.trim()] });
            }} className="text-[9px] text-sky-500 hover:text-sky-700 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
              <Plus className="w-2.5 h-2.5" />إضافة
            </button>
          </div>
        ) : (
          <button type="button" onClick={() => {
            const kw = prompt('أضف كلمة مفتاحية:');
            if (kw?.trim()) updateEvidence(criterionId, ev.id, { keywords: [kw.trim()] });
          }} className="text-[10px] text-muted-foreground hover:text-sky-600 transition-colors flex items-center gap-1 opacity-0 group-hover:opacity-100">
            <Plus className="w-3 h-3" />إضافة كلمات مفتاحية
          </button>
        )}
      </div>
    </motion.div>
  );
  };

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
        <input type="file" ref={smartUploadRef} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" multiple onChange={handleSmartUpload} />
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
              {/* مؤشر حالة الاتصال */}
              <Tooltip>
                <TooltipTrigger asChild>
                  <div className={`flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-medium transition-all ${
                    !isOnline ? 'bg-red-100 text-red-700 border border-red-200' :
                    isSyncing ? 'bg-yellow-100 text-yellow-700 border border-yellow-200' :
                    pendingCount > 0 ? 'bg-orange-100 text-orange-700 border border-orange-200' :
                    'bg-emerald-100 text-emerald-700 border border-emerald-200'
                  }`}>
                    <div className={`w-1.5 h-1.5 rounded-full ${
                      !isOnline ? 'bg-red-500' :
                      isSyncing ? 'bg-yellow-500 animate-pulse' :
                      pendingCount > 0 ? 'bg-orange-500' :
                      'bg-emerald-500'
                    }`} />
                    <span className="hidden sm:inline">
                      {!isOnline ? 'غير متصل' : isSyncing ? 'جاري المزامنة' : pendingCount > 0 ? `${pendingCount} معلق` : 'متصل'}
                    </span>
                  </div>
                </TooltipTrigger>
                <TooltipContent>
                  {!isOnline ? 'لا يوجد اتصال - البيانات محفوظة محلياً' :
                   isSyncing ? 'جاري مزامنة البيانات...' :
                   pendingCount > 0 ? `${pendingCount} إجراء بانتظار المزامنة` :
                   'متصل بالإنترنت'}
                </TooltipContent>
              </Tooltip>
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
                {selectedJob?.hasStandards && (
                  <p className="text-[10px] sm:text-xs text-muted-foreground mt-0.5 truncate">نظام المعايير الرسمي · {indicatorsCoverage?.covered || 0}/{indicatorsCoverage?.total || 0} بند مغطى</p>
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
                <div className="flex flex-col sm:flex-row gap-2 w-full sm:w-auto">
                  <Button onClick={(e) => { e.preventDefault(); e.stopPropagation(); try { localStorage.setItem(STORAGE_PENDING_UPLOAD, "smart"); } catch {} smartUploadRef.current?.click(); }} disabled={isSmartUploading}
                    variant="default" size="sm" className="gap-1.5 bg-violet-600 hover:bg-violet-700 shadow-sm text-xs h-8 sm:h-9 w-full sm:w-auto">
                    {isSmartUploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                    {isSmartUploading ? "جاري التصنيف..." : "رفع شواهد مع تصنيف ذكي"}
                  </Button>
                  <Button onClick={(e) => { e.preventDefault(); e.stopPropagation(); setShowCoverageReport(true); }}
                    variant="outline" size="sm" className="gap-1.5 text-xs h-8 sm:h-9 w-full sm:w-auto border-emerald-300 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-700 dark:text-emerald-400 dark:hover:bg-emerald-950/30">
                    <BarChart3 className="w-3.5 h-3.5" />
                    تقرير التغطية
                  </Button>
                </div>
              </div>

              {/* شريط تقدم التصنيف الذكي */}
              {uploadProgress && (
                <motion.div
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="mb-3 sm:mb-4 bg-gradient-to-r from-violet-50 to-indigo-50 dark:from-violet-950/30 dark:to-indigo-950/30 rounded-xl p-4 border border-violet-200/50 shadow-sm">
                  {/* مراحل التقدم */}
                  <div className="flex items-center justify-between mb-3">
                    {[
                      { label: "قراءة", threshold: 10, icon: Upload },
                      { label: "ضغط", threshold: 40, icon: Image },
                      { label: "تصنيف", threshold: 60, icon: Sparkles },
                      { label: "إضافة", threshold: 85, icon: CheckCircle },
                    ].map((phase, i) => {
                      const isActive = uploadProgress.percent >= phase.threshold;
                      const isCurrent = uploadProgress.percent >= phase.threshold && (i === 3 || uploadProgress.percent < [10, 40, 60, 85, 100][i + 1]);
                      const PhaseIcon = phase.icon;
                      return (
                        <div key={phase.label} className="flex flex-col items-center gap-1 flex-1">
                          <div className={`w-8 h-8 rounded-full flex items-center justify-center transition-all duration-500 ${
                            isCurrent ? 'bg-violet-600 text-white shadow-lg shadow-violet-600/30 scale-110' :
                            isActive ? 'bg-violet-500 text-white' :
                            'bg-violet-100 text-violet-400 dark:bg-violet-900/50'
                          }`}>
                            {isCurrent ? <Loader2 className="w-4 h-4 animate-spin" /> : <PhaseIcon className="w-4 h-4" />}
                          </div>
                          <span className={`text-[9px] font-medium transition-colors ${
                            isActive ? 'text-violet-700 dark:text-violet-300' : 'text-violet-400 dark:text-violet-600'
                          }`}>{phase.label}</span>
                          {i < 3 && (
                            <div className="absolute" style={{ display: 'none' }} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                  {/* شريط التقدم الرئيسي */}
                  <div className="flex items-center justify-between text-xs mb-1.5">
                    <span className="font-medium text-violet-700 dark:text-violet-400">{uploadProgress.stage}</span>
                    <span className="font-bold text-violet-600">{uploadProgress.percent}%</span>
                  </div>
                  <div className="w-full bg-violet-200/30 dark:bg-violet-800/30 rounded-full h-2.5 overflow-hidden">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${uploadProgress.percent}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                      className={`h-full rounded-full ${
                        uploadProgress.percent === 100
                          ? 'bg-gradient-to-r from-emerald-500 to-emerald-400'
                          : 'bg-gradient-to-r from-violet-600 to-indigo-500'
                      }`}
                    />
                  </div>
                  {uploadProgress.percent === 100 && (
                    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex items-center gap-1.5 mt-2 text-emerald-600">
                      <CheckCircle className="w-3.5 h-3.5" />
                      <span className="text-xs font-medium">تم بنجاح!</span>
                    </motion.div>
                  )}
                </motion.div>
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
              {/* ===== شريط البحث والفلتر ===== */}
              <div className="mb-4 space-y-2">
                <div className="relative">
                  <SearchIcon className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ابحث في الشواهد بالعنوان أو الوصف أو الكلمات المفتاحية..."
                    className="w-full pr-10 pl-4 py-2.5 rounded-xl border border-border text-sm bg-background focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40"
                  />
                  {searchQuery && (
                    <button type="button" onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-[10px] text-muted-foreground">فلتر الأولوية:</span>
                  <button type="button" onClick={() => setFilterPriority('all')}
                    className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all ${filterPriority === 'all' ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}>
                    الكل
                  </button>
                  {(Object.entries(PRIORITY_CONFIG) as [EvidencePriority, typeof PRIORITY_CONFIG[EvidencePriority]][]).map(([key, config]) => (
                    <button key={key} type="button" onClick={() => setFilterPriority(key)}
                      className={`px-2.5 py-1 rounded-full text-[10px] font-medium transition-all flex items-center gap-1 ${filterPriority === key ? 'text-white' : 'bg-muted text-muted-foreground hover:bg-muted/80'}`}
                      style={filterPriority === key ? { backgroundColor: config.color } : {}}>
                      <span>{config.icon}</span>{config.label}
                    </button>
                  ))}
                </div>
                {/* نتائج البحث */}
                {searchQuery && (() => {
                  const results: { criterionId: string; criterionTitle: string; evidence: EvidenceItem; criterionIndex: number }[] = [];
                  const q = searchQuery.toLowerCase();
                  allCriteria.forEach((c, idx) => {
                    const data = criteriaData[c.id];
                    if (!data) return;
                    data.evidences.forEach(ev => {
                      const matchText = ev.text?.toLowerCase().includes(q);
                      const matchFile = ev.fileName?.toLowerCase().includes(q);
                      const matchComment = ev.comment?.toLowerCase().includes(q);
                      const matchKeywords = ev.keywords?.some(k => k.toLowerCase().includes(q));
                      const matchFormData = ev.formData && Object.values(ev.formData).some(v => v?.toLowerCase().includes(q));
                      if (matchText || matchFile || matchComment || matchKeywords || matchFormData) {
                        results.push({ criterionId: c.id, criterionTitle: c.title, evidence: ev, criterionIndex: idx });
                      }
                    });
                  });
                  if (results.length === 0) return (
                    <div className="text-center py-4 text-muted-foreground text-xs">
                      <SearchIcon className="w-8 h-8 mx-auto mb-2 opacity-30" />
                      <p>لا توجد نتائج مطابقة لـ "{searchQuery}"</p>
                    </div>
                  );
                  return (
                    <Card className="border-primary/20 bg-primary/5">
                      <CardContent className="p-3">
                        <h4 className="text-xs font-bold text-foreground mb-2 flex items-center gap-1.5">
                          <SearchIcon className="w-3.5 h-3.5 text-primary" />
                          {results.length} نتيجة لـ "{searchQuery}"
                        </h4>
                        <div className="space-y-1.5 max-h-48 overflow-y-auto">
                          {results.map(r => (
                            <div key={r.evidence.id}
                              className="flex items-center justify-between gap-2 p-2 rounded-lg bg-background border border-border/50 cursor-pointer hover:border-primary/30 transition-colors"
                              onClick={() => { setCurrentCriterionIndex(r.criterionIndex); setStep('criterion-detail'); setSearchQuery(''); }}>
                              <div className="flex items-center gap-2 min-w-0">
                                {r.evidence.priority && (
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: PRIORITY_CONFIG[r.evidence.priority].color + '15', color: PRIORITY_CONFIG[r.evidence.priority].color }}>
                                    {PRIORITY_CONFIG[r.evidence.priority].icon}
                                  </span>
                                )}
                                <span className="text-xs text-foreground truncate">{r.evidence.text || r.evidence.fileName || 'شاهد'}</span>
                              </div>
                              <Badge variant="outline" className="text-[9px] shrink-0">{r.criterionTitle}</Badge>
                            </div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })()}
              </div>

              {/* قائمة البنود */}
              <div className="space-y-3">
                {allCriteria.map((criterion, index) => {
                  const data = criteriaData[criterion.id];
                  if (!data) return null;
                  const evidenceCount = data.evidences.length;
                  const isCustom = criterion.id.startsWith("custom_main_");
                  const status = data.score >= 4 && evidenceCount > 0 ? "complete" : evidenceCount > 0 || data.score > 0 ? "partial" : "missing";
                  const jobStandards = selectedJob?.id === "teacher" ? STANDARDS : (selectedJob ? getStandardsForJob(selectedJob.id) : []);
                  const hasStd = selectedJob?.hasStandards;
                  const standard = hasStd ? jobStandards.find(s => s.id === criterion.id) : null;
                  const indicatorProgress = hasStd && standard ? (() => {
                    const covered = standard.items.filter(item => data.evidences.some(e => e.subEvidenceId === item.id)).length;
                    return { covered, total: standard.items.length, pct: standard.items.length > 0 ? Math.round((covered / standard.items.length) * 100) : 0 };
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
                            {hasStd && standard && indicatorProgress ? (
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
    const jobStandardsDetail = selectedJob?.id === "teacher" ? STANDARDS : (selectedJob ? getStandardsForJob(selectedJob.id) : []);
    const isStandardBased = selectedJob?.hasStandards;
    const standard = isStandardBased ? jobStandardsDetail.find(s => s.id === currentCriterion.id) : null;

    return (
      <div className="min-h-screen bg-background p-3 sm:p-4 md:p-6" dir="rtl">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" multiple onChange={handleFileUpload} />
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
                    {isStandardBased && standard && (
                      <div className="flex items-center gap-1.5 sm:gap-2 mt-1.5 sm:mt-2">
                        <Badge variant="outline" className="text-[9px] sm:text-[10px]">الوزن: {standard.weight}%</Badge>
                        <Badge variant="outline" className="text-[9px] sm:text-[10px]">{standard.items.length} بند</Badge>
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

              const isDropTarget = dragOverTarget?.criterionId === currentCriterion.id && dragOverTarget?.subId === sub.id;
              return (
                <Card key={sub.id}
                  onDragOver={(e) => handleDragOver(e, currentCriterion.id, sub.id)}
                  onDragLeave={handleDragLeave}
                  onDrop={(e) => handleDrop(e, currentCriterion.id, sub.id)}
                  className={`overflow-hidden transition-all ${isExpanded ? 'border-primary/30 shadow-sm' : 'border-border/50'} ${isDropTarget ? 'border-2 border-dashed border-primary bg-primary/5 shadow-lg scale-[1.01]' : ''} ${draggedEvidence ? 'hover:border-primary/50' : ''}`}>
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

                          {/* Drop Indicator */}
                          {isDropTarget && draggedEvidence && (
                            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                              className="bg-primary/10 border-2 border-dashed border-primary rounded-xl p-4 text-center">
                              <Move className="w-5 h-5 text-primary mx-auto mb-1" />
                              <p className="text-xs font-medium text-primary">أفلت هنا لنقل الشاهد</p>
                            </motion.div>
                          )}

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

          {/* Move Evidence Dialog */}
          {showMoveDialog && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowMoveDialog(null)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-background rounded-2xl shadow-2xl max-w-md w-full max-h-[80vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
                <div className="p-4 border-b border-border flex items-center justify-between">
                  <h3 className="font-bold text-foreground flex items-center gap-2">
                    <Move className="w-4 h-4 text-primary" />نقل الشاهد إلى بند آخر
                  </h3>
                  <button type="button" onClick={() => setShowMoveDialog(null)} className="p-1 rounded-lg hover:bg-muted">
                    <X className="w-4 h-4" />
                  </button>
                </div>
                <div className="p-2 overflow-y-auto max-h-[60vh]">
                  {allCriteria.map((crit) => {
                    const critData = criteriaData[crit.id];
                    const allSubs = [...crit.subEvidences, ...(critData?.customSubEvidences || [])];
                    const isCurrent = crit.id === showMoveDialog.fromCriterionId;
                    return (
                      <div key={crit.id} className={`mb-1 ${isCurrent ? 'opacity-50' : ''}`}>
                        <div className="px-3 py-2 text-xs font-bold text-muted-foreground">{crit.title}</div>
                        {allSubs.map((sub) => (
                          <button type="button" key={sub.id}
                            disabled={isCurrent && showMoveDialog.evidence.subEvidenceId === sub.id}
                            onClick={() => moveEvidenceToCriterion(showMoveDialog.evidence, showMoveDialog.fromCriterionId, crit.id, sub.id)}
                            className="w-full text-right px-4 py-2.5 hover:bg-muted/80 rounded-lg flex items-center gap-2 transition-colors disabled:opacity-30 disabled:cursor-not-allowed">
                            <Layers className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm truncate">{sub.title}</span>
                            {isCurrent && showMoveDialog.evidence.subEvidenceId === sub.id && (
                              <Badge variant="secondary" className="text-[9px] mr-auto">الموقع الحالي</Badge>
                            )}
                          </button>
                        ))}
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* ===== تقرير التغطية Dialog ===== */}
          {showCoverageReport && (() => {
            const reportGrade = getGrade(percentage);
            return (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onClick={() => setShowCoverageReport(false)}>
              <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                className="bg-card rounded-2xl shadow-2xl border border-border max-w-2xl w-full max-h-[85vh] overflow-y-auto p-6" onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center">
                      <BarChart3 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <h2 className="text-lg font-bold" style={{ fontFamily: "var(--font-heading)" }}>تقرير تغطية البنود بالشواهد</h2>
                      <p className="text-xs text-muted-foreground">{personalInfo.name || 'ملف الإنجاز'} - {selectedJob?.title}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={async (e) => {
                      e.preventDefault();
                      setIsGeneratingReport(true);
                      try {
                        await exportToPDF('coverage-report-content', `تقرير_التغطية_${personalInfo.name || 'مستند'}.pdf`);
                        toast.success('تم تصدير التقرير بنجاح');
                      } catch { toast.error('فشل تصدير التقرير'); }
                      setIsGeneratingReport(false);
                    }}>
                      {isGeneratingReport ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                      تحميل PDF
                    </Button>
                    <button onClick={() => setShowCoverageReport(false)} className="p-1.5 rounded-lg hover:bg-muted">
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div id="coverage-report-content" className="space-y-6" dir="rtl">
                  {/* ملخص عام */}
                  <div className="bg-gradient-to-r from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 rounded-xl p-5 border border-emerald-200/50">
                    <h3 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>ملخص عام</h3>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                      <div className="bg-white/80 dark:bg-card/80 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-emerald-600">{gapAnalysis.coveredCriteria}</div>
                        <div className="text-[10px] text-muted-foreground">بند مكتمل</div>
                      </div>
                      <div className="bg-white/80 dark:bg-card/80 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-amber-600">{gapAnalysis.partialCriteria}</div>
                        <div className="text-[10px] text-muted-foreground">بند جزئي</div>
                      </div>
                      <div className="bg-white/80 dark:bg-card/80 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-red-600">{gapAnalysis.missedCriteria}</div>
                        <div className="text-[10px] text-muted-foreground">بند مفقود</div>
                      </div>
                      <div className="bg-white/80 dark:bg-card/80 rounded-lg p-3 text-center">
                        <div className="text-2xl font-bold text-blue-600">{gapAnalysis.totalEvidences}</div>
                        <div className="text-[10px] text-muted-foreground">إجمالي الشواهد</div>
                      </div>
                    </div>
                    <div className="mt-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs font-medium">نسبة التغطية الإجمالية</span>
                        <span className="text-xs font-bold" style={{ color: reportGrade.color }}>{percentage}%</span>
                      </div>
                      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-3">
                        <div className="h-3 rounded-full transition-all duration-500" style={{ width: `${percentage}%`, backgroundColor: reportGrade.color }} />
                      </div>
                      <div className="text-center mt-2">
                        <Badge variant="outline" className="text-sm font-bold" style={{ borderColor: reportGrade.color, color: reportGrade.color }}>
                          التقدير: {reportGrade.label}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  {/* رسم بياني شريطي لكل بند */}
                  <div>
                    <h3 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>تفصيل التغطية لكل بند</h3>
                    <div className="space-y-2">
                      {allCriteria.map((criterion, idx) => {
                        const data = criteriaData[criterion.id];
                        const evidenceCount = data?.evidences?.length || 0;
                        const subCount = criterion.subEvidences.length + (data?.customSubEvidences?.length || 0);
                        const coveredSubs = new Set(data?.evidences?.map(e => e.subEvidenceId) || []).size;
                        const subCoverage = subCount > 0 ? Math.round((coveredSubs / subCount) * 100) : 0;
                        const barColor = subCoverage >= 80 ? '#16A34A' : subCoverage >= 50 ? '#CA8A04' : subCoverage > 0 ? '#EA580C' : '#DC2626';
                        const StatusIcon = subCoverage >= 80 ? CheckCircle : subCoverage >= 50 ? AlertTriangle : XCircle;
                        
                        return (
                          <div key={criterion.id} className="bg-muted/30 rounded-lg p-3 border border-border/50">
                            <div className="flex items-center justify-between mb-1.5">
                              <div className="flex items-center gap-2 flex-1 min-w-0">
                                <StatusIcon className="w-4 h-4 shrink-0" style={{ color: barColor }} />
                                <span className="text-xs font-medium truncate">{idx + 1}. {criterion.title}</span>
                              </div>
                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[10px] text-muted-foreground">{evidenceCount} شاهد</span>
                                <span className="text-xs font-bold" style={{ color: barColor }}>{subCoverage}%</span>
                              </div>
                            </div>
                            <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
                              <div className="h-2 rounded-full transition-all duration-500" style={{ width: `${subCoverage}%`, backgroundColor: barColor }} />
                            </div>
                            {evidenceCount === 0 && (
                              <p className="text-[10px] text-red-500 mt-1">⚠ لا توجد شواهد مرفقة - يرجى إضافة شواهد</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>

                  {/* توزيع أنواع الشواهد */}
                  <div>
                    <h3 className="font-bold text-sm mb-3" style={{ fontFamily: "var(--font-heading)" }}>توزيع أنواع الشواهد</h3>
                    {(() => {
                      const allEvs = Object.values(criteriaData).flatMap(c => c.evidences);
                      const typeCounts = { image: 0, file: 0, text: 0, link: 0, video: 0 };
                      allEvs.forEach(ev => { if (ev.type in typeCounts) typeCounts[ev.type as keyof typeof typeCounts]++; });
                      const typeLabels = { image: 'صورة', file: 'ملف', text: 'نص', link: 'رابط', video: 'فيديو' };
                      const typeColors = { image: '#3B82F6', file: '#F97316', text: '#8B5CF6', link: '#A855F7', video: '#EF4444' };
                      const total = allEvs.length || 1;
                      return (
                        <div className="grid grid-cols-5 gap-2">
                          {Object.entries(typeCounts).map(([type, count]) => (
                            <div key={type} className="text-center">
                              <div className="relative w-full aspect-square rounded-xl flex items-center justify-center mb-1" style={{ backgroundColor: typeColors[type as keyof typeof typeColors] + '15' }}>
                                <span className="text-lg font-bold" style={{ color: typeColors[type as keyof typeof typeColors] }}>{count}</span>
                              </div>
                              <span className="text-[10px] text-muted-foreground">{typeLabels[type as keyof typeof typeLabels]}</span>
                              <div className="text-[9px] font-medium" style={{ color: typeColors[type as keyof typeof typeColors] }}>{Math.round((count / total) * 100)}%</div>
                            </div>
                          ))}
                        </div>
                      );
                    })()}
                  </div>

                  {/* توصيات */}
                  {gapAnalysis.missedCriteria > 0 && (
                    <div className="bg-amber-50 dark:bg-amber-950/30 rounded-xl p-4 border border-amber-200/50">
                      <h3 className="font-bold text-sm mb-2 text-amber-800 dark:text-amber-300" style={{ fontFamily: "var(--font-heading)" }}>توصيات لتحسين التغطية</h3>
                      <ul className="space-y-1">
                        {allCriteria.filter(c => !criteriaData[c.id]?.evidences?.length).map(c => (
                          <li key={c.id} className="text-xs text-amber-700 dark:text-amber-400 flex items-start gap-1.5">
                            <AlertTriangle className="w-3 h-3 mt-0.5 shrink-0" />
                            <span>أضف شواهد لـبند "{c.title}" لرفع نسبة التغطية</span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          );
          })()}

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
            {/* غلاف احترافي */}
            <div style={{ background: theme.headerBg, color: theme.headerText, padding: '3rem 2rem', textAlign: 'center', position: 'relative' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%)', pointerEvents: 'none' }} />
              <div style={{ fontSize: '0.7rem', opacity: 0.7, marginBottom: '0.5rem', letterSpacing: '0.1em' }}>وزارة التعليم - المملكة العربية السعودية</div>
              {personalInfo.department && <p style={{ fontSize: '0.8rem', opacity: 0.8, marginBottom: '0.25rem' }}>{personalInfo.department}</p>}
              <h1 style={{ fontSize: '1.75rem', fontWeight: 900, marginBottom: '0.5rem', fontFamily: "'Tajawal', sans-serif" }}>شواهد الأداء الوظيفي</h1>
              <p style={{ fontSize: '1.1rem', fontWeight: 700 }}>{selectedJob?.title}</p>
              <p style={{ fontSize: '0.8rem', opacity: 0.8, marginTop: '0.5rem' }}>{personalInfo.year} - {personalInfo.semester}</p>
              <div style={{ marginTop: '1rem', display: 'flex', justifyContent: 'center', gap: '1rem', fontSize: '0.75rem', opacity: 0.9 }}>
                <span>الاسم: {personalInfo.name || '—'}</span>
                <span>| المدرسة: {personalInfo.school || '—'}</span>
              </div>
            </div>

            {/* فهرس المحتويات */}
            <div className="p-6 border-b" style={{ borderColor: theme.borderColor }}>
              <h2 className="text-base font-bold mb-3" style={{ color: theme.accent, fontFamily: "'Tajawal', sans-serif" }}>فهرس المحتويات</h2>
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-gray-600 py-1 border-b border-dashed border-gray-200">
                  <span className="font-bold" style={{ color: theme.accent }}>1</span>
                  <span>البيانات الشخصية</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-600 py-1 border-b border-dashed border-gray-200">
                  <span className="font-bold" style={{ color: theme.accent }}>2</span>
                  <span>جدول التقييم</span>
                </div>
                {allCriteria.map((c, i) => {
                  const d = criteriaData[c.id];
                  if (!d || d.evidences.length === 0) return null;
                  return (
                    <div key={c.id} className="flex items-center gap-2 text-xs text-gray-600 py-1 border-b border-dashed border-gray-200">
                      <span className="font-bold" style={{ color: theme.accent }}>{i + 3}</span>
                      <span>{c.title} ({d.evidences.length} شاهد)</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* البيانات الشخصية */}
            <div className="p-6 border-b" style={{ borderColor: theme.borderColor }}>
              <h2 className="text-sm font-bold mb-3" style={{ color: theme.accent, fontFamily: "'Tajawal', sans-serif" }}>البيانات الشخصية</h2>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">الاسم الكامل</span><br /><strong>{personalInfo.name || '—'}</strong></div>
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">المدرسة</span><br /><strong>{personalInfo.school || '—'}</strong></div>
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">اسم المقيّم</span><br /><strong>{personalInfo.evaluator || '—'}</strong></div>
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">تاريخ التقييم</span><br /><strong>{personalInfo.date || '—'}</strong></div>
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">صفة المقيّم</span><br /><strong>{personalInfo.evaluatorRole || '—'}</strong></div>
                <div className="bg-gray-50 rounded-lg p-3"><span className="text-gray-500 text-xs">الوظيفة</span><br /><strong>{selectedJob?.title || '—'}</strong></div>
              </div>
            </div>

            {/* جدول التقييم */}
            <div className="p-6">
              <h2 className="text-sm font-bold mb-3" style={{ color: theme.accent, fontFamily: "'Tajawal', sans-serif" }}>جدول التقييم</h2>
              <table className="w-full border-collapse text-sm" style={{ borderColor: theme.borderColor }}>
                <thead>
                  <tr style={{ background: theme.accent, color: '#fff' }}>
                    <th className="p-2.5 border text-center" style={{ borderColor: theme.borderColor, width: '40px' }}>م</th>
                    <th className="p-2.5 border text-right" style={{ borderColor: theme.borderColor }}>البند</th>
                    <th className="p-2.5 border text-center" style={{ borderColor: theme.borderColor, width: '80px' }}>الدرجة</th>
                    <th className="p-2.5 border text-center" style={{ borderColor: theme.borderColor, width: '80px' }}>الشواهد</th>
                  </tr>
                </thead>
                <tbody>
                  {allCriteria.map((c, i) => {
                    const d = criteriaData[c.id];
                    return (
                      <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                        <td className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>{i + 1}</td>
                        <td className="p-2 border" style={{ borderColor: theme.borderColor }}>{c.title}</td>
                        <td className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{d?.score || 0}/{c.maxScore}</td>
                        <td className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>{d?.evidences.length || 0}</td>
                      </tr>
                    );
                  })}
                  <tr style={{ background: theme.accent, color: '#fff' }}>
                    <td colSpan={2} className="p-2.5 border text-center font-bold" style={{ borderColor: theme.borderColor }}>المجموع</td>
                    <td className="p-2.5 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{totalScore}/{maxScore}</td>
                    <td className="p-2.5 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{Object.values(criteriaData).reduce((s, d) => s + d.evidences.length, 0)}</td>
                  </tr>
                </tbody>
              </table>

              <div className="text-center mt-6 p-5 rounded-xl" style={{ background: `${grade.color}12` }}>
                <p className="text-xs text-gray-500 mb-1">التقدير النهائي</p>
                <p className="text-3xl font-black" style={{ color: grade.color }}>{percentage}%</p>
                <p className="text-lg font-bold mt-1" style={{ color: grade.color }}>{grade.label}</p>
                {indicatorsCoverage && (
                  <p className="text-xs text-gray-500 mt-2">المؤشرات المغطاة: {indicatorsCoverage.covered} من {indicatorsCoverage.total}</p>
                )}
              </div>

              {/* الشواهد مع الأولوية والكلمات المفتاحية */}
              {allCriteria.map((c, i) => {
                const d = criteriaData[c.id];
                if (!d || d.evidences.length === 0) return null;
                return (
                  <div key={c.id} className="mt-8" style={{ pageBreakInside: 'avoid' }}>
                    <div className="flex items-center gap-2 mb-3 pb-2 border-b-2" style={{ borderColor: theme.accent }}>
                      <div className="w-7 h-7 rounded-lg flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: theme.accent }}>{i + 1}</div>
                      <h3 className="font-bold text-sm" style={{ color: theme.accent }}>{c.title}</h3>
                      <span className="text-[10px] text-gray-400 mr-auto">الدرجة: {d.score}/{c.maxScore} | {d.evidences.length} شاهد</span>
                    </div>
                    <div className="space-y-3">
                      {d.evidences.map((ev, evIdx) => {
                        const evPriority = ev.priority || 'essential';
                        const evPriorityConfig = PRIORITY_CONFIG[evPriority];
                        return (
                          <div key={ev.id} className="p-3 rounded-lg border" style={{ borderColor: theme.borderColor, borderRightWidth: '3px', borderRightColor: evPriorityConfig.color }}>
                            {/* رأس الشاهد */}
                            <div className="flex items-center gap-2 mb-2">
                              <span className="text-[10px] font-bold text-gray-400">شاهد {evIdx + 1}</span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full font-medium" style={{ backgroundColor: evPriorityConfig.color + '15', color: evPriorityConfig.color }}>
                                {evPriorityConfig.icon} {evPriorityConfig.label}
                              </span>
                              <span className="text-[9px] px-1.5 py-0.5 rounded-full bg-gray-100 text-gray-500">
                                {ev.type === 'text' ? 'نص' : ev.type === 'image' ? 'صورة' : ev.type === 'link' ? 'رابط' : ev.type === 'file' ? 'ملف' : 'فيديو'}
                              </span>
                            </div>
                            {/* محتوى الشاهد */}
                            {ev.type === 'text' && ev.text && <p className="text-sm leading-relaxed">{ev.text}</p>}
                            {ev.type === 'link' && ev.link && (
                              <div className="flex items-center gap-3">
                                <img src={generateQRDataURL(ev.link)} alt="QR" className="w-20 h-20 rounded" />
                                <div>
                                  <span className="text-xs text-gray-500 block">رابط إلكتروني</span>
                                  <span className="text-xs text-blue-600 break-all">{ev.link}</span>
                                </div>
                              </div>
                            )}
                            {ev.type === 'image' && ev.fileData && (
                              ev.displayAs === 'image'
                                ? <img src={ev.fileData.startsWith('idb://') ? '' : ev.fileData} alt="" className="max-h-48 rounded-lg border border-gray-200" />
                                : <div className="flex items-center gap-3">
                                    <img src={generateQRDataURL((ev.fileData.startsWith('idb://') ? ev.fileName || '' : ev.fileData).substring(0, 200))} alt="QR" className="w-20 h-20 rounded" />
                                    <div>
                                      <span className="text-xs text-gray-500 block">صورة (باركود)</span>
                                      <span className="text-xs text-gray-600">{ev.fileName}</span>
                                    </div>
                                  </div>
                            )}
                            {(ev.type === 'video' || ev.type === 'file') && ev.fileData && (
                              <div className="flex items-center gap-3">
                                <img src={generateQRDataURL(ev.fileName || 'file')} alt="QR" className="w-20 h-20 rounded" />
                                <div>
                                  <span className="text-xs text-gray-500 block">{ev.type === 'video' ? 'فيديو' : 'ملف مرفق'}</span>
                                  <span className="text-xs text-gray-600">{ev.fileName}</span>
                                </div>
                              </div>
                            )}
                            {ev.formData && Object.entries(ev.formData).some(([, v]) => v) && (
                              <div className="text-sm space-y-1 mt-2 bg-gray-50 rounded-lg p-3">
                                {Object.entries(ev.formData).filter(([, v]) => v).map(([key, val]) => (
                                  <p key={key}><span className="text-gray-500 text-xs">{key}:</span> <span className="text-gray-800">{val}</span></p>
                                ))}
                              </div>
                            )}
                            {/* التعليق */}
                            {ev.comment && ev.comment.trim() && (
                              <div className="mt-2 bg-amber-50 rounded-lg p-2 text-xs text-amber-800 border border-amber-200/50">
                                <strong>تعليق:</strong> {ev.comment}
                              </div>
                            )}
                            {/* الكلمات المفتاحية */}
                            {ev.keywords && ev.keywords.length > 0 && (
                              <div className="mt-2 flex items-center gap-1 flex-wrap">
                                {ev.keywords.map((kw, ki) => (
                                  <span key={ki} className="text-[9px] px-1.5 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200/50">{kw}</span>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* التوقيعات */}
              <div className="mt-12 grid grid-cols-2 gap-8 text-center text-sm">
                <div>
                  <p className="text-gray-500 mb-10">توقيع المقيّم</p>
                  <div className="border-t-2 border-gray-300 pt-2 font-bold">{personalInfo.evaluator || '____________'}</div>
                  <p className="text-xs text-gray-400 mt-1">{personalInfo.evaluatorRole}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-10">توقيع الموظف</p>
                  <div className="border-t-2 border-gray-300 pt-2 font-bold">{personalInfo.name || '____________'}</div>
                  <p className="text-xs text-gray-400 mt-1">{selectedJob?.title}</p>
                </div>
              </div>

              {/* تذييل */}
              <div className="mt-8 pt-4 border-t border-gray-200 text-center text-[9px] text-gray-400">
                <p>تم إنشاء هذا الملف بواسطة نظام SERS - السجلات التعليمية الذكية</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
