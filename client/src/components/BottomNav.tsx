import { useLocation } from "wouter";
import { useState } from "react";
import { Home, BriefcaseBusiness, Library, CheckSquare, ShoppingBag, Bell, UserRound, MoreHorizontal, X } from "lucide-react";
import { PRODUCT_NAV_ITEMS, isProductRouteActive } from "@/config/productNavigation";

const iconMap = {
  home: Home,
  work: BriefcaseBusiness,
  evidence: Library,
  reviews: CheckSquare,
  store: ShoppingBag,
  notifications: Bell,
  account: UserRound,
};

const primaryPaths = ["/", "/work", "/evidence", "/reviews"];

export default function BottomNav() {
  const [location, navigate] = useLocation();
  const [showMore, setShowMore] = useState(false);
  const hideOnPaths = ["/admin", "/shared-template", "/share/", "/exam/"];
  if (hideOnPaths.some((p) => location.startsWith(p))) return null;

  const primary = PRODUCT_NAV_ITEMS.filter((item) => primaryPaths.includes(item.path));
  const more = PRODUCT_NAV_ITEMS.filter((item) => !primaryPaths.includes(item.path));

  return (
    <>
      {showMore && <div className="fixed inset-0 bg-slate-950/30 backdrop-blur-sm z-[60] lg:hidden" onClick={() => setShowMore(false)} />}
      {showMore && (
        <div className="fixed bottom-[68px] left-0 right-0 z-[61] lg:hidden px-3 pb-2" dir="rtl">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
              <div>
                <p className="text-xs font-bold text-slate-900">مساحة SERS</p>
                <p className="text-[10px] text-slate-500 mt-0.5">انتقل حسب المهمة، لا حسب الأداة</p>
              </div>
              <button onClick={() => setShowMore(false)} className="p-1.5 rounded-lg hover:bg-slate-100" aria-label="إغلاق"><X className="w-4 h-4 text-slate-500" /></button>
            </div>
            <div className="grid grid-cols-3 gap-2 p-3">
              {more.map((item) => {
                const Icon = iconMap[item.icon];
                const active = isProductRouteActive(location, item.path);
                return (
                  <button key={item.path} onClick={() => { navigate(item.path); setShowMore(false); }} className={`flex flex-col items-center gap-1.5 p-3 rounded-xl text-center transition-colors ${active ? "bg-teal-50 text-teal-700" : "text-slate-600 hover:bg-slate-50"}`}>
                    <Icon className="w-5 h-5" />
                    <span className="text-[10px] font-bold leading-tight">{item.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      <nav className="fixed bottom-0 left-0 right-0 z-[59] lg:hidden bg-white/95 backdrop-blur-md border-t border-slate-200 safe-area-bottom" style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }} dir="rtl">
        <div className="flex items-center justify-around h-[60px] px-1">
          {primary.map((item) => {
            const Icon = iconMap[item.icon];
            const active = isProductRouteActive(location, item.path);
            return (
              <button key={item.path} onClick={() => { navigate(item.path); setShowMore(false); }} className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full relative transition-colors ${active ? "text-teal-700" : "text-slate-500"}`}>
                {active && <div className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 bg-teal-500 rounded-full" />}
                <Icon className="w-5 h-5" strokeWidth={active ? 2.5 : 2} />
                <span className={`text-[10px] leading-none ${active ? "font-bold" : "font-medium"}`}>{item.label}</span>
              </button>
            );
          })}
          <button onClick={() => setShowMore((v) => !v)} className={`flex flex-col items-center justify-center gap-0.5 flex-1 h-full ${showMore ? "text-teal-700" : "text-slate-500"}`}>
            <MoreHorizontal className="w-5 h-5" />
            <span className="text-[10px] leading-none font-medium">المزيد</span>
          </button>
        </div>
      </nav>
    </>
  );
}
