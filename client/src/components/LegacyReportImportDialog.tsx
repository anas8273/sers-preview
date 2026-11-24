import { useMemo, useState, type RefObject } from "react";
import { FileInput, X } from "lucide-react";
import { privateLocalStorage as localStorage } from "@/lib/private-browser-storage";
import { mapLegacyReportToFields, type LegacySavedReport } from "@shared/legacy-report-import";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type LegacyReportImportDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  allowedFieldKeys: readonly string[];
  onImport: (fields: Record<string, string>) => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

function readLegacyReports(): LegacySavedReport[] {
  try {
    const raw = localStorage.getItem("sers-reports");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is LegacySavedReport => Boolean(item && typeof item === "object" && typeof item.id === "string"));
  } catch {
    return [];
  }
}

export default function LegacyReportImportDialog({
  open,
  onOpenChange,
  allowedFieldKeys,
  onImport,
  returnFocusRef,
}: LegacyReportImportDialogProps) {
  const [selectedId, setSelectedId] = useState<string>("");
  const reports = useMemo(() => (open ? readLegacyReports() : []), [open]);

  const selectedReport = reports.find(report => report.id === selectedId) ?? reports[0];
  const preview = useMemo(
    () => (selectedReport ? mapLegacyReportToFields(selectedReport, allowedFieldKeys) : undefined),
    [selectedReport, allowedFieldKeys],
  );

  const handleConfirm = () => {
    if (!preview) return;
    onImport(preview.fields);
    onOpenChange(false);
  };

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
            <DialogTitle className="text-lg font-bold text-slate-950">استيراد مسودة تقرير قديمة</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-6 text-slate-600">
              اختر مسودة محفوظة محليًا من مركز التقارير القديم لاستيراد نصوصها إلى هذا التقرير بعد المعاينة. لا يتم الاستبدال تلقائيًا.
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="إغلاق نافذة استيراد المسودة القديمة"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {reports.length === 0 ? (
          <div className="mt-5 rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-8 text-center text-xs leading-6 text-slate-600">
            لا توجد مسودات محلية قديمة محفوظة في هذا المتصفح.
          </div>
        ) : (
          <div className="mt-5 space-y-4">
            <label className="block text-xs font-bold text-slate-700">
              اختر المسودة المحلية
              <select
                value={selectedReport?.id ?? ""}
                onChange={event => setSelectedId(event.target.value)}
                className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm"
              >
                {reports.map(report => (
                  <option key={report.id} value={report.id}>
                    {(report.title || "مسودة قديمة").trim()}
                  </option>
                ))}
              </select>
            </label>

            {preview && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs">
                <p className="font-bold text-slate-900">معاينة الحقول المستوردة ({preview.mappedFieldCount} حقل)</p>
                {Object.keys(preview.fields).length === 0 ? (
                  <p className="mt-2 text-slate-600">هذه المسودة لا تحتوي على حقول نصية ممتلئة.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {Object.entries(preview.fields).map(([key, value]) => (
                      <li key={key} className="rounded-lg border border-slate-200 bg-white px-3 py-2">
                        <span className="block font-bold text-teal-800">{key}</span>
                        <span className="mt-1 block whitespace-pre-wrap text-slate-700 [overflow-wrap:anywhere]">
                          {value.length > 180 ? `${value.slice(0, 180)}…` : value}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </div>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100"
          >
            إلغاء
          </button>
          <button
            type="button"
            disabled={!preview || Object.keys(preview.fields).length === 0}
            onClick={handleConfirm}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            <FileInput className="h-4 w-4" />
            استيراد إلى هذه المسودة
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
