import { useRef, useState, type MouseEvent } from "react";
import { Award, Building2, ChevronDown, ChevronUp, ExternalLink, FileText, Library, Link2, Loader2, Plus, RefreshCw, ShieldCheck, Trash2, UserRound, X } from "lucide-react";
import AppSidebar from "@/components/AppSidebar";
import AssetDeleteDialog from "@/components/AssetDeleteDialog";
import { trpc } from "@/lib/trpc";
import { Link, useLocation } from "wouter";
import PrivateEvidenceUpload from "@/components/PrivateEvidenceUpload";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

function AssetUsageDetails({ assetId }: { assetId: number }) {
  const usageQuery = trpc.domain.asset.usage.useQuery({ id: assetId }, { retry: false });

  if (usageQuery.isLoading) {
    return (
      <div role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        جارٍ تحميل الاستخدام...
      </div>
    );
  }

  if (usageQuery.error) {
    return (
      <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
        {usageQuery.error.message}
      </p>
    );
  }

  const activeLinks = usageQuery.data?.activeLinks ?? [];
  const historicalCount = usageQuery.data?.historicalVersionCount ?? 0;

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
      <p className="font-bold text-slate-900">مستخدم في {activeLinks.length} عمل</p>
      {activeLinks.length > 0 && (
        <ul className="mt-2 space-y-1">
          {activeLinks.map(link => (
            <li key={`${link.workItemId}-${link.role}`}>
              <Link href={`/work/${link.workItemId}`} className="font-semibold text-teal-800 hover:underline">
                {link.workTitle}
              </Link>
            </li>
          ))}
        </ul>
      )}
      {historicalCount > 0 && (
        <p className="mt-2 text-[11px] font-semibold text-slate-600">مستخدم في {historicalCount} نسخة ثابتة محفوظة</p>
      )}
    </div>
  );
}

type StandardVersionOption = {
  id: number;
  standardKey: string;
  version: string;
  title: string;
};

function AssetStandardsPanel({
  assetId,
  standards,
  standardsLoading,
}: {
  assetId: number;
  standards: StandardVersionOption[];
  standardsLoading: boolean;
}) {
  const utils = trpc.useUtils();
  const [selectedStandardId, setSelectedStandardId] = useState<number | undefined>();
  const [note, setNote] = useState("");
  const linkedQuery = trpc.domain.standards.listForAsset.useQuery({ assetId }, { retry: false });
  const linkMutation = trpc.domain.standards.linkAsset.useMutation({
    onSuccess: async () => {
      setSelectedStandardId(undefined);
      setNote("");
      await utils.domain.standards.listForAsset.invalidate({ assetId });
    },
  });
  const unlinkMutation = trpc.domain.standards.unlinkAsset.useMutation({
    onSuccess: async () => {
      await utils.domain.standards.listForAsset.invalidate({ assetId });
    },
  });

  if (linkedQuery.isLoading || standardsLoading) {
    return (
      <div role="status" className="mt-3 flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 text-xs text-slate-600">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        جارٍ تحميل المعايير...
      </div>
    );
  }

  if (linkedQuery.error) {
    return (
      <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-700">
        {linkedQuery.error.message}
      </p>
    );
  }

  const linked = linkedQuery.data ?? [];
  const linkedIds = new Set(linked.map(item => item.standardVersionId));
  const available = standards.filter(std => !linkedIds.has(std.id));

  return (
    <div className="mt-3 space-y-3 rounded-xl border border-slate-200 bg-slate-50/80 p-3 text-xs">
      <div className="flex items-center justify-between gap-2">
        <p className="font-bold text-slate-900">ربط بمعيار رسمي ({linked.length})</p>
      </div>

      {linked.length > 0 && (
        <ul className="space-y-1.5">
          {linked.map(item => (
            <li key={item.linkId} className="flex items-start justify-between gap-2 rounded-lg border border-slate-200 bg-white px-2.5 py-2">
              <div className="min-w-0">
                <p className="font-bold text-slate-900">{item.title} <span className="text-[10px] font-normal text-slate-500">({item.standardKey} · {item.version})</span></p>
                {item.note && <p className="mt-0.5 text-[11px] text-slate-600">{item.note}</p>}
              </div>
              <button
                type="button"
                disabled={unlinkMutation.isPending}
                onClick={() => unlinkMutation.mutate({ assetId, standardVersionId: item.standardVersionId })}
                className="shrink-0 rounded-md px-2 py-1 text-[11px] font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
              >
                فك الربط
              </button>
            </li>
          ))}
        </ul>
      )}

      {standards.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 bg-white px-3 py-2 text-[11px] leading-5 text-slate-600">
          لا توجد معايير رسمية مفعّلة في السجل بعد (بانتظار اعتماد الإطار الرسمي O009).
        </p>
      ) : available.length === 0 ? (
        <p className="text-[11px] text-slate-600">تم ربط الشاهد بجميع المعايير النشطة المتاحة.</p>
      ) : (
        <div className="space-y-2">
          <select
            aria-label="اختر معيارًا لربط الشاهد"
            value={selectedStandardId ?? ""}
            onChange={event => setSelectedStandardId(Number(event.target.value) || undefined)}
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-2 text-xs"
          >
            <option value="">اختر معيارًا...</option>
            {available.map(std => (
              <option key={std.id} value={std.id}>{std.title} ({std.version})</option>
            ))}
          </select>
          <input
            type="text"
            value={note}
            onChange={event => setNote(event.target.value)}
            maxLength={1000}
            placeholder="ملاحظة ربط اختيارية..."
            className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs"
          />
          <button
            type="button"
            disabled={!selectedStandardId || linkMutation.isPending}
            onClick={() => selectedStandardId && linkMutation.mutate({ assetId, standardVersionId: selectedStandardId, note: note.trim() || undefined })}
            className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-teal-700 px-3 py-1.5 text-xs font-bold text-white hover:bg-teal-800 disabled:opacity-50"
          >
            {linkMutation.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            ربط بمعيار
          </button>
        </div>
      )}
      {(linkMutation.error || unlinkMutation.error) && (
        <p role="alert" className="text-[11px] text-red-700">{linkMutation.error?.message || unlinkMutation.error?.message}</p>
      )}
    </div>
  );
}

