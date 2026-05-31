/**
 * القائمة الجانبية الرئيسية لمنصة SERS
 * قائمة واحدة منظمة بدون تكرار
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  Search, X, Sparkles, ShoppingBag, Menu, Home, Clock, UserCircle
} from "lucide-react";
import { sections, getTotalServicesCount } from "@/lib/data";

const iconMap: Record<string, React.ComponentType<any>> = {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  ShoppingBag, UserCircle,
};

interface AppSidebarProps {
  currentPath?: string;
}

export default function AppSidebar({ currentPath }: AppSidebarProps) {
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) => s.title.includes(q) || s.description.includes(q) ||
        s.services.some((svc) => svc.title.includes(q))
    );
  }, [searchQuery]);

  const totalServices = getTotalServicesCount();

  const handleNav = (path: string) => {
    navigate(path);
    setSidebarOpen(false);
  };

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="p-4 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-600/20">
            <Sparkles className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-gray-900 leading-none" style={{ fontFamily: "'Tajawal', sans-serif" }}>SERS</h1>
            <p className="text-[9px] text-gray-500 leading-none mt-0.5">نظام السجلات التعليمية الذكي</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="mr-auto lg:hidden p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="p-3">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            type="text"
            placeholder="بحث سريع..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pr-9 pl-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 transition-all"
          />
          {searchQuery && (
            <button onClick={() => setSearchQuery("")} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {/* Home link */}
        <button
          onClick={() => handleNav("/")}
          className={`w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm transition-all mb-1 ${
            currentPath === "/"
              ? "bg-teal-50 text-teal-700 font-semibold"
              : "text-gray-600 hover:bg-gray-50"
          }`}
        >
          <Home className="w-4 h-4 shrink-0" style={{ color: currentPath === "/" ? "#0d9488" : undefined }} />
          <span className="truncate text-right flex-1">الرئيسية</span>
          {currentPath === "/" && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
        </button>

        {/* Divider */}
        <div className="mt-2 mb-1.5 px-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            الأقسام ({filteredSections.length})
          </span>
        </div>

        {/* Sections list - single unified list */}
        {filteredSections.map((section) => {
          const Icon = iconMap[section.icon] || FileText;
          const route = section.route;
          const isActive = currentPath === route;
          const isComingSoon = section.comingSoon;

          return (
            <button
              key={section.id}
              onClick={() => {
                if (isComingSoon) {
                  import("sonner").then(({ toast }) => {
                    toast.info("قريباً إن شاء الله", { description: "هذا القسم قيد التطوير" });
                  });
                  return;
                }
                if (route) {
                  handleNav(route);
                } else {
                  handleNav(`/section/${section.id}`);
                }
              }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all mb-0.5 ${
                isActive
                  ? "bg-teal-50 text-teal-700 font-semibold"
                  : isComingSoon
                    ? "text-gray-400 cursor-default"
                    : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? section.color : isComingSoon ? "#9ca3af" : section.color + "99" }} />
              <span className="truncate flex-1 text-right">{section.title}</span>
              <div className="flex items-center gap-1">
                {isComingSoon && <Clock className="w-3 h-3 text-amber-400" />}
                {route && !isComingSoon && <Zap className="w-3 h-3 text-teal-500" />}
                <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{section.services.length}</span>
              </div>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-teal-500 shrink-0" />}
            </button>
          );
        })}
      </nav>

      {/* Footer stats */}
      <div className="p-3 border-t border-gray-100 bg-gray-50/50">
        <div className="flex items-center justify-between text-[10px] text-gray-500">
          <span>{totalServices} خدمة</span>
          <span>{sections.length} قسم</span>
          <span className="text-teal-600 font-medium">SERS v2.0</span>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile toggle button */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-2.5 right-3 z-50 lg:hidden bg-white/90 backdrop-blur-sm rounded-lg shadow-sm border border-gray-200 p-2 hover:bg-gray-50 transition-all"
        aria-label="فتح القائمة"
      >
        <Menu className="w-5 h-5 text-gray-700" />
      </button>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/30 backdrop-blur-sm z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed top-0 right-0 h-full w-72 bg-white border-l border-gray-200 z-50 transition-transform duration-300 overflow-hidden ${
          sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
