import { privateLocalStorage as localStorage } from "@/lib/private-browser-storage";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  CloudOff,
  FileCheck2,
  FileText,
  Loader2,
  RefreshCw,
  Save,
  Send,
  ShieldAlert,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";

const fieldDefinitions = [
  { key: "summary", label: "ملخص التقرير", placeholder: "اكتب ملخصًا موجزًا للعمل أو البرنامج المنفذ...", rows: 4 },
  { key: "objectives", label: "الأهداف", placeholder: "ما الأهداف التي سعى العمل إلى تحقيقها؟", rows: 4 },
  { key: "audience", label: "الفئة المستهدفة", placeholder: "مثال: منسوبات المدرسة، طالبات الصف الثالث...", rows: 2 },
  { key: "implementation", label: "آلية التنفيذ", placeholder: "صف خطوات التنفيذ الفعلية بترتيب واضح...", rows: 6 },
  { key: "results", label: "النتائج والمخرجات", placeholder: "ما النتائج الفعلية التي تحققت؟", rows: 4 },
  { key: "impact", label: "قياس الأثر", placeholder: "أدخل أداة القياس والنتيجة، أو وضّح أن القياس لم يُجمع بعد...", rows: 4 },
  { key: "recommendations", label: "التوصيات والخطوات التالية", placeholder: "أضف توصيات قابلة للتنفيذ...", rows: 4 },
] as const;

const templateOptions = [
  { id: "custom", label: "تقرير عام" },
  { id: "program-report", label: "تقرير برنامج" },
  { id: "initiative-report", label: "تقرير مبادرة" },
  { id: "workshop-report", label: "تقرير ورشة" },
  { id: "meeting-report", label: "محضر/تقرير اجتماع" },
  { id: "visit-report", label: "تقرير زيارة" },
];

const themeOptions = [
  { id: "classic", label: "رسمي كلاسيكي" },
  { id: "formal", label: "مؤسسي هادئ" },
  { id: "minimal", label: "بسيط حديث" },
];

const fontOptions = ["Cairo", "Tajawal", "Noto Kufi Arabic"];

type SaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict" | "error";

type LocalBackup = {
  baseRevision: number;
  updatedAt: string;
  templateId: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, string>;
  evidenceAssetIds: number[];
};

function backupKey(workId: number) {
  return `sers:report-draft:${workId}`;
}

function parseBackup(workId: number): LocalBackup | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = localStorage.getItem(backupKey(workId));
    if (!raw) return undefined;
    const parsed = JSON.parse(raw) as Partial<LocalBackup>;
    if (!Number.isInteger(parsed.baseRevision) || typeof parsed.updatedAt !== "string") return undefined;
    if (!parsed.fields || typeof parsed.fields !== "object") return undefined;
    return {
      baseRevision: Number(parsed.baseRevision),
      updatedAt: parsed.updatedAt,
      templateId: typeof parsed.templateId === "string" ? parsed.templateId : "custom",
      themeId: typeof parsed.themeId === "string" ? parsed.themeId : "classic",
      fontFamily: typeof parsed.fontFamily === "string" ? parsed.fontFamily : "Cairo",
      fields: Object.fromEntries(Object.entries(parsed.fields).filter(([, value]) => typeof value === "string")) as Record<string, string>,
      evidenceAssetIds: Array.isArray(parsed.evidenceAssetIds)
        ? parsed.evidenceAssetIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
        : [],
    };
  } catch {
    return undefined;
  }
}

const saveStateText: Record<SaveState, string> = {
  idle: "جاهز",
  dirty: "تغييرات غير محفوظة",
  saving: "جارٍ الحفظ...",
  saved: "محفوظ في الخادم",
  offline: "غير متصل بالخادم",
  conflict: "يوجد تعارض مع نسخة أحدث",
  error: "تعذر الحفظ",
};

