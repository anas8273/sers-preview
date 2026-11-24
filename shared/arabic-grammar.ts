import {
  REPORT_IDENTITY_TEXT_LIMIT,
  type ReportIdentity,
} from "./report-appearance";

export type EducatorGender = "male" | "female";
export type EducatorRoleKey = "teacher" | "principal" | "vice_principal" | "counselor";

export const EDUCATOR_ROLE_KEYS: readonly EducatorRoleKey[] = [
  "teacher",
  "principal",
  "vice_principal",
  "counselor",
] as const;

export const EDUCATOR_ROLE_LABELS: Record<EducatorRoleKey, { male: string; female: string }> = {
  teacher: { male: "معلم", female: "معلمة" },
  principal: { male: "قائد مدرسة", female: "قائدة مدرسة" },
  vice_principal: { male: "وكيل مدرسة", female: "وكيلة مدرسة" },
  counselor: { male: "موجه طلابي", female: "موجهة طلابية" },
};

export function normalizeEducatorGender(value: unknown): EducatorGender {
  return value === "female" ? "female" : "male";
}

export function normalizeEducatorRoleKey(value: unknown): EducatorRoleKey {
  return EDUCATOR_ROLE_KEYS.includes(value as EducatorRoleKey)
    ? (value as EducatorRoleKey)
    : "teacher";
}

export function formatEducatorRoleLabel(roleKey: EducatorRoleKey, gender: EducatorGender): string {
  const safeRole = normalizeEducatorRoleKey(roleKey);
  const safeGender = normalizeEducatorGender(gender);
  return EDUCATOR_ROLE_LABELS[safeRole][safeGender];
}

export function formatBeneficiaryPlural(gender: EducatorGender): "الطلاب" | "الطالبات" {
  return normalizeEducatorGender(gender) === "female" ? "الطالبات" : "الطلاب";
}

export function extractSchoolNameFromDepartment(department?: string | null): string {
  if (!department) return "";
  const lines = department
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(
      line =>
        Boolean(line) &&
        line !== "مدرسة..." &&
        line !== "المملكة العربية السعودية" &&
        line !== "وزارة التعليم" &&
        !line.startsWith("الإدارة العامة للتعليم بمنطقة..."),
    );
  return lines[lines.length - 1] ?? "";
}

export interface BuildReportIdentityDefaultsInput {
  organizationName?: string | null;
  department?: string | null;
  fullName?: string | null;
  preparer?: string | null;
  principalName?: string | null;
  gender?: EducatorGender;
  roleKey?: EducatorRoleKey;
  existing?: Partial<Omit<ReportIdentity, "version">>;
}

export function buildReportIdentityDefaults(
  input: BuildReportIdentityDefaultsInput,
): Partial<Omit<ReportIdentity, "version">> {
  const patch: Partial<Omit<ReportIdentity, "version">> = {};
  const schoolCandidate = (
    input.organizationName?.trim() || extractSchoolNameFromDepartment(input.department)
  ).slice(0, REPORT_IDENTITY_TEXT_LIMIT);

  if (!input.existing?.schoolName?.trim() && schoolCandidate) {
    patch.schoolName = schoolCandidate;
  }

  const rawPreparer = (input.fullName?.trim() || input.preparer?.trim() || "");
  if (!input.existing?.reportPreparer?.trim() && rawPreparer) {
    const roleSuffix = input.roleKey
      ? formatEducatorRoleLabel(input.roleKey, normalizeEducatorGender(input.gender))
      : "";
    const preparerValue = roleSuffix && !rawPreparer.includes(roleSuffix)
      ? `${rawPreparer} — ${roleSuffix}`
      : rawPreparer;
    patch.reportPreparer = preparerValue.slice(0, REPORT_IDENTITY_TEXT_LIMIT);
  }

  const principalCandidate = (input.principalName?.trim() || "").slice(0, REPORT_IDENTITY_TEXT_LIMIT);
  if (!input.existing?.schoolPrincipal?.trim() && principalCandidate) {
    patch.schoolPrincipal = principalCandidate;
  }

  return patch;
}
