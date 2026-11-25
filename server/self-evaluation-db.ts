import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  assets,
  contentBlocks,
  memberships,
  organizations,
  workItems,
} from "../drizzle/domain-core";
import { auditLogs, users } from "../drizzle/schema";
import { captureAcademicContext } from "./account-db";
import { getDb } from "./db";
import { REPORT_DOCUMENT_BLOCK } from "./work-report-draft-db";
import { normalizeReportDraft } from "../shared/report-projection";
import {
  computeSelfEvaluationSummary,
  normalizeSelfEvaluationDraft,
  SELF_EVALUATION_FRAMEWORK_ID,
  SELF_EVALUATION_INDICATORS,
  SelfEvaluationValidationError,
  type ImprovementAction,
  type IndicatorAssessment,
  type SelfEvaluationDraftData,
  type SelfEvaluationSummary,
} from "../shared/self-evaluation";

export const SELF_EVALUATION_CYCLE_BLOCK = "self_evaluation_cycle";

export class SelfEvaluationAccessError extends Error {
  constructor(message = "لا تملك صلاحية الوصول إلى دورة التقويم الذاتي") {
    super(message);
    this.name = "SelfEvaluationAccessError";
  }
}

export class SelfEvaluationConflictError extends Error {
  constructor(message = "تغيرت دورة التقويم الذاتي في جلسة أخرى؛ حدّث الصفحة قبل الحفظ") {
    super(message);
    this.name = "SelfEvaluationConflictError";
  }
}

/**
 * School-owned self-evaluation cycles are institutional documents: only school
 * owner/admin may create or change them (least privilege, review finding M5).
 * Members and reviewers can read. Committee/assignment-based editing is pending
 * an owner decision (see 03_DECISION_REGISTER, O009).
 */
function canManageSchoolSelfEvaluation(role: string) {
  return role === "owner" || role === "admin";
}

function isSelfEvaluationWork(work: { type: string; metadata: Record<string, unknown> | null }) {
  return work.type === "portfolio" && work.metadata?.module === "self_evaluation";
}

function sameScope(
  cycleWork: { ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
  target: { ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
) {
  if (cycleWork.ownerType !== target.ownerType) return false;
  if (cycleWork.ownerType === "personal") return cycleWork.ownerUserId === target.ownerUserId;
  return Boolean(cycleWork.ownerOrganizationId && cycleWork.ownerOrganizationId === target.ownerOrganizationId);
}

async function lockWriteScope(
  tx: any,
  userId: number,
  ownerType: "personal" | "organization",
  organizationId?: number | null,
) {
  if (ownerType === "personal") {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    return Boolean(user);
  }
  if (!organizationId) return false;
  const [org] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
  if (!org || org.status !== "active") return false;
  const [member] = await tx
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1)
    .for("update");
  return Boolean(member && canManageSchoolSelfEvaluation(member.role));
}

async function assertCycleReadAccess(userId: number, workItemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [work] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)))
    .limit(1);
  if (!work || !isSelfEvaluationWork(work)) return undefined;
  if (work.ownerType === "personal") return work.ownerUserId === userId ? { ...work, viewerRole: "owner" as string } : undefined;
  if (!work.ownerOrganizationId) return undefined;
  const [member] = await db
    .select({ membership: memberships })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(
      eq(organizations.status, "active"),
      eq(memberships.userId, userId),
      eq(memberships.organizationId, work.ownerOrganizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1);
  return member?.membership ? { ...work, viewerRole: member.membership.role } : undefined;
}

async function assertCycleWriteInTransaction(tx: any, userId: number, workItemId: number) {
  const [hint] = await tx
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)))
    .limit(1);
  if (!hint || !isSelfEvaluationWork(hint)) return undefined;
  if (hint.ownerType === "personal" && hint.ownerUserId !== userId) return undefined;
  if (!await lockWriteScope(tx, userId, hint.ownerType, hint.ownerOrganizationId)) return undefined;
  const [work] = await tx
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)))
    .limit(1)
    .for("update");
  if (
    !work ||
    !isSelfEvaluationWork(work) ||
    work.ownerType !== hint.ownerType ||
    work.ownerUserId !== hint.ownerUserId ||
    work.ownerOrganizationId !== hint.ownerOrganizationId
  ) {
    return undefined;
  }
  return work;
}

