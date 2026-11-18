export const REPORT_SCHEMA_VERSION = 2 as const;
export const REPORT_SCHEMA_COMPATIBILITY_KEY = "work-report-v2" as const;

export type ReportFieldType = "text" | "textarea" | "number" | "date" | "select" | "list";
export type ReportFieldValue = string | number | string[];

export type ReportFieldDefinition = {
  key: string;
  label: string;
  type: ReportFieldType;
  placeholder?: string;
  options?: readonly string[];
  maxLength?: number;
  rows?: number;
};

export type ReportTemplateDefinition = {
  id: string;
  label: string;
  version: number;
  fields: readonly ReportFieldDefinition[];
};

const baseFields: readonly ReportFieldDefinition[] = [
  { key: "summary", label: "ملخص التقرير", type: "textarea", placeholder: "اكتب ملخصًا موجزًا للعمل أو البرنامج المنفذ...", maxLength: 20_000, rows: 4 },
  { key: "objectives", label: "الأهداف", type: "textarea", placeholder: "ما الأهداف التي سعى العمل إلى تحقيقها؟", maxLength: 20_000, rows: 4 },
  { key: "audience", label: "الفئة المستهدفة", type: "textarea", placeholder: "مثال: منسوبات المدرسة، طالبات الصف الثالث...", maxLength: 20_000, rows: 2 },
  { key: "implementation", label: "آلية التنفيذ", type: "textarea", placeholder: "صف خطوات التنفيذ الفعلية بترتيب واضح...", maxLength: 20_000, rows: 6 },
  { key: "results", label: "النتائج والمخرجات", type: "textarea", placeholder: "ما النتائج الفعلية التي تحققت؟", maxLength: 20_000, rows: 4 },
  { key: "impact", label: "قياس الأثر", type: "textarea", placeholder: "أدخل أداة القياس والنتيجة، أو وضّح أن القياس لم يُجمع بعد...", maxLength: 20_000, rows: 4 },
  { key: "recommendations", label: "التوصيات والخطوات التالية", type: "textarea", placeholder: "أضف توصيات قابلة للتنفيذ...", maxLength: 20_000, rows: 4 },
];

const programFields: readonly ReportFieldDefinition[] = [
  { key: "subject", label: "الموضوع", type: "text", maxLength: 500 },
  { key: "executionDate", label: "تاريخ التنفيذ", type: "date", maxLength: 32 },
  { key: "field", label: "المجال", type: "text", maxLength: 500 },
  { key: "executor", label: "المنفذ/ون", type: "text", maxLength: 1000 },
  { key: "participants", label: "المشارك/ون", type: "text", maxLength: 1000 },
  { key: "beneficiaries", label: "المستفيدون", type: "text", maxLength: 1000 },
  { key: "location", label: "مكان التنفيذ", type: "text", maxLength: 500 },
  { key: "duration", label: "مدة التنفيذ", type: "text", maxLength: 255 },
  { key: "goals", label: "الأهداف التفصيلية", type: "list", maxLength: 2000 },
  { key: "steps", label: "خطوات التنفيذ", type: "list", maxLength: 2000 },
];

const initiativeFields: readonly ReportFieldDefinition[] = [
  { key: "initiativeName", label: "اسم المبادرة", type: "text", maxLength: 500 },
  { key: "initiativeDate", label: "تاريخ المبادرة", type: "date", maxLength: 32 },
  { key: "sponsor", label: "الجهة الراعية", type: "text", maxLength: 500 },
  { key: "activities", label: "الأنشطة", type: "list", maxLength: 2000 },
  { key: "outcomes", label: "المخرجات", type: "textarea", maxLength: 20_000, rows: 5 },
];

const workshopFields: readonly ReportFieldDefinition[] = [
  { key: "workshopTitle", label: "عنوان الورشة", type: "text", maxLength: 500 },
  { key: "workshopDate", label: "تاريخ الورشة", type: "date", maxLength: 32 },
  { key: "trainer", label: "المدرب/ة", type: "text", maxLength: 500 },
  { key: "participantsCount", label: "عدد المشاركين", type: "number", maxLength: 20 },
  { key: "materials", label: "المواد والأدوات", type: "list", maxLength: 2000 },
];

const meetingFields: readonly ReportFieldDefinition[] = [
  { key: "meetingDate", label: "تاريخ الاجتماع", type: "date", maxLength: 32 },
  { key: "attendees", label: "الحاضرون", type: "text", maxLength: 2000 },
  { key: "agenda", label: "جدول الأعمال", type: "list", maxLength: 2000 },
  { key: "decisions", label: "القرارات", type: "textarea", maxLength: 20_000, rows: 5 },
  { key: "actionItems", label: "بنود المتابعة", type: "list", maxLength: 2000 },
];

