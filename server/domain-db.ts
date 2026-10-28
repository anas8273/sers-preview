import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  assets,
  memberships,
  organizations,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { getDb } from "./db";
import { users } from "../drizzle/schema";
import { captureAcademicContext } from "./account-db";

export type WorkAccessMode = "read" | "write";
export type NewWorkItem = typeof workItems.$inferInsert;
export type NewAsset = typeof assets.$inferInsert;

type WorkRow = typeof workItems.$inferSelect;
type AssetRow = typeof assets.$inferSelect;
type MembershipRow = typeof memberships.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

export class WorkVersionConflictError extends Error {
  constructor() {
    super("Work version conflict");
    this.name = "WorkVersionConflictError";
  }
}

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
  if (mode === "write" && !canWriteOrganization(membership.role)) return undefined;
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
async function lockWriteScope(tx: Transaction, userId: number, ownerType: "personal" | "organization", organizationId?: number | null) {
  if (ownerType === "personal") {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    return Boolean(user);
  }
  if (!organizationId) return false;
  const [organization] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
  if (!organization || organization.status !== "active") return false;
  const [member] = await tx.select().from(memberships).where(and(eq(memberships.userId, userId), eq(memberships.organizationId, organizationId), eq(memberships.status, "active"))).limit(1).for("update");
  return Boolean(member && canWriteOrganization(member.role));
}
async function withWorkWrite<T>(userId: number, workItemId: number, operation: (tx: Transaction, work: WorkRow) => Promise<T>) {
  const db = await getDb(); if (!db) throw new Error("Database not available");
  const [hint] = await db.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1);
  if (!hint || (hint.ownerType === "personal" && hint.ownerUserId !== userId)) return undefined;
  return db.transaction(async tx => {
    if (!await lockWriteScope(tx, userId, hint.ownerType, hint.ownerOrganizationId)) return undefined;
    const [work] = await tx.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1).for("update");
    if (!work || work.ownerType !== hint.ownerType || work.ownerUserId !== hint.ownerUserId || work.ownerOrganizationId !== hint.ownerOrganizationId) return undefined;
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
  return { ...work, assets: visibleAssets };
}

export async function updateWorkItemForUser(userId: number, workItemId: number, patch: { title?: string }) {
  const updated = await withWorkWrite(userId, workItemId, async tx => {
    await tx.update(workItems).set({ title: patch.title }).where(eq(workItems.id, workItemId)); return true;
  });
  return updated ? getWorkItemForUser(userId, workItemId) : undefined;
}

export async function softDeleteWorkItemForUser(userId: number, workItemId: number) {
  return Boolean(await withWorkWrite(userId, workItemId, async tx => {
    await tx.update(workItems).set({ deletedAt: new Date() }).where(eq(workItems.id, workItemId)); return true;
  }));
}

export async function createWorkVersionForUser(userId: number, workItemId: number, snapshot: Record<string, unknown>, reason?: string) {
  return withWorkWrite(userId, workItemId, async (tx, work) => {
    const expectedVersion = work.currentVersionNumber;
    const nextVersion = expectedVersion + 1;
    const updated = await tx.update(workItems).set({ currentVersionNumber: nextVersion }).where(and(eq(workItems.id, workItemId), eq(workItems.currentVersionNumber, expectedVersion)));
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
    const [asset] = await tx.select().from(assets).where(and(eq(assets.id, input.assetId), isNull(assets.deletedAt))).limit(1).for("update");
    if (!asset || !sameOwnershipScope(work, asset)) return undefined;
    const role = input.role ?? "evidence";
    await tx.insert(workAssetLinks).values({ workItemId: input.workItemId, assetId: input.assetId, role, caption: input.caption ?? null }).onDuplicateKeyUpdate({ set: { caption: input.caption ?? null } });
    return { success: true, workItemId: input.workItemId, assetId: input.assetId, role };
  });
}

export async function unlinkAssetFromWorkForUser(userId: number, input: { workItemId: number; assetId: number; role?: string }) {
  return Boolean(await withWorkWrite(userId, input.workItemId, async tx => {
    await tx.delete(workAssetLinks).where(and(eq(workAssetLinks.workItemId, input.workItemId), eq(workAssetLinks.assetId, input.assetId), eq(workAssetLinks.role, input.role ?? "evidence")));
    return true;
  }));
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
