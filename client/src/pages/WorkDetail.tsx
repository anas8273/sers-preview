import { useMemo, useState } from "react";
import { ArrowRight, Building2, FileText, FolderKanban, Link2, Loader2, Plus, Save, Trash2, UserRound } from "lucide-react";
import { useLocation, useRoute } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";

const statusLabel = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  archived: "مؤرشف",
} as const;

export default function WorkDetail() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/work/:id");
  const workId = Number(params?.id);
  const [selectedAssetId, setSelectedAssetId] = useState<number | undefined>();
  const [versionReason, setVersionReason] = useState("");

  const utils = trpc.useUtils();
  const workQuery = trpc.domain.work.get.useQuery({ id: workId }, { enabled: Number.isInteger(workId) && workId > 0, retry: false });
  const assetsQuery = trpc.domain.asset.list.useQuery(undefined, { retry: false });

  const linkAsset = trpc.domain.asset.linkToWork.useMutation({
    onSuccess: async () => {
      setSelectedAssetId(undefined);
      await utils.domain.work.get.invalidate({ id: workId });
    },
  });
  const unlinkAsset = trpc.domain.asset.unlinkFromWork.useMutation({
    onSuccess: async () => {
      await utils.domain.work.get.invalidate({ id: workId });
    },
  });
  const createVersion = trpc.domain.work.createVersion.useMutation({
    onSuccess: async () => {
      setVersionReason("");
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.domain.work.list.invalidate(),
      ]);
    },
  });

  const linkedIds = useMemo(() => new Set((workQuery.data?.assets ?? []).map(asset => asset.id)), [workQuery.data?.assets]);
  const availableAssets = useMemo(() => (assetsQuery.data ?? []).filter(asset => !linkedIds.has(asset.id)), [assetsQuery.data, linkedIds]);

  const makeSnapshot = () => {
    const work = workQuery.data;
    if (!work) return {};
    return {
      work: {
        id: work.id,
        title: work.title,
        type: work.type,
        ownerType: work.ownerType,
        ownerUserId: work.ownerUserId,
        ownerOrganizationId: work.ownerOrganizationId,
        status: work.status,
      },
      assets: work.assets.map(asset => ({ id: asset.id, title: asset.title, kind: asset.kind, role: asset.role, caption: asset.caption })),
      capturedAt: new Date().toISOString(),
    };
  };

  if (!Number.isInteger(workId) || workId <= 0) {
    return <div className="min-h-screen bg-[#F8FAFC] p-8 text-sm text-red-700" dir="rtl">معرّف العمل غير صالح.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <button onClick={() => setLocation("/work")} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-700">
            <ArrowRight className="h-4 w-4" /> العودة إلى أعمالي
          </button>

          {workQuery.isLoading && (
            <div className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل العمل...</div>
          )}

          {workQuery.error && (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{workQuery.error.message}</div>
          )}

          {workQuery.data && (
            <>
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      {workQuery.data.type === "report" ? <FileText className="h-5 w-5" /> : <FolderKanban className="h-5 w-5" />}
                    </div>
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{statusLabel[workQuery.data.status]}</span>
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">نسخة {workQuery.data.currentVersionNumber}</span>
                      </div>
                      <h1 className="mt-3 text-2xl font-black text-slate-950" style={{ fontFamily: "'Tajawal', sans-serif" }}>{workQuery.data.title}</h1>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
                        {workQuery.data.ownerType === "personal" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                        {workQuery.data.ownerType === "personal" ? "ملكية شخصية" : "ملكية مدرسية"}
                      </div>
                    </div>
                  </div>
                  <div className="rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs leading-6 text-teal-900">
                    الشواهد تبقى أصولًا مستقلة. إزالة الربط من هذا العمل لا تحذف الأصل من المكتبة.
                  </div>
                </div>
              </section>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-bold text-teal-700">إعادة الاستخدام</p><h2 className="mt-1 text-lg font-bold text-slate-950">الشواهد المرتبطة</h2></div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{workQuery.data.assets.length} شاهد</span>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <select value={selectedAssetId ?? ""} onChange={event => setSelectedAssetId(Number(event.target.value) || undefined)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                      <option value="">اختر شاهدًا من المكتبة</option>
                      {availableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.title} — {asset.kind}</option>)}
                    </select>
                    <button
                      onClick={() => selectedAssetId && linkAsset.mutate({ workItemId: workId, assetId: selectedAssetId, role: "evidence" })}
                      disabled={!selectedAssetId || linkAsset.isPending}
                      className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                    >
                      {linkAsset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ربط الشاهد
                    </button>
                  </div>
                  {linkAsset.error && <p className="mt-2 text-xs text-red-600">{linkAsset.error.message}</p>}

                  {workQuery.data.assets.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">لا توجد شواهد مرتبطة. أضفها من المكتبة بدل إعادة الرفع.</div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {workQuery.data.assets.map(asset => (
                        <div key={`${asset.id}-${asset.role}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-slate-50 text-slate-600"><Link2 className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{asset.title}</p><p className="mt-0.5 text-[11px] text-slate-500">{asset.kind} · {asset.role}</p></div>
                          <button
                            onClick={() => unlinkAsset.mutate({ workItemId: workId, assetId: asset.id, role: asset.role })}
                            disabled={unlinkAsset.isPending}
                            className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-50"
                            aria-label={`إزالة ربط ${asset.title}`}
                          ><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <p className="text-xs font-bold text-teal-700">نسخة ثابتة</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">إنشاء Version</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-500">النسخة تحفظ لقطة من بيانات العمل والشواهد الحالية. المراجعات والمخرجات اللاحقة يجب أن ترتبط بهذه النسخة بدل الحالة المتغيرة.</p>
                  <label className="mt-4 block text-xs font-bold text-slate-700">سبب إنشاء النسخة</label>
                  <textarea value={versionReason} onChange={event => setVersionReason(event.target.value)} maxLength={255} rows={3} placeholder="مثال: نسخة جاهزة للمراجعة" className="mt-2 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
                  <button
                    onClick={() => createVersion.mutate({ id: workId, reason: versionReason.trim() || undefined, snapshot: makeSnapshot() })}
                    disabled={createVersion.isPending}
                    className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {createVersion.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} إنشاء نسخة ثابتة
                  </button>
                  {createVersion.data && <p className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">تم إنشاء النسخة {createVersion.data.versionNumber} بنجاح.</p>}
                  {createVersion.error && <p className="mt-3 text-xs text-red-600">{createVersion.error.message}</p>}
                </section>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
