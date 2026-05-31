/**
 * شريط التنقل السفلي للموبايل - SERS
 * يظهر فقط على الشاشات الصغيرة (< lg)
 * يعرض 5 أقسام رئيسية + زر المزيد
 * مع تكامل السلة وتبديل اللغة
 */
import { useLocation } from "wouter";
import { useState } from "react";
import {
  Home, Award, FileText, BarChart3, Medal, Radio,
  GraduationCap, HeartPulse, ClipboardCheck, BookOpen,
  FolderOpen, ShoppingBag, Wrench, Lightbulb, X, ChevronUp,
  ShoppingCart, Heart, LogIn, Globe, UserCircle
} from "lucide-react";
import { useCartStore } from "@/stores/cartStore";
import { useAuth } from "@/_core/hooks/useAuth";

const iconMap: Record<string, React.ComponentType<any>> = {
  Home, Award, FileText, BarChart3, Medal, Radio,
  GraduationCap, HeartPulse, ClipboardCheck, BookOpen,
  FolderOpen, ShoppingBag, Wrench, Lightbulb,
  ShoppingCart, Heart, LogIn, Globe, UserCircle,
};

interface NavItem {
  label: string;
  icon: string;
  path: string;
  badge?: number;
}

// الأقسام الرئيسية الثابتة في الشريط السفلي
const mainItems: NavItem[] = [
  { label: "الرئيسية", icon: "Home", path: "/" },
  { label: "الشواهد", icon: "Award", path: "/performance-evidence" },
  { label: "التقارير", icon: "FileText", path: "/reports" },
  { label: "الشهادات", icon: "Medal", path: "/certificates" },
];

// باقي الأقسام في قائمة "المزيد"
const moreItems: NavItem[] = [
  { label: "ملف الإنجاز", icon: "FolderOpen", path: "/portfolio" },
  { label: "السيرة الذاتية", icon: "GraduationCap", path: "/smart-cv" },
  { label: "الخطط العلاجية", icon: "HeartPulse", path: "/treatment-plans" },
  { label: "الاختبارات", icon: "ClipboardCheck", path: "/exams" },
  { label: "تحليل النتائج", icon: "BarChart3", path: "/grade-analysis" },
  { label: "الإذاعة", icon: "Radio", path: "/school-radio" },
  { label: "الأغلفة", icon: "BookOpen", path: "/covers" },
  { label: "المتجر", icon: "ShoppingBag", path: "/store" },
  { label: "المفضلة", icon: "Heart", path: "/wishlist" },
  { label: "تسجيل الدخول", icon: "LogIn", path: "/login" },
];

