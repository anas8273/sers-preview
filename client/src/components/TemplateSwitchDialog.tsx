import { useEffect, useState, type RefObject } from "react";
import { ArrowLeft, Loader2, RefreshCw, X } from "lucide-react";
import type { TemplateSwitchPreview } from "@shared/report-projection";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type TemplateSwitchDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTemplateLabel: string;
  preview: TemplateSwitchPreview | undefined;
  isLoading: boolean;
  isSubmitting: boolean;
  errorMessage?: string;
  onApply: (strategy: "append_to_summary" | "discard") => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

function truncateText(text: string, max = 140) {
  return text.length > max ? `${text.slice(0, max)}…` : text;
}

export default function TemplateSwitchDialog({
  open,
  onOpenChange,
  currentTemplateLabel,
  preview,
  isLoading,
  isSubmitting,
  errorMessage,
  onApply,
  returnFocusRef,
}: TemplateSwitchDialogProps) {
  const [strategy, setStrategy] = useState<"append_to_summary" | "discard">("append_to_summary");

  useEffect(() => {
    if (preview) {
      setStrategy(preview.appendToSummaryFits ? "append_to_summary" : "discard");
    }
  }, [preview]);

  const keptMappings = (preview?.mappings ?? []).filter(item => item.compatibility !== "unmapped");
  const unmappedFields = preview?.unmappedFields ?? [];
  const newEmptyFields = preview?.newEmptyFields ?? [];
  const appendDisabled = !preview?.appendToSummaryFits;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        dir="rtl"
        className="z-[80] block max-h-[calc(100dvh-2rem)] max-w-xl overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onCloseAutoFocus={event => {
          if (returnFocusRef?.current) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-950">تبديل قالب التقرير بأمان</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-6 text-slate-600">
              راجع مصير حقولك الحالية قبل تطبيق القالب الجديد. تُحفظ نسخة من القالب السابق لإمكانية التراجع لاحقًا.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="إغلاق نافذة تبديل القالب"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {isLoading && (
          <div role="status" className="mt-5 flex items-center justify-center rounded-xl border border-slate-200 bg-slate-50 py-10 text-sm text-slate-600">
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            جارٍ معاينة توافق الحقول...
          </div>
        )}

        {!isLoading && preview && (
          <div className="mt-5 space-y-4">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-teal-200 bg-teal-50/70 px-3.5 py-2.5 text-xs font-bold text-teal-950">
              <span>{currentTemplateLabel}</span>
              <ArrowLeft className="h-4 w-4 text-teal-700" aria-hidden="true" />
              <span>{preview.toTemplateLabel}</span>
            </div>

            <section className="rounded-xl border border-slate-200 bg-slate-50/60 p-3.5">
              <h3 className="text-xs font-bold text-slate-900">الحقول المنقولة تلقائيًا ({keptMappings.length})</h3>
              {keptMappings.length === 0 ? (
                <p className="mt-2 text-xs text-slate-600">لا توجد حقول ممتلئة مطابقة تلقائيًا.</p>
              ) : (
                <ul className="mt-2 space-y-1.5 text-xs text-slate-700">
                  {keptMappings.map(item => (
                    <li key={item.sourceKey} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-white px-2.5 py-1.5 border border-slate-100">
                      <span className="font-semibold text-slate-900">
                        {item.sourceLabel}
                        {item.targetLabel && item.targetLabel !== item.sourceLabel ? ` ← ${item.targetLabel}` : ""}
                      </span>
                      {item.compatibility === "coerced_to_text" && (
                        <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[11px] font-bold text-amber-900">سيُحوَّل إلى نص</span>
                      )}
                      {item.compatibility === "alias" && (
                        <span className="rounded-full bg-teal-50 px-2 py-0.5 text-[11px] font-bold text-teal-800">مطابقة دلالية</span>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <section className="rounded-xl border border-amber-200 bg-amber-50/60 p-3.5">
              <h3 className="text-xs font-bold text-amber-950">حقول ممتلئة غير موجودة في القالب الجديد ({unmappedFields.length})</h3>
              {unmappedFields.length === 0 ? (
                <p className="mt-2 text-xs text-amber-900">جميع الحقول الممتلئة متوافقة مع القالب الجديد ولن يُفقد أي نص.</p>
              ) : (
                <>
                  <ul className="mt-2 space-y-2 text-xs text-amber-950">
                    {unmappedFields.map(field => (
                      <li key={field.key} className="rounded-lg border border-amber-200 bg-white px-3 py-2">
                        <span className="block font-bold">{field.label}</span>
                        <span className="mt-0.5 block text-slate-700 [overflow-wrap:anywhere]">{truncateText(field.text)}</span>
                      </li>
                    ))}
                  </ul>
                  <fieldset className="mt-3 space-y-2">
                    <legend className="text-xs font-bold text-amber-950">كيف تريد التعامل مع الحقول غير المطابقة؟</legend>
                    <label className={`flex min-h-11 items-start gap-2.5 rounded-xl border bg-white p-3 text-xs ${appendDisabled ? "cursor-not-allowed border-slate-200 opacity-60" : "cursor-pointer border-amber-300"}`}>
                      <input
                        type="radio"
                        name="unmappedStrategy"
                        value="append_to_summary"
                        checked={strategy === "append_to_summary"}
                        disabled={appendDisabled}
                        onChange={() => setStrategy("append_to_summary")}
                        className="mt-0.5 h-4 w-4 accent-teal-700"
                      />
                      <span>
                        <span className="block font-bold text-slate-900">إلحاق الحقول غير المطابقة بملخص التقرير</span>
                        {appendDisabled && (
                          <span className="mt-1 block text-[11px] text-red-700">ملخص التقرير لا يتسع لإلحاق هذه الحقول أو القالب الهدف لا يحتوي على حقل ملخص.</span>
                        )}
                      </span>
                    </label>
                    <label className="flex min-h-11 cursor-pointer items-start gap-2.5 rounded-xl border border-slate-200 bg-white p-3 text-xs">
                      <input
                        type="radio"
                        name="unmappedStrategy"
                        value="discard"
                        checked={strategy === "discard"}
                        onChange={() => setStrategy("discard")}
                        className="mt-0.5 h-4 w-4 accent-teal-700"
                      />
                      <span className="font-bold text-slate-900">تجاهلها (يمكن التراجع لاحقًا)</span>
                    </label>
                  </fieldset>
                </>
              )}
            </section>

            {newEmptyFields.length > 0 && (
              <section className="rounded-xl border border-slate-200 bg-white p-3.5">
                <h3 className="text-xs font-bold text-slate-900">حقول جديدة فارغة في القالب ({newEmptyFields.length})</h3>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  {newEmptyFields.map(field => (
                    <span key={field.key} className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                      {field.label}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {errorMessage && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {errorMessage}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            disabled={isSubmitting}
            className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={isLoading || isSubmitting || !preview}
            onClick={() => onApply(strategy)}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            تطبيق القالب بأمان
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
