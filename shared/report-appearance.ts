export const REPORT_FONT_FAMILIES = ["Cairo", "Tajawal", "Noto Kufi Arabic"] as const;
export type ReportFontFamily = typeof REPORT_FONT_FAMILIES[number] | "Arial";

export const REPORT_IDENTITY_VERSION = "1" as const;
export const REPORT_IDENTITY_FIELDS = [
  { key: "schoolName", label: "اسم المدرسة" },
  { key: "reportPreparer", label: "معد التقرير" },
  { key: "schoolPrincipal", label: "مدير المدرسة" },
] as const;
export const REPORT_IDENTITY_KEYS = [
  "reportIdentityVersion",
  "schoolName",
  "reportPreparer",
  "schoolPrincipal",
  "ministryLogo",
  "schoolLogoPng",
] as const;
export const REPORT_IDENTITY_META_KEYS = REPORT_IDENTITY_KEYS;
export type ReportIdentityMetaKey = typeof REPORT_IDENTITY_KEYS[number];

export function isReportIdentityFieldKey(key: string): key is ReportIdentityMetaKey {
  return (REPORT_IDENTITY_KEYS as readonly string[]).includes(key);
}

export type ReportIdentity = {
  version: typeof REPORT_IDENTITY_VERSION;
  schoolName?: string;
  reportPreparer?: string;
  schoolPrincipal?: string;
  ministryLogo?: boolean;
  schoolLogoPng?: string;
};

export type ReportInstitutionIdentity = ReturnType<typeof reportInstitution>;
export const REPORT_IDENTITY_TEXT_LIMIT = 120;
export const REPORT_SCHOOL_LOGO_MAX_BASE64 = 96_000;
export const REPORT_SCHOOL_LOGO_MAX_DIMENSION = 320;
export const REPORT_MINISTRY_LOGO_ALT = "شعار وزارة التعليم";
export const REPORT_SCHOOL_LOGO_ALT = "شعار المدرسة";

const BASE64_PATTERN = /^[A-Za-z0-9+/]*={0,2}$/;
const TYPED_IDENTITY_KEYS = new Set([
  "version",
  "schoolName",
  "reportPreparer",
  "schoolPrincipal",
  "ministryLogo",
  "schoolLogoPng",
]);

function cleanIdentityText(value: unknown, fieldName: string): string | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (typeof value !== "string") throw new Error(`Field ${fieldName} must be text`);
  const cleaned = value.replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, REPORT_IDENTITY_TEXT_LIMIT);
  return cleaned || undefined;
}

export function normalizeReportIdentity(value: unknown): ReportIdentity | undefined {
  if (value === undefined || value === null) return undefined;
  if (typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Report identity must be an object");
  }
  const input = value as Record<string, unknown>;
  const isTyped = input.version !== undefined;
  const isLegacy = !isTyped && input.reportIdentityVersion !== undefined;

  if (isTyped) {
    if (input.version !== REPORT_IDENTITY_VERSION) {
      throw new Error(`Unsupported report identity version: ${String(input.version)}`);
    }
    if (input.reportIdentityVersion !== undefined) {
      throw new Error("Typed reportIdentity cannot include legacy reportIdentityVersion");
    }
    for (const key of Object.keys(input)) {
      if (!TYPED_IDENTITY_KEYS.has(key)) {
        throw new Error(`Unknown report identity field: ${key}`);
      }
    }
  } else if (isLegacy) {
    if (input.reportIdentityVersion !== REPORT_IDENTITY_VERSION) {
      throw new Error(`Unsupported report identity version: ${String(input.reportIdentityVersion)}`);
    }
  } else {
    const hasAnyKey = ["schoolName", "reportPreparer", "schoolPrincipal", "ministryLogo", "schoolLogoPng"]
      .some(key => input[key] !== undefined && input[key] !== null && input[key] !== "" && input[key] !== false);
    if (hasAnyKey) {
      throw new Error(`Report identity requires version "${REPORT_IDENTITY_VERSION}"`);
    }
    return undefined;
  }

  const schoolName = cleanIdentityText(input.schoolName, "schoolName");
  const reportPreparer = cleanIdentityText(input.reportPreparer, "reportPreparer");
  const schoolPrincipal = cleanIdentityText(input.schoolPrincipal, "schoolPrincipal");

  let ministryLogo = false;
  if (input.ministryLogo !== undefined && input.ministryLogo !== null && input.ministryLogo !== "") {
    if (input.ministryLogo === true || input.ministryLogo === "yes") {
      ministryLogo = true;
    } else if (input.ministryLogo === false) {
      ministryLogo = false;
    } else {
      throw new Error("Field ministryLogo has an unsupported option");
    }
  }

  let schoolLogoPng: string | undefined;
  if (input.schoolLogoPng !== undefined && input.schoolLogoPng !== null && input.schoolLogoPng !== "") {
    if (typeof input.schoolLogoPng !== "string") {
      throw new Error("Field schoolLogoPng must be text");
    }
    if (input.schoolLogoPng.length > REPORT_SCHOOL_LOGO_MAX_BASE64 || !BASE64_PATTERN.test(input.schoolLogoPng)) {
      throw new Error("Field schoolLogoPng must be valid base64 PNG data within the allowed size limit");
    }
    schoolLogoPng = input.schoolLogoPng;
  }

  if (!schoolName && !reportPreparer && !schoolPrincipal && !ministryLogo && !schoolLogoPng) {
    return undefined;
  }

  return {
    version: REPORT_IDENTITY_VERSION,
    ...(schoolName ? { schoolName } : {}),
    ...(reportPreparer ? { reportPreparer } : {}),
    ...(schoolPrincipal ? { schoolPrincipal } : {}),
    ...(ministryLogo ? { ministryLogo: true } : {}),
    ...(schoolLogoPng ? { schoolLogoPng } : {}),
  };
}

export function reportFontFamily(value: unknown, fallback: ReportFontFamily = "Cairo"): ReportFontFamily {
  return value === "Arial" || REPORT_FONT_FAMILIES.some(font => font === value) ? value as ReportFontFamily : fallback;
}

export function reportInstitution(value: unknown) {
  const input = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fields = input.version === REPORT_IDENTITY_VERSION || input.reportIdentityVersion === REPORT_IDENTITY_VERSION
    ? input
    : {};
  const text = (key: string) => typeof fields[key] === "string"
    ? fields[key].replace(/[\x00-\x1f\x7f]/g, " ").trim().slice(0, REPORT_IDENTITY_TEXT_LIMIT)
    : "";
  const schoolName = text("schoolName");
  const ministryLogo = fields.ministryLogo === true || fields.ministryLogo === "yes";
  const schoolLogo = typeof fields.schoolLogoPng === "string" ? fields.schoolLogoPng : "";
  const signers = REPORT_IDENTITY_FIELDS.slice(1)
    .map(({ key, label }) => ({ label, name: text(key) }))
    .filter(({ name }) => Boolean(name));
  return {
    schoolName,
    ministryLogo,
    schoolLogo,
    signers,
    visible: Boolean(schoolName || ministryLogo || schoolLogo || signers.length > 0),
  };
}
