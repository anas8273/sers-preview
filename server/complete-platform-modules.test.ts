import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computeSelfEvaluationSummary,
  normalizeSelfEvaluationDraft,
  SELF_EVALUATION_DOMAINS,
  SELF_EVALUATION_FRAMEWORK_ID,
  SELF_EVALUATION_FRAMEWORK_META,
  SELF_EVALUATION_INDICATORS,
  SelfEvaluationValidationError,
} from "../shared/self-evaluation";
import { normalizeReportDraft } from "../shared/report-projection";
import { sanitizeCopiedDraftForPersonalScope } from "./domain-db";
import { evaluateReviewReassignEligibility } from "./review-output-db";
import { buildSanitizedAccountExportBundle } from "./account-db";
import { getCommerceProviderStatus, verifyWebhookHmacSha256 } from "./commerce-sandbox";

describe("R09 / O009 (OPEN): guided School Self-Evaluation & Improvement Plan engine", () => {
  it("is explicitly labelled unofficial, claims no official weights, and defines 4 domains x 3 guided indicators", () => {
    expect(SELF_EVALUATION_FRAMEWORK_META.status).toBe("guided_unofficial");
    expect(SELF_EVALUATION_FRAMEWORK_META.pendingDecision).toBe("O009");
    expect(SELF_EVALUATION_FRAMEWORK_ID).not.toMatch(/etec/i);
    expect(SELF_EVALUATION_DOMAINS).toHaveLength(4);
    for (const domain of SELF_EVALUATION_DOMAINS) {
      expect(domain).not.toHaveProperty("weightPercent");
    }
    expect(SELF_EVALUATION_INDICATORS).toHaveLength(12);
    for (const domain of SELF_EVALUATION_DOMAINS) {
      expect(SELF_EVALUATION_INDICATORS.filter(i => i.domainKey === domain.key)).toHaveLength(3);
    }
  });

  it("rejects rated indicators lacking mandatory factual rationale in strict mode", () => {
    expect(() =>
      normalizeSelfEvaluationDraft(
        {
          revision: 1,
          assessments: {
            "admin.planning": {
              indicatorKey: "admin.planning",
              level: 3,
              rationale: "   ",
              evidenceAssetIds: [],
            },
          },
          improvementActions: [],
        },
        { strictValidation: true },
      ),
    ).toThrow(SelfEvaluationValidationError);
  });

  it("computes domain averages, unweighted readiness %, and uncovered priority gaps (levels 1-2)", () => {
    const draft = normalizeSelfEvaluationDraft(
      {
        revision: 2,
        executiveSummary: "تركيز التحسين على نواتج التعلم والتخطيط التشغيلي.",
        assessments: {
          "admin.planning": {
            indicatorKey: "admin.planning",
            level: 2,
            rationale: "توجد خطة تشغيلية أولية لكن متابعة المؤشرات الشهرية غير مكتملة.",
            evidenceAssetIds: [10, 10, 12],
          },
          "outcomes.achievement": {
            indicatorKey: "outcomes.achievement",
            level: 1,
            rationale: "نتائج الاختبارات التشخيصية تظهر حاجة ماسة لخطة علاجية في المهارات الأساسية.",
            evidenceAssetIds: [],
          },
          "teaching.planning": {
            indicatorKey: "teaching.planning",
            level: 4,
            rationale: "تطبيق منتظم لاستراتيجيات التعلم النشط ومراعاة الفروق الفردية بشواهد موثقة.",
            evidenceAssetIds: [15],
          },
        },
        improvementActions: [
          {
            id: "act-1",
            indicatorKey: "admin.planning",
            goal: "انتظام متابعة الخطة التشغيلية شهريًا",
            action: "عقد اجتماع مراجعة شهري للجنة التميز وتوثيق نسب الإنجاز",
            ownerName: "وكيل الجودة",
            dueDate: "2026-12-15",
            status: "in_progress",
            linkedWorkItemId: 77,
          },
        ],
      },
      { strictValidation: true },
    );

    expect(draft.frameworkId).toBe(SELF_EVALUATION_FRAMEWORK_ID);
    expect(draft.assessments["admin.planning"]?.evidenceAssetIds).toEqual([10, 12]);

    const summary = computeSelfEvaluationSummary(draft);
    expect(summary.ratedIndicators).toBe(3);
    expect(summary.totalIndicators).toBe(12);
    expect(summary.gapIndicatorKeys).toEqual(["admin.planning", "outcomes.achievement"]);
    // admin.planning is covered by act-1; outcomes.achievement has no action yet!
    expect(summary.uncoveredGapIndicatorKeys).toEqual(["outcomes.achievement"]);
    expect(summary.actionCounts).toEqual({
      total: 1,
      planned: 0,
      in_progress: 1,
      completed: 0,
      linkedWorks: 1,
    });
  });
});

