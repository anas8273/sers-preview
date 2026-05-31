/**
 * SERS Platform - الصفحة الرئيسية (v2 Store-Like)
 * تصميم متجر حديث مع glassmorphism + micro-animations
 * يتضمن: dark/light toggle, language switcher, cart, login, search
 */
import { useState, useMemo, useCallback } from "react";
import { useLocation } from "wouter";
import { useTranslation } from "react-i18next";
import {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  Search, X, Sparkles, ShoppingBag, UserCircle,
  Globe, ShoppingCart, Eye, ArrowLeft,
  LayoutGrid, Building2, HeartHandshake, Trophy, Baby, Accessibility,
  Clock, Star, Filter, Play, Moon, Sun, LogIn, Heart, ChevronRight,
  LayoutDashboard, LogOut, Settings, ChevronDown,
} from "lucide-react";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  sections, getTotalServicesCount, getInteractiveCount, getPaidCount, getFreeCount,
  getStoreCount, searchServices, getSectionsByRole,
  USER_ROLES, type Section, type Service, type UserRole
} from "@/lib/data";
import AppSidebar from "@/components/AppSidebar";
import { useTheme } from "@/contexts/ThemeContext";
import { useCartStore } from "@/stores/cartStore";
import { useWishlistStore } from "@/stores/wishlistStore";

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

// خريطة الأقسام التي لها صفحات تفاعلية مبنية
const INTERACTIVE_ROUTES: Record<string, string> = {
  "1": "/performance-evidence",
  "4": "/certificates",
  "6": "/treatment-plans",
  "8": "/grade-analysis",
  "13": "/covers",
};

// ═══════════════════════════════════════════════════════════════
// Sub-Components
// ═══════════════════════════════════════════════════════════════

