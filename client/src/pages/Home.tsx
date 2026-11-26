import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import {
  Accessibility,
  ArrowLeft,
  Award,
  Baby,
  BarChart3,
  Bell,
  BookOpen,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CheckSquare,
  ClipboardCheck,
  Clock,
  FileText,
  FolderOpen,
  GraduationCap,
  HeartHandshake,
  HeartPulse,
  LayoutGrid,
  Library,
  Medal,
  Plus,
  Radio,
  Search,
  ShieldCheck,
  ShoppingBag,
  Sparkles,
  TrendingUp,
  Trophy,
  UploadCloud,
  UserCircle,
  Wrench,
  X,
} from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import InstantReportLab from "@/components/InstantReportLab";
import {
  getSectionEntryRoute,
  getSectionsByRole,
  getServiceAvailability,
  getTotalServicesCount,
  searchServices,
  sections,
  USER_ROLES,
  type Section,
  type ServiceAvailability,
  type UserRole,
} from "@/lib/data";

type ActionCard = {
  title: string;
  description: string;
  path: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  accent: string;
};

const coreWorkspaceActions: ActionCard[] = [
  {
    title: "أعمالي والتقارير",
    description: "أنشئ تقاريرك وملفات إنجازك السحابية مع نسخ ثابتة وتصدير PDF وWord.",
    path: "/reports",
    badge: "سحابي",
    icon: FileText,
    accent: "bg-teal-50 text-teal-700",
  },
  {
    title: "الشواهد والأصول الذكية",
    description: "ارفع الأصل مرة واحدة وغطِّ عناصر التقييم الـ 7 والمعايير الـ 11 وETEC.",
    path: "/evidence",
    badge: "SmartEvidence",
    icon: Library,
    accent: "bg-cyan-50 text-cyan-700",
  },
  {
    title: "التقويم الذاتي (تميز)",
    description: "قيّم مؤشرات هيئة تقويم التعليم الرسمية (48/51 مؤشرًا) ولجنة التقويم وخطة التحسين.",
    path: "/self-evaluation",
    badge: "ETEC رسمي",
    icon: ClipboardCheck,
    accent: "bg-emerald-50 text-emerald-700",
  },
  {
    title: "المراجعات والاعتمادات",
    description: "تابع قرارات المراجعين والتفويض على نسخ ثابتة غير قابلة للتغيير بعد الإرسال.",
    path: "/reviews",
    badge: "نسخ ثابتة",
    icon: CheckSquare,
    accent: "bg-violet-50 text-violet-700",
  },
  {
    title: "القوالب والمتجر",
    description: "استعرض القوالب والخدمات الجاهزة المصنفة حسب الدور والاحتياج المدرسي.",
    path: "/store",
    badge: "قوالب",
    icon: ShoppingBag,
    accent: "bg-amber-50 text-amber-700",
  },
];

const interactiveQuickTools = [
  { route: "/performance-evidence", title: "شواهد الأداء الوظيفي", desc: "تصنيف ذكي ومعاينة وPDF", color: "#059669", icon: Award },
  { route: "/certificates", title: "صانع الشهادات", desc: "6 أنواع × 5 ثيمات + PDF", color: "#D97706", icon: Medal },
  { route: "/portfolio", title: "ملف الإنجاز التفاعلي", desc: "تنظيم السجل المهني وPDF", color: "#7C3AED", icon: FolderOpen },
  { route: "/grade-analysis", title: "تحليل النتائج", desc: "رسوم بيانية وتقارير فورية", color: "#EA580C", icon: TrendingUp },
  { route: "/treatment-plans", title: "الخطط العلاجية", desc: "خطط علاجية وإثرائية جاهزة", color: "#DC2626", icon: HeartPulse },
  { route: "/exams", title: "منصة الاختبارات", desc: "بنك أسئلة وتصحيح إلكتروني", color: "#9333EA", icon: ClipboardCheck },
  { route: "/school-radio", title: "الإذاعة المدرسية", desc: "توليد إذاعات وطباعة A4", color: "#F59E0B", icon: Radio },
  { route: "/smart-cv", title: "السيرة الذاتية الذكية", desc: "سيرة احترافية + QR مرفقات", color: "#0891B2", icon: UserCircle },
  { route: "/covers", title: "أغلفة وفواصل", desc: "6 تصاميم × 5 ألوان جاهزة", color: "#6366F1", icon: BookOpen },
  { route: "/catalog", title: "كل الخدمات (87)", desc: "بحث شامل وفلاتر التصنيف", color: "#475569", icon: Wrench },
] as const;

const sectionIconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  Award,
  FolderOpen,
  FileText,
  BarChart3,
  TrendingUp,
  HeartPulse,
  CalendarDays,
  ClipboardCheck,
  Medal,
  GraduationCap,
  BookOpen,
  Radio,
  Wrench,
  ShoppingBag,
  UserCircle,
};

const roleIconMap: Record<string, React.ComponentType<{ className?: string }>> = {
  LayoutGrid,
  GraduationCap,
  Building2,
  HeartHandshake,
  Trophy,
  Baby,
  Accessibility,
};

const availabilityBadge: Record<ServiceAvailability, { label: string; className: string }> = {
  server: { label: "سحابي", className: "bg-teal-50 text-teal-800 border-teal-200" },
  partial: { label: "تفاعلي", className: "bg-emerald-50 text-emerald-800 border-emerald-200" },
  local: { label: "تفاعلي محلي", className: "bg-slate-100 text-slate-700 border-slate-200" },
  catalog: { label: "كتالوج", className: "bg-amber-50 text-amber-800 border-amber-200" },
  planned: { label: "قريبًا", className: "bg-slate-100 text-slate-500 border-slate-200" },
};

const workflow = [
  { label: "شاهد أو أصل", icon: Library },
  { label: "عمل", icon: FileText },
  { label: "نسخة", icon: ShieldCheck },
  { label: "مراجعة", icon: CheckSquare },
  { label: "مخرج", icon: Sparkles },
];

