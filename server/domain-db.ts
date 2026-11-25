import { and, asc, desc, eq, inArray, isNull, or } from "drizzle-orm";
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
import { captureAcademicContext } from "./account-db";
import { normalizeReportDraft, ReportDocumentValidationError } from "../shared/report-projection";
import { normalizePortfolioDraft, PortfolioValidationError } from "../shared/portfolio-projection";

export type WorkAccessMode = "read" | "write";
export type NewWorkItem = typeof workItems.$inferInsert;
export type NewAsset = typeof assets.$inferInsert;

type WorkRow = typeof workItems.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type MembershipRow = typeof memberships.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class WorkCopyValidationError extends Error {
  constructor(message = "تعذر نسخ هذا العمل لأن مسودته بصيغة غير صالحة أو غير مدعومة") {
    super(message);
    this.name = "WorkCopyValidationError";
  }
}

function isSelfEvaluationModuleWork(work: { metadata: Record<string, unknown> | null }) {
  return work.metadata?.module === "self_evaluation";
}

export class WorkVersionConflictError extends Error {
  constructor() {
    super("Work version conflict");
    this.name = "WorkVersionConflictError";
  }
}

export class AssetDeleteConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AssetDeleteConflictError";
  }
}

/** Bounded scan limit when counting historical work_versions referencing an asset. */
export const ASSET_USAGE_VERSION_SCAN_LIMIT = 500;

function getAffectedRows(result: unknown): number {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (candidate && typeof candidate === "object" && "affectedRows" in candidate) {
    return Number((candidate as { affectedRows?: number }).affectedRows ?? 0);
  }
  return 0;
}

async function activeMembership(userId: number, organizationId: number): Promise<MembershipRow | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ membership: memberships })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(
      eq(organizations.status, "active"),
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1);
  return row?.membership;
}

function canWriteOrganization(role: MembershipRow["role"]) {
  return role === "owner" || role === "admin" || role === "member";
}

function sameOwnershipScope(work: WorkRow, asset: AssetRow) {
  if (work.ownerType !== asset.ownerType) return false;
  if (work.ownerType === "personal") return work.ownerUserId === asset.ownerUserId;
  return Boolean(work.ownerOrganizationId && work.ownerOrganizationId === asset.ownerOrganizationId);
}

export async function assertWorkAccess(userId: number, workItemId: number, mode: WorkAccessMode = "read") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [work] = await db.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1);
  if (!work) return undefined;

  if (work.ownerType === "personal") {
    const allowed = work.ownerUserId === userId;
    return allowed ? work : undefined;
  }

  if (!work.ownerOrganizationId) return undefined;
  const membership = await activeMembership(userId, work.ownerOrganizationId);
  if (!membership) return undefined;
  if (mode === "write") {
    if (isSelfEvaluationModuleWork(work)) {
      if (membership.role !== "owner" && membership.role !== "admin") return undefined;
    } else if (!canWriteOrganization(membership.role)) {
      return undefined;
    }
  }
  return work;
}

export async function assertAssetAccess(userId: number, assetId: number, mode: WorkAccessMode = "read") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [asset] = await db.select().from(assets).where(and(eq(assets.id, assetId), isNull(assets.deletedAt))).limit(1);
  if (!asset) return undefined;

  if (asset.ownerType === "personal") {
    const allowed = asset.ownerUserId === userId;
    return allowed ? asset : undefined;
  }

  if (!asset.ownerOrganizationId) return undefined;
  const membership = await activeMembership(userId, asset.ownerOrganizationId);
  if (!membership) return undefined;
  if (mode === "write" && !canWriteOrganization(membership.role)) return undefined;
  return asset;
}

