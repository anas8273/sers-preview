import { useEffect, useState } from "react";
import { Printer, QrCode, ShieldCheck } from "lucide-react";
import QRCode from "qrcode";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export type PrintQrCardDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  outputTypeLabel: string;
  verificationUrl: string;
  schoolName?: string;
  versionNumber?: number;
  visibility?: "public" | "protected";
  verifiedAtLabel?: string;
};

export default function PrintQrCardDialog({
  open,
  onOpenChange,
  title,
  outputTypeLabel,
  verificationUrl,
  schoolName,
  versionNumber,
  visibility,
  verifiedAtLabel,
}: PrintQrCardDialogProps) {
  const [qrDataUrl, setQrDataUrl] = useState<string | undefined>();
  const [qrError, setQrError] = useState(false);

  useEffect(() => {
    if (!open || !verificationUrl) return;
    let cancelled = false;
    setQrError(false);
    void QRCode.toDataURL(verificationUrl, {
      width: 360,
      margin: 2,
      errorCorrectionLevel: "M",
    })
      .then(dataUrl => {
        if (!cancelled) setQrDataUrl(dataUrl);
      })
      .catch(() => {
        if (!cancelled) {
          setQrDataUrl(undefined);
          setQrError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [open, verificationUrl]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        dir="rtl"
        className="max-w-2xl border-slate-200 bg-white p-0 sm:rounded-3xl print:max-w-none print:border-0 print:shadow-none"
      >
        <div className="border-b border-slate-100 px-6 py-4 print:hidden">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-black text-slate-950">
              <QrCode className="h-5 w-5 text-teal-700" />
              بطاقة تحقق QR قابلة للطباعة (A4)
            </DialogTitle>
            <DialogDescription className="text-xs leading-6 text-slate-600">
              بطاقة غلاف مناسبة لملفات الشواهد الورقية وأبواب القاعات والمعارض المدرسية، مرتبطة بمخرج ثابت وموثق.
            </DialogDescription>
          </DialogHeader>
        </div>

        <div className="p-6 print:p-0">
          <article
            aria-label="بطاقة التحقق القابلة للطباعة"
            className="mx-auto rounded-2xl border-2 border-slate-800 bg-white p-6 text-center shadow-sm sm:p-8 print:min-h-[260mm] print:rounded-none print:border-slate-900 print:p-12 print:shadow-none"
          >
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-200 pb-4 text-right">
              <div>
                <p className="text-xs font-black tracking-wide text-teal-700">SERS · منصة سيرس</p>
                {schoolName && (
                  <p className="mt-1 text-sm font-bold text-slate-900">{schoolName}</p>
                )}
              </div>
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-bold text-emerald-800">
                <ShieldCheck className="h-3.5 w-3.5" />
                {visibility === "protected" ? "مخرج موثق محمي" : "مخرج ثابت موثق"}
              </span>
            </div>

            <div className="mt-6">
              <p className="text-xs font-bold text-teal-700">{outputTypeLabel}</p>
              <h2 className="mt-2 text-2xl font-black leading-relaxed text-slate-950">
                {title}
              </h2>
              <div className="mt-3 flex flex-wrap items-center justify-center gap-2 text-xs text-slate-600">
                {versionNumber !== undefined && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-bold">
                    نسخة {versionNumber}
                  </span>
                )}
                {verifiedAtLabel && (
                  <span className="rounded-full bg-slate-100 px-3 py-1 font-bold">
                    تاريخ التثبيت: {verifiedAtLabel}
                  </span>
                )}
              </div>
            </div>

            <div className="mx-auto mt-8 flex w-fit flex-col items-center rounded-2xl border border-slate-200 bg-slate-50 p-5">
              {qrDataUrl ? (
                <img
                  src={qrDataUrl}
                  alt="رمز QR للتحقق من المخرج الموثق"
                  className="h-52 w-52 rounded-xl bg-white p-2"
                />
              ) : qrError ? (
                <p role="alert" className="py-12 text-xs font-bold text-red-700">
                  تعذر توليد رمز QR للرابط الحالي.
                </p>
              ) : (
                <div className="flex h-52 w-52 items-center justify-center text-xs text-slate-500">
                  جارٍ تجهيز رمز QR...
                </div>
              )}
              <p className="mt-3 text-xs font-bold text-slate-800">
                امسح الرمز لفتح المخرج الموثق والتحقق من النسخة الثابتة
              </p>
            </div>

            <div className="mt-6 rounded-xl bg-slate-50 px-4 py-3 text-center">
              <p className="text-[11px] font-bold text-slate-500">رابط التحقق المباشر</p>
              <p className="mt-1 break-all font-mono text-xs text-slate-800" dir="ltr">
                {verificationUrl}
              </p>
            </div>

            {visibility === "protected" && (
              <p className="mt-4 text-xs font-semibold text-amber-800">
                ملاحظة: يتطلب فتح هذا المخرج إدخال كلمة المرور المعتمدة لدى صاحب العمل.
              </p>
            )}
          </article>

          <div className="mt-5 flex flex-wrap items-center justify-end gap-2 print:hidden">
            <button
              type="button"
              onClick={() => onOpenChange(false)}
              className="min-h-11 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
            >
              إغلاق
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              disabled={!qrDataUrl}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-5 py-2 text-xs font-black text-white hover:bg-teal-800 disabled:opacity-50"
            >
              <Printer className="h-4 w-4" />
              طباعة بطاقة QR (A4)
            </button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
