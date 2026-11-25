/**
 * IMPORTANT (O009 is still OPEN): this is a SERS *guided* self-review model.
 * It borrows only the four publicly described domain names of the Saudi ETEC
 * school evaluation framework. It is NOT the official ETEC instrument: the
 * official framework (≈10 standards and ≈47–50 indicators, with its own
 * weights and rubric) has not been imported or verified from the primary
 * source. The scores below are internal planning aids, never an official rating.
 */
export const SELF_EVALUATION_FRAMEWORK_ID = "sers-guided-self-review-v1" as const;

export const SELF_EVALUATION_FRAMEWORK_META = {
  id: SELF_EVALUATION_FRAMEWORK_ID,
  version: "1.0.0",
  status: "guided_unofficial" as const,
  titleAr: "نموذج سيرس الاسترشادي للتقويم الذاتي",
  sourceNoteAr:
    "يستند إلى أسماء المجالات الأربعة المعلنة لإطار هيئة تقويم التعليم والتدريب فقط، ومؤشراته وأوزانه ومستوياته صياغة استرشادية داخلية. ليس الأداة الرسمية ولا يمثل تقديرًا رسميًا للمدرسة.",
  pendingDecision: "O009",
} as const;

export type SelfEvaluationDomainKey =
  | "administration"
  | "teaching_learning"
  | "learning_outcomes"
  | "school_environment";

export type SelfEvaluationLevel = 1 | 2 | 3 | 4;

export type ImprovementActionStatus = "planned" | "in_progress" | "completed";

export type SelfEvaluationLevelInfo = {
  level: SelfEvaluationLevel;
  label: string;
  description: string;
};

export type SelfEvaluationIndicatorDef = {
  key: string;
  code: string;
  domainKey: SelfEvaluationDomainKey;
  title: string;
  description: string;
  suggestedEvidenceHint: string;
};

export type SelfEvaluationDomainDef = {
  key: SelfEvaluationDomainKey;
  title: string;
  description: string;
};

export const SELF_EVALUATION_LEVELS: readonly SelfEvaluationLevelInfo[] = [
  {
    level: 1,
    label: "التهيئة",
    description: "ممارسات أولية غير منتظمة تحتاج بناءً وتأسيسًا وخطة تحسين عاجلة.",
  },
  {
    level: 2,
    label: "الانطلاق",
    description: "ممارسات مطبقة جزئيًا لكنها تحتاج انتظامًا وتوسيعًا في الأثر والشواهد.",
  },
  {
    level: 3,
    label: "التقدم",
    description: "ممارسات فاعلة ومنتظمة مدعومة بشواهد تنفيذ حقيقية وأثر واضح.",
  },
  {
    level: 4,
    label: "التميز",
    description: "ممارسات مؤسسية مبتكرة ومستدامة تحقق أثرًا استثنائيًا قابلًا للقياس.",
  },
] as const;

export const SELF_EVALUATION_DOMAINS: readonly SelfEvaluationDomainDef[] = [
  {
    key: "administration",
    title: "الإدارة المدرسية",
    description: "التخطيط التشغيلي، قيادة العملية التعليمية، التطوير المهني، والشراكة الأسرية والمجتمعية.",
  },
  {
    key: "teaching_learning",
    title: "التعليم والتعلم",
    description: "بناء خبرات التعلم، التنويع التدريسي، التقويم من أجل التعلم، ودعم المتعثرين والموهوبين.",
  },
  {
    key: "learning_outcomes",
    title: "نواتج التعلم",
    description: "التحصيل الدراسي والاختبارات الوطنية، التطور الشخصي والصحي، وتمثّل القيم والهوية الوطنية.",
  },
  {
    key: "school_environment",
    title: "البيئة المدرسية",
    description: "جاهزية المبنى والمرافق، الأمن والسلامة المدرسية، والمناخ المدرسي الداعم والجاذب.",
  },
] as const;

