import type { ReportFieldDefinition } from "./report-projection";

export type ReportPreflightStatus = "ready" | "attention";

export type ReportPreflightCheck = {
  id: string;
  passed: boolean;
  message: string;
};

export type ReportPreflightResult = {
  status: ReportPreflightStatus;
  filledFieldCount: number;
  totalFieldCount: number;
  checks: ReportPreflightCheck[];
};

export function evaluateReportPreflight(input: {
  title: string;
  fieldDefinitions: readonly ReportFieldDefinition[];
  fields: Readonly<Record<string, string | undefined>>;
  linkedAssetCount: number;
  selectedEvidenceCount: number;
}): ReportPreflightResult {
  const totalFieldCount = input.fieldDefinitions.length;
  let filledFieldCount = 0;
  let hasUnbrokenLongBlock = false;

  for (const def of input.fieldDefinitions) {
    const val = (input.fields[def.key] ?? "").trim();
    if (val.length > 0) {
      filledFieldCount += 1;
      if (val.length > 3500 && !val.includes("\n")) {
        hasUnbrokenLongBlock = true;
      }
    }
  }

  const summaryDef = input.fieldDefinitions.find(f => f.key === "summary");
  const hasSummary = !summaryDef || Boolean((input.fields.summary ?? "").trim());

  const objectiveDef = input.fieldDefinitions.find(f => f.key === "objectives" || f.key === "goals");
  const hasObjectives = !objectiveDef || Boolean((input.fields[objectiveDef.key] ?? "").trim());

  const checks: ReportPreflightCheck[] = [
    {
      id: "non-empty-content",
      passed: filledFieldCount > 0,
      message: filledFieldCount > 0
        ? `تمت تعبئة ${filledFieldCount} من أصل ${totalFieldCount} حقلًا في القالب`
        : "جميع حقول التقرير فارغة حاليًا؛ أضف محتوى قبل تثبيت النسخة",
    },
    {
      id: "core-sections",
      passed: hasSummary && hasObjectives,
      message: hasSummary && hasObjectives
        ? "الملخص والأهداف الأساسية مكتملة"
        : "يُستحسن استكمال حقلَي الملخص والأهداف لرفع جودة التقرير المصدّر",
    },
    {
      id: "evidence-selection",
      passed: !(input.linkedAssetCount > 0 && input.selectedEvidenceCount === 0),
      message: input.linkedAssetCount > 0 && input.selectedEvidenceCount === 0
        ? `يوجد ${input.linkedAssetCount} شاهد مرتبط بالعمل ولكن لم يُحدد أيٌّ منها للظهور في التقرير`
        : input.selectedEvidenceCount > 0
          ? `تم تضمين ${input.selectedEvidenceCount} شاهد داخل التقرير`
          : "لا توجد شواهد مرفقة (يمكنك التصدير بدون شواهد أو ربطها من تفاصيل العمل)",
    },
  ];

  if (hasUnbrokenLongBlock) {
    checks.push({
      id: "pagination-readability",
      passed: false,
      message: "أحد الحقول يحتوي نصًا طويلًا جدًا في فقرة واحدة؛ يُفضّل تقسيمه لفقرات لتحسين فواصل صفحات PDF وWord",
    });
  }

  const allPassed = checks.every(check => check.passed);
  return {
    status: allPassed ? "ready" : "attention",
    filledFieldCount,
    totalFieldCount,
    checks,
  };
}
