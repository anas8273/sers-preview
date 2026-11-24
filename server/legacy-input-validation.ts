import { z } from "zod";

const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/i;
export const MAX_LEGACY_IMAGE_DATA_LENGTH = 2_500_000;
export const MAX_LEGACY_URL_LENGTH = 2048;

export function isSafeLegacyHttpUrl(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || trimmed.length > MAX_LEGACY_URL_LENGTH || /[\u0000-\u001f\u007f]/.test(trimmed)) {
    return false;
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function isSafeLegacyImageSrc(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return false;
  if (trimmed.length <= MAX_LEGACY_IMAGE_DATA_LENGTH && SAFE_DATA_IMAGE_PATTERN.test(trimmed)) {
    return true;
  }
  return isSafeLegacyHttpUrl(trimmed);
}

function serializedBytes(value: unknown): number {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

export const optionalSafeLegacyHttpUrlSchema = z
  .string()
  .max(MAX_LEGACY_URL_LENGTH)
  .refine(v => v === "" || isSafeLegacyHttpUrl(v), "الرابط يجب أن يستخدم بروتوكول http أو https")
  .optional();

export const optionalSafeLegacyImageSchema = z
  .string()
  .max(MAX_LEGACY_IMAGE_DATA_LENGTH)
  .refine(v => v === "" || isSafeLegacyImageSrc(v), "مصدر الصورة غير صالح؛ يُسمح بروابط http/https أو صور PNG/JPEG")
  .optional();

const legacyFormFieldSchema = z.object({
  id: z.string().min(1).max(128),
  label: z.string().max(255),
  type: z.enum(["text", "textarea", "date", "select", "number", "image", "list", "signatures"]),
  placeholder: z.string().max(255).optional(),
  required: z.boolean().optional(),
  options: z.array(z.string().max(255)).max(50).optional(),
  defaultValue: z.string().max(500).optional(),
  gridColumn: z.string().max(64).optional(),
}).strict();

const legacySubEvidenceSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(500),
  description: z.string().max(2000).optional(),
  type: z.enum(["report", "upload", "both"]).optional(),
  isCustom: z.boolean().optional(),
  isSubItem: z.boolean().optional(),
  parentTitle: z.string().max(500).optional(),
  formFields: z.array(legacyFormFieldSchema).max(40).optional(),
}).strict();

const legacyEvidenceItemSchema = z.object({
  id: z.string().min(1).max(128),
  subEvidenceId: z.string().max(128).optional(),
  type: z.enum(["text", "image", "link", "file", "video"]),
  text: z.string().max(20_000).optional(),
  link: optionalSafeLegacyHttpUrlSchema,
  fileData: z.string().max(MAX_LEGACY_IMAGE_DATA_LENGTH).nullable()
    .refine(v => v === null || v === undefined || v === "" || isSafeLegacyImageSrc(v), "بيانات الصورة غير صالحة")
    .optional(),
  fileName: z.string().max(512).optional(),
  displayAs: z.enum(["image", "qr"]).optional(),
  formData: z.record(z.string().min(1).max(128), z.string().max(20_000))
    .refine(obj => Object.keys(obj).length <= 40, "تجاوزت الحقول الحد المسموح")
    .optional(),
  comment: z.string().max(5_000).optional(),
  priority: z.enum(["essential", "supporting", "supplementary", "additional"]).optional(),
  keywords: z.array(z.string().max(100)).max(30).optional(),
  showBarcode: z.boolean().optional(),
  uploadedUrl: optionalSafeLegacyHttpUrlSchema,
}).strict();

const legacyCriterionDataSchema = z.object({
  score: z.number().min(0).max(100).optional(),
  notes: z.string().max(20_000).optional(),
  evidences: z.array(legacyEvidenceItemSchema).max(100).optional(),
  customSubEvidences: z.array(legacySubEvidenceSchema).max(50).optional(),
}).strict();

export const legacyCriteriaDataSchema = z
  .record(z.string().min(1).max(128), legacyCriterionDataSchema)
  .refine(obj => Object.keys(obj).length <= 100, "تجاوزت المعايير الحد المسموح (100)")
  .refine(obj => serializedBytes(obj) <= 4_000_000, "حجم بيانات المعايير يتجاوز الحد المسموح");

const legacyCustomCriterionSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().min(1).max(255),
  maxScore: z.number().min(0).max(100).optional(),
  description: z.string().max(5_000).optional(),
  subEvidences: z.array(legacySubEvidenceSchema).max(50).optional(),
}).strict();

export const legacyCustomCriteriaSchema = z
  .array(legacyCustomCriterionSchema)
  .max(50)
  .refine(arr => serializedBytes(arr) <= 1_000_000, "حجم المعايير المخصصة يتجاوز الحد المسموح");