async function assertReferencesSameScope(
  tx: any,
  cycleWork: { id: number; ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
  draft: SelfEvaluationDraftData,
) {
  const allAssetIds = new Set<number>();
  for (const assessment of Object.values(draft.assessments)) {
    for (const assetId of assessment.evidenceAssetIds) allAssetIds.add(assetId);
  }
  if (allAssetIds.size > 0) {
    const ids = Array.from(allAssetIds);
    const rows = await tx
      .select()
      .from(assets)
      .where(and(inArray(assets.id, ids), isNull(assets.deletedAt)));
    const map = new Map<number, any>(rows.map((r: any) => [r.id, r]));
    for (const id of ids) {
      const target = map.get(id);
      if (!target || !sameScope(cycleWork, target)) {
        throw new SelfEvaluationValidationError("أحد الشواهد المختارة غير متاح أو لا يتبع نفس مساحة الملكية");
      }
    }
  }

  const allWorkIds = Array.from(
    new Set(
      draft.improvementActions
        .map(a => a.linkedWorkItemId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  );
  if (allWorkIds.length > 0) {
    const rows = await tx
      .select()
      .from(workItems)
      .where(and(inArray(workItems.id, allWorkIds), isNull(workItems.deletedAt)));
    const map = new Map<number, any>(rows.map((r: any) => [r.id, r]));
    for (const id of allWorkIds) {
      const target = map.get(id);
      if (!target || target.id === cycleWork.id || !sameScope(cycleWork, target)) {
        throw new SelfEvaluationValidationError("أحد أعمال التنفيذ المرتبطة غير متاح أو لا يتبع نفس مساحة الملكية");
      }
    }
  }
}

export async function createSelfEvaluationCycleForUser(
  userId: number,
  input: {
    title: string;
    ownerType: "personal" | "organization";
    organizationId?: number;
    academicYearId?: number;
    academicTermId?: number;
  },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const workItemId = await db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, input.ownerType, input.organizationId)) {
      throw new SelfEvaluationAccessError("لا تملك صلاحية إنشاء دورة تقويم ذاتي في هذه المساحة");
    }
    const scopeKey = input.ownerType === "personal"
      ? `personal:${userId}`
      : `organization:${input.organizationId}`;
    const academicContext = await captureAcademicContext(tx, scopeKey, input.academicYearId, input.academicTermId);
    const initialDraft = normalizeSelfEvaluationDraft({
      schemaVersion: 1,
      frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
      revision: 1,
      executiveSummary: "",
      assessments: {},
      improvementActions: [],
      updatedAt: new Date().toISOString(),
    });

    const [inserted] = await tx.insert(workItems).values({
      creatorUserId: userId,
      ownerType: input.ownerType,
      ownerUserId: input.ownerType === "personal" ? userId : null,
      ownerOrganizationId: input.ownerType === "organization" ? input.organizationId! : null,
      type: "portfolio",
      title: input.title.trim(),
      status: "draft",
      currentVersionNumber: 0,
      academicYearId: input.academicYearId ?? null,
      academicTermId: input.academicTermId ?? null,
      academicContext,
      metadata: {
        module: "self_evaluation",
        frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
      },
    });
    const id = Number(inserted.insertId);
    await tx.insert(contentBlocks).values({
      workItemId: id,
      blockType: SELF_EVALUATION_CYCLE_BLOCK,
      sortOrder: 0,
      data: initialDraft,
    });
    return id;
  });

  return getSelfEvaluationCycleForUser(userId, workItemId);
}

export async function listSelfEvaluationCyclesForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const memberOf = await db
    .select({ organizationId: memberships.organizationId, organizationName: organizations.name })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.status, "active"),
      eq(organizations.status, "active"),
    ));
  const orgNameMap = new Map<number, string>(memberOf.map(row => [row.organizationId, row.organizationName]));
  const organizationIds = memberOf.map(row => row.organizationId);

  const ownership = organizationIds.length > 0
    ? or(
      and(eq(workItems.ownerType, "personal"), eq(workItems.ownerUserId, userId)),
      and(eq(workItems.ownerType, "organization"), inArray(workItems.ownerOrganizationId, organizationIds)),
    )
    : and(eq(workItems.ownerType, "personal"), eq(workItems.ownerUserId, userId));

  const candidateWorks = await db
    .select()
    .from(workItems)
    .where(and(isNull(workItems.deletedAt), eq(workItems.type, "portfolio"), ownership))
    .orderBy(desc(workItems.updatedAt));

  const cycles = candidateWorks.filter(isSelfEvaluationWork);
  if (cycles.length === 0) return [];

  const blocks = await db
    .select()
    .from(contentBlocks)
    .where(and(
      inArray(contentBlocks.workItemId, cycles.map(c => c.id)),
      eq(contentBlocks.blockType, SELF_EVALUATION_CYCLE_BLOCK),
    ));
  const blockMap = new Map<number, Record<string, unknown>>(blocks.map(b => [b.workItemId, b.data]));

  return cycles.map(work => {
    const draft = normalizeSelfEvaluationDraft(blockMap.get(work.id));
    const summary = computeSelfEvaluationSummary(draft);
    return {
      id: work.id,
      title: work.title,
      ownerType: work.ownerType,
      ownerOrganizationId: work.ownerOrganizationId,
      organizationName: work.ownerOrganizationId ? (orgNameMap.get(work.ownerOrganizationId) ?? null) : null,
      academicContext: work.academicContext,
      updatedAt: work.updatedAt,
      summary,
    };
  });
}

