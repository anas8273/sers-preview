/**
 * القائمة الجانبية الرئيسية لمنصة SERS
 * تنقل بين الأقسام + بحث + إحصائيات
 */
import { useState, useMemo } from "react";
import { useLocation } from "wouter";
import {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  Search, X, Sparkles, ShoppingBag, Menu, Home, Clock
} from "lucide-react";
import { sections, getTotalServicesCount, type Section } from "@/lib/data";

const iconMap: Record<string, React.ComponentType<any>> = {
  Award, FolderOpen, FileText, BarChart3, TrendingUp, HeartPulse,
  CalendarDays, ClipboardCheck, Medal, GraduationCap, BookOpen,
  Radio, Table2, Lightbulb, Users, Presentation, Zap, Wrench, Mail,
  ShoppingBag,
};

const INTERACTIVE_ROUTES: Record<string, string> = {
  "1": "/performance-evidence",
  "4": "/certificates",
  "6": "/treatment-plans",
  "8": "/grade-analysis",
  "13": "/covers",
};

interface AppSidebarProps {
  currentPath?: string;
}

export default function AppSidebar({ currentPath }: AppSidebarProps) {
  const [, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  const filteredSections = useMemo(() => {
    if (!searchQuery.trim()) return sections;
    const q = searchQuery.toLowerCase();
    return sections.filter(
      (s) => s.title.includes(q) || s.description.includes(q) ||
        s.services.some((svc) => svc.title.includes(q))
    );
  }, [searchQuery]);

  const totalServices = getTotalServicesCount();

  const quickLinks = [
    { path: "/", label: "الرئيسية", icon: Home, color: "#0d9488" },
    { path: "/performance-evidence", label: "شواهد الأداء", icon: ClipboardCheck, color: "#059669" },
    { path: "/reports", label: "مركز التقارير", icon: FileText, color: "#2563eb" },
    { path: "/school-radio", label: "الإذاعة المدرسية", icon: Radio, color: "#dc2626" },
    { path: "/smart-cv", label: "السيرة الذاتية", icon: Users, color: "#7c3aed" },
    { path: "/exams", label: "منصة الاختبارات", icon: ClipboardCheck, color: "#ea580c" },
    { path: "/portfolio", label: "ملف الإنجاز", icon: FolderOpen, color: "#0891b2" },
    { path: "/certificates", label: "صانع الشهادات", icon: Award, color: "#d97706" },
    { path: "/grade-analysis", label: "تحليل النتائج", icon: BarChart3, color: "#2563eb" },
    { path: "/covers", label: "أغلفة وفواصل", icon: FolderOpen, color: "#6366f1" },
    { path: "/treatment-plans", label: "الخطط العلاجية", icon: HeartPulse, color: "#dc2626" },
    { path: "/store", label: "المتجر الرقمي", icon: ShoppingBag, color: "#ec4899" },
  ];

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

      {/* Quick Links */}
      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="mb-1 px-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">الخدمات التفاعلية</span>
        </div>
        {quickLinks.map((link) => {
          const Icon = link.icon;
          const isActive = currentPath === link.path;
          return (
            <button
              key={link.path}
              onClick={() => { navigate(link.path); setSidebarOpen(false); }}
              className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all mb-0.5 ${
                isActive
                  ? "bg-teal-50 text-teal-700 font-semibold"
                  : "text-gray-600 hover:bg-gray-50"
              }`}
            >
              <Icon className="w-4 h-4 shrink-0" style={{ color: isActive ? link.color : undefined }} />
              <span className="truncate text-right flex-1">{link.label}</span>
              {isActive && <div className="w-1.5 h-1.5 rounded-full bg-teal-500" />}
            </button>
          );
        })}

        {/* Sections */}
        <div className="mt-4 mb-1 px-2">
          <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">الأقسام ({filteredSections.length})</span>
        </div>
        {filteredSections.map((section) => {
          const Icon = iconMap[section.icon] || FileText;
          const route = section.route || INTERACTIVE_ROUTES[section.id];
          const isExpanded = expandedGroup === section.id;
          return (
            <div key={section.id} className="mb-0.5">
              <button
                onClick={() => {
                  if (route) {
                    navigate(route);
                    setSidebarOpen(false);
                  } else {
                    setExpandedGroup(isExpanded ? null : section.id);
                  }
                }}
                className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-xs transition-all text-gray-600 hover:bg-gray-50"
              >
                <Icon className="w-3.5 h-3.5 shrink-0" style={{ color: section.color }} />
                <span className="truncate flex-1 text-right">{section.title}</span>
                <div className="flex items-center gap-1">
                  {route && <Zap className="w-3 h-3 text-teal-500" />}
                  {section.comingSoon && <Clock className="w-3 h-3 text-amber-500" />}
                  <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded-full">{section.services.length}</span>
                </div>
              </button>
              {isExpanded && (
                <div className="mr-6 mt-1 mb-2 space-y-0.5">
                  {section.services.slice(0, 8).map((svc) => (
                    <div
                      key={svc.id}
                      className="text-[11px] text-gray-500 py-1 px-2 rounded hover:bg-gray-50 cursor-pointer truncate"
                      onClick={() => {
                        if (route) { navigate(route); setSidebarOpen(false); }
                      }}
                    >
                      {svc.title}
                    </div>
                  ))}
                  {section.services.length > 8 && (
                    <div className="text-[10px] text-gray-400 px-2">+{section.services.length - 8} خدمة أخرى</div>
                  )}
                </div>
              )}
            </div>
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
        className="fixed top-3 right-3 z-50 lg:hidden bg-white rounded-xl shadow-lg border border-gray-200 p-2.5 hover:bg-gray-50 transition-all"
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
