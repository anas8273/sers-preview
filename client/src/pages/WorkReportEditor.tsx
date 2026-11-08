import { privateLocalStorage as localStorage } from "@/lib/private-browser-storage";
import { ReportDraftSession, type ReportDraftContent } from "@/lib/report-draft-session";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
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
import {
  REPORT_FONT_FAMILIES, REPORT_IDENTITY_FIELDS, REPORT_IDENTITY_TEXT_LIMIT, REPORT_MINISTRY_LOGO_ALT,
  REPORT_SCHOOL_LOGO_ALT, REPORT_SCHOOL_LOGO_MAX_BASE64, REPORT_SCHOOL_LOGO_MAX_DIMENSION,
  reportFontFamily, reportInstitution,
} from "@shared/report-appearance";
import ministryLogoUrl from "@shared/report-assets/ministry-logo.png";
import "./work-report-fonts.css";

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

type SaveState = "idle" | "dirty" | "saving" | "saved" | "offline" | "conflict" | "error";

type LocalBackup = ReportDraftContent & { baseRevision: number; updatedAt: string };
const emptyDraft: ReportDraftContent = { templateId: "custom", themeId: "classic", fontFamily: "Cairo", fields: {}, evidenceAssetIds: [] };

function contentOf({ templateId, themeId, fontFamily, fields, evidenceAssetIds }: ReportDraftContent): ReportDraftContent {
  return { templateId, themeId, fontFamily, fields, evidenceAssetIds };
}

function sameContent(a: ReportDraftContent, b: ReportDraftContent) {
  return a.templateId === b.templateId && a.themeId === b.themeId && a.fontFamily === b.fontFamily
    && Object.keys(a.fields).length === Object.keys(b.fields).length
    && Object.entries(a.fields).every(([key, value]) => b.fields[key] === value)
    && a.evidenceAssetIds.length === b.evidenceAssetIds.length
    && a.evidenceAssetIds.every((id, index) => id === b.evidenceAssetIds[index]);
}

function backupKey(workId: number) {
  return `sers:report-draft:${workId}`;
}

async function prepareSchoolLogo(file: File) {
  if (file.type !== "image/png" || file.size > 2 * 1024 * 1024) throw new Error("Choose a PNG up to 2 MiB");
  const header = new DataView(await file.slice(0, 24).arrayBuffer());
  if (header.byteLength !== 24 || header.getUint32(0) !== 0x89504e47 || header.getUint32(4) !== 0x0d0a1a0a || header.getUint32(12) !== 0x49484452
    || header.getUint32(16) > 4096 || header.getUint32(20) > 4096) throw new Error("Unsupported PNG");
  const image = await createImageBitmap(file);
  try {
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Image processing is unavailable");
    for (const max of [REPORT_SCHOOL_LOGO_MAX_DIMENSION, 224, 160]) {
      const scale = Math.min(1, max / Math.max(image.width, image.height));
      canvas.width = Math.max(1, Math.round(image.width * scale));
      canvas.height = Math.max(1, Math.round(image.height * scale));
      context.drawImage(image, 0, 0, canvas.width, canvas.height);
      const base64 = canvas.toDataURL("image/png").slice("data:image/png;base64,".length);
      if (base64 && base64.length <= REPORT_SCHOOL_LOGO_MAX_BASE64) return base64;
    }
    throw new Error("School logo exceeds the report limit");
  } finally { image.close(); }
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
  const [, params] = useRoute<{ id: string }>("/work/:id/report");
  const workId = Number(params?.id);
  if (!Number.isInteger(workId) || workId <= 0) {
    return <div className="min-h-screen bg-[#F8FAFC] p-8 text-sm text-red-700" dir="rtl">معرّف العمل غير صالح.</div>;
  }
  return <ReportEditor key={workId} workId={workId} />;
}

