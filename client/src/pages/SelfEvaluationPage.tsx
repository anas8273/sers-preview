import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ClipboardCheck,
  Download,
  ExternalLink,
  FilePlus2,
  Filter,
  Loader2,
  Plus,
  Printer,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from "lucide-react";
import { useLocation } from "wouter";
import AppSidebar from "@/components/AppSidebar";
import { trpc } from "@/lib/trpc";
import {
  computeSelfEvaluationSummary,
  getApplicableIndicators,
  SELF_EVALUATION_DOMAINS,
  SELF_EVALUATION_FRAMEWORK_ID,
  SELF_EVALUATION_FRAMEWORK_META,
  SELF_EVALUATION_INDICATORS,
  SELF_EVALUATION_LEVELS,
  SELF_EVALUATION_STANDARDS,
  type ImprovementAction,
  type ImprovementActionStatus,
  type IndicatorAssessment,
  type SelfEvaluationDomainKey,
  type SelfEvaluationLevel,
  type SelfEvaluationSchoolCategory,
} from "@shared/self-evaluation";

const actionStatusLabels: Record<ImprovementActionStatus, string> = {
  planned: "مخطط",
  in_progress: "قيد التنفيذ",
  completed: "مكتمل",
};

const schoolCategoryLabels: Record<SelfEvaluationSchoolCategory, string> = {
  government: "مدرسة حكومية (48 مؤشرًا معتمدًا)",
  private_international: "مدرسة أهلية / عالمية (51 مؤشرًا معتمدًا)",
};

const levelBadgeClasses: Record<SelfEvaluationLevel, string> = {
  1: "border-red-300 bg-red-50 text-red-900",
  2: "border-amber-300 bg-amber-50 text-amber-900",
  3: "border-teal-300 bg-teal-50 text-teal-900",
  4: "border-emerald-300 bg-emerald-50 text-emerald-900",
};

type IndicatorFilterMode = "all" | "unrated" | "gaps";

function readInitialCycleIdFromUrl(): number | undefined {
  if (typeof window === "undefined") return undefined;
  const raw = new URLSearchParams(window.location.search).get("cycleId");
  if (!raw) return undefined;
  const parsed = Number(raw);
  return Number.isInteger(parsed) && parsed > 0 ? parsed : undefined;
}

