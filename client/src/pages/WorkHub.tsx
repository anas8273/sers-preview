import { useMemo, useState } from "react";
import { Building2, FileText, FolderKanban, Loader2, Plus, UserRound, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

const statusLabel = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  archived: "مؤرشف",
} as const;

export default function WorkHub() {
  const [location] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [type, setType] = useState<"report" | "portfolio">("report");
  const [ownerType, setOwnerType] = useState<"personal" | "organization">("personal");
  const [organizationId, setOrganizationId] = useState<number | undefined>();

  const utils = trpc.useUtils();
  const workQuery = trpc.domain.work.list.useQuery(undefined, { retry: false });
  const organizationsQuery = trpc.domain.organization.listMine.useQuery(undefined, { retry: false });
  const createWork = trpc.domain.work.create.useMutation({
    onSuccess: async () => {
      setTitle("");
      setType("report");
      setOwnerType("personal");
      setOrganizationId(undefined);
      setShowCreate(false);
      await utils.domain.work.list.invalidate();
    },
  });

  const organizations = organizationsQuery.data ?? [];
  const canSubmit = useMemo(() => title.trim().length >= 2 && (ownerType === "personal" || Boolean(organizationId)), [title, ownerType, organizationId]);

  const submit = () => {
    if (!canSubmit || createWork.isPending) return;
    createWork.mutate({ title: title.trim(), type, ownerType, organizationId });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold text-teal-700">مساحة العمل</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>أعمالي</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">التقارير وملفات الإنجاز لها نموذج عمل واحد، مع ملكية واضحة ونسخ محفوظة وشواهد قابلة لإعادة الاستخدام.</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700">
              <Plus className="h-4 w-4" /> إنشاء عمل
            </button>
          </header>

          {workQuery.isLoading && (
            <div className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل أعمالك...</div>
          )}

          {workQuery.error && (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">
              تعذر تحميل مساحة العمل. إذا لم تكن مسجلًا فادخل بحسابك أولًا، وإذا كانت البيئة لم تطبق migration الجديدة بعد فستبقى هذه الصفحة محمية دون الرجوع للبيانات القديمة.
            </div>
          )}

          {workQuery.data && workQuery.data.length === 0 && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <FolderKanban className="mx-auto h-9 w-9 text-slate-300" />
              <h2 className="mt-4 text-base font-bold text-slate-900">لا توجد أعمال بعد</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">أنشئ أول تقرير أو ملف إنجاز. الشواهد التي تضيفها إلى المكتبة ستبقى أصولًا مستقلة يمكن ربطها بأكثر من عمل.</p>
              <button onClick={() => setShowCreate(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />إنشاء أول عمل</button>
            </section>
          )}

          {workQuery.data && workQuery.data.length > 0 && (
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {workQuery.data.map(work => {
                const Icon = work.type === "report" ? FileText : FolderKanban;
                return (
                  <article key={work.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2">
                          <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{statusLabel[work.status]}</span>
                          <span className="text-[10px] text-slate-400">نسخة {work.currentVersionNumber}</span>
                        </div>
                        <h2 className="mt-3 truncate text-sm font-bold text-slate-900">{work.title}</h2>
                        <p className="mt-1 text-xs text-slate-500">{work.type === "report" ? "تقرير" : "ملف إنجاز"}</p>
                      </div>
                    </div>
                    <div className="mt-5 flex items-center gap-2 border-t border-slate-100 pt-4 text-[11px] text-slate-500">
                      {work.ownerType === "personal" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                      {work.ownerType === "personal" ? "ملكية شخصية" : "ملكية مدرسية"}
                    </div>
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>

      {showCreate && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-slate-950/40 p-4 backdrop-blur-sm" onMouseDown={event => event.target === event.currentTarget && setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl" dir="rtl">
            <div className="flex items-start justify-between gap-4">
              <div><h2 className="text-lg font-bold text-slate-950">إنشاء عمل</h2><p className="mt-1 text-xs leading-6 text-slate-500">اختر نوع العمل وملكيته. يمكن إضافة الشواهد لاحقًا دون نسخها.</p></div>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>

            <label className="mt-5 block text-xs font-bold text-slate-700">اسم العمل</label>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={255} placeholder="مثال: تقرير برنامج الانضباط" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setType("report")} className={`rounded-xl border p-3 text-right ${type === "report" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><FileText className="mb-2 h-4 w-4 text-teal-700" /><span className="block text-xs font-bold text-slate-800">تقرير</span></button>
              <button onClick={() => setType("portfolio")} className={`rounded-xl border p-3 text-right ${type === "portfolio" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><FolderKanban className="mb-2 h-4 w-4 text-teal-700" /><span className="block text-xs font-bold text-slate-800">ملف إنجاز</span></button>
            </div>

            <label className="mt-4 block text-xs font-bold text-slate-700">الملكية</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => { setOwnerType("personal"); setOrganizationId(undefined); }} className={`rounded-xl border p-3 text-right ${ownerType === "personal" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><UserRound className="mb-2 h-4 w-4" /><span className="block text-xs font-bold">شخصي</span></button>
              <button onClick={() => setOwnerType("organization")} disabled={organizations.length === 0} className={`rounded-xl border p-3 text-right disabled:cursor-not-allowed disabled:opacity-50 ${ownerType === "organization" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><Building2 className="mb-2 h-4 w-4" /><span className="block text-xs font-bold">مدرسي</span></button>
            </div>

            {ownerType === "organization" && (
              <select value={organizationId ?? ""} onChange={event => setOrganizationId(Number(event.target.value) || undefined)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                <option value="">اختر المدرسة</option>
                {organizations.map(org => <option key={org.id} value={org.id}>{org.name} — {org.role}</option>)}
              </select>
            )}

            {createWork.error && <p className="mt-3 text-xs leading-6 text-red-600">{createWork.error.message}</p>}
            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
              <button onClick={submit} disabled={!canSubmit || createWork.isPending} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{createWork.isPending && <Loader2 className="h-4 w-4 animate-spin" />}إنشاء</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