function TopNavBar({
  searchQuery,
  onSearch,
  cartCount,
  wishlistCount,
  onNavigate,
  user,
  isAdmin,
  onLogout,
}: {
  searchQuery: string;
  onSearch: (q: string) => void;
  cartCount: number;
  wishlistCount: number;
  onNavigate: (p: string) => void;
  user: any;
  isAdmin: boolean;
  onLogout: () => void;
}) {
  const { theme, toggleTheme } = useTheme();
  const { i18n } = useTranslation();
  const isDark = theme === "dark";
  const isAr = i18n.language === "ar";
  const [showProfileMenu, setShowProfileMenu] = useState(false);

  return (
    <header className="sticky top-0 z-30 bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border-b border-gray-200/50 dark:border-gray-700/50 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center gap-3 h-14">
          {/* Spacer for mobile sidebar */}
          <div className="w-10 lg:hidden shrink-0" />

          {/* Logo */}
          <div className="flex items-center gap-2 shrink-0 lg:hidden">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center shadow-lg shadow-teal-500/20">
              <Sparkles className="w-4 h-4 text-white" />
            </div>
            <div className="hidden sm:block">
              <h1 className="text-sm font-black text-gray-900 dark:text-white leading-none" style={{ fontFamily: "'Tajawal', sans-serif" }}>SERS</h1>
              <p className="text-[8px] text-gray-500 dark:text-gray-400 leading-none mt-0.5">نظام السجلات الذكي</p>
            </div>
          </div>

          {/* Search */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 dark:text-gray-500" />
            <input
              type="text"
              placeholder="ابحث في الخدمات..."
              value={searchQuery}
              onChange={(e) => onSearch(e.target.value)}
              className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 text-sm text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-teal-500/30 focus:border-teal-400 transition-all"
            />
            {searchQuery && (
              <button type="button" onClick={() => onSearch("")} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300">
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1">
            {/* Language toggle */}
            <button
              onClick={() => i18n.changeLanguage(isAr ? "en" : "ar")}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title="تبديل اللغة"
            >
              <Globe className="w-4 h-4" />
            </button>

            {/* Dark / Light toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              title={isDark ? "الوضع الفاتح" : "الوضع الداكن"}
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4" />}
            </button>

            {/* Wishlist — only for logged-in */}
            {user && (
              <button
                onClick={() => onNavigate("/wishlist")}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                title="المفضلة"
              >
                <Heart className="w-4 h-4" />
                {wishlistCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-pink-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {wishlistCount}
                  </span>
                )}
              </button>
            )}

            {/* Cart — only for logged-in */}
            {user && (
              <button
                onClick={() => onNavigate("/store")}
                className="p-2 rounded-xl text-gray-500 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors relative"
                title="السلة"
              >
                <ShoppingCart className="w-4 h-4" />
                {cartCount > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                    {cartCount > 99 ? "99+" : cartCount}
                  </span>
                )}
              </button>
            )}

            {/* Login — only for guests */}
            {!user && (
              <button
                onClick={() => onNavigate("/login")}
                className="flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-teal-600 hover:bg-teal-700 text-white text-xs font-medium transition-colors shadow-md shadow-teal-600/20"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">دخول</span>
              </button>
            )}

            {/* Profile — only for logged-in */}
            {user && (
              <div className="relative">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center gap-1.5 px-2 sm:px-2.5 py-1.5 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
                >
                  <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white text-[10px] font-bold shadow-sm">
                    {(user.name || "U").charAt(0)}
                  </div>
                  <span className="hidden sm:block text-xs font-medium text-gray-700 dark:text-gray-300 max-w-[80px] truncate">{user.name || "حسابي"}</span>
                  <ChevronDown className="w-3 h-3 text-gray-400 hidden sm:block" />
                </button>

                {showProfileMenu && (
                  <>
                    <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)} />
                    <div className="absolute left-0 sm:right-0 sm:left-auto top-full mt-1 w-56 bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 py-2 z-50" style={{ animation: 'fadeInUp 0.15s ease-out' }}>
                      <div className="px-3 py-2 border-b border-gray-100 dark:border-gray-700">
                        <p className="text-sm font-bold text-gray-900 dark:text-white truncate">{user.name}</p>
                        <p className="text-[10px] text-gray-500 dark:text-gray-400 truncate" dir="ltr">{user.email}</p>
                        {isAdmin && (
                          <span className="inline-flex items-center gap-1 mt-1 px-2 py-0.5 bg-teal-100 dark:bg-teal-900/40 text-teal-700 dark:text-teal-300 text-[9px] font-bold rounded-full">
                            <Settings className="w-2.5 h-2.5" />مدير النظام
                          </span>
                        )}
                      </div>
                      <button onClick={() => { setShowProfileMenu(false); onNavigate('/dashboard'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700/50 transition-colors">
                        <UserCircle className="w-4 h-4" />لوحة المستخدم
                      </button>
                      {isAdmin && (
                        <button onClick={() => { setShowProfileMenu(false); onNavigate('/admin'); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-teal-600 dark:text-teal-400 hover:bg-teal-50 dark:hover:bg-teal-900/20 transition-colors">
                          <LayoutDashboard className="w-4 h-4" />لوحة تحكم الإدارة
                        </button>
                      )}
                      <div className="border-t border-gray-100 dark:border-gray-700 mt-1 pt-1">
                        <button onClick={() => { setShowProfileMenu(false); onLogout(); }} className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 transition-colors">
                          <LogOut className="w-4 h-4" />تسجيل الخروج
                        </button>
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}

function HeroSection({ totalServices, interactiveCount, storeCount, freeCount }: {
  totalServices: number; interactiveCount: number; storeCount: number; freeCount: number;
}) {
  return (
    <div className="relative rounded-2xl overflow-hidden mb-6 group">
      {/* Animated gradient background */}
      <div className="absolute inset-0 bg-gradient-to-br from-teal-600 via-cyan-600 to-teal-800 dark:from-teal-900 dark:via-cyan-900 dark:to-gray-900" />
      <div className="absolute inset-0 opacity-20">
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 20% 50%, rgba(255,255,255,0.15) 0%, transparent 50%), 
                           radial-gradient(circle at 80% 20%, rgba(255,255,255,0.1) 0%, transparent 40%),
                           radial-gradient(circle at 50% 80%, rgba(255,255,255,0.08) 0%, transparent 40%)`,
        }} />
      </div>

      {/* Floating shapes */}
      <div className="absolute top-8 left-8 w-20 h-20 rounded-full bg-white/5 blur-xl animate-pulse" />
      <div className="absolute bottom-6 right-12 w-32 h-32 rounded-full bg-teal-300/10 blur-2xl" style={{ animation: 'pulse 3s infinite' }} />

      <div className="relative z-10 p-6 sm:p-8 md:p-10 lg:p-12">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          {/* Text */}
          <div className="max-w-xl">
            <div className="inline-flex items-center gap-1.5 bg-white/15 backdrop-blur-sm rounded-full px-3 py-1.5 mb-4">
              <Sparkles className="w-3.5 h-3.5 text-yellow-300" />
              <span className="text-white text-[10px] sm:text-xs font-medium">SERS — نظام السجلات التعليمية الذكي</span>
            </div>
            <h1 className="text-2xl sm:text-3xl md:text-4xl font-black text-white mb-3 leading-tight" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              منصة شاملة لجميع
              <span className="bg-gradient-to-l from-teal-200 to-cyan-200 bg-clip-text text-transparent"> الخدمات التعليمية</span>
            </h1>
            <p className="text-white/70 text-xs sm:text-sm leading-relaxed max-w-md mb-5">
              {sections.length} قسم رئيسي يضم {totalServices} خدمة تفاعلية وقوالب جاهزة مع دعم الذكاء الاصطناعي والثيمات المتعددة
            </p>

            {/* CTA Buttons */}
            <div className="flex flex-wrap gap-2">
              <a href="#sections" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white text-teal-700 rounded-xl text-sm font-bold shadow-lg shadow-black/10 hover:shadow-xl transition-all hover:-translate-y-0.5">
                <Eye className="w-4 h-4" />
                تصفح الأقسام
              </a>
              <a href="/store" className="inline-flex items-center gap-2 px-5 py-2.5 bg-white/10 backdrop-blur text-white border border-white/20 rounded-xl text-sm font-medium hover:bg-white/20 transition-all">
                <ShoppingBag className="w-4 h-4" />
                المتجر
              </a>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-2 gap-2 sm:gap-3 lg:min-w-[280px]">
            {[
              { value: interactiveCount, label: "خدمة تفاعلية", icon: Play, gradient: "from-teal-400/20 to-teal-300/10", iconColor: "#5EEAD4" },
              { value: storeCount, label: "منتج رقمي", icon: ShoppingBag, gradient: "from-pink-400/20 to-pink-300/10", iconColor: "#F9A8D4" },
              { value: freeCount, label: "مجاني", icon: Star, gradient: "from-yellow-400/20 to-yellow-300/10", iconColor: "#FDE047" },
              { value: sections.length, label: "قسم رئيسي", icon: LayoutGrid, gradient: "from-blue-400/20 to-blue-300/10", iconColor: "#93C5FD" },
            ].map(({ value, label, icon: Icon, gradient, iconColor }) => (
              <div key={label} className={`bg-gradient-to-br ${gradient} backdrop-blur-sm border border-white/10 rounded-xl p-3 sm:p-4`}>
                <Icon className="w-5 h-5 mb-2" style={{ color: iconColor }} />
                <div className="text-lg sm:text-xl font-black text-white leading-none">{value}</div>
                <div className="text-[10px] text-white/60 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        </div>
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
            style={{ touchAction: 'manipulation' }}
            className={`flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium whitespace-nowrap transition-all shrink-0 active:scale-95 ${isActive
                ? "bg-teal-600 text-white shadow-md shadow-teal-600/25"
                : "bg-white dark:bg-gray-800 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 border border-gray-200 dark:border-gray-700"
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
        if (route) { onNavigate(route); } else { onNavigate(`/section/${section.id}`); }
      }}
      style={{ touchAction: 'manipulation' }}
      className={`bg-white dark:bg-gray-800 rounded-2xl p-4 border text-right transition-all group relative overflow-hidden active:scale-[0.98] hover:-translate-y-0.5 ${isComingSoon
          ? "border-dashed border-gray-300 dark:border-gray-600 opacity-75 cursor-default"
          : "border-gray-100 dark:border-gray-700 hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-lg cursor-pointer"
        }`}
    >
      {/* Hover gradient effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-transparent via-transparent to-teal-50/50 dark:to-teal-900/20 opacity-0 group-hover:opacity-100 transition-opacity rounded-2xl" />

      {/* Coming soon badge */}
      {isComingSoon && (
        <div className="absolute top-2 left-2 z-10">
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-amber-50 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400 border border-amber-200 dark:border-amber-700">
            <Clock className="w-2.5 h-2.5" />
            قريباً
          </span>
        </div>
      )}

      {/* Content */}
      <div className="relative z-10">
        {/* Icon + title */}
        <div className="flex items-start gap-3 mb-3">
          <div
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 shadow-sm"
            style={{ backgroundColor: section.color + "15" }}
          >
            <Icon className="w-5 h-5" style={{ color: section.color }} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 text-sm leading-snug mb-0.5 group-hover:text-gray-900 dark:group-hover:text-white truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              {section.title}
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{section.description}</p>
          </div>
        </div>

        {/* Tags row */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full" style={{ backgroundColor: section.color + "12", color: section.color }}>
            {section.services.length} خدمة
          </span>
          {interactiveServices > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-2 py-0.5 rounded-full bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400">
              <Play className="w-2.5 h-2.5" />
              {interactiveServices} تفاعلي
            </span>
          )}
          {storeServices > 0 && (
            <span className="inline-flex items-center gap-0.5 text-[9px] font-medium px-2 py-0.5 rounded-full bg-pink-50 dark:bg-pink-900/30 text-pink-600 dark:text-pink-400">
              <ShoppingBag className="w-2.5 h-2.5" />
              {storeServices}
            </span>
          )}
        </div>

        {/* Action indicator */}
        {!isComingSoon && route && (
          <div className="mt-3 pt-3 border-t border-gray-50 dark:border-gray-700 flex items-center gap-1 text-[10px] font-bold" style={{ color: section.color }}>
            <Zap className="w-3 h-3" />
            {section.hasInteractive ? "ابدأ الآن" : "تصفح المنتجات"}
            <ArrowLeft className="w-3 h-3 mr-auto transition-transform group-hover:-translate-x-1" />
          </div>
        )}
      </div>
    </button>
  );
}

function QuickAccessCard({ route, title, icon, color, desc, onNavigate }: {
  route: string; title: string; icon: string; color: string; desc: string; onNavigate: (path: string) => void;
}) {
  return (
    <button
      onClick={() => onNavigate(route)}
      style={{ touchAction: 'manipulation' }}
      className="bg-white dark:bg-gray-800 rounded-xl p-3.5 border border-gray-100 dark:border-gray-700 text-right transition-all group hover:border-gray-200 dark:hover:border-gray-600 hover:shadow-lg hover:-translate-y-0.5 active:scale-[0.98]"
    >
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-bold text-gray-800 dark:text-gray-100 text-xs mb-0.5 truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>{title}</h3>
      <p className="text-[9px] text-gray-500 dark:text-gray-400 leading-relaxed line-clamp-2">{desc}</p>
      <div className="mt-2 flex items-center gap-1 text-[9px] font-bold" style={{ color }}>
        <Zap className="w-2.5 h-2.5" />
        جاهز
        <ChevronRight className="w-2.5 h-2.5 mr-auto transition-transform group-hover:-translate-x-0.5" />
      </div>
    </button>
  );
}

function SearchResults({ query, results, onNavigate }: {
  query: string; results: { section: Section; service: Service }[]; onNavigate: (path: string) => void;
}) {
  return (
    <div>
      <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>
        نتائج البحث عن "{query}" ({results.length} نتيجة)
      </h2>
      {results.length === 0 ? (
        <div className="text-center py-16">
          <Search className="w-12 h-12 text-gray-300 dark:text-gray-600 mx-auto mb-4" />
          <p className="text-gray-500 dark:text-gray-400 font-medium">لا توجد نتائج مطابقة</p>
          <p className="text-sm text-gray-400 dark:text-gray-500 mt-1">جرّب كلمات بحث مختلفة</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
          {results.map(({ section, service }) => {
            const route = section.route || INTERACTIVE_ROUTES[section.id];
            return (
              <div
                key={service.id}
                className="bg-white dark:bg-gray-800 rounded-xl border border-gray-100 dark:border-gray-700 p-4 hover:border-gray-200 dark:hover:border-gray-600 transition-all cursor-pointer relative hover:shadow-lg"
                onClick={() => {
                  if (route && !service.comingSoon) { onNavigate(route); }
                  else {
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
                <h4 className="font-semibold text-gray-800 dark:text-gray-100 text-sm mt-2 mb-1">{service.title}</h4>
                <p className="text-xs text-gray-500 dark:text-gray-400 line-clamp-2 mb-2">{service.description}</p>
                <div className="flex items-center gap-2">
                  {(service.mode === "interactive" || service.mode === "both") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400">
                      <Play className="w-3 h-3" /> تفاعلي
                    </span>
                  )}
                  {(service.mode === "store" || service.mode === "both") && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-pink-50 dark:bg-pink-900/30 text-pink-700 dark:text-pink-400">
                      <ShoppingBag className="w-3 h-3" /> متجر
                    </span>
                  )}
                  {service.price > 0 ? (
                    <span className="text-[10px] font-bold text-orange-600 dark:text-orange-400">{service.price} ر.س</span>
                  ) : (
                    <span className="text-[10px] font-bold text-green-600 dark:text-green-400">مجاني</span>
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
  const cartCount = useCartStore(s => s.getItemCount());
  const wishlistCount = useWishlistStore(s => s.items.length);
  const { user, isAuthenticated, logout } = useAuth();
  const isAdmin = user?.role === "admin";

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

  const handleLogout = useCallback(async () => {
    await logout();
    navigate('/');
  }, [logout, navigate]);

  return (
    <div className="min-h-screen bg-[#F8FAFC] dark:bg-gray-950 pb-20 lg:pb-0 transition-colors" dir="rtl">
      {/* القائمة الجانبية */}
      <AppSidebar currentPath="/" />

      {/* المحتوى الرئيسي */}
      <div className="lg:mr-72">
        {/* Nav Bar */}
        <TopNavBar
          searchQuery={searchQuery}
          onSearch={setSearchQuery}
          cartCount={cartCount}
          wishlistCount={wishlistCount}
          onNavigate={handleNavigate}
          user={user}
          isAdmin={isAdmin}
          onLogout={handleLogout}
        />

        {/* Main Content */}
        <main className="max-w-7xl mx-auto px-4 sm:px-6 py-4 sm:py-6">
          {/* Search results mode */}
          {searchQuery ? (
            <SearchResults query={searchQuery} results={searchResults} onNavigate={handleNavigate} />
          ) : (
            <>
              {/* Hero Section */}
              <HeroSection
                totalServices={totalServices}
                interactiveCount={interactiveCount}
                storeCount={storeCount}
                freeCount={freeCount}
              />

              {/* Role Filter */}
              <div className="mb-5">
                <div className="flex items-center gap-2 mb-2">
                  <Filter className="w-4 h-4 text-gray-400 dark:text-gray-500" />
                  <span className="text-xs sm:text-sm font-medium text-gray-600 dark:text-gray-400">تصفية حسب الوظيفة:</span>
                </div>
                <RoleFilterBar selectedRole={selectedRole} onRoleChange={setSelectedRole} />
              </div>

              {/* Quick Access */}
              <div className="mb-6">
                <div className="flex items-center gap-2 mb-3">
                  <Zap className="w-4 h-4 text-teal-600" />
                  <h2 className="text-base sm:text-lg font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    الخدمات التفاعلية الجاهزة
                  </h2>
                  <span className="text-[9px] bg-teal-50 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400 px-2 py-0.5 rounded-full font-medium">جاهزة الآن</span>
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

              {/* All Sections Grid */}
              <div id="sections" className="mb-3">
                <div className="flex items-center justify-between mb-1">
                  <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    {selectedRole === "all" ? "جميع الأقسام" : `أقسام ${USER_ROLES.find(r => r.id === selectedRole)?.label || ""}`}
                  </h2>
                  <span className="text-xs text-gray-500 dark:text-gray-400">{filteredSections.length} قسم</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-4">
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

              {/* Footer Summary */}
              <div className="bg-white dark:bg-gray-800 rounded-2xl p-6 border border-gray-100 dark:border-gray-700 text-center mb-4 shadow-sm">
                <div className="w-12 h-12 bg-gradient-to-br from-teal-100 to-cyan-100 dark:from-teal-900/50 dark:to-cyan-900/50 rounded-2xl flex items-center justify-center mx-auto mb-3">
                  <Sparkles className="w-6 h-6 text-teal-600 dark:text-teal-400" />
                </div>
                <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                  {totalServices} خدمة في {sections.length} قسم
                </h3>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                  {freeCount} خدمة مجانية · {paidCount} منتج مدفوع · {interactiveCount} خدمة تفاعلية · {storeCount} منتج رقمي
                </p>
                <div className="flex flex-wrap justify-center gap-1.5">
                  {[
                    "نماذج تفاعلية حية", "تصنيف ذكي بالـ AI", "باركودات QR تلقائية",
                    "ثيمات متعددة للتصدير", "دعم جميع الوظائف التعليمية",
                    "متجر رقمي متكامل", "قابل للتعديل من الإدارة"
                  ].map((tag) => (
                    <span key={tag} className="px-2.5 py-1 rounded-full text-[10px] bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-400 border border-teal-200 dark:border-teal-800">{tag}</span>
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