const legacyTemplateSectionSchema = z.object({
  id: z.string().min(1).max(128),
  title: z.string().max(255),
  titleBg: z.string().max(128).optional(),
  columns: z.number().int().min(1).max(4).optional(),
  pageBreakBefore: z.boolean().optional(),
  fields: z.array(legacyFormFieldSchema).max(40),
}).strict();

export const legacyTemplateLayoutSchema = z.object({
  version: z.number().int().min(1).max(10).optional(),
  pageSize: z.enum(["A4", "letter"]).optional(),
  direction: z.enum(["rtl", "ltr"]).optional(),
  layoutType: z.string().max(64).optional(),
  fieldStyle: z.string().max(64).optional(),
  titleStyle: z.string().max(64).optional(),
  signatureStyle: z.string().max(64).optional(),
  footerStyle: z.string().max(64).optional(),
  headerStyle: z.union([z.number().int().min(1).max(20), z.enum(["full-width", "centered", "minimal"])]).optional(),
  coverStyle: z.string().max(64).optional(),
  sectionCoverStyle: z.string().max(64).optional(),
  coverAccent2: z.string().max(64).optional(),
  showMoeLogo: z.boolean().optional(),
  showSchoolLogo: z.boolean().optional(),
  showEvidenceSection: z.boolean().optional(),
  evidenceDisplay: z.enum(["images", "qr", "mixed"]).optional(),
  sections: z.array(legacyTemplateSectionSchema).max(30).optional(),
  footerText: z.string().max(500).optional(),
  signatureLabels: z.object({ right: z.string().max(128), left: z.string().max(128) }).strict().optional(),
}).strict().refine(obj => serializedBytes(obj) <= 100_000, "حجم تخطيط القالب يتجاوز الحد المسموح");

export const legacyUserThemeDataSchema = z.object({
  id: z.string().max(128).optional(),
  name: z.string().max(255).optional(),
  description: z.string().max(2000).optional(),
  layoutType: z.string().max(64).optional(),
  headerBg: z.string().max(128).optional(),
  headerText: z.string().max(64).optional(),
  accent: z.string().max(64).optional(),
  borderColor: z.string().max(64).optional(),
  titleBg: z.string().max(128).optional(),
  fieldLabelBg: z.string().max(128).optional(),
  footerBg: z.string().max(128).optional(),
  bodyBg: z.string().max(64).optional(),
  sidebarBg: z.string().max(128).optional(),
  tableStyle: z.boolean().optional(),
  titleStyle: z.string().max(64).optional(),
  headerSeparator: z.boolean().optional(),
  showTopLine: z.boolean().optional(),
  showBottomBar: z.boolean().optional(),
  fieldStyle: z.string().max(64).optional(),
  signatureStyle: z.string().max(64).optional(),
  coverStyle: z.string().max(64).optional(),
  sectionCoverStyle: z.string().max(64).optional(),
  coverAccent2: z.string().max(64).optional(),
  headerVariant: z.string().max(64).optional(),
  fontFamily: z.string().max(128).optional(),
  coverBackgroundUrl: optionalSafeLegacyImageSchema,
  coverImageUrl: optionalSafeLegacyImageSchema,
  logoUrl: optionalSafeLegacyImageSchema,
  templateLayout: legacyTemplateLayoutSchema.nullable().optional(),
}).strict().refine(obj => serializedBytes(obj) <= 2_600_000, "حجم بيانات الثيم يتجاوز الحد المسموح");

export function sanitizeCriteriaDataForShareView(criteriaData: unknown): Record<string, unknown> {
  if (!criteriaData || typeof criteriaData !== "object" || Array.isArray(criteriaData)) return {};
  const output: Record<string, unknown> = {};
  for (const [criterionId, rawEntry] of Object.entries(criteriaData as Record<string, unknown>)) {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) continue;
    const entry = rawEntry as Record<string, unknown>;
    const evidences = Array.isArray(entry.evidences)
      ? entry.evidences.map(rawEv => {
          if (!rawEv || typeof rawEv !== "object" || Array.isArray(rawEv)) return rawEv;
          const ev = rawEv as Record<string, unknown>;
          const next = { ...ev };
          if (typeof next.link === "string" && next.link && !isSafeLegacyHttpUrl(next.link)) {
            next.link = "";
          }
          if (typeof next.uploadedUrl === "string" && next.uploadedUrl && !isSafeLegacyHttpUrl(next.uploadedUrl)) {
            delete next.uploadedUrl;
          }
          if (typeof next.fileData === "string" && next.fileData && !isSafeLegacyImageSrc(next.fileData)) {
            next.fileData = null;
          }
          return next;
        })
      : entry.evidences;
    output[criterionId] = { ...entry, evidences };
  }
  return output;
}
