/**
 * SERS Platform - الصفحة الرئيسية
 * منصة شاملة للخدمات التعليمية
 * Design: Material Design 3 Arabic - Teal + Warm accents
 * Layout: Sidebar + Top nav + Hero + Role filter + Section grid
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  Search, X, Sparkles, ShoppingBag, UserCircle,
  Download, Globe, ShoppingCart, Eye, Menu, ArrowLeft, ArrowRight,
  LayoutGrid, Building2, HeartHandshake, Trophy, Baby, Accessibility,
  Clock, Star, ChevronDown, Filter, ExternalLink, Play, Home as HomeIcon
} from "lucide-react";
import {
  sections, getTotalServicesCount, getInteractiveCount, getPaidCount, getFreeCount,
  getStoreCount, searchServices, getSectionsByRole, getServicesByRole,
  USER_ROLES, type Section, type Service, type UserRole
} from "@/lib/data";
import AppSidebar from "@/components/AppSidebar";

// Icon map for sections
const iconMap: Record<string, React.ComponentType<any>> = {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  ShoppingBag, UserCircle,
};

// Icon map for roles
const roleIconMap: Record<string, React.ComponentType<any>> = {
  LayoutGrid, GraduationCap, Building2, HeartHandshake, Trophy, Baby, Accessibility,
};

const HERO_BG = "https://d2xsxph8kpxj0f.cloudfront.net/310519663047121386/h34s4aPNVyHXdtjgZ7eNNf/hero-bg-hnJ2rckMtM6Tpaxzs2epLL.webp";

// خريطة الأقسام التي لها صفحات تفاعلية مبنية
const INTERACTIVE_ROUTES: Record<string, string> = {
  "1": "/performance-evidence",
  "4": "/certificates",
  "6": "/treatment-plans",
  "8": "/grade-analysis",
  "13": "/covers",
};

// ═══════════════════════════════════════════════════════════════
// Components
// ═══════════════════════════════════════════════════════════════

function StatBadge({ value, label, icon: Icon, color }: { value: number | string; label: string; icon: React.ComponentType<any>; color: string }) {
  return (
    <div className="flex items-center gap-2 bg-white/10 backdrop-blur-sm rounded-lg px-3 py-2">
      <Icon className="w-4 h-4 shrink-0" style={{ color }} />
      <div className="min-w-0">
        <div className="text-base font-bold text-white leading-none">{value}</div>
        <div className="text-[9px] text-white/70 whitespace-nowrap">{label}</div>
      </div>
    </div>
  );
}

function RoleFilterBar({ selectedRole, onRoleChange }: { selectedRole: UserRole; onRoleChange: (role: UserRole) => void }) {
  return (
    <div className="flex gap-2 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0" style={{ WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none' }}>
      {USER_ROLES.map((role) => {
        const Icon = roleIconMap[role.icon] || LayoutGrid;
        const isActive = selectedRole === role.id;
        return (
          <button
            key={role.id}
            onClick={() => onRoleChange(role.id)}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all shrink-0 ${
              isActive
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/25"
                : "bg-white text-gray-600 hover:bg-gray-50 border border-gray-200"
            }`}
          >
            <Icon className="w-3.5 h-3.5 shrink-0" />
            <span>{role.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SectionCard({ section, onNavigate }: { section: Section; onNavigate: (path: string) => void }) {
  const Icon = iconMap[section.icon] || FileText;
  const route = section.route || INTERACTIVE_ROUTES[section.id];
  const interactiveServices = section.services.filter((s) => s.mode === "interactive" || s.mode === "both").length;
  const storeServices = section.services.filter((s) => s.mode === "store" || s.mode === "both").length;
  const isComingSoon = section.comingSoon;

  return (
    <button
      onClick={() => {
        if (isComingSoon) {
          import("sonner").then(({ toast }) => {
            toast.info("قريباً إن شاء الله", { description: "هذا القسم قيد التطوير وسيتوفر قريباً" });
          });
          return;
        }
        if (route) {
          onNavigate(route);
        } else {
          onNavigate(`/section/${section.id}`);
        }
      }}
      className={`bg-white rounded-xl p-4 border text-right transition-all group relative overflow-hidden ${
        isComingSoon
          ? "border-dashed border-gray-300 opacity-75 cursor-default"
          : "border-gray-100 hover:border-gray-200 hover:shadow-sm cursor-pointer"
      }`}
    >
      {/* Coming soon badge */}
      {isComingSoon && (
        <div className="absolute top-2 left-2">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 text-amber-600 border border-amber-200">
            <Clock className="w-2.5 h-2.5" />
            قريباً
          </span>
        </div>
      )}

      {/* Section icon + title */}
      <div className="flex items-start gap-3 mb-2">
        <div
          className="w-10 h-10 rounded-lg flex items-center justify-center shrink-0"
          style={{ backgroundColor: section.color + "12" }}
        >
          <Icon className="w-5 h-5" style={{ color: section.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-bold text-gray-800 text-sm leading-snug mb-0.5 group-hover:text-gray-900 truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            {section.title}
          </h3>
          <p className="text-[11px] text-gray-500 leading-relaxed line-clamp-2">{section.description}</p>
        </div>
      </div>

      {/* Tags row */}
      <div className="flex items-center gap-1 flex-wrap">
        <span className="text-[9px] font-medium px-1.5 py-0.5 rounded-full" style={{ backgroundColor: section.color + "12", color: section.color }}>
          {section.services.length} خدمة
        </span>
        {interactiveServices > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-teal-50 text-teal-600">
            <Play className="w-2.5 h-2.5" />
            {interactiveServices} تفاعلي
          </span>
        )}
        {storeServices > 0 && (
          <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-1.5 py-0.5 rounded-full bg-pink-50 text-pink-600">
            <ShoppingBag className="w-2.5 h-2.5" />
            {storeServices}
          </span>
        )}
      </div>

      {/* Action indicator */}
      {!isComingSoon && route && (
        <div className="mt-2 pt-2 border-t border-gray-50 flex items-center gap-1 text-[10px] font-bold" style={{ color: section.color }}>
          <Zap className="w-3 h-3" />
          {section.hasInteractive ? "ابدأ الآن" : "تصفح المنتجات"}
          <ArrowLeft className="w-3 h-3 mr-auto transition-transform group-hover:-translate-x-1" />
        </div>
      )}
    </button>
  );
}

