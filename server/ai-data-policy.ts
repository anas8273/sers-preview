import { AI_PROVIDER_ID } from "./ai-provider-policy";
import type { AiOperation } from "./ai-policy";
import { isReportIdentityFieldKey } from "../shared/report-appearance";

/**
 * This is a processing gate, not a claim about a provider's legal status,
 * tenancy authority, training use, region, or retention. Those facts must be
 * supplied by an operator and are intentionally not exposed to the client.
 */
export const AI_DATA_POLICY_VERSION = "ai-data-minimization-v1" as const;
const REDACTED_IDENTITY = "[الهوية محجوبة محليًا]";
const REDACTED_SENSITIVE_VALUE = "[بيانات حساسة محجوبة]";
const MAX_PREPARED_CV_BYTES = 128_000;
const MAX_PREPARED_CLASSIFICATION_TEXT_BYTES = 60_000;
const MAX_PREPARED_TEXT_BYTES = 128_000;

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_RE = /(?<!\d)(?:\+?966[\s-]?5\d{8}|05\d{8}|(?:\+?\d[\d\s().-]?){10,14})(?!\d)/g;
const NATIONAL_ID_RE = /(?<![\d٠-٩])[12١٢][\d٠-٩]{9}(?![\d٠-٩])/g;

export type AiDataPolicyApproval = {
  version: string;
  source: string;
  purpose: string;
  provider: string;
  region: string;
  retention: string;
};

export type AiPrivacyConfirmation = {
  policyVersion: string;
  purpose: string;
  acknowledged: true;
};

type CvInput = {
  name?: string;
  fullName?: string;
  email?: string;
  phone?: string;
  jobTitle: string;
  experience?: string;
  education?: string;
  skills?: string;
  additional?: string;
  additionalInfo?: string;
  privacyConfirmation?: AiPrivacyConfirmation;
};

type ClassificationInput = {
  description?: string;
  fileName?: string;
  fileType?: string;
  fileUrl?: string;
  linkUrl?: string;
  jobId?: string;
  jobTitle?: string;
  criteriaList?: unknown;
  learningContext?: unknown;
  privacyConfirmation?: AiPrivacyConfirmation;
  [key: string]: unknown;
};

type GradeInput = {
  imageData: string;
  maxScore: number;
  privacyConfirmation?: AiPrivacyConfirmation;
};

const envValue = (env: NodeJS.ProcessEnv, key: string) => {
  const value = env[key];
  return typeof value === "string" && value.trim() ? value.trim() : "";
};

/** Remove obvious direct identifiers from narrative fields before provider I/O. */
export function redactAiSensitiveText(value: string | undefined | null): string | undefined {
  if (value === undefined || value === null) return undefined;
  return value
    .replace(/[٠-٩۰-۹]/g, digit => String(digit.charCodeAt(0) - (digit >= "۰" ? 0x06f0 : 0x0660)))
    .replace(EMAIL_RE, REDACTED_SENSITIVE_VALUE)
    .replace(PHONE_RE, REDACTED_SENSITIVE_VALUE)
    .replace(NATIONAL_ID_RE, REDACTED_SENSITIVE_VALUE);
}

/** Keep protocol/taxonomy values stable while minimizing only human text. */
function isProtocolValueKey(key: string | undefined) {
  if (!key) return false;
  return key === "id" || key.endsWith("Id") || key === "type" || key.endsWith("Type")
    || key === "questionTypes" || key === "standardNumber" || key === "indicatorIndex"
    || key === "subIndicatorIndex" || key === "maxScore" || key === "count";
}

/** Links are context only: the model does not fetch them, so never forward path/query/hash data. */
export function safeExternalLinkOrigin(value: string): string {
  try {
    const url = new URL(value);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return "[رابط خارجي محجوب]";
    return url.origin;
  } catch {
    return "[رابط خارجي محجوب]";
  }
}

