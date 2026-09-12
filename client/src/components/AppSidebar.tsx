import { useState } from "react";
import { useLocation } from "wouter";
import { Home, BriefcaseBusiness, Library, CheckSquare, ShoppingBag, Bell, UserRound, Menu, X, Sparkles, Settings2 } from "lucide-react";
import { PRODUCT_NAV_ITEMS, LEGACY_TOOLS_ENABLED, isProductRouteActive } from "@/config/productNavigation";

const iconMap = {
  home: Home,
  work: BriefcaseBusiness,
  evidence: Library,
  reviews: CheckSquare,
  store: ShoppingBag,
  notifications: Bell,
  account: UserRound,
};

interface AppSidebarProps { currentPath?: string; }

const legacyLinks = [
  { label: "مركز التقارير القديم", path: "/reports" },
  { label: "ملف الإنجاز القديم", path: "/portfolio" },
  { label: "الشهادات", path: "/certificates" },
  { label: "تحليل النتائج", path: "/grade-analysis" },
  { label: "الخطط العلاجية", path: "/treatment-plans" },
  { label: "الإذاعة المدرسية", path: "/school-radio" },
  { label: "السيرة الذاتية", path: "/smart-cv" },
  { label: "الاختبارات", path: "/exams" },
];

export default function AppSidebar({ currentPath }: AppSidebarProps) {
  const [location, navigate] = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const path = currentPath ?? location;
  const go = (target: string) => { navigate(target); setSidebarOpen(false); };

  const sidebarContent = (
    <div className="flex flex-col h-full" dir="rtl">
      <div className="p-4 border-b border-slate-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-600/20"><Sparkles className="w-5 h-5 text-white" /></div>
          <div className="min-w-0">
            <h1 className="text-base font-bold text-slate-950 leading-none" style={{ fontFamily: "'Tajawal', sans-serif" }}>SERS</h1>
            <p className="text-[10px] text-slate-500 mt-1 truncate">مساحة السجلات التعليمية الذكية</p>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="mr-auto lg:hidden p-1.5 rounded-lg hover:bg-slate-100" aria-label="إغلاق القائمة"><X className="w-4 h-4 text-slate-500" /></button>
        </div>
      </div>

      <div className="px-4 pt-4 pb-2">
        <p className="text-[10px] font-bold tracking-wide text-slate-400">مساحة العمل</p>
        <p className="text-xs text-slate-500 mt-1 leading-5">ابدأ بالنتيجة التي تريد إنجازها، وليس بقائمة أدوات.</p>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 pb-4">
        {PRODUCT_NAV_ITEMS.map((item) => {
          const Icon = iconMap[item.icon];
          const active = isProductRouteActive(path, item.path);
          return (
            <button key={item.path} onClick={() => go(item.path)} className={`w-full flex items-start gap-3 px-3 py-3 rounded-xl text-sm transition-colors mb-1 ${active ? "bg-teal-50 text-teal-800" : "text-slate-600 hover:bg-slate-50"}`}>
              <Icon className={`w-4.5 h-4.5 mt-0.5 shrink-0 ${active ? "text-teal-700" : "text-slate-400"}`} />
              <span className="min-w-0 flex-1 text-right">
                <span className={`block truncate ${active ? "font-bold" : "font-semibold"}`}>{item.label}</span>
                <span className="block text-[10px] text-slate-400 mt-0.5 leading-4 line-clamp-1">{item.description}</span>
              </span>
              {active && <span className="w-1.5 h-1.5 rounded-full bg-teal-500 mt-1.5 shrink-0" />}
            </button>
          );
        })}

        {LEGACY_TOOLS_ENABLED && (
          <div className="mt-5 pt-4 border-t border-slate-100">
            <div className="flex items-center gap-2 px-3 mb-2 text-[10px] font-bold text-slate-400"><Settings2 className="w-3.5 h-3.5" />أدوات قديمة — انتقالية</div>
            {legacyLinks.map((item) => (
              <button key={item.path} onClick={() => go(item.path)} className="w-full text-right px-3 py-2 rounded-lg text-xs text-slate-500 hover:bg-slate-50">{item.label}</button>
            ))}
          </div>
        )}
      </nav>

      <div className="p-3 border-t border-slate-100 bg-slate-50/60">
        <p className="text-[10px] text-slate-500 leading-4">النواة الجديدة: عمل → شاهد → نسخة → مراجعة → مخرج</p>
      </div>
    </div>
  );

  return (
    <>
      <button onClick={() => setSidebarOpen(true)} className="fixed top-2.5 right-3 z-50 lg:hidden bg-white/95 rounded-lg shadow-sm border border-slate-200 p-2" aria-label="فتح القائمة"><Menu className="w-5 h-5 text-slate-700" /></button>
      {sidebarOpen && <div className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-40 lg:hidden" onClick={() => setSidebarOpen(false)} />}
      <aside className={`fixed top-0 right-0 h-full w-72 bg-white border-l border-slate-200 z-50 transition-transform duration-300 overflow-hidden ${sidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}`}>{sidebarContent}</aside>
    </>
  );
}