export async function getSelfEvaluationCycleForUser(userId: number, workItemId: number) {
  const work = await assertCycleReadAccess(userId, workItemId);
  if (!work) return undefined;

  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [block] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.workItemId, workItemId), eq(contentBlocks.blockType, SELF_EVALUATION_CYCLE_BLOCK)))
    .orderBy(asc(contentBlocks.id))
    .limit(1);

  const draft = normalizeSelfEvaluationDraft(block?.data);
  const summary = computeSelfEvaluationSummary(draft);

  const linkedWorkIds = Array.from(
    new Set(
      draft.improvementActions
        .map(a => a.linkedWorkItemId)
        .filter((id): id is number => typeof id === "number" && id > 0),
    ),
  );
  const linkedWorkRows = linkedWorkIds.length > 0
    ? await db
      .select({ id: workItems.id, title: workItems.title, status: workItems.status, ownerType: workItems.ownerType, ownerUserId: workItems.ownerUserId, ownerOrganizationId: workItems.ownerOrganizationId })
      .from(workItems)
      .where(and(inArray(workItems.id, linkedWorkIds), isNull(workItems.deletedAt)))
    : [];
  const linkedWorks = linkedWorkRows
    .filter(target => sameScope(work, target))
    .map(target => ({ id: target.id, title: target.title, status: target.status }));

  return {
    work: {
      id: work.id,
      title: work.title,
      status: work.status,
      ownerType: work.ownerType,
      ownerOrganizationId: work.ownerOrganizationId,
      academicContext: work.academicContext,
      updatedAt: work.updatedAt,
    },
    canEdit: work.ownerType === "personal" || canManageSchoolSelfEvaluation(work.viewerRole),
    draft,
    summary,
    linkedWorks,
  };
}

export async function saveSelfEvaluationCycleForUser(
  userId: number,
  input: {
    workItemId: number;
    expectedRevision: number;
    executiveSummary: string;
    assessments: Record<string, IndicatorAssessment>;
    improvementActions: ImprovementAction[];
  },
): Promise<{ draft: SelfEvaluationDraftData; summary: SelfEvaluationSummary }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertCycleWriteInTransaction(tx, userId, input.workItemId);
    if (!work) throw new SelfEvaluationAccessError();
    if (work.status === "archived") throw new SelfEvaluationConflictError("لا يمكن تعديل دورة تقويم مؤرشفة");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, SELF_EVALUATION_CYCLE_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const current = normalizeSelfEvaluationDraft(block?.data);
    if (current.revision !== input.expectedRevision) {
      throw new SelfEvaluationConflictError();
    }

    const normalized = normalizeSelfEvaluationDraft(
      {
        schemaVersion: 1,
        frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
        revision: current.revision + 1,
        executiveSummary: input.executiveSummary,
        assessments: input.assessments,
        improvementActions: input.improvementActions,
        updatedAt: new Date().toISOString(),
      },
      { strictValidation: true },
    );

    await assertReferencesSameScope(tx, work, normalized);

    if (block) {
      await tx
        .update(contentBlocks)
        .set({ data: normalized, updatedAt: new Date() })
        .where(and(eq(contentBlocks.id, block.id), eq(contentBlocks.workItemId, input.workItemId)));
    } else {
      await tx.insert(contentBlocks).values({
        workItemId: input.workItemId,
        blockType: SELF_EVALUATION_CYCLE_BLOCK,
        sortOrder: 0,
        data: normalized,
      });
    }
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "self_evaluation.saved",
      resourceType: "work_item",
      resourceId: String(input.workItemId),
      metadata: { revision: normalized.revision, ownerType: work.ownerType, organizationId: work.ownerOrganizationId ?? null },
    });

    return {
      draft: normalized,
      summary: computeSelfEvaluationSummary(normalized),
    };
  });
}