export async function listWorkItemsForUser(userId: number, filter?: { academicYearId?: number; academicTermId?: number; unassigned?: boolean }) {
  const db = await getDb();
  if (!db) return [];

  const memberOf = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")));
  const organizationIds = memberOf.map(row => row.organizationId);

  const ownership = organizationIds.length > 0
    ? or(and(eq(workItems.ownerType, "personal"), eq(workItems.ownerUserId, userId)), and(eq(workItems.ownerType, "organization"), inArray(workItems.ownerOrganizationId, organizationIds)))
    : and(eq(workItems.ownerType, "personal"), eq(workItems.ownerUserId, userId));

  return db.select().from(workItems)
    .where(and(isNull(workItems.deletedAt), ownership, filter?.academicYearId ? eq(workItems.academicYearId, filter.academicYearId) : undefined, filter?.academicTermId ? eq(workItems.academicTermId, filter.academicTermId) : undefined, filter?.unassigned ? isNull(workItems.academicYearId) : undefined))
    .orderBy(desc(workItems.updatedAt));
}

/** Lock scope before a work/asset so revocation and writes serialize. */
async function lockWriteScope(
  tx: Transaction,
  userId: number,
  ownerType: "personal" | "organization",
  organizationId?: number | null,
  options?: { requireOrgAdmin?: boolean },
) {
  if (ownerType === "personal") {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    return Boolean(user);
  }
  if (!organizationId) return false;
  const [organization] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
  if (!organization || organization.status !== "active") return false;
  const [member] = await tx.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId), eq(memberships.status, "active"))).limit(1).for("update");
  if (!member) return false;
  if (options?.requireOrgAdmin) {
    return member.role === "owner" || member.role === "admin";
  }
  return canWriteOrganization(member.role);
}
async function withWorkWrite<T>(userId: number, workItemId: number, operation: (tx: Transaction, work: WorkRow) => Promise<T>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const [hint] = await db.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1);
  if (!hint || (hint.ownerType === "personal" && hint.ownerUserId !== userId)) return undefined;
  const requireOrgAdmin = hint.ownerType === "organization" && isSelfEvaluationModuleWork(hint);
  return db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, hint.ownerType, hint.ownerOrganizationId, { requireOrgAdmin })) return undefined;
    const [work] = await tx.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1).for("update");
    if (!work || work.ownerType !== hint.ownerType || work.ownerUserId !== hint.ownerUserId || work.ownerOrganizationId !== hint.ownerOrganizationId) return undefined;
    if (work.ownerType === "organization" && isSelfEvaluationModuleWork(work) && !requireOrgAdmin) return undefined;
    return operation(tx, work);
  });
}

export async function createWorkItemForUser(userId: number, input: {
  title: string; type: "report" | "portfolio"; ownerType?: "personal" | "organization"; organizationId?: number;
  academicYearId?: number; academicTermId?: number;
}) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const ownerType = input.ownerType ?? "personal";
  const id = await db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, ownerType, input.organizationId)) throw new Error("Organization write access denied");
    const scopeKey = ownerType === "personal" ? `personal:${userId}` : `organization:${input.organizationId}`;
    const academicContext = await captureAcademicContext(tx, scopeKey, input.academicYearId, input.academicTermId);
    const value: NewWorkItem = {
      creatorUserId: userId, ownerType, ownerUserId: ownerType === "personal" ? userId : null,
      ownerOrganizationId: ownerType === "organization" ? input.organizationId! : null,
      type: input.type, title: input.title, status: "draft", currentVersionNumber: 0,
      academicYearId: input.academicYearId ?? null, academicTermId: input.academicTermId ?? null, academicContext,
    };
    const [inserted] = await tx.insert(workItems).values(value); return Number(inserted.insertId);
  });
  return getWorkItemForUser(userId, id);
}