describe("O002: Pending Review Reassignment & Delegation policy", () => {
  it("allows school owner/admin or active requester to reassign a pending review to another eligible reviewer", () => {
    expect(
      evaluateReviewReassignEligibility({
        reviewStatus: "pending",
        actorUserId: 99,
        actorOrgRole: "admin",
        requestedByUserId: 10,
        versionCreatorUserId: 10,
        currentReviewerUserId: 20,
        targetReviewerUserId: 30,
        targetReviewerOrgRole: "reviewer",
        targetReviewerStatus: "active",
      }),
    ).toEqual({ ok: true });

    expect(
      evaluateReviewReassignEligibility({
        reviewStatus: "pending",
        actorUserId: 10,
        actorOrgRole: "member",
        requestedByUserId: 10,
        versionCreatorUserId: 10,
        currentReviewerUserId: 20,
        targetReviewerUserId: 30,
        targetReviewerOrgRole: "owner",
        targetReviewerStatus: "active",
      }),
    ).toEqual({ ok: true });
  });

  it("blocks self-review reassignment (BR01), non-pending reviews, suspended targets, and unauthorized members", () => {
    // Prevent assigning version creator / requester as reviewer even when admin reassigns
    const selfReviewAttempt = evaluateReviewReassignEligibility({
      reviewStatus: "pending",
      actorUserId: 99,
      actorOrgRole: "owner",
      requestedByUserId: 10,
      versionCreatorUserId: 10,
      currentReviewerUserId: 20,
      targetReviewerUserId: 10,
      targetReviewerOrgRole: "reviewer",
      targetReviewerStatus: "active",
    });
    expect(selfReviewAttempt.ok).toBe(false);
    if (!selfReviewAttempt.ok) expect(selfReviewAttempt.code).toBe("bad_request");

    // Non-pending review cannot be reassigned
    const decidedAttempt = evaluateReviewReassignEligibility({
      reviewStatus: "approved",
      actorUserId: 99,
      actorOrgRole: "owner",
      requestedByUserId: 10,
      versionCreatorUserId: 10,
      currentReviewerUserId: 20,
      targetReviewerUserId: 30,
      targetReviewerOrgRole: "reviewer",
      targetReviewerStatus: "active",
    });
    expect(decidedAttempt).toMatchObject({ ok: false, code: "conflict" });

    // Unrelated ordinary member cannot reassign someone else's review
    const unrelatedMemberAttempt = evaluateReviewReassignEligibility({
      reviewStatus: "pending",
      actorUserId: 55,
      actorOrgRole: "member",
      requestedByUserId: 10,
      versionCreatorUserId: 10,
      currentReviewerUserId: 20,
      targetReviewerUserId: 30,
      targetReviewerOrgRole: "reviewer",
      targetReviewerStatus: "active",
    });
    expect(unrelatedMemberAttempt).toMatchObject({ ok: false, code: "forbidden" });

    // Suspended or non-reviewer target rejected
    const suspendedTargetAttempt = evaluateReviewReassignEligibility({
      reviewStatus: "pending",
      actorUserId: 99,
      actorOrgRole: "owner",
      requestedByUserId: 10,
      versionCreatorUserId: 10,
      currentReviewerUserId: 20,
      targetReviewerUserId: 30,
      targetReviewerOrgRole: "reviewer",
      targetReviewerStatus: "suspended",
    });
    expect(suspendedTargetAttempt).toMatchObject({ ok: false, code: "bad_request" });
  });
});

describe("O003: Educator Work Copy-to-Personal tenant isolation", () => {
  it("preserves report structure and preparer while stripping school logo, school identity, and org evidence IDs", () => {
    const validPngBase64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const sourceV2 = normalizeReportDraft({
      schemaVersion: 1,
      templateId: "program-report",
      themeId: "formal",
      fontFamily: "Cairo",
      fields: {
        subject: "برنامج الأسبوع التمهيدي",
        objectives: "تهيئة الطلاب المستجدين",
      },
      evidenceAssetIds: [501, 502],
      reportIdentity: {
        version: "1",
        schoolName: "مدرسة النخبة النموذجية",
        reportPreparer: "أ. سارة القحطاني",
        schoolPrincipal: "أ. نورة العتيبي",
        ministryLogo: true,
        schoolLogoPng: validPngBase64,
      },
    });

    const sanitized = sanitizeCopiedDraftForPersonalScope("report", {
      ...sourceV2,
      revision: 8,
    });

    expect(sanitized).toBeDefined();
    expect(sanitized?.blockType).toBe("report_document");
    expect(sanitized?.data.revision).toBe(1);
    expect(sanitized?.data.evidenceAssetIds).toEqual([]);
    expect((sanitized?.data.fields as Record<string, unknown>).subject).toBe("برنامج الأسبوع التمهيدي");
    expect(sanitized?.data.reportIdentity).toEqual({
      version: "1",
      reportPreparer: "أ. سارة القحطاني",
    });
    // Must re-normalize cleanly as a v2 report draft on subsequent edits!
    const roundTrip = normalizeReportDraft(sanitized?.data);
    expect(roundTrip.schemaVersion).toBe(2);
    expect(roundTrip.reportIdentity?.schoolName).toBeUndefined();
    expect(roundTrip.reportIdentity?.schoolLogoPng).toBeUndefined();
  });

  it("preserves portfolio introduction while clearing organization-scoped entries", () => {
    const sanitized = sanitizeCopiedDraftForPersonalScope("portfolio", {
      schemaVersion: 1,
      revision: 4,
      introduction: "مقدمة ملف الإنجاز المهني",
      entries: [{ kind: "asset", refId: 900, sectionTitle: "شواهد المدرسة" }],
    });
    expect(sanitized?.blockType).toBe("portfolio_document");
    expect(sanitized?.data.revision).toBe(1);
    expect(sanitized?.data.introduction).toBe("مقدمة ملف الإنجاز المهني");
    expect(sanitized?.data.entries).toEqual([]);
  });
});

