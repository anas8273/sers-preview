import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { Activity, AlertTriangle, ArrowRight, FileUp, History, Loader2, MessageSquare, RefreshCw, Send, ShieldCheck, Share2, Trash2 } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import { getLoginUrl } from "@/const";
import { Button } from "@/components/ui/button";

type AuditActionPresentation = { label: string; detail: string; icon: typeof Activity; tone: string };
type AuditEntry = { id: number; action: string; createdAt: Date; actorName: string | null };

const ACTIONS: Record<string, AuditActionPresentation> = {
  "portfolio.created": { label: "إنشاء ملف أداء", detail: "تم إنشاء ملف أداء جديد.", icon: Activity, tone: "text-emerald-700 bg-emerald-50" },
  "portfolio.updated": { label: "تعديل ملف أداء", detail: "تم حفظ تعديلات في ملف الأداء.", icon: Activity, tone: "text-blue-700 bg-blue-50" },
  "portfolio.submitted": { label: "إرسال ملف أداء", detail: "تم إرسال الملف للمراجعة.", icon: Send, tone: "text-violet-700 bg-violet-50" },
  "portfolio.deleted": { label: "حذف ملف أداء", detail: "تم حذف ملف أداء.", icon: Trash2, tone: "text-rose-700 bg-rose-50" },
  "file.uploaded": { label: "رفع مرفق", detail: "تم رفع ملف وإضافته إلى سجلك.", icon: FileUp, tone: "text-sky-700 bg-sky-50" },
  "evidence.comment_created": { label: "إضافة تعليق", detail: "تمت إضافة تعليق تعاوني على شاهد.", icon: MessageSquare, tone: "text-amber-700 bg-amber-50" },
  "evidence.comment_deleted": { label: "حذف تعليق", detail: "تم حذف تعليق تعاوني.", icon: Trash2, tone: "text-rose-700 bg-rose-50" },
  "online_exam.created": { label: "إنشاء اختبار إلكتروني", detail: "تم إنشاء اختبار قابل للمشاركة.", icon: Share2, tone: "text-indigo-700 bg-indigo-50" },
  "online_exam.revoked": { label: "إيقاف اختبار إلكتروني", detail: "تم إيقاف رابط الاختبار الإلكتروني.", icon: ShieldCheck, tone: "text-slate-700 bg-slate-100" },
  "share_link.created": { label: "إنشاء رابط مشاركة", detail: "تم إنشاء رابط مشاركة محمي للملف.", icon: Share2, tone: "text-cyan-700 bg-cyan-50" },
  "share_link.deactivated": { label: "إيقاف رابط مشاركة", detail: "تم إيقاف رابط مشاركة للملف.", icon: ShieldCheck, tone: "text-slate-700 bg-slate-100" },
  "file.deleted": { label: "حذف مرفق", detail: "تم حذف مرفق من السجل.", icon: Trash2, tone: "text-rose-700 bg-rose-50" },
};

export default function AuditLog() {
  const [, navigate] = useLocation();
  const { isAuthenticated, loading } = useAuth();
  const [filter, setFilter] = useState("all");
  const auditApi = trpc as any;
  const logsQuery = auditApi.audit.list.useQuery({ limit: 100 }, { enabled: isAuthenticated });
  const auditEntries = (logsQuery.data ?? []) as AuditEntry[];

  const visibleLogs = useMemo(() => auditEntries.filter((log) => filter === "all" || log.action === filter), [filter, auditEntries]);
  const actionOptions = useMemo(() => Array.from(new Set(auditEntries.map((log) => log.action))), [auditEntries]);

  if (loading) return <div className="min-h-screen grid place-items-center" dir="rtl"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div>;
  if (!isAuthenticated) return (
    <main className="min-h-screen bg-slate-50 grid place-items-center p-4" dir="rtl">
      <section className="max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-sm">
        <ShieldCheck className="mx-auto h-11 w-11 text-teal-600" />
        <h1 className="mt-4 text-xl font-black text-slate-900">سجل التدقيق</h1>
        <p className="mt-2 text-sm leading-7 text-slate-600">سجّل الدخول لعرض عملياتك، أو العمليات التي تديرها بصفتك مسؤولاً.</p>
        <Button className="mt-5 bg-teal-600 hover:bg-teal-700" onClick={() => { window.location.href = getLoginUrl(); }}>تسجيل الدخول</Button>
      </section>
    </main>
  );

  return (
    <main className="min-h-screen bg-slate-50 pb-16" dir="rtl">
      <header className="bg-gradient-to-l from-teal-800 via-teal-700 to-emerald-600 text-white">
        <div className="mx-auto max-w-5xl px-4 py-7 sm:px-6">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-sm text-white/80 hover:text-white"><ArrowRight className="h-4 w-4" />العودة للرئيسية</button>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-4"><div className="flex items-center gap-3"><span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/15"><History className="h-6 w-6" /></span><div><h1 className="text-2xl font-black">سجل التدقيق</h1><p className="mt-1 text-sm text-white/80">سجل زمني للرفع والمشاركة والتعديلات المهمة.</p></div></div><span className="rounded-full bg-white/15 px-3 py-1 text-xs font-bold">{logsQuery.data?.length ?? 0} عملية</span></div>
        </div>
      </header>

      <section className="mx-auto max-w-5xl px-4 py-6 sm:px-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <select value={filter} onChange={(event) => setFilter(event.target.value)} className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"><option value="all">كل العمليات</option>{actionOptions.map((action) => <option key={action} value={action}>{ACTIONS[action]?.label ?? action}</option>)}</select>
          <Button variant="outline" size="sm" className="gap-1" onClick={() => logsQuery.refetch()} disabled={logsQuery.isFetching}><RefreshCw className={`h-4 w-4 ${logsQuery.isFetching ? "animate-spin" : ""}`} />تحديث</Button>
        </div>
        {logsQuery.isLoading ? <div className="grid min-h-56 place-items-center rounded-2xl border border-slate-200 bg-white"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div> : logsQuery.isError ? <div className="flex items-center gap-3 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"><AlertTriangle className="h-5 w-5 shrink-0" />تعذر تحميل سجل التدقيق. استخدم زر التحديث للمحاولة من جديد.</div> : visibleLogs.length === 0 ? <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-12 text-center"><History className="mx-auto h-10 w-10 text-slate-300" /><h2 className="mt-3 font-bold text-slate-800">لا توجد عمليات مطابقة بعد</h2><p className="mt-1 text-sm text-slate-500">ستظهر هنا عمليات الرفع والمشاركة والتعديل فور حدوثها.</p></div> : <div className="space-y-3">{visibleLogs.map((log) => { const presentation = ACTIONS[log.action] ?? { label: log.action, detail: "عملية مسجلة في النظام.", icon: Activity, tone: "text-slate-700 bg-slate-100" }; const Icon = presentation.icon; return <article key={log.id} className="flex gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm"><span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${presentation.tone}`}><Icon className="h-5 w-5" /></span><div className="min-w-0 flex-1"><div className="flex flex-wrap items-center justify-between gap-2"><h2 className="font-bold text-slate-900">{presentation.label}</h2><time className="text-xs text-slate-400">{new Date(log.createdAt).toLocaleString("ar-SA")}</time></div><p className="mt-1 text-sm text-slate-600">{presentation.detail}</p>{log.actorName && <p className="mt-2 text-xs text-slate-400">المنفذ: {log.actorName}</p>}</div></article>; })}</div>}
      </section>
    </main>
  );
}