/** Clone and minimize provider-bound text without mutating the caller's local evidence. */
export function sanitizeAiTextInput(value: unknown, key?: string): unknown {
  if (typeof value === "string") {
    if (key === "fileUrl") return value;
    if (key === "linkUrl") return safeExternalLinkOrigin(value);
    if (isProtocolValueKey(key)) return value;
    return redactAiSensitiveText(value) ?? value;
  }
  if (Array.isArray(value)) return value.map(item => sanitizeAiTextInput(item, key));
  if (value && typeof value === "object") {
    const output: Record<string, unknown> = {};
    for (const [childKey, childValue] of Object.entries(value)) {
      // Consent and institutional report identity/logos are never provider content.
      if (childKey === "privacyConfirmation" || childKey === "reportIdentity" || isReportIdentityFieldKey(childKey)) continue;
      output[childKey] = sanitizeAiTextInput(childValue, childKey);
    }
    return output;
  }
  return value;
}

function preparedTextBytes(value: unknown, omitKeys: string[] = []) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return Buffer.byteLength(JSON.stringify(value), "utf8");
  const copy = { ...(value as Record<string, unknown>) };
  for (const key of omitKeys) delete copy[key];
  return Buffer.byteLength(JSON.stringify(copy), "utf8");
}

/**
 * Keep identity in the local CV state. The provider receives only the minimum
 * drafting context, with direct identifiers removed from every narrative.
 */
export function sanitizeCvInput(input: CvInput) {
  const identities = [input.name, input.fullName, input.email, input.phone]
    .filter((value): value is string => typeof value === "string" && Boolean(value.trim()))
    .sort((a, b) => b.length - a.length);
  const minimize = (value?: string) => {
    if (value === undefined) return undefined;
    let narrative = value;
    for (const identity of identities) narrative = narrative.split(identity).join(REDACTED_SENSITIVE_VALUE);
    return redactAiSensitiveText(narrative);
  };
  const sanitized: Record<string, string> = {
    identity: REDACTED_IDENTITY,
    jobTitle: minimize(input.jobTitle) ?? "",
  };
  const values: Array<[string, string | undefined]> = [
    ["experience", minimize(input.experience)],
    ["education", minimize(input.education)],
    ["skills", minimize(input.skills)],
    ["additionalInfo", minimize(input.additionalInfo ?? input.additional)],
  ];
  for (const [key, value] of values) if (value?.trim()) sanitized[key] = value;
  return sanitized;
}

const requiredApprovalKeys = [
  "SERS_AI_DATA_POLICY_APPROVED_VERSION",
  "SERS_AI_DATA_POLICY_SOURCE",
  "SERS_AI_DATA_POLICY_PURPOSE",
  "SERS_AI_DATA_POLICY_PROVIDER",
  "SERS_AI_DATA_POLICY_REGION",
  "SERS_AI_DATA_POLICY_RETENTION",
] as const;

export function readAiDataPolicyApproval(env: NodeJS.ProcessEnv = process.env): AiDataPolicyApproval | null {
  const values = Object.fromEntries(requiredApprovalKeys.map(key => [key, envValue(env, key)]));
  if (requiredApprovalKeys.some(key => !values[key])) return null;
  if (values.SERS_AI_DATA_POLICY_APPROVED_VERSION !== AI_DATA_POLICY_VERSION) return null;
  if (values.SERS_AI_DATA_POLICY_PROVIDER !== AI_PROVIDER_ID) return null;
  return {
    version: values.SERS_AI_DATA_POLICY_APPROVED_VERSION,
    source: values.SERS_AI_DATA_POLICY_SOURCE,
    purpose: values.SERS_AI_DATA_POLICY_PURPOSE,
    provider: values.SERS_AI_DATA_POLICY_PROVIDER,
    region: values.SERS_AI_DATA_POLICY_REGION,
    retention: values.SERS_AI_DATA_POLICY_RETENTION,
  };
}

function fakePolicyAllowed(env: NodeJS.ProcessEnv) {
  // Test-only escape hatch. It cannot be enabled in production and still
  // requires the bounded, explicit approval fields above.
  return env.NODE_ENV === "test" && env.SERS_AI_DATA_POLICY_ALLOW_FAKE === "1";
}

function gradeApprovalMatches(input: GradeInput, env: NodeJS.ProcessEnv) {
  const approval = readAiDataPolicyApproval(env);
  const confirmation = input.privacyConfirmation;
  if (!approval || !confirmation) return false;
  if (confirmation.policyVersion !== approval.version || confirmation.purpose !== approval.purpose || confirmation.acknowledged !== true) return false;
  return !fakePolicyAllowed(env) || approval.source === "fake-test";
}

