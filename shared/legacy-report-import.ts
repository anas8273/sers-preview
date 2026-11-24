export type LegacySavedReport = {
  id: string;
  templateId?: string;
  title?: string;
  data?: Record<string, unknown>;
  themeId?: string;
  fontFamily?: string;
  createdAt?: number;
  updatedAt?: number;
};

export type LegacyImportPreview = {
  sourceId: string;
  sourceTitle: string;
  mappedFieldCount: number;
  fields: Record<string, string>;
};

const LEGACY_FIELD_LABELS: Readonly<Record<string, string>> = {
  subject: "المادة",
  class: "الصف / الفصل",
  semester: "الفصل الدراسي",
  year: "العام الدراسي",
  totalStudents: "عدد الطلاب",
  excellentCount: "عدد المتفوقين",
  failCount: "عدد المتعثرين",
  average: "متوسط الدرجات",
  strengths: "نقاط القوة",
  weaknesses: "نقاط الضعف",
  recommendations: "التوصيات",
  teacherName: "اسم المعلم",
  period: "الفترة",
  trainings: "الدورات التدريبية",
  activities: "الأنشطة المنفذة",
  innovations: "المبادرات والابتكارات",
  challenges: "التحديات",
  goals: "الأهداف المستقبلية",
  school: "المدرسة",
  weekDate: "الأسبوع",
  attendance: "نسبة الحضور",
  events: "الفعاليات والأنشطة",
  issues: "الملاحظات والمشكلات",
  decisions: "القرارات المتخذة",
  nextWeek: "خطة الأسبوع القادم",
  deptName: "اسم القسم",
  head: "رئيس القسم",
  teacherCount: "عدد المعلمين",
  meetings: "الاجتماعات المنعقدة",
  achievements: "الإنجازات",
  plans: "الخطط المستقبلية",
  title: "عنوان التقرير",
  date: "التاريخ",
  content: "المحتوى",
  notes: "ملاحظات",
};

const DIRECT_TARGET_MAP: Readonly<Record<string, string>> = {
  goals: "objectives",
  recommendations: "recommendations",
  activities: "implementation",
  events: "implementation",
  achievements: "results",
  strengths: "results",
  content: "summary",
};

export function mapLegacyReportToFields(
  legacy: LegacySavedReport,
  allowedFieldKeys: readonly string[],
): LegacyImportPreview {
  const allowed = new Set(allowedFieldKeys);
  const rawData = legacy.data && typeof legacy.data === "object" ? legacy.data : {};
  const fields: Record<string, string> = {};
  const extraLines: string[] = [];
  let mappedFieldCount = 0;

  for (const [key, rawValue] of Object.entries(rawData)) {
    const text = typeof rawValue === "string"
      ? rawValue.trim()
      : typeof rawValue === "number" && Number.isFinite(rawValue)
        ? String(rawValue)
        : "";
    if (!text) continue;
    mappedFieldCount += 1;

    const directKey = allowed.has(key) ? key : DIRECT_TARGET_MAP[key];
    if (directKey && allowed.has(directKey) && !fields[directKey]) {
      fields[directKey] = text;
    } else {
      const label = LEGACY_FIELD_LABELS[key] ?? key;
      extraLines.push(`${label}: ${text}`);
    }
  }

  if (extraLines.length > 0 && allowed.has("summary")) {
    const appendix = `— مستورد من المسودة القديمة —\n${extraLines.join("\n")}`;
    fields.summary = fields.summary ? `${fields.summary}\n\n${appendix}` : appendix;
  }

  return {
    sourceId: legacy.id,
    sourceTitle: (legacy.title || "").trim() || "مسودة تقرير قديمة",
    mappedFieldCount,
    fields,
  };
}