export async function getWorkItemForUser(userId: number, workItemId: number) {
  const work = await assertWorkAccess(userId, workItemId, "read");
  if (!work) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const linkedAssets = await db
    .select({ id: assets.id, title: assets.title, kind: assets.kind, mimeType: assets.mimeType, role: workAssetLinks.role, caption: workAssetLinks.caption })
    .from(workAssetLinks)
    .innerJoin(assets, eq(workAssetLinks.assetId, assets.id))
    .where(and(eq(workAssetLinks.workItemId, workItemId), isNull(assets.deletedAt)));

  const visibleAssets = [];
  for (const linkedAsset of linkedAssets) {
    if (await assertAssetAccess(userId, linkedAsset.id, "read")) visibleAssets.push(linkedAsset);
  }
  // `viewerIsCreator` & `viewerCanWrite` let the UI match server-side authorization rules accurately.
  const viewerCanWrite = Boolean(await assertWorkAccess(userId, workItemId, "write"));
  return { ...work, assets: visibleAssets, viewerIsCreator: work.creatorUserId === userId, viewerCanWrite };
}

export async function updateWorkItemForUser(
  userId: number,
  workItemId: number,
  patch: { title?: string; academicYearId?: number | null; academicTermId?: number | null },
) {
  const updated = await withWorkWrite(userId, workItemId, async (tx, work) => {
    if (work.status === "archived") throw new WorkVersionConflictError();
    const updates: Partial<NewWorkItem> = {};
    if (patch.title !== undefined) updates.title = patch.title;
    if (patch.academicYearId !== undefined || patch.academicTermId !== undefined) {
      const scopeKey = work.ownerType === "personal"
        ? `personal:${work.ownerUserId}`
        : `organization:${work.ownerOrganizationId}`;
      const nextYearId = patch.academicYearId !== undefined ? patch.academicYearId : work.academicYearId;
      let nextTermId: number | null;
      if (patch.academicTermId !== undefined) {
        nextTermId = patch.academicTermId;
      } else if (patch.academicYearId === null || patch.academicYearId !== work.academicYearId) {
        nextTermId = null;
      } else {
        nextTermId = work.academicTermId;
      }
      const academicContext = await captureAcademicContext(
        tx,
        scopeKey,
        nextYearId ?? undefined,
        nextTermId ?? undefined,
      );
      updates.academicYearId = nextYearId ?? null;
      updates.academicTermId = nextTermId ?? null;
      updates.academicContext = academicContext;
    }
    if (Object.keys(updates).length > 0) {
      await tx.update(workItems).set(updates).where(eq(workItems.id, workItemId));
    }
    return true;
  });
  return updated ? getWorkItemForUser(userId, workItemId) : undefined;
}

export async function softDeleteWorkItemForUser(userId: number, workItemId: number) {
  return Boolean(await withWorkWrite(userId, workItemId, async tx => {
    await tx.update(workItems).set({ deletedAt: new Date() }).where(eq(workItems.id, workItemId)); return true;
  }));
}

/**
 * Pure sanitizer enforcing O003 & D015 when copying an organizational work's
 * editable draft structure into an educator's personal workspace:
 * - Preserves text fields, template choice, and educator preparer name.
 * - Strips organization-owned `evidenceAssetIds`, `schoolLogoPng`, `schoolName`,
 *   `schoolPrincipal`, and cross-scope portfolio entries.
 */