function ReportEditor({ workId }: { workId: number }) {
  const [location, setLocation] = useLocation();
  const sessionRef = useRef<ReportDraftSession | null>(null);
  const scope = useRef(localStorage.activeScope);
  const conflict = useRef(false);
  const backupRevision = useRef(0);
  const versionPending = useRef(false);
  const [creatingVersion, setCreatingVersion] = useState(false);
  const [revision, setRevision] = useState(0);
  const [draft, setDraft] = useState(emptyDraft);
  const { templateId, themeId, fontFamily, fields, evidenceAssetIds } = draft;
  const institution = reportInstitution(fields);
  const selectedFont = reportFontFamily(fontFamily);
  const logoRequest = useRef(0);
  const logoPending = useRef(false);
  const [processingLogo, setProcessingLogo] = useState(false);
  const [logoError, setLogoError] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [backupError, setBackupError] = useState(false);
  const [lastSavedAt, setLastSavedAt] = useState<string | undefined>();
  const [versionReason, setVersionReason] = useState("");
  const [createdVersion, setCreatedVersion] = useState<{ id: number; versionNumber: number; revision: number } | undefined>();
  const [selectedReviewerId, setSelectedReviewerId] = useState<number | undefined>();

  const utils = trpc.useUtils();
  const reportQuery = trpc.domain.reportDraft.get.useQuery(
    { workItemId: workId },
    { retry: false, refetchOnWindowFocus: false, refetchOnMount: "always" },
  );
  const workQuery = trpc.domain.work.get.useQuery(
    { id: workId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const organizationId = workQuery.data?.ownerType === "organization"
    ? workQuery.data.ownerOrganizationId ?? undefined
    : undefined;
  const reviewersQuery = trpc.reviewSupport.reviewers.useQuery(
    { organizationId: organizationId ?? 0 },
    { enabled: Boolean(organizationId), retry: false },
  );

  const { mutateAsync: writeDraft } = trpc.domain.reportDraft.save.useMutation();
  const createVersionMutation = trpc.domain.reportDraft.createVersion.useMutation();
  const requestReviewMutation = trpc.domain.review.request.useMutation();

  const isCurrent = useCallback((session: ReportDraftSession) =>
    sessionRef.current === session && scope.current === localStorage.activeScope, []);
  useLayoutEffect(() => () => { sessionRef.current = null; }, []);

  const updateBackup = useCallback((pending?: { content: ReportDraftContent; baseRevision: number }) => {
    try {
      if (pending) {
        const backup: LocalBackup = { ...pending.content, baseRevision: pending.baseRevision, updatedAt: new Date().toISOString() };
        localStorage.setItem(backupKey(workId), JSON.stringify(backup));
      } else {
        localStorage.removeItem(backupKey(workId));
      }
      setBackupError(false);
    } catch {
      // A device storage error must not interrupt saving to the server.
      setBackupError(true);
    }
  }, [workId]);

  const applyServerDraft = useCallback((data: NonNullable<typeof reportQuery.data>, recover: boolean) => {
    logoRequest.current++;
    logoPending.current = false;
    setProcessingLogo(false);
    setLogoError(false);
    const confirmed = contentOf(data.draft);
    const backup = recover ? parseBackup(workId) : undefined;
    const unsaved = backup && !sameContent(confirmed, backup) ? backup : undefined;
    const session = new ReportDraftSession(data.draft.revision, confirmed, unsaved && contentOf(unsaved));
    sessionRef.current = session;
    // An earlier save may have landed while this page was closed. Keep the
    // local edits visible for reconciliation instead of replaying a stale base.
    backupRevision.current = unsaved?.baseRevision ?? session.revision;
    versionPending.current = false;
    setCreatingVersion(false);
    conflict.current = Boolean(unsaved && unsaved.baseRevision !== session.revision);
    if (backup && !unsaved) updateBackup();
    setDraft(session.content);
    setRevision(session.revision);
    setLastSavedAt(data.draft.updatedAt);
    setCreatedVersion(undefined);
    setSaveState(conflict.current ? "conflict" : session.dirty ? (navigator.onLine ? "dirty" : "offline") : "saved");
  }, [workId, updateBackup]);

  useEffect(() => {
    if (reportQuery.data && reportQuery.isSuccess && !reportQuery.isFetching && !sessionRef.current) {
      applyServerDraft(reportQuery.data, true);
    }
  }, [applyServerDraft, reportQuery.data, reportQuery.isFetching, reportQuery.isSuccess]);

  const editDraft = (changes: Partial<ReportDraftContent> | ((current: ReportDraftContent) => Partial<ReportDraftContent>)) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session)) return;
    setDraft(session.edit(typeof changes === "function" ? changes(session.content) : changes));
    setCreatedVersion(undefined);
    // During a conflict the backup must keep its original revision until the
    // user chooses to discard it. Editing it must never unlock an overwrite.
    updateBackup({ content: session.content, baseRevision: backupRevision.current });
    if (!conflict.current) setSaveState(navigator.onLine ? "dirty" : "offline");
  };

  const editIdentity = (key: string, value: string) => editDraft(current => ({
    fields: { ...current.fields, reportIdentityVersion: "1", [key]: value },
  }));

  const changeSchoolLogo = async (file: File) => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || versionPending.current) return;
    const request = ++logoRequest.current;
    logoPending.current = true;
    setProcessingLogo(true);
    setLogoError(false);
    try {
      const logo = await prepareSchoolLogo(file);
      if (isCurrent(session) && request === logoRequest.current) editIdentity("schoolLogoPng", logo);
    } catch {
      if (isCurrent(session) && request === logoRequest.current) setLogoError(true);
    } finally {
      if (isCurrent(session) && request === logoRequest.current) {
        logoPending.current = false;
        setProcessingLogo(false);
      }
    }
  };

  const saveDraft = useCallback(async (): Promise<number | undefined> => {
    const session = sessionRef.current;
    if (!session || !isCurrent(session) || conflict.current) return;
    if (!navigator.onLine) { setSaveState("offline"); return; }
    try {
      return await session.flush(async (content, expectedRevision) => {
        if (!isCurrent(session) || !navigator.onLine) throw new Error("Report session unavailable");
        setSaveState("saving");
        return writeDraft({ workItemId: workId, expectedRevision, ...content });
      }, receipt => {
        if (!isCurrent(session)) return;
        backupRevision.current = receipt.revision;
        setRevision(receipt.revision);
        setLastSavedAt(receipt.updatedAt);
        if (session.dirty) {
          updateBackup({ content: session.content, baseRevision: receipt.revision });
        } else {
          updateBackup();
          setSaveState("saved");
        }
      });
    } catch (error) {
      if (isCurrent(session)) {
        conflict.current = (error as { data?: { code?: string } })?.data?.code === "CONFLICT";
        setSaveState(conflict.current ? "conflict" : navigator.onLine ? "error" : "offline");
      }
    }
  }, [isCurrent, workId, writeDraft, updateBackup]);

  useEffect(() => {
    if (saveState !== "dirty") return;
    const timer = window.setTimeout(() => void saveDraft(), 1400);
    return () => window.clearTimeout(timer);
  }, [draft, saveDraft, saveState]);

  useEffect(() => {
    const online = () => { if (sessionRef.current?.dirty && !conflict.current) void saveDraft(); };
    const offline = () => { if (sessionRef.current?.dirty && !conflict.current) setSaveState("offline"); };
    window.addEventListener("online", online);
    window.addEventListener("offline", offline);
    return () => {
      window.removeEventListener("online", online);
      window.removeEventListener("offline", offline);
    };
  }, [saveDraft]);

  const reloadFromServer = async () => {
    const session = sessionRef.current;
    const result = await reportQuery.refetch();
    if (session && isCurrent(session) && result.isSuccess) {
      updateBackup();
      applyServerDraft(result.data, false);
    }
  };

  const handleCreateVersion = async () => {
    const session = sessionRef.current;
    if (!session || versionPending.current || logoPending.current || conflict.current || !navigator.onLine) return;
    versionPending.current = true;
    setCreatingVersion(true);
    try {
      const currentRevision = await saveDraft();
      if (!currentRevision || !isCurrent(session) || session.dirty) return;
      const submitted = session.content;
      const version = await createVersionMutation.mutateAsync({
        workItemId: workId,
        expectedRevision: currentRevision,
        reason: versionReason.trim() || undefined,
      });
      if (!isCurrent(session)) return;
      if (session.content === submitted) {
        setCreatedVersion({ id: version.id, versionNumber: version.versionNumber, revision: currentRevision });
      }
      setVersionReason("");
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.domain.work.list.invalidate(),
        utils.reviewSupport.versions.invalidate({ workItemId: workId }),
      ]);
    } catch (error) {
      if (isCurrent(session) && (error as { data?: { code?: string } })?.data?.code === "CONFLICT") {
        conflict.current = true;
        setSaveState("conflict");
      }
    } finally {
      if (isCurrent(session)) {
        versionPending.current = false;
        setCreatingVersion(false);
      }
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
              <button onClick={() => void saveDraft()} disabled={saveState === "saving" || saveState === "saved" || saveState === "conflict" || saveState === "idle"} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} حفظ الآن
              </button>
            </div>
          </div>

          {(workQuery.isLoading || (saveState === "idle" && !reportQuery.error && !workQuery.error)) && (
            <div className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-20 text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل بيانات التقرير...</div>
          )}

          {(reportQuery.error || workQuery.error) && (
            <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">
              {reportQuery.error?.message || workQuery.error?.message}
            </div>
          )}

          {backupError && (
            <p role="alert" className="mt-4 text-sm text-amber-800">تعذّر تحديث نسخة الاسترداد على هذا الجهاز. أبقِ التقرير مفتوحًا حتى يكتمل الحفظ في الخادم.</p>
          )}

          {saveState === "conflict" && (
            <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-2"><AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" /><p>تختلف مراجعة الخادم عن مسودتك. يمكنك نسخ نصك قبل استبداله بنسخة الخادم.</p></div>
              <button onClick={() => void reloadFromServer()} className="inline-flex shrink-0 items-center justify-center gap-2 rounded-xl bg-amber-900 px-4 py-2 text-xs font-bold text-white"><RefreshCw className="h-4 w-4" />استبدال المسودة بنسخة الخادم</button>
            </div>
          )}

          {saveState !== "idle" && reportQuery.data && workQuery.data && (
            <div className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(420px,0.78fr)]">
              <div className="space-y-6">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="grid gap-4 md:grid-cols-3">
                    <label className="text-xs font-bold text-slate-700">نوع التقرير
                      <select value={templateId} onChange={event => editDraft({ templateId: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                        {templateOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700">الطابع البصري
                      <select value={themeId} onChange={event => editDraft({ themeId: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                        {themeOptions.map(option => <option key={option.id} value={option.id}>{option.label}</option>)}
                      </select>
                    </label>
                    <label className="text-xs font-bold text-slate-700">الخط
                      <select value={selectedFont} onChange={event => editDraft({ fontFamily: event.target.value })} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                        {selectedFont === "Arial" && <option value="Arial">Arial</option>}
                        {REPORT_FONT_FAMILIES.map(option => <option key={option} value={option}>{option}</option>)}
                      </select>
                    </label>
                  </div>
                  <p className="mt-4 text-xs leading-6 text-slate-500">المحتوى محفوظ كبيانات مستقلة عن القالب؛ تغيير الشكل لا يحذف النصوص أو الشواهد.</p>
                </section>

                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <h2 className="text-lg font-bold text-slate-950">هوية التقرير والتوقيع</h2>
                  <div className="mt-4 grid gap-4 md:grid-cols-3">
                    {REPORT_IDENTITY_FIELDS.map(({ key, label }) => (
                      <label key={key} className="text-xs font-bold text-slate-700">{label}
                        <input name={key} value={fields[key] ?? ""} maxLength={REPORT_IDENTITY_TEXT_LIMIT} onChange={event => editIdentity(key, event.target.value)} className="mt-2 w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm font-normal" />
                      </label>
                    ))}
                  </div>
                  <div className="mt-4 flex flex-wrap items-center gap-4 text-xs text-slate-700">
                    <label className="flex items-center gap-2"><input name="ministryLogo" type="checkbox" checked={institution.ministryLogo} onChange={event => editIdentity("ministryLogo", event.target.checked ? "yes" : "")} /> إظهار شعار وزارة التعليم</label>
                    <label className="flex flex-wrap items-center gap-2">شعار المدرسة (PNG)
                      <input name="schoolLogoPng" type="file" accept="image/png" disabled={creatingVersion} onChange={event => {
                        const file = event.currentTarget.files?.[0];
                        event.currentTarget.value = "";
                        if (file) void changeSchoolLogo(file);
                      }} />
                    </label>
                    {institution.schoolLogo && <button type="button" disabled={creatingVersion || processingLogo} className="text-red-700" onClick={() => { setLogoError(false); editIdentity("schoolLogoPng", ""); }}>إزالة شعار المدرسة</button>}
                  </div>
                  {processingLogo && <p role="status" className="mt-3 text-xs text-slate-600">جارٍ تجهيز شعار المدرسة...</p>}
                  {logoError && <p role="alert" className="mt-3 text-xs text-red-700">تعذّرت قراءة شعار المدرسة. اختر ملف PNG صالحًا حتى 2 ميغابايت.</p>}
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
                          onChange={event => editDraft(current => ({ fields: { ...current.fields, [field.key]: event.target.value } }))}
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
                              onChange={() => editDraft(current => ({ evidenceAssetIds: current.evidenceAssetIds.includes(asset.id)
                                ? current.evidenceAssetIds.filter(id => id !== asset.id) : [...current.evidenceAssetIds, asset.id] }))}
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
                  <button onClick={() => void handleCreateVersion()} disabled={creatingVersion || processingLogo || saveState === "conflict" || saveState === "offline" || (saveState === "saved" && revision === 0)} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
                    {creatingVersion ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileCheck2 className="h-4 w-4" />} إنشاء نسخة ثابتة
                  </button>
                  {createVersionMutation.error && <p className="mt-3 text-xs text-red-600">{createVersionMutation.error.message}</p>}
                  {createdVersion && <p className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">تم إنشاء النسخة {createdVersion.versionNumber} من مراجعة التقرير {createdVersion.revision}.</p>}

                  {createdVersion && organizationId && (
                    <div className="mt-5 border-t border-slate-100 pt-5">
                      <label className="block text-xs font-bold text-slate-700">المراجع
                        <select aria-label="مراجع التقرير" value={selectedReviewerId ?? ""} onChange={event => setSelectedReviewerId(Number(event.target.value) || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
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
                    <article className={`mx-auto min-h-[720px] max-w-[620px] bg-white p-7 shadow-sm sm:p-10 ${themeId === "formal" ? "border-t-8 border-teal-700" : themeId === "minimal" ? "border border-slate-200" : "border-t-8 border-slate-800"}`} style={{ fontFamily: selectedFont === "Arial" ? "Arial, sans-serif" : `'SERS ${selectedFont}', sans-serif` }}>
                      <div className="border-b border-slate-200 pb-5 text-center">
                        {(institution.ministryLogo || institution.schoolLogo) && <div className="mb-4 flex items-center justify-center gap-6">
                          {institution.ministryLogo && <img className="h-16 max-w-[40%] object-contain" src={ministryLogoUrl} alt={REPORT_MINISTRY_LOGO_ALT} />}
                          {institution.schoolLogo && <img className="h-16 max-w-[40%] object-contain" src={`data:image/png;base64,${institution.schoolLogo}`} alt={REPORT_SCHOOL_LOGO_ALT} />}
                        </div>}
                        {institution.schoolName && <p className="mb-2 break-words text-sm font-bold text-slate-800">{institution.schoolName}</p>}
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
                        {institution.visible && <div className="grid grid-cols-2 gap-4 border-t border-slate-200 pt-5 text-center">
                          {institution.signers.map(({ label, name }) => <div key={label} className="min-w-0 break-words">
                            <p className="text-xs font-bold">{label}</p><p className="mt-2 text-sm">{name}</p><div className="mx-auto mt-5 w-3/4 border-b border-slate-400" />
                          </div>)}
                        </div>}
                      </div>
                    </article>
                  </div>
                </section>
                <p className="mt-3 text-center text-[11px] leading-5 text-slate-500">يستخدم تصدير PDF وWord آخر نسخة ثابتة أنشأتها.</p>
                {lastSavedAt && <p className="mt-1 text-center text-[10px] text-slate-400">آخر حفظ خادمي: {new Date(lastSavedAt).toLocaleString("ar-SA")}</p>}
              </aside>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