describe("R18 & O001: Personal Account Data Export redaction & Payment Provider safety", () => {
  it("exports personal-owned data while redacting openId, private storageKey, and unsafe URLs", () => {
    const bundle = buildSanitizedAccountExportBundle({
      exportedAt: "2026-11-25T00:00:00.000Z",
      user: {
        id: 7,
        name: "أنس",
        email: "anas@example.com",
        openId: "secret-oauth-openid-token",
        createdAt: new Date("2026-01-10T08:00:00.000Z"),
      },
      schools: [{ id: 3, name: "مدرسة الفيصل", role: "owner", status: "active" }],
      years: [
        {
          id: 1,
          label: "1448هـ",
          startsOn: "2026-08-20",
          endsOn: "2027-06-20",
          terms: [{ label: "الفصل الأول", ordinal: 1, startsOn: "2026-08-20", endsOn: "2026-11-20" }],
        },
      ],
      works: [
        {
          id: 42,
          type: "report",
          title: "تقرير شخصي",
          status: "draft",
          currentVersionNumber: 1,
          academicContext: null,
          blocks: [{ blockType: "report_document", sortOrder: 0, data: { schemaVersion: 2 } }],
        },
      ],
      assets: [
        {
          id: 100,
          kind: "file",
          title: "شاهد ملف",
          mimeType: "application/pdf",
          fileSize: 2048,
          externalUrl: "javascript:alert(1)",
          metadata: { internalSecret: "hidden" },
          storageKey: "private/uploads/7/secret-path.pdf",
          linkedStandards: [{ standardKey: "teacher-1", version: "2026", title: "أداء الواجبات", note: null }],
        },
      ],
    });

    const serialized = JSON.stringify(bundle);
    expect(serialized).not.toContain("secret-oauth-openid-token");
    expect(serialized).not.toContain("private/uploads/7/secret-path.pdf");
    expect(serialized).not.toContain("javascript:alert");
    expect(serialized).not.toContain("internalSecret");
    expect(bundle.scopePolicy).toBe("personal_owned_only");
    expect(bundle.personalWorks).toHaveLength(1);
    expect(bundle.personalAssets[0]?.linkedStandards[0]?.standardKey).toBe("teacher-1");
  });

  it("verifies HMAC-SHA256 webhook signatures in constant time and keeps live payments disabled (O001/R5)", () => {
    const payload = Buffer.from(JSON.stringify({ idempotencyKey: "ord_123", state: "paid" }), "utf8");
    const secret = "whsec_test_secret_2026";
    const validSig = createHmac("sha256", secret).update(payload).digest("hex");

    expect(verifyWebhookHmacSha256(payload, secret, validSig)).toBe(true);
    expect(verifyWebhookHmacSha256(payload, secret, `sha256=${validSig}`)).toBe(true);
    expect(verifyWebhookHmacSha256(payload, secret, "0".repeat(64))).toBe(false);
    expect(verifyWebhookHmacSha256(payload, "wrong_secret", validSig)).toBe(false);

    expect(getCommerceProviderStatus({ NODE_ENV: "production", SERS_COMMERCE_SANDBOX: "1" })).toEqual({
      mode: "disabled",
      currency: "SAR",
      vatRatePercent: 15,
      livePaymentsAllowed: false,
    });
    expect(getCommerceProviderStatus({ NODE_ENV: "development", SERS_COMMERCE_SANDBOX: "1" })).toEqual({
      mode: "sandbox",
      currency: "SAR",
      vatRatePercent: 15,
      livePaymentsAllowed: false,
    });
  });

  it("wires /self-evaluation route and O008 governance notice in UI sources", () => {
    const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
    const shareSource = readFileSync(resolve(process.cwd(), "client/src/components/ReportShareActions.tsx"), "utf8");
    expect(appSource).toContain('path={"/self-evaluation"}');
    expect(shareSource).toContain("اعتماد مؤسسي داخلي");
  });
});