export const SELF_EVALUATION_INDICATORS: readonly SelfEvaluationIndicatorDef[] = [
  {
    key: "admin.planning",
    code: "1-1",
    domainKey: "administration",
    title: "التخطيط المدرسي والتشغيلي المبني على البيانات",
    description: "تضع المدرسة خطة تشغيلية واضحة مرتبطة بأولويات التحسين ومؤشرات الأداء وتتابع تنفيذها دوريًا.",
    suggestedEvidenceHint: "وثيقة الخطة التشغيلية، محاضر لجنة التميز والجودة، تقارير متابعة مؤشرات الإنجاز.",
  },
  {
    key: "admin.leadership",
    code: "1-2",
    domainKey: "administration",
    title: "قيادة العملية التعليمية والتطوير المهني",
    description: "تدعم القيادة المدرسية مجتمعات التعلم المهنية وتتابع الممارسات التدريسية وتقدم تغذية راجعة تطويرية.",
    suggestedEvidenceHint: "سجل الزيارات الصفية التطويرية، تقارير ورش التطوير المهني وتبادل الخبرات.",
  },
  {
    key: "admin.community",
    code: "1-3",
    domainKey: "administration",
    title: "الانضباط المدرسي والشراكة مع الأسرة والمجتمع",
    description: "تعزز المدرسة الانضباط والحضور المنتظم وتفعل شراكات نوعية مع أولياء الأمور والمجتمع المحلي.",
    suggestedEvidenceHint: "مبادرات تعزيز الانضباط، تقارير مجالس أولياء الأمور، اتفاقيات أو برامج مجتمعية موثقة.",
  },
  {
    key: "teaching.planning",
    code: "2-1",
    domainKey: "teaching_learning",
    title: "تنويع استراتيجيات التدريس ومراعاة الفروق الفردية",
    description: "يوظف الكادر التعليمي استراتيجيات تعلم نشطة وتقنيات رقمية تلائم احتياجات المتعلمين المتنوعة.",
    suggestedEvidenceHint: "تقارير دروس تطبيقية، شواهد توظيف التقنية والمصادر المتنوعة في الموقف التعليمي.",
  },
  {
    key: "teaching.assessment",
    code: "2-2",
    domainKey: "teaching_learning",
    title: "التقويم من أجل التعلم وتوظيف نتائجه",
    description: "تُحلل نتائج التقويم التشخيصي والتكويني والختامي وتُستثمر في تحسين التدريس وتقديم تغذية راجعة فورية.",
    suggestedEvidenceHint: "تقارير تحليل النتائج، نماذج أدوات تقويم متنوعة، شواهد التغذية الراجعة للمتعلمين.",
  },
  {
    key: "teaching.enrichment",
    code: "2-3",
    domainKey: "teaching_learning",
    title: "دعم المتعلمين المتعثرين ورعاية الموهوبين",
    description: "تنفذ المدرسة برامج علاجية وإثرائية موجهة بناءً على التشخيص الفعلي وتقيس أثرها على تقدم المتعلمين.",
    suggestedEvidenceHint: "تقارير البرامج العلاجية، برامج رعاية الموهوبين والمسابقات العلمية، قياس الأثر القبلي والبعدي.",
  },
  {
    key: "outcomes.achievement",
    code: "3-1",
    domainKey: "learning_outcomes",
    title: "التحصيل العلمي والتقدم في الاختبارات الوطنية (نافس)",
    description: "يحقق المتعلمون مستويات متقدمة ونموًا مستمرًا في المواد الأساسية والاختبارات المعيارية والوطنية.",
    suggestedEvidenceHint: "تقارير مقارنة نتائج التحصيل، خطط رفع الجاهزية للاختبارات الوطنية (نافس)، مؤشرات النمو.",
  },
  {
    key: "outcomes.values",
    code: "3-2",
    domainKey: "learning_outcomes",
    title: "القيم الإسلامية والهوية الوطنية والسلوك الإيجابي",
    description: "يُظهر المتعلمون اعتزازًا بالقيم الإسلامية والهوية الوطنية والتزامًا بالسلوك الإيجابي والمسؤولية.",
    suggestedEvidenceHint: "تقارير البرامج القيمية والوطنية، مبادرات التطوع الطلابي، مؤشرات التحسن السلوكي.",
  },
  {
    key: "outcomes.skills",
    code: "3-3",
    domainKey: "learning_outcomes",
    title: "المهارات الحياتية والرقمية والتطور الشخصي",
    description: "يكتسب المتعلمون مهارات التفكير الناقد وحل المشكلات والمهارات الرقمية والصحية عبر أنشطة تطبيقية.",
    suggestedEvidenceHint: "مشاريع طلابية تطبيقية، تقارير الأنشطة اللاصفية والمهارات الرقمية والصحية.",
  },
  {
    key: "env.building",
    code: "4-1",
    domainKey: "school_environment",
    title: "جاهزية المبنى والمرافق والتجهيزات المساندة",
    description: "تتوفر بيئة مادية ومعامل ومصادر تعلم مهيأة ونظيفة وصانتها دورية لخدمة التعلم.",
    suggestedEvidenceHint: "تقارير جاهزية المرافق والمعامل، سجلات الصيانة الوقائية وتهيئة الفصول.",
  },
  {
    key: "env.safety",
    code: "4-2",
    domainKey: "school_environment",
    title: "الأمن والسلامة والوقاية من المخاطر",
    description: "تطبق المدرسة إجراءات الأمن والسلامة وخطط الإخلاء الدورية وتضمن خلو البيئة المدرسية من المخاطر.",
    suggestedEvidenceHint: "تقارير فرضيات الإخلاء، فحوصات أدوات السلامة، محاضر لجنة الأمن والسلامة.",
  },
  {
    key: "env.climate",
    code: "4-3",
    domainKey: "school_environment",
    title: "المناخ المدرسي الداعم والرفاه الطلابي",
    description: "يسود المدرسة مناخ إيجابي قائم على الاحترام المتبادل والإرشاد التربوي الفاعل وتحفيز المتعلمين.",
    suggestedEvidenceHint: "برامج التوجيه الطلابي والرفاه، مبادرات التحفيز والتكريم، استطلاعات رضا المستفيدين.",
  },
] as const;