export default function Home() {
  const [location, navigate] = useLocation();
  const [selectedRole, setSelectedRole] = useState<UserRole>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const totalServices = useMemo(() => getTotalServicesCount(), []);
  const filteredSections = useMemo(() => getSectionsByRole(selectedRole), [selectedRole]);
  const searchResults = useMemo(() => searchServices(searchQuery), [searchQuery]);
  const isSearching = searchQuery.trim().length > 0;

  const openSection = (section: Section) => {
    if (section.comingSoon) return;
    const entryRoute = getSectionEntryRoute(section) || section.route;
    if (entryRoute) navigate(entryRoute);
    else navigate("/catalog");
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-10" dir="rtl">
      <AppSidebar currentPath={location} />

      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 sm:py-8">
          {/* ═══ Rich Unified Hero Banner (1b829d5 visual energy + vNext Cloud Core) ═══ */}
          <section className="relative overflow-hidden rounded-3xl bg-gradient-to-l from-teal-900 via-teal-800 to-emerald-800 p-6 text-white shadow-lg sm:p-8">
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full bg-emerald-400/20 blur-3xl" />
            <div className="pointer-events-none absolute -bottom-24 right-10 h-56 w-56 rounded-full bg-cyan-300/15 blur-3xl" />

            <div className="relative flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
              <div className="mr-12 max-w-2xl lg:mr-0">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-bold text-teal-50 backdrop-blur-sm">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  منصة سيرس SERS — مساحة السجلات والأدوات التعليمية الذكية
                </div>
                <h1
                  className="mt-3 text-2xl font-black leading-tight text-white sm:text-4xl"
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  كل أعمالك وتقاريرك وشواهدك وأدواتك التعليمية في منصة واحدة متكاملة.
                </h1>
                <p className="mt-3 text-sm leading-7 text-teal-50/90">
                  اجمع بين قوة الحفظ السحابي والمراجعة والتقويم الذاتي المدرسي (وفق مؤشرات هيئة تقويم التعليم — تميز) وبين أدواتك التفاعلية اليومية لإنجاز الشهادات والتقارير والخطط والاختبارات بسلاسة.
                </p>

                <div className="mt-5 flex flex-wrap gap-2.5">
                  <button
                    type="button"
                    onClick={() => navigate("/work")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-white px-4 py-2.5 text-sm font-bold text-teal-900 shadow-sm transition hover:bg-teal-50"
                  >
                    <Plus className="h-4 w-4" />
                    ابدأ عملًا جديدًا
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/self-evaluation")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/30 bg-white/15 px-4 py-2.5 text-sm font-bold text-white backdrop-blur-sm transition hover:bg-white/25"
                  >
                    <ClipboardCheck className="h-4 w-4" />
                    التقويم الذاتي (تميز)
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate("/evidence")}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-white/25 bg-teal-950/25 px-4 py-2.5 text-sm font-bold text-white transition hover:bg-teal-950/40"
                  >
                    <UploadCloud className="h-4 w-4" />
                    إضافة شاهد
                  </button>
                </div>
              </div>

              {/* Compact Stats & Instant Search */}
              <div className="w-full space-y-3 lg:w-80">
                <div className="grid grid-cols-2 gap-2.5">
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-xl font-black text-white">{sections.length}</p>
                    <p className="text-[11px] text-teal-100">قسم تعليمي متكامل</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-xl font-black text-white">{totalServices}</p>
                    <p className="text-[11px] text-teal-100">أداة وخدمة مصنفة</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-xl font-black text-amber-300">48 / 51</p>
                    <p className="text-[11px] text-teal-100">مؤشر ETEC رسمي</p>
                  </div>
                  <div className="rounded-2xl border border-white/15 bg-white/10 p-3 backdrop-blur-sm">
                    <p className="text-xl font-black text-emerald-300">PDF + Word</p>
                    <p className="text-[11px] text-teal-100">تصدير عربي + QR</p>
                  </div>
                </div>

                <label className="relative block">
                  <span className="sr-only">ابحث عن أداة أو خدمة تعليمية</span>
                  <Search className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-teal-200" />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder="ابحث عن أداة: شهادة، تقويم، اختبار، خطة..."
                    className="min-h-11 w-full rounded-xl border border-white/25 bg-white/15 py-2.5 pr-10 pl-9 text-xs text-white placeholder:text-teal-100/80 backdrop-blur-sm outline-none focus:border-white focus:bg-white/20"
                  />
                  {isSearching && (
                    <button
                      type="button"
                      aria-label="مسح البحث"
                      onClick={() => setSearchQuery("")}
                      className="absolute left-2.5 top-1/2 -translate-y-1/2 rounded-md p-1 text-teal-100 hover:bg-white/20"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </label>
              </div>
            </div>
          </section>

          {/* ═══ Live Search Results Overlay ═══ */}
          {isSearching ? (
            <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <h2 className="text-base font-bold text-slate-950">
                  نتائج البحث عن «{searchQuery.trim()}» ({searchResults.length})
                </h2>
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="text-xs font-bold text-teal-700 hover:underline"
                >
                  العودة للعرض الكامل
                </button>
              </div>
              {searchResults.length === 0 ? (
                <p className="mt-6 py-8 text-center text-sm text-slate-600">
                  لا توجد خدمة مطابقة؛ جرّب كلمة أخرى مثل «شهادات» أو «شواهد» أو «اختبار».
                </p>
              ) : (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {searchResults.slice(0, 18).map(({ section, service }) => {
                    const status = getServiceAvailability(section, service);
                    const badge = availabilityBadge[status];
                    const route = getSectionEntryRoute(section) || section.route || "/catalog";
                    return (
                      <button
                        key={service.id}
                        type="button"
                        onClick={() => navigate(status === "planned" || status === "catalog" ? "/catalog" : route)}
                        className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4 text-right transition hover:border-teal-300 hover:bg-white hover:shadow-sm"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span
                            className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                            style={{ backgroundColor: section.color }}
                          >
                            {section.title}
                          </span>
                          <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
                            {badge.label}
                          </span>
                        </div>
                        <p className="mt-2 text-sm font-bold text-slate-900">{service.title}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-600">{service.description}</p>
                      </button>
                    );
                  })}
                </div>
              )}
            </section>
          ) : (
            <>
              {/* ═══ 1. Core Cloud Workspace (vNext) ═══ */}
              <section className="mt-7">
                <div className="mb-3 flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-teal-700">مساحة العمل السحابية الموحّدة</p>
                    <h2 className="mt-0.5 text-lg font-black text-slate-950 sm:text-xl">
                      ماذا تريد أن تنجز الآن؟
                    </h2>
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
                  {coreWorkspaceActions.map(action => {
                    const Icon = action.icon;
                    return (
                      <button
                        key={action.path}
                        type="button"
                        aria-label={action.title}
                        onClick={() => navigate(action.path)}
                        className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${action.accent}`}>
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-700">
                            {action.badge}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-900">{action.title}</h3>
                        <p className="mt-1.5 flex-1 text-xs leading-5 text-slate-600">{action.description}</p>
                        <div className="mt-3 flex items-center gap-1 text-xs font-bold text-teal-700">
                          فتح
                          <ArrowLeft className="h-3.5 w-3.5 transition-transform group-hover:-translate-x-1" />
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ═══ 2. Quick-Access Interactive Tools Strip (Restored from 1b829d5) ═══ */}
              <section className="mt-7">
                <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="text-xs font-bold text-emerald-700">وصول مباشر بنقرة واحدة</p>
                    <h2 className="mt-0.5 text-lg font-black text-slate-950 sm:text-xl">
                      الأدوات التفاعلية الجاهزة للاستخدام
                    </h2>
                  </div>
                  <button
                    type="button"
                    onClick={() => navigate("/catalog")}
                    className="text-xs font-bold text-teal-700 hover:underline"
                  >
                    عرض جميع الخدمات ({totalServices}) ←
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-5">
                  {interactiveQuickTools.map(tool => {
                    const Icon = tool.icon;
                    return (
                      <button
                        key={tool.route}
                        type="button"
                        onClick={() => navigate(tool.route)}
                        className="group flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-3.5 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md"
                      >
                        <div
                          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                          style={{ backgroundColor: tool.color }}
                        >
                          <Icon className="h-5 w-5" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-bold text-slate-900 group-hover:text-teal-800">
                            {tool.title}
                          </p>
                          <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-600">
                            {tool.desc}
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ═══ 3. Role Filter + All 13 Colored Sections Grid (Restored from 1b829d5) ═══ */}
              <section className="mt-8">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <p className="text-xs font-bold text-teal-700">تصفّح حسب وظيفتك التعليمية</p>
                    <h2 className="mt-0.5 text-lg font-black text-slate-950 sm:text-xl">
                      {selectedRole === "all"
                        ? `جميع الأقسام التعليمية (${filteredSections.length})`
                        : `أقسام ${USER_ROLES.find(r => r.id === selectedRole)?.label ?? ""} (${filteredSections.length})`}
                    </h2>
                  </div>
                </div>

                <div
                  className="mt-3 flex gap-2 overflow-x-auto pb-2"
                  role="group"
                  aria-label="تصفية الأقسام حسب الدور الوظيفي"
                >
                  {USER_ROLES.map(role => {
                    const RoleIcon = roleIconMap[role.icon] || LayoutGrid;
                    const active = selectedRole === role.id;
                    return (
                      <button
                        key={role.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setSelectedRole(role.id)}
                        className={`inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold transition ${
                          active
                            ? "bg-teal-700 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-700 hover:border-teal-200 hover:bg-teal-50/50"
                        }`}
                      >
                        <RoleIcon className="h-3.5 w-3.5 shrink-0" />
                        <span>{role.label}</span>
                      </button>
                    );
                  })}
                </div>

                <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredSections.map(section => {
                    const Icon = sectionIconMap[section.icon] || FileText;
                    const status = section.comingSoon
                      ? "planned"
                      : getServiceAvailability(section, section.services[0]!);
                    const badge = availabilityBadge[status];
                    return (
                      <button
                        key={section.id}
                        type="button"
                        disabled={section.comingSoon}
                        onClick={() => openSection(section)}
                        className="group flex flex-col rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:-translate-y-0.5 hover:border-teal-300 hover:shadow-md disabled:cursor-not-allowed disabled:opacity-70"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div
                            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-white shadow-sm"
                            style={{ backgroundColor: section.color }}
                          >
                            <Icon className="h-5 w-5" />
                          </div>
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${badge.className}`}>
                            {section.comingSoon && <Clock className="h-3 w-3" />}
                            {badge.label}
                          </span>
                        </div>
                        <h3 className="mt-3 text-sm font-bold text-slate-950 group-hover:text-teal-800">
                          {section.title}
                        </h3>
                        <p className="mt-1.5 line-clamp-2 flex-1 text-xs leading-5 text-slate-600">
                          {section.description}
                        </p>
                        <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2.5 text-[11px] font-semibold text-slate-600">
                          <span>{section.services.length} خدمة</span>
                          <span className="inline-flex items-center gap-1 font-bold text-teal-700">
                            {section.comingSoon ? "قريبًا" : "فتح القسم"}
                            {!section.comingSoon && <ArrowLeft className="h-3 w-3" />}
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              </section>

              {/* ═══ 4. 30-Second Instant Report Preview Lab ═══ */}
              <InstantReportLab
                onStartRealWork={draft =>
                  navigate(
                    draft?.title
                      ? `/work?prefillTitle=${encodeURIComponent(draft.title)}`
                      : "/work",
                  )
                }
              />

              {/* ═══ 5. Saved Workspace & Follow-up ═══ */}
              <div className="mt-8 grid gap-4 lg:grid-cols-[1.35fr_0.65fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-xs font-bold text-teal-700">تابع من حيث توقفت</p>
                      <h2 className="mt-1 text-lg font-bold text-slate-950">أعمالك المحفوظة</h2>
                    </div>
                    <button
                      type="button"
                      onClick={() => navigate("/work")}
                      className="text-xs font-bold text-teal-700 hover:text-teal-800"
                    >
                      عرض الكل
                    </button>
                  </div>
                  <div className="mt-5 rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 px-5 py-8 text-center">
                    <BriefcaseBusiness className="mx-auto h-8 w-8 text-slate-400" />
                    <h3 className="mt-3 text-sm font-bold text-slate-800">
                      افتح مساحة أعمالك لمتابعة التقارير وملفات الإنجاز ودورات التقويم
                    </h3>
                    <p className="mx-auto mt-2 max-w-md text-xs leading-6 text-slate-600">
                      ستجد في «أعمالي» البيانات المحفوظة في حسابك، وحالة المسودة والنسخة الحالية والخطوة التالية. لا تعرض هذه الصفحة العامة حالة حسابك أو أعدادًا افتراضية.
                    </p>
                    <div className="mt-4 flex flex-wrap justify-center gap-2">
                      <button
                        type="button"
                        onClick={() => navigate("/work")}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2 text-xs font-bold text-white shadow-sm hover:bg-teal-800"
                      >
                        فتح أعمالي
                        <ArrowLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        type="button"
                        onClick={() => navigate("/evidence")}
                        className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-white px-4 py-2 text-xs font-bold text-teal-800 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
                      >
                        إضافة شاهد
                      </button>
                    </div>
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-bold text-amber-700">يحتاج انتباهك</p>
                      <h2 className="mt-1 text-lg font-bold text-slate-950">متابعة اليوم</h2>
                    </div>
                    <Bell className="h-5 w-5 text-slate-400" />
                  </div>
                  <div className="mt-5 space-y-3">
                    <button
                      type="button"
                      onClick={() => navigate("/reviews")}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-right transition hover:border-violet-200 hover:bg-violet-50/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-violet-50 text-violet-700">
                          <CheckSquare className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800">المراجعات</p>
                          <p className="mt-1 text-[11px] text-slate-600">الطلبات والقرارات والتفويض على النسخ الثابتة.</p>
                        </div>
                        <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate("/notifications")}
                      className="w-full rounded-xl border border-slate-100 bg-slate-50 p-4 text-right transition hover:border-teal-200 hover:bg-teal-50/40"
                    >
                      <div className="flex items-center gap-3">
                        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                          <Bell className="h-4 w-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-xs font-bold text-slate-800">الإشعارات</p>
                          <p className="mt-1 text-[11px] text-slate-600">أحداث قابلة للتصرف، دون ضوضاء.</p>
                        </div>
                        <ArrowLeft className="h-3.5 w-3.5 text-slate-400" />
                      </div>
                    </button>
                  </div>
                </section>
              </div>

              {/* ═══ 6. Unified Workflow Strip ═══ */}
              <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
                <div className="mb-5">
                  <p className="text-xs font-bold text-teal-700">كيف يسير عملك؟</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">دورة واحدة مترابطة بدل أدوات منفصلة</h2>
                </div>
                <div className="grid gap-2 sm:grid-cols-5">
                  {workflow.map((step, index) => {
                    const Icon = step.icon;
                    return (
                      <div key={step.label} className="relative rounded-xl bg-slate-50 p-4 text-center">
                        <div className="mx-auto flex h-9 w-9 items-center justify-center rounded-lg bg-white text-teal-700 shadow-sm ring-1 ring-slate-100">
                          <Icon className="h-4 w-4" />
                        </div>
                        <p className="mt-2 text-xs font-bold text-slate-700">{step.label}</p>
                        {index < workflow.length - 1 && (
                          <ArrowLeft className="absolute -left-2 top-1/2 hidden h-4 w-4 -translate-y-1/2 text-slate-300 sm:block" />
                        )}
                      </div>
                    );
                  })}
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