/**
 * Creates a linked SERS Report `workItem` directly from an improvement plan action,
 * pre-filling its initial v2 report draft with the indicator goal and execution steps.
 */
export async function createReportFromImprovementActionForUser(
  userId: number,
  input: { workItemId: number; expectedRevision: number; actionId: string },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertCycleWriteInTransaction(tx, userId, input.workItemId);
    if (!work) throw new SelfEvaluationAccessError();
    if (work.status === "archived") throw new SelfEvaluationConflictError("لا يمكن تعديل دورة تقويم مؤرشفة");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, SELF_EVALUATION_CYCLE_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const current = normalizeSelfEvaluationDraft(block?.data);
    if (current.revision !== input.expectedRevision) {
      throw new SelfEvaluationConflictError();
    }

    const actionIndex = current.improvementActions.findIndex(item => item.id === input.actionId);
    if (actionIndex === -1) {
      throw new SelfEvaluationValidationError("إجراء التحسين المطلوب غير موجود؛ احفظ الخطة أولًا");
    }
    const targetAction = current.improvementActions[actionIndex]!;
    if (targetAction.linkedWorkItemId) {
      return {
        reportWorkItemId: targetAction.linkedWorkItemId,
        draft: current,
        summary: computeSelfEvaluationSummary(current),
      };
    }

    const indicator = SELF_EVALUATION_INDICATORS.find(item => item.key === targetAction.indicatorKey);
    const reportTitle = `تقرير تحسين (${indicator?.code ?? "مؤشر"}): ${targetAction.goal}`.slice(0, 255);

    const [insertedReport] = await tx.insert(workItems).values({
      creatorUserId: userId,
      ownerType: work.ownerType,
      ownerUserId: work.ownerUserId,
      ownerOrganizationId: work.ownerOrganizationId,
      type: "report",
      title: reportTitle,
      status: "draft",
      currentVersionNumber: 0,
      academicYearId: work.academicYearId,
      academicTermId: work.academicTermId,
      academicContext: work.academicContext,
      metadata: {
        sourceCycleWorkItemId: work.id,
        sourceImprovementActionId: targetAction.id,
        indicatorKey: targetAction.indicatorKey,
      },
    });
    const reportWorkItemId = Number(insertedReport.insertId);

    const initialReportDraft = normalizeReportDraft({
      schemaVersion: 1,
      templateId: "program-report",
      themeId: "formal",
      fontFamily: "Cairo",
      fields: {
        subject: targetAction.goal,
        executionDate: targetAction.dueDate || "",
        field: indicator ? indicator.title : "",
        executor: targetAction.ownerName || "",
        objectives: targetAction.goal,
        implementation: targetAction.action,
      },
      evidenceAssetIds: [],
    });
    const { migratedFromSchemaVersion: _droppedMigration, ...cleanReportDraft } = initialReportDraft;

    await tx.insert(contentBlocks).values({
      workItemId: reportWorkItemId,
      blockType: REPORT_DOCUMENT_BLOCK,
      sortOrder: 0,
      data: {
        ...cleanReportDraft,
        revision: 1,
        updatedAt: new Date().toISOString(),
      },
    });

    const updatedActions = current.improvementActions.map((item, idx) =>
      idx === actionIndex
        ? { ...item, linkedWorkItemId: reportWorkItemId, status: item.status === "planned" ? "in_progress" as const : item.status }
        : item,
    );

    const nextDraft = normalizeSelfEvaluationDraft({
      ...current,
      revision: current.revision + 1,
      improvementActions: updatedActions,
      updatedAt: new Date().toISOString(),
    });

    if (block) {
      await tx
        .update(contentBlocks)
        .set({ data: nextDraft, updatedAt: new Date() })
        .where(and(eq(contentBlocks.id, block.id), eq(contentBlocks.workItemId, input.workItemId)));
    } else {
      await tx.insert(contentBlocks).values({
        workItemId: input.workItemId,
        blockType: SELF_EVALUATION_CYCLE_BLOCK,
        sortOrder: 0,
        data: nextDraft,
      });
    }
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "self_evaluation.action_report_created",
      resourceType: "work_item",
      resourceId: String(input.workItemId),
      metadata: {
        revision: nextDraft.revision,
        actionId: targetAction.id,
        reportWorkItemId,
        ownerType: work.ownerType,
        organizationId: work.ownerOrganizationId ?? null,
      },
    });

    return {
      reportWorkItemId,
      draft: nextDraft,
      summary: computeSelfEvaluationSummary(nextDraft),
    };
  });
}