const VALID_INDICATOR_KEYS = new Set(SELF_EVALUATION_INDICATORS.map(item => item.key));
const VALID_ACTION_STATUSES = new Set<ImprovementActionStatus>(["planned", "in_progress", "completed"]);

export class SelfEvaluationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelfEvaluationValidationError";
  }
}

export type IndicatorAssessment = {
  indicatorKey: string;
  level: SelfEvaluationLevel | null;
  rationale: string;
  evidenceAssetIds: number[];
};

export type ImprovementAction = {
  id: string;
  indicatorKey: string;
  goal: string;
  action: string;
  ownerName: string;
  dueDate: string;
  status: ImprovementActionStatus;
  linkedWorkItemId: number | null;
};

export type SelfEvaluationDraftData = {
  schemaVersion: 1;
  frameworkId: typeof SELF_EVALUATION_FRAMEWORK_ID;
  revision: number;
  executiveSummary: string;
  assessments: Record<string, IndicatorAssessment>;
  improvementActions: ImprovementAction[];
  updatedAt: string;
};

export type DomainSummary = {
  domainKey: SelfEvaluationDomainKey;
  title: string;
  ratedCount: number;
  totalCount: number;
  averageLevel: number | null;
  readinessPercent: number;
  gapCount: number;
};

export type SelfEvaluationSummary = {
  totalIndicators: number;
  ratedIndicators: number;
  completionPercent: number;
  overallAverageLevel: number | null;
  overallReadinessPercent: number;
  gapIndicatorKeys: string[];
  uncoveredGapIndicatorKeys: string[];
  domains: DomainSummary[];
  actionCounts: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    linkedWorks: number;
  };
};

function isPositiveSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

function isValidLevel(value: unknown): value is SelfEvaluationLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

/**
 * Normalizes and validates a self-evaluation cycle document.
 * Enforces R09 / O009: any rated indicator MUST include a non-empty rationale
 * (minimum 5 trimmed characters) so ratings are never arbitrary unbacked clicks.
 */
export function normalizeSelfEvaluationDraft(
  raw: unknown,
  options: { strictValidation?: boolean } = {},
): SelfEvaluationDraftData {
  const strict = options.strictValidation ?? false;
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const revision = isPositiveSafeInt(record.revision) ? record.revision : 1;
  const executiveSummary = typeof record.executiveSummary === "string"
    ? record.executiveSummary.trim().slice(0, 4000)
    : "";

  const rawAssessments = record.assessments && typeof record.assessments === "object" && !Array.isArray(record.assessments)
    ? (record.assessments as Record<string, unknown>)
    : {};

  const assessments: Record<string, IndicatorAssessment> = {};
  for (const indicator of SELF_EVALUATION_INDICATORS) {
    const candidate = rawAssessments[indicator.key];
    const item = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : {};

    const level = item.level === null || item.level === undefined
      ? null
      : isValidLevel(item.level)
        ? item.level
        : strict
          ? (() => { throw new SelfEvaluationValidationError(`مستوى التقدير غير صالح للمؤشر ${indicator.code}`); })()
          : null;

    const rationale = typeof item.rationale === "string"
      ? item.rationale.trim().slice(0, 3000)
      : "";

    if (strict && level !== null && rationale.length < 5) {
      throw new SelfEvaluationValidationError(
        `يلزم تدوين مبرر واقعي واضح (5 أحرف على الأقل) عند تقييم المؤشر (${indicator.code}: ${indicator.title})`,
      );
    }

    const rawAssetIds = Array.isArray(item.evidenceAssetIds) ? item.evidenceAssetIds : [];
    const seenAssets = new Set<number>();
    const evidenceAssetIds: number[] = [];
    for (const id of rawAssetIds) {
      if (isPositiveSafeInt(id) && !seenAssets.has(id)) {
        seenAssets.add(id);
        evidenceAssetIds.push(id);
      }
      if (evidenceAssetIds.length >= 25) break;
    }

    assessments[indicator.key] = {
      indicatorKey: indicator.key,
      level,
      rationale,
      evidenceAssetIds,
    };
  }

  const rawActions = Array.isArray(record.improvementActions) ? record.improvementActions : [];
  if (strict && rawActions.length > 50) {
    throw new SelfEvaluationValidationError("الحد الأقصى لإجراءات خطة التحسين في الدورة الواحدة هو 50 إجراءً");
  }

  const improvementActions: ImprovementAction[] = [];
  const seenActionIds = new Set<string>();
  for (const candidate of rawActions.slice(0, 50)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const item = candidate as Record<string, unknown>;
    const indicatorKey = typeof item.indicatorKey === "string" ? item.indicatorKey.trim() : "";
    if (!VALID_INDICATOR_KEYS.has(indicatorKey)) {
      if (strict) throw new SelfEvaluationValidationError("إجراء التحسين مرتبط بمؤشر غير معروف في الإطار");
      continue;
    }

    const rawId = typeof item.id === "string" && item.id.trim().length >= 2
      ? item.id.trim().slice(0, 64)
      : `act-${improvementActions.length + 1}`;
    if (seenActionIds.has(rawId)) {
      if (strict) throw new SelfEvaluationValidationError("معرّف إجراء التحسين مكرر");
      continue;
    }
    seenActionIds.add(rawId);

    const goal = typeof item.goal === "string" ? item.goal.trim().slice(0, 300) : "";
    const action = typeof item.action === "string" ? item.action.trim().slice(0, 600) : "";
    if (strict && (goal.length < 3 || action.length < 3)) {
      throw new SelfEvaluationValidationError("أدخل هدف التحسين والخطوة الإجرائية بوضوح (3 أحرف على الأقل)");
    }
    if (!strict && (!goal || !action)) continue;

    const ownerName = typeof item.ownerName === "string" ? item.ownerName.trim().slice(0, 120) : "";
    const dueDateRaw = typeof item.dueDate === "string" ? item.dueDate.trim() : "";
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : "";
    const status: ImprovementActionStatus =
      typeof item.status === "string" && VALID_ACTION_STATUSES.has(item.status as ImprovementActionStatus)
        ? (item.status as ImprovementActionStatus)
        : "planned";
    const linkedWorkItemId = isPositiveSafeInt(item.linkedWorkItemId) ? item.linkedWorkItemId : null;

    improvementActions.push({
      id: rawId,
      indicatorKey,
      goal,
      action,
      ownerName,
      dueDate,
      status,
      linkedWorkItemId,
    });
  }

  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.trim()
    ? record.updatedAt
    : new Date().toISOString();

  return {
    schemaVersion: 1,
    frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
    revision,
    executiveSummary,
    assessments,
    improvementActions,
    updatedAt,
  };
}

