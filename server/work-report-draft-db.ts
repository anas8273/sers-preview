import { randomBytes } from "node:crypto";
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
import { uploadIntents } from "../drizzle/upload-intents";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import {
  applyTemplateSwitch,
  normalizeReportDraft,
  previewTemplateSwitch,
  REPORT_TEMPLATE_DEFINITIONS,
  type NormalizedReportDraft,
  type ReportFieldValue,
  type TemplateSwitchPreview,
  ReportDocumentValidationError,
} from "../shared/report-projection";
import type { ReportIdentity } from "../shared/report-appearance";
import { downloadReadyAssetForUser } from "./upload-lifecycle-service";
import { getReadyUploadAssetForUser } from "./upload-intent-db";
import { getConfiguredPrivateStorage } from "./upload-runtime";
import { sanitizeEvidenceImage } from "./work-version-inline-image";
import { sanitizeReportSchoolLogo } from "./work-version-report-assets";

export const REPORT_DOCUMENT_BLOCK = "report_document";
export const REPORT_TEMPLATE_HISTORY_BLOCK = "report_template_history";
const REPORT_TEMPLATE_HISTORY_MAX_ENTRIES = 5;

export type ReportTemplateHistoryEntry = {
  historyId: string;
  switchedAt: string;
  fromTemplateId: string;
  fromTemplateLabel: string;
  snapshot: ReportDraftData;
};

export type ReportTemplateHistorySummary = {
  historyId: string;
  switchedAt: string;
  fromTemplateId: string;
  fromTemplateLabel: string;
};