export default function WorkReportEditor() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/work/:id/report");
  const workId = Number(params?.id);
  const validWorkId = Number.isInteger(workId) && workId > 0;
  const initializedRef = useRef(false);
  const saveInFlightRef = useRef(false);

  const [revision, setRevision] = useState(0);
  const [templateId, setTemplateId] = useState("custom");
  const [themeId, setThemeId] = useState("classic");
  const [fontFamily, setFontFamily] = useState("Cairo");
  const [fields, setFields] = useState<Record<string, string>>({});
  const [evidenceAssetIds, setEvidenceAssetIds] = useState<number[]>([]);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [versionReason, setVersionReason] = useState("");
  const [createdVersion, setCreatedVersion] = useState<{ id: number; versionNumber: number } | undefined>();
  const [selectedReviewerId, setSelectedReviewerId] = useState<number | undefined>();

  const utils = trpc.useUtils();
  const reportQuery = trpc.domain.reportDraft.get.useQuery(
    { workItemId: workId },
    { enabled: validWorkId, retry: false, refetchOnWindowFocus: false },
  );
  const workQuery = trpc.domain.work.get.useQuery(
    { id: workId },
    { enabled: validWorkId, retry: false, refetchOnWindowFocus: false },
  );
  const organizationId = workQuery.data?.ownerType === "organization"
    ? workQuery.data.ownerOrganizationId ?? undefined
    : undefined;
  const reviewersQuery = trpc.reviewSupport.reviewers.useQuery(
    { organizationId: organizationId ?? 0 },
    { enabled: Boolean(organizationId), retry: false },
  );

  const saveMutation = trpc.domain.reportDraft.save.useMutation();
  const createVersionMutation = trpc.domain.reportDraft.createVersion.useMutation();
  const requestReviewMutation = trpc.domain.review.request.useMutation();

  const applyServerDraft = useCallback((data: NonNullable<typeof reportQuery.data>, allowLocalBackup: boolean) => {
    const serverDraft = data.draft;
    const backup = allowLocalBackup ? parseBackup(workId) : undefined;
    const serverUpdatedAt = Date.parse(serverDraft.updatedAt || "") || 0;
    const backupUpdatedAt = backup ? Date.parse(backup.updatedAt) || 0 : 0;
    const canRestoreBackup = backup
      && backup.baseRevision === serverDraft.revision
      && backupUpdatedAt > serverUpdatedAt;

    setRevision(serverDraft.revision);
    setTemplateId(canRestoreBackup ? backup.templateId : serverDraft.templateId);
    setThemeId(canRestoreBackup ? backup.themeId : serverDraft.themeId);
    setFontFamily(canRestoreBackup ? backup.fontFamily : serverDraft.fontFamily);
    setFields(canRestoreBackup ? backup.fields : serverDraft.fields);
    setEvidenceAssetIds(canRestoreBackup ? backup.evidenceAssetIds : serverDraft.evidenceAssetIds);
    setLastSavedAt(serverDraft.updatedAt);
    setSaveState(canRestoreBackup ? "dirty" : "saved");
    initializedRef.current = true;
  }, [reportQuery.data, workId]);

  useEffect(() => {
    if (reportQuery.data && !initializedRef.current) applyServerDraft(reportQuery.data, true);
  }, [applyServerDraft, reportQuery.data]);

  useEffect(() => {
    if (!initializedRef.current || typeof window === "undefined") return;
    if (saveState === "saved" || saveState === "idle") {
      localStorage.removeItem(backupKey(workId));
      return;
    }
    const backup: LocalBackup = {
      baseRevision: revision,
      updatedAt: new Date().toISOString(),
      templateId,
      themeId,
      fontFamily,
      fields,
      evidenceAssetIds,
    };
    try {
      localStorage.setItem(backupKey(workId), JSON.stringify(backup));
    } catch {
      // The server remains the source of truth; inability to persist a browser backup is non-fatal.
    }
  }, [evidenceAssetIds, fields, fontFamily, revision, saveState, templateId, themeId, workId]);

  const markDirty = useCallback(() => {
    if (!initializedRef.current) return;
    setSaveState(typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "dirty");
  }, []);

  const saveDraft = useCallback(async (): Promise<number | undefined> => {
    if (!initializedRef.current || saveInFlightRef.current) return undefined;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setSaveState("offline");
      return undefined;
    }

    saveInFlightRef.current = true;
    setSaveState("saving");
    try {
      const saved = await saveMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: revision,
        templateId,
        themeId,
        fontFamily,
        fields,
        evidenceAssetIds,
      });
      setRevision(saved.revision);
      setLastSavedAt(saved.updatedAt);
      setSaveState("saved");
      if (typeof window !== "undefined") localStorage.removeItem(backupKey(workId));
      return saved.revision;
    } catch (error) {
      const code = (error as { data?: { code?: string } })?.data?.code;
      setSaveState(code === "CONFLICT" ? "conflict" : "error");
      return undefined;
    } finally {
      saveInFlightRef.current = false;
    }
  }, [evidenceAssetIds, fields, fontFamily, revision, saveMutation, templateId, themeId, workId]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void saveDraft(), 1400);
    return () => window.clearTimeout(timer);
  }, [saveDraft, saveState]);

  useEffect(() => {
    const handleOnline = () => {
      if (saveState === "offline" || saveState === "dirty" || saveState === "error") void saveDraft();
    };
    const handleOffline = () => setSaveState(current => current === "saved" ? current : "offline");
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [saveDraft, saveState]);

  const reloadFromServer = useCallback(async () => {
    const result = await reportQuery.refetch();
    if (result.data) {
      if (typeof window !== "undefined") localStorage.removeItem(backupKey(workId));
      applyServerDraft(result.data, false);
    }
  }, [applyServerDraft, reportQuery, workId]);

  const handleCreateVersion = async () => {
    let currentRevision = revision;
    if (saveState !== "saved") {
      const savedRevision = await saveDraft();
      if (!savedRevision) return;
      currentRevision = savedRevision;
    }
    try {
      const version = await createVersionMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: currentRevision,
        reason: versionReason.trim() || undefined,
      });
      setCreatedVersion({ id: version.id, versionNumber: version.versionNumber });
      setVersionReason("");
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.domain.work.list.invalidate(),
        utils.reviewSupport.versions.invalidate({ workItemId: workId }),
      ]);
    } catch (error) {
      const code = (error as { data?: { code?: string } })?.data?.code;
      if (code === "CONFLICT") setSaveState("conflict");
    }
  };

  const handleRequestReview = async () => {
    if (!createdVersion || !selectedReviewerId) return;
    await requestReviewMutation.mutateAsync({
      workVersionId: createdVersion.id,
      reviewerUserId: selectedReviewerId,
    });
    await Promise.all([
      utils.domain.review.list.invalidate(),
      utils.domain.work.get.invalidate({ id: workId }),
      utils.domain.work.list.invalidate(),
    ]);
    setLocation("/reviews");
  };

  const linkedAssets = workQuery.data?.assets ?? [];
  const selectedEvidence = useMemo(
    () => linkedAssets.filter(asset => evidenceAssetIds.includes(asset.id)),
    [evidenceAssetIds, linkedAssets],
  );
  const filledFields = fieldDefinitions.filter(field => fields[field.key]?.trim());

  if (!validWorkId) {
    return <div className="min-h-screen bg-[#F8FAFC] p-8 text-sm text-red-700" dir="rtl">معرّف العمل غير صالح.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-[1500px] px-4 py-6 sm:px-6 sm:py-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <button onClick={() => setLocation(`/work/${workId}`)} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-teal-700">
                <ArrowRight className="h-4 w-4" /> العودة إلى العمل
              </button>
              <div className="mt-3 flex items-center gap-3">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-teal-50 text-teal-700"><FileText className="h-5 w-5" /></div>
                <div>
                  <p className="text-xs font-bold text-teal-700">محرر التقرير المرتبط بالعمل</p>
                  <h1 className="text-xl font-black text-slate-950 sm:text-2xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                    {reportQuery.data?.work.title || workQuery.data?.title || "جاري تحميل التقرير..."}
                  </h1>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                saveState === "saved" ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : saveState === "conflict" ? "border-amber-200 bg-amber-50 text-amber-800"
                    : saveState === "error" ? "border-red-200 bg-red-50 text-red-700"
                      : saveState === "offline" ? "border-slate-300 bg-slate-100 text-slate-700"
                        : "border-teal-200 bg-teal-50 text-teal-700"
              }`}>
                {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" />
                  : saveState === "offline" ? <CloudOff className="h-4 w-4" />
                    : saveState === "saved" ? <CheckCircle2 className="h-4 w-4" />
                      : saveState === "conflict" ? <ShieldAlert className="h-4 w-4" />
                        : <Cloud className="h-4 w-4" />}
                {saveStateText[saveState]}
              </div>
              <button onClick={() => void saveDraft()} disabled={saveState === "saving" || saveState === "saved"} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الآن
              </button>
            </div>
          </div>

          {(reportQuery.isLoading || workQuery.isLoading) && (
            <div className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل بيانات التقرير...</div>
          )}

          {(reportQuery.error || workQuery.error) && (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {reportQuery.error?.message || workQuery.error?.message}
            </div>
          )}

          {saveState === "conflict" && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>توجد نسخة أحدث محفوظة من جلسة أخرى. أبقينا تعديلاتك محليًا ولم نستبدل بيانات الخادم.</p></div>
              <button onClick={() => void reloadFromServer()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" />تحميل نسخة الخادم</button>
            </div>
          )}

          {reportQuery.data && workQuery.data && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-xs font-bold text-slate-700">نوع التقرير
                      <select value={templateId} onChange={event => { setTemplateId(event.target.value); markDirty(); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                        {templateOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700">الطابع البصري
                      <select value={themeId} onChange={event => { setThemeId(event.target.value); markDirty(); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                        {themeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700">الخط
                      <select value={fontFamily} onChange={event => { setFontFamily(event.target.value); markDirty(); }} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                        {fontOptions.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">المحتوى محفوظ كبيانات مستقلة عن القالب؛ تغيير الشكل لا يحذف النصوص أو الشواهد.</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-bold text-teal-700">محتوى التقرير</p><h2 className="mt-1 text-lg font-bold text-slate-950">البيانات الأساسية</h2></div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">مراجعة {revision}</span>
                  </div>
                  <div className="mt-5 space-y-5">
                    {fieldDefinitions.map(field => (
                      <label key={field.key} className="block text-xs font-bold text-slate-700">{field.label}
                        <textarea
                          value={fields[field.key] ?? ""}
                          onChange={event => {
                            setFields(current => ({ ...current, [field.key]: event.target.value }));
                            markDirty();
                          }}
                          rows={field.rows}
                          maxLength={20_000}
                          placeholder={field.placeholder}
                          className="mt-2 w-full resize-y rounded-xl border border-slate-200 px-3 py-3 text-sm font-normal leading-7 outline-none transition focus:border-teal-400 focus:ring-2 focus:ring-teal-100"
                        />
                      </label>
                    ))}
                  </div>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-bold text-teal-700">الشواهد</p><h2 className="mt-1 text-lg font-bold text-slate-950">تحديد الشواهد المستخدمة داخل التقرير</h2></div>
                    <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[10px] font-bold text-teal-700">{evidenceAssetIds.length} محدد</span>
                  </div>
                  {linkedAssets.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-500">اربط الشواهد بالعمل أولًا من صفحة تفاصيل العمل، ثم اختر ما يظهر في التقرير.</div>
                  ) : (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {linkedAssets.map(asset => {
                        const checked = evidenceAssetIds.includes(asset.id);
                        return (
                          <label key={`${asset.id}-${asset.role}`} className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${checked ? "border-teal-300 bg-teal-50" : "border-slate-200 bg-white hover:border-slate-300"}`}>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setEvidenceAssetIds(current => checked ? current.filter(id => id !== asset.id) : [...current, asset.id]);
                                markDirty();
                              }}
                              className="mt-1 h-4 w-4 accent-teal-600"
                            />
                            <span className="min-w-0"><span className="block truncate text-sm font-bold text-slate-900">{asset.title}</span><span className="mt-1 block text-[11px] text-slate-500">{asset.kind} · {asset.role}</span></span>
                          </label>
                        );
                      })}
                    </div>
                  )}
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <p className="text-xs font-bold text-teal-700">نسخة غير قابلة للتغيير</p>
                  <h2 className="mt-1 text-lg font-bold text-slate-950">حفظ نسخة للمراجعة أو الإخراج</h2>
                  <p className="mt-2 text-xs leading-6 text-slate-500">ينشئ النظام نسخة من المسودة المحفوظة في الخادم والشواهد المرتبطة، لا من الصفحة المعروضة في المتصفح.</p>
                  <textarea value={versionReason} onChange={event => setVersionReason(event.target.value)} rows={2} maxLength={255} placeholder="سبب إنشاء النسخة، مثل: جاهزة للمراجعة" className="mt-4 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100" />
                  <button onClick={() => void handleCreateVersion()} disabled={createVersionMutation.isPending || saveState === "conflict" || saveState === "offline"} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {createVersionMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} إنشاء نسخة ثابتة
                  </button>
                  {createVersionMutation.error && <p className="mt-3 text-xs text-red-600">{createVersionMutation.error.message}</p>}
                  {createdVersion && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">تم إنشاء النسخة {createdVersion.versionNumber} من مراجعة التقرير {revision}.</p>}

                  {createdVersion && organizationId && (
                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <label className="block text-xs font-bold text-slate-700">المراجع
                        <select value={selectedReviewerId ?? ""} onChange={event => setSelectedReviewerId(Number(event.target.value) || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                          <option value="">اختر مراجعًا من المدرسة</option>
                          {(reviewersQuery.data ?? []).map(reviewer => <option key={reviewer.userId} value={reviewer.userId}>{reviewer.name || `مستخدم ${reviewer.userId}`} — {reviewer.role}</option>)}
                        </select>
                      </label>
                      <button onClick={() => void handleRequestReview()} disabled={!selectedReviewerId || requestReviewMutation.isPending} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-50">
                        {requestReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال النسخة للمراجعة
                      </button>
                      {requestReviewMutation.error && <p className="mt-3 text-xs text-red-600">{requestReviewMutation.error.message}</p>}
                    </div>
                  )}
                </section>
              </div>

              <aside className="xl:sticky xl:top-6 xl:h-fit">
                <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                  <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
                    <div><p className="text-xs font-bold text-teal-700">معاينة لحظية</p><h2 className="mt-1 text-base font-bold text-slate-950">شكل المحتوى قبل إنشاء النسخة</h2></div>
                    <span className="text-[10px] font-bold text-slate-500">ليست مخرجًا معتمدًا</span>
                  </div>
                  <div className="bg-slate-100 p-4 sm:p-6">
                    <article className={`mx-auto min-h-[720px] max-w-[620px] bg-white p-7 shadow-sm sm:p-10 ${themeId === "formal" ? "border-t-8 border-teal-700" : themeId === "minimal" ? "border border-slate-200" : "border-t-8 border-slate-800"}`} style={{ fontFamily }}>
                      <div className="border-b border-slate-200 pb-5 text-center">
                        <p className="text-xs font-bold text-teal-700">SERS</p>
                        <h2 className="mt-2 text-xl font-black text-slate-950">{workQuery.data.title}</h2>
                        <p className="mt-2 text-xs text-slate-500">{templateOptions.find(option => option.id === templateId)?.label}</p>
                      </div>
                      <div className="mt-6 space-y-6">
                        {filledFields.length === 0 ? (
                          <div className="rounded-xl border border-dashed border-slate-200 px-4 py-16 text-center text-sm text-slate-400">ابدأ بإدخال بيانات التقرير لتظهر المعاينة هنا.</div>
                        ) : filledFields.map(field => (
                          <section key={field.key}>
                            <h3 className="text-sm font-black text-slate-900">{field.label}</h3>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-8 text-slate-700">{fields[field.key]}</p>
                          </section>
                        ))}
                        {selectedEvidence.length > 0 && (
                          <section>
                            <h3 className="text-sm font-black text-slate-900">الشواهد المرفقة</h3>
                            <div className="mt-3 space-y-2">
                              {selectedEvidence.map(asset => <div key={asset.id} className="rounded-lg border border-slate-200 px-3 py-2 text-xs text-slate-700">{asset.title} · {asset.kind}</div>)}
                            </div>
                          </section>
                        )}
                      </div>
                    </article>
                  </div>
                </section>
                <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">سيتم لاحقًا توليد PDF وWord من WorkVersion نفسها، وليس من DOM هذه المعاينة.</p>
                {lastSavedAt && <p className="mt-1 text-center text-[10px] text-slate-400">آخر حفظ خادمي: {new Date(lastSavedAt).toLocaleString("ar-SA")}</p>}
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
