import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import {
  assets,
  contentBlocks,
  memberships,
  organizations,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import {
  computePortfolioReadiness,
  normalizePortfolioDraft,
  PortfolioValidationError,
  type PortfolioDraftData,
  type PortfolioEntry,
  type PortfolioReadiness,
} from "../shared/portfolio-projection";

export const PORTFOLIO_DOCUMENT_BLOCK = "portfolio_document";

export class PortfolioAccessError extends Error {
  constructor(message = "لا تملك صلاحية الوصول إلى ملف الإنجاز") {
    super(message);
    this.name = "PortfolioAccessError";
  }
}

export class PortfolioConflictError extends Error {
  constructor(message = "تغير ملف الإنجاز في جلسة أخرى؛ حدّث الصفحة قبل الحفظ") {
    super(message);
    this.name = "PortfolioConflictError";
  }
}

function canWriteOrganization(role: string) {
  return role === "owner" || role === "admin" || role === "member";
}

function sameScope(
  portfolio: { ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
  target: { ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
) {
  if (portfolio.ownerType !== target.ownerType) return false;
  if (portfolio.ownerType === "personal") return portfolio.ownerUserId === target.ownerUserId;
  return Boolean(portfolio.ownerOrganizationId && portfolio.ownerOrganizationId === target.ownerOrganizationId);
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
  if (work.ownerType === "personal") return work.ownerUserId === userId ? work : undefined;
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

export type ResolvedPortfolioEntry = PortfolioEntry & {
  title: string;
  status?: string;
  assetKind?: string;
  unavailable: boolean;
};

async function resolveEntries(
  dbOrTx: any,
  portfolioWork: { id: number; ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
  entries: PortfolioEntry[],
): Promise<ResolvedPortfolioEntry[]> {
  const workIds = entries.filter(e => e.kind === "work").map(e => e.refId);
  const assetIds = entries.filter(e => e.kind === "asset").map(e => e.refId);

  const workRows = workIds.length > 0
    ? await dbOrTx.select().from(workItems).where(and(inArray(workItems.id, workIds), isNull(workItems.deletedAt)))
    : [];
  const assetRows = assetIds.length > 0
    ? await dbOrTx.select().from(assets).where(and(inArray(assets.id, assetIds), isNull(assets.deletedAt)))
    : [];

  const workMap = new Map<number, any>(workRows.map((row: any) => [row.id, row]));
  const assetMap = new Map<number, any>(assetRows.map((row: any) => [row.id, row]));

  return entries.map(entry => {
    if (entry.kind === "work") {
      const target = workMap.get(entry.refId);
      if (!target || target.id === portfolioWork.id || target.type === "portfolio" || !sameScope(portfolioWork, target)) {
        return { ...entry, title: "عمل غير متاح", unavailable: true };
      }
      return { ...entry, title: target.title, status: target.status, unavailable: false };
    }
    const target = assetMap.get(entry.refId);
    if (!target || !sameScope(portfolioWork, target)) {
      return { ...entry, title: "شاهد غير متاح", unavailable: true };
    }
    return { ...entry, title: target.title, assetKind: target.kind, unavailable: false };
  });
}

async function assertEntriesValidForWrite(
  tx: any,
  portfolioWork: { id: number; ownerType: string; ownerUserId: number | null; ownerOrganizationId: number | null },
  entries: PortfolioEntry[],
) {
  for (const entry of entries) {
    if (entry.kind === "work" && entry.refId === portfolioWork.id) {
      throw new PortfolioValidationError("لا يمكن ربط ملف الإنجاز بنفسه");
    }
  }
  const resolved = await resolveEntries(tx, portfolioWork, entries);
  const invalid = resolved.find(item => item.unavailable);
  if (invalid) {
    throw new PortfolioValidationError(
      invalid.kind === "work"
        ? "أحد الأعمال المختارة غير متاح، أو هو ملف إنجاز آخر (ممنوع الربط الدائري)، أو لا يتبع نفس مساحة الملكية"
        : "أحد الشواهد المختارة غير متاح أو لا يتبع نفس مساحة الملكية",
    );
  }
  return resolved;
}

export async function getPortfolioDraftForUser(userId: number, workItemId: number): Promise<{
  work: { id: number; title: string; status: string; ownerType: string; ownerOrganizationId: number | null; currentVersionNumber: number };
  draft: PortfolioDraftData;
  readiness: PortfolioReadiness;
  resolvedEntries: ResolvedPortfolioEntry[];
} | undefined> {
  const work = await assertReadAccess(userId, workItemId);
  if (!work) return undefined;
  if (work.type !== "portfolio") throw new PortfolioAccessError("هذا المسار مخصص لملفات الإنجاز فقط");
  if (work.metadata?.module === "self_evaluation") throw new PortfolioAccessError("دورة التقويم الذاتي تُدار من صفحة التقويم الذاتي فقط");

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [block] = await db
    .select()
    .from(contentBlocks)
    .where(and(eq(contentBlocks.workItemId, workItemId), eq(contentBlocks.blockType, PORTFOLIO_DOCUMENT_BLOCK)))
    .orderBy(asc(contentBlocks.id))
    .limit(1);

  const draft = normalizePortfolioDraft(block?.data);
  const resolvedEntries = await resolveEntries(db, work, draft.entries);
  const readiness = computePortfolioReadiness(draft);

  return {
    work: {
      id: work.id,
      title: work.title,
      status: work.status,
      ownerType: work.ownerType,
      ownerOrganizationId: work.ownerOrganizationId,
      currentVersionNumber: work.currentVersionNumber,
    },
    draft,
    readiness,
    resolvedEntries,
  };
}

export async function savePortfolioDraftForUser(
  userId: number,
  input: {
    workItemId: number;
    expectedRevision: number;
    introduction: string;
    entries: PortfolioEntry[];
  },
): Promise<{ draft: PortfolioDraftData; readiness: PortfolioReadiness }> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new PortfolioAccessError();
    if (work.type !== "portfolio") throw new PortfolioAccessError("هذا المسار مخصص لملفات الإنجاز فقط");
    if (work.metadata?.module === "self_evaluation") throw new PortfolioAccessError("دورة التقويم الذاتي تُدار من صفحة التقويم الذاتي فقط");
    if (work.status === "archived") throw new PortfolioConflictError("لا يمكن تعديل عمل مؤرشف");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, PORTFOLIO_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");

    const current = normalizePortfolioDraft(block?.data);
    if (current.revision !== input.expectedRevision) throw new PortfolioConflictError();

    const normalized = normalizePortfolioDraft({
      schemaVersion: 1,
      revision: current.revision + 1,
      introduction: input.introduction,
      entries: input.entries,
      updatedAt: new Date().toISOString(),
    });
    await assertEntriesValidForWrite(tx, work, normalized.entries);

    if (block) {
      await tx
        .update(contentBlocks)
        .set({ data: normalized, updatedAt: new Date() })
        .where(and(eq(contentBlocks.id, block.id), eq(contentBlocks.workItemId, input.workItemId)));
    } else {
      await tx.insert(contentBlocks).values({
        workItemId: input.workItemId,
        blockType: PORTFOLIO_DOCUMENT_BLOCK,
        sortOrder: 0,
        data: normalized,
      });
    }
    await tx.update(workItems).set({ updatedAt: new Date() }).where(eq(workItems.id, input.workItemId));

    return {
      draft: normalized,
      readiness: computePortfolioReadiness(normalized),
    };
  });
}

export async function createPortfolioDraftVersionForUser(
  userId: number,
  input: { workItemId: number; expectedRevision: number; reason?: string },
) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const work = await assertWriteAccessInTransaction(tx, userId, input.workItemId);
    if (!work) throw new PortfolioAccessError();
    if (work.type !== "portfolio") throw new PortfolioAccessError("هذا المسار مخصص لملفات الإنجاز فقط");
    if (work.metadata?.module === "self_evaluation") throw new PortfolioAccessError("دورة التقويم الذاتي تُدار من صفحة التقويم الذاتي فقط");
    if (work.status === "archived") throw new PortfolioConflictError("لا يمكن إنشاء نسخة لعمل مؤرشف");

    const [block] = await tx
      .select()
      .from(contentBlocks)
      .where(and(eq(contentBlocks.workItemId, input.workItemId), eq(contentBlocks.blockType, PORTFOLIO_DOCUMENT_BLOCK)))
      .orderBy(asc(contentBlocks.id))
      .limit(1)
      .for("update");
    if (!block) throw new PortfolioValidationError("احفظ مسودة ملف الإنجاز أولًا قبل تثبيت نسخة");

    const draft = normalizePortfolioDraft(block.data);
    if (draft.revision !== input.expectedRevision) throw new PortfolioConflictError();
    if (draft.entries.length === 0) {
      throw new PortfolioValidationError("أضف عملًا أو شاهدًا واحدًا على الأقل قبل تثبيت نسخة ملف الإنجاز");
    }

    const resolvedReferences = await assertEntriesValidForWrite(tx, work, draft.entries);
    const nextVersion = work.currentVersionNumber + 1;

    await tx.update(workItems).set({ currentVersionNumber: nextVersion, status: "draft" }).where(eq(workItems.id, input.workItemId));
    const snapshot = {
      schemaVersion: 1,
      kind: "portfolio",
      work: {
        id: work.id,
        title: work.title,
        ownerType: work.ownerType,
        ownerUserId: work.ownerUserId,
        ownerOrganizationId: work.ownerOrganizationId,
      },
      academicContext: work.academicContext,
      portfolioDraft: draft,
      resolvedReferences,
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
      portfolioRevision: draft.revision,
    };
  });
}