export default function BottomNav() {
  const [location, navigate] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const cartCount = useCartStore(s => s.getItemCount());
  const { user } = useAuth();
  const isLoggedIn = !!user;

  // Filter moreItems based on login state
  const dynamicMoreItems: NavItem[] = [
    { label: "ملف الإنجاز", icon: "FolderOpen", path: "/portfolio" },
    { label: "السيرة الذاتية", icon: "GraduationCap", path: "/smart-cv" },
    { label: "الخطط العلاجية", icon: "HeartPulse", path: "/treatment-plans" },
    { label: "الاختبارات", icon: "ClipboardCheck", path: "/exams" },
    { label: "تحليل النتائج", icon: "BarChart3", path: "/grade-analysis" },
    { label: "الإذاعة", icon: "Radio", path: "/school-radio" },
    { label: "الأغلفة", icon: "BookOpen", path: "/covers" },
    { label: "المتجر", icon: "ShoppingBag", path: "/store" },
    ...(isLoggedIn ? [
      { label: "المفضلة", icon: "Heart", path: "/wishlist" },
      { label: "حسابي", icon: "UserCircle", path: "/dashboard" },
    ] : [
      { label: "تسجيل الدخول", icon: "LogIn", path: "/login" },
    ]),
  ];

  // لا تظهر في صفحات المعاينة الداخلية أو الدخول
  const hideOnPaths = ["/admin", "/shared-template", "/share/", "/login", "/register"];
  if (hideOnPaths.some(p => location.startsWith(p))) return null;

  const isActive = (path: string) => {
    if (path === "/") return location === "/";
    return location.startsWith(path);
  };

  return (
    <>
      {/* More menu overlay */}
      {showMore && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setShowMore(false)}
        />
      )}

      {/* More menu - bottom sheet */}
      {showMore && (
        <div className="fixed bottom-[68px] left-0 right-0 z-[61] lg:hidden animate-in slide-in-from-bottom-4 duration-200">
          <div className="mx-3 mb-2 bg-white rounded-2xl shadow-2xl border border-gray-200 overflow-hidden">
            <div className="p-3 border-b border-gray-100 flex items-center justify-between">
              <span className="text-xs font-bold text-gray-700" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                جميع الأقسام
              </span>
              <button
                onClick={() => setShowMore(false)}
                className="p-1 rounded-full hover:bg-gray-100"
              >
                <X className="w-4 h-4 text-gray-400" />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-1 p-3">
              {dynamicMoreItems.map((item) => {
                const Icon = iconMap[item.icon] || FileText;
                const active = isActive(item.path);
                return (
                  <button
                    key={item.path}
                    onClick={() => {
                      navigate(item.path);
                      setShowMore(false);
                    }}
                    style={{ touchAction: 'manipulation' }}
                    className={`flex flex-col items-center gap-1.5 p-3 rounded-xl transition-all active:scale-95 ${active
                        ? "bg-teal-50 text-teal-700"
                        : "text-gray-600 hover:bg-gray-50"
                      }`}
                  >
                    <Icon className="w-5 h-5" style={{ color: active ? "#0d9488" : "#6b7280" }} />
                    <span className="text-[10px] font-medium leading-tight text-center" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                      {item.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* Bottom navigation bar */}
      <nav
        className="fixed bottom-0 left-0 right-0 z-[59] lg:hidden bg-white/95 backdrop-blur-md border-t border-gray-200 safe-area-bottom"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <div className="flex items-center justify-around h-[60px] px-1">
          {mainItems.map((item) => {
            const Icon = iconMap[item.icon] || FileText;
            const active = isActive(item.path);
            return (
              <button
                key={item.path}
                onClick={() => {
                  navigate(item.path);
                  setShowMore(false);
                }}
                style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
                className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all relative active:scale-95 ${active ? "text-teal-600" : "text-gray-500"
                  }`}
              >
                {active && (
                  <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-500 rounded-full" />
                )}
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                <span
                  className={`text-[10px] leading-none ${active ? "font-bold" : "font-medium"}`}
                  style={{ fontFamily: "'Tajawal', sans-serif" }}
                >
                  {item.label}
                </span>
              </button>
            );
          })}

          {/* Cart button with badge */}
          <button
            onClick={() => navigate('/store')}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all relative active:scale-95 ${
              isActive('/store') ? "text-teal-600" : "text-gray-500"
            }`}
          >
            <div className="relative">
              <ShoppingCart className="w-5 h-5" strokeWidth={isActive('/store') ? 2.5 : 2} />
              {cartCount > 0 && (
                <span className="absolute -top-1.5 -right-2 min-w-[14px] h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center px-0.5">
                  {cartCount > 99 ? '99+' : cartCount}
                </span>
              )}
            </div>
            <span
              className={`text-[10px] leading-none ${isActive('/store') ? "font-bold" : "font-medium"}`}
              style={{ fontFamily: "'Tajawal', sans-serif" }}
            >
              المتجر
            </span>
          </button>

          {/* More button */}
          <button
            onClick={() => setShowMore(!showMore)}
            style={{ touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }}
            className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full transition-all active:scale-95 ${showMore ? "text-teal-600" : "text-gray-500"
              }`}
          >
            <ChevronUp className={`w-5 h-5 transition-transform duration-200 ${showMore ? "rotate-180" : ""}`} />
            <span
              className="text-[10px] leading-none font-medium"
              style={{ fontFamily: "'Tajawal', sans-serif" }}
            >
              المزيد
            </span>
          </button>
        </div>
      </nav>
    </>
  );
}
