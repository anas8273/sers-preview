export const REPORT_FONT_FAMILIES = ["Cairo", "Tajawal", "Noto Kufi Arabic"] as const;
export type ReportFontFamily = typeof REPORT_FONT_FAMILIES[number] | "Arial";

export const REPORT_IDENTITY_FIELDS = [
  { key: "schoolName", label: "اسم المدرسة" },
  { key: "reportPreparer", label: "معد التقرير" },
  { key: "schoolPrincipal", label: "مدير المدرسة" },
] as const;
export const REPORT_IDENTITY_TEXT_LIMIT = 120;
export const REPORT_SCHOOL_LOGO_MAX_BASE64 = 96_000;
export const REPORT_SCHOOL_LOGO_MAX_DIMENSION = 320;
export const REPORT_MINISTRY_LOGO_ALT = "شعار وزارة التعليم";
export const REPORT_SCHOOL_LOGO_ALT = "شعار المدرسة";

export function reportFontFamily(value: unknown, fallback: ReportFontFamily = "Cairo"): ReportFontFamily {
  return value === "Arial" || REPORT_FONT_FAMILIES.some(font => font === value) ? value as ReportFontFamily : fallback;
}

export function reportInstitution(value: unknown) {
  const input = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const fields = input.reportIdentityVersion === "1" ? input : {};
  const text = (key: string) => typeof fields[key] === "string"
    ? fields[key].replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, REPORT_IDENTITY_TEXT_LIMIT) : "";
  const schoolName = text("schoolName");
  const ministryLogo = fields.ministryLogo === "yes";
  const schoolLogo = typeof fields.schoolLogoPng === "string" ? fields.schoolLogoPng : "";
  const signers = REPORT_IDENTITY_FIELDS.slice(1).map(({ key, label }) => ({ label, name: text(key) }));
  return { schoolName, ministryLogo, schoolLogo, signers, visible: Boolean(schoolName || ministryLogo || schoolLogo || signers.some(({ name }) => name)) };
}