export function computeSelfEvaluationSummary(draft: SelfEvaluationDraftData): SelfEvaluationSummary {
  const actionIndicatorSet = new Set(draft.improvementActions.map(item => item.indicatorKey));
  const gapIndicatorKeys: string[] = [];
  const uncoveredGapIndicatorKeys: string[] = [];

  let overallLevelSum = 0;
  let ratedIndicators = 0;

  const domains: DomainSummary[] = SELF_EVALUATION_DOMAINS.map(domain => {
    const domainIndicators = SELF_EVALUATION_INDICATORS.filter(ind => ind.domainKey === domain.key);
    let levelSum = 0;
    let domainRated = 0;
    let gapCount = 0;

    for (const ind of domainIndicators) {
      const assessment = draft.assessments[ind.key];
      const level = assessment?.level ?? null;
      if (level !== null) {
        domainRated += 1;
        ratedIndicators += 1;
        levelSum += level;
        overallLevelSum += level;
        if (level <= 2) {
          gapCount += 1;
          gapIndicatorKeys.push(ind.key);
          if (!actionIndicatorSet.has(ind.key)) {
            uncoveredGapIndicatorKeys.push(ind.key);
          }
        }
      }
    }

    const averageLevel = domainRated > 0 ? Math.round((levelSum / domainRated) * 100) / 100 : null;
    const readinessPercent = averageLevel !== null ? Math.round((averageLevel / 4) * 100) : 0;

    return {
      domainKey: domain.key,
      title: domain.title,
      ratedCount: domainRated,
      totalCount: domainIndicators.length,
      averageLevel,
      readinessPercent,
      gapCount,
    };
  });

  const totalIndicators = SELF_EVALUATION_INDICATORS.length;
  const completionPercent = Math.round((ratedIndicators / totalIndicators) * 100);
  // Unweighted mean across rated indicators: no official weights are claimed (O009 OPEN).
  const overallAverageLevel = ratedIndicators > 0
    ? Math.round((overallLevelSum / ratedIndicators) * 100) / 100
    : null;
  const overallReadinessPercent = overallAverageLevel !== null
    ? Math.round((overallAverageLevel / 4) * 100)
    : 0;

  return {
    totalIndicators,
    ratedIndicators,
    completionPercent,
    overallAverageLevel,
    overallReadinessPercent,
    gapIndicatorKeys,
    uncoveredGapIndicatorKeys,
    domains,
    actionCounts: {
      total: draft.improvementActions.length,
      planned: draft.improvementActions.filter(a => a.status === "planned").length,
      in_progress: draft.improvementActions.filter(a => a.status === "in_progress").length,
      completed: draft.improvementActions.filter(a => a.status === "completed").length,
      linkedWorks: draft.improvementActions.filter(a => a.linkedWorkItemId !== null).length,
    },
  };
}