export type ReportDraftData = {
  schemaVersion: 2;
  revision: number;
  templateId: string;
  templateVersionId: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, ReportFieldValue>;
  evidenceAssetIds: number[];
  reportIdentity?: ReportIdentity;
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

export class ReportDraftNotFoundError extends Error {
  constructor(message = "Report draft resource not found") {
    super(message);
    this.name = "ReportDraftNotFoundError";
  }
}

function canWriteOrganization(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

function normalizeDraft(value: unknown): ReportDraftData {
  try {
    const data = value && typeof value === "object" ? value as Record<string, unknown> : {};
    const isFrozenV2 = data.schemaVersion === 2;
    if (isFrozenV2 && (typeof data.templateId !== "string" || typeof data.templateVersionId !== "string"
      || !data.templateVersionId.trim() || data.templateVersionId.length > 128)) {
      throw new ReportDocumentValidationError("Schema v2 requires its original template version");
    }
    // The shared normalizer validates v2 values against the supplied frozen
    // descriptors. The historical version id is required by that contract;
    // it is not compared with today's registry and is persisted unchanged.
    const normalized = normalizeReportDraft(data);
    return {
      ...normalized,
      ...(isFrozenV2 ? { templateVersionId: data.templateVersionId as string } : {}),
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

function sanitizeDraftIdentityLogo(draft: ReportDraftData): ReportDraftData {
  const logo = draft.reportIdentity?.schoolLogoPng;
  if (!logo) return draft;
  try {
    const sanitized = sanitizeReportSchoolLogo(logo).bytes.toString("base64");
    return {
      ...draft,
      reportIdentity: { ...draft.reportIdentity!, schoolLogoPng: sanitized },
    };
  } catch {
    throw new ReportDraftValidationError("تعذّر حفظ شعار المدرسة. اختر صورة PNG صالحة ضمن الحجم المسموح.");
  }
}

export async function saveReportDraftForUser(userId: number, input: {
  workItemId: number;
  expectedRevision: number;
  schemaVersion?: number;
  templateId: string;
  templateVersionId?: string;
  themeId: string;
  fontFamily: string;
  fields: Record<string, ReportFieldValue>;
  reportIdentity?: ReportIdentity;
  evidenceAssetIds: number[];
  fieldDefinitions?: unknown;
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

    if (current.schemaVersion === 2 && input.schemaVersion !== 2) {
      throw new ReportDraftValidationError("لا يمكن حفظ مسودة schema v2 بعقد v1؛ أعد تحميل العقد المجمد قبل الحفظ");
    }
    if (input.schemaVersion === 2 && current.schemaVersion === 2 && input.templateId !== current.templateId) {
      throw new ReportDraftValidationError("لا يمكن تغيير قالب schema مختلف دون تعيين حقول صريح؛ لم تتغير المسودة");
    }

    const linkedAssetRows = input.evidenceAssetIds.length > 0
      ? await tx
        .select({ assetId: workAssetLinks.assetId })
        .from(workAssetLinks)
        .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
        .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt))).for("update")
      : [];
    const linkedAssetIds = new Set(linkedAssetRows.map((row: { assetId: number }) => row.assetId));
    const evidenceAssetIds = Array.from(new Set(input.evidenceAssetIds)).filter(id => linkedAssetIds.has(id));

    let normalized: ReportDraftData;
    try {
      normalized = sanitizeDraftIdentityLogo(
        normalizeDraft({ ...input, revision: current.revision + 1, updatedAt: new Date().toISOString() }),
      );
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

type PreparedEvidence = {
  assetId: number;
  intentId: string;
  intentRevision: number;
  version: string;
  sha256: string;
  bytes: number;
  mimeType: string;
  preview: { mimeType: "image/png"; dataBase64: string; width: number; height: number };
};

/** Provider I/O and image sanitization deliberately happen before the version
 * transaction. The result is only a proposal; the short transaction below
 * rechecks every identity and scope before writing an immutable snapshot. */
async function prepareEvidenceOutsideTransaction(userId: number, workItemId: number, selectedIds: Set<number>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const readable = await assertReadAccess(userId, workItemId);
  if (!readable || readable.type !== "report") throw new ReportDraftAccessError();
  const linkedAssets = await db
    .select({
      id: assets.id,
      title: assets.title,
      kind: assets.kind,
      mimeType: assets.mimeType,
      fileSize: assets.fileSize,
      metadata: assets.metadata,
      role: workAssetLinks.role,
      caption: workAssetLinks.caption,
      ownerType: assets.ownerType,
      ownerUserId: assets.ownerUserId,
      ownerOrganizationId: assets.ownerOrganizationId,
    })
    .from(workAssetLinks)
    .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
    .where(and(eq(workAssetLinks.workItemId, workItemId), isNull(assets.deletedAt)));
  const candidates = linkedAssets.filter(asset => selectedIds.has(asset.id)
    && asset.kind === "file" && asset.mimeType?.toLowerCase().startsWith("image/"));
  const prepared = new Map<number, PreparedEvidence>();
  if (!candidates.length) return { linkedAssets, prepared };
  const storage = await getConfiguredPrivateStorage();
  for (const asset of candidates) {
    try {
      const before = await getReadyUploadAssetForUser(userId, asset.id);
      if (!before) throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: الأصل ليس جاهزًا أو لم تعد صلاحية الوصول إليه قائمة");
      const ready = await downloadReadyAssetForUser(userId, asset.id, storage);
      if (!ready || !/^image\/(?:png|jpeg)$/i.test(ready.mimeType)) throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: الأصل غير جاهز أو نوعه غير مدعوم");
      const after = await getReadyUploadAssetForUser(userId, asset.id);
      if (!after || after.intentId !== before.intentId || after.version !== before.version || after.sha256 !== before.sha256
        || after.bytes !== before.bytes || ready.mimeType !== after.mimeType || ready.bytes.length !== after.bytes) {
        throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: تغيرت هوية الأصل أثناء القراءة");
      }
      const [intent] = await db.select({ revision: uploadIntents.revision }).from(uploadIntents).where(eq(uploadIntents.id, after.intentId)).limit(1);
      if (!intent) throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد: سجل الرفع غير موجود");
      const preview = sanitizeEvidenceImage(ready.bytes, ready.mimeType);
      prepared.set(asset.id, {
        assetId: asset.id,
        intentId: after.intentId,
        intentRevision: intent.revision,
        version: after.version,
        sha256: after.sha256,
        bytes: after.bytes,
        mimeType: ready.mimeType,
        preview: { mimeType: "image/png", dataBase64: preview.bytes.toString("base64"), width: preview.width, height: preview.height },
      });
    } catch (error) {
      if (error instanceof ReportEvidenceFreezeError) throw error;
      throw new ReportEvidenceFreezeError("تعذر تثبيت صورة الشاهد بعد الفحص؛ لم تُنشأ النسخة");
    }
  }
  return { linkedAssets, prepared };
}

export async function createReportDraftVersionForUser(userId: number, input: {
  workItemId: number;
  expectedRevision: number;
  reason?: string;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  // This read is only preparation, never authorization proof. The transaction
  // below locks the work/draft/links and repeats all security checks.
  const [hint] = await db.select().from(contentBlocks)
    .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
    .orderBy(asc(contentBlocks.id)).limit(1);
  if (!hint) throw new ReportDraftConflictError("Save the report before creating a version");
  const preparedDraft = sanitizeDraftIdentityLogo(normalizeDraft(hint.data));
  if (preparedDraft.revision !== input.expectedRevision) throw new ReportDraftConflictError();
  const preparedEvidence = await prepareEvidenceOutsideTransaction(userId, input.workItemId, new Set(preparedDraft.evidenceAssetIds));

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
    const draft = sanitizeDraftIdentityLogo(normalizeDraft(block.data));
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
        ownerType: assets.ownerType,
        ownerUserId: assets.ownerUserId,
        ownerOrganizationId: assets.ownerOrganizationId,
        intentId: uploadIntents.id,
        intentRevision: uploadIntents.revision,
        intentState: uploadIntents.state,
        intentAssetId: uploadIntents.assetId,
        intentVersion: uploadIntents.objectVersion,
        intentSha256: uploadIntents.sha256,
        intentBytes: uploadIntents.expectedBytes,
        intentMimeType: uploadIntents.detectedMimeType,
        intentScopeKey: uploadIntents.scopeKey,
        intentTombstonedAt: uploadIntents.tombstonedAt,
      })
      .from(workAssetLinks)
      .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
      .leftJoin(uploadIntents, eq(uploadIntents.assetId, assets.id))
      .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt))).for("update");

    const selectedIds = new Set(draft.evidenceAssetIds);
    if (draft.revision !== input.expectedRevision
      || JSON.stringify(draft.evidenceAssetIds) !== JSON.stringify(preparedDraft.evidenceAssetIds)) {
      throw new ReportDraftConflictError("تغيرت المسودة أو الشواهد أثناء تجهيز النسخة؛ أعد المحاولة");
    }
    const frozenAssets = [] as Array<Record<string, unknown>>;
    for (const asset of linkedAssets) {
      // Never carry owner, intent, storage or raw metadata columns into the
      // immutable report snapshot. They are only recheck inputs for this tx.
      const base = { id: asset.id, title: asset.title, kind: asset.kind, mimeType: asset.mimeType, role: asset.role, caption: asset.caption };
      const prepared = preparedEvidence.prepared.get(asset.id);
      if (selectedIds.has(asset.id)
        && (asset.ownerType !== work.ownerType || asset.ownerUserId !== work.ownerUserId || asset.ownerOrganizationId !== work.ownerOrganizationId)) {
        throw new ReportEvidenceFreezeError("تغير نطاق شاهد التقرير أثناء تجهيز النسخة؛ لم تُنشأ النسخة");
      }
      if (!selectedIds.has(asset.id) || asset.kind !== "file" || !asset.mimeType?.toLowerCase().startsWith("image/")) {
        frozenAssets.push(base);
        continue;
      }
      if (!prepared || asset.ownerType !== work.ownerType
        || asset.ownerUserId !== work.ownerUserId || asset.ownerOrganizationId !== work.ownerOrganizationId
        || asset.intentId !== prepared.intentId || asset.intentRevision !== prepared.intentRevision
        || asset.intentState !== "ready" || asset.intentAssetId !== asset.id || asset.intentTombstonedAt
        || asset.intentVersion !== prepared.version || asset.intentSha256 !== prepared.sha256
        || asset.intentBytes !== prepared.bytes || asset.intentMimeType !== prepared.mimeType
        || asset.intentScopeKey !== (work.ownerType === "personal" ? `personal:${work.ownerUserId}` : `organization:${work.ownerOrganizationId}`)) {
        throw new ReportEvidenceFreezeError("تغيرت صلاحية أو هوية شاهد الصورة أثناء تجهيز النسخة؛ لم تُنشأ النسخة");
      }
      frozenAssets.push({ ...base, frozen: {
        referenceVersion: prepared.version,
        digest: prepared.sha256,
        bytes: prepared.bytes,
        contentType: prepared.mimeType,
        sourceAssetId: asset.id,
        sourceUploadIntentId: prepared.intentId,
        preview: prepared.preview,
      } });
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

function parseTemplateHistoryEntries(value: unknown): ReportTemplateHistoryEntry[] {
  const rawList = Array.isArray(value)
    ? value
    : value && typeof value === "object" && Array.isArray((value as Record<string, unknown>).entries)
      ? (value as Record<string, unknown>).entries as unknown[]
      : [];
  const entries: ReportTemplateHistoryEntry[] = [];
  for (const item of rawList) {
    if (!item || typeof item !== "object") continue;
    const record = item as Record<string, unknown>;
    if (
      typeof record.historyId === "string"
      && typeof record.switchedAt === "string"
      && typeof record.fromTemplateId === "string"
      && typeof record.fromTemplateLabel === "string"
      && record.snapshot
      && typeof record.snapshot === "object"
    ) {
      entries.push({
        historyId: record.historyId,
        switchedAt: record.switchedAt,
        fromTemplateId: record.fromTemplateId,
        fromTemplateLabel: record.fromTemplateLabel,
        snapshot: record.snapshot as ReportDraftData,
      });
    }
  }
  return entries.slice(0, REPORT_TEMPLATE_HISTORY_MAX_ENTRIES);
}

function assertStoredDraftIsV2(block: { data: unknown } | undefined): ReportDraftData {
  if (!block || !block.data || typeof block.data !== "object" || (block.data as Record<string, unknown>).schemaVersion !== 2) {
    throw new ReportDraftValidationError("تبديل القالب غير التدميري متاح لمسودات إصدار المخطط 2 فقط؛ احفظ المسودة أولًا");
  }
  return normalizeDraft(block.data);
}

export async function previewReportTemplateSwitchForUser(
  userId: number,
  input: { workItemId: number; targetTemplateId: string },
): Promise<TemplateSwitchPreview> {
  const work = await assertReadAccess(userId, input.workItemId);
  if (!work) throw new ReportDraftAccessError("لا تملك صلاحية الوصول إلى هذا التقرير");
  if (work.type !== "report") throw new ReportDraftAccessError("تبديل القوالب متاح لأعمال التقارير فقط");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [block] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
    .orderBy(asc(contentBlocks.id))
    .limit(1);

  const current = assertStoredDraftIsV2(block);
  try {
    return previewTemplateSwitch(current, input.targetTemplateId);
  } catch (error) {
    if (error instanceof ReportDocumentValidationError) throw new ReportDraftValidationError(error.message);
    throw error;
  }
}

export async function switchReportTemplateForUser(
  userId: number,
  input: {
    workItemId: number;
    expectedRevision: number;
    targetTemplateId: string;
    unmappedStrategy: "append_to_summary" | "discard";
  },
): Promise<{ revision: number; updatedAt: string; historyId: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError("لا تملك صلاحية تعديل هذا التقرير");
    if (work.type !== "report") throw new ReportDraftAccessError("تبديل القوالب متاح لأعمال التقارير فقط");
    if (work.status === "archived") throw new ReportDraftConflictError("لا يمكن تعديل عمل مؤرشف");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const current = assertStoredDraftIsV2(block);
    if (current.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    let switched: NormalizedReportDraft;
    try {
      switched = applyTemplateSwitch(current, input.targetTemplateId, input.unmappedStrategy);
    } catch (error) {
      if (error instanceof ReportDocumentValidationError) throw new ReportDraftValidationError(error.message);
      throw error;
    }

    const [historyBlock] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_TEMPLATE_HISTORY_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const existingHistory = historyBlock ? parseTemplateHistoryEntries(historyBlock.data) : [];
    const historyId = randomBytes(12).toString("hex");
    const switchedAt = new Date().toISOString();
    const fromTemplateLabel = REPORT_TEMPLATE_DEFINITIONS[current.templateId]?.label ?? current.templateId;
    const nextHistory: ReportTemplateHistoryEntry[] = [
      {
        historyId,
        switchedAt,
        fromTemplateId: current.templateId,
        fromTemplateLabel,
        snapshot: current,
      },
      ...existingHistory,
    ].slice(0, REPORT_TEMPLATE_HISTORY_MAX_ENTRIES);

    if (historyBlock) {
      await tx
        .update(contentBlocks)
        .set({ data: { entries: nextHistory }, updatedAt: new Date() })
        .where(and(eq(contentBlocks.id, historyBlock.id), eq(contentBlocks.workItemId, input.workItemId)));
    } else {
      await tx.insert(contentBlocks).values({
        workItemId: input.workItemId,
        blockType: REPORT_TEMPLATE_HISTORY_BLOCK,
        sortOrder: 1,
        data: { entries: nextHistory },
      });
    }

    const nextDraft: ReportDraftData = sanitizeDraftIdentityLogo({
      ...switched,
      revision: current.revision + 1,
      updatedAt: switchedAt,
    });

    await tx
      .update(contentBlocks)
      .set({ data: nextDraft, updatedAt: new Date() })
      .where(and(eq(contentBlocks.id, block!.id), eq(contentBlocks.workItemId, input.workItemId)));
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));

    return {
      revision: nextDraft.revision,
      updatedAt: nextDraft.updatedAt,
      historyId,
    };
  });
}