function classificationApprovalMatches(input: ClassificationInput, env: NodeJS.ProcessEnv) {
  const approval = readAiDataPolicyApproval(env);
  const confirmation = input.privacyConfirmation;
  if (!approval || !confirmation) return false;
  if (confirmation.policyVersion !== approval.version || confirmation.purpose !== approval.purpose || confirmation.acknowledged !== true) return false;
  return !fakePolicyAllowed(env) || approval.source === "fake-test";
}

export type AiDataPolicyDecision = {
  allowed: boolean;
  operation: AiOperation;
  policyVersion: typeof AI_DATA_POLICY_VERSION;
  reason?: "operator_policy_required" | "user_confirmation_required" | "confirmation_mismatch" | "prepared_input_too_large";
  sanitizedInput?: unknown;
  auditMetadata: {
    policyVersion: typeof AI_DATA_POLICY_VERSION;
    operation: AiOperation;
    dataClasses: string[];
    purpose: string;
    provider: string;
    decision: "allow" | "deny";
    redaction: "cv-direct-identifiers-and-narrative-patterns" | "text-patterns-and-private-link-origin" | "not-applied";
  };
};

export function evaluateAiDataPolicy(operation: AiOperation, input: unknown, env: NodeJS.ProcessEnv = process.env): AiDataPolicyDecision {
  if (operation === "generateCV") {
    const cv = input as CvInput;
    const confirmation = cv.privacyConfirmation;
    const confirmed = confirmation?.policyVersion === AI_DATA_POLICY_VERSION
      && confirmation.purpose === "draft-cv-wording" && confirmation.acknowledged === true;
    const prepared = confirmed ? sanitizeCvInput(cv) : undefined;
    const tooLarge = prepared !== undefined && Buffer.byteLength(JSON.stringify(prepared), "utf8") > MAX_PREPARED_CV_BYTES;
    const allowed = confirmed && !tooLarge;
    return {
      allowed,
      operation,
      policyVersion: AI_DATA_POLICY_VERSION,
      reason: allowed ? undefined : tooLarge ? "prepared_input_too_large" : confirmation ? "confirmation_mismatch" : "user_confirmation_required",
      sanitizedInput: allowed ? prepared : undefined,
      auditMetadata: {
        policyVersion: AI_DATA_POLICY_VERSION,
        operation,
        dataClasses: ["user-cv-draft"],
        purpose: "draft-cv-wording",
        provider: AI_PROVIDER_ID,
        decision: allowed ? "allow" : "deny",
        redaction: "cv-direct-identifiers-and-narrative-patterns",
      },
    };
  }

  if (operation === "extractGradesFromImage") {
    const grade = input as GradeInput;
    const approval = readAiDataPolicyApproval(env);
    const hasOperatorApproval = Boolean(approval);
    const hasConfirmation = Boolean(grade?.privacyConfirmation);
    const allowed = hasOperatorApproval && gradeApprovalMatches(grade, env);
    const reason = !hasOperatorApproval
      ? "operator_policy_required"
      : !hasConfirmation
        ? "user_confirmation_required"
        : allowed ? undefined : "confirmation_mismatch";
    return {
      allowed,
      operation,
      policyVersion: AI_DATA_POLICY_VERSION,
      reason,
      sanitizedInput: allowed ? { imageData: grade.imageData, maxScore: grade.maxScore } : undefined,
      auditMetadata: {
        policyVersion: AI_DATA_POLICY_VERSION,
        operation,
        dataClasses: ["student-record-image"],
        purpose: approval?.purpose || "student-grade-image-extraction",
        provider: AI_PROVIDER_ID,
        decision: allowed ? "allow" : "deny",
        redaction: "not-applied",
      },
    };
  }

  if (operation === "classifyEvidence") {
    const classification = input as ClassificationInput;
    const hasImage = typeof classification?.fileUrl === "string";
    const approval = hasImage ? readAiDataPolicyApproval(env) : null;
    const hasConfirmation = Boolean(classification?.privacyConfirmation);
    const prepared = sanitizeAiTextInput(classification) as ClassificationInput;
    // The image is bounded and validated independently; only plaintext context is counted here.
    const tooLarge = preparedTextBytes(prepared, ["fileUrl"]) > MAX_PREPARED_CLASSIFICATION_TEXT_BYTES;
    const imageApproved = !hasImage || (Boolean(approval) && classificationApprovalMatches(classification, env));
    const allowed = imageApproved && !tooLarge;
    const reason = hasImage && !approval
      ? "operator_policy_required"
      : hasImage && !hasConfirmation
        ? "user_confirmation_required"
        : !imageApproved
          ? "confirmation_mismatch"
          : tooLarge ? "prepared_input_too_large" : undefined;
    return {
      allowed,
      operation,
      policyVersion: AI_DATA_POLICY_VERSION,
      reason,
      sanitizedInput: allowed ? prepared : undefined,
      auditMetadata: {
        policyVersion: AI_DATA_POLICY_VERSION,
        operation,
        dataClasses: hasImage ? ["evidence-text-and-metadata", "potential-student-record-image"] : ["evidence-text-and-metadata"],
        purpose: approval?.purpose || "evidence-text-classification",
        provider: AI_PROVIDER_ID,
        decision: allowed ? "allow" : "deny",
        redaction: "text-patterns-and-private-link-origin",
      },
    };
  }

  const prepared = sanitizeAiTextInput(input);
  const tooLarge = preparedTextBytes(prepared) > MAX_PREPARED_TEXT_BYTES;
  const allowed = !tooLarge;
  return {
    allowed,
    operation,
    policyVersion: AI_DATA_POLICY_VERSION,
    reason: allowed ? undefined : "prepared_input_too_large",
    sanitizedInput: allowed ? prepared : undefined,
    auditMetadata: {
      policyVersion: AI_DATA_POLICY_VERSION,
      operation,
      dataClasses: ["user-provided-draft"],
      purpose: "educational-draft-assistance",
      provider: AI_PROVIDER_ID,
      decision: allowed ? "allow" : "deny",
      redaction: "text-patterns-and-private-link-origin",
    },
  };
}

