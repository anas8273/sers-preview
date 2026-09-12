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

export type WorkAccessMode = "read" | "write";
export type NewWorkItem = typeof workItems.$inferInsert;
export type NewAsset = typeof assets.$inferInsert;

type WorkRow = typeof workItems.$inferSelect;
type AssetRow = typeof assets.$inferSelect;

type MembershipRow = typeof memberships.$inferSelect;

async function activeMembership(userId: number, organizationId: number): Promise<MembershipRow | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1);
  return row;
}

function canWriteOrganization(role: MembershipRow["role"]) {
  return role === "owner" || role === "admin" || role === "member";
}

export async function assertWorkAccess(userId: number, workItemId: number, mode: WorkAccessMode = "read") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [work] = await db.select().from(workItems).where(and(eq(workItems.id, workItemId), isNull(workItems.deletedAt))).limit(1);
  if (!work) return undefined;

  if (work.ownerType === "personal") {
    const allowed = work.ownerUserId === userId || work.creatorUserId === userId;
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
    const allowed = asset.ownerUserId === userId || asset.creatorUserId === userId;
    return allowed ? asset : undefined;
  }

  if (!asset.ownerOrganizationId) return undefined;
  const membership = await activeMembership(userId, asset.ownerOrganizationId);
  if (!membership) return undefined;
  if (mode === "write" && !canWriteOrganization(membership.role)) return undefined;
  return asset;
}

export async function listWorkItemsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const memberOf = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
  const organizationIds = memberOf.map(row => row.organizationId);

  const ownership = organizationIds.length > 0
    ? or(eq(workItems.ownerUserId, userId), eq(workItems.creatorUserId, userId), inArray(workItems.ownerOrganizationId, organizationIds))
    : or(eq(workItems.ownerUserId, userId), eq(workItems.creatorUserId, userId));

  return db.select().from(workItems)
    .where(and(isNull(workItems.deletedAt), ownership))
    .orderBy(desc(workItems.updatedAt));
}

export async function createWorkItemForUser(userId: number, input: {
  title: string;
  type: "report" | "portfolio";
  ownerType?: "personal" | "organization";
  organizationId?: number;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const ownerType = input.ownerType ?? "personal";
  if (ownerType === "organization") {
    if (!input.organizationId) throw new Error("Organization is required");
    const membership = await activeMembership(userId, input.organizationId);
    if (!membership || !canWriteOrganization(membership.role)) throw new Error("Organization write access denied");
  }

  const value: NewWorkItem = {
    creatorUserId: userId,
    ownerType,
    ownerUserId: ownerType === "personal" ? userId : null,
    ownerOrganizationId: ownerType === "organization" ? input.organizationId! : null,
    type: input.type,
    title: input.title,
    status: "draft",
    currentVersionNumber: 0,
  };
  const result = await db.insert(workItems).values(value);
  return getWorkItemForUser(userId, Number(result[0].insertId));
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
  return { ...work, assets: linkedAssets };
}

export async function updateWorkItemForUser(userId: number, workItemId: number, patch: { title?: string; status?: WorkRow["status"] }) {
  const work = await assertWorkAccess(userId, workItemId, "write");
  if (!work) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workItems).set(patch).where(eq(workItems.id, workItemId));
  return getWorkItemForUser(userId, workItemId);
}

export async function softDeleteWorkItemForUser(userId: number, workItemId: number) {
  const work = await assertWorkAccess(userId, workItemId, "write");
  if (!work) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(workItems).set({ deletedAt: new Date() }).where(eq(workItems.id, workItemId));
  return true;
}

export async function createWorkVersionForUser(userId: number, workItemId: number, snapshot: Record<string, unknown>, reason?: string) {
  const work = await assertWorkAccess(userId, workItemId, "write");
  if (!work) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const nextVersion = work.currentVersionNumber + 1;
  const result = await db.transaction(async tx => {
    const inserted = await tx.insert(workVersions).values({ workItemId, versionNumber: nextVersion, createdByUserId: userId, snapshot, reason: reason ?? null });
    await tx.update(workItems).set({ currentVersionNumber: nextVersion }).where(eq(workItems.id, workItemId));
    return Number(inserted[0].insertId);
  });
  return { id: result, versionNumber: nextVersion };
}

export async function listAssetsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const memberOf = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active")));
  const organizationIds = memberOf.map(row => row.organizationId);
  const ownership = organizationIds.length > 0
    ? or(eq(assets.ownerUserId, userId), eq(assets.creatorUserId, userId), inArray(assets.ownerOrganizationId, organizationIds))
    : or(eq(assets.ownerUserId, userId), eq(assets.creatorUserId, userId));
  return db.select().from(assets).where(and(isNull(assets.deletedAt), ownership)).orderBy(desc(assets.updatedAt));
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
  if (ownerType === "organization") {
    if (!input.organizationId) throw new Error("Organization is required");
    const membership = await activeMembership(userId, input.organizationId);
    if (!membership || !canWriteOrganization(membership.role)) throw new Error("Organization write access denied");
  }
  const value: NewAsset = {
    creatorUserId: userId,
    ownerType,
    ownerUserId: ownerType === "personal" ? userId : null,
    ownerOrganizationId: ownerType === "organization" ? input.organizationId! : null,
    title: input.title,
    kind: input.kind,
    storageKey: input.storageKey ?? null,
    externalUrl: input.externalUrl ?? null,
    mimeType: input.mimeType ?? null,
    fileSize: input.fileSize ?? null,
    metadata: input.metadata ?? null,
  };
  const result = await db.insert(assets).values(value);
  const id = Number(result[0].insertId);
  return assertAssetAccess(userId, id, "read");
}

export async function linkAssetToWorkForUser(userId: number, input: { workItemId: number; assetId: number; role?: string; caption?: string }) {
  const work = await assertWorkAccess(userId, input.workItemId, "write");
  const asset = await assertAssetAccess(userId, input.assetId, "read");
  if (!work || !asset) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const role = input.role ?? "evidence";
  await db.insert(workAssetLinks).values({ workItemId: input.workItemId, assetId: input.assetId, role, caption: input.caption ?? null })
    .onDuplicateKeyUpdate({ set: { caption: input.caption ?? null } });
  return { success: true, workItemId: input.workItemId, assetId: input.assetId, role };
}

export async function unlinkAssetFromWorkForUser(userId: number, input: { workItemId: number; assetId: number; role?: string }) {
  const work = await assertWorkAccess(userId, input.workItemId, "write");
  if (!work) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(workAssetLinks).where(and(
    eq(workAssetLinks.workItemId, input.workItemId),
    eq(workAssetLinks.assetId, input.assetId),
    eq(workAssetLinks.role, input.role ?? "evidence"),
  ));
  return true;
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