export async function rollbackReportTemplateForUser(
  userId: number,
  input: {
    workItemId: number;
    expectedRevision: number;
    historyId: string;
  },
): Promise<{ revision: number; updatedAt: string }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError("لا تملك صلاحية تعديل هذا التقرير");
    if (work.type !== "report") throw new ReportDraftAccessError("تبديل القوالب متاح لأعمال التقارير فقط");
    if (work.status === "archived") throw new ReportDraftConflictError("لا يمكن تعديل عمل مؤرشف");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const current = assertStoredDraftIsV2(block);
    if (current.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    const [historyBlock] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_TEMPLATE_HISTORY_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const entries = historyBlock ? parseTemplateHistoryEntries(historyBlock.data) : [];
    const targetEntry = entries.find(entry => entry.historyId === input.historyId);
    if (!targetEntry) {
      throw new ReportDraftNotFoundError("سجل القالب المطلوب غير موجود أو تمت إزالته");
    }

    const restoredBase = normalizeDraft(targetEntry.snapshot);
    const updatedAt = new Date().toISOString();
    const restoredDraft: ReportDraftData = sanitizeDraftIdentityLogo({
      ...restoredBase,
      revision: current.revision + 1,
      updatedAt,
    });

    await tx
      .update(contentBlocks)
      .set({ data: restoredDraft, updatedAt: new Date() })
      .where(and(eq(contentBlocks.id, block!.id), eq(contentBlocks.workItemId, input.workItemId)));
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));

    return {
      revision: restoredDraft.revision,
      updatedAt: restoredDraft.updatedAt,
    };
  });
}

