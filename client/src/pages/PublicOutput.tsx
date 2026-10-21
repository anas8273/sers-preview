import React, { FormEvent, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  CalendarClock,
  CheckCircle2,
  Eye,
  FileText,
  KeyRound,
  Loader2,
  LockKeyhole,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";
import { useRoute } from "wouter";
import { trpc } from "@/lib/trpc";

export default function PublicOutput() {
  const [, params] = useRoute<{ token: string }>("/output/:token");
  const token = params?.token?.trim() || "";
  // Reset mutation data and credentials synchronously when the route changes.
  return <PublicOutputSession key={token} token={token} />;
}

function PublicOutputSession({ token }: { token: string }) {
  const attemptedRef = useRef(false);
  const [password, setPassword] = useState("");
  const [requiresPassword, setRequiresPassword] = useState(false);
  const [passwordError, setPasswordError] = useState<string | undefined>();

  const resolveMutation = trpc.publicOutput.resolve.useMutation({
    onSuccess: () => {
      setPassword("");
      setRequiresPassword(false);
      setPasswordError(undefined);
    },
    onError: error => {
      if (error.data?.code === "UNAUTHORIZED") {
        setRequiresPassword(true);
        setPasswordError(error.message.includes("غير صحيحة") ? error.message : undefined);
      } else {
        setRequiresPassword(false);
        setPasswordError(undefined);
        setPassword("");
      }
    },
  });

  useEffect(() => {
    if (!token || attemptedRef.current) return;
    attemptedRef.current = true;
    void resolveMutation.mutateAsync({ token }).catch(() => undefined);
  }, [resolveMutation, token]);

  const submitPassword = async (event: FormEvent) => {
    event.preventDefault();
    setPasswordError(undefined);
    await resolveMutation.mutateAsync({ token, password }).catch(() => undefined);
  };

  const retry = () => {
    setPassword("");
    setPasswordError(undefined);
    setRequiresPassword(false);
    resolveMutation.reset();
    void resolveMutation.mutateAsync({ token }).catch(() => undefined);
  };

  const data = resolveMutation.data;
  const unavailable = resolveMutation.error
    && resolveMutation.error.data?.code !== "UNAUTHORIZED"
    && !resolveMutation.isPending;

  return (
    <main className="min-h-screen bg-[#F5F8FA] px-4 py-8 sm:px-6 sm:py-12" dir="rtl">
      <div className="mx-auto max-w-4xl">
        <header className="mb-8 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-slate-950 text-white shadow-lg">
              <FileText className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs font-black tracking-wide text-teal-700">SERS</p>
              <h1 className="mt-1 text-lg font-black text-slate-950">عرض مخرج موثق</h1>
            </div>
          </div>
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[11px] font-bold text-emerald-700">
            <ShieldCheck className="h-3.5 w-3.5" /> نسخة ثابتة
          </span>
        </header>

        {(resolveMutation.isPending || (!data && !resolveMutation.error)) && (
          <section className="rounded-3xl border border-slate-200 bg-white px-6 py-20 text-center shadow-sm">
            <Loader2 className="mx-auto h-8 w-8 animate-spin text-teal-600" />
            <p className="mt-4 text-sm font-bold text-slate-700">جاري التحقق من صلاحية المخرج...</p>
          </section>
        )}

        {requiresPassword && !data && (
          <section className="mx-auto max-w-lg rounded-3xl border border-slate-200 bg-white p-6 shadow-xl sm:p-8">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-center text-xl font-black text-slate-950">هذا المخرج محمي</h2>
            <p className="mt-2 text-center text-sm leading-7 text-slate-600">أدخل كلمة المرور التي زودك بها صاحب المخرج. لا تُحفظ كلمة المرور داخل الصفحة.</p>
            <form onSubmit={submitPassword} className="mt-6">
              <label className="block text-xs font-bold text-slate-700" htmlFor="output-password">كلمة المرور</label>
              <div className="relative mt-2">
                <KeyRound className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  id="output-password"
                  type="password"
                  value={password}
                  onChange={event => setPassword(event.target.value)}
                  minLength={1}
                  maxLength={128}
                  autoComplete="current-password"
                  autoFocus
                  className="w-full rounded-xl border border-slate-200 py-3 pl-3 pr-10 text-sm outline-none transition focus:border-teal-400 focus:ring-4 focus:ring-teal-100"
                  placeholder="أدخل كلمة المرور"
                />
              </div>
              {passwordError && <p className="mt-2 text-xs font-bold text-red-600">{passwordError}</p>}
              <button
                type="submit"
                disabled={!password || resolveMutation.isPending}
                className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-950 px-4 py-3 text-sm font-black text-white transition hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {resolveMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Eye className="h-4 w-4" />}
                عرض المخرج
              </button>
            </form>
          </section>
        )}

        {unavailable && (
          <section className="mx-auto max-w-lg rounded-3xl border border-red-200 bg-white p-7 text-center shadow-xl sm:p-9">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 text-red-700">
              <AlertTriangle className="h-6 w-6" />
            </div>
            <h2 className="mt-5 text-xl font-black text-slate-950">المخرج غير متاح</h2>
            <p className="mt-2 text-sm leading-7 text-slate-600">قد يكون الرابط منتهيًا أو ملغى أو غير صحيح. لا يعرض النظام تفاصيل إضافية لحماية البيانات.</p>
            <button onClick={retry} className="mt-5 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-50">
              <RefreshCw className="h-4 w-4" /> إعادة المحاولة
            </button>
          </section>
        )}

        {data && (
          <article className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl">
            <div className="h-3 bg-slate-950" />
            <div className="p-6 sm:p-10">
              <div className="flex flex-col gap-5 border-b border-slate-200 pb-7 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-black text-teal-700">{data.report.templateLabel}</p>
                  <h2 className="mt-2 text-2xl font-black leading-relaxed text-slate-950 sm:text-3xl">{data.report.title}</h2>
                  <div className="mt-3 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-bold">نسخة {data.versionNumber}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-bold">{data.visibility === "protected" ? "محمي" : "عام"}</span>
                    <span className="rounded-full bg-slate-100 px-3 py-1.5 font-bold">{data.type === "qr" ? "QR" : "رابط"}</span>
                  </div>
                </div>
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-xs leading-6 text-emerald-800">
                  <div className="flex items-start gap-2"><CheckCircle2 className="mt-1 h-4 w-4 shrink-0" /><span>المحتوى المعروض مأخوذ من نسخة ثابتة معتمدة، وليس من مسودة متغيرة.</span></div>
                </div>
              </div>

              <div className="mt-8 space-y-8">
                {data.report.fields.map(field => (
                  <section key={field.key}>
                    <h3 className="text-base font-black text-slate-950">{field.label}</h3>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-8 text-slate-700">{field.value}</p>
                  </section>
                ))}

                {data.report.evidence.length > 0 && (
                  <section>
                    <h3 className="text-base font-black text-slate-950">الشواهد المستخدمة</h3>
                    <div className="mt-4 grid gap-3 sm:grid-cols-2">
                      {data.report.evidence.map((evidence, index) => (
                        <div key={`${evidence.title}-${index}`} className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <p className="text-sm font-black text-slate-900">{evidence.title}</p>
                          <p className="mt-1 text-[11px] text-slate-500">{evidence.kind} · {evidence.role}</p>
                          {evidence.caption && <p className="mt-3 text-xs leading-6 text-slate-600">{evidence.caption}</p>}
                        </div>
                      ))}
                    </div>
                    <p className="mt-3 text-[11px] leading-6 text-amber-800">عرض اسم الشاهد ووصفه لا يمنح وصولًا إلى الملف الأصلي أو الرابط الداخلي.</p>
                  </section>
                )}
              </div>

              <footer className="mt-10 flex flex-col gap-3 border-t border-slate-200 pt-6 text-[11px] leading-6 text-slate-500 sm:flex-row sm:items-center sm:justify-between">
                <span className="inline-flex items-center gap-2"><CalendarClock className="h-4 w-4" />{data.report.capturedAt ? new Date(data.report.capturedAt).toLocaleString("ar-SA") : "تاريخ النسخة غير محدد"}</span>
                {data.expiresAt && <span>تنتهي صلاحية العرض: {new Date(data.expiresAt).toLocaleString("ar-SA")}</span>}
              </footer>
            </div>
          </article>
        )}

        <p className="mt-6 text-center text-[11px] leading-6 text-slate-500">لا يعرض هذا المسار الملفات الأصلية أو بيانات الملكية أو روابط التخزين الداخلية.</p>
      </div>
    </main>
  );
}