export function sanitizeCopiedDraftForPersonalScope(
  type: "report" | "portfolio",
  rawBlockData: Record<string, unknown> | undefined,
): { blockType: "report_document" | "portfolio_document"; data: Record<string, unknown> } | undefined {
  if (!rawBlockData) return undefined;
  const nowIso = new Date().toISOString();
  if (type === "report") {
    let normalized: ReturnType<typeof normalizeReportDraft>;
    try {
      normalized = normalizeReportDraft(rawBlockData);
    } catch (error) {
      if (error instanceof ReportDocumentValidationError) throw new WorkCopyValidationError();
      throw error;
    }
    const sanitizedIdentity = normalized.reportIdentity?.reportPreparer
      ? {
          version: normalized.reportIdentity.version,
          reportPreparer: normalized.reportIdentity.reportPreparer,
        }
      : undefined;
    const { reportIdentity: _droppedIdentity, migratedFromSchemaVersion: _droppedMig, ...restNormalized } = normalized;
    return {
      blockType: "report_document",
      data: {
        ...restNormalized,
        revision: 1,
        evidenceAssetIds: [],
        ...(sanitizedIdentity ? { reportIdentity: sanitizedIdentity } : {}),
        updatedAt: nowIso,
      },
    };
  }
  let normalizedPortfolio: ReturnType<typeof normalizePortfolioDraft>;
  try {
    normalizedPortfolio = normalizePortfolioDraft(rawBlockData);
  } catch (error) {
    if (error instanceof PortfolioValidationError) throw new WorkCopyValidationError();
    throw error;
  }
  return {
    blockType: "portfolio_document",
    data: {
      ...normalizedPortfolio,
      revision: 1,
      entries: [],
      updatedAt: nowIso,
    },
  };
}

/**
 * Copies the caller's OWN work structure/draft into an independent personal draft
 * (`O003`, proposed policy), leaving school versions, approvals, outputs, and
 * organization-scoped evidence untouched in the original school workspace.
 *
 * Server-side rules (review finding M1/L8):
 * - Only the work's author (`creatorUserId`) may copy it; school members cannot
 *   harvest colleagues' work. For school works the author must still be an active
 *   writer (owner/admin/member) of that active school; `reviewer` role is excluded.
 * - Self-evaluation cycles are institutional and are never copied.
 * - The locked row must still match the scope that was authorized.
 * - Idempotent: a repeated request returns the existing live personal copy.
 */
export async function copyWorkToPersonalForUser(userId: number, sourceWorkItemId: number) {
  const readable = await assertWorkAccess(userId, sourceWorkItemId, "read");
  if (!readable) return undefined;
  if (readable.creatorUserId !== userId || isSelfEvaluationModuleWork(readable)) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const newWorkId = await db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, "personal", null)) return undefined;
    if (readable.ownerType === "organization") {
      if (!readable.ownerOrganizationId) return undefined;
      const [org] = await tx
        .select()
        .from(organizations)
        .where(eq(organizations.id, readable.ownerOrganizationId))
        .limit(1)
        .for("update");
      if (!org || org.status !== "active") return undefined;
      const [member] = await tx
        .select()
        .from(memberships)
        .where(and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, readable.ownerOrganizationId),
          eq(memberships.status, "active"),
        ))
        .limit(1)
        .for("update");
      if (!member || !canWriteOrganization(member.role)) return undefined;
    }

    const [source] = await tx
      .select()
      .from(workItems)
      .where(and(eq(workItems.id, sourceWorkItemId), isNull(workItems.deletedAt)))
      .limit(1)
      .for("update");
    if (
      !source ||
      source.ownerType !== readable.ownerType ||
      source.ownerUserId !== readable.ownerUserId ||
      source.ownerOrganizationId !== readable.ownerOrganizationId ||
      source.creatorUserId !== userId ||
      isSelfEvaluationModuleWork(source)
    ) {
      return undefined;
    }

    // Idempotency: the personal scope (user row) is locked above, so concurrent
    // double-submits serialize here and the second one reuses the first copy.
    const existingCopies = await tx
      .select({ id: workItems.id, metadata: workItems.metadata })
      .from(workItems)
      .where(and(
        eq(workItems.ownerType, "personal"),
        eq(workItems.ownerUserId, userId),
        eq(workItems.type, source.type),
        isNull(workItems.deletedAt),
      ));
    const existingCopy = existingCopies.find(row => row.metadata?.copiedFromWorkItemId === source.id);
    if (existingCopy) return existingCopy.id;

    const targetBlockType = source.type === "report" ? "report_document" : "portfolio_document";
    const [sourceBlock] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, source.id), eq(contentBlocks.blockType, targetBlockType)))
      .orderBy(asc(contentBlocks.id))
      .limit(1);

    const personalTitle = `${source.title} (نسخة شخصية)`.slice(0, 255);
    const [inserted] = await tx.insert(workItems).values({
      creatorUserId: userId,
      ownerType: "personal",
      ownerUserId: userId,
      ownerOrganizationId: null,
      type: source.type,
      title: personalTitle,
      status: "draft",
      currentVersionNumber: 0,
      academicYearId: null,
      academicTermId: null,
      academicContext: null,
      metadata: {
        copiedAsPersonalDraft: true,
        copiedFromWorkItemId: source.id,
        sourceOwnerType: source.ownerType,
      },
    });
    const createdId = Number(inserted.insertId);

    const sanitizedBlock = sanitizeCopiedDraftForPersonalScope(source.type, sourceBlock?.data);
    if (sanitizedBlock) {
      await tx.insert(contentBlocks).values({
        workItemId: createdId,
        blockType: sanitizedBlock.blockType,
        sortOrder: 0,
        data: sanitizedBlock.data,
      });
    }

    return createdId;
  });

  return newWorkId ? getWorkItemForUser(userId, newWorkId) : undefined;
}