function QuickAccessCard({ route, title, icon, color, desc, onNavigate }: {
  route: string; title: string; icon: string; color: string; desc: string; onNavigate: (path: string) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(route)}
      className="bg-white rounded-lg p-3 border border-gray-100 text-right transition-all group hover:border-gray-200 hover:shadow-sm"
    >
      <div className="text-xl mb-1">{icon}</div>
      <h3 className="font-bold text-gray-800 text-xs mb-0.5 truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>{title}</h3>
      <p className="text-[9px] text-gray-500 leading-relaxed line-clamp-2">{desc}</p>
      <div className="mt-1.5 flex items-center gap-1 text-[9px] font-bold" style={{ color }}>
        <Zap className="w-2.5 h-2.5" />
        جاهز
      </div>
    </button>
  );
}

function SearchResults({ query, results, onNavigate }: {
  query: string; results: { section: Section; service: Service }[]; onNavigate: (path: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>
        نتائج البحث عن "{query}" ({results.length} نتيجة)
      </h2>
      {results.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500 font-medium">لا توجد نتائج مطابقة</p>
          <p className="text-sm text-gray-400 mt-1">جرّب كلمات بحث مختلفة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {results.map(({ section, service }) => {
            const route = section.route || INTERACTIVE_ROUTES[section.id];
            return (
              <div
                key={service.id}
                className="bg-white rounded-xl border border-gray-100 p-4 hover:border-gray-200 transition-all cursor-pointer relative"
                onClick={() => {
                  if (route && !service.comingSoon) {
                    onNavigate(route);
                  } else {
                    import("sonner").then(({ toast }) => {
                      toast.info(service.comingSoon ? "قريباً" : "تصفح القسم", { description: section.title });
                    });
                  }
                }}
              >
                <div className="absolute -top-1 -right-1 z-10">
                  <span className="text-[9px] px-2 py-0.5 rounded-full text-white font-medium" style={{ backgroundColor: section.color }}>
                    {section.title}
                  </span>
                </div>
                <h4 className="font-semibold text-gray-800 text-sm mt-2 mb-1">{service.title}</h4>
                <p className="text-xs text-gray-500 line-clamp-2 mb-2">{service.description}</p>
                <div className="flex items-center gap-2">
                  {service.mode === "interactive" || service.mode === "both" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 text-teal-700">
                      <Play className="w-3 h-3" /> تفاعلي
                    </span>
                  ) : null}
                  {service.mode === "store" || service.mode === "both" ? (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-50 text-pink-700">
                      <ShoppingBag className="w-3 h-3" /> متجر
                    </span>
                  ) : null}
                  {service.price > 0 ? (
                    <span className="text-[10px] font-bold text-orange-600">{service.price} ر.س</span>
                  ) : (
                    <span className="text-[10px] font-bold text-green-600">مجاني</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// Main Page
// ═══════════════════════════════════════════════════════════════

export default function Home() {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRole, setSelectedRole] = useState<UserRole>("all");
  const [, navigate] = useLocation();

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchServices(searchQuery);
  }, [searchQuery]);

  const filteredSections = useMemo(() => {
    return getSectionsByRole(selectedRole);
  }, [selectedRole]);

  const totalServices = getTotalServicesCount();
  const interactiveCount = getInteractiveCount();
  const storeCount = getStoreCount();
  const paidCount = getPaidCount();
  const freeCount = getFreeCount();

  const handleNavigate = useCallback((path: string) => {
    navigate(path);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">
      {/* القائمة الجانبية */}
      <AppSidebar currentPath="/" />

      {/* المحتوى الرئيسي - مع هامش للقائمة الجانبية */}
      <div className="lg:mr-72">
        {/* ═══ Top Navigation Bar ═══ */}
        <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-md border-b border-gray-100 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="flex items-center gap-3 h-14">
              {/* Spacer for mobile sidebar button */}
              <div className="w-10 lg:hidden shrink-0" />

              {/* Logo - hidden on desktop since sidebar shows it */}
              <div className="flex items-center gap-2 shrink-0 lg:hidden">
                <div className="w-7 h-7 rounded-lg bg-teal-600 flex items-center justify-center">
                  <Sparkles className="w-3.5 h-3.5 text-white" />
                </div>
                <div className="hidden sm:block">
                  <h1 className="text-sm font-bold text-gray-900 leading-none" style={{ fontFamily: "'Tajawal', sans-serif" }}>SERS</h1>
                  <p className="text-[8px] text-gray-500 leading-none mt-0.5">نظام السجلات التعليمية الذكي</p>
                </div>
              </div>

              {/* Search */}
              <div className="relative flex-1 max-w-lg">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ابحث في الخدمات..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pr-10 pl-4 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
                />
                {searchQuery && (
                  <button type="button" onClick={() => setSearchQuery("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                    <X className="w-4 h-4" />
                  </button>
                )}
              </div>

              {/* Stats badges */}
              <div className="hidden lg:flex items-center gap-2 text-xs text-gray-500">
                <span className="bg-teal-50 text-teal-700 px-2.5 py-1 rounded-full font-medium">{totalServices} خدمة</span>
                <span className="bg-gray-100 px-2.5 py-1 rounded-full">{sections.length} قسم</span>
              </div>
            </div>
          </div>
        </header>

        {/* ═══ Main Content ═══ */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Search results mode */}
          {searchQuery ? (
            <SearchResults query={searchQuery} results={searchResults} onNavigate={handleNavigate} />
          ) : (
            <>
              {/* ═══ Hero Section ═══ */}
              <div className="relative rounded-2xl overflow-hidden mb-6">
                <img src={HERO_BG} alt="" className="absolute inset-0 w-full h-full object-cover" />
                <div className="absolute inset-0 bg-gradient-to-l from-teal-900/90 via-teal-800/80 to-teal-700/60" />
                <div className="relative z-10 p-6 sm:p-8 md:p-10">
                  <div className="max-w-xl">
                    <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1 mb-3">
                      <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
                      <span className="text-white text-[10px] sm:text-xs font-medium">نظام السجلات التعليمية الذكي</span>
                    </div>
                    <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-2 leading-tight" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                      منصة شاملة لجميع
                      <span className="text-teal-200"> الخدمات التعليمية</span>
                    </h1>
                    <p className="text-white/80 text-xs sm:text-sm leading-relaxed max-w-md mb-4">
                      {sections.length} قسم رئيسي يضم {totalServices} خدمة تفاعلية وقوالب جاهزة مع دعم الذكاء الاصطناعي والباركودات التفاعلية وثيمات متعددة
                    </p>
                  </div>
                  {/* Stats in hero */}
                  <div className="flex flex-wrap gap-2 sm:gap-3">
                    <StatBadge value={interactiveCount} label="خدمة تفاعلية" icon={Play} color="#5EEAD4" />
                    <StatBadge value={storeCount} label="منتج رقمي" icon={ShoppingBag} color="#F9A8D4" />
                    <StatBadge value={freeCount} label="خدمة مجانية" icon={Star} color="#FDE047" />
                  </div>
                </div>
              </div>

              {/* ═══ Role Filter ═══ */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-gray-400" />
                  <span className="text-xs sm:text-sm font-medium text-gray-600">تصفية حسب الوظيفة:</span>
                </div>
                <RoleFilterBar selectedRole={selectedRole} onRoleChange={setSelectedRole} />
              </div>

              {/* ═══ Quick Access - Interactive Services ═══ */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-teal-600" />
                  <h2 className="text-base sm:text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    الخدمات التفاعلية الجاهزة
                  </h2>
                  <span className="text-[9px] bg-teal-50 text-teal-600 px-2 py-0.5 rounded-full font-medium">جاهزة الآن</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 sm:gap-3">
                  <QuickAccessCard route="/performance-evidence" title="شواهد الأداء الوظيفي" icon="📋" color="#059669" desc="فورم كامل → تصنيف ذكي AI → معاينة → PDF" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/certificates" title="صانع الشهادات" icon="🏆" color="#D97706" desc="6 أنواع × 5 ثيمات → معاينة → PDF" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/reports" title="مركز التقارير" icon="📝" color="#2563EB" desc="تقارير تربوية متنوعة → AI → PDF" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/school-radio" title="الإذاعة المدرسية" icon="📻" color="#DC2626" desc="إذاعات جاهزة → AI → طباعة" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/smart-cv" title="السيرة الذاتية" icon="👤" color="#7C3AED" desc="سيرة ذاتية احترافية → AI → PDF" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/exams" title="منصة الاختبارات" icon="📝" color="#EA580C" desc="بنك أسئلة → AI → PDF" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/portfolio" title="ملف الإنجاز" icon="📁" color="#0891B2" desc="ملف إنجاز رقمي شامل → AI → PDF" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/grade-analysis" title="تحليل النتائج" icon="📊" color="#2563EB" desc="إدخال درجات → رسوم بيانية → تقارير" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/covers" title="أغلفة وفواصل" icon="📁" color="#6366F1" desc="6 أنواع × 5 ألوان → PDF احترافي" onNavigate={handleNavigate} />
                  <QuickAccessCard route="/treatment-plans" title="الخطط العلاجية" icon="📝" color="#DC2626" desc="6 أنواع خطط → تخصيص → PDF" onNavigate={handleNavigate} />
                </div>
              </div>

              {/* ═══ All Sections Grid ═══ */}
              <div className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base sm:text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    {selectedRole === "all" ? "جميع الأقسام" : `أقسام ${USER_ROLES.find(r => r.id === selectedRole)?.label || ""}`}
                  </h2>
                  <span className="text-xs text-gray-500">{filteredSections.length} قسم</span>
                </div>
                <p className="text-xs text-gray-500 mb-4">
                  {selectedRole === "all"
                    ? `${sections.length} قسم رئيسي يغطي جميع احتياجات شاغلي الوظائف التعليمية`
                    : `الأقسام المتاحة لـ ${USER_ROLES.find(r => r.id === selectedRole)?.label || ""}`
                  }
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 mb-8">
                {filteredSections.map((section) => (
                  <SectionCard key={section.id} section={section} onNavigate={handleNavigate} />
                ))}
              </div>

              {/* ═══ Footer Summary ═══ */}
              <div className="bg-white rounded-xl p-6 border border-gray-100 text-center mb-4">
                <h3 className="text-lg font-bold text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                  {totalServices} خدمة في {sections.length} قسم
                </h3>
                <p className="text-xs text-gray-500 mb-3">
                  {freeCount} خدمة مجانية · {paidCount} منتج مدفوع · {interactiveCount} خدمة تفاعلية · {storeCount} منتج رقمي
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[
                    "نماذج تفاعلية حية", "تصنيف ذكي بالـ AI", "باركودات QR تلقائية",
                    "ثيمات متعددة للتصدير", "دعم جميع الوظائف التعليمية",
                    "متجر رقمي متكامل", "قابل للتعديل من الإدارة"
                  ].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] bg-teal-50 text-teal-700 border border-teal-200">{tag}</span>
                  ))}
                </div>
              </div>
            </>
          )}
        </main>
      </div>
    </div>
  );
}
