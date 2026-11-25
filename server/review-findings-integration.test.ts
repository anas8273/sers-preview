import { randomUUID } from "node:crypto";
import { and, eq, inArray, or } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { auditLogs, users, type User } from "../drizzle/schema";
import {
  assets,
  contentBlocks,
  entitlements,
  memberships,
  notifications,
  organizations,
  outputs,
  purchases,
  reviewComments,
  reviews,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { getDb } from "./db";
import { domainRouter } from "./domain-router";
import { accountRouter } from "./account-router";
import { createAssetForUser, createWorkItemForUser, createWorkVersionForUser } from "./domain-db";
import { getReportDraftForUser, saveReportDraftForUser } from "./work-report-draft-db";
import { assertDisposableMySQL } from "../tests/fixtures/assert-disposable-mysql";
import { reportDraftSaveInput } from "../tests/fixtures/report-draft-contract";

const integrationEnabled = process.env.SERS_INTEGRATION === "1";
const suite = integrationEnabled ? describe : describe.skip;

suite("PR #46 review findings — server & router MySQL integration", () => {
  let ownerUser!: User;
  let adminUser!: User;
  let authorMemberUser!: User;
  let peerMemberUser!: User;
  let reviewerAUser!: User;
  let reviewerBUser!: User;
  let outsiderUser!: User;
  let orgId = 0;
  let otherOrgId = 0;

  const createdUserIds: number[] = [];
  const createdOrgIds: number[] = [];

  function domainCaller(user: User) {
    return domainRouter.createCaller({ user, req: {} as any, res: {} as any });
  }

  function accountCaller(user: User) {
    return accountRouter.createCaller({ user, req: {} as any, res: {} as any });
  }

  async function cleanScopedFixtures() {
    if (!createdUserIds.length && !createdOrgIds.length) return;
    const db = (await getDb())!;

    const scopedWorks = await db
      .select({ id: workItems.id })
      .from(workItems)
      .where(
        createdOrgIds.length
          ? or(
              inArray(workItems.creatorUserId, createdUserIds),
              inArray(workItems.ownerUserId, createdUserIds),
              inArray(workItems.ownerOrganizationId, createdOrgIds),
            )
          : inArray(workItems.creatorUserId, createdUserIds),
      );
    const workIds = scopedWorks.map(w => w.id);

    if (workIds.length) {
      const versions = await db
        .select({ id: workVersions.id })
        .from(workVersions)
        .where(inArray(workVersions.workItemId, workIds));
      const versionIds = versions.map(v => v.id);
      if (versionIds.length) {
        const revRows = await db
          .select({ id: reviews.id })
          .from(reviews)
          .where(inArray(reviews.workVersionId, versionIds));
        const revIds = revRows.map(r => r.id);
        if (revIds.length) {
          await db.delete(reviewComments).where(inArray(reviewComments.reviewId, revIds));
          await db.delete(reviews).where(inArray(reviews.id, revIds));
        }
        await db.delete(outputs).where(inArray(outputs.workVersionId, versionIds));
        await db.delete(workVersions).where(inArray(workVersions.id, versionIds));
      }
      await db.delete(workAssetLinks).where(inArray(workAssetLinks.workItemId, workIds));
      await db.delete(contentBlocks).where(inArray(contentBlocks.workItemId, workIds));
      await db.delete(workItems).where(inArray(workItems.id, workIds));
    }

    if (createdUserIds.length) {
      await db.delete(auditLogs).where(inArray(auditLogs.actorUserId, createdUserIds));
      await db.delete(notifications).where(inArray(notifications.userId, createdUserIds));
      await db.delete(entitlements).where(inArray(entitlements.userId, createdUserIds));
      await db.delete(purchases).where(inArray(purchases.userId, createdUserIds));
      await db.delete(assets).where(inArray(assets.creatorUserId, createdUserIds));
    }
    if (createdOrgIds.length) {
      await db.delete(entitlements).where(inArray(entitlements.organizationId, createdOrgIds));
      await db.delete(assets).where(inArray(assets.ownerOrganizationId, createdOrgIds));
      await db.delete(memberships).where(inArray(memberships.organizationId, createdOrgIds));
      await db.delete(organizations).where(inArray(organizations.id, createdOrgIds));
    }
    if (createdUserIds.length) {
      await db.delete(users).where(inArray(users.id, createdUserIds));
    }
  }

  beforeAll(async () => {
    assertDisposableMySQL();
    const db = (await getDb())!;

    const tag = randomUUID().slice(0, 8);
    const seedUsers = [
      { openId: `rf-owner-${tag}`, name: "قائد المدرسة", email: `owner-${tag}@example.com` },
      { openId: `rf-admin-${tag}`, name: "وكيل المدرسة", email: `admin-${tag}@example.com` },
      { openId: `rf-author-${tag}`, name: "معلم معد", email: `author-${tag}@example.com` },
      { openId: `rf-peer-${tag}`, name: "معلم زميل", email: `peer-${tag}@example.com` },
      { openId: `rf-revA-${tag}`, name: "مراجع أول", email: `reva-${tag}@example.com` },
      { openId: `rf-revB-${tag}`, name: "مراجع ثان", email: `revb-${tag}@example.com` },
      { openId: `rf-out-${tag}`, name: "مستخدم خارجي", email: `out-${tag}@example.com` },
    ];
    for (const u of seedUsers) {
      const [ins] = await db.insert(users).values(u);
      createdUserIds.push(Number(ins.insertId));
    }
    const rows = await db.select().from(users).where(inArray(users.id, createdUserIds));
    const byId = new Map(rows.map(r => [r.id, r]));
    ownerUser = byId.get(createdUserIds[0]!)!;
    adminUser = byId.get(createdUserIds[1]!)!;
    authorMemberUser = byId.get(createdUserIds[2]!)!;
    peerMemberUser = byId.get(createdUserIds[3]!)!;
    reviewerAUser = byId.get(createdUserIds[4]!)!;
    reviewerBUser = byId.get(createdUserIds[5]!)!;
    outsiderUser = byId.get(createdUserIds[6]!)!;

    const [orgIns] = await db.insert(organizations).values({ name: `مدرسة التكامل الأولى ${tag}` });
    orgId = Number(orgIns.insertId);
    const [otherIns] = await db.insert(organizations).values({ name: `مدرسة مستقلة ثانية ${tag}` });
    otherOrgId = Number(otherIns.insertId);
    createdOrgIds.push(orgId, otherOrgId);

    await db.insert(memberships).values([
      { organizationId: orgId, userId: ownerUser.id, role: "owner", status: "active" },
      { organizationId: orgId, userId: adminUser.id, role: "admin", status: "active" },
      { organizationId: orgId, userId: authorMemberUser.id, role: "member", status: "active" },
      { organizationId: orgId, userId: peerMemberUser.id, role: "member", status: "active" },
      { organizationId: orgId, userId: reviewerAUser.id, role: "reviewer", status: "active" },
      { organizationId: orgId, userId: reviewerBUser.id, role: "reviewer", status: "active" },
      { organizationId: otherOrgId, userId: outsiderUser.id, role: "owner", status: "active" },
    ]);
  });

  afterAll(async () => {
    if (integrationEnabled) await cleanScopedFixtures();
  });

  it("M1/L8: copyToPersonal allows only the active author, sanitizes school identity/evidence, and is idempotent", async () => {
    const db = (await getDb())!;
    const schoolAsset = await createAssetForUser(authorMemberUser.id, {
      title: "شاهد مؤسسي خاص بالمدرسة",
      kind: "text",
      ownerType: "organization",
      organizationId: orgId,
      metadata: { text: "محتوى مؤسسي" },
    });
    const schoolWork = (await createWorkItemForUser(authorMemberUser.id, {
      title: "تقرير برنامج الأسبوع التمهيدي المؤسسي",
      type: "report",
      ownerType: "organization",
      organizationId: orgId,
    }))!;

    const initialDraft = (await getReportDraftForUser(authorMemberUser.id, schoolWork.id))!;
    const savePayload = reportDraftSaveInput(initialDraft.draft, {
      workItemId: schoolWork.id,
      expectedRevision: initialDraft.draft.revision,
      fields: { objectives: "تهيئة الطلاب المستجدين" },
      evidenceAssetIds: [schoolAsset!.id],
    });
    await saveReportDraftForUser(authorMemberUser.id, {
      ...savePayload,
      reportIdentity: {
        version: "1",
        schoolName: "مدرسة التكامل الأولى",
        schoolPrincipal: "أ. خالد",
        reportPreparer: "أ. سعد المعد",
      },
    });

    const authorView = await domainCaller(authorMemberUser).work.get({ id: schoolWork.id });
    const peerView = await domainCaller(peerMemberUser).work.get({ id: schoolWork.id });
    expect(authorView.viewerIsCreator).toBe(true);
    expect(peerView.viewerIsCreator).toBe(false);

    // Peer member, reviewer, and outsider are all blocked (M1)
    await expect(
      domainCaller(peerMemberUser).work.copyToPersonal({ id: schoolWork.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(reviewerAUser).work.copyToPersonal({ id: schoolWork.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(outsiderUser).work.copyToPersonal({ id: schoolWork.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Author succeeds and gets sanitized personal copy
    const copied1 = await domainCaller(authorMemberUser).work.copyToPersonal({ id: schoolWork.id });
    expect(copied1.ownerType).toBe("personal");
    expect(copied1.ownerUserId).toBe(authorMemberUser.id);
    expect(copied1.ownerOrganizationId).toBeNull();
    expect(copied1.metadata?.copiedFromWorkItemId).toBe(schoolWork.id);

    const copiedDraft = (await getReportDraftForUser(authorMemberUser.id, copied1.id))!;
    expect(copiedDraft.draft.evidenceAssetIds).toEqual([]);
    expect(copiedDraft.draft.reportIdentity?.schoolName).toBeUndefined();
    expect(copiedDraft.draft.reportIdentity?.schoolPrincipal).toBeUndefined();
    expect(copiedDraft.draft.reportIdentity?.reportPreparer).toBe("أ. سعد المعد");

    // Repeated call is idempotent (L8)
    const copied2 = await domainCaller(authorMemberUser).work.copyToPersonal({ id: schoolWork.id });
    expect(copied2.id).toBe(copied1.id);

    // Suspended author loses copy access immediately
    await db
      .update(memberships)
      .set({ status: "suspended" })
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, authorMemberUser.id)));
    const secondSchoolWork = (await createWorkItemForUser(ownerUser.id, {
      title: "تقرير ثان",
      type: "report",
      ownerType: "organization",
      organizationId: orgId,
    }))!;
    await db.update(workItems).set({ creatorUserId: authorMemberUser.id }).where(eq(workItems.id, secondSchoolWork.id));
    await expect(
      domainCaller(authorMemberUser).work.copyToPersonal({ id: secondSchoolWork.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await db
      .update(memberships)
      .set({ status: "active" })
      .where(and(eq(memberships.organizationId, orgId), eq(memberships.userId, authorMemberUser.id)));
  });

  it("M2/L10: review.reassign enforces role/scope rules, writes audit log, notifies both reviewers, and survives A->B->A->B cycles", async () => {
    const db = (await getDb())!;
    const work = (await createWorkItemForUser(authorMemberUser.id, {
      title: "تقرير نشاط علمي للمراجعة",
      type: "report",
      ownerType: "organization",
      organizationId: orgId,
    }))!;
    const version = (await createWorkVersionForUser(authorMemberUser.id, work.id, {
      schemaVersion: 2,
      title: work.title,
    }))!;

    const review = await domainCaller(authorMemberUser).review.request({
      workVersionId: version.id,
      reviewerUserId: reviewerAUser.id,
    });

    await expect(
      domainCaller(reviewerAUser).review.reassign({
        reviewId: review.id,
        reviewerUserId: reviewerBUser.id,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    await expect(
      domainCaller(adminUser).review.reassign({
        reviewId: review.id,
        reviewerUserId: outsiderUser.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      domainCaller(ownerUser).review.reassign({
        reviewId: review.id,
        reviewerUserId: authorMemberUser.id,
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const reassigned1 = await domainCaller(adminUser).review.reassign({
      reviewId: review.id,
      reviewerUserId: reviewerBUser.id,
    });
    expect(reassigned1.reviewerUserId).toBe(reviewerBUser.id);

    const logs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "review.reassigned"), eq(auditLogs.resourceId, String(review.id))));
    expect(logs.length).toBeGreaterThanOrEqual(1);
    expect(logs[0]!.actorUserId).toBe(adminUser.id);
    expect(logs[0]!.metadata).toMatchObject({
      organizationId: orgId,
      fromReviewerUserId: reviewerAUser.id,
      toReviewerUserId: reviewerBUser.id,
    });

    const revBNotifs = await db.select().from(notifications).where(eq(notifications.userId, reviewerBUser.id));
    const revANotifs = await db
      .select()
      .from(notifications)
      .where(and(eq(notifications.userId, reviewerAUser.id), eq(notifications.type, "review_reassigned_away")));
    expect(revBNotifs.some(n => n.type === "review_requested")).toBe(true);
    expect(revANotifs).toHaveLength(1);

    await domainCaller(adminUser).review.reassign({ reviewId: review.id, reviewerUserId: reviewerAUser.id });
    const reassignedFinal = await domainCaller(adminUser).review.reassign({
      reviewId: review.id,
      reviewerUserId: reviewerBUser.id,
    });
    expect(reassignedFinal.reviewerUserId).toBe(reviewerBUser.id);

    await domainCaller(reviewerBUser).review.decide({ reviewId: review.id, decision: "approved" });
    await expect(
      domainCaller(adminUser).review.reassign({ reviewId: review.id, reviewerUserId: reviewerAUser.id }),
    ).rejects.toMatchObject({ code: "CONFLICT" });
  });

  it("M5/L9: self-evaluation restricts school writes/updates/deletes to owner/admin, blocks cross-school assets, and blocks generic pipelines", async () => {
    const db = (await getDb())!;

    await expect(
      domainCaller(peerMemberUser).selfEvaluation.createCycle({
        title: "دورة تقويم غير مصرحة",
        ownerType: "organization",
        organizationId: orgId,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    const created = await domainCaller(adminUser).selfEvaluation.createCycle({
      title: "دورة التقويم الذاتي الاسترشادية 1448",
      ownerType: "organization",
      organizationId: orgId,
    });
    expect(created?.canEdit).toBe(true);
    const cycleId = created!.work.id;

    // Plain member can read with canEdit=false, cannot save, AND cannot delete/update via domain.work
    const memberRead = await domainCaller(peerMemberUser).selfEvaluation.getCycle({ workItemId: cycleId });
    expect(memberRead.canEdit).toBe(false);
    await expect(
      domainCaller(peerMemberUser).selfEvaluation.saveCycle({
        workItemId: cycleId,
        expectedRevision: 1,
        executiveSummary: "محاولة تعديل من عضو عادي",
        assessments: {},
        improvementActions: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(peerMemberUser).work.update({ id: cycleId, title: "عنوان معدل من عضو عادي" }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(peerMemberUser).work.remove({ id: cycleId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Cross-school asset reference rejected with BAD_REQUEST
    const otherSchoolAsset = await createAssetForUser(outsiderUser.id, {
      title: "شاهد مدرسة أخرى",
      kind: "text",
      ownerType: "organization",
      organizationId: otherOrgId,
      metadata: { text: "خارج النطاق" },
    });
    await expect(
      domainCaller(adminUser).selfEvaluation.saveCycle({
        workItemId: cycleId,
        expectedRevision: 1,
        executiveSummary: "",
        assessments: {
          "admin.planning": {
            indicatorKey: "admin.planning",
            level: 2,
            rationale: "مبرر واقعي كافٍ للاختبار",
            evidenceAssetIds: [otherSchoolAsset!.id],
          },
        },
        improvementActions: [],
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const saved = await domainCaller(adminUser).selfEvaluation.saveCycle({
      workItemId: cycleId,
      expectedRevision: 1,
      schoolCategory: "private_international",
      executiveSummary: "تشخيص مؤسسي وفق مؤشرات هيئة تقويم التعليم (تميز)",
      assessments: {
        "admin.planning": {
          indicatorKey: "admin.planning",
          level: 2,
          rationale: "توجد خطة تشغيلية لكن متابعة المؤشرات تحتاج انتظامًا.",
          evidenceAssetIds: [],
        },
        "1-4-1-1": {
          indicatorKey: "1-4-1-1",
          level: 3,
          rationale: "التزام المدرسة بمتطلبات التراخيص والحوكمة المعتمدة من الوزارة.",
          evidenceAssetIds: [],
        },
      },
      improvementActions: [],
    });
    expect(saved.draft.revision).toBe(2);
    expect(saved.draft.schoolCategory).toBe("private_international");
    expect(saved.summary.totalIndicators).toBe(51);
    expect(saved.draft.assessments["1-1-1-1"]?.level).toBe(2);
    expect(saved.draft.assessments["1-4-1-1"]?.level).toBe(3);
    const saveAudit = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.action, "self_evaluation.saved"), eq(auditLogs.resourceId, String(cycleId))));
    expect(saveAudit).toHaveLength(1);

    // Same-org asset linked to self-evaluation reports usage in domain.asset.usage (Used-in)
    const schoolAssetSameOrg = await createAssetForUser(adminUser.id, {
      title: "شاهد نفس المدرسة",
      kind: "text",
      ownerType: "organization",
      organizationId: orgId,
      metadata: { text: "شاهد" },
    });
    await domainCaller(adminUser).selfEvaluation.saveCycle({
      workItemId: cycleId,
      expectedRevision: 2,
      executiveSummary: "ربط شاهد فعلي بالمؤشر 1-1-1-1",
      assessments: {
        "1-1-1-1": {
          indicatorKey: "1-1-1-1",
          level: 3,
          rationale: "توثيق الخطة التشغيلية بشاهد رسمي معتمد.",
          evidenceAssetIds: [schoolAssetSameOrg!.id],
        },
      },
      improvementActions: [],
    });
    const usage = await domainCaller(adminUser).asset.usage({ id: schoolAssetSameOrg!.id });
    expect(
      usage?.activeLinks.some(
        link => link.workItemId === cycleId && link.role === "self_evaluation_evidence",
      ),
    ).toBe(true);

    // Generic pipelines reject self-evaluation cycles (L9 + M1)
    await expect(
      domainCaller(adminUser).asset.linkToWork({ workItemId: cycleId, assetId: schoolAssetSameOrg!.id }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(adminUser).work.copyToPersonal({ id: cycleId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(adminUser).portfolioDraft.get({ workItemId: cycleId }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(adminUser).portfolioDraft.save({
        workItemId: cycleId,
        expectedRevision: 1,
        introduction: "اختراق المسار العام",
        entries: [],
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    await expect(
      domainCaller(adminUser).portfolioDraft.createVersion({
        workItemId: cycleId,
        expectedRevision: 1,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(await createWorkVersionForUser(adminUser.id, cycleId, { test: true })).toBeUndefined();

    // Personal self-evaluation cycle works for plain member with canEdit=true
    const personalCycle = await domainCaller(peerMemberUser).selfEvaluation.createCycle({
      title: "مراجعة ذاتية فردية",
      ownerType: "personal",
    });
    expect(personalCycle?.canEdit).toBe(true);

    // NEXT-19 / O009: Admin delegates peerMemberUser onto committeeMembers -> peerMemberUser can rate indicators,
    // but CANNOT change schoolCategory or escalate committeeMembers!
    const currentCycle = await domainCaller(adminUser).selfEvaluation.getCycle({ workItemId: cycleId });
    await domainCaller(adminUser).selfEvaluation.saveCycle({
      workItemId: cycleId,
      expectedRevision: currentCycle.draft.revision,
      executiveSummary: currentCycle.draft.executiveSummary,
      committeeMembers: [
        {
          id: "comm-peer",
          userId: peerMemberUser.id,
          name: peerMemberUser.name || "معلم زميل",
          roleTitle: "عضو فريق التقويم — التعليم والتعلم",
          assignedDomainKey: "teaching_learning",
        },
      ],
      assessments: currentCycle.draft.assessments,
      improvementActions: currentCycle.draft.improvementActions,
    });

    const delegatedView = await domainCaller(peerMemberUser).selfEvaluation.getCycle({ workItemId: cycleId });
    expect(delegatedView.canEdit).toBe(true);
    expect(delegatedView.canManageCommittee).toBe(false);

    // Delegated committee member CANNOT change schoolCategory
    await expect(
      domainCaller(peerMemberUser).selfEvaluation.saveCycle({
        workItemId: cycleId,
        expectedRevision: delegatedView.draft.revision,
        schoolCategory: "government",
        executiveSummary: delegatedView.draft.executiveSummary,
        assessments: delegatedView.draft.assessments,
        improvementActions: delegatedView.draft.improvementActions,
      }),
    ).rejects.toMatchObject({ code: "FORBIDDEN" });

    // Delegated committee member CAN contribute an indicator rating, while any attempt to tamper with committeeMembers is ignored
    const memberSaved = await domainCaller(peerMemberUser).selfEvaluation.saveCycle({
      workItemId: cycleId,
      expectedRevision: delegatedView.draft.revision,
      executiveSummary: delegatedView.draft.executiveSummary,
      committeeMembers: [],
      assessments: {
        ...delegatedView.draft.assessments,
        "2-1-1-1": {
          indicatorKey: "2-1-1-1",
          level: 3,
          rationale: "توفير فرص تعلم متكافئة لجميع المتعلمين بشواهد صفية موثقة.",
          evidenceAssetIds: [],
        },
      },
      improvementActions: delegatedView.draft.improvementActions,
    });
    expect(memberSaved.draft.assessments["2-1-1-1"]?.level).toBe(3);
    expect(memberSaved.draft.committeeMembers).toHaveLength(1);
    expect(memberSaved.draft.committeeMembers[0]?.userId).toBe(peerMemberUser.id);
  });

  it("L6/R18: account.exportMyData isolates personal data from other users/schools, strips secrets, logs audit, and rate-limits after 5 exports", async () => {
    const db = (await getDb())!;
    const myPersonalWork = (await createWorkItemForUser(authorMemberUser.id, {
      title: "عملي الشخصي الخاص",
      type: "report",
      ownerType: "personal",
    }))!;
    await createAssetForUser(authorMemberUser.id, {
      title: "شاهد شخصي",
      kind: "file",
      ownerType: "personal",
      storageKey: "private/uploads/author/secret-storage-key.pdf",
      mimeType: "application/pdf",
      fileSize: 1024,
    });

    await createWorkItemForUser(outsiderUser.id, {
      title: "عمل سري لمستخدم آخر",
      type: "report",
      ownerType: "personal",
    });
    await createAssetForUser(outsiderUser.id, {
      title: "شاهد سري لمستخدم آخر",
      kind: "text",
      ownerType: "personal",
      metadata: { text: "نص خاص بالمستخدم الخارجي" },
    });

    const exported = await accountCaller(authorMemberUser).exportMyData();
    const rawJson = JSON.stringify(exported);

    expect(exported.personalWorks.some(w => w.id === myPersonalWork.id)).toBe(true);
    expect(rawJson).not.toContain("عمل سري لمستخدم آخر");
    expect(rawJson).not.toContain("نص خاص بالمستخدم الخارجي");
    expect(rawJson).not.toContain("secret-storage-key.pdf");
    expect(rawJson).not.toContain(authorMemberUser.openId);
    // School work seeded in M1 test ("تقرير برنامج الأسبوع التمهيدي المؤسسي") is NOT personal, though its personal copy ("... (نسخة شخصية)") IS personal:
    expect(exported.personalWorks.every(w => w.title !== "تقرير برنامج الأسبوع التمهيدي المؤسسي")).toBe(true);

    // Exhaust the remaining 4 allowed exports in the 10-minute window (total 5), then verify 6th rejects with CONFLICT
    await accountCaller(authorMemberUser).exportMyData();
    await accountCaller(authorMemberUser).exportMyData();
    await accountCaller(authorMemberUser).exportMyData();
    await accountCaller(authorMemberUser).exportMyData();
    await expect(accountCaller(authorMemberUser).exportMyData()).rejects.toMatchObject({ code: "CONFLICT" });

    const exportLogs = await db
      .select()
      .from(auditLogs)
      .where(and(eq(auditLogs.actorUserId, authorMemberUser.id), eq(auditLogs.action, "account.data_exported")));
    expect(exportLogs).toHaveLength(5);
  });
});
