import { useEffect, useState, type RefObject } from "react";
import { AlertTriangle, Loader2, Trash2, X } from "lucide-react";
import { Link } from "wouter";
import { trpc } from "@/lib/trpc";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";

type AssetDeleteDialogProps = {
  asset: { id: number; title: string } | null;
  onClose: () => void;
  onDeleted: () => void;
  returnFocusRef?: RefObject<HTMLElement | null>;
};

const statusLabels: Record<string, string> = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  archived: "مؤرشف",
};

export default function AssetDeleteDialog({
  asset,
  onClose,
  onDeleted,
  returnFocusRef,
}: AssetDeleteDialogProps) {
  const [confirmedUnlink, setConfirmedUnlink] = useState(false);

  useEffect(() => {
    setConfirmedUnlink(false);
  }, [asset?.id]);

  const usageQuery = trpc.domain.asset.usage.useQuery(
    { id: asset?.id ?? 0 },
    { enabled: Boolean(asset), retry: false },
  );

  const deleteMutation = trpc.domain.asset.delete.useMutation({
    onSuccess: () => {
      onDeleted();
      onClose();
    },
  });

  useEffect(() => {
    if (!asset) deleteMutation.reset();
  }, [asset, deleteMutation]);

  const activeLinks = usageQuery.data?.activeLinks ?? [];
  const historicalVersionCount = usageQuery.data?.historicalVersionCount ?? 0;
  const hasActiveLinks = activeLinks.length > 0;
  const canConfirm = !usageQuery.isLoading && !usageQuery.error && !deleteMutation.isPending && (!hasActiveLinks || confirmedUnlink);

  const handleDelete = () => {
    if (!asset || !canConfirm) return;
    deleteMutation.mutate({
      id: asset.id,
      ...(hasActiveLinks ? { unlinkActive: true } : {}),
    });
  };

  return (
    <Dialog open={Boolean(asset)} onOpenChange={open => { if (!open) onClose(); }}>
      <DialogContent
        showCloseButton={false}
        dir="rtl"
        className="z-[80] block max-h-[calc(100dvh-2rem)] max-w-lg overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl"
        onCloseAutoFocus={event => {
          if (returnFocusRef?.current) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <DialogTitle className="text-lg font-bold text-slate-950">حذف الشاهد</DialogTitle>
            <DialogDescription className="mt-1 text-xs leading-6 text-slate-600">
              {asset ? `هل تريد حذف «${asset.title}» من مكتبة الشواهد؟` : ""}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100"
            aria-label="إغلاق نافذة حذف الشاهد"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-xs leading-6 text-slate-700">
          <p className="font-semibold text-slate-900">النسخ الثابتة المحفوظة سابقًا لا تتأثر بالحذف</p>
          {historicalVersionCount > 0 && (
            <p className="mt-1 font-bold text-teal-800">مستخدم في {historicalVersionCount} نسخة ثابتة محفوظة</p>
          )}
        </div>

        {usageQuery.isLoading && (
          <div role="status" className="mt-4 flex items-center justify-center rounded-xl border border-slate-200 py-8 text-xs text-slate-600">
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
            جارٍ فحص ارتباطات الشاهد...
          </div>
        )}

        {usageQuery.error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {usageQuery.error.message}
          </p>
        )}

        {!usageQuery.isLoading && !usageQuery.error && hasActiveLinks && (
          <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50/70 p-3.5">
            <div className="flex items-start gap-2 text-xs font-bold text-amber-950">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-700" />
              <span>هذا الشاهد مرتبط حاليًا بـ {activeLinks.length} عمل:</span>
            </div>
            <ul className="mt-2.5 space-y-1.5 text-xs">
              {activeLinks.map(link => (
                <li key={`${link.workItemId}-${link.role}`} className="flex items-center justify-between gap-2 rounded-lg border border-amber-200 bg-white px-3 py-2">
                  <Link href={`/work/${link.workItemId}`} onClick={onClose} className="truncate font-bold text-teal-800 hover:underline">
                    {link.workTitle}
                  </Link>
                  <span className="shrink-0 rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-semibold text-slate-700">
                    {statusLabels[link.workStatus] ?? link.workStatus}
                  </span>
                </li>
              ))}
            </ul>
            <label className="mt-3 flex min-h-11 cursor-pointer items-center gap-2.5 rounded-xl border border-amber-300 bg-white px-3 py-2 text-xs font-bold text-slate-900">
              <input
                type="checkbox"
                checked={confirmedUnlink}
                onChange={event => setConfirmedUnlink(event.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              أفهم أن الشاهد سيُفك ربطه من هذه الأعمال
            </label>
          </div>
        )}

        {deleteMutation.error && (
          <p role="alert" className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700">
            {deleteMutation.error.message}
          </p>
        )}

        <div className="mt-5 flex justify-end gap-2 border-t border-slate-100 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={deleteMutation.isPending}
            className="min-h-11 rounded-xl px-4 py-2.5 text-sm font-bold text-slate-700 hover:bg-slate-100 disabled:opacity-50"
          >
            إلغاء
          </button>
          <button
            type="button"
            onClick={handleDelete}
            disabled={!canConfirm}
            className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-red-800 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {deleteMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            حذف الشاهد
          </button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
