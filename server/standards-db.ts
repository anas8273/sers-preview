import { and, desc, eq, isNull } from "drizzle-orm";
import { assets, assetStandardLinks, memberships, organizations, standardVersions } from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { assertAssetAccess } from "./domain-db";

function canWriteOrganization(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

async function lockAssetForWriteInTransaction(tx: any, userId: number, assetId: number) {
  const [hint] = await tx
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)))
    .limit(1);
  if (!hint) return undefined;
  if (hint.ownerType === "personal") {
    if (hint.ownerUserId !== userId) return undefined;
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!user) return undefined;
  } else {
    if (!hint.ownerOrganizationId) return undefined;
    const [organization] = await tx.select().from(organizations).where(eq(organizations.id, hint.ownerOrganizationId)).limit(1).for("update");
    if (!organization || organization.status !== "active") return undefined;
    const [membership] = await tx
      .select()
      .from(memberships)
      .where(and(eq(memberships.userId, userId), eq(memberships.organizationId, hint.ownerOrganizationId), eq(memberships.status, "active")))
      .limit(1)
      .for("update");
    if (!membership || !canWriteOrganization(membership.role)) return undefined;
  }
  const [asset] = await tx
    .select()
    .from(assets)
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt)))
    .limit(1)
    .for("update");
  if (!asset || asset.ownerType !== hint.ownerType || asset.ownerUserId !== hint.ownerUserId || asset.ownerOrganizationId !== hint.ownerOrganizationId) {
    return undefined;
  }
  return asset;
}

export async function listStandardVersions(activeOnly = true) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(standardVersions)
    .where(activeOnly ? eq(standardVersions.isActive, true) : undefined)
    .orderBy(desc(standardVersions.effectiveFrom), desc(standardVersions.id));
}

export async function listStandardsForAssetForUser(userId: number, assetId: number) {
  const asset = await assertAssetAccess(userId, assetId, "read");
  if (!asset) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select({
      linkId: assetStandardLinks.id,
      note: assetStandardLinks.note,
      linkedAt: assetStandardLinks.createdAt,
      standardVersionId: standardVersions.id,
      standardKey: standardVersions.standardKey,
      version: standardVersions.version,
      title: standardVersions.title,
      effectiveFrom: standardVersions.effectiveFrom,
      effectiveTo: standardVersions.effectiveTo,
      isActive: standardVersions.isActive,
    })
    .from(assetStandardLinks)
    .innerJoin(standardVersions, eq(assetStandardLinks.standardVersionId, standardVersions.id))
    .where(eq(assetStandardLinks.assetId, assetId))
    .orderBy(desc(assetStandardLinks.createdAt));
}

export async function linkAssetToStandardForUser(
  userId: number,
  input: { assetId: number; standardVersionId: number; note?: string },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const asset = await lockAssetForWriteInTransaction(tx, userId, input.assetId);
    if (!asset) return undefined;

    const [standard] = await tx
      .select()
      .from(standardVersions)
      .where(and(eq(standardVersions.id, input.standardVersionId), eq(standardVersions.isActive, true)))
      .limit(1);
    if (!standard) return null;

    await tx
      .insert(assetStandardLinks)
      .values({
        assetId: input.assetId,
        standardVersionId: input.standardVersionId,
        note: input.note ?? null,
      })
      .onDuplicateKeyUpdate({ set: { note: input.note ?? null } });

    return {
      linked: true as const,
      assetId: input.assetId,
      standardVersionId: input.standardVersionId,
      version: standard.version,
    };
  });
}

export async function unlinkAssetFromStandardForUser(
  userId: number,
  input: { assetId: number; standardVersionId: number },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const asset = await lockAssetForWriteInTransaction(tx, userId, input.assetId);
    if (!asset) return false;
    await tx
      .delete(assetStandardLinks)
      .where(and(
        eq(assetStandardLinks.assetId, input.assetId),
        eq(assetStandardLinks.standardVersionId, input.standardVersionId),
      ));
    return true;
  });
}