export default function SelfEvaluationPage() {
  const [location, navigate] = useLocation();
  const [selectedCycleId, setSelectedCycleId] = useState<number | undefined>(() =>
    readInitialCycleIdFromUrl(),
  );
  const [activeDomain, setActiveDomain] = useState<SelfEvaluationDomainKey>("administration");
  const [indicatorFilter, setIndicatorFilter] = useState<IndicatorFilterMode>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);

  // Create form state
  const [newTitle, setNewTitle] = useState("دورة التقويم الذاتي المدرسي وخطة التحسين");
  const [newOwnerType, setNewOwnerType] = useState<"organization" | "personal">("organization");
  const [newSchoolCategory, setNewSchoolCategory] =
    useState<SelfEvaluationSchoolCategory>("government");
  const [newOrgId, setNewOrgId] = useState<number | undefined>();
  const [newYearId, setNewYearId] = useState<number | undefined>();
  const [newTermId, setNewTermId] = useState<number | undefined>();

  // Editable cycle state
  const [revision, setRevision] = useState(1);
  const [schoolCategory, setSchoolCategory] =
    useState<SelfEvaluationSchoolCategory>("government");
  const [executiveSummary, setExecutiveSummary] = useState("");
  const [assessments, setAssessments] = useState<Record<string, IndicatorAssessment>>({});
  const [actions, setActions] = useState<ImprovementAction[]>([]);
  const [dirty, setDirty] = useState(false);
  const [saveNotice, setSaveNotice] = useState("");

  const utils = trpc.useUtils();
  const orgsQuery = trpc.domain.organization.listMine.useQuery(undefined, { retry: false });
  const yearsQuery = trpc.account.academicYears.useQuery(undefined, { retry: false });
  const assetsQuery = trpc.domain.asset.list.useQuery(undefined, { retry: false });
  const cyclesQuery = trpc.domain.selfEvaluation.listCycles.useQuery(undefined, { retry: false });

  const creatableOrgs = useMemo(
    () => (orgsQuery.data ?? []).filter(org => org.role === "owner" || org.role === "admin"),
    [orgsQuery.data],
  );

  useEffect(() => {
    if (!orgsQuery.data) return;
    if (creatableOrgs.length === 0 && newOwnerType === "organization") {
      setNewOwnerType("personal");
    } else if (creatableOrgs.length > 0 && !newOrgId) {
      setNewOrgId(creatableOrgs[0]!.id);
    }
  }, [orgsQuery.data, creatableOrgs, newOwnerType, newOrgId]);

  useEffect(() => {
    if (!cyclesQuery.data || cyclesQuery.data.length === 0) return;
    if (!selectedCycleId) {
      setSelectedCycleId(cyclesQuery.data[0]!.id);
    }
  }, [cyclesQuery.data, selectedCycleId]);

  useEffect(() => {
    if (!dirty) return;
    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [dirty]);

  const cycleQuery = trpc.domain.selfEvaluation.getCycle.useQuery(
    { workItemId: selectedCycleId ?? 0 },
    { enabled: Boolean(selectedCycleId), retry: false },
  );
  const canEdit = cycleQuery.data?.canEdit ?? false;

  useEffect(() => {
    setSaveNotice("");
  }, [selectedCycleId]);

  useEffect(() => {
    if (!cycleQuery.data) return;
    setRevision(cycleQuery.data.draft.revision);
    setSchoolCategory(cycleQuery.data.draft.schoolCategory ?? "government");
    setExecutiveSummary(cycleQuery.data.draft.executiveSummary);
    setAssessments(cycleQuery.data.draft.assessments);
    setActions(cycleQuery.data.draft.improvementActions);
    setDirty(false);
  }, [cycleQuery.data?.work.id, cycleQuery.data?.draft.revision]);

  const createCycleMutation = trpc.domain.selfEvaluation.createCycle.useMutation({
    onSuccess: async created => {
      await utils.domain.selfEvaluation.listCycles.invalidate();
      if (created?.work.id) {
        setSelectedCycleId(created.work.id);
      }
      setShowCreateForm(false);
    },
  });

  const saveCycleMutation = trpc.domain.selfEvaluation.saveCycle.useMutation({
    onSuccess: async result => {
      setRevision(result.draft.revision);
      setSchoolCategory(result.draft.schoolCategory);
      setAssessments(result.draft.assessments);
      setActions(result.draft.improvementActions);
      setDirty(false);
      setSaveNotice("تم حفظ تقييم المؤشرات وخطة التحسين بنجاح.");
      await Promise.all([
        utils.domain.selfEvaluation.listCycles.invalidate(),
        selectedCycleId
          ? utils.domain.selfEvaluation.getCycle.invalidate({ workItemId: selectedCycleId })
          : Promise.resolve(),
      ]);
    },
  });

  const createActionReportMutation = trpc.domain.selfEvaluation.createActionReport.useMutation({
    onSuccess: async result => {
      setRevision(result.draft.revision);
      setActions(result.draft.improvementActions);
      await Promise.all([
        utils.domain.selfEvaluation.listCycles.invalidate(),
        utils.domain.work.list.invalidate(),
        selectedCycleId
          ? utils.domain.selfEvaluation.getCycle.invalidate({ workItemId: selectedCycleId })
          : Promise.resolve(),
      ]);
      navigate(`/work/${result.reportWorkItemId}/report`);
    },
  });

  const scopeYears = useMemo(
    () =>
      (yearsQuery.data ?? []).filter(year =>
        newOwnerType === "personal"
          ? year.ownerUserId !== null
          : year.organizationId === newOrgId,
      ),
    [yearsQuery.data, newOwnerType, newOrgId],
  );
  const chosenYear = useMemo(
    () => scopeYears.find(year => year.id === newYearId),
    [scopeYears, newYearId],
  );

  const scopedAssets = useMemo(() => {
    const cycleWork = cycleQuery.data?.work;
    if (!cycleWork) return [];
    return (assetsQuery.data ?? []).filter(asset =>
      cycleWork.ownerType === "personal"
        ? asset.ownerType === "personal"
        : asset.ownerType === "organization" &&
          asset.ownerOrganizationId === cycleWork.ownerOrganizationId,
    );
  }, [assetsQuery.data, cycleQuery.data?.work]);

  const linkedWorkMap = useMemo(
    () => new Map((cycleQuery.data?.linkedWorks ?? []).map(item => [item.id, item])),
    [cycleQuery.data?.linkedWorks],
  );

  const applicableIndicators = useMemo(
    () => getApplicableIndicators(schoolCategory),
    [schoolCategory],
  );

  const liveSummary = useMemo(
    () =>
      computeSelfEvaluationSummary({
        schemaVersion: 2,
        frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
        schoolCategory,
        revision,
        executiveSummary,
        assessments,
        improvementActions: actions,
        updatedAt: "",
      }),
    [schoolCategory, revision, executiveSummary, assessments, actions],
  );

  const domainIndicators = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLowerCase();
    return applicableIndicators.filter(ind => {
      if (ind.domainKey !== activeDomain) return false;
      const level = assessments[ind.key]?.level ?? null;
      if (indicatorFilter === "unrated" && level !== null) return false;
      if (indicatorFilter === "gaps" && level !== 1 && level !== 2) return false;
      if (normalizedQuery) {
        const haystack =
          `${ind.code} ${ind.standardCode} ${ind.standardTitle} ${ind.title} ${ind.description}`.toLowerCase();
        if (!haystack.includes(normalizedQuery)) return false;
      }
      return true;
    });
  }, [applicableIndicators, activeDomain, assessments, indicatorFilter, searchQuery]);

  const domainStandards = useMemo(
    () => SELF_EVALUATION_STANDARDS.filter(std => std.domainKey === activeDomain),
    [activeDomain],
  );

  const selectCycleWithGuard = (nextId: number | undefined) => {
    if (nextId === selectedCycleId) return;
    if (
      dirty &&
      typeof window !== "undefined" &&
      !window.confirm(
        "لديك تعديلات غير محفوظة في هذه الدورة. هل تريد المتابعة وتجاهل التعديلات غير المحفوظة؟",
      )
    ) {
      return;
    }
    setSelectedCycleId(nextId);
  };

  const updateAssessment = (indicatorKey: string, patch: Partial<IndicatorAssessment>) => {
    setDirty(true);
    setSaveNotice("");
    setAssessments(prev => {
      const current = prev[indicatorKey] ?? {
        indicatorKey,
        level: null,
        rationale: "",
        evidenceAssetIds: [],
      };
      return {
        ...prev,
        [indicatorKey]: { ...current, ...patch },
      };
    });
  };

  const addImprovementAction = (indicatorKey: string) => {
    const indicator = SELF_EVALUATION_INDICATORS.find(item => item.key === indicatorKey);
    const id = `act-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    setDirty(true);
    setSaveNotice("");
    setActions(prev => [
      ...prev,
      {
        id,
        indicatorKey,
        goal: indicator ? `رفع مستوى تحقق مؤشر (${indicator.code}: ${indicator.title})` : "هدف تحسين",
        action: "",
        ownerName: "",
        dueDate: "",
        status: "planned",
        linkedWorkItemId: null,
      },
    ]);
  };

  const updateAction = (id: string, patch: Partial<ImprovementAction>) => {
    setDirty(true);
    setSaveNotice("");
    setActions(prev => prev.map(item => (item.id === id ? { ...item, ...patch } : item)));
  };

  const removeAction = (id: string) => {
    setDirty(true);
    setSaveNotice("");
    setActions(prev => prev.filter(item => item.id !== id));
  };

  const handleSave = () => {
    if (!selectedCycleId) return;
    setSaveNotice("");
    saveCycleMutation.mutate({
      workItemId: selectedCycleId,
      expectedRevision: revision,
      schoolCategory,
      executiveSummary,
      assessments,
      improvementActions: actions,
    });
  };

  const handleExportCycleJson = () => {
    if (!cycleQuery.data) return;
    const payload = {
      exportedAt: new Date().toISOString(),
      framework: SELF_EVALUATION_FRAMEWORK_META,
      work: cycleQuery.data.work,
      summary: liveSummary,
      draft: {
        schemaVersion: 2,
        frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
        schoolCategory,
        revision,
        executiveSummary,
        assessments,
        improvementActions: actions,
      },
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], {
      type: "application/json;charset=utf-8",
    });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `sers-etec-self-evaluation-${cycleQuery.data.work.id}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC] pb-24 lg:pb-10" dir="rtl">
      <AppSidebar currentPath={location} />
      <main className="lg:mr-72">
        <div className="mx-auto max-w-6xl space-y-6 px-4 py-8 sm:px-6">
          <header className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0 flex-1">
              <p className="text-xs font-bold text-teal-700">
                التقويم الذاتي والاعتماد المدرسي (وفق إطار هيئة تقويم التعليم والتدريب — تميز)
              </p>
              <h1
                className="mt-1 text-2xl font-black text-slate-950 sm:text-3xl"
                style={{ fontFamily: "'Tajawal', sans-serif" }}
              >
                التقويم الذاتي وخطة التحسين المدرسي
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-600">
                قيّم ممارسات مدرستك وفق المجالات الأربعة الرسمية وأوزانها النسبية المعتمدة والمعايير العشرة والمؤشرات الإجرائية، واربط التقديرات بشواهد فعلية وخطة تحسين وتقارير تنفيذ مترابطة.
              </p>
            </div>
            <button
              type="button"
              onClick={() => setShowCreateForm(value => !value)}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 print:hidden"
            >
              <Plus className="h-4 w-4" />
              دورة تقويم جديدة
            </button>
          </header>

          <div
            role="note"
            className="flex items-start gap-3 rounded-xl border border-teal-200 bg-teal-50/70 px-4 py-3 text-xs leading-6 text-teal-950"
          >
            <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-700" />
            <p className="min-w-0 [overflow-wrap:anywhere]">
              <strong>
                {SELF_EVALUATION_FRAMEWORK_META.titleAr} (الإصدار {SELF_EVALUATION_FRAMEWORK_META.version}):
              </strong>{" "}
              {SELF_EVALUATION_FRAMEWORK_META.sourceNoteAr}
            </p>
          </div>

          {cycleQuery.data && !canEdit && (
            <p
              role="status"
              className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-xs leading-6 text-slate-700"
            >
              عرض فقط: تعديل دورة التقويم الذاتي للمدرسة متاح لمالك المدرسة أو مديرها. يمكنك الاطلاع على المؤشرات والتقديرات وخطة التحسين.
            </p>
          )}

          {(showCreateForm || (cyclesQuery.data && cyclesQuery.data.length === 0)) && (
            <section className="rounded-2xl border border-teal-200 bg-white p-5 shadow-sm sm:p-6 print:hidden">
              <h2 className="text-base font-bold text-slate-950">بدء دورة تقويم ذاتي وخطة تحسين</h2>
              <p className="mt-1 text-xs leading-6 text-slate-600">
                اختر نطاق الدورة وتصنيف المدرسة لتفعيل المؤشرات الرسمية المنطبقة (48 مؤشرًا للمدارس الحكومية أو 51 مؤشرًا للمدارس الأهلية والعالمية).
              </p>
              <form
                className="mt-4 grid gap-4 sm:grid-cols-2"
                onSubmit={event => {
                  event.preventDefault();
                  createCycleMutation.mutate({
                    title: newTitle,
                    ownerType: newOwnerType,
                    schoolCategory: newSchoolCategory,
                    organizationId: newOwnerType === "organization" ? newOrgId : undefined,
                    academicYearId: newYearId,
                    academicTermId: newYearId ? newTermId : undefined,
                  });
                }}
              >
                <label className="min-w-0 text-xs font-bold text-slate-700 sm:col-span-2">
                  عنوان دورة التقويم الذاتي
                  <input
                    required
                    minLength={3}
                    maxLength={255}
                    value={newTitle}
                    onChange={e => setNewTitle(e.target.value)}
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                  />
                </label>

                <label className="min-w-0 text-xs font-bold text-slate-700">
                  تصنيف المدرسة والمؤشرات المعتمدة
                  <select
                    aria-label="تصنيف المدرسة"
                    value={newSchoolCategory}
                    onChange={e =>
                      setNewSchoolCategory(e.target.value as SelfEvaluationSchoolCategory)
                    }
                    className="mt-1.5 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                  >
                    <option value="government">{schoolCategoryLabels.government}</option>
                    <option value="private_international">
                      {schoolCategoryLabels.private_international}
                    </option>
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold text-slate-700">
                  نطاق الملكية
                  <select
                    value={newOwnerType}
                    onChange={e => {
                      const next = e.target.value as "organization" | "personal";
                      setNewOwnerType(next);
                      setNewYearId(undefined);
                      setNewTermId(undefined);
                    }}
                    className="mt-1.5 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                  >
                    {creatableOrgs.length > 0 && (
                      <option value="organization">مساحة المدرسة (مؤسسي)</option>
                    )}
                    <option value="personal">مساحتي الشخصية (إعداد فردي)</option>
                  </select>
                </label>

                {newOwnerType === "organization" && (
                  <label className="min-w-0 text-xs font-bold text-slate-700">
                    المدرسة
                    <select
                      required
                      value={newOrgId ?? ""}
                      onChange={e => {
                        setNewOrgId(Number(e.target.value) || undefined);
                        setNewYearId(undefined);
                        setNewTermId(undefined);
                      }}
                      className="mt-1.5 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                    >
                      <option value="">اختر المدرسة</option>
                      {creatableOrgs.map(org => (
                        <option key={org.id} value={org.id}>
                          {org.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                <label className="min-w-0 text-xs font-bold text-slate-700">
                  العام الدراسي (اختياري)
                  <select
                    value={newYearId ?? ""}
                    onChange={e => {
                      setNewYearId(Number(e.target.value) || undefined);
                      setNewTermId(undefined);
                    }}
                    className="mt-1.5 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal"
                  >
                    <option value="">دون عام محدد</option>
                    {scopeYears.map(year => (
                      <option key={year.id} value={year.id}>
                        {year.label}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="min-w-0 text-xs font-bold text-slate-700">
                  الفصل الدراسي (اختياري)
                  <select
                    disabled={!chosenYear}
                    value={newTermId ?? ""}
                    onChange={e => setNewTermId(Number(e.target.value) || undefined)}
                    className="mt-1.5 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-normal disabled:opacity-50"
                  >
                    <option value="">دون فصل محدد</option>
                    {chosenYear?.terms.map(term => (
                      <option key={term.id} value={term.id}>
                        {term.label}
                      </option>
                    ))}
                  </select>
                </label>

                <div className="flex flex-wrap items-center justify-end gap-3 sm:col-span-2">
                  {showCreateForm && (cyclesQuery.data?.length ?? 0) > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="min-h-11 rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700"
                    >
                      إلغاء
                    </button>
                  )}
                  <button
                    type="submit"
                    disabled={
                      createCycleMutation.isPending ||
                      (newOwnerType === "organization" && !newOrgId)
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white disabled:opacity-50"
                  >
                    {createCycleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ClipboardCheck className="h-4 w-4" />
                    )}
                    إنشاء الدورة والبدء بالتقييم
                  </button>
                </div>
                {createCycleMutation.error && (
                  <p role="alert" className="text-xs text-red-700 sm:col-span-2">
                    {createCycleMutation.error.message}
                  </p>
                )}
              </form>
            </section>
          )}

          {cyclesQuery.isLoading && (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-14 text-sm text-slate-600">
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري تحميل دورات التقويم الذاتي...
            </div>
          )}

          {cyclesQuery.error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            >
              <p>{cyclesQuery.error.message}</p>
              <button
                type="button"
                disabled={cyclesQuery.isFetching}
                onClick={() => void cyclesQuery.refetch()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </button>
            </div>
          )}

          {cyclesQuery.data && cyclesQuery.data.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5 print:hidden">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div className="grid min-w-0 flex-1 gap-3 sm:grid-cols-2">
                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-slate-700">
                    <span>الدورة النشطة</span>
                    <select
                      aria-label="اختيار دورة التقويم الذاتي"
                      value={selectedCycleId ?? ""}
                      onChange={e => selectCycleWithGuard(Number(e.target.value) || undefined)}
                      className="w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-bold text-slate-900"
                    >
                      {cyclesQuery.data.map(item => (
                        <option key={item.id} value={item.id}>
                          {item.title} —{" "}
                          {item.ownerType === "organization"
                            ? item.organizationName || "مدرسة"
                            : "شخصي"}{" "}
                          ({item.summary.ratedIndicators}/{item.summary.totalIndicators} مؤشر)
                        </option>
                      ))}
                    </select>
                  </label>

                  <label className="flex min-w-0 flex-col gap-1.5 text-xs font-bold text-slate-700">
                    <span>فئة المؤشرات المطبقة</span>
                    <select
                      aria-label="فئة المؤشرات المطبقة"
                      disabled={!canEdit}
                      value={schoolCategory}
                      onChange={e => {
                        setDirty(true);
                        setSaveNotice("");
                        setSchoolCategory(e.target.value as SelfEvaluationSchoolCategory);
                      }}
                      className="w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-bold text-slate-900 disabled:opacity-60"
                    >
                      <option value="government">{schoolCategoryLabels.government}</option>
                      <option value="private_international">
                        {schoolCategoryLabels.private_international}
                      </option>
                    </select>
                  </label>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  {cycleQuery.data && (
                    <>
                      <button
                        type="button"
                        onClick={handleExportCycleJson}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Download className="h-4 w-4 text-teal-700" />
                        تصدير JSON
                      </button>
                      <button
                        type="button"
                        onClick={() => window.print()}
                        className="inline-flex min-h-11 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50"
                      >
                        <Printer className="h-4 w-4 text-teal-700" />
                        طباعة
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canEdit || !dirty || saveCycleMutation.isPending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-5 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
                  >
                    {saveCycleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ التقييم وخطة التحسين
                  </button>
                </div>
              </div>
              {dirty && (
                <p className="mt-2 text-[11px] font-semibold text-amber-800">
                  توجد تعديلات محلية غير محفوظة بعد — اضغط «حفظ التقييم وخطة التحسين» لتثبيتها.
                </p>
              )}
              {saveNotice && (
                <p
                  role="status"
                  className="mt-3 rounded-xl bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-900"
                >
                  {saveNotice}
                </p>
              )}
              {saveCycleMutation.error && (
                <p
                  role="alert"
                  className="mt-3 rounded-xl bg-red-50 px-3 py-2 text-xs font-bold text-red-800"
                >
                  {saveCycleMutation.error.message}
                </p>
              )}
            </section>
          )}

          {selectedCycleId && cycleQuery.isLoading && (
            <div className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white py-14 text-sm text-slate-600">
              <Loader2 className="ml-2 h-4 w-4 animate-spin" />
              جاري تحميل مؤشرات الدورة...
            </div>
          )}

          {selectedCycleId && cycleQuery.error && (
            <div
              role="alert"
              className="rounded-2xl border border-red-200 bg-red-50 p-5 text-sm text-red-800"
            >
              <p>{cycleQuery.error.message}</p>
              <button
                type="button"
                disabled={cycleQuery.isFetching}
                onClick={() => void cycleQuery.refetch()}
                className="mt-3 inline-flex min-h-11 items-center gap-2 rounded-xl border border-red-300 bg-white px-4 py-2 text-xs font-bold text-red-800 hover:bg-red-50 disabled:opacity-50"
              >
                <RefreshCw className="h-4 w-4" /> إعادة المحاولة
              </button>
            </div>
          )}

          {cycleQuery.data && (
            <>
              {/* Live Weighted Summary Metrics */}
              <section
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
                aria-label="ملخص التقويم الذاتي"
              >
                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-600">متوسط الجاهزية الموزون (ETEC)</p>
                  <div className="mt-2 flex flex-wrap items-baseline justify-between gap-2">
                    <p className="text-2xl font-black text-teal-800">
                      {liveSummary.overallReadinessPercent}%
                    </p>
                    {liveSummary.accreditationBandLabel && (
                      <span className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-0.5 text-[11px] font-bold text-teal-900">
                        نطاق {liveSummary.accreditationBandLabel}
                      </span>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-600">
                    المتوسط العام:{" "}
                    {liveSummary.overallAverageLevel !== null
                      ? `${liveSummary.overallAverageLevel} من 4`
                      : "لم يبدأ التقييم"}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-600">اكتمال المؤشرات المعتمدة</p>
                  <p className="mt-2 text-2xl font-black text-slate-900">
                    {liveSummary.ratedIndicators} / {liveSummary.totalIndicators}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    نسبة الإنجاز {liveSummary.completionPercent}%
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-600">فجوات الأولوية (التهيئة/الانطلاق)</p>
                  <p className="mt-2 text-2xl font-black text-amber-800">
                    {liveSummary.gapIndicatorKeys.length}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    غير مغطاة بإجراء تحسين: {liveSummary.uncoveredGapIndicatorKeys.length}
                  </p>
                </div>

                <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                  <p className="text-xs font-bold text-slate-600">إجراءات خطة التحسين</p>
                  <p className="mt-2 text-2xl font-black text-emerald-800">
                    {liveSummary.actionCounts.completed} / {liveSummary.actionCounts.total}
                  </p>
                  <p className="mt-1 text-xs text-slate-600">
                    تقارير تنفيذ مرتبطة: {liveSummary.actionCounts.linkedWorks}
                  </p>
                </div>
              </section>

              {/* Uncovered Gap Alert */}
              {liveSummary.uncoveredGapIndicatorKeys.length > 0 && (
                <section className="flex items-start gap-3 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs leading-6 text-amber-950">
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-700" />
                  <div className="min-w-0">
                    <p className="font-bold">
                      تنبيه خطة التحسين: يوجد ({liveSummary.uncoveredGapIndicatorKeys.length}) مؤشر في مستوى «التهيئة» أو «الانطلاق» بلا إجراء تحسين مرتبط
                    </p>
                    <p className="mt-1">
                      أضف إجراءً في خطة التحسين لكل مؤشر منخفض التقدير لضمان اتساق دورة التقويم الذاتي مع الخطة التشغيلية للمدرسة.
                    </p>
                  </div>
                </section>
              )}

              {/* Domain Tabs & Standards / Indicators */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-teal-700">
                      4 مجالات رسمية (وزن 100%) · 10 معايير · {liveSummary.totalIndicators} مؤشرًا معتمدًا
                    </p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      تقييم المؤشرات الرسمية وربط الشواهد
                    </h2>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-600">
                    {cycleQuery.data.work.ownerType === "organization" ? (
                      <Building2 className="h-4 w-4 text-teal-700" />
                    ) : (
                      <UserRound className="h-4 w-4 text-teal-700" />
                    )}
                    <span>
                      الشواهد المتاحة في هذه المساحة: <strong>{scopedAssets.length}</strong>
                    </span>
                  </div>
                </div>

                <div
                  className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4"
                  role="tablist"
                  aria-label="مجالات التقويم الذاتي"
                >
                  {SELF_EVALUATION_DOMAINS.map(domain => {
                    const domainStat = liveSummary.domains.find(d => d.domainKey === domain.key);
                    const isActive = activeDomain === domain.key;
                    return (
                      <button
                        key={domain.key}
                        role="tab"
                        aria-selected={isActive}
                        type="button"
                        onClick={() => setActiveDomain(domain.key)}
                        className={`rounded-xl border p-3.5 text-right transition ${
                          isActive
                            ? "border-teal-600 bg-teal-50/80 text-teal-950 shadow-sm"
                            : "border-slate-200 bg-slate-50/60 text-slate-700 hover:bg-slate-100/70"
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <span className="text-sm font-bold">{domain.title}</span>
                          <span className="rounded-full border border-teal-200 bg-white px-2 py-0.5 text-[11px] font-bold text-teal-800">
                            الوزن {domain.weightPercent}%
                          </span>
                        </div>
                        <p className="mt-2 text-xs text-slate-600">
                          مقيّم: {domainStat?.ratedCount ?? 0}/{domainStat?.totalCount ?? 0} · الجاهزية{" "}
                          {domainStat?.readinessPercent ?? 0}%
                        </p>
                      </button>
                    );
                  })}
                </div>

                {/* Filter & Search Bar */}
                <div className="mt-4 flex flex-col gap-3 rounded-xl border border-slate-200/80 bg-slate-50/70 p-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
                  <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="تصفية المؤشرات">
                    <Filter className="ml-1 h-3.5 w-3.5 text-slate-500" />
                    {(
                      [
                        { id: "all", label: "الكل" },
                        { id: "unrated", label: "غير مقيّم" },
                        { id: "gaps", label: "فجوات التحسين" },
                      ] as const
                    ).map(tab => (
                      <button
                        key={tab.id}
                        type="button"
                        aria-pressed={indicatorFilter === tab.id}
                        onClick={() => setIndicatorFilter(tab.id)}
                        className={`min-h-9 rounded-lg px-2.5 py-1 text-xs font-bold transition ${
                          indicatorFilter === tab.id
                            ? "bg-teal-700 text-white shadow-sm"
                            : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-100"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <label className="relative flex min-w-0 flex-1 items-center sm:max-w-xs">
                    <Search className="pointer-events-none absolute right-3 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="search"
                      aria-label="بحث في المؤشرات بالرمز أو النص"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="بحث برمز المؤشر (1-1-1-1) أو نصه..."
                      className="min-h-10 w-full min-w-0 rounded-xl border border-slate-200 bg-white py-1.5 pr-8 pl-3 text-xs text-slate-800 outline-none focus:border-teal-500"
                    />
                  </label>
                </div>

                {domainIndicators.length === 0 ? (
                  <div className="mt-6 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-600">
                    لا توجد مؤشرات مطابقة لفلتر التصفية أو البحث الحالي في هذا المجال.
                  </div>
                ) : (
                  <div className="mt-6 space-y-6">
                    {domainStandards.map(standard => {
                      const stdIndicators = domainIndicators.filter(
                        ind => ind.standardCode === standard.code,
                      );
                      if (stdIndicators.length === 0) return null;

                      return (
                        <div key={standard.code} className="space-y-4">
                          <div className="rounded-xl border border-teal-100 bg-teal-50/50 px-4 py-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <h3 className="text-sm font-black text-teal-950">
                                المعيار {standard.code}: {standard.title}
                              </h3>
                              <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-teal-800">
                                {stdIndicators.length} مؤشر
                              </span>
                            </div>
                            <p className="mt-1 text-xs leading-6 text-slate-600">
                              {standard.description}
                            </p>
                          </div>

                          {stdIndicators.map(indicator => {
                            const current = assessments[indicator.key] ?? {
                              indicatorKey: indicator.key,
                              level: null,
                              rationale: "",
                              evidenceAssetIds: [],
                            };
                            const needsRationale =
                              current.level !== null && current.rationale.trim().length < 5;
                            const isGap = current.level === 1 || current.level === 2;

                            return (
                              <article
                                key={indicator.key}
                                className="rounded-2xl border border-slate-200 bg-slate-50/40 p-4 sm:p-5"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="min-w-0 max-w-3xl flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                      <span className="rounded-lg bg-teal-700 px-2.5 py-0.5 text-xs font-bold text-white">
                                        مؤشر {indicator.code}
                                      </span>
                                      {indicator.applicableTo === "private_only" && (
                                        <span className="rounded-full border border-violet-200 bg-violet-50 px-2 py-0.5 text-[10px] font-bold text-violet-900">
                                          خاص بالأهلية والعالمية
                                        </span>
                                      )}
                                      <h4 className="text-sm font-bold leading-6 text-slate-950 sm:text-base [overflow-wrap:anywhere]">
                                        {indicator.title}
                                      </h4>
                                    </div>
                                    <p className="mt-1.5 text-xs leading-6 text-slate-600">
                                      {indicator.description}
                                    </p>
                                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                                      <span className="text-[11px] font-bold text-slate-600">
                                        أدوات القياس المعتمدة:
                                      </span>
                                      {indicator.measurementTools.map(tool => (
                                        <span
                                          key={tool}
                                          className="rounded-md border border-slate-200 bg-white px-2 py-0.5 text-[10px] font-semibold text-slate-700"
                                        >
                                          {tool}
                                        </span>
                                      ))}
                                    </div>
                                    <p className="mt-1.5 text-[11px] leading-5 text-teal-800">
                                      <strong>أمثلة الشواهد الداعمة:</strong>{" "}
                                      {indicator.suggestedEvidenceHint}
                                    </p>
                                  </div>
                                  {current.level && (
                                    <span
                                      className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${levelBadgeClasses[current.level]}`}
                                    >
                                      {
                                        SELF_EVALUATION_LEVELS.find(l => l.level === current.level)
                                          ?.label
                                      }{" "}
                                      ({current.level}/4)
                                    </span>
                                  )}
                                </div>

                                {/* Maturity Level Buttons */}
                                <div className="mt-4">
                                  <p className="text-xs font-bold text-slate-700">
                                    مستوى التحقق الفعلي:
                                  </p>
                                  <div className="mt-2 grid gap-2 sm:grid-cols-4">
                                    {SELF_EVALUATION_LEVELS.map(lvl => {
                                      const selected = current.level === lvl.level;
                                      return (
                                        <button
                                          key={lvl.level}
                                          type="button"
                                          disabled={!canEdit}
                                          onClick={() =>
                                            updateAssessment(indicator.key, {
                                              level: selected ? null : lvl.level,
                                            })
                                          }
                                          className={`min-h-11 rounded-xl border p-2.5 text-right text-xs transition disabled:cursor-not-allowed disabled:opacity-60 ${
                                            selected
                                              ? `${levelBadgeClasses[lvl.level]} font-bold shadow-sm`
                                              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                                          }`}
                                        >
                                          <div className="flex items-center justify-between">
                                            <span className="font-bold">{lvl.label}</span>
                                            <span>{lvl.level}/4</span>
                                          </div>
                                          <p className="mt-1 line-clamp-2 text-[11px] opacity-85">
                                            {lvl.description}
                                          </p>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>

                                {/* Mandatory Rationale */}
                                <div className="mt-4">
                                  <label className="block text-xs font-bold text-slate-700">
                                    مبررات التقدير الواقعية (إلزامي عند اختيار مستوى تحقيق — لا يُقبل التقييم بلا تعليل)
                                    <textarea
                                      rows={2}
                                      disabled={!canEdit}
                                      value={current.rationale}
                                      onChange={e =>
                                        updateAssessment(indicator.key, {
                                          rationale: e.target.value,
                                        })
                                      }
                                      placeholder="اشرح الوقائع الفعلية ومؤشرات القياس التي استند إليها هذا التقدير..."
                                      className={`mt-1.5 w-full rounded-xl border bg-white px-3 py-2 text-sm font-normal disabled:bg-slate-50 disabled:text-slate-600 ${
                                        needsRationale ? "border-red-400" : "border-slate-200"
                                      }`}
                                    />
                                  </label>
                                  {needsRationale && (
                                    <p className="mt-1 text-xs font-semibold text-red-700">
                                      أدخل مبررًا واضحًا (5 أحرف على الأقل) لحفظ تقييم هذا المؤشر.
                                    </p>
                                  )}
                                </div>

                                {/* Evidence Linking & Quick Improvement Action */}
                                <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-200/80 pt-3">
                                  <div className="flex min-w-0 max-w-full flex-wrap items-center gap-2">
                                    <select
                                      aria-label={`ربط شاهد بالمؤشر ${indicator.code}`}
                                      disabled={!canEdit}
                                      value=""
                                      onChange={e => {
                                        const assetId = Number(e.target.value);
                                        if (!assetId || current.evidenceAssetIds.includes(assetId))
                                          return;
                                        updateAssessment(indicator.key, {
                                          evidenceAssetIds: [
                                            ...current.evidenceAssetIds,
                                            assetId,
                                          ],
                                        });
                                      }}
                                      className="min-h-10 w-full max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 disabled:opacity-50 sm:w-auto"
                                    >
                                      <option value="">
                                        + إرفاق شاهد من المكتبة ({scopedAssets.length})
                                      </option>
                                      {scopedAssets
                                        .filter(
                                          asset => !current.evidenceAssetIds.includes(asset.id),
                                        )
                                        .map(asset => (
                                          <option key={asset.id} value={asset.id}>
                                            {asset.title} ({asset.kind})
                                          </option>
                                        ))}
                                    </select>
                                    {current.evidenceAssetIds.map(assetId => {
                                      const asset = scopedAssets.find(a => a.id === assetId);
                                      return (
                                        <span
                                          key={assetId}
                                          className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] font-bold text-teal-900"
                                        >
                                          <CheckCircle2 className="h-3 w-3 shrink-0 text-teal-700" />
                                          <span className="truncate">
                                            {asset?.title ?? `شاهد #${assetId}`}
                                          </span>
                                          {canEdit && (
                                            <button
                                              type="button"
                                              aria-label={`إزالة الشاهد ${asset?.title ?? assetId}`}
                                              onClick={() =>
                                                updateAssessment(indicator.key, {
                                                  evidenceAssetIds:
                                                    current.evidenceAssetIds.filter(
                                                      id => id !== assetId,
                                                    ),
                                                })
                                              }
                                              className="mr-1 shrink-0 text-teal-700 hover:text-red-700"
                                            >
                                              ×
                                            </button>
                                          )}
                                        </span>
                                      );
                                    })}
                                  </div>

                                  <button
                                    type="button"
                                    disabled={!canEdit}
                                    onClick={() => addImprovementAction(indicator.key)}
                                    className={`inline-flex min-h-10 items-center gap-1.5 rounded-xl border px-3 py-1.5 text-xs font-bold disabled:opacity-50 ${
                                      isGap
                                        ? "border-amber-300 bg-amber-50 text-amber-950 hover:bg-amber-100"
                                        : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                                    }`}
                                  >
                                    <Sparkles className="h-3.5 w-3.5" />
                                    + إضافة إجراء لخطة التحسين
                                  </button>
                                </div>
                              </article>
                            );
                          })}
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>

              {/* Executive Summary & Improvement Plan */}
              <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-teal-700">من التشخيص إلى التنفيذ</p>
                    <h2 className="mt-1 text-lg font-bold text-slate-950">
                      خطة التحسين والخطة التشغيلية المرتبطة
                    </h2>
                    <p className="mt-1 text-xs text-slate-600">
                      كل إجراء تحسين يرتبط بمؤشر رسمي محدد ويمكن تحويله بضغطة واحدة إلى تقرير تنفيذ داخل «أعمالي».
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={!canEdit}
                    onClick={() =>
                      addImprovementAction(
                        domainIndicators[0]?.key ?? applicableIndicators[0]?.key ?? "1-1-1-1",
                      )
                    }
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-teal-200 bg-teal-50 px-4 py-2 text-xs font-bold text-teal-900 hover:bg-teal-100 disabled:opacity-50 print:hidden"
                  >
                    <Plus className="h-4 w-4" />
                    إضافة مبادرة أو إجراء تحسين
                  </button>
                </div>

                <label className="mt-4 block text-xs font-bold text-slate-700">
                  الملخص التنفيذي وأولويات التحسين للعام
                  <textarea
                    rows={3}
                    disabled={!canEdit}
                    value={executiveSummary}
                    onChange={e => {
                      setDirty(true);
                      setSaveNotice("");
                      setExecutiveSummary(e.target.value);
                    }}
                    placeholder="لخّص أبرز نقاط القوة وأولويات التحسين المستخلصة من التقييم الذاتي..."
                    className="mt-1.5 w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm font-normal disabled:opacity-60"
                  />
                </label>

                {actions.length === 0 ? (
                  <div className="mt-5 rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-600">
                    لا توجد إجراءات تحسين مسجلة بعد. اضغط «+ إضافة إجراء لخطة التحسين» تحت أي مؤشر لإضافته.
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    {actions.map(item => {
                      const linkedWork = item.linkedWorkItemId
                        ? linkedWorkMap.get(item.linkedWorkItemId)
                        : undefined;
                      const indicatorChoices = applicableIndicators.some(
                        ind => ind.key === item.indicatorKey,
                      )
                        ? applicableIndicators
                        : SELF_EVALUATION_INDICATORS;

                      return (
                        <div
                          key={item.id}
                          className="rounded-2xl border border-slate-200 bg-slate-50/50 p-4"
                        >
                          <div className="grid gap-3 sm:grid-cols-3">
                            <label className="min-w-0 text-xs font-bold text-slate-700">
                              المؤشر المرتبط
                              <select
                                disabled={!canEdit}
                                value={item.indicatorKey}
                                onChange={e => updateAction(item.id, { indicatorKey: e.target.value })}
                                className="mt-1 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal disabled:opacity-60"
                              >
                                {indicatorChoices.map(ind => (
                                  <option key={ind.key} value={ind.key}>
                                    {ind.code} — {ind.title}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label className="min-w-0 text-xs font-bold text-slate-700">
                              المسؤول عن التنفيذ
                              <input
                                disabled={!canEdit}
                                value={item.ownerName}
                                onChange={e => updateAction(item.id, { ownerName: e.target.value })}
                                placeholder="مثال: وكيل الشؤون التعليمية / لجنة التميز"
                                className="mt-1 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal disabled:opacity-60"
                              />
                            </label>
                            <div className="grid min-w-0 grid-cols-2 gap-2">
                              <label className="min-w-0 text-xs font-bold text-slate-700">
                                تاريخ الاستحقاق
                                <input
                                  type="date"
                                  disabled={!canEdit}
                                  value={item.dueDate}
                                  onChange={e => updateAction(item.id, { dueDate: e.target.value })}
                                  className="mt-1 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal disabled:opacity-60"
                                />
                              </label>
                              <label className="min-w-0 text-xs font-bold text-slate-700">
                                الحالة
                                <select
                                  disabled={!canEdit}
                                  value={item.status}
                                  onChange={e =>
                                    updateAction(item.id, {
                                      status: e.target.value as ImprovementActionStatus,
                                    })
                                  }
                                  className="mt-1 w-full min-w-0 max-w-full truncate rounded-xl border border-slate-200 bg-white px-2 py-2 text-xs font-normal disabled:opacity-60"
                                >
                                  {(Object.keys(actionStatusLabels) as ImprovementActionStatus[]).map(
                                    st => (
                                      <option key={st} value={st}>
                                        {actionStatusLabels[st]}
                                      </option>
                                    ),
                                  )}
                                </select>
                              </label>
                            </div>
                          </div>

                          <div className="mt-3 grid gap-3 sm:grid-cols-2">
                            <label className="min-w-0 text-xs font-bold text-slate-700">
                              هدف التحسين (مطلوب)
                              <input
                                required
                                disabled={!canEdit}
                                value={item.goal}
                                onChange={e => updateAction(item.id, { goal: e.target.value })}
                                placeholder="الهدف القابل للقياس..."
                                className="mt-1 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal disabled:opacity-60"
                              />
                            </label>
                            <label className="min-w-0 text-xs font-bold text-slate-700">
                              الخطوات الإجرائية ومؤشر الإنجاز (مطلوب)
                              <input
                                required
                                disabled={!canEdit}
                                value={item.action}
                                onChange={e => updateAction(item.id, { action: e.target.value })}
                                placeholder="البرنامج أو المبادرة أو الإجراء التطبيقي..."
                                className="mt-1 w-full min-w-0 max-w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal disabled:opacity-60"
                              />
                            </label>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-slate-200/70 pt-3 print:hidden">
                            {item.linkedWorkItemId ? (
                              <button
                                type="button"
                                onClick={() => navigate(`/work/${item.linkedWorkItemId}/report`)}
                                className="inline-flex min-h-10 max-w-full items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-bold text-emerald-900 hover:bg-emerald-100"
                              >
                                <ExternalLink className="h-3.5 w-3.5 shrink-0" />
                                <span className="truncate">
                                  فتح تقرير التنفيذ المرتبط:{" "}
                                  {linkedWork?.title ?? `#${item.linkedWorkItemId}`}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={
                                  !canEdit ||
                                  dirty ||
                                  createActionReportMutation.isPending ||
                                  !selectedCycleId
                                }
                                onClick={() =>
                                  selectedCycleId &&
                                  createActionReportMutation.mutate({
                                    workItemId: selectedCycleId,
                                    expectedRevision: revision,
                                    actionId: item.id,
                                  })
                                }
                                title={
                                  dirty
                                    ? "احفظ التقييم وخطة التحسين أولًا قبل إنشاء تقرير التنفيذ"
                                    : undefined
                                }
                                className="inline-flex min-h-10 items-center gap-1.5 rounded-xl border border-teal-200 bg-white px-3 py-1.5 text-xs font-bold text-teal-800 hover:bg-teal-50 disabled:opacity-50"
                              >
                                <FilePlus2 className="h-3.5 w-3.5 shrink-0" />
                                {dirty
                                  ? "احفظ الخطة أولًا لإنشاء تقرير تنفيذ"
                                  : "إنشاء تقرير تنفيذ مرتبط في أعمالي"}
                              </button>
                            )}

                            {canEdit && (
                              <button
                                type="button"
                                onClick={() => removeAction(item.id)}
                                className="inline-flex min-h-10 items-center gap-1 rounded-xl px-3 py-1.5 text-xs font-bold text-red-700 hover:bg-red-50"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                                حذف الإجراء
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {createActionReportMutation.error && (
                  <p role="alert" className="mt-3 text-xs font-bold text-red-700">
                    {createActionReportMutation.error.message}
                  </p>
                )}

                <div className="mt-5 flex justify-end border-t border-slate-100 pt-4 print:hidden">
                  <button
                    type="button"
                    onClick={handleSave}
                    disabled={!canEdit || !dirty || saveCycleMutation.isPending}
                    className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-6 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-teal-800 disabled:opacity-50"
                  >
                    {saveCycleMutation.isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Save className="h-4 w-4" />
                    )}
                    حفظ التغييرات
                  </button>
                </div>
              </section>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