export default function EvidenceLibrary() {
  const [location] = useLocation();
  const [showCreate, setShowCreate] = useState(false);
  const [title, setTitle] = useState("");
  const [kind, setKind] = useState<"link" | "text">("link");
  const [externalUrl, setExternalUrl] = useState("");
  const [text, setText] = useState("");
  const [ownerType, setOwnerType] = useState<"personal" | "organization">("personal");
  const [organizationId, setOrganizationId] = useState<number | undefined>();
  const [expandedUsageIds, setExpandedUsageIds] = useState<Record<number, boolean>>({});
  const [expandedStandardsIds, setExpandedStandardsIds] = useState<Record<number, boolean>>({});
  const [deleteTarget, setDeleteTarget] = useState<{ id: number; title: string } | null>(null);
  const createTrigger = useRef<HTMLButtonElement | null>(null);
  const deleteTrigger = useRef<HTMLButtonElement | null>(null);
  const openCreate = (event: MouseEvent<HTMLButtonElement>) => {
    createTrigger.current = event.currentTarget;
    setShowCreate(true);
  };
  const toggleUsage = (assetId: number) => {
    setExpandedUsageIds(current => ({ ...current, [assetId]: !current[assetId] }));
  };
  const toggleStandards = (assetId: number) => {
    setExpandedStandardsIds(current => ({ ...current, [assetId]: !current[assetId] }));
  };

  const utils = trpc.useUtils();
  const assetsQuery = trpc.domain.asset.list.useQuery(undefined, { retry: false });
  const standardsQuery = trpc.domain.standards.list.useQuery({ activeOnly: true }, { retry: false });
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
            <div className="mr-12 lg:mr-0">
              <p className="text-xs font-bold text-teal-700">مكتبة قابلة لإعادة الاستخدام</p>
              <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>الشواهد والأصول</h1>
              <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-600">الأصل مستقل عن التقرير وملف الإنجاز. أضفه مرة واحدة ثم اربطه بالأعمال التي تحتاجه دون نسخ مكررة.</p>
            </div>
            <button type="button" onClick={openCreate} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800"><Plus className="h-4 w-4" />إضافة شاهد</button>
          </header>

          <PrivateEvidenceUpload />

          {assetsQuery.isLoading && <div role="status" className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-600"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل مكتبتك...</div>}

          {assetsQuery.error && (
            <div role="alert" className="mt-8 rounded-2xl border border-amber-200 bg-amber-50 p-5 text-sm leading-7 text-amber-950">
              <p>تعذر تحميل مكتبة الشواهد. تأكد من تسجيل الدخول ثم أعد المحاولة.</p>
              <button
                type="button"
                disabled={assetsQuery.isFetching}
                onClick={() => void assetsQuery.refetch()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-amber-300 bg-white px-4 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </button>
            </div>
          )}

          {assetsQuery.data && assetsQuery.data.length === 0 && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <Library className="mx-auto h-9 w-9 text-slate-400" />
              <h2 className="mt-4 text-base font-bold text-slate-900">مكتبة الشواهد فارغة</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-600">أضف أول أصل. لن يرتبط بتقرير واحد فقط؛ سيظل في مكتبتك ويمكن استخدامه في عدة أعمال.</p>
              <button type="button" onClick={openCreate} className="mt-5 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800"><Plus className="h-4 w-4" />إضافة أول شاهد</button>
            </section>
          )}

          {assetsQuery.data && assetsQuery.data.length > 0 && (
            <section className="mt-8 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {assetsQuery.data.map(asset => {
                const Icon = asset.kind === "link" ? Link2 : asset.kind === "text" ? FileText : Library;
                const textPreview = asset.kind === "text" && asset.metadata && typeof asset.metadata === "object" && "text" in asset.metadata ? String((asset.metadata as { text?: unknown }).text ?? "") : "";
                const isVerifiedFile = asset.kind === "file";
                return (
                  <article key={asset.id} className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:border-teal-200 hover:shadow-md">
                    <div className="flex items-start gap-3">
                      <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-cyan-50 text-cyan-800"><Icon className="h-5 w-5" /></div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <span className="text-[11px] font-bold text-slate-600">{asset.kind === "link" ? "رابط" : asset.kind === "text" ? "نص" : "ملف"}</span>
                          <span className="inline-flex items-center gap-1 text-[11px] text-slate-600">{asset.ownerType === "personal" ? <UserRound className="h-3 w-3" /> : <Building2 className="h-3 w-3" />}{asset.ownerType === "personal" ? "شخصي" : "مدرسي"}</span>
                        </div>
                        <h2 className="mt-2 truncate text-sm font-bold text-slate-900">{asset.title}</h2>
                        <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${isVerifiedFile ? "border-emerald-200 bg-emerald-50 text-emerald-800" : "border-slate-200 bg-slate-100 text-slate-700"}`}>
                          {isVerifiedFile && <ShieldCheck className="h-3 w-3" />}
                          {isVerifiedFile ? "أصلي موثّق" : "مادة مساعدة"}
                        </span>
                      </div>
                    </div>
                    {asset.kind === "link" && asset.externalUrl && <a href={asset.externalUrl} target="_blank" rel="noreferrer" className="mt-4 flex min-h-11 items-center gap-2 truncate rounded-xl bg-slate-50 px-3 py-2.5 text-xs font-semibold text-teal-800 hover:bg-teal-50"><ExternalLink className="h-3.5 w-3.5 shrink-0" /><span className="truncate" dir="ltr">{asset.externalUrl}</span></a>}
                    {textPreview && <p className="mt-4 line-clamp-3 rounded-xl bg-slate-50 px-3 py-2.5 text-xs leading-6 text-slate-700">{textPreview}</p>}
                    {asset.kind === "file" && <a href={`/api/evidence/assets/${asset.id}/download`} className="mt-4 inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-50 px-3 py-2.5 text-xs font-bold text-teal-900 hover:bg-teal-100"><FileText className="h-4 w-4" />تنزيل الملف</a>}
                    <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <button
                          type="button"
                          aria-expanded={Boolean(expandedUsageIds[asset.id])}
                          onClick={() => toggleUsage(asset.id)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100"
                        >
                          {expandedUsageIds[asset.id] ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          عرض الاستخدام
                        </button>
                        <button
                          type="button"
                          aria-expanded={Boolean(expandedStandardsIds[asset.id])}
                          onClick={() => toggleStandards(asset.id)}
                          className="inline-flex min-h-11 items-center gap-1.5 rounded-xl px-2.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50"
                        >
                          <Award className="h-3.5 w-3.5" />
                          ربط بمعيار
                        </button>
                      </div>
                      <button
                        type="button"
                        aria-label={`حذف الشاهد ${asset.title}`}
                        onClick={event => {
                          deleteTrigger.current = event.currentTarget;
                          setDeleteTarget({ id: asset.id, title: asset.title });
                        }}
                        className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-xl text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                    {expandedUsageIds[asset.id] && <AssetUsageDetails assetId={asset.id} />}
                    {expandedStandardsIds[asset.id] && (
                      <AssetStandardsPanel
                        assetId={asset.id}
                        standards={standardsQuery.data ?? []}
                        standardsLoading={standardsQuery.isLoading}
                      />
                    )}
                  </article>
                );
              })}
            </section>
          )}
        </div>
      </main>

      <Dialog open={showCreate} onOpenChange={setShowCreate}>
        <DialogContent
          showCloseButton={false}
          className="z-[80] block max-h-[calc(100dvh-2rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
          dir="rtl"
          onOpenAutoFocus={event => { event.preventDefault(); document.getElementById("evidence-title")?.focus(); }}
          onCloseAutoFocus={event => { event.preventDefault(); createTrigger.current?.focus(); }}
        >
          <div className="flex items-start justify-between gap-4">
            <div>
              <DialogTitle className="text-lg font-bold text-slate-950">إضافة شاهد</DialogTitle>
              <DialogDescription className="mt-1 text-xs leading-6 text-slate-600">أضف رابطًا أو نصًا الآن. سيبقى الأصل مستقلًا وقابلًا للربط بأكثر من عمل.</DialogDescription>
            </div>
            <button type="button" onClick={() => setShowCreate(false)} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100" aria-label="إغلاق"><X className="h-5 w-5" /></button>
          </div>

          <label htmlFor="evidence-title" className="mt-5 block text-xs font-bold text-slate-700">عنوان الشاهد</label>
          <input id="evidence-title" value={title} onChange={event => setTitle(event.target.value)} maxLength={255} placeholder="مثال: محضر تنفيذ البرنامج" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100" />

          <div className="mt-4 grid grid-cols-2 gap-2" role="group" aria-label="نوع الشاهد">
            <button type="button" aria-pressed={kind === "link"} onClick={() => setKind("link")} className={`min-h-11 rounded-xl border p-3 text-right ${kind === "link" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><Link2 className="mb-2 h-4 w-4" /><span className="text-xs font-bold text-slate-900">رابط</span></button>
            <button type="button" aria-pressed={kind === "text"} onClick={() => setKind("text")} className={`min-h-11 rounded-xl border p-3 text-right ${kind === "text" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><FileText className="mb-2 h-4 w-4" /><span className="text-xs font-bold text-slate-900">نص</span></button>
          </div>

          <label htmlFor="evidence-content" className="mt-3 block text-xs font-bold text-slate-700">{kind === "link" ? "رابط الشاهد" : "نص الشاهد"}</label>
          {kind === "link"
            ? <input id="evidence-content" value={externalUrl} onChange={event => setExternalUrl(event.target.value)} placeholder="https://..." dir="ltr" className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-500" />
            : <textarea id="evidence-content" value={text} onChange={event => setText(event.target.value)} rows={5} maxLength={10000} placeholder="اكتب نص الشاهد..." className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm leading-7 outline-none focus:border-teal-500" />}

          <p id="evidence-owner-label" className="mt-4 block text-xs font-bold text-slate-700">الملكية</p>
          <div role="group" aria-labelledby="evidence-owner-label" className="mt-2 grid grid-cols-2 gap-2">
            <button type="button" aria-pressed={ownerType === "personal"} onClick={() => { setOwnerType("personal"); setOrganizationId(undefined); }} className={`min-h-11 rounded-xl border p-3 text-right ${ownerType === "personal" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><UserRound className="mb-2 h-4 w-4" /><span className="text-xs font-bold text-slate-900">شخصي</span></button>
            <button type="button" aria-pressed={ownerType === "organization"} onClick={() => setOwnerType("organization")} disabled={organizations.length === 0} className={`min-h-11 rounded-xl border p-3 text-right disabled:cursor-not-allowed disabled:opacity-50 ${ownerType === "organization" ? "border-teal-600 bg-teal-50" : "border-slate-200 hover:bg-slate-50"}`}><Building2 className="mb-2 h-4 w-4" /><span className="text-xs font-bold text-slate-900">مدرسي</span></button>
          </div>

          {ownerType === "organization" && <select aria-label="مدرسة الشاهد" value={organizationId ?? ""} onChange={event => setOrganizationId(Number(event.target.value) || undefined)} className="mt-3 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"><option value="">اختر المدرسة</option>{organizations.map(org => <option key={org.id} value={org.id}>{org.name} — {org.role}</option>)}</select>}
          {createAsset.error && <p role="alert" className="mt-3 text-xs leading-6 text-red-700">{createAsset.error.message}</p>}

          <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
            <button type="button" onClick={() => setShowCreate(false)} className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100">إلغاء</button>
            <button type="button" onClick={submit} disabled={!canSubmit || createAsset.isPending} className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">{createAsset.isPending && <Loader2 className="h-4 w-4 animate-spin" />}إضافة</button>
          </div>
        </DialogContent>
      </Dialog>

      <AssetDeleteDialog
        asset={deleteTarget}
        onClose={() => setDeleteTarget(null)}
        onDeleted={() => void utils.domain.asset.list.invalidate()}
        returnFocusRef={deleteTrigger}
      />
    </div>
  );
}