export async function createWorkVersionForUser(userId: number, workItemId: number, snapshot: Record<string, unknown>, reason?: string) {
  return withWorkWrite(userId, workItemId, async (tx, work) => {
    // Self-evaluation cycles are not versioned/reviewed/shared through the generic
    // work pipeline (review finding L9); they are managed only by their own module.
    if (isSelfEvaluationModuleWork(work)) return undefined;
    if (work.status === "archived") throw new WorkVersionConflictError();
    const expectedVersion = work.currentVersionNumber;
    const nextVersion = expectedVersion + 1;
    // Approval belongs to the previous immutable version, never its successor.
    const updated = await tx.update(workItems).set({ currentVersionNumber: nextVersion, status: "draft" }).where(and(eq(workItems.id, workItemId), eq(workItems.currentVersionNumber, expectedVersion)));
    if (getAffectedRows(updated) !== 1) throw new WorkVersionConflictError();
    const inserted = await tx.insert(workVersions).values({ workItemId, versionNumber: nextVersion,
      createdByUserId: userId, snapshot: { ...snapshot, academicContext: work.academicContext }, reason: reason ?? null });
    return { id: Number(inserted[0].insertId), versionNumber: nextVersion };
  });
}

export async function listAssetsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberOf = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")));
  const organizationIds = memberOf.map(row => row.organizationId);
  const ownership = organizationIds.length > 0
    ? or(and(eq(assets.ownerType, "personal"), eq(assets.ownerUserId, userId)), and(eq(assets.ownerType, "organization"), inArray(assets.ownerOrganizationId, organizationIds)))
    : and(eq(assets.ownerType, "personal"), eq(assets.ownerUserId, userId));
  const rows = await db.select().from(assets).where(and(isNull(assets.deletedAt), ownership)).orderBy(desc(assets.updatedAt));
  return rows.map(row => ({ id: row.id, title: row.title, kind: row.kind, ownerType: row.ownerType,
    ownerUserId: row.ownerUserId, ownerOrganizationId: row.ownerOrganizationId,
    mimeType: row.mimeType, fileSize: row.fileSize, createdAt: row.createdAt, updatedAt: row.updatedAt,
    externalUrl: row.kind === "link" && /^https?:\/\//i.test(row.externalUrl ?? "") ? row.externalUrl : null,
    metadata: row.kind === "text" && typeof row.metadata?.text === "string" ? { text: row.metadata.text } : null,
  }));
}

