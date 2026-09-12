import { useLocation } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { ArrowLeft, Plus, Search } from "lucide-react";

export type WorkspaceAction = { label: string; path?: string };

type Props = {
  eyebrow: string;
  title: string;
  description: string;
  emptyTitle: string;
  emptyDescription: string;
  primaryAction?: WorkspaceAction;
  secondaryAction?: WorkspaceAction;
  children?: React.ReactNode;
};

export default function ProductWorkspacePage({ eyebrow, title, description, emptyTitle, emptyDescription, primaryAction, secondaryAction, children }: Props) {
  const [location, navigate] = useLocation();
  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-10">
          <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-5 mb-8">
            <div>
              <p className="text-xs font-bold text-teal-700 mb-2">{eyebrow}</p>
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-950 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>{title}</h1>
              <p className="text-sm sm:text-base text-slate-500 max-w-2xl leading-7">{description}</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {secondaryAction && <button onClick={() => secondaryAction.path && navigate(secondaryAction.path)} className="px-4 py-2.5 rounded-xl border border-slate-200 bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50">{secondaryAction.label}</button>}
              {primaryAction && <button onClick={() => primaryAction.path && navigate(primaryAction.path)} className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-teal-600 text-white text-sm font-bold hover:bg-teal-700 shadow-sm"><Plus className="w-4 h-4" />{primaryAction.label}</button>}
            </div>
          </div>

          {children ?? (
            <section className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-8">
              <div className="max-w-xl mx-auto text-center py-12">
                <div className="w-12 h-12 rounded-2xl bg-teal-50 text-teal-700 mx-auto mb-4 flex items-center justify-center"><Search className="w-5 h-5" /></div>
                <h2 className="text-lg font-bold text-slate-900 mb-2">{emptyTitle}</h2>
                <p className="text-sm text-slate-500 leading-6 mb-5">{emptyDescription}</p>
                {primaryAction && <button onClick={() => primaryAction.path && navigate(primaryAction.path)} className="inline-flex items-center gap-2 text-sm font-bold text-teal-700 hover:text-teal-800">{primaryAction.label}<ArrowLeft className="w-4 h-4" /></button>}
              </div>
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
