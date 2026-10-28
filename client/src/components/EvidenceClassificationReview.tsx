import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";

export interface EvidenceReviewProposal {
  id: string;
  fileName: string;
  status: "proposed" | "unclassified";
  analyzing: boolean;
  reason: string;
  confidence?: number;
  criterionId?: string;
  subEvidenceId?: string;
  description?: string;
  persisted: boolean;
}

export interface EvidenceReviewCriterion {
  id: string;
  title: string;
  subEvidences: Array<{ id: string; title: string }>;
}

function ReviewRow({ item, criteria, onConfirm, onReject }: {
  item: EvidenceReviewProposal;
  criteria: EvidenceReviewCriterion[];
  onConfirm: (id: string, criterionId: string, subEvidenceId: string) => void;
  onReject: (id: string) => void;
}) {
  const canPrefill = item.status === "proposed" && (item.confidence ?? 0) >= 0.75;
  const [criterionId, setCriterionId] = useState(canPrefill ? item.criterionId ?? "" : "");
  const [subEvidenceId, setSubEvidenceId] = useState(canPrefill ? item.subEvidenceId ?? "" : "");
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!edited && canPrefill) {
      setCriterionId(item.criterionId ?? "");
      setSubEvidenceId(item.subEvidenceId ?? "");
    }
  }, [canPrefill, edited, item.criterionId, item.subEvidenceId]);
  const selected = criteria.find(criterion => criterion.id === criterionId);
  const validSelection = !!selected?.subEvidences.some(sub => sub.id === subEvidenceId);
  const proposedCriterion = criteria.find(criterion => criterion.id === item.criterionId);
  const proposedSub = proposedCriterion?.subEvidences.find(sub => sub.id === item.subEvidenceId);
  const selectClass = "mt-1 w-full rounded-md border border-input bg-background p-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
  return <article className="space-y-3 rounded-lg border bg-background p-3" aria-label={`مراجعة ${item.fileName}`}>
    <h3 className="break-all font-medium">{item.fileName}</h3>
    <p className="text-sm text-muted-foreground" role="status">{item.analyzing ? "جارٍ إعداد اقتراح؛ الملف محفوظ دون ربطه بأي بند." : item.reason}</p>
    {item.status === "proposed" && <div className="rounded-md bg-violet-50 p-2 text-sm text-violet-900 dark:bg-violet-950/40 dark:text-violet-100">
      <p>المقترح: {proposedCriterion?.title ?? "غير محدد"} ← {proposedSub?.title ?? "اختر البند يدويًا"}</p>
      <p>ثقة الاقتراح: {Math.round((item.confidence ?? 0) * 100)}٪</p>
      {(item.confidence ?? 0) < 0.75 && <p className="font-medium">الثقة منخفضة؛ اختر التصنيف بنفسك قبل الاعتماد.</p>}
      {item.description && <p className="mt-1 whitespace-pre-wrap">وصف مقترح: {item.description}</p>}
    </div>}
    {!item.persisted && <p role="alert" className="text-sm text-amber-700">لم يكتمل الحفظ على الجهاز. لا تغلق الصفحة قبل إضافة الملف أو إعادة اختياره.</p>}
    <div className="grid gap-3 sm:grid-cols-2">
      <label className="text-sm" htmlFor={`criterion-${item.id}`}>المعيار للملف {item.fileName}
        <select id={`criterion-${item.id}`} value={criterionId} disabled={item.analyzing} className={selectClass} onChange={event => { setEdited(true); setCriterionId(event.target.value); setSubEvidenceId(""); }}>
          <option value="">اختر المعيار</option>
          {criteria.map(criterion => <option key={criterion.id} value={criterion.id}>{criterion.title}</option>)}
        </select>
      </label>
      <label className="text-sm" htmlFor={`sub-${item.id}`}>البند للملف {item.fileName}
        <select id={`sub-${item.id}`} value={subEvidenceId} disabled={item.analyzing || !selected} className={selectClass} onChange={event => { setEdited(true); setSubEvidenceId(event.target.value); }}>
          <option value="">اختر البند</option>
          {selected?.subEvidences.map(sub => <option key={sub.id} value={sub.id}>{sub.title}</option>)}
        </select>
      </label>
    </div>
    <div className="flex flex-wrap gap-2">
      <Button type="button" size="sm" disabled={item.analyzing || !validSelection} onClick={() => onConfirm(item.id, criterionId, subEvidenceId)}>اعتماد التصنيف</Button>
      {item.status === "proposed" && <Button type="button" size="sm" variant="outline" disabled={item.analyzing} onClick={() => onReject(item.id)}>رفض الاقتراح</Button>}
    </div>
  </article>;
}

export function EvidenceClassificationReview({ items, criteria, onConfirm, onReject }: {
  items: EvidenceReviewProposal[];
  criteria: EvidenceReviewCriterion[];
  onConfirm: (id: string, criterionId: string, subEvidenceId: string) => void;
  onReject: (id: string) => void;
}) {
  if (!items.length) return null;
  return <section aria-labelledby="pending-evidence-heading" className="mb-5 space-y-3 rounded-xl border border-violet-200 bg-violet-50/40 p-3 sm:p-4 dark:border-violet-900 dark:bg-violet-950/20" dir="rtl">
    <h2 id="pending-evidence-heading" tabIndex={-1} className="font-bold">شواهد بانتظار المراجعة ({items.length})</h2>
    <p className="text-sm text-muted-foreground">هذه ملفات محلية غير مصنفة. الاقتراح يساعدك على التنظيم ولا يثبت تنفيذ نشاط أو صحة محتواه. لن يُربط ملف ببند ولن يُستخدم في سجل التعلم قبل اعتمادك.</p>
    {items.map(item => <ReviewRow key={`${item.id}:${item.status}`} item={item} criteria={criteria} onConfirm={onConfirm} onReject={onReject} />)}
  </section>;
}