export async function createAssetForUser(userId: number, input: {
  title: string;
  kind: "file" | "link" | "text";
  ownerType?: "personal" | "organization";
  organizationId?: number;
  storageKey?: string;
  externalUrl?: string;
  mimeType?: string;
  fileSize?: number;
  metadata?: Record<string, unknown>;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const ownerType = input.ownerType ?? "personal";
  const id = await db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, ownerType, input.organizationId)) throw new Error("Organization write access denied");
    const value: NewAsset = { creatorUserId: userId, ownerType, ownerUserId: ownerType === "personal" ? userId : null,
      ownerOrganizationId: ownerType === "organization" ? input.organizationId! : null, title: input.title, kind: input.kind,
      storageKey: input.storageKey ?? null, externalUrl: input.externalUrl ?? null, mimeType: input.mimeType ?? null,
      fileSize: input.fileSize ?? null, metadata: input.metadata ?? null };
    const [inserted] = await tx.insert(assets).values(value); return Number(inserted.insertId);
  });
  return assertAssetAccess(userId, id, "read");
}

export async function linkAssetToWorkForUser(userId: number, input: { workItemId: number; assetId: number; role?: string; caption?: string }) {
  return withWorkWrite(userId, input.workItemId, async (tx, work) => {
    if (isSelfEvaluationModuleWork(work)) return undefined;
    const [asset] = await tx.select().from(assets).where(and(eq(assets.id, input.assetId), isNull(assets.deletedAt))).limit(1).for("update");
    if (!asset || !sameOwnershipScope(work, asset)) return undefined;
    const role = input.role ?? "evidence";
    await tx.insert(workAssetLinks).values({ workItemId: input.workItemId, assetId: input.assetId, role, caption: input.caption ?? null }).onDuplicateKeyUpdate({ set: { caption: input.caption ?? null } });
    return { success: true, workItemId: input.workItemId, assetId: input.assetId, role };
  });
}

export async function unlinkAssetFromWorkForUser(userId: number, input: { workItemId: number; assetId: number; role?: string }) {
  return Boolean(await withWorkWrite(userId, input.workItemId, async (tx, work) => {
    if (isSelfEvaluationModuleWork(work)) return false;
    await tx.delete(workAssetLinks).where(and(eq(workAssetLinks.workItemId, input.workItemId), eq(workAssetLinks.assetId, input.assetId), eq(workAssetLinks.role, input.role ?? "evidence")));
    return true;
  }));
}

function snapshotReferencesAsset(snapshot: unknown, assetId: number): boolean {
  if (!snapshot || typeof snapshot !== "object") return false;
  const record = snapshot as Record<string, unknown>;
  if (Array.isArray(record.assets)) {
    for (const item of record.assets) {
      if (item && typeof item === "object" && (item as Record<string, unknown>).id === assetId) {
        return true;
      }
    }
  }
  const reportDraft = record.reportDraft;
  if (reportDraft && typeof reportDraft === "object") {
    const evidenceIds = (reportDraft as Record<string, unknown>).evidenceAssetIds;
    if (Array.isArray(evidenceIds) && evidenceIds.includes(assetId)) {
      return true;
    }
  }
  return false;
}

export type AssetUsageSummary = {
  assetId: number;
  activeLinks: Array<{
    workItemId: number;
    workTitle: string;
    workType: string;
    workStatus: string;
    role: string;
  }>;
  historicalVersionCount: number;
};