export async function listReportTemplateHistoryForUser(
  userId: number,
  workItemId: number,
): Promise<ReportTemplateHistorySummary[]> {
  const work = await assertReadAccess(userId, workItemId);
  if (!work) throw new ReportDraftAccessError("لا تملك صلاحية الوصول إلى هذا التقرير");
  if (work.type !== "report") throw new ReportDraftAccessError("سجل القوالب متاح لأعمال التقارير فقط");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [historyBlock] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.workItemId, workItemId), eq(contentBlocks.blockType, REPORT_TEMPLATE_HISTORY_BLOCK)))
    .orderBy(asc(contentBlocks.id))
    .limit(1);

  if (!historyBlock) return [];
  return parseTemplateHistoryEntries(historyBlock.data).map(({ historyId, switchedAt, fromTemplateId, fromTemplateLabel }) => ({
    historyId,
    switchedAt,
    fromTemplateId,
    fromTemplateLabel,
  }));
}

export async function restoreReportVersionAsDraftForUser(
  userId: number,
  input: {
    workItemId: number;
    expectedRevision: number;
    versionId: number;
  },
): Promise<{ revision: number; updatedAt: string; restoredFromVersionNumber: number }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new ReportDraftAccessError("لا تملك صلاحية تعديل هذا التقرير");
    if (work.type !== "report") throw new ReportDraftAccessError("استعادة النسخ متاحة لأعمال التقارير فقط");
    if (work.status === "archived") throw new ReportDraftConflictError("لا يمكن تعديل عمل مؤرشف");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const current = block ? normalizeDraft(block.data) : normalizeDraft(undefined);
    if (current.revision !== input.expectedRevision) throw new ReportDraftConflictError();

    const [versionRow] = await tx
      .select()
      .from(workVersions)
      .where(and(eq(workVersions.id, input.versionId), eq(workVersions.workItemId, input.workItemId)))
      .limit(1);
    if (!versionRow) {
      throw new ReportDraftNotFoundError("النسخة المطلوبة غير موجودة لهذا العمل");
    }

    const snapshot = versionRow.snapshot && typeof versionRow.snapshot === "object"
      ? versionRow.snapshot as Record<string, unknown>
      : undefined;
    if (!snapshot?.reportDraft) {
      throw new ReportDraftValidationError("النسخة المحددة لا تحتوي على مسودة تقرير قابلة للاستعادة");
    }

    const restoredBase = normalizeDraft(snapshot.reportDraft);
    const linkedAssetRows = restoredBase.evidenceAssetIds.length > 0
      ? await tx
        .select({ assetId: workAssetLinks.assetId })
        .from(workAssetLinks)
        .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
        .where(and(eq(workAssetLinks.workItemId, input.workItemId), isNull(assets.deletedAt)))
      : [];
    const linkedIds = new Set(linkedAssetRows.map((row: { assetId: number }) => row.assetId));
    const safeEvidenceIds = restoredBase.evidenceAssetIds.filter(id => linkedIds.has(id));

    // Save current head into template history so the restore itself is undoable
    if (block) {
      const [historyBlock] = await tx
        .select()
        .from(contentBlocks)
        .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, REPORT_TEMPLATE_HISTORY_BLOCK)))
        .orderBy(asc(contentBlocks.id))
        .limit(1)
        .for("update");
      const existingHistory = historyBlock ? parseTemplateHistoryEntries(historyBlock.data) : [];
      const historyId = randomBytes(12).toString("hex");
      const switchedAt = new Date().toISOString();
      const fromTemplateLabel = REPORT_TEMPLATE_DEFINITIONS[current.templateId]?.label ?? current.templateId;
      const nextHistory: ReportTemplateHistoryEntry[] = [
        { historyId, switchedAt, fromTemplateId: current.templateId, fromTemplateLabel, snapshot: current },
        ...existingHistory,
      ].slice(0, REPORT_TEMPLATE_HISTORY_MAX_ENTRIES);

      if (historyBlock) {
        await tx
          .update(contentBlocks)
          .set({ data: { entries: nextHistory }, updatedAt: new Date() })
          .where(and(eq(contentBlocks.id, historyBlock.id), eq(contentBlocks.workItemId, input.workItemId)));
      } else {
        await tx.insert(contentBlocks).values({
          workItemId: input.workItemId,
          blockType: REPORT_TEMPLATE_HISTORY_BLOCK,
          sortOrder: 1,
          data: { entries: nextHistory },
        });
      }
    }

    const updatedAt = new Date().toISOString();
    const restoredDraft: ReportDraftData = sanitizeDraftIdentityLogo({
      ...restoredBase,
      evidenceAssetIds: safeEvidenceIds,
      revision: current.revision + 1,
      updatedAt,
    });

    if (block) {
      await tx
        .update(contentBlocks)
        .set({ data: restoredDraft, updatedAt: new Date() })
        .where(and(eq(contentBlocks.id, block.id), eq(contentBlocks.workItemId, input.workItemId)));
    } else {
      await tx.insert(contentBlocks).values({
        workItemId: input.workItemId,
        blockType: REPORT_DOCUMENT_BLOCK,
        sortOrder: 0,
        data: restoredDraft,
      });
    }
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));

    return {
      revision: restoredDraft.revision,
      updatedAt: restoredDraft.updatedAt,
      restoredFromVersionNumber: versionRow.versionNumber,
    };
  });
}