const visitFields: readonly ReportFieldDefinition[] = [
  { key: "visitType", label: "نوع الزيارة", type: "select", options: ["صفية", "ميدانية", "إشرافية", "تبادلية", "أخرى"], maxLength: 255 },
  { key: "visitDate", label: "تاريخ الزيارة", type: "date", maxLength: 32 },
  { key: "visitedEntity", label: "الجهة المُزارة", type: "text", maxLength: 500 },
  { key: "visitor", label: "الزائر", type: "text", maxLength: 500 },
  { key: "subject", label: "المادة / الدرس", type: "text", maxLength: 500 },
  { key: "grade", label: "الصف", type: "text", maxLength: 255 },
  { key: "positives", label: "الإيجابيات", type: "textarea", maxLength: 20_000, rows: 4 },
  { key: "improvements", label: "نقاط التحسين", type: "textarea", maxLength: 20_000, rows: 4 },
  { key: "generalNotes", label: "ملاحظات عامة", type: "textarea", maxLength: 20_000, rows: 4 },
];

function mergeFields(extra: readonly ReportFieldDefinition[]) {
  const seen = new Set<string>();
  return [...baseFields, ...extra].filter(field => !seen.has(field.key) && (seen.add(field.key), true));
}

export const REPORT_TEMPLATE_DEFINITIONS: Readonly<Record<string, ReportTemplateDefinition>> = {
  custom: { id: "custom", label: "تقرير عام", version: 1, fields: baseFields },
  "program-report": { id: "program-report", label: "تقرير برنامج", version: 1, fields: mergeFields(programFields) },
  "initiative-report": { id: "initiative-report", label: "تقرير مبادرة", version: 1, fields: mergeFields(initiativeFields) },
  "workshop-report": { id: "workshop-report", label: "تقرير ورشة", version: 1, fields: mergeFields(workshopFields) },
  "meeting-report": { id: "meeting-report", label: "محضر/تقرير اجتماع", version: 1, fields: mergeFields(meetingFields) },
  "visit-report": { id: "visit-report", label: "تقرير زيارة", version: 1, fields: mergeFields(visitFields) },
};

export const REPORT_TEMPLATE_OPTIONS = Object.values(REPORT_TEMPLATE_DEFINITIONS).map(({ id, label }) => ({ id, label }));
export const REPORT_THEME_OPTIONS = [
  { id: "classic", label: "رسمي كلاسيكي" },
  { id: "formal", label: "مؤسسي هادئ" },
  { id: "minimal", label: "بسيط حديث" },
] as const;
export const REPORT_FONT_OPTIONS = ["Cairo", "Tajawal", "Noto Kufi Arabic", "Arial"] as const;

export type ReportDraftContent = {
  schemaVersion?: number;
  templateId: string;
  templateVersionId?: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, ReportFieldValue>;
  evidenceAssetIds: number[];
};

export type NormalizedReportDraft = Omit<ReportDraftContent, "schemaVersion" | "templateVersionId"> & {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  templateVersionId: string;
  fieldDefinitions: readonly ReportFieldDefinition[];
  migratedFromSchemaVersion?: number;
};

export class ReportDocumentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportDocumentValidationError";
  }
}

function assertText(value: string, field: ReportFieldDefinition) {
  const max = field.maxLength ?? 20_000;
  if (value.length > max) throw new ReportDocumentValidationError(`Field ${field.key} exceeds its maximum length`);
  return value;
}

function normalizeFieldValue(value: unknown, field: ReportFieldDefinition): ReportFieldValue | undefined {
  if (value === undefined || value === null || value === "") return undefined;
  if (field.type === "list") {
    if (!Array.isArray(value) || value.length > 100 || !value.every(item => typeof item === "string")) throw new ReportDocumentValidationError(`Field ${field.key} must be a list`);
    const items = value.map(item => assertText(item, field).trim()).filter(Boolean);
    return items.length ? items : undefined;
  }
  if (field.type === "number") {
    if (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(value)) throw new ReportDocumentValidationError(`Field ${field.key} must be a finite number`);
    return value;
  }
  if (typeof value !== "string") throw new ReportDocumentValidationError(`Field ${field.key} must be text`);
  const normalized = assertText(value, field);
  if (field.type === "select" && field.options && !field.options.includes(normalized)) throw new ReportDocumentValidationError(`Field ${field.key} has an unsupported option`);
  return normalized;
}

