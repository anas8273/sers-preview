import { and, asc, eq, isNull, sql } from "drizzle-orm";
import {
  assets,
  contentBlocks,
  memberships,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { getDb } from "./db";

export const REPORT_DOCUMENT_BLOCK = "report_document";

export type ReportDraftData = {
  schemaVersion: 1;
  revision: number;
  templateId: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, string>;
  evidenceAssetIds: number[];
  updatedAt: string;
};

export class ReportDraftConflictError extends Error {
  constructor(message = "Report draft changed") {
    super(message);
    this.name = "ReportDraftConflictError";
  }
}

export class ReportDraftAccessError extends Error {
  constructor(message = "Report draft access denied") {
    super(message);
    this.name = "ReportDraftAccessError";
  }
}

function canWriteOrganization(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

function normalizeDraft(value: unknown): ReportDraftData {
  const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
  const rawFields = data.fields && typeof data.fields === "object" ? data.fields as Record<string, unknown> : {};
  const fields = Object.fromEntries(
    Object.entries(rawFields)
      .filter(([, fieldValue]) => typeof fieldValue === "string")
      .map(([key, fieldValue]) => [key, fieldValue as string]),
  );
  const evidenceAssetIds = Array.isArray(data.evidenceAssetIds)
    ? data.evidenceAssetIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
    : [];

  return {
    schemaVersion: 1,
    revision: Number.isInteger(data.revision) && Number(data.revision) >= 0 ? Number(data.revision) : 0,
    templateId: typeof data.templateId === "string" ? data.templateId : "custom",
    themeId: typeof data.themeId === "string" ? data.themeId : "classic",
    fontFamily: typeof data.fontFamily === "string" ? data.fontFamily : "Cairo",
    fields,
    evidenceAssetIds,
    updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
  };
}

async function assertWriteAccessInTransaction(tx: any, userId: number, workItemId: number) {
  const [work] = await tx
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)))
    .limit(1);
  if (!work) return undefined;

  if (work.ownerType === "personal") {
    return work.ownerUserId === userId || work.creatorUserId === userId ? work : undefined;
  }

  if (!work.ownerOrganizationId) return undefined;
  const [membership] = await tx
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, work.ownerOrganizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1);
  if (!membership || !canWriteOrganization(membership.role)) return undefined;
  return work;
}

async function assertReadAccess(userId: number, workItemId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [work] = await db
    .select()
    .from(workItems)
    .where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt)))
    .limit(1);
  if (!work) return undefined;

  if (work.ownerType === "personal") {
    return work.ownerUserId === userId || work.creatorUserId === userId ? work : undefined;
  }

  if (!work.ownerOrganizationId) return undefined;
  const [membership] = await db
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, work.ownerOrganizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1);
  return membership ? work : undefined;
}

export async function getReportDraftForUser(userId: number, workItemId: number) {
  const work = await assertReadAccess(userId, workItemId);
  if (!work) return undefined;
  if (work.type !== "report") throw new ReportDraftAccessError("Only report work supports a report draft");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [block] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.workItemId, workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
    .orderBy(asc(contentBlocks.id))
    .limit(1);

  return {
    work: {
      id: work.id,
      title: work.title,
      status: work.status,
      ownerType: work.ownerType,
      ownerOrganizationId: work.ownerOrganizationId,
      currentVersionNumber: work.currentVersionNumber,
    },
    draft: block ? normalizeDraft(block.data) : normalizeDraft(undefined),
    blockId: block?.id ?? null,
  };
}

export async function saveReportDraftForUser(userId: number, input: {
  workItemId: number;
  expectedRevision: number;
  templateId: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, string>;
  evidenceAssetIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM work_items WHERE id = ${input.workItemId} FOR UPDATE`);
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError();
    if (work.type !== "report") throw new ReportDraftAccessError("Only report work supports a report draft");
    if (work.status === "archived") throw new ReportDraftConflictError("Archived work cannot be edited");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1);
    const current = block ? normalizeDraft(block.data) : normalizeDraft(undefined);
    if (current.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    const linkedAssetRows = input.evidenceAssetIds.length > 0
      ? await tx
        .select({ assetId: workAssetLinks.assetId })
        .from(workAssetLinks)
        .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
        .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt)))
      : [];
    const linkedAssetIds = new Set(linkedAssetRows.map((row: { assetId: number }) => row.assetId));
    const evidenceAssetIds = [...new Set(input.evidenceAssetIds)].filter(id => linkedAssetIds.has(id));

    const draft: ReportDraftData = {
      schemaVersion: 1,
      revision: current.revision + 1,
      templateId: input.templateId,
      themeId: input.themeId,
      fontFamily: input.fontFamily,
      fields: input.fields,
      evidenceAssetIds,
      updatedAt: new Date().toISOString(),
    };

    if (block) {
      await tx
        .update(contentBlocks)
        .set({ data: draft, updatedAt: new Date() })
        .where(and(eq(contentBlocks.id, block.id), eq(contentBlocks.workItemId, input.workItemId)));
    } else {
      await tx.insert(contentBlocks).values({
        workItemId: input.workItemId,
        blockType: REPORT_DOCUMENT_BLOCK,
        sortOrder: 0,
        data: draft,
      });
    }
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));
    return draft;
  });
}

export async function createReportDraftVersionForUser(userId: number, input: {
  workItemId: number;
  expectedRevision: number;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    await tx.execute(sql`SELECT id FROM work_items WHERE id = ${input.workItemId} FOR UPDATE`);
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError();
    if (work.type !== "report") throw new ReportDraftAccessError("Only report work supports a report draft");
    if (work.status === "archived") throw new ReportDraftConflictError("Archived work cannot be versioned");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1);
    if (!block) throw new ReportDraftConflictError("Save the report before creating a version");
    const draft = normalizeDraft(block.data);
    if (draft.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    const linkedAssets = await tx
      .select({
        id: assets.id,
        title: assets.title,
        kind: assets.kind,
        mimeType: assets.mimeType,
        role: workAssetLinks.role,
        caption: workAssetLinks.caption,
      })
      .from(workAssetLinks)
      .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
      .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt)));

    const nextVersion = work.currentVersionNumber + 1;
    await tx.update(workItems).set({ currentVersionNumber: nextVersion }).where(eq(workItems.id, input.workItemId));
    const snapshot = {
      schemaVersion: 1,
      kind: "report",
      work: {
        id: work.id,
        title: work.title,
        ownerType: work.ownerType,
        ownerUserId: work.ownerUserId,
        ownerOrganizationId: work.ownerOrganizationId,
      },
      reportDraft: draft,
      assets: linkedAssets,
      capturedAt: new Date().toISOString(),
    };
    const inserted = await tx.insert(workVersions).values({
      workItemId: input.workItemId,
      versionNumber: nextVersion,
      createdByUserId: userId,
      reason: input.reason ?? null,
      snapshot,
    });

    return {
      id: Number(inserted[0].insertId),
      versionNumber: nextVersion,
      reportRevision: draft.revision,
    };
  });
}
