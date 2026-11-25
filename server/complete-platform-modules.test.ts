import { createHmac } from "node:crypto";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  classifyAccreditationBand,
  computeSelfEvaluationSummary,
  getApplicableIndicators,
  LEGACY_V1_INDICATOR_KEY_MAP,
  normalizeSelfEvaluationDraft,
  SELF_EVALUATION_DOMAINS,
  SELF_EVALUATION_FRAMEWORK_ID,
  SELF_EVALUATION_FRAMEWORK_META,
  SELF_EVALUATION_INDICATORS,
  SELF_EVALUATION_STANDARDS,
  SelfEvaluationValidationError,
} from "../shared/self-evaluation";
import { OFFICIAL_SAUDI_STANDARD_SEEDS } from "../shared/saudi-standards-packs";
import { normalizeReportDraft } from "../shared/report-projection";
import { sanitizeCopiedDraftForPersonalScope, WorkCopyValidationError } from "./domain-db";
import { evaluateReviewReassignEligibility } from "./review-output-db";
import { buildSanitizedAccountExportBundle } from "./account-db";
import { getCommerceProviderStatus, verifyWebhookHmacSha256 } from "./commerce-sandbox";

describe("R09 / O009 (ACCEPTED): Official ETEC («تميز») School Self-Evaluation & Improvement Plan engine", () => {
  it("defines the 4 official ETEC domains (25/35/25/15 = 100%), 10 standards, 48 gov indicators, and 51 private/international indicators", () => {
    expect(SELF_EVALUATION_FRAMEWORK_ID).toBe("etec-school-accreditation-2026-v2");
    expect(SELF_EVALUATION_FRAMEWORK_META.status).toBe("etec_aligned");
    expect(SELF_EVALUATION_FRAMEWORK_META.sourceNoteAr).toContain("منصة «تميز»");

    expect(SELF_EVALUATION_DOMAINS).toHaveLength(4);
    const domainWeights = SELF_EVALUATION_DOMAINS.map(d => d.weightPercent);
    expect(domainWeights).toEqual([25, 35, 25, 15]);
    expect(domainWeights.reduce((acc, w) => acc + w, 0)).toBe(100);

    expect(SELF_EVALUATION_STANDARDS).toHaveLength(10);
    expect(SELF_EVALUATION_INDICATORS).toHaveLength(51);
    expect(getApplicableIndicators("government")).toHaveLength(48);
    expect(getApplicableIndicators("private_international")).toHaveLength(51);

    // 3 private-only institutional governance/licensing indicators under 1-4
    const privateOnly = SELF_EVALUATION_INDICATORS.filter(i => i.applicableTo === "private_only");
    expect(privateOnly.map(i => i.code)).toEqual(["1-4-1-1", "1-4-1-2", "1-4-1-3"]);

    // Official ETEC 10-standard pack also registered in SmartEvidence standards seeds
    // without inventing unendorsed per-standard sub-weights (domain weights live on domainLabel)
    const etecStandardsPack = OFFICIAL_SAUDI_STANDARD_SEEDS.filter(
      s => s.packId === "etec-school-accreditation-10",
    );
    expect(etecStandardsPack).toHaveLength(10);
    expect(etecStandardsPack.every(s => s.weightPercent === undefined)).toBe(true);
  });

  it("rejects rated indicators lacking mandatory factual rationale in strict mode, while clearing incomplete private-only ratings when switched to government", () => {
    expect(() =>
      normalizeSelfEvaluationDraft(
        {
          revision: 1,
          assessments: {
            "1-1-1-1": {
              indicatorKey: "1-1-1-1",
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

    // Incomplete private-only indicator does not block saving after switching to government:
    const switchedToGov = normalizeSelfEvaluationDraft(
      {
        revision: 2,
        schoolCategory: "government",
        assessments: {
          "1-4-1-1": {
            indicatorKey: "1-4-1-1",
            level: 2,
            rationale: "",
            evidenceAssetIds: [],
          },
        },
        improvementActions: [],
      },
      { strictValidation: true },
    );
    expect(switchedToGov.assessments["1-4-1-1"]?.level).toBeNull();
  });

  it("migrates legacy v1 guided keys losslessly and computes ETEC domain-weighted readiness & accreditation bands", () => {
    expect(Object.keys(LEGACY_V1_INDICATOR_KEY_MAP)).toHaveLength(12);

    const draft = normalizeSelfEvaluationDraft(
      {
        revision: 2,
        schoolCategory: "government",
        executiveSummary: "تركيز التحسين على نواتج التعلم والتخطيط التشغيلي وفق مؤشرات تميز.",
        committeeMembers: [
          {
            id: "mem-1",
            userId: 12,
            name: "أ. خالد العتيبي",
            roleTitle: "رئيس فريق التقويم الذاتي",
            assignedDomainKey: "all",
          },
        ],
        assessments: {
          "admin.planning": {
            indicatorKey: "admin.planning",
            level: 2,
            rationale: "توجد خطة تشغيلية مكتملة العناصر وتجري متابعة مؤشراتها شهريًا.",
            evidenceAssetIds: [10, 10, 12],
          },
          "outcomes.achievement": {
            indicatorKey: "outcomes.achievement",
            level: 1,
            rationale: "نتائج الاختبارات الوطنية (نافس) في القراءة تظهر حاجة لخطة علاجية مركزة.",
            evidenceAssetIds: [],
          },
          "teaching.planning": {
            indicatorKey: "teaching.planning",
            level: 4,
            rationale: "تنويع منتظم لاستراتيجيات التدريس وفق خصائص المتعلمين بشواهد موثقة.",
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

    expect(draft.schemaVersion).toBe(2);
    expect(draft.frameworkId).toBe(SELF_EVALUATION_FRAMEWORK_ID);
    expect(draft.committeeMembers).toHaveLength(1);
    expect(draft.committeeMembers[0]?.name).toBe("أ. خالد العتيبي");
    // Legacy v1 keys transparently remapped to official ETEC procedural codes:
    expect(draft.assessments["1-1-1-1"]?.evidenceAssetIds).toEqual([10, 12]);
    expect(draft.assessments["3-1-1-1"]?.level).toBe(1);
    expect(draft.assessments["2-1-1-3"]?.level).toBe(4);
    expect(draft.improvementActions[0]?.indicatorKey).toBe("1-1-1-1");

    const summary = computeSelfEvaluationSummary(draft);
    expect(summary.schoolCategory).toBe("government");
    expect(summary.ratedIndicators).toBe(3);
    expect(summary.totalIndicators).toBe(48);
    expect(summary.gapIndicatorKeys).toEqual(["1-1-1-1", "3-1-1-1"]);
    // 1-1-1-1 is covered by act-1; 3-1-1-1 has no action yet!
    expect(summary.uncoveredGapIndicatorKeys).toEqual(["3-1-1-1"]);

    // Weighted calculation across the 3 rated domains:
    // admin (weight 25): level 2 -> 50%
    // teaching_learning (weight 35): level 4 -> 100%
    // learning_outcomes (weight 25): level 1 -> 25%
    // Weighted average across active rated weight (25+35+25=85):
    // (50*25 + 100*35 + 25*25) / 85 = (1250 + 3500 + 625) / 85 = 5375 / 85 ≈ 63% -> الانطلاق
    expect(summary.overallReadinessPercent).toBe(63);
    expect(summary.accreditationBandLabel).toBe("الانطلاق");

    expect(classifyAccreditationBand(null)).toBeNull();
    expect(classifyAccreditationBand(49)).toBe("التهيئة");
    expect(classifyAccreditationBand(50)).toBe("الانطلاق");
    expect(classifyAccreditationBand(75)).toBe("التقدم");
    expect(classifyAccreditationBand(90)).toBe("التميز");

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

    expect(() =>
      sanitizeCopiedDraftForPersonalScope("portfolio", {
        schemaVersion: 1,
        revision: 1,
        introduction: "أ".repeat(6000),
        entries: [],
      }),
    ).toThrow(WorkCopyValidationError);
  });
});

describe("R18 & O001: Personal Account Data Export redaction & Payment Provider safety", () => {
  it("exports personal-owned data while redacting openId, private storageKey, schoolLogoPng, and unsafe URLs", () => {
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
          linkedAssetIds: [100],
          blocks: [
            {
              blockType: "report_document",
              sortOrder: 0,
              data: {
                schemaVersion: 2,
                reportIdentity: { schoolName: "مدرستي", schoolLogoPng: "BASE64_LOGO_SECRET" },
              },
            },
          ],
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
    expect(serialized).not.toContain("BASE64_LOGO_SECRET");
    expect(bundle.scopePolicy).toBe("personal_owned_only");
    expect(bundle.personalWorks).toHaveLength(1);
    expect(bundle.personalWorks[0]?.linkedAssetIds).toEqual([100]);
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
    expect(verifyWebhookHmacSha256(payload.toString("utf8") as unknown as Buffer, secret, validSig)).toBe(false);

    const ts = 1_764_000_000;
    const tsSig = createHmac("sha256", secret)
      .update(Buffer.concat([Buffer.from(`${ts}.`, "utf8"), payload]))
      .digest("hex");
    expect(verifyWebhookHmacSha256(payload, secret, tsSig, { timestampSeconds: ts, nowMs: (ts + 60) * 1000 })).toBe(true);
    expect(verifyWebhookHmacSha256(payload, secret, tsSig, { timestampSeconds: ts, nowMs: (ts + 601) * 1000 })).toBe(false);

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
