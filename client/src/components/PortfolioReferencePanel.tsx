import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, FileCheck2, FolderKanban, Loader2, Plus, Save, Trash2 } from "lucide-react";
import { computePortfolioReadiness, type PortfolioEntry } from "@shared/portfolio-projection";
import { trpc } from "@/lib/trpc";

type PortfolioReferencePanelProps = {
  workId: number;
  ownerType: string;
  ownerOrganizationId: number | null;
  canWrite?: boolean;
};

const readinessStyle = {
  ready: "border-emerald-200 bg-emerald-50 text-emerald-800",
  needs_attention: "border-amber-200 bg-amber-50 text-amber-900",
  incomplete: "border-slate-200 bg-slate-100 text-slate-700",
} as const;

export default function PortfolioReferencePanel({
  workId,
  ownerType,
  ownerOrganizationId,
  canWrite = true,
}: PortfolioReferencePanelProps) {
  const utils = trpc.useUtils();
  const draftQuery = trpc.domain.portfolioDraft.get.useQuery({ workItemId: workId }, { retry: false });
  const worksQuery = trpc.domain.work.list.useQuery(undefined, { retry: false });
  const assetsQuery = trpc.domain.asset.list.useQuery(undefined, { retry: false });

  const [introduction, setIntroduction] = useState("");
  const [entries, setEntries] = useState<PortfolioEntry[]>([]);
  const [revision, setRevision] = useState(0);
  const [dirty, setDirty] = useState(false);

  const [newKind, setNewKind] = useState<"work" | "asset">("work");
  const [newRefId, setNewRefId] = useState<number | undefined>();
  const [newSectionTitle, setNewSectionTitle] = useState("الأعمال والتقارير");
  const [versionReason, setVersionReason] = useState("");
  const [statusMessage, setStatusMessage] = useState<string | undefined>();

  useEffect(() => {
    setDirty(false);
    setStatusMessage(undefined);
    setNewRefId(undefined);
    setVersionReason("");
  }, [workId]);

  useEffect(() => {
    if (draftQuery.data && !dirty) {
      setIntroduction(draftQuery.data.draft.introduction);
      setEntries(draftQuery.data.draft.entries);
      setRevision(draftQuery.data.draft.revision);
    }
  }, [draftQuery.data, dirty]);

  const saveMutation = trpc.domain.portfolioDraft.save.useMutation({
    onSuccess: async result => {
      setRevision(result.draft.revision);
      setDirty(false);
      setStatusMessage("تم حفظ مسودة ملف الإنجاز المرجعي.");
      await utils.domain.portfolioDraft.get.invalidate({ workItemId: workId });
    },
  });

  const createVersionMutation = trpc.domain.portfolioDraft.createVersion.useMutation({
    onSuccess: async result => {
      setVersionReason("");
      setStatusMessage(`تم تثبيت النسخة ${result.versionNumber} من ملف الإنجاز المرجعي.`);
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.reviewSupport.versions.invalidate({ workItemId: workId }),
        utils.domain.portfolioDraft.get.invalidate({ workItemId: workId }),
      ]);
    },
  });

  const sameScopeWorks = useMemo(
    () => (worksQuery.data ?? []).filter(work =>
      work.id !== workId
      && work.type === "report"
      && work.ownerType === ownerType
      && (ownerType === "personal" || work.ownerOrganizationId === ownerOrganizationId)
      && !entries.some(entry => entry.kind === "work" && entry.refId === work.id)),
    [worksQuery.data, workId, ownerType, ownerOrganizationId, entries],
  );

  const sameScopeAssets = useMemo(
    () => (assetsQuery.data ?? []).filter(asset =>
      asset.ownerType === ownerType
      && (ownerType === "personal" || asset.ownerOrganizationId === ownerOrganizationId)
      && !entries.some(entry => entry.kind === "asset" && entry.refId === asset.id)),
    [assetsQuery.data, ownerType, ownerOrganizationId, entries],
  );

  const readiness = useMemo(
    () => computePortfolioReadiness({ introduction, entries }),
    [introduction, entries],
  );

  const titleByRef = useMemo(() => {
    const map = new Map<string, string>();
    for (const resolved of draftQuery.data?.resolvedEntries ?? []) {
      map.set(`${resolved.kind}:${resolved.refId}`, resolved.title);
    }
    for (const work of worksQuery.data ?? []) map.set(`work:${work.id}`, work.title);
    for (const asset of assetsQuery.data ?? []) map.set(`asset:${asset.id}`, asset.title);
    return map;
  }, [draftQuery.data?.resolvedEntries, worksQuery.data, assetsQuery.data]);

  const addEntry = () => {
    if (!newRefId || !newSectionTitle.trim()) return;
    setEntries(current => [
      ...current,
      {
        id: `${newKind}-${newRefId}`,
        sectionTitle: newSectionTitle.trim(),
        kind: newKind,
        refId: newRefId,
      },
    ]);
    setNewRefId(undefined);
    setDirty(true);
    setStatusMessage(undefined);
  };

  const removeEntry = (id: string) => {
    setEntries(current => current.filter(item => item.id !== id));
    setDirty(true);
    setStatusMessage(undefined);
  };

  const handleSave = () => {
    setStatusMessage(undefined);
    saveMutation.mutate({
      workItemId: workId,
      expectedRevision: revision,
      introduction,
      entries,
    });
  };

  const handleCreateVersion = async () => {
    setStatusMessage(undefined);
    let currentRev = revision;
    if (dirty || currentRev === 0) {
      const saved = await saveMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: currentRev,
        introduction,
        entries,
      });
      currentRev = saved.draft.revision;
    }
    await createVersionMutation.mutateAsync({
      workItemId: workId,
      expectedRevision: currentRev,
      reason: versionReason.trim() || undefined,
    });
  };

  return (
    <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <FolderKanban className="h-5 w-5 text-teal-700" />
          <div>
            <p className="text-xs font-bold text-teal-700">تجميع مرجعي دون تكرار الملفات</p>
            <h2 className="text-lg font-bold text-slate-950">ملف الإنجاز المرجعي</h2>
          </div>
        </div>
        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-bold ${readinessStyle[readiness.status]}`}>
          {readiness.status === "ready" && <CheckCircle2 className="h-3.5 w-3.5" />}
          {readiness.label}
        </span>
      </div>

      {readiness.missingReasons.length > 0 && (
        <ul className="mt-3 list-disc space-y-1 pr-5 text-xs text-slate-600">
          {readiness.missingReasons.map(reason => <li key={reason}>{reason}</li>)}
        </ul>
      )}

      <label className="mt-4 block text-xs font-bold text-slate-700">
        مقدمة ملف الإنجاز
        <textarea
          rows={3}
          maxLength={5000}
          disabled={!canWrite}
          value={introduction}
          onChange={event => { setIntroduction(event.target.value); setDirty(true); }}
          placeholder="ملخص تعريفي لملف الإنجاز والفترة المستهدفة..."
          className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal outline-none focus:border-teal-500 focus:ring-2 focus:ring-teal-100 disabled:opacity-60"
        />
      </label>

      {canWrite && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50/70 p-3.5">
          <p className="text-xs font-bold text-slate-800">إضافة مرجع (عمل أو شاهد من نفس المساحة)</p>
          <div className="mt-2.5 grid gap-2 sm:grid-cols-3">
            <select
              aria-label="نوع المرجع"
              value={newKind}
              onChange={event => { setNewKind(event.target.value as "work" | "asset"); setNewRefId(undefined); }}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <option value="work">تقرير محفوظ</option>
              <option value="asset">شاهد من المكتبة</option>
            </select>
            <select
              aria-label="اختيار المرجع"
              value={newRefId ?? ""}
              onChange={event => setNewRefId(Number(event.target.value) || undefined)}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
            >
              <option value="">{newKind === "work" ? "اختر تقريرًا" : "اختر شاهدًا"}</option>
              {newKind === "work"
                ? sameScopeWorks.map(work => <option key={work.id} value={work.id}>{work.title}</option>)
                : sameScopeAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.title}</option>)}
            </select>
            <input
              type="text"
              aria-label="عنوان القسم"
              value={newSectionTitle}
              maxLength={128}
              onChange={event => setNewSectionTitle(event.target.value)}
              placeholder="عنوان القسم"
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs"
            />
          </div>
          <button
            type="button"
            onClick={addEntry}
            disabled={!newRefId || !newSectionTitle.trim()}
            className="mt-2.5 inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-teal-300 bg-white px-3.5 py-2 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50"
          >
            <Plus className="h-4 w-4" /> إضافة إلى ملف الإنجاز
          </button>
        </div>
      )}

      {entries.length > 0 && (
        <ul className="mt-4 space-y-2">
          {entries.map(entry => (
            <li key={entry.id} className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs">
              <div className="min-w-0">
                <span className="block truncate font-bold text-slate-900">
                  {titleByRef.get(`${entry.kind}:${entry.refId}`) ?? `#${entry.refId}`}
                </span>
                <span className="text-[11px] text-slate-600">
                  {entry.sectionTitle} · {entry.kind === "work" ? "تقرير مرجعي" : "شاهد مرجعي"}
                </span>
              </div>
              {canWrite && (
                <button
                  type="button"
                  onClick={() => removeEntry(entry.id)}
                  aria-label={`إزالة ${titleByRef.get(`${entry.kind}:${entry.refId}`) ?? entry.refId}`}
                  className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      {canWrite && (
        <>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={!dirty || saveMutation.isPending}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-slate-900 px-4 py-2 text-xs font-bold text-white hover:bg-slate-800 disabled:opacity-50"
            >
              {saveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              حفظ المسودة المرجعية
            </button>
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <input
              type="text"
              value={versionReason}
              onChange={event => setVersionReason(event.target.value)}
              maxLength={255}
              placeholder="سبب تثبيت النسخة (اختياري)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs"
            />
            <button
              type="button"
              onClick={() => void handleCreateVersion().catch(() => undefined)}
              disabled={entries.length === 0 || saveMutation.isPending || createVersionMutation.isPending}
              className="mt-2.5 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50"
            >
              {createVersionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />}
              تثبيت نسخة ملف الإنجاز
            </button>
          </div>
        </>
      )}

      {statusMessage && <p role="status" className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-800">{statusMessage}</p>}
      {(saveMutation.error || createVersionMutation.error) && (
        <p role="alert" className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
          {saveMutation.error?.message || createVersionMutation.error?.message}
        </p>
      )}
    </section>
  );
}
