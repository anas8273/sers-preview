import { useEffect, useRef, useState } from "react";
import { CheckCircle2, Download, Loader2, RefreshCw, UploadCloud, X } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { TRPCClientError } from "@trpc/client";

type UploadStatus = { id: string; state: string; revision: number; assetId?: number | null };
const stateLabels: Record<string, string> = { issued: "جاهز لاستقبال الملف", receiving: "جارٍ التحقق من وصول الملف", quarantined: "اكتمل الاستقبال والملف ينتظر الفحص", validating: "جارٍ فحص الملف", ready: "أُضيف الشاهد إلى مكتبتك", rejected: "لم يجتز الملف التحقق المطلوب", cancelled: "أُلغي الرفع", expired: "انتهت مهلة الرفع" };
const finalStates = new Set(["ready", "rejected", "cancelled", "expired"]);
function readPending(cacheKey: string): UploadStatus | null {
  try {
    const value = JSON.parse(sessionStorage.getItem(cacheKey) ?? "null");
    return value && typeof value.id === "string" && /^[a-f0-9-]{36}$/i.test(value.id) && Number.isSafeInteger(value.revision) ? { id: value.id, state: String(value.state), revision: value.revision } : null;
  } catch { return null; }
}
export default function PrivateEvidenceUpload() {
  const identity = trpc.auth.me.useQuery(undefined, { retry: false });
  return identity.data ? <EvidenceUploadForUser key={identity.data.id} userId={identity.data.id} /> : null;
}
function EvidenceUploadForUser({ userId }: { userId: number }) {
  const cacheKey = `sers-evidence-upload-v2:${userId}`;
  const utils = trpc.useUtils();
  const capabilities = trpc.evidenceUpload.capabilities.useQuery(undefined, { retry: false });
  const organizations = trpc.domain.organization.listMine.useQuery(undefined, { retry: false });
  const begin = trpc.evidenceUpload.begin.useMutation();
  const complete = trpc.evidenceUpload.complete.useMutation();
  const cancel = trpc.evidenceUpload.cancel.useMutation();
  const [file, setFile] = useState<File | null>(null);
  const [scope, setScope] = useState("personal");
  const [status, setStatus] = useState<UploadStatus | null>(() => readPending(cacheKey));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const key = useRef(crypto.randomUUID());
  const controller = useRef<AbortController | null>(null);
  const alive = useRef(true);
  const fileInput = useRef<HTMLInputElement>(null);
  const active = Boolean(status && !finalStates.has(status.state));
  useEffect(() => { alive.current = true; return () => { alive.current = false; controller.current?.abort(); }; }, []);
  function remember(value: UploadStatus | null) {
    if (!alive.current) return;
    setStatus(value);
    try {
      if (value && !finalStates.has(value.state)) sessionStorage.setItem(cacheKey, JSON.stringify({ id: value.id, state: value.state, revision: value.revision }));
      else sessionStorage.removeItem(cacheKey);
    } catch { /* Browser storage is optional; the server keeps the upload. */ }
  }
  function handleError(problem: unknown) {
    if (!alive.current) return;
    if (problem instanceof TRPCClientError && problem.data?.code === "NOT_FOUND") {
      remember(null); key.current = crypto.randomUUID();
      setError("الطلب السابق لم يعد متاحًا. يمكنك بدء رفع جديد.");
    } else setError(problem instanceof Error ? problem.message : "تعذر إكمال الرفع؛ تحقق من الحالة وأعد المحاولة");
  }
  async function settle(value: UploadStatus) {
    remember(value);
    if (value.state === "ready") { await utils.domain.asset.list.invalidate(); return; }
    if (["receiving", "quarantined", "validating"].includes(value.state)) {
      const next = await complete.mutateAsync({ id: value.id });
      if (next) { remember(next); if (next.state === "ready") await utils.domain.asset.list.invalidate(); }
    }
  }
  async function run(resume = false) {
    if (busy) return;
    setBusy(true); setError("");
    try {
      let current: UploadStatus;
      if (resume && status) current = await utils.evidenceUpload.status.fetch({ id: status.id });
      else {
        if (!file) throw new Error("اختر ملفًا أولًا");
        const ext = file.name.split(".").pop()?.toLowerCase();
        const mimeTypes: Record<string, "application/pdf" | "image/png" | "image/jpeg" | "text/plain"> = { pdf: "application/pdf", png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", txt: "text/plain" };
        const mime = mimeTypes[ext ?? ""];
        if (!mime) throw new Error("الأنواع المدعومة: PDF وPNG وJPEG وTXT");
        if (!file.size || file.size > (capabilities.data?.maxBytes ?? 0)) throw new Error("حجم الملف يجب أن يكون أكبر من صفر ولا يتجاوز 16 ميجابايت");
        current = await begin.mutateAsync({ idempotencyKey: key.current, fileName: file.name, mimeType: mime, expectedBytes: file.size, ownerType: scope === "personal" ? "personal" : "organization", organizationId: scope === "personal" ? undefined : Number(scope) });
      }
      remember(current);
      if (current.state === "issued") {
        if (!file) throw new Error("الطلب محفوظ؛ اختر الملف نفسه لاستكماله أو ألغِ الطلب وابدأ من جديد");
        controller.current = new AbortController();
        const response = await fetch(`/api/evidence/uploads/${current.id}?revision=${current.revision}`, { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/octet-stream" }, body: file, signal: controller.current.signal });
        const body = await response.json();
        if (!response.ok) { if (response.status === 404) { remember(null); key.current = crypto.randomUUID(); } throw new Error(body.error || "تعذر استقبال الملف"); }
        current = body;
      }
      await settle(current);
    } catch (problem) { handleError(problem); }
    finally { if (alive.current) setBusy(false); controller.current = null; }
  }
  async function cancelCurrent() {
    if (!status) return;
    controller.current?.abort(); setError("");
    try {
      const current = await utils.evidenceUpload.status.fetch({ id: status.id });
      remember(await cancel.mutateAsync({ id: current.id, expectedRevision: current.revision }));
    } catch (problem) { handleError(problem); }
  }
  function reset() { remember(null); setFile(null); setError(""); key.current = crypto.randomUUID(); if (fileInput.current) fileInput.current.value = ""; }
  return <section aria-label="رفع ملف شاهد" className="mt-6 rounded-2xl border border-teal-200 bg-white p-5 shadow-sm">
    <div className="flex items-start gap-3"><UploadCloud className="mt-1 h-6 w-6 text-teal-700" /><div><h2 className="text-sm font-bold text-slate-950">رفع ملف شاهد</h2><p className="mt-1 text-xs leading-6 text-slate-500">PDF أو صورة PNG/JPEG أو ملف نصي، حتى 16 ميجابايت. يظهر الشاهد في المكتبة بعد اكتمال فحصه.</p></div></div>
    {capabilities.isLoading ? <p className="mt-3 text-xs text-slate-500">جارٍ التحقق من إتاحة الرفع...</p> : !capabilities.data?.enabled && <p className="mt-3 text-xs leading-6 text-amber-800">رفع ملفات جديدة غير متاح حاليًا. يمكنك إضافة شاهد نصي أو رابط.</p>}
    {(capabilities.data?.enabled || active) && <div className="mt-4 grid gap-3 sm:grid-cols-2">
      <label className="text-xs font-bold text-slate-700">الملف<input ref={fileInput} type="file" accept=".pdf,.png,.jpg,.jpeg,.txt" disabled={busy || Boolean(status && status.state !== "issued")} onChange={event => { setFile(event.target.files?.[0] ?? null); if (!status) key.current = crypto.randomUUID(); }} className="mt-2 block w-full rounded-xl border border-slate-200 p-2 text-xs font-normal" /></label>
      <label className="text-xs font-bold text-slate-700">المكتبة<select value={scope} onChange={event => { setScope(event.target.value); key.current = crypto.randomUUID(); }} disabled={busy || Boolean(status)} className="mt-2 block w-full rounded-xl border border-slate-200 bg-white p-2.5 text-sm font-normal"><option value="personal">مكتبتي الشخصية</option>{organizations.data?.filter(org => ["owner", "admin", "member"].includes(org.role)).map(org => <option value={org.id} key={org.id}>{org.name}</option>)}</select></label>
    </div>}
    {status && <div className={`mt-4 rounded-xl p-3 text-sm ${status.state === "ready" ? "bg-emerald-50 text-emerald-800" : "bg-slate-50 text-slate-700"}`} role="status" aria-live="polite"><div className="flex items-center gap-2">{status.state === "ready" ? <CheckCircle2 className="h-4 w-4" /> : busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}{stateLabels[status.state] ?? "طلب الرفع محفوظ"}</div>
      {status.state === "rejected" && <p className="mt-1 text-xs leading-6">استخدم ملفًا سليمًا غير مشفر ومن أحد الأنواع المدعومة، ثم ابدأ طلبًا جديدًا.</p>}
      {status.state === "ready" && status.assetId && <a href={`/api/evidence/assets/${status.assetId}/download`} className="mt-2 inline-flex items-center gap-1 text-xs font-bold"><Download className="h-4 w-4" />تنزيل الشاهد</a>}
    </div>}
    {error && <p className="mt-3 text-xs leading-6 text-red-700" role="alert">{error}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      {!status && capabilities.data?.enabled && <button onClick={() => void run()} disabled={!file || busy} className="inline-flex items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <UploadCloud className="h-4 w-4" />}رفع وفحص الملف</button>}
      {active && <><button onClick={() => void run(true)} disabled={busy} className="inline-flex items-center gap-2 rounded-xl border border-teal-200 px-3 py-2.5 text-xs font-bold text-teal-800 disabled:opacity-50"><RefreshCw className="h-4 w-4" />تحقق من الحالة واستكمل</button><button onClick={() => void cancelCurrent()} disabled={cancel.isPending} className="inline-flex items-center gap-2 rounded-xl border border-red-200 px-3 py-2.5 text-xs font-bold text-red-700"><X className="h-4 w-4" />إلغاء الرفع</button></>}
      {status && finalStates.has(status.state) && <button onClick={reset} className="rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-bold text-slate-700">رفع ملف آخر</button>}
    </div>
  </section>;
}
