import { useEffect, useMemo, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileDown,
  FileText,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldAlert,
  X,
} from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { compareReportDraftToVersion } from "@shared/report-stale";

const REPORT_ACTION_PANEL_EVENT = "sers:report-action-panel-open";

type PdfArtifact = {
  type: "pdf" | "docx";
  outputId: number;
  workVersionId: number;
  versionNumber: number;
  fileSize?: number;
  filename: string;
  downloadUrl: string;
  reused: boolean;
};

function formatBytes(value?: number) {
  if (!value || value <= 0) return undefined;
  if (value < 1024) return `${value} بايت`;
  if (value < 1024 * 1024) return `${Math.ceil(value / 1024)} كيلوبايت`;
  return `${(value / (1024 * 1024)).toFixed(1)} ميجابايت`;
}

export default function ReportPdfActions() {
  const [matches, params] = useRoute<{ id: string }>("/work/:id/report");
  const workId = Number(params?.id);
  const validWorkId = matches && Number.isInteger(workId) && workId > 0;
  if (!validWorkId) return null;
  return <ReportArtifactSession key={workId} workId={workId} />;
}

function ReportArtifactSession({ workId }: { workId: number }) {
  const [format, setFormat] = useState<"pdf" | "docx">("pdf");
  const label = format === "pdf" ? "PDF" : "Word";
  const [open, setOpen] = useState(false);
  const [artifact, setArtifact] = useState<PdfArtifact | undefined>();
  const [continueWithOldVersion, setContinueWithOldVersion] = useState(false);

  const versionsQuery = trpc.reviewSupport.versions.useQuery(
    { workItemId: workId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const draftQuery = trpc.domain.reportDraft.get.useQuery(
    { workItemId: workId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const generateMutation = trpc.domain.output.generatePrivatePdf.useMutation();
  const downloadMutation = trpc.domain.output.downloadPrivatePdf.useMutation();
  const generateDocxMutation = trpc.workVersionDocx.generatePrivateDocx.useMutation();
  const downloadDocxMutation = trpc.workVersionDocx.getPrivateDocxDownload.useMutation();
  const generating = generateMutation.isPending || generateDocxMutation.isPending;
  const downloading = downloadMutation.isPending || downloadDocxMutation.isPending;

  const latestVersion = useMemo(() => {
    const versions = [...(versionsQuery.data ?? [])];
    return versions.sort((left, right) => right.versionNumber - left.versionNumber)[0];
  }, [versionsQuery.data]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const handleOtherPanel = (event: Event) => {
      const detail = (event as CustomEvent<{ panel?: string }>).detail;
      if (detail?.panel !== "pdf") setOpen(false);
    };
    window.addEventListener(REPORT_ACTION_PANEL_EVENT, handleOtherPanel);
    return () => window.removeEventListener(REPORT_ACTION_PANEL_EVENT, handleOtherPanel);
  }, []);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open]);

  const toggleOpen = () => {
    setOpen(value => {
      const next = !value;
      if (next && typeof window !== "undefined") {
        window.dispatchEvent(new CustomEvent(REPORT_ACTION_PANEL_EVENT, { detail: { panel: "pdf" } }));
      }
      return next;
    });
  };

  useEffect(() => {
    setArtifact(undefined);
    generateMutation.reset();
    downloadMutation.reset();
    generateDocxMutation.reset();
    downloadDocxMutation.reset();
    setContinueWithOldVersion(false);
  }, [latestVersion?.id, format, draftQuery.data?.draft.revision]);

  const freshness = compareReportDraftToVersion(draftQuery.data?.draft.revision, latestVersion);
  const guarded = freshness !== "fresh" && !continueWithOldVersion;

  const handleGenerate = async () => {
    if (!latestVersion || guarded) return;
    const generated = format === "pdf"
      ? await generateMutation.mutateAsync({ workVersionId: latestVersion.id })
      : await generateDocxMutation.mutateAsync({ workVersionId: latestVersion.id });
    setArtifact(generated as PdfArtifact);
  };

  const handleRefreshDownload = async () => {
    if (!artifact) return;
    const refreshed = artifact.type === "docx"
      ? await downloadDocxMutation.mutateAsync({ id: artifact.outputId })
      : await downloadMutation.mutateAsync({ id: artifact.outputId });
    setArtifact(current => current ? { ...current, ...(refreshed as PdfArtifact) } : refreshed as PdfArtifact);
  };

  const errorMessage = generateMutation.error?.message || downloadMutation.error?.message || generateDocxMutation.error?.message || downloadDocxMutation.error?.message;

  return (
    <div className="fixed bottom-24 left-4 z-50 lg:bottom-6 lg:left-6" dir="rtl">
      {open && (
        <section
          id="report-pdf-actions"
          className="mb-3 max-h-[calc(100dvh-11rem)] w-[min(92vw,390px)] overflow-y-auto overscroll-contain rounded-2xl border border-slate-200 bg-white shadow-2xl lg:max-h-[calc(100dvh-6rem)]"
          aria-label="إخراج المستند من نسخة التقرير"
        >
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-slate-950 px-4 py-4 text-white">
            <div className="flex min-w-0 items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                <FileText className="h-5 w-5" />
              </span>
              <div className="min-w-0">
                <p className="text-[11px] font-bold text-teal-200">مخرج خاص وآمن</p>
                <h2 className="mt-1 text-sm font-black">PDF وWord من النسخة الثابتة</h2>
                <p className="mt-1 text-[11px] leading-5 text-slate-300">لا يُنشأ من المعاينة أو من أحدث مسودة متغيرة.</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-200 hover:bg-white/10 hover:text-white"
              aria-label="إغلاق نافذة المخرجات"
            >
              <X className="h-5 w-5" />
            </button>
          </header>

          <div className="space-y-4 p-4">
            <div className="grid grid-cols-2 gap-2" role="group" aria-label="صيغة المستند">
              {(["pdf", "docx"] as const).map(value => (
                <button
                  key={value}
                  type="button"
                  disabled={generating || downloading}
                  aria-pressed={format === value}
                  onClick={() => setFormat(value)}
                  className={`min-h-11 rounded-xl border px-3 py-2 text-xs font-bold ${format === value ? "border-teal-700 bg-teal-50 text-teal-900" : "border-slate-200 text-slate-700 hover:bg-slate-50"}`}
                >
                  {value === "pdf" ? "PDF للطباعة" : "Word قابل للتعديل"}
                </button>
              ))}
            </div>
            {versionsQuery.isLoading && (
              <div role="status" className="flex items-center justify-center rounded-xl bg-slate-50 py-8 text-xs text-slate-600">
                <Loader2 className="ml-2 h-4 w-4 animate-spin" /> جاري تحميل النسخ...
              </div>
            )}

            {versionsQuery.error && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">
                <p>{versionsQuery.error.message}</p>
                <button
                  type="button"
                  onClick={() => void versionsQuery.refetch()}
                  className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-800 hover:bg-red-50"
                >
                  <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
                </button>
              </div>
            )}

            {!versionsQuery.isLoading && !versionsQuery.error && !latestVersion && (
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-900">
                <div className="flex items-start gap-2">
                  <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                  <p>احفظ التقرير ثم أنشئ «نسخة ثابتة» أولًا. لن يُصدر النظام مستندًا من مسودة غير مثبتة.</p>
                </div>
              </div>
            )}

            {latestVersion && (
              <>
                <div className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-3">
                  <div className="min-w-0">
                    <p className="text-[11px] font-bold text-slate-600">أحدث نسخة متاحة</p>
                    <p className="mt-1 text-sm font-black text-slate-950">نسخة {latestVersion.versionNumber}</p>
                    {latestVersion.reason && <p className="mt-1 line-clamp-2 text-[11px] text-slate-600">{latestVersion.reason}</p>}
                  </div>
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                    <LockKeyhole className="h-5 w-5" />
                  </span>
                </div>

                {!artifact && (
                  <>
                    {freshness !== "fresh" && (
                      <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900" role="alert">
                        <div className="flex items-start gap-2">
                          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
                          <p>{freshness === "stale" ? "المسودة الحالية أحدث من هذه النسخة الثابتة. أنشئ نسخة جديدة أو اختر متابعة النسخة القديمة صراحة." : "تعذر التحقق من مراجعة المسودة مقابل النسخة. لا يُسمح بالإخراج قبل اختيار متابعة النسخة القديمة صراحة."}</p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setContinueWithOldVersion(true)}
                          className="mt-2 min-h-11 rounded-lg border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-amber-950 hover:bg-amber-100"
                        >
                          متابعة النسخة القديمة على أي حال
                        </button>
                      </div>
                    )}
                    <button
                      type="button"
                      onClick={() => void handleGenerate().catch(() => undefined)}
                      disabled={generating || guarded}
                      className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-bold text-white shadow-sm transition hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileDown className="h-4 w-4" />}
                      {generating ? `جارٍ إنشاء ${label} من النسخة...` : `إنشاء ${label} خاص`}
                    </button>
                  </>
                )}

                {artifact && (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                    <div className="flex items-start gap-2 text-emerald-900">
                      <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-xs font-black">المخرج جاهز من نسخة {artifact.versionNumber}</p>
                        <p className="mt-1 break-all text-[11px] leading-5 text-emerald-800">
                          {artifact.reused ? "تم استخدام المخرج السابق نفسه دون إعادة إنشاء." : "تم إنشاء المخرج وتثبيت بصمته."}
                        </p>
                        {formatBytes(artifact.fileSize) && <p className="mt-1 text-[11px] text-emerald-800">الحجم: {formatBytes(artifact.fileSize)}</p>}
                      </div>
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-2">
                      <a
                        href={artifact.downloadUrl}
                        target="_blank"
                        rel="noreferrer"
                        download={artifact.filename}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800"
                      >
                        <Download className="h-4 w-4" /> تنزيل {artifact.type === "docx" ? "Word" : "PDF"}
                      </a>
                      <button
                        type="button"
                        onClick={() => void handleRefreshDownload().catch(() => undefined)}
                        disabled={downloading}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-emerald-900 hover:bg-emerald-50 disabled:opacity-60"
                      >
                        {downloading ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                        تحديث رابط التنزيل
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {errorMessage && (
              <div role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">
                <p>{errorMessage}</p>
                {latestVersion && !guarded && (
                  <button
                    type="button"
                    disabled={generating || downloading}
                    onClick={() => void (artifact ? handleRefreshDownload() : handleGenerate()).catch(() => undefined)}
                    className="mt-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg border border-red-300 bg-white px-3 py-2 font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"
                  >
                    <RefreshCw className="h-3.5 w-3.5" /> إعادة المحاولة
                  </button>
                )}
              </div>
            )}

            <p className="text-[11px] leading-5 text-slate-600">
              هذا المخرج خاص ويرتبط بالنسخة الثابتة. يمكنك تعديل نسخة Word التي تنزلها؛ التعديلات على جهازك لا تغيّر النسخة المحفوظة في النظام.
            </p>
          </div>
        </section>
      )}

      <button
        type="button"
        onClick={toggleOpen}
        aria-expanded={open}
        aria-controls="report-pdf-actions"
        className="inline-flex min-h-11 items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:bg-teal-700 focus:outline-none focus:ring-4 focus:ring-teal-200"
      >
        <FileDown className="h-5 w-5" />
        <span>تنزيل المستند</span>
        {latestVersion && <span className="rounded-full bg-white/15 px-2 py-0.5 text-[11px]">v{latestVersion.versionNumber}</span>}
      </button>
    </div>
  );
}
