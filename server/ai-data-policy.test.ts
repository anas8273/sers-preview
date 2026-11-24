import { afterEach, describe, expect, it, vi } from "vitest";
import {
  AI_DATA_POLICY_OPERATOR_ENV_KEYS,
  AI_DATA_POLICY_VERSION,
  aiDataPolicyCapabilities,
  evaluateAiDataPolicy,
  redactAiSensitiveText,
  readAiDataPolicyApproval,
  sanitizeCvInput,
} from "./ai-data-policy";

afterEach(() => vi.unstubAllEnvs());

const approvedEnv = () => ({
  NODE_ENV: "test",
  SERS_AI_DATA_POLICY_ALLOW_FAKE: "1",
  SERS_AI_DATA_POLICY_APPROVED_VERSION: AI_DATA_POLICY_VERSION,
  SERS_AI_DATA_POLICY_SOURCE: "fake-test",
  SERS_AI_DATA_POLICY_PURPOSE: "synthetic-grade-image-test",
  SERS_AI_DATA_POLICY_PROVIDER: "manus-forge",
  SERS_AI_DATA_POLICY_REGION: "test-only",
  SERS_AI_DATA_POLICY_RETENTION: "test-only",
});

const confirmation = { policyVersion: AI_DATA_POLICY_VERSION, purpose: "synthetic-grade-image-test", acknowledged: true as const };

