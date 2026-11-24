import { and, desc, eq, inArray, isNull } from "drizzle-orm";
import { assets, assetStandardLinks, memberships, organizations, standardVersions } from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { assertAssetAccess, listAssetsForUser } from "./domain-db";
import {
  buildSmartEvidenceCoverage,
  OFFICIAL_SAUDI_STANDARD_SEEDS,
  type OfficialStandardPackId,
} from "../shared/saudi-standards-packs";

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

export async function seedOfficialStandardsPacks(packFilter: OfficialStandardPackId | "all" = "all") {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const seeds = packFilter === "all"
    ? OFFICIAL_SAUDI_STANDARD_SEEDS
    : OFFICIAL_SAUDI_STANDARD_SEEDS.filter(seed => seed.packId === packFilter);

  for (const seed of seeds) {
    const metadata = {
      packId: seed.packId,
      packTitle: seed.packTitle,
      domainLabel: seed.domainLabel,
      ...(typeof seed.weightPercent === "number" ? { weightPercent: seed.weightPercent } : {}),
    };
    await db
      .insert(standardVersions)
      .values({
        standardKey: seed.standardKey,
        version: seed.version,
        title: seed.title,
        data: metadata,
        isActive: true,
      })
      .onDuplicateKeyUpdate({
        set: {
          title: seed.title,
          data: metadata,
          isActive: true,
        },
      });
  }

  return { seededCount: seeds.length };
}

export async function getSmartEvidenceMatrixForUser(
  userId: number,
  packFilter: OfficialStandardPackId | "all" = "saudi-teacher-eval-7",
) {
  const db = await getDb();
  if (!db) {
    return buildSmartEvidenceCoverage({ standards: [], assets: [], links: [] });
  }

  const allStandards = await db
    .select()
    .from(standardVersions)
    .where(eq(standardVersions.isActive, true))
    .orderBy(standardVersions.standardKey);

  const seedPackByKey = new Map(OFFICIAL_SAUDI_STANDARD_SEEDS.map(s => [s.standardKey, s.packId]));
  const filteredStandards = packFilter === "all"
    ? allStandards
    : allStandards.filter(std => {
      const dataPack = std.data && typeof std.data === "object" ? (std.data as Record<string, unknown>).packId : undefined;
      const effectivePack = typeof dataPack === "string" ? dataPack : seedPackByKey.get(std.standardKey);
      return effectivePack === packFilter;
    });

  const readableAssets = await listAssetsForUser(userId);
  const assetIds = readableAssets.map(asset => asset.id);

  const links = assetIds.length > 0
    ? await db
      .select({
        assetId: assetStandardLinks.assetId,
        standardVersionId: assetStandardLinks.standardVersionId,
        note: assetStandardLinks.note,
      })
      .from(assetStandardLinks)
      .where(inArray(assetStandardLinks.assetId, assetIds))
    : [];

  return buildSmartEvidenceCoverage({
    standards: filteredStandards,
    assets: readableAssets.map(a => ({ id: a.id, title: a.title, kind: a.kind })),
    links,
  });
}
