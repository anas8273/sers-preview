import React, { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  Check,
  Copy,
  KeyRound,
  Link2,
  Loader2,
  LockKeyhole,
  QrCode,
  Share2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import QRCode from "qrcode";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";
import { compareReportDraftToVersion } from "@shared/report-stale";
import { useAuth } from "@/_core/hooks/useAuth";

type CreatedOutput = {
  id: number;
  token: string | null;
  type: "link" | "qr";
  visibility: "protected" | "public";
  expiresAt: Date | null;
};

const expiryOptions = [
  { value: "24h", label: "24 ساعة", milliseconds: 24 * 60 * 60 * 1000 },
  { value: "7d", label: "7 أيام", milliseconds: 7 * 24 * 60 * 60 * 1000 },
  { value: "30d", label: "30 يومًا", milliseconds: 30 * 24 * 60 * 60 * 1000 },
  { value: "never", label: "دون تاريخ انتهاء", milliseconds: undefined },
] as const;

export default function ReportShareActions() {
  const [matches, params] = useRoute<{ id: string }>("/work/:id/report");
  const workId = Number(params?.id);
  const validWorkId = matches && Number.isInteger(workId) && workId > 0;
  return validWorkId ? <ReportShareSession key={workId} workId={workId} /> : null;
}

function ReportShareSession({ workId }: { workId: number }) {
  const [open, setOpen] = useState(false);
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>();
  const [type, setType] = useState<"link" | "qr">("link");
  const [visibility, setVisibility] = useState<"public" | "protected">("public");
  const [password, setPassword] = useState("");
  const [expiryPreset, setExpiryPreset] = useState<(typeof expiryOptions)[number]["value"]>("7d");
  const [created, setCreated] = useState<CreatedOutput | undefined>();
  const [shareUrl, setShareUrl] = useState("");
  const [restoredPublication, setRestoredPublication] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();
  const [copied, setCopied] = useState(false);
  const [continueWithOldVersion, setContinueWithOldVersion] = useState(false);

  const versionsQuery = trpc.reviewSupport.versions.useQuery(
    { workItemId: workId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const draftQuery = trpc.domain.reportDraft.get.useQuery(
    { workItemId: workId },
    { retry: false, refetchOnWindowFocus: false },
  );
  const { user } = useAuth();
  const outputsQuery = trpc.domain.output.listForWork.useQuery(
    { workItemId: workId },
    { enabled: open, retry: false, refetchOnWindowFocus: false },
  );
  const receiptMutation = trpc.domain.output.publicationReceipt.useMutation();
  const createMutation = trpc.shareOutput.create.useMutation();
  const revokeMutation = trpc.domain.output.revoke.useMutation();

  const versions = useMemo(
    () => [...(versionsQuery.data ?? [])].sort((left, right) => right.versionNumber - left.versionNumber),
    [versionsQuery.data],
  );

  useEffect(() => {
    if (!selectedVersionId && versions[0]) setSelectedVersionId(versions[0].id);
  }, [selectedVersionId, versions]);

  useEffect(() => {
    let cancelled = false;
    setQrDataUrl(undefined);
    if (!created?.token || typeof window === "undefined") {
      setShareUrl("");
      setQrDataUrl(undefined);
      return;
    }
    const url = `${window.location.origin}/output/${created.token}`;
    setShareUrl(url);
    if (created.type === "qr") {
      void QRCode.toDataURL(url, {
        width: 420,
        margin: 2,
        errorCorrectionLevel: "M",
      }).then(value => { if (!cancelled) setQrDataUrl(value); })
        .catch(() => { if (!cancelled) setQrDataUrl(undefined); });
    } else {
      setQrDataUrl(undefined);
    }
    return () => { cancelled = true; };
  }, [created]);

  useEffect(() => {
    setCreated(undefined);
    setShareUrl("");
    setRestoredPublication(false);
    setQrDataUrl(undefined);
    createMutation.reset();
    revokeMutation.reset();
    receiptMutation.reset();
    setContinueWithOldVersion(false);
  }, [selectedVersionId]);

  const selectedVersion = versions.find(version => version.id === selectedVersionId);
  const freshness = compareReportDraftToVersion(draftQuery.data?.draft.revision, selectedVersion);
  const guarded = freshness !== "fresh" && !continueWithOldVersion;

  const createShare = async () => {
    if (!selectedVersionId || guarded) return;
    const expiry = expiryOptions.find(option => option.value === expiryPreset);
    const result = await createMutation.mutateAsync({
      workVersionId: selectedVersionId,
      type,
      visibility,
      password: visibility === "protected" ? password : undefined,
      expiresAt: expiry?.milliseconds ? new Date(Date.now() + expiry.milliseconds) : undefined,
    });
    setCreated(result as CreatedOutput);
    setRestoredPublication(false);
    setPassword("");
    await outputsQuery.refetch();
  };

  const restorePublication = async (outputId: number) => {
    const receipt = await receiptMutation.mutateAsync({ id: outputId });
    if (receipt.type !== "link" && receipt.type !== "qr") return;
    if (receipt.visibility !== "public" && receipt.visibility !== "protected") return;
    setCreated({ id: receipt.outputId, token: receipt.token, type: receipt.type,
      visibility: receipt.visibility, expiresAt: receipt.expiresAt });
    setRestoredPublication(true);
  };

  const copyShareUrl = async () => {
    if (!shareUrl) return;
    await navigator.clipboard.writeText(shareUrl);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  };

  const revokeShare = async () => {
    if (!created) return;
    await revokeMutation.mutateAsync({ id: created.id });
    setCreated(undefined);
    setShareUrl("");
    setQrDataUrl(undefined);
    await outputsQuery.refetch();
  };

  return (
    <div className="fixed bottom-40 left-4 z-50 lg:bottom-20 lg:left-6" dir="rtl">
      {open && (
        <section id="report-share-actions" className="mb-3 w-[min(92vw,410px)] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl" aria-label="مشاركة نسخة التقرير">
          <header className="flex items-start justify-between gap-3 border-b border-slate-100 bg-teal-800 px-4 py-4 text-white">
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-white/10"><Share2 className="h-5 w-5" /></span>
              <div><p className="text-[11px] font-bold text-teal-100">مشاركة مضبوطة</p><h2 className="mt-1 text-sm font-black">رابط أو QR من نسخة معتمدة</h2><p className="mt-1 text-[10px] leading-5 text-teal-100">الخادم يرفض النسخ غير المعتمدة أو المنتهية أو الملغاة.</p></div>
            </div>
            <button type="button" onClick={() => setOpen(false)} className="rounded-lg p-1.5 text-teal-100 hover:bg-white/10 hover:text-white" aria-label="إغلاق نافذة المشاركة"><X className="h-4 w-4" /></button>
          </header>

          <div className="space-y-4 p-4">
            <label className="block text-xs font-bold text-slate-700">النسخة الثابتة
              <select disabled={createMutation.isPending || revokeMutation.isPending} value={selectedVersionId ?? ""} onChange={event => setSelectedVersionId(Number(event.target.value) || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                <option value="">اختر نسخة</option>
                {versions.map(version => <option key={version.id} value={version.id}>نسخة {version.versionNumber}{version.reason ? ` — ${version.reason}` : ""}</option>)}
              </select>
            </label>

            {versionsQuery.isLoading && <div className="flex items-center justify-center py-4 text-xs text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل النسخ...</div>}
            {!versionsQuery.isLoading && versions.length === 0 && <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900">أنشئ نسخة ثابتة وأرسلها للمراجعة أولًا.</div>}

            {!created && selectedVersionId && (
              <>
                {freshness !== "fresh" && (
                  <div className="mb-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-6 text-amber-900" role="alert">
                    <div className="flex items-start gap-2"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><p>{freshness === "stale" ? "المسودة الحالية أحدث من النسخة المختارة. أنشئ نسخة جديدة أو اختر متابعة النسخة القديمة صراحة." : "تعذر التحقق من مراجعة المسودة مقابل النسخة. المشاركة محجوبة حتى تختار متابعة النسخة القديمة صراحة."}</p></div>
                    <button type="button" onClick={() => setContinueWithOldVersion(true)} className="mt-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-[11px] font-bold text-amber-900">متابعة النسخة القديمة على أي حال</button>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setType("link")} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${type === "link" ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}><Link2 className="h-4 w-4" /> رابط</button>
                  <button type="button" onClick={() => setType("qr")} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${type === "qr" ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}><QrCode className="h-4 w-4" /> QR</button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => setVisibility("public")} className={`rounded-xl border px-3 py-2.5 text-xs font-bold ${visibility === "public" ? "border-teal-500 bg-teal-50 text-teal-800" : "border-slate-200 text-slate-600"}`}>عرض بالرابط</button>
                  <button type="button" onClick={() => setVisibility("protected")} className={`inline-flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold ${visibility === "protected" ? "border-amber-500 bg-amber-50 text-amber-800" : "border-slate-200 text-slate-600"}`}><LockKeyhole className="h-4 w-4" /> كلمة مرور</button>
                </div>

                {visibility === "protected" && (
                  <label className="block text-xs font-bold text-slate-700">كلمة المرور
                    <div className="relative mt-2"><KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input type="password" value={password} onChange={event => setPassword(event.target.value)} minLength={6} maxLength={128} autoComplete="new-password" className="w-full rounded-xl border border-slate-200 py-2.5 pl-3 pr-10 text-sm font-normal outline-none focus:border-teal-400 focus:ring-4 focus:ring-teal-100" placeholder="6 أحرف على الأقل" /></div>
                  </label>
                )}

                <label className="block text-xs font-bold text-slate-700">مدة الصلاحية
                  <select value={expiryPreset} onChange={event => setExpiryPreset(event.target.value as (typeof expiryOptions)[number]["value"])} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal">
                    {expiryOptions.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
                  </select>
                </label>

                <button type="button" onClick={() => void createShare().catch(() => undefined)} disabled={createMutation.isPending || guarded || (visibility === "protected" && password.length < 6)} className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-3 text-sm font-black text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50">
                  {createMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : type === "qr" ? <QrCode className="h-4 w-4" /> : <Link2 className="h-4 w-4" />}
                  إنشاء {type === "qr" ? "QR" : "الرابط"}
                </button>
                {createMutation.error && <p className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs leading-6 text-red-700">{createMutation.error.message}</p>}
              </>
            )}

            {created && shareUrl && (
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4">
                <div className="flex items-start gap-2 text-emerald-800"><ShieldCheck className="mt-0.5 h-4 w-4 shrink-0" /><div><p className="text-xs font-black">{restoredPublication ? "تم استعادة رابط مخرج" : "تم إنشاء مخرج"} {created.visibility === "protected" ? "محمي" : "عام"}</p><p className="mt-1 text-[10px] leading-5">يمكن إلغاؤه من هنا، ويطبق الخادم الانتهاء والإلغاء عند كل عرض.</p></div></div>
                <div className="mt-3 rounded-xl bg-white p-3 text-left font-mono text-[10px] leading-5 text-slate-600" dir="ltr">{shareUrl}</div>
                {qrDataUrl && <div className="mt-3 flex justify-center rounded-xl bg-white p-4"><img src={qrDataUrl} alt="QR للمخرج الموثق" className="h-48 w-48" /></div>}
                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <button type="button" onClick={() => void copyShareUrl()} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-700 px-3 py-2.5 text-xs font-bold text-white hover:bg-emerald-800">{copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}{copied ? "تم النسخ" : "نسخ الرابط"}</button>
                  <a href={shareUrl} target="_blank" rel="noreferrer" className="inline-flex items-center justify-center gap-2 rounded-xl border border-emerald-300 bg-white px-3 py-2.5 text-xs font-bold text-emerald-800"><Link2 className="h-4 w-4" /> فتح للاختبار</a>
                </div>
                <button type="button" onClick={() => void revokeShare().catch(() => undefined)} disabled={revokeMutation.isPending} className="mt-3 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-red-200 bg-white px-3 py-2.5 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50">{revokeMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />} إلغاء المخرج</button>
                {revokeMutation.error && <p className="mt-2 text-xs text-red-600">{revokeMutation.error.message}</p>}
              </div>
            )}

            {!created && selectedVersionId && (
              <div className="rounded-xl border border-slate-200 p-3">
                <p className="text-xs font-bold text-slate-700">روابطك المنشورة لهذه النسخة</p>
                <p className="mt-1 text-[10px] leading-5 text-slate-500">استعادة رابط قائم لا تنشئ مخرجًا جديدًا. يتحقق الخادم من المنشئ وصلاحية الإدارة عند كل طلب.</p>
                {outputsQuery.isLoading && <p className="mt-2 text-xs text-slate-500">جاري تحميل المخرجات...</p>}
                {outputsQuery.error && <p role="alert" className="mt-2 text-xs text-red-700">تعذر تحميل سجل المخرجات. حاول إعادة فتح النافذة.</p>}
                {(outputsQuery.data ?? []).filter(output => output.workVersionId === selectedVersionId
                  && output.createdByUserId === user?.id && !output.revokedAt
                  && (!output.expiresAt || new Date(output.expiresAt).getTime() > Date.now())
                  && output.visibility !== "private" && (output.type === "link" || output.type === "qr")).map(output => (
                  <button key={output.id} type="button" disabled={receiptMutation.isPending}
                    onClick={() => void restorePublication(output.id).catch(() => undefined)}
                    className="mt-2 flex min-h-11 w-full items-center justify-center gap-2 rounded-lg border border-teal-200 px-3 py-2 text-xs font-bold text-teal-800 disabled:opacity-50">
                    {receiptMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Link2 className="h-4 w-4" />} استعادة رابط المخرج #{output.id}
                  </button>
                ))}
                {receiptMutation.error && <p role="alert" className="mt-2 text-xs leading-5 text-red-700">تعذر استعادة رابط نشر نشط ضمن صلاحيتك الحالية.</p>}
              </div>
            )}

            <div className="flex items-start gap-2 rounded-xl bg-slate-50 p-3 text-[10px] leading-5 text-slate-600"><CalendarClock className="mt-0.5 h-4 w-4 shrink-0" /><p>لا يعرض المسار العام الملفات الأصلية أو روابط التخزين أو بيانات الملكية. المشاركة تتطلب اعتماد النسخة نفسها.</p></div>
          </div>
        </section>
      )}

      <button type="button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-controls="report-share-actions" className="inline-flex items-center gap-2 rounded-full bg-teal-700 px-4 py-3 text-sm font-black text-white shadow-xl transition hover:bg-teal-800 focus:outline-none focus:ring-4 focus:ring-teal-200"><Share2 className="h-5 w-5" /><span>مشاركة النسخة</span></button>
    </div>
  );
}
