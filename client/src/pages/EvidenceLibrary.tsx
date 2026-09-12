import { useState } from "react";
import { Building2, ExternalLink, FileText, Library, Link2, Loader2, Plus, UserRound, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";
import { useLocation } from "wouter";

export default function EvidenceLibrary() {
  const [location] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"link" | "text">("link");
  const [externalUrl, setExternalUrl] = useState("");
  const [text, setText] = useState("");
  const [ownerType, setOwnerType] = useState<"personal" | "organization">("personal");
  const [organizationId, setOrganizationId] = useState<number | undefined>();

  const utils = trpc.useUtils();
  const assetsQuery = trpc.domain.asset.list.useQuery(undefined, { retry: false });
  const organizationsQuery = trpc.domain.organization.listMine.useQuery(undefined, { retry: false });
  const organizations = organizationsQuery.data ?? [];
  const createAsset = trpc.domain.asset.createReference.useMutation({
    onSuccess: async () => {
      setTitle("");
      setExternalUrl("");
      setText("");
      setKind("link");
      setOwnerType("personal");
      setOrganizationId(undefined);
      setShowCreate(false);
      await utils.domain.asset.list.invalidate();
    },
  });

  const canSubmit = title.trim().length >= 2
    && (ownerType === "personal" || Boolean(organizationId))
    && (kind === "link" ? /^https?:\/\//i.test(externalUrl.trim()) : text.trim().length > 0);

  const submit = () => {
    if (!canSubmit || createAsset.isPending) return;
    createAsset.mutate({
      title: title.trim(),
      kind,
      externalUrl: kind === "link" ? externalUrl.trim() : undefined,
      text: kind === "text" ? text.trim() : undefined,
      ownerType,
      organizationId,
    });
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-bold text-teal-700">مكتبة قابلة لإعادة الاستخدام</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>الشواهد والأصول</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">الأصل مستقل عن التقرير وملف الإنجاز. أضفه مرة واحدة ثم اربطه بالأعمال التي تحتاجه دون نسخ مكررة.</p>
            </div>
            <button onClick={() => setShowCreate(true)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-700"><Plus className="h-4 w-4" />إضافة شاهد</button>
          </header>

          <div className="mt-6 rounded-2xl border border-cyan-100 bg-cyan-50/60 p-4 text-xs leading-6 text-cyan-950">
            رفع الملفات سيُفتح عبر مسار تخزين آمن مستقل بعد فحص MIME/magic bytes والحجر الأمني. في هذه الشريحة يمكنك إضافة رابط أو نص كشاهد دون تجاوز طبقة الحماية المخطط لها.
          </div>

          {assetsQuery.isLoading && <div className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل مكتبتك...</div>}

          {assetsQuery.error && (
            <div className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-900">تعذر تحميل مكتبة الشواهد. يلزم تسجيل الدخول وتطبيق migration الجديدة في بيئة قاعدة البيانات قبل استخدام هذه النواة.</div>
          )}

          {assetsQuery.data && assetsQuery.data.length === 0 && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <Library className="mx-auto h-9 w-9 text-slate-300" />
              <h2 className="mt-4 text-base font-bold text-slate-900">مكتبة الشواهد فارغة</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">أضف أول أصل. لن يرتبط بتقرير واحد فقط؛ سيظل في مكتبتك ويمكن استخدامه في عدة أعمال.</p>
              <button onClick={() => setShowCreate(true)} className="mt-5 inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white"><Plus className="h-4 w-4" />إضافة أول شاهد</button>
            </section>
          )}

          {assetsQuery.data && assetsQuery.data.length > 0 && (
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assetsQuery.data.map(asset => {
                const Icon = asset.kind === "link" ? Link2 : asset.kind === "text" ? FileText : Library;
                const textPreview = asset.kind === "text" && asset.metadata && typeof asset.metadata === "object" && "text" in asset.metadata ? String((asset.metadata as { text?: unknown }).text ?? "") : "";
                return (
                  <article key={asset.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-700"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold text-slate-400">{asset.kind === "link" ? "رابط" : asset.kind === "text" ? "نص" : "ملف"}</span><span className="inline-flex items-center gap-1 text-[10px] text-slate-400">{asset.ownerType === "personal" ? <UserRound className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}{asset.ownerType === "personal" ? "شخصي" : "مدرسي"}</span></div>
                        <h2 className="mt-2 truncate text-sm font-bold text-slate-900">{asset.title}</h2>
                      </div>
                    </div>
                    {asset.kind === "link" && asset.externalUrl && <a href={asset.externalUrl} target="_blank" rel="noreferrer" className="mt-4 flex items-center gap-2 truncate rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-teal-700 hover:bg-teal-50"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="truncate">{asset.externalUrl}</span></a>}
                    {textPreview && <p className="mt-4 line-clamp-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-6 text-slate-600">{textPreview}</p>}
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
              <div><h2 className="text-lg font-bold text-slate-950">إضافة شاهد</h2><p className="mt-1 text-xs leading-6 text-slate-500">أضف رابطًا أو نصًا الآن. سيبقى الأصل مستقلًا وقابلًا للربط بأكثر من عمل.</p></div>
              <button onClick={() => setShowCreate(false)} className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100" aria-label="إغلاق"><X className="h-4 w-4" /></button>
            </div>

            <label className="mt-5 block text-xs font-bold text-slate-700">عنوان الشاهد</label>
            <input value={title} onChange={event => setTitle(event.target.value)} maxLength={255} placeholder="مثال: محضر تنفيذ البرنامج" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button onClick={() => setKind("link")} className={`rounded-xl border p-3 text-right ${kind === "link" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><Link2 className="mb-2 h-4 w-4" /><span className="text-xs font-bold">رابط</span></button>
              <button onClick={() => setKind("text")} className={`rounded-xl border p-3 text-right ${kind === "text" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><FileText className="mb-2 h-4 w-4" /><span className="text-xs font-bold">نص</span></button>
            </div>

            {kind === "link" ? <input value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="https://..." dir="ltr" className="mt-3 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" /> : <textarea value={text} onChange={event => setText(event.target.value)} rows={5} maxLength={10000} placeholder="اكتب نص الشاهد..." className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-7 outline-none focus:border-teal-400" />}

            <label className="mt-4 block text-xs font-bold text-slate-700">الملكية</label>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <button onClick={() => { setOwnerType("personal"); setOrganizationId(undefined); }} className={`rounded-xl border p-3 text-right ${ownerType === "personal" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><UserRound className="mb-2 h-4 w-4" /><span className="text-xs font-bold">شخصي</span></button>
              <button onClick={() => setOwnerType("organization")} disabled={organizations.length === 0} className={`rounded-xl border p-3 text-right disabled:cursor-not-allowed disabled:opacity-50 ${ownerType === "organization" ? "border-teal-300 bg-teal-50" : "border-slate-200"}`}><Building2 className="mb-2 h-4 w-4" /><span className="text-xs font-bold">مدرسي</span></button>
            </div>

            {ownerType === "organization" && <select value={organizationId ?? ""} onChange={event => setOrganizationId(Number(event.target.value) || undefined)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">اختر المدرسة</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name} — {org.role}</option>)}</select>}
            {createAsset.error && <p className="mt-3 text-xs leading-6 text-red-600">{createAsset.error.message}</p>}

            <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
              <button onClick={() => setShowCreate(false)} className="rounded-xl px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100">إلغاء</button>
              <button onClick={submit} disabled={!canSubmit || createAsset.isPending} className="inline-flex items-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">{createAsset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}إضافة</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