describe("versioned AI data policy", () => {
  it("redacts email, phone and obvious national IDs from narrative text", () => {
    const value = "تواصل مع a.person@example.com أو 0551234567، والهوية ١٢٣٤٥٦٧٨٩٠، دون تغيير بقية المسودة.";
    const redacted = redactAiSensitiveText(value)!;
    expect(redacted).not.toContain("a.person@example.com");
    expect(redacted).not.toContain("0551234567");
    expect(redacted).not.toContain("١٢٣٤٥٦٧٨٩٠");
    expect(redacted).toContain("بقية المسودة");
  });
  it("redacts Arabic and Persian digit phone strings without modifying the local source", () => {
    const source = "هاتف ٠٥٥١٢٣٤٥٦٧ أو ۰۵۵۱۲۳۴۵۶۷";
    const result = redactAiSensitiveText(source)!;
    expect(result).not.toContain("0551234567");
    expect(result).not.toContain("٠٥٥١٢٣٤٥٦٧");
    expect(result).not.toContain("۰۵۵۱۲۳۴۵۶۷");
    expect(source).toContain("٠٥٥١٢٣٤٥٦٧");
  });
  it("requires matching CV API consent before returning any provider input", () => {
    const input = { fullName: "اسم خاص", jobTitle: "معلم", experience: "اسم خاص يراجع المسودة" };
    const missing = evaluateAiDataPolicy("generateCV", input, {});
    expect(missing.allowed).toBe(false); expect(missing.sanitizedInput).toBeUndefined();
    const stale = evaluateAiDataPolicy("generateCV", { ...input, privacyConfirmation: { ...confirmation, purpose: "draft-cv-wording", policyVersion: "old-policy" } }, {});
    expect(stale.allowed).toBe(false);
    const allowed = evaluateAiDataPolicy("generateCV", { ...input, privacyConfirmation: { ...confirmation, purpose: "draft-cv-wording" } }, {});
    expect(allowed.allowed).toBe(true);
    expect(JSON.stringify(allowed.sanitizedInput)).not.toContain("اسم خاص");
  });
  it("bounds prepared text after repeated identity replacement", () => {
    const result = evaluateAiDataPolicy("generateCV", { name: "ا", jobTitle: "معلم", experience: "ا".repeat(8000),
      privacyConfirmation: { ...confirmation, purpose: "draft-cv-wording" } }, {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("prepared_input_too_large");
    expect(result.sanitizedInput).toBeUndefined();
  });

  it("keeps CV identity local and sends only minimized drafting context", () => {
    const result = sanitizeCvInput({
      name: "معلم سري", fullName: "معلم سري", email: "teacher@example.com", phone: "0551234567",
      jobTitle: "معلم", experience: "خبرة واتصل 0551234567", additionalInfo: "الهوية 1234567890 والبريد teacher@example.com",
    });
    expect(result).toMatchObject({ identity: "[الهوية محجوبة محليًا]", jobTitle: "معلم" });
    expect(JSON.stringify(result)).not.toContain("معلم سري");
    expect(JSON.stringify(result)).not.toContain("teacher@example.com");
    expect(JSON.stringify(result)).not.toContain("0551234567");
    expect(JSON.stringify(result)).not.toContain("1234567890");
    expect(result).not.toHaveProperty("email");
    expect(result).not.toHaveProperty("phone");
  });

  it("denies student-sheet processing before any reservation without operator approval", () => {
    const result = evaluateAiDataPolicy("extractGradesFromImage", { imageData: "data:image/png;base64,synthetic", maxScore: 100, privacyConfirmation: confirmation }, {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("operator_policy_required");
    expect(result.sanitizedInput).toBeUndefined();
    expect(result.auditMetadata).toMatchObject({ operation: "extractGradesFromImage", decision: "deny", policyVersion: AI_DATA_POLICY_VERSION });
  });

  it("allows a bounded fake fixture only when approval and user confirmation match", () => {
    const env = approvedEnv();
    const allowed = evaluateAiDataPolicy("extractGradesFromImage", { imageData: "data:image/png;base64,synthetic", maxScore: 100, privacyConfirmation: confirmation }, env);
    expect(allowed.allowed).toBe(true);
    expect(allowed.sanitizedInput).toEqual({ imageData: "data:image/png;base64,synthetic", maxScore: 100 });
    const denied = evaluateAiDataPolicy("extractGradesFromImage", { imageData: "data:image/png;base64,synthetic", maxScore: 100, privacyConfirmation: { ...confirmation, purpose: "different-purpose" } }, env);
    expect(denied.allowed).toBe(false);
    expect(denied.reason).toBe("confirmation_mismatch");
  });

  it("denies classifier images before approval and keeps the image out of the prepared provider input", () => {
    const result = evaluateAiDataPolicy("classifyEvidence", {
      criteriaList: [{ id: "std-1", title: "معيار", subEvidences: [{ id: "item-1", title: "مؤشر" }] }],
      fileUrl: "data:image/png;base64,synthetic",
      description: "صورة طالب 0551234567",
      privacyConfirmation: confirmation,
    }, {});
    expect(result.allowed).toBe(false);
    expect(result.reason).toBe("operator_policy_required");
    expect(result.sanitizedInput).toBeUndefined();
    expect(result.auditMetadata.dataClasses).toContain("potential-student-record-image");
  });

  it("allows a classifier image only when the declared approval purpose and acknowledgement match", () => {
    const env = approvedEnv();
    const input = {
      criteriaList: [{ id: "std-1", title: "معيار", subEvidences: [{ id: "item-1", title: "مؤشر" }] }],
      fileUrl: "data:image/png;base64,synthetic",
      description: "صورة طالب 0551234567",
      fileName: "سجل_0551234567.png",
      privacyConfirmation: confirmation,
    };
    const result = evaluateAiDataPolicy("classifyEvidence", input, env);
    expect(result.allowed).toBe(true);
    expect((result.sanitizedInput as any).fileUrl).toBe(input.fileUrl);
    expect(JSON.stringify(result.sanitizedInput)).not.toContain("0551234567");
    expect((result.sanitizedInput as any).criteriaList[0].id).toBe("std-1");
    expect(input.description).toContain("0551234567");
  });

  it("keeps text classification available while minimizing identifiers and private link parts", () => {
    const result = evaluateAiDataPolicy("classifyEvidence", {
      criteriaList: [{ id: "std-1", title: "معيار", subEvidences: [{ id: "item-1", title: "مؤشر" }] }],
      description: "راسل a.person@example.com أو 0551234567، والهوية 1234567890",
      linkUrl: "https://example.invalid/private?token=secret#student",
    }, {});
    expect(result.allowed).toBe(true);
    expect(JSON.stringify(result.sanitizedInput)).not.toContain("a.person@example.com");
    expect(JSON.stringify(result.sanitizedInput)).not.toContain("0551234567");
    expect(JSON.stringify(result.sanitizedInput)).not.toContain("1234567890");
    expect((result.sanitizedInput as any).linkUrl).toBe("https://example.invalid");
  });

  it("exposes only non-secret capability metadata", () => {
    const env = { ...approvedEnv(), SERS_AI_DATA_POLICY_REGION: "PRIVATE_REGION_SECRET", BUILT_IN_FORGE_API_KEY: "PRIVATE_KEY_SECRET" };
    const metadata = aiDataPolicyCapabilities(env);
    expect(metadata.version).toBe(AI_DATA_POLICY_VERSION);
    expect(metadata.operations.extractGradesFromImage.available).toBe(true);
    expect(metadata.operations.classifyEvidence.imageAvailable).toBe(true);
    expect(metadata.operations.classifyEvidence.textAvailable).toBe(true);
    expect(metadata.operations.classifyEvidence.blockedImageStatus).toContain("النص");
    expect(JSON.stringify(metadata)).not.toContain("PRIVATE_REGION_SECRET");
    expect(JSON.stringify(metadata)).not.toContain("PRIVATE_KEY_SECRET");
    expect(AI_DATA_POLICY_OPERATOR_ENV_KEYS).toHaveLength(6);
    expect(readAiDataPolicyApproval(env)?.provider).toBe("manus-forge");
  });
});
