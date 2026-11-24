import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  CheckCircle2,
  FileText,
  FolderKanban,
  Info,
  Link2,
  Loader2,
  PencilLine,
  Plus,
  RefreshCw,
  Send,
  ShieldCheck,
  Trash2,
  UserRound,
} from "lucide-react";
import { useLocation, useRoute } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import PortfolioReferencePanel from "@/components/PortfolioReferencePanel";
import { trpc } from "@/lib/trpc";
import { evaluateWorkReadiness } from "@shared/evidence-readiness";

const statusLabel = {
  draft: "مسودة",
  in_review: "قيد المراجعة",
  approved: "معتمد",
  archived: "مؤرشف",
} as const;

export default function WorkDetail() {
  const [location, setLocation] = useLocation();
  const [, params] = useRoute<{ id: string }>("/work/:id");
  const workId = Number(params?.id);
  const validWorkId = Number.isInteger(workId) && workId > 0;
  const [selectedAssetId, setSelectedAssetId] = useState<number | undefined>();
  const [selectedVersionId, setSelectedVersionId] = useState<number | undefined>();
  const [selectedReviewerId, setSelectedReviewerId] = useState<number | undefined>();
  const [editYearId, setEditYearId] = useState<number | undefined>();
  const [editTermId, setEditTermId] = useState<number | undefined>();
  const [yearSavedNotice, setYearSavedNotice] = useState(false);

  const utils = trpc.useUtils();
  const workQuery = trpc.domain.work.get.useQuery(
    { id: workId },
    { enabled: validWorkId, retry: false },
  );
  const yearsQuery = trpc.account.academicYears.useQuery(undefined, { retry: false });
  const assetsQuery = trpc.domain.asset.list.useQuery(undefined, { retry: false });
  const versionsQuery = trpc.reviewSupport.versions.useQuery(
    { workItemId: workId },
    { enabled: validWorkId, retry: false },
  );
  const reportDraftQuery = trpc.domain.reportDraft.get.useQuery(
    { workItemId: workId },
    { enabled: validWorkId && workQuery.data?.type === "report", retry: false },
  );
  const portfolioDraftQuery = trpc.domain.portfolioDraft.get.useQuery(
    { workItemId: workId },
    { enabled: validWorkId && workQuery.data?.type === "portfolio", retry: false },
  );
  const firstAssetId = workQuery.data?.assets[0]?.id;
  const firstAssetStandardsQuery = trpc.domain.standards.listForAsset.useQuery(
    { assetId: firstAssetId ?? 0 },
    { enabled: Boolean(firstAssetId), retry: false },
  );
  const organizationId = workQuery.data?.ownerType === "organization"
    ? workQuery.data.ownerOrganizationId ?? undefined
    : undefined;
  const reviewersQuery = trpc.reviewSupport.reviewers.useQuery(
    { organizationId: organizationId ?? 0 },
    { enabled: Boolean(organizationId), retry: false },
  );

  const linkAsset = trpc.domain.asset.linkToWork.useMutation({
    onSuccess: async () => {
      setSelectedAssetId(undefined);
      await utils.domain.work.get.invalidate({ id: workId });
    },
  });
  const unlinkAsset = trpc.domain.asset.unlinkFromWork.useMutation({
    onSuccess: async () => {
      await utils.domain.work.get.invalidate({ id: workId });
    },
  });
  const updateWork = trpc.domain.work.update.useMutation({
    onSuccess: async () => {
      setYearSavedNotice(true);
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.domain.work.list.invalidate(),
      ]);
    },
  });
  const requestReview = trpc.domain.review.request.useMutation({
    onSuccess: async () => {
      await Promise.all([
        utils.domain.work.get.invalidate({ id: workId }),
        utils.domain.work.list.invalidate(),
        utils.domain.review.list.invalidate(),
      ]);
      setLocation("/reviews");
    },
  });

  const linkedIds = useMemo(
    () => new Set((workQuery.data?.assets ?? []).map(asset => asset.id)),
    [workQuery.data?.assets],
  );
  const availableAssets = useMemo(
    () => (assetsQuery.data ?? []).filter(asset => !linkedIds.has(asset.id)),
    [assetsQuery.data, linkedIds],
  );
  const versions = versionsQuery.data ?? [];
  const reviewers = reviewersQuery.data ?? [];
  const scopeYears = useMemo(
    () => (yearsQuery.data ?? []).filter(year =>
      workQuery.data?.ownerType === "personal"
        ? year.ownerUserId !== null
        : year.organizationId === workQuery.data?.ownerOrganizationId,
    ),
    [yearsQuery.data, workQuery.data?.ownerType, workQuery.data?.ownerOrganizationId],
  );
  const chosenYear = useMemo(
    () => scopeYears.find(year => year.id === editYearId),
    [scopeYears, editYearId],
  );
  const readiness = useMemo(() => {
    const work = workQuery.data;
    if (!work) return undefined;
    const hasReportFields = Object.values(reportDraftQuery.data?.draft.fields ?? {}).some(value =>
      typeof value === "string"
        ? value.trim().length > 0
        : Array.isArray(value)
          ? value.length > 0
          : value !== undefined && value !== null,
    );
    const hasPortfolioContent = Boolean(
      portfolioDraftQuery.data?.draft.introduction?.trim() ||
        (portfolioDraftQuery.data?.draft.entries?.length ?? 0) > 0,
    );
    const hasSubstantiveContent =
      versions.length > 0 ||
      work.currentVersionNumber > 0 ||
      (work.type === "report" ? hasReportFields : hasPortfolioContent);

    return evaluateWorkReadiness({
      workType: work.type === "portfolio" ? "portfolio" : "report",
      linkedAssets: work.assets.map(asset => ({
        id: asset.id,
        kind: asset.kind === "file" || asset.kind === "link" || asset.kind === "text" ? asset.kind : "text",
        title: asset.title,
      })),
      hasAcademicContext: Boolean(work.academicYearId || work.academicContext?.yearLabel),
      hasSubstantiveContent,
      versionCount: versions.length || work.currentVersionNumber,
      linkedStandardsCount: firstAssetStandardsQuery.data?.length ?? 0,
    });
  }, [
    workQuery.data,
    versions.length,
    reportDraftQuery.data?.draft.fields,
    portfolioDraftQuery.data?.draft.introduction,
    portfolioDraftQuery.data?.draft.entries,
    firstAssetStandardsQuery.data?.length,
  ]);

  useEffect(() => {
    if (!workQuery.data) return;
    setEditYearId(workQuery.data.academicYearId ?? undefined);
    setEditTermId(workQuery.data.academicTermId ?? undefined);
  }, [workQuery.data?.academicYearId, workQuery.data?.academicTermId]);

  if (!validWorkId) {
    return <div className="min-h-screen bg-[#F8FAFC] p-8 text-sm text-red-700" dir="rtl">معرّف العمل غير صالح.</div>;
  }

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-20 lg:pb-0" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 sm:py-10">
          <button type="button" onClick={() => setLocation("/work")} className="mr-12 inline-flex min-h-11 items-center gap-2 text-sm font-bold text-slate-700 hover:text-teal-700 lg:mr-0">
            <ArrowRight className="h-4 w-4" /> العودة إلى أعمالي
          </button>

          {workQuery.isLoading && (
            <div role="status" className="mt-8 flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-16 text-sm text-slate-600"><Loader2 className="ml-2 h-4 w-4 animate-spin" />جاري تحميل العمل...</div>
          )}
          {workQuery.error && (
            <div role="alert" className="mt-8 rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800">
              <p>{workQuery.error.message}</p>
              <button
                type="button"
                disabled={workQuery.isFetching}
                onClick={() => void workQuery.refetch()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </button>
            </div>
          )}

          {workQuery.data && (
            <>
              <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex items-start gap-3">
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-teal-50 text-teal-700">
                      {workQuery.data.type === "report" ? <FileText className="h-5 w-5" /> : <FolderKanban className="h-5 w-5" />}
                    </div>
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{statusLabel[workQuery.data.status]}</span>
                        <span className="rounded-full bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-800">نسخة {workQuery.data.currentVersionNumber}</span>
                      </div>
                      <h1 className="mt-3 text-2xl font-black text-slate-950 [overflow-wrap:anywhere]" style={{ fontFamily: "'Tajawal', sans-serif" }}>{workQuery.data.title}</h1>
                      <div className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                        {workQuery.data.ownerType === "personal" ? <UserRound className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                        {workQuery.data.ownerType === "personal" ? "ملكية شخصية" : "ملكية مدرسية"}
                      </div>
                    </div>
                  </div>
                  <div className="flex flex-col gap-3 sm:items-end">
                    {workQuery.data.type === "report" && (
                      <button type="button" onClick={() => setLocation(`/work/${workId}/report`)} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-5 py-3 text-sm font-bold text-white shadow-sm hover:bg-teal-800">
                        <PencilLine className="h-4 w-4" /> فتح محرر التقرير
                      </button>
                    )}
                    <div className="max-w-md rounded-xl border border-teal-100 bg-teal-50 px-4 py-3 text-xs leading-6 text-teal-900">
                      الشواهد تبقى أصولًا مستقلة. إزالة الربط من هذا العمل لا تحذف الأصل من المكتبة.
                    </div>
                  </div>
                </div>
              </section>

              <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_0.8fr]">
                <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                  <div className="flex items-center justify-between gap-3">
                    <div><p className="text-xs font-bold text-teal-700">إعادة الاستخدام</p><h2 className="mt-1 text-lg font-bold text-slate-950">الشواهد المرتبطة</h2></div>
                    <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-bold text-slate-700">{workQuery.data.assets.length} شاهد</span>
                  </div>

                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <select aria-label="اختر شاهدًا من المكتبة" value={selectedAssetId ?? ""} onChange={event => setSelectedAssetId(Number(event.target.value) || undefined)} className="min-w-0 flex-1 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                      <option value="">اختر شاهدًا من المكتبة</option>
                      {availableAssets.map(asset => <option key={asset.id} value={asset.id}>{asset.title} — {asset.kind}</option>)}
                    </select>
                    <button type="button" onClick={() => selectedAssetId && linkAsset.mutate({ workItemId: workId, assetId: selectedAssetId, role: "evidence" })} disabled={!selectedAssetId || linkAsset.isPending} className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
                      {linkAsset.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />} ربط الشاهد
                    </button>
                  </div>
                  {linkAsset.error && <p role="alert" className="mt-2 text-xs text-red-700">{linkAsset.error.message}</p>}

                  {workQuery.data.assets.length === 0 ? (
                    <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-600">لا توجد شواهد مرتبطة. أضفها من المكتبة بدل إعادة الرفع.</div>
                  ) : (
                    <div className="mt-5 space-y-3">
                      {workQuery.data.assets.map(asset => (
                        <div key={`${asset.id}-${asset.role}`} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-50 text-slate-600"><Link2 className="h-4 w-4" /></div>
                          <div className="min-w-0 flex-1"><p className="truncate text-sm font-bold text-slate-900">{asset.title}</p><p className="mt-0.5 text-xs text-slate-600">{asset.kind} · {asset.role}</p></div>
                          <button type="button" onClick={() => unlinkAsset.mutate({ workItemId: workId, assetId: asset.id, role: asset.role })} disabled={unlinkAsset.isPending} className="inline-flex min-h-11 min-w-11 shrink-0 items-center justify-center rounded-lg text-slate-600 hover:bg-red-50 hover:text-red-700 disabled:opacity-50" aria-label={`إزالة ربط ${asset.title}`}><Trash2 className="h-4 w-4" /></button>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <div className="space-y-6">
                  {readiness && (
                    <section
                      aria-label="فحص جاهزية الشواهد قبل التقديم"
                      className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6"
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div>
                          <p className="text-xs font-bold text-teal-700">فحص استرشادي غير مانع</p>
                          <h2 className="mt-1 text-base font-bold text-slate-950">فحص جاهزية الشواهد قبل التقديم</h2>
                        </div>
                        <span
                          className={`rounded-full border px-2.5 py-1 text-[11px] font-bold ${
                            readiness.status === "ready"
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : readiness.status === "needs_attention"
                                ? "border-amber-200 bg-amber-50 text-amber-900"
                                : "border-slate-200 bg-slate-100 text-slate-700"
                          }`}
                        >
                          {readiness.summaryLabel}
                        </span>
                      </div>

                      <div className="mt-3 flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-bold ${
                            readiness.verifiedFileCount > 0
                              ? "border-emerald-200 bg-emerald-50 text-emerald-800"
                              : "border-amber-200 bg-amber-50 text-amber-900"
                          }`}
                        >
                          <ShieldCheck className="h-3 w-3" />
                          {readiness.proofBadge}
                        </span>
                        <span className="text-[11px] text-slate-600">
                          ملفات موثّقة: {readiness.verifiedFileCount} · روابط/نصوص: {readiness.supportingAssetCount}
                        </span>
                      </div>

                      <ul className="mt-4 space-y-2">
                        {readiness.checks.map(check => (
                          <li
                            key={check.key}
                            className="flex items-start gap-2 rounded-xl border border-slate-100 bg-slate-50 px-3 py-2.5 text-xs"
                          >
                            {check.status === "pass" ? (
                              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                            ) : check.status === "advisory" ? (
                              <Info className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" />
                            ) : (
                              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                            )}
                            <div>
                              <p className="font-bold text-slate-900">{check.label}</p>
                              <p className="mt-0.5 leading-5 text-slate-600">{check.detail}</p>
                            </div>
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}

                  {workQuery.data.type === "report" ? (
                    <section className="rounded-2xl border border-teal-200 bg-teal-50 p-5 shadow-sm sm:p-6">
                      <p className="text-xs font-bold text-teal-800">مصدر الحقيقة</p>
                      <h2 className="mt-1 text-lg font-bold text-slate-950">أنشئ النسخة من محرر التقرير</h2>
                      <p className="mt-2 text-xs leading-6 text-slate-700">حتى تحتوي النسخة على النص والقالب والشواهد معًا، لا يسمح هذا المسار بإنشاء لقطة تقرير ناقصة. افتح المحرر واحفظ التقرير ثم أنشئ النسخة هناك.</p>
                      <button type="button" onClick={() => setLocation(`/work/${workId}/report`)} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800">
                        <PencilLine className="h-4 w-4" /> تحرير التقرير وإنشاء نسخة
                      </button>
                    </section>
                  ) : (
                    <>
                      <PortfolioReferencePanel
                        workId={workId}
                        ownerType={workQuery.data.ownerType}
                        ownerOrganizationId={workQuery.data.ownerOrganizationId ?? null}
                      />
                      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                        <p className="text-xs font-bold text-teal-700">ملف الإنجاز المحلي</p>
                        <h2 className="mt-1 text-lg font-bold text-slate-950">المحتوى غير مرتبط بهذه النسخة السحابية</h2>
                        <p className="mt-2 text-xs leading-6 text-slate-600">هذا العمل يحتفظ حاليًا ببيانات وصفية وشواهد فقط، وليس نسخة مكتملة من محتوى ملف الإنجاز المحلي. لن ننشئ نسخة ناقصة أو نكتب إلى قاعدة البيانات تلقائيًا.</p>
                        <button type="button" onClick={() => setLocation("/portfolio")} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-900 hover:bg-teal-100">
                          فتح منشئ ملف الإنجاز المحلي
                        </button>
                        <p className="mt-3 text-xs leading-5 text-slate-600">الاستيراد إلى Work سيكون اختياريًا لاحقًا بعد اعتماد عقد محتوى typed مع معاينة ومقارنة وتراجع، وليس تلقائيًا الآن.</p>
                      </section>
                    </>
                  )}

                  {workQuery.data.ownerType === "organization" && !(workQuery.data.type === "portfolio" && versions.length === 0) && (
                    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                      <p className="text-xs font-bold text-teal-700">مراجعة مدرسية</p>
                      <h2 className="mt-1 text-lg font-bold text-slate-950">إرسال نسخة للمراجعة</h2>
                      <p className="mt-2 text-xs leading-6 text-slate-600">اختر نسخة محفوظة ومراجعًا مؤهلًا من نفس المدرسة. لن تتغير النسخة إذا عدّلت العمل بعد الإرسال.</p>

                      <label className="mt-4 block text-xs font-bold text-slate-700">النسخة</label>
                      <select value={selectedVersionId ?? ""} onChange={event => setSelectedVersionId(Number(event.target.value) || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                        <option value="">اختر نسخة ثابتة</option>
                        {versions.map(version => <option key={version.id} value={version.id}>نسخة {version.versionNumber}{version.reason ? ` — ${version.reason}` : ""}</option>)}
                      </select>

                      <label className="mt-4 block text-xs font-bold text-slate-700">المراجع</label>
                      <select value={selectedReviewerId ?? ""} onChange={event => setSelectedReviewerId(Number(event.target.value) || undefined)} className="mt-2 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm">
                        <option value="">اختر المراجع</option>
                        {reviewers.map(reviewer => <option key={reviewer.userId} value={reviewer.userId}>{reviewer.name || `مستخدم ${reviewer.userId}`} — {reviewer.role}</option>)}
                      </select>

                      {reviewersQuery.data && reviewers.length === 0 && <p className="mt-3 text-xs leading-6 text-amber-800">لا يوجد مراجع مؤهل حاليًا في هذه المدرسة. يلزم عضو بدور reviewer أو admin أو owner.</p>}
                      <button type="button" onClick={() => selectedVersionId && selectedReviewerId && requestReview.mutate({ workVersionId: selectedVersionId, reviewerUserId: selectedReviewerId })} disabled={!selectedVersionId || !selectedReviewerId || requestReview.isPending} className="mt-4 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white hover:bg-teal-800 disabled:opacity-50">
                        {requestReview.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} إرسال للمراجعة
                      </button>
                      {requestReview.error && <p role="alert" className="mt-3 text-xs text-red-700">{requestReview.error.message}</p>}
                    </section>
                  )}

                  <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                    <div className="flex items-center gap-2">
                      <CalendarDays className="h-4 w-4 text-teal-700" />
                      <h2 className="text-base font-bold text-slate-950">السنة والفصل الدراسي</h2>
                    </div>
                    <p className="mt-1 text-xs leading-6 text-slate-600">
                      السياق الحالي:{" "}
                      <span className="font-bold text-teal-800">
                        {workQuery.data.academicContext
                          ? `${workQuery.data.academicContext.yearLabel}${workQuery.data.academicContext.termLabel ? ` · ${workQuery.data.academicContext.termLabel}` : ""}`
                          : "دون سنة دراسية محددة"}
                      </span>
                    </p>
                    <div className="mt-4 space-y-3">
                      <label className="block text-xs font-bold text-slate-700">
                        السنة الدراسية
                        <select
                          aria-label="ربط العمل بسنة دراسية"
                          value={editYearId ?? ""}
                          disabled={workQuery.data.status === "archived" || updateWork.isPending}
                          onChange={event => {
                            setYearSavedNotice(false);
                            setEditYearId(Number(event.target.value) || undefined);
                            setEditTermId(undefined);
                          }}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal disabled:opacity-50"
                        >
                          <option value="">دون سنة دراسية</option>
                          {scopeYears.map(year => (
                            <option key={year.id} value={year.id}>{year.label}</option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-bold text-slate-700">
                        الفصل الدراسي
                        <select
                          aria-label="ربط العمل بفصل دراسي"
                          value={editTermId ?? ""}
                          disabled={!chosenYear || workQuery.data.status === "archived" || updateWork.isPending}
                          onChange={event => {
                            setYearSavedNotice(false);
                            setEditTermId(Number(event.target.value) || undefined);
                          }}
                          className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal disabled:opacity-50"
                        >
                          <option value="">دون فصل محدد</option>
                          {chosenYear?.terms.map(term => (
                            <option key={term.id} value={term.id}>{term.label}</option>
                          ))}
                        </select>
                      </label>
                      <button
                        type="button"
                        disabled={workQuery.data.status === "archived" || updateWork.isPending}
                        onClick={() => {
                          setYearSavedNotice(false);
                          updateWork.mutate({
                            id: workId,
                            academicYearId: editYearId ?? null,
                            academicTermId: editYearId ? (editTermId ?? null) : null,
                          });
                        }}
                        className="inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2.5 text-sm font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50"
                      >
                        {updateWork.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                        حفظ السنة والفصل
                      </button>
                      {yearSavedNotice && !updateWork.error && (
                        <p role="status" className="text-xs font-semibold text-teal-800">تم تحديث السنة والفصل الدراسي.</p>
                      )}
                      {updateWork.error && (
                        <p role="alert" className="text-xs text-red-700">{updateWork.error.message}</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