/** Safe, read-only capability metadata for UI. Never returns environment values. */
export function aiDataPolicyCapabilities(env: NodeJS.ProcessEnv = process.env) {
  const gradeApproval = readAiDataPolicyApproval(env);
  return {
    version: AI_DATA_POLICY_VERSION,
    disclaimer: "هذه بوابة معالجة تقنية وليست إثبات امتثال أو سلطة مستأجر أو ضمانًا لسياسة المزود.",
    availabilityNote: "الحالة العامة للتشغيل تُقرأ من status.available؛ هذه البيانات تصف أهلية سياسة البيانات فقط.",
    operations: {
      generateCV: {
        available: true,
        requiresUserConfirmation: true,
        purpose: "draft-cv-wording",
        dataClasses: ["user-cv-draft"],
        fieldsSent: ["jobTitle", "experience", "education", "skills", "additionalInfo"],
        directIdentifiers: "kept-local-and-redacted",
        manualFallback: true,
      },
      classifyEvidence: {
        available: true,
        textAvailable: true,
        imageAvailable: Boolean(gradeApproval),
        requiresOperatorApprovalForImages: true,
        requiresUserConfirmationForImages: true,
        imagePolicyVersion: AI_DATA_POLICY_VERSION,
        imagePurpose: gradeApproval ? "operator-approved-purpose-not-exposed" : "operator policy approval required",
        dataClasses: ["evidence-text-and-metadata", "potential-student-record-image"],
        blockedImageStatus: "الصورة محجوبة حتى اعتماد السياسة وتأكيد الغرض؛ يتاح تصنيف النص أو المسار اليدوي.",
        fieldsSent: ["description", "fileName", "fileType", "criteriaList", "learningContext", "approved-fileUrl", "safe-link-origin"],
        manualFallback: true,
      },
      extractGradesFromImage: {
        available: Boolean(gradeApproval),
        requiresOperatorApproval: true,
        requiresUserConfirmation: true,
        policyVersion: AI_DATA_POLICY_VERSION,
        purpose: gradeApproval ? "operator-approved-purpose-not-exposed" : "operator policy approval required",
        dataClasses: ["student-record-image"],
        fieldsSent: ["student-grade-image", "maxScore"],
        manualFallback: true,
      },
    },
  } as const;
}

export const AI_DATA_POLICY_OPERATOR_ENV_KEYS = requiredApprovalKeys;
