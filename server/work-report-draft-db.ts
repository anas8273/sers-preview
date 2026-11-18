import { and, asc, eq, isNull } from "drizzle-orm";
import {
  assets,
  contentBlocks,
  memberships,
  organizations,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import {
  normalizeReportDraft,
  type NormalizedReportDraft,
  type ReportFieldValue,
  ReportDocumentValidationError,
} from "../shared/report-projection";
import { downloadReadyAssetForUser } from "./upload-lifecycle-service";
import { getReadyUploadAssetForUser } from "./upload-intent-db";
import { getConfiguredPrivateStorage } from "./upload-runtime";
import { sanitizeEvidenceImage } from "./work-version-inline-image";

export const REPORT_DOCUMENT_BLOCK = "report_document";

export type ReportDraftData = {
  schemaVersion: 2;
  revision: number;
  templateId: string;
  templateVersionId: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, ReportFieldValue>;
  evidenceAssetIds: number[];
  updatedAt: string;
  fieldDefinitions: NormalizedReportDraft["fieldDefinitions"];
  migratedFromSchemaVersion?: number;
};

export class ReportDraftValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportDraftValidationError";
  }
}

export class ReportEvidenceFreezeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ReportEvidenceFreezeError";
  }
}

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
  try {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const normalized = normalizeReportDraft(data);
    return {
      ...normalized,
      revision: Number.isInteger(data.revision) && Number(data.revision) >= 0 ? Number(data.revision) : 0,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : new Date(0).toISOString(),
    };
  } catch (error) {
    if (error instanceof ReportDocumentValidationError) throw new ReportDraftValidationError(error.message);
    throw error;
  }
}

async function assertWriteAccessInTransaction(tx: any, userId: number, workItemId: number) {
  const [hint] = await tx.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1);
  if (!hint) return undefined;
  if (hint.ownerType === "personal") {
    if (hint.ownerUserId !== userId) return undefined;
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!user) return undefined;
  } else {
    if (!hint.ownerOrganizationId) return undefined;
    const [organization] = await tx.select().from(organizations).where(eq(organizations.id, hint.ownerOrganizationId)).limit(1).for("update");
    if (!organization || organization.status !== "active") return undefined;
    const [membership] = await tx.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.organizationId, hint.ownerOrganizationId), eq(memberships.status, "active"))).limit(1).for("update");
    if (!membership || !canWriteOrganization(membership.role)) return undefined;
  }
  const [work] = await tx.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1).for("update");
  if (!work || work.ownerType !== hint.ownerType || work.ownerUserId !== hint.ownerUserId || work.ownerOrganizationId !== hint.ownerOrganizationId) return undefined;
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
    return work.ownerUserId === userId ? work : undefined;
  }

  if (!work.ownerOrganizationId) return undefined;
  const [memberRow] = await db
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
  return memberRow?.membership ? work : undefined;
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
  fields: Record<string, ReportFieldValue>;
  evidenceAssetIds: number[];
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError();
    if (work.type !== "report") throw new ReportDraftAccessError("Only report work supports a report draft");
    if (work.status === "archived") throw new ReportDraftConflictError("Archived work cannot be edited");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1).for("update");
    const current = block ? normalizeDraft(block.data) : normalizeDraft(undefined);
    if (current.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    const linkedAssetRows = input.evidenceAssetIds.length > 0
      ? await tx
        .select({ assetId: workAssetLinks.assetId })
        .from(workAssetLinks)
        .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
        .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt))).for("update")
      : [];
    const linkedAssetIds = new Set(linkedAssetRows.map((row: { assetId: number }) => row.assetId));
    const evidenceAssetIds = Array.from(new Set(input.evidenceAssetIds)).filter(id => linkedAssetIds.has(id));

    let normalized: NormalizedReportDraft;
    try {
      normalized = normalizeReportDraft(input);
    } catch (error) {
      if (error instanceof ReportDocumentValidationError) throw new ReportDraftValidationError(error.message);
      throw error;
    }
    const draft: ReportDraftData = {
      ...normalized,
      revision: current.revision + 1,
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
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError();
    if (work.type !== "report") throw new ReportDraftAccessError("Only report work supports a report draft");
    if (work.status === "archived") throw new ReportDraftConflictError("Archived work cannot be versioned");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1).for("update");
    if (!block) throw new ReportDraftConflictError("Save the report before creating a version");
    const draft = normalizeDraft(block.data);
    if (draft.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    const linkedAssets = await tx
      .select({
        id: assets.id,
        title: assets.title,
        kind: assets.kind,
        mimeType: assets.mimeType,
        fileSize: assets.fileSize,
        metadata: assets.metadata,
        role: workAssetLinks.role,
        caption: workAssetLinks.caption,
      })
      .from(workAssetLinks)
      .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
      .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt))).for("update");

    const selectedIds = new Set(draft.evidenceAssetIds);
    const frozenAssets = [] as Array<Record<string, unknown>>;
    for (const asset of linkedAssets) {
      const base = { ...asset, metadata: undefined, fileSize: undefined };
      if (!selectedIds.has(asset.id) || asset.kind !== "file" || !asset.mimeType?.toLowerCase().startsWith("image/")) {
        frozenAssets.push(base);
        continue;
      }
      try {
        const storage = await getConfiguredPrivateStorage();
        const readyMetadata = await getReadyUploadAssetForUser(userId, asset.id);
        if (!readyMetadata) throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: الأصل ليس جاهزًا أو لم تعد صلاحية الوصول إليه قائمة");
        const ready = await downloadReadyAssetForUser(userId, asset.id, storage);
        if (!ready || !/^image\/(?:png|jpeg)$/i.test(ready.mimeType)) throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: الأصل غير جاهز أو نوعه غير مدعوم");
        if (ready.mimeType !== readyMetadata.mimeType || ready.bytes.length !== readyMetadata.bytes) throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: تغيرت هوية الأصل أثناء القراءة");
        const preview = sanitizeEvidenceImage(ready.bytes, ready.mimeType);
        frozenAssets.push({ ...base, frozen: {
          referenceVersion: readyMetadata.version,
          digest: readyMetadata.sha256,
          bytes: readyMetadata.bytes,
          contentType: ready.mimeType,
          sourceAssetId: readyMetadata.id,
          sourceUploadIntentId: readyMetadata.intentId,
          preview: { mimeType: "image/png", dataBase64: preview.bytes.toString("base64"), width: preview.width, height: preview.height },
        } });
      } catch (error) {
        if (error instanceof ReportEvidenceFreezeError) throw error;
        throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد بعد الفحص؛ لم تُنشأ النسخة");
      }
    }

    const nextVersion = work.currentVersionNumber + 1;
    // Keep older review decisions intact while the new version awaits review.
    await tx.update(workItems).set({ currentVersionNumber: nextVersion, status: "draft" }).where(eq(workItems.id, input.workItemId));
    const snapshot = {
      schemaVersion: 2,
      kind: "report",
      template: {
        templateId: draft.templateId,
        templateVersionId: draft.templateVersionId,
        schemaVersion: draft.schemaVersion,
        fieldDefinitions: draft.fieldDefinitions,
      },
      work: {
        id: work.id,
        title: work.title,
        ownerType: work.ownerType,
        ownerUserId: work.ownerUserId,
        ownerOrganizationId: work.ownerOrganizationId,
      },
      academicContext: work.academicContext,
      reportDraft: draft,
      assets: frozenAssets,
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
