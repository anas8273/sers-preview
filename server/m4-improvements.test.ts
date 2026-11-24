import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildReportIdentityDefaults,
  extractSchoolNameFromDepartment,
  formatBeneficiaryPlural,
  formatEducatorRoleLabel,
  normalizeEducatorGender,
  normalizeEducatorRoleKey,
  type EducatorRoleKey,
} from "../shared/arabic-grammar";
import { evaluateWorkReadiness } from "../shared/evidence-readiness";
import { REPORT_IDENTITY_TEXT_LIMIT } from "../shared/report-appearance";

describe("IMP-1: shared/arabic-grammar helpers", () => {
  it("formats all educator role labels accurately for male and female", () => {
    const expected: Record<EducatorRoleKey, { male: string; female: string }> = {
      teacher: { male: "معلم", female: "معلمة" },
      principal: { male: "قائد مدرسة", female: "قائدة مدرسة" },
      vice_principal: { male: "وكيل مدرسة", female: "وكيلة مدرسة" },
      counselor: { male: "موجه طلابي", female: "موجهة طلابية" },
    };

    for (const [role, labels] of Object.entries(expected) as [EducatorRoleKey, { male: string; female: string }][]) {
      expect(formatEducatorRoleLabel(role, "male")).toBe(labels.male);
      expect(formatEducatorRoleLabel(role, "female")).toBe(labels.female);
    }
  });

  it("formats beneficiary plural and normalizes legacy/unknown values safely", () => {
    expect(formatBeneficiaryPlural("male")).toBe("الطلاب");
    expect(formatBeneficiaryPlural("female")).toBe("الطالبات");
    expect(normalizeEducatorGender(undefined)).toBe("male");
    expect(normalizeEducatorGender("other")).toBe("male");
    expect(normalizeEducatorGender("female")).toBe("female");
    expect(normalizeEducatorRoleKey(undefined)).toBe("teacher");
    expect(normalizeEducatorRoleKey("unknown_role")).toBe("teacher");
    expect(normalizeEducatorRoleKey("counselor")).toBe("counselor");
  });

  it("extracts school name from department text while ignoring default placeholders", () => {
    expect(
      extractSchoolNameFromDepartment(
        "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة...\nمدرسة...",
      ),
    ).toBe("");
    expect(
      extractSchoolNameFromDepartment(
        "المملكة العربية السعودية\nوزارة التعليم\nإدارة تعليم الرياض\nثانوية الرواد الأولى",
      ),
    ).toBe("ثانوية الرواد الأولى");
  });

  it("builds report identity defaults without overwriting manual fields and respects max length", () => {
    const filled = buildReportIdentityDefaults({
      organizationName: "متوسطة اليرموك",
      department: "مدرسة بديلة",
      fullName: "سارة العتيبي",
      principalName: "نورة الدوسري",
      gender: "female",
      roleKey: "teacher",
    });

    expect(filled).toEqual({
      schoolName: "متوسطة اليرموك",
      reportPreparer: "سارة العتيبي — معلمة",
      schoolPrincipal: "نورة الدوسري",
    });

    const preserved = buildReportIdentityDefaults({
      organizationName: "متوسطة اليرموك",
      fullName: "سارة العتيبي",
      principalName: "نورة الدوسري",
      gender: "female",
      roleKey: "teacher",
      existing: {
        schoolName: "مدرسة يدوية",
        reportPreparer: "معد مخصص",
        schoolPrincipal: "مدير مخصص",
      },
    });

    expect(preserved).toEqual({});

    const truncated = buildReportIdentityDefaults({
      organizationName: "أ".repeat(REPORT_IDENTITY_TEXT_LIMIT + 30),
      fullName: "ب".repeat(REPORT_IDENTITY_TEXT_LIMIT + 30),
      principalName: "ج".repeat(REPORT_IDENTITY_TEXT_LIMIT + 30),
      gender: "male",
      roleKey: "principal",
    });

    expect(truncated.schoolName?.length).toBe(REPORT_IDENTITY_TEXT_LIMIT);
    expect(truncated.reportPreparer?.length).toBe(REPORT_IDENTITY_TEXT_LIMIT);
    expect(truncated.schoolPrincipal?.length).toBe(REPORT_IDENTITY_TEXT_LIMIT);
  });
});