function frozenFieldDefinitions(value: unknown): readonly ReportFieldDefinition[] {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    throw new ReportDocumentValidationError("Schema v2 requires non-empty frozen field definitions");
  }
  const result: ReportFieldDefinition[] = [];
  const keys = new Set<string>();
  for (const item of value) {
    if (!item || typeof item !== "object") throw new ReportDocumentValidationError("Schema v2 contains an invalid frozen field definition");
    const field = item as Record<string, unknown>;
    if (typeof field.key !== "string" || !/^[A-Za-z][A-Za-z0-9_-]{0,127}$/.test(field.key)
      || keys.has(field.key) || typeof field.label !== "string" || !field.label.trim() || field.label.length > 255
      || !["text", "textarea", "number", "date", "select", "list"].includes(String(field.type))) {
      throw new ReportDocumentValidationError("Schema v2 contains an invalid frozen field definition");
    }
    if (field.placeholder !== undefined && (typeof field.placeholder !== "string" || field.placeholder.length > 1000)) {
      throw new ReportDocumentValidationError(`Frozen field ${field.key} has an invalid placeholder`);
    }
    if (field.options !== undefined && (!Array.isArray(field.options) || field.options.length > 100 || !field.options.every(option => typeof option === "string" && option.length <= 255))) {
      throw new ReportDocumentValidationError(`Frozen field ${field.key} has invalid options`);
    }
    if (field.maxLength !== undefined && (!Number.isSafeInteger(field.maxLength) || Number(field.maxLength) <= 0 || Number(field.maxLength) > 20_000)) {
      throw new ReportDocumentValidationError(`Frozen field ${field.key} has an invalid maximum length`);
    }
    if (field.rows !== undefined && (!Number.isSafeInteger(field.rows) || Number(field.rows) <= 0 || Number(field.rows) > 20)) {
      throw new ReportDocumentValidationError(`Frozen field ${field.key} has invalid rows`);
    }
    keys.add(field.key);
    result.push({
      key: field.key,
      label: field.label,
      type: field.type as ReportFieldType,
      ...(typeof field.placeholder === "string" ? { placeholder: field.placeholder.slice(0, 1000) } : {}),
      ...(Array.isArray(field.options) ? { options: field.options.slice(0, 100) as string[] } : {}),
      ...(field.maxLength !== undefined ? { maxLength: Number(field.maxLength) } : {}),
      ...(field.rows !== undefined ? { rows: Number(field.rows) } : {}),
    });
  }
  return result;
}

export function getReportTemplate(templateId: string): ReportTemplateDefinition {
  const template = REPORT_TEMPLATE_DEFINITIONS[templateId];
  if (!template) throw new ReportDocumentValidationError(`Unknown report template: ${templateId}`);
  return template;
}

export function normalizeReportDraft(value: unknown, options: { allowLegacy?: boolean } = {}): NormalizedReportDraft {
  if (!value || typeof value !== "object") throw new ReportDocumentValidationError("Report draft is missing");
  const input = value as Record<string, unknown>;
  const sourceSchemaVersion = typeof input.schemaVersion === "number" ? input.schemaVersion : 1;
  if (sourceSchemaVersion !== REPORT_SCHEMA_VERSION && !(options.allowLegacy !== false && sourceSchemaVersion === 1)) {
    throw new ReportDocumentValidationError(`Unsupported report schema version: ${sourceSchemaVersion}`);
  }
  const templateId = typeof input.templateId === "string" ? input.templateId : "custom";
  const template = getReportTemplate(templateId);
  if (input.templateVersionId !== undefined && input.templateVersionId !== `${template.id}@${template.version}`) {
    throw new ReportDocumentValidationError("Report template version is not compatible");
  }
  const themeId = typeof input.themeId === "string" ? input.themeId : "classic";
  if (!REPORT_THEME_OPTIONS.some(option => option.id === themeId)) throw new ReportDocumentValidationError(`Unknown report theme: ${themeId}`);
  const fontFamily = typeof input.fontFamily === "string" ? input.fontFamily : "Cairo";
  if (!REPORT_FONT_OPTIONS.includes(fontFamily as typeof REPORT_FONT_OPTIONS[number])) throw new ReportDocumentValidationError(`Unknown report font: ${fontFamily}`);
  const rawFields = input.fields && typeof input.fields === "object" && !Array.isArray(input.fields) ? input.fields as Record<string, unknown> : {};
  // Runtime definitions are a deliberate migration path for schema v1 only.
  // A v2 snapshot is historical data and must carry its own complete contract.
  const definitionsList = sourceSchemaVersion === REPORT_SCHEMA_VERSION
    ? frozenFieldDefinitions(input.fieldDefinitions)
    : template.fields;
  const definitions = new Map(definitionsList.map(field => [field.key, field]));
  const fields: Record<string, ReportFieldValue> = {};
  for (const [key, raw] of Object.entries(rawFields)) {
    const field = definitions.get(key);
    if (!field) throw new ReportDocumentValidationError(`Unknown report field: ${key}`);
    const normalized = normalizeFieldValue(raw, field);
    if (normalized !== undefined) fields[key] = normalized;
  }
  const evidenceAssetIds = Array.isArray(input.evidenceAssetIds)
    ? input.evidenceAssetIds.filter((id): id is number => Number.isSafeInteger(id) && id > 0).filter((id, index, list) => list.indexOf(id) === index)
    : [];
  return {
    schemaVersion: REPORT_SCHEMA_VERSION,
    templateId,
    templateVersionId: `${template.id}@${template.version}`,
    themeId,
    fontFamily,
    fields,
    evidenceAssetIds,
    fieldDefinitions: definitionsList,
    ...(sourceSchemaVersion === 1 ? { migratedFromSchemaVersion: 1 } : {}),
  };
}