export async function getAssetUsageForUser(userId: number, assetId: number): Promise<AssetUsageSummary | undefined> {
  const asset = await assertAssetAccess(userId, assetId, "read");
  if (!asset) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const memberOf = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")));
  const organizationIds = memberOf.map(row => row.organizationId);
  const readableWorkScope = organizationIds.length > 0
    ? or(
      and(eq(workItems.ownerType, "personal"), eq(workItems.ownerUserId, userId)),
      and(eq(workItems.ownerType, "organization"), inArray(workItems.ownerOrganizationId, organizationIds)),
    )
    : and(eq(workItems.ownerType, "personal"), eq(workItems.ownerUserId, userId));

  const activeRows = await db
    .select({
      workItemId: workItems.id,
      workTitle: workItems.title,
      workType: workItems.type,
      workStatus: workItems.status,
      role: workAssetLinks.role,
    })
    .from(workAssetLinks)
    .innerJoin(workItems, eq(workAssetLinks.workItemId, workItems.id))
    .where(and(eq(workAssetLinks.assetId, assetId), isNull(workItems.deletedAt), readableWorkScope))
    .orderBy(desc(workItems.updatedAt));

  // Bounded scan (max ASSET_USAGE_VERSION_SCAN_LIMIT = 500 newest readable versions)
  const versionRows = await db
    .select({ snapshot: workVersions.snapshot })
    .from(workVersions)
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(and(isNull(workItems.deletedAt), readableWorkScope))
    .orderBy(desc(workVersions.id))
    .limit(ASSET_USAGE_VERSION_SCAN_LIMIT);

  let historicalVersionCount = 0;
  for (const row of versionRows) {
    if (snapshotReferencesAsset(row.snapshot, assetId)) {
      historicalVersionCount += 1;
    }
  }

  return {
    assetId,
    activeLinks: activeRows,
    historicalVersionCount,
  };
}

/**
 * Soft-delete an asset after checking active work links.
 * Never mutates immutable `work_versions` rows.
 * Only sets `assets.deletedAt`; upload-intent tombstones/legal-hold lifecycle
 * are intentionally left untouched so frozen references remain auditable.
 */
export async function deleteAssetForUser(
  userId: number,
  input: { id: number; unlinkActive?: boolean },
): Promise<{ deleted: true; unlinkedCount: number } | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const [hint] = await db
    .select()
    .from(assets)
    .where(and(eq(assets.id, input.id), isNull(assets.deletedAt)))
    .limit(1);
  if (!hint || (hint.ownerType === "personal" && hint.ownerUserId !== userId)) return undefined;

  return db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, hint.ownerType, hint.ownerOrganizationId)) return undefined;
    const [asset] = await tx
      .select()
      .from(assets)
      .where(and(eq(assets.id, input.id), isNull(assets.deletedAt)))
      .limit(1)
      .for("update");
    if (!asset || asset.ownerType !== hint.ownerType || asset.ownerUserId !== hint.ownerUserId || asset.ownerOrganizationId !== hint.ownerOrganizationId) {
      return undefined;
    }

    const activeLinks = await tx
      .select({
        linkId: workAssetLinks.id,
        workItemId: workItems.id,
        workStatus: workItems.status,
      })
      .from(workAssetLinks)
      .innerJoin(workItems, eq(workAssetLinks.workItemId, workItems.id))
      .where(and(eq(workAssetLinks.assetId, asset.id), isNull(workItems.deletedAt)))
      .for("update");

    if (activeLinks.length > 0 && !input.unlinkActive) {
      throw new AssetDeleteConflictError("الشاهد مستخدم في أعمال أخرى. أكد فك الربط ثم الحذف.");
    }

    let unlinkedCount = 0;
    if (activeLinks.length > 0 && input.unlinkActive) {
      const lockedLinks = activeLinks.filter(link => link.workStatus === "approved" || link.workStatus === "archived");
      if (lockedLinks.length > 0) {
        throw new AssetDeleteConflictError("لا يمكن حذف الشاهد لأنه مرتبط بعمل معتمد أو مؤرشف");
      }
      const unlockedIds = activeLinks.map(link => link.linkId);
      await tx.delete(workAssetLinks).where(inArray(workAssetLinks.id, unlockedIds));
      unlinkedCount = unlockedIds.length;
    }

    await tx.update(assets).set({ deletedAt: new Date() }).where(eq(assets.id, asset.id));
    return { deleted: true as const, unlinkedCount };
  });
}

export async function listOrganizationsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({ id: organizations.id, name: organizations.name, status: organizations.status, role: memberships.role })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")))
    .orderBy(organizations.name);
}