describe("IMP-2: shared/evidence-readiness analyzer", () => {
  it("reports ready status when verified file asset, academic context, and content exist", () => {
    const result = evaluateWorkReadiness({
      workType: "report",
      linkedAssets: [
        { id: 1, kind: "file", title: "محضر التنفيذ.pdf" },
        { id: 2, kind: "link", title: "رابط إضافي" },
      ],
      hasAcademicContext: true,
      hasSubstantiveContent: true,
      versionCount: 1,
      linkedStandardsCount: 2,
    });

    expect(result.status).toBe("ready");
    expect(result.proofBadge).toBe("شاهد أصلي موثّق");
    expect(result.verifiedFileCount).toBe(1);
    expect(result.supportingAssetCount).toBe(1);
    expect(result.missingItems).toEqual([]);
    expect(result.checks.find(c => c.key === "standardsLinkage")?.status).toBe("pass");
  });

  it("distinguishes supporting links/text without a verified file from zero-asset drafts", () => {
    const linkOnly = evaluateWorkReadiness({
      workType: "report",
      linkedAssets: [{ id: 3, kind: "text", title: "وصف نصي" }],
      hasAcademicContext: true,
      hasSubstantiveContent: true,
    });

    expect(linkOnly.status).toBe("needs_attention");
    expect(linkOnly.proofBadge).toBe("شواهد مساعدة بدون ملف مرفق");
    expect(linkOnly.missingItems.length).toBe(1);

    const noAssets = evaluateWorkReadiness({
      workType: "portfolio",
      linkedAssets: [],
      hasAcademicContext: false,
      hasSubstantiveContent: false,
    });

    expect(noAssets.status).toBe("incomplete");
    expect(noAssets.proofBadge).toBe("مسودة نصية بدون شاهد مرفق");
    expect(noAssets.missingItems.length).toBe(3);
  });

  it("treats missing academic context as needs_attention and standards linkage as optional advisory", () => {
    const result = evaluateWorkReadiness({
      workType: "report",
      linkedAssets: [{ id: 9, kind: "file", title: "صورة النشاط.png" }],
      hasAcademicContext: false,
      hasSubstantiveContent: true,
      linkedStandardsCount: 0,
    });

    expect(result.status).toBe("needs_attention");
    expect(result.checks.find(c => c.key === "academicContext")?.status).toBe("warn");
    const standardsCheck = result.checks.find(c => c.key === "standardsLinkage");
    expect(standardsCheck?.optional).toBe(true);
    expect(standardsCheck?.status).toBe("advisory");

    const readyWithoutStandards = evaluateWorkReadiness({
      workType: "report",
      linkedAssets: [{ id: 9, kind: "file", title: "صورة النشاط.png" }],
      hasAcademicContext: true,
      hasSubstantiveContent: true,
      linkedStandardsCount: 0,
    });
    expect(readyWithoutStandards.status).toBe("ready");
  });
});

describe("IMP-1, IMP-2, IMP-3 UI wiring & O008/R4 guardrails", () => {
  it("wires arabic-grammar into userStore, AccountHub, and WorkReportEditor", () => {
    const userStore = readFileSync(resolve("client/src/stores/userStore.ts"), "utf8");
    const accountHub = readFileSync(resolve("client/src/pages/AccountHub.tsx"), "utf8");
    const reportEditor = readFileSync(resolve("client/src/pages/WorkReportEditor.tsx"), "utf8");

    expect(userStore).toContain("normalizeEducatorGender");
    expect(userStore).toContain("normalizeEducatorRoleKey");
    expect(userStore).toContain("merge:");
    expect(accountHub).toContain("formatEducatorRoleLabel");
    expect(accountHub).toContain("formatBeneficiaryPlural");
    expect(reportEditor).toContain("buildReportIdentityDefaults");
  });

  it("wires evaluateWorkReadiness non-blockingly into WorkDetail", () => {
    const workDetail = readFileSync(resolve("client/src/pages/WorkDetail.tsx"), "utf8");
    expect(workDetail).toContain("evaluateWorkReadiness");
    expect(workDetail).toContain("فحص جاهزية الشواهد قبل التقديم");
  });

  it("provides printable A4 QR card dialog without weakening O008 or leaking internal fields", () => {
    const printQr = readFileSync(resolve("client/src/components/PrintQrCardDialog.tsx"), "utf8");
    expect(printQr).toContain("QRCode.toDataURL");
    expect(printQr).toContain("window.print()");
    expect(printQr).not.toContain("dangerouslySetInnerHTML");
    expect(printQr).not.toContain("localStorage");
    expect(printQr).not.toContain("sessionStorage");
    expect(printQr).not.toContain("storageKey");
    expect(printQr).not.toContain("ownerOrganizationId");
    expect(printQr).not.toContain("ownerUserId");
  });
});