export type ReportProjectionAsset = {
  id: number;
  title?: string;
  kind?: string;
  role?: string;
  caption?: string | null;
  frozen?: {
    referenceVersion: string;
    digest: string;
    bytes: number;
    contentType: "image/png" | "image/jpeg";
    sourceAssetId: number;
    sourceUploadIntentId: string;
    preview?: { mimeType: "image/png"; dataBase64: string; width: number; height: number };
  };
  preview?: { mimeType?: string; dataBase64?: string; width?: number; height?: number };
};

export type ReportDocumentModel = {
  schemaVersion: typeof REPORT_SCHEMA_VERSION;
  template: ReportTemplateDefinition;
  fields: Array<{ key: string; label: string; type: ReportFieldType; value: ReportFieldValue }>;
  evidence: ReportProjectionAsset[];
};

function assertFrozenEvidence(asset: ReportProjectionAsset) {
  if (asset.preview !== undefined && !asset.frozen) {
    throw new ReportDocumentValidationError(`Selected evidence ${asset.id} has an unfrozen preview`);
  }
  if (!asset.frozen) return;
  const frozen = asset.frozen;
  if (!Number.isSafeInteger(frozen.sourceAssetId) || frozen.sourceAssetId !== asset.id
    || typeof frozen.sourceUploadIntentId !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(frozen.sourceUploadIntentId)
    || typeof frozen.referenceVersion !== "string" || !frozen.referenceVersion.trim() || frozen.referenceVersion.length > 1024
    || !/^[a-f0-9]{64}$/i.test(frozen.digest) || !Number.isSafeInteger(frozen.bytes) || frozen.bytes <= 0
    || (frozen.contentType !== "image/png" && frozen.contentType !== "image/jpeg")) {
    throw new ReportDocumentValidationError(`Selected evidence ${asset.id} has invalid frozen identity`);
  }
  if (!frozen.preview) throw new ReportDocumentValidationError(`Selected evidence ${asset.id} has no frozen preview`);
  const preview = frozen.preview;
  if (preview.mimeType !== "image/png" || typeof preview.dataBase64 !== "string"
    || !/^[A-Za-z0-9+/]*={0,2}$/.test(preview.dataBase64) || preview.dataBase64.length > 1_400_000
    || !Number.isSafeInteger(preview.width) || !Number.isSafeInteger(preview.height)
    || preview.width < 1 || preview.height < 1 || preview.width > 1600 || preview.height > 1600
    || preview.width * preview.height > 1_000_000) {
    throw new ReportDocumentValidationError(`Selected evidence ${asset.id} has invalid frozen preview`);
  }
}

export function projectReportDocument(input: { reportDraft: unknown; assets?: ReportProjectionAsset[] }): ReportDocumentModel {
  const draft = normalizeReportDraft(input.reportDraft);
  const fields = draft.fieldDefinitions
    .map(definition => ({ key: definition.key, label: definition.label, type: definition.type, value: draft.fields[definition.key] }))
    .filter((field): field is ReportDocumentModel["fields"][number] => field.value !== undefined && field.value !== "" && (!Array.isArray(field.value) || field.value.length > 0));
  const selected = new Set(draft.evidenceAssetIds);
  const template = getReportTemplate(draft.templateId);
  const evidence = (input.assets ?? []).filter(asset => selected.has(asset.id));
  for (const asset of evidence) assertFrozenEvidence(asset);
  return { schemaVersion: REPORT_SCHEMA_VERSION, template: { ...template, fields: draft.fieldDefinitions }, fields, evidence };
}

export function formatReportFieldValue(value: ReportFieldValue): string {
  return Array.isArray(value) ? value.join("\n") : String(value);
}

export function reportFieldValueToEditorString(value: ReportFieldValue | undefined): string {
  return value === undefined ? "" : Array.isArray(value) ? value.join("\n") : String(value);
}
