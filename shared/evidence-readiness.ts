export type EvidenceReadinessAssetInput = {
  id: number;
  kind: "file" | "link" | "text";
  title?: string | null;
};

export type EvaluateWorkReadinessInput = {
  workType: "report" | "portfolio";
  linkedAssets: readonly EvidenceReadinessAssetInput[];
  hasAcademicContext: boolean;
  hasSubstantiveContent: boolean;
  versionCount?: number;
  linkedStandardsCount?: number;
};

export type ReadinessCheckKey =
  | "verifiedAssets"
  | "academicContext"
  | "substantiveContent"
  | "standardsLinkage";

export type ReadinessCheckStatus = "pass" | "warn" | "missing" | "advisory";

export type ReadinessCheckItem = {
  key: ReadinessCheckKey;
  label: string;
  status: ReadinessCheckStatus;
  optional: boolean;
  detail: string;
};

export type ProofClassificationBadge =
  | "شاهد أصلي موثّق"
  | "شواهد مساعدة بدون ملف مرفق"
  | "مسودة نصية بدون شاهد مرفق";

export type WorkReadinessResult = {
  status: "ready" | "needs_attention" | "incomplete";
  summaryLabel: string;
  proofBadge: ProofClassificationBadge;
  linkedAssetCount: number;
  verifiedFileCount: number;
  supportingAssetCount: number;
  missingItems: string[];
  checks: ReadinessCheckItem[];
};

export function evaluateWorkReadiness(input: EvaluateWorkReadinessInput): WorkReadinessResult {
  const linkedAssetCount = input.linkedAssets.length;
  const verifiedFileCount = input.linkedAssets.filter(asset => asset.kind === "file").length;
  const supportingAssetCount = linkedAssetCount - verifiedFileCount;

  const proofBadge: ProofClassificationBadge =
    verifiedFileCount > 0
      ? "شاهد أصلي موثّق"
      : linkedAssetCount > 0
        ? "شواهد مساعدة بدون ملف مرفق"
        : "مسودة نصية بدون شاهد مرفق";

  const assetCheck: ReadinessCheckItem =
    verifiedFileCount > 0
      ? {
          key: "verifiedAssets",
          label: "الشواهد الأصلية المرفقة",
          status: "pass",
          optional: false,
          detail: `مرفق ${verifiedFileCount} ملف شاهد أصلي موثّق${supportingAssetCount > 0 ? ` و${supportingAssetCount} مادة مساعدة` : ""}.`,
        }
      : linkedAssetCount > 0
        ? {
            key: "verifiedAssets",
            label: "الشواهد الأصلية المرفقة",
            status: "warn",
            optional: false,
            detail: `يوجد ${linkedAssetCount} رابط/نص مساعد فقط دون ملف مرفق؛ يُفضل إرفاق شاهد أصلي موثّق قبل التقديم.`,
          }
        : {
            key: "verifiedAssets",
            label: "الشواهد الأصلية المرفقة",
            status: "missing",
            optional: false,
            detail: "مسودة نصية بدون شاهد مرفق؛ اربط شاهدًا واحدًا على الأقل من مكتبة الشواهد.",
          };

  const academicCheck: ReadinessCheckItem = input.hasAcademicContext
    ? {
        key: "academicContext",
        label: "السنة والفصل الدراسي",
        status: "pass",
        optional: false,
        detail: "العمل مربوط بسنة/فصل دراسي واضح في السجل.",
      }
    : {
        key: "academicContext",
        label: "السنة والفصل الدراسي",
        status: "warn",
        optional: false,
        detail: "لم يُحدد سياق السنة أو الفصل الدراسي بعد؛ يُنصح بربطه لتوثيق الفترة.",
      };

  const contentLabel = input.workType === "report" ? "محتوى التقرير" : "عناصر ملف الإنجاز";
  const contentCheck: ReadinessCheckItem = input.hasSubstantiveContent
    ? {
        key: "substantiveContent",
        label: contentLabel,
        status: "pass",
        optional: false,
        detail:
          (input.versionCount ?? 0) > 0
            ? `يتضمن محتوى فعليًا مع ${input.versionCount} نسخة ثابتة محفوظة.`
            : "يتضمن محتوى فعليًا جاهزًا للتثبيت في نسخة.",
      }
    : {
        key: "substantiveContent",
        label: contentLabel,
        status: "missing",
        optional: false,
        detail:
          input.workType === "report"
            ? "أضف حقول التقرير واحفظ نسخة ثابتة من المحرر قبل الإرسال."
            : "أضف عناصر ومقدمة في ملف الإنجاز المرجعي قبل تثبيت النسخة.",
      };

  const standardsCount = input.linkedStandardsCount ?? 0;
  const standardsCheck: ReadinessCheckItem = {
    key: "standardsLinkage",
    label: "الربط بالمعايير التربوية (استرشادي)",
    status: standardsCount > 0 ? "pass" : "advisory",
    optional: true,
    detail:
      standardsCount > 0
        ? `مرتبط بـ ${standardsCount} معيار في سجل المعايير.`
        : "اختياري: ربط الشواهد بالمعايير من مكتبة الشواهد يرفع وضوح التقييم.",
  };

  const checks = [assetCheck, academicCheck, contentCheck, standardsCheck];
  const missingItems = checks
    .filter(check => !check.optional && (check.status === "missing" || check.status === "warn"))
    .map(check => check.detail);

  let status: WorkReadinessResult["status"] = "ready";
  if (linkedAssetCount === 0 || !input.hasSubstantiveContent) {
    status = "incomplete";
  } else if (verifiedFileCount === 0 || !input.hasAcademicContext) {
    status = "needs_attention";
  }

  const summaryLabel =
    status === "ready"
      ? "جاهز للتقديم والمراجعة"
      : status === "needs_attention"
        ? "مكتمل أساسيًا مع تنبيهات تحسين"
        : "يحتاج استكمالًا قبل التقديم";

  return {
    status,
    summaryLabel,
    proofBadge,
    linkedAssetCount,
    verifiedFileCount,
    supportingAssetCount,
    missingItems,
    checks,
  };
}
