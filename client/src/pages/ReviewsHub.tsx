import { useMemo, useState } from "react";
import { CheckCircle2, Clock3, Loader2, MessageSquareText, RefreshCcw, XCircle } from "lucide-react";
import { useLocation } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";

const statusLabel = {
  pending: "بانتظار القرار",
  changes_requested: "طلب تعديل",
  approved: "معتمد",
  rejected: "مرفوض",
  cancelled: "ملغي",
} as const;

const statusClass = {
  pending: "bg-amber-50 text-amber-700",
  changes_requested: "bg-blue-50 text-blue-700",
  approved: "bg-emerald-50 text-emerald-700",
  rejected: "bg-red-50 text-red-700",
  cancelled: "bg-slate-100 text-slate-600",
} as const;

export default function ReviewsHub() {
  const [location] = useLocation();
  const [selectedReviewId, setSelectedReviewId] = useState<number | undefined>();
  const [comment, setComment] = useState("");
  const [decisionNote, setDecisionNote] = useState("");

  const utils = trpc.useUtils();
  const meQuery = trpc.auth.me.useQuery(undefined, { retry: false });
  const reviewsQuery = trpc.domain.review.list.useQuery(undefined, { retry: false });
  const reviewQuery = trpc.domain.review.get.useQuery(
    { id: selectedReviewId ?? 0 },
    { enabled: Boolean(selectedReviewId), retry: false },
  );

  const addComment = trpc.domain.review.comment.useMutation({
    onSuccess: async () => {
      setComment("");
      if (selectedReviewId) await utils.domain.review.get.invalidate({ id: selectedReviewId });
    },
  });

  const decide = trpc.domain.review.decide.useMutation({
    onSuccess: async () => {
      setDecisionNote("");
      await utils.domain.review.list.invalidate();
      if (selectedReviewId) await utils.domain.review.get.invalidate({ id: selectedReviewId });
    },
  });

  const incoming = useMemo(
    () => (reviewsQuery.data ?? []).filter(review => review.reviewerUserId === meQuery.data?.id),
    [reviewsQuery.data, meQuery.data?.id],
  );
  const outgoing = useMemo(
    () => (reviewsQuery.data ?? []).filter(review => review.requestedByUserId === meQuery.data?.id),
    [reviewsQuery.data, meQuery.data?.id],
  );

  const renderCard = (review: NonNullable<typeof reviewsQuery.data>[number], direction: "incoming" | "outgoing") => (
    <button
      key={review.id}
      onClick={() => setSelectedReviewId(review.id)}
      className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-right shadow-sm transition hover:border-teal-200 hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-bold text-slate-900">{review.workTitle}</p>
          <p className="mt-1 text-[11px] text-slate-500">نسخة {review.versionNumber} · {direction === "incoming" ? "وصلت إليك" : "أرسلتها للمراجعة"}</p>
        </div>
        <span className={`shrink-0 rounded-full px-2.5 py-1 text-[10px] font-bold ${statusClass[review.status]}`}>{statusLabel[review.status]}</span>
      </div>
      <div className="mt-4 flex items-center gap-2 border-t border-slate-100 pt-3 text-[11px] text-slate-400">
        <Clock3 className="h-3.5 w-3.5" />
        {new Date(review.updatedAt).toLocaleString("ar-SA")}
      </div>
    </button>
  );

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <header>
            <p className="text-xs font-bold text-teal-700">المراجعات والاعتمادات</p>
            <h1 className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>المراجعات</h1>
            <p className="mt-2 max-w-2xl text-sm leading-7 text-slate-500">كل قرار وتعليق هنا مرتبط بنسخة ثابتة من العمل؛ أي تعديل لاحق لا يغيّر النسخة التي تمت مراجعتها.</p>
          </header>

          {(reviewsQuery.isLoading || meQuery.isLoading) && (
            <div className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل المراجعات...</div>
          )}

          {reviewsQuery.error && <div className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-700">{reviewsQuery.error.message}</div>}

          {reviewsQuery.data && reviewsQuery.data.length === 0 && (
            <section className="mt-8 rounded-2xl border border-dashed border-slate-200 bg-white px-6 py-16 text-center">
              <MessageSquareText className="mx-auto h-9 w-9 text-slate-300" />
              <h2 className="mt-4 text-base font-bold text-slate-900">لا توجد مراجعات حاليًا</h2>
              <p className="mx-auto mt-2 max-w-lg text-sm leading-7 text-slate-500">أنشئ نسخة ثابتة من عمل مدرسي ثم أرسلها إلى مراجع مؤهل من المدرسة.</p>
            </section>
          )}

          {reviewsQuery.data && reviewsQuery.data.length > 0 && (
            <div className="mt-8 grid gap-6 lg:grid-cols-2">
              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">وصلت إليّ</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{incoming.length}</span></div>
                <div className="space-y-3">{incoming.length ? incoming.map(review => renderCard(review, "incoming")) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-500">لا توجد مراجعات واردة.</div>}</div>
              </section>
              <section>
                <div className="mb-3 flex items-center justify-between"><h2 className="text-sm font-black text-slate-900">أرسلتها</h2><span className="rounded-full bg-slate-100 px-2.5 py-1 text-[10px] font-bold text-slate-600">{outgoing.length}</span></div>
                <div className="space-y-3">{outgoing.length ? outgoing.map(review => renderCard(review, "outgoing")) : <div className="rounded-2xl border border-dashed border-slate-200 bg-white p-6 text-center text-xs text-slate-500">لم ترسل أي نسخة للمراجعة بعد.</div>}</div>
              </section>
            </div>
          )}

          {selectedReviewId && (
            <section className="mt-8 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              {reviewQuery.isLoading && <div className="flex items-center text-sm text-slate-500"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل تفاصيل المراجعة...</div>}
              {reviewQuery.data && (
                <>
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-xs font-bold text-teal-700">تفاصيل المراجعة</p>
                      <h2 className="mt-1 text-lg font-black text-slate-950">{reviewQuery.data.workTitle}</h2>
                      <p className="mt-1 text-xs text-slate-500">نسخة ثابتة رقم {reviewQuery.data.versionNumber}</p>
                    </div>
                    <span className={`self-start rounded-full px-3 py-1.5 text-[11px] font-bold ${statusClass[reviewQuery.data.status]}`}>{statusLabel[reviewQuery.data.status]}</span>
                  </div>

                  <div className="mt-5 border-t border-slate-100 pt-5">
                    <h3 className="text-sm font-bold text-slate-900">التعليقات</h3>
                    <div className="mt-3 space-y-2">
                      {reviewQuery.data.comments.length === 0 && <p className="rounded-xl bg-slate-50 p-4 text-xs text-slate-500">لا توجد تعليقات بعد.</p>}
                      {reviewQuery.data.comments.map(item => (
                        <div key={item.id} className="rounded-xl border border-slate-200 p-3">
                          <p className="text-sm leading-7 text-slate-700">{item.content}</p>
                          <p className="mt-1 text-[10px] text-slate-400">{new Date(item.createdAt).toLocaleString("ar-SA")}</p>
                        </div>
                      ))}
                    </div>
                    <div className="mt-3 flex gap-2">
                      <input value={comment} onChange={event => setComment(event.target.value)} maxLength={4000} placeholder="أضف تعليقًا على النسخة..." className="min-w-0 flex-1 rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" />
                      <button onClick={() => comment.trim() && addComment.mutate({ reviewId: selectedReviewId, content: comment.trim() })} disabled={!comment.trim() || addComment.isPending} className="rounded-xl bg-teal-600 px-4 py-2.5 text-xs font-bold text-white disabled:opacity-50">إرسال</button>
                    </div>
                  </div>

                  {reviewQuery.data.reviewerUserId === meQuery.data?.id && reviewQuery.data.status === "pending" && (
                    <div className="mt-6 border-t border-slate-100 pt-5">
                      <h3 className="text-sm font-bold text-slate-900">قرار المراجع</h3>
                      <textarea value={decisionNote} onChange={event => setDecisionNote(event.target.value)} rows={3} maxLength={4000} placeholder="ملاحظة القرار (اختياري)" className="mt-3 w-full resize-none rounded-xl border border-slate-200 px-3 py-2.5 text-sm outline-none focus:border-teal-400" />
                      <div className="mt-3 grid gap-2 sm:grid-cols-3">
                        <button onClick={() => decide.mutate({ reviewId: selectedReviewId, decision: "approved", note: decisionNote.trim() || undefined })} disabled={decide.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><CheckCircle2 className="h-4 w-4" />اعتماد</button>
                        <button onClick={() => decide.mutate({ reviewId: selectedReviewId, decision: "changes_requested", note: decisionNote.trim() || undefined })} disabled={decide.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><RefreshCcw className="h-4 w-4" />طلب تعديل</button>
                        <button onClick={() => decide.mutate({ reviewId: selectedReviewId, decision: "rejected", note: decisionNote.trim() || undefined })} disabled={decide.isPending} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50"><XCircle className="h-4 w-4" />رفض</button>
                      </div>
                      {decide.error && <p className="mt-3 text-xs text-red-600">{decide.error.message}</p>}
                    </div>
                  )}
                </>
              )}
            </section>
          )}
        </div>
      </main>
    </div>
  );
}
