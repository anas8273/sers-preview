import { Bell, Check, Loader2 } from "lucide-react";
import { Link, useLocation } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";

function targetPath(type: string | null, id: string | null) {
  if (type === "work" && id && /^[1-9][0-9]*$/.test(id)) return `/work/${id}`;
  if (type === "asset") return "/evidence";
  if (type === "review") return "/reviews";
  if (type === "membership" || type === "organization") return "/account";
  return undefined;
}
export default function NotificationsHub() {
  const [location] = useLocation();
  const utils = trpc.useUtils();
  const notifications = trpc.notification.list.useQuery(undefined, { retry: false });
  const markRead = trpc.notification.markRead.useMutation({ onSuccess: () => utils.notification.list.invalidate() });
  return <div className="min-h-screen bg-slate-50 pb-20" dir="rtl"><AppSidebar currentPath={location} /><main className="mx-auto max-w-6xl px-4 py-8 lg:mr-72 sm:px-6">
    <p className="text-xs font-bold text-teal-700">متابعة الأعمال</p><h1 className="mt-1 text-3xl font-black text-slate-950">الإشعارات</h1><p className="mt-2 text-sm leading-7 text-slate-500">طلبات المراجعة وقراراتها والشواهد الجديدة في مكان واحد.</p>
    {notifications.isLoading && <Loader2 aria-label="جارٍ التحميل" className="mx-auto my-12 h-6 w-6 animate-spin text-teal-700" />}
    {notifications.error && <p className="mt-6 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">تعذر تحميل الإشعارات. تأكد من تسجيل الدخول وحاول مجددًا.</p>}
    {notifications.data?.length === 0 && <div className="mt-6 rounded-2xl border border-dashed border-slate-200 bg-white p-12 text-center"><Bell className="mx-auto h-8 w-8 text-slate-300" /><p className="mt-3 text-sm text-slate-600">لا توجد إشعارات حتى الآن</p></div>}
    <div className="mt-6 space-y-3">{notifications.data?.map(item => <article key={item.id} className={`rounded-2xl border bg-white p-5 ${item.readAt ? "border-slate-200" : "border-teal-200"}`}><div className="flex items-start justify-between gap-3"><h2 className="text-sm font-bold text-slate-900">{item.title}</h2><span className="shrink-0 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleDateString("ar-SA")}</span></div>
      {item.body && <p className="mt-2 text-xs leading-6 text-slate-600">{item.body}</p>}
      <div className="mt-3 flex items-center gap-4">{targetPath(item.targetType, item.targetId) && <Link href={targetPath(item.targetType, item.targetId)!} className="text-xs font-bold text-teal-700">فتح التفاصيل</Link>}{!item.readAt && <button onClick={() => markRead.mutate({ id: item.id })} disabled={markRead.isPending} className="inline-flex items-center gap-1 text-xs text-slate-500"><Check className="h-3.5 w-3.5" />تمت القراءة</button>}</div>
    </article>)}</div>{markRead.error && <p role="alert" className="mt-4 text-xs text-red-700">تعذر تحديث الإشعار. حاول مجددًا.</p>}
  </main></div>;
}
