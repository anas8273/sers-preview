import { and, asc, desc, eq, gte, inArray, isNull, ne, notLike, sql } from "drizzle-orm";
import {
  academicTerms,
  academicYears,
  assets,
  assetStandardLinks,
  contentBlocks,
  entitlements,
  memberships,
  notifications,
  organizations,
  purchases,
  standardVersions,
  workAssetLinks,
  workItems,
  workVersions,
  type AcademicContext,
} from "../drizzle/domain-core";
import { auditLogs, users } from "../drizzle/schema";
import { getDb } from "./db";

type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
export type SchoolRole = "owner" | "admin" | "reviewer" | "member";
export class AccountAccessError extends Error { constructor() { super("Account operation unavailable"); this.name = "AccountAccessError"; } }
export class AccountValidationError extends Error { constructor(message: string) { super(message); this.name = "AccountValidationError"; } }
export class AccountConflictError extends Error { constructor(message: string) { super(message); this.name = "AccountConflictError"; } }
const actor = (id: number) => { if (!Number.isSafeInteger(id) || id < 1 || id > 2147483647) throw new AccountValidationError("معرّف الحساب غير صالح"); };
const label = (value: string, max = 100) => { if (typeof value !== "string" || value.trim().length < 2 || value.trim().length > max || /[\u0000-\u001f\u007f]/.test(value)) throw new AccountValidationError("الاسم غير صالح"); return value.trim(); };
async function database() { const db = await getDb(); if (!db) throw new Error("Database not available"); return db; }

/** Serializes every membership change on the organization row, including two
 * concurrent last-owner removals. There is no route that bypasses this check. */
async function schoolMembership(tx: Transaction, userId: number, organizationId: number) {
  const [school] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
  if (!school || school.status !== "active") throw new AccountAccessError();
  const [member] = await tx.select().from(memberships).where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId), eq(memberships.status, "active"))).limit(1).for("update");
  if (!member) throw new AccountAccessError();
  return member;
}

export async function getAccountOverviewForUser(userId: number) {
  actor(userId); const db = await database();
  const [user] = await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(eq(users.id, userId)).limit(1);
  if (!user) throw new AccountAccessError();
  const schools = await db.select({ id: organizations.id, name: organizations.name, role: memberships.role, status: memberships.status, membershipId: memberships.id }).from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(eq(memberships.userId, userId), inArray(memberships.status, ["active", "invited"]), eq(organizations.status, "active"))).orderBy(organizations.name);
  return { user, schools };
}

export async function createSchoolForUser(userId: number, name: string) {
  actor(userId); const schoolName = label(name, 255); const db = await database();
  return db.transaction(async tx => {
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!user) throw new AccountAccessError();
    const [inserted] = await tx.insert(organizations).values({ name: schoolName });
    const id = Number(inserted.insertId);
    await tx.insert(memberships).values({ organizationId: id, userId, role: "owner", status: "active" });
    return { id, name: schoolName };
  });
}

export async function listSchoolMembersForUser(userId: number, organizationId: number) {
  actor(userId); actor(organizationId); const db = await database();
  return db.transaction(async tx => {
    const membership = await schoolMembership(tx, userId, organizationId);
    if (!["owner", "admin"].includes(membership.role)) throw new AccountAccessError();
    return tx.select({ id: memberships.id, userId: memberships.userId, name: users.name, role: memberships.role, status: memberships.status, invitationAccepted: memberships.invitationAccepted }).from(memberships)
      .innerJoin(users, eq(memberships.userId, users.id)).where(eq(memberships.organizationId, organizationId)).orderBy(memberships.id);
  });
}

export async function inviteSchoolMemberForUser(userId: number, input: { organizationId: number; targetUserId: number; role: SchoolRole }) {
  actor(userId); actor(input.organizationId); actor(input.targetUserId);
  if (!["owner", "admin", "reviewer", "member"].includes(input.role)) throw new AccountValidationError("الدور غير صالح");
  const db = await database();
  return db.transaction(async tx => {
    const requester = await schoolMembership(tx, userId, input.organizationId);
    if (!["owner", "admin"].includes(requester.role) || (requester.role === "admin" && ["owner", "admin"].includes(input.role))) throw new AccountAccessError();
    const [target] = await tx.select({ id: users.id }).from(users).where(eq(users.id, input.targetUserId)).limit(1);
    if (!target) throw new AccountAccessError();
    const [existing] = await tx.select().from(memberships).where(and(eq(memberships.organizationId, input.organizationId), eq(memberships.userId, input.targetUserId))).limit(1).for("update");
    if (existing) {
      if (!existing.invitationAccepted && ["suspended", "left"].includes(existing.status)) {
        if (requester.role !== "owner" && ["owner", "admin"].includes(existing.role)) throw new AccountAccessError();
        await tx.update(memberships).set({ role: input.role, status: "invited", leftAt: null }).where(eq(memberships.id, existing.id));
        return { id: existing.id, status: "invited" as const };
      }
      throw new AccountConflictError("هذا الحساب لديه عضوية أو دعوة مسجلة؛ استخدم إدارة العضوية");
    }
    const [inserted] = await tx.insert(memberships).values({ organizationId: input.organizationId, userId: input.targetUserId, role: input.role, status: "invited", invitationAccepted: false });
    return { id: Number(inserted.insertId), status: "invited" as const };
  });
}

export async function acceptSchoolInvitationForUser(userId: number, organizationId: number) {
  actor(userId); actor(organizationId); const db = await database();
  return db.transaction(async tx => {
    const [school] = await tx.select().from(organizations).where(eq(organizations.id, organizationId)).limit(1).for("update");
    if (!school || school.status !== "active") throw new AccountAccessError();
    const [invitation] = await tx.select().from(memberships).where(and(eq(memberships.organizationId, organizationId), eq(memberships.userId, userId))).limit(1).for("update");
    if (!invitation || !["active", "invited"].includes(invitation.status)) throw new AccountAccessError();
    if (invitation.status === "invited") await tx.update(memberships).set({ status: "active", invitationAccepted: true, joinedAt: sql`CURRENT_TIMESTAMP`, leftAt: null }).where(eq(memberships.id, invitation.id));
    return { id: invitation.id, status: "active" as const };
  });
}

export async function setSchoolMemberForUser(userId: number, input: { organizationId: number; membershipId: number; role: SchoolRole; status: "active" | "suspended" | "left" }) {
  actor(userId); actor(input.organizationId); actor(input.membershipId);
  if (!["owner", "admin", "reviewer", "member"].includes(input.role) || !["active", "suspended", "left"].includes(input.status)) throw new AccountValidationError("حالة العضوية غير صالحة");
  const db = await database();
  return db.transaction(async tx => {
    const requester = await schoolMembership(tx, userId, input.organizationId);
    if (!["owner", "admin"].includes(requester.role)) throw new AccountAccessError();
    const [target] = await tx.select().from(memberships).where(and(eq(memberships.id, input.membershipId), eq(memberships.organizationId, input.organizationId))).limit(1).for("update");
    if (!target) throw new AccountAccessError();
    if (requester.role !== "owner" && (["owner", "admin"].includes(target.role) || ["owner", "admin"].includes(input.role))) throw new AccountAccessError();
    // Invitations require the invited user's acceptance, never administrator activation.
    if ((!target.invitationAccepted || target.status === "invited") && input.status === "active") throw new AccountConflictError("يجب أن يقبل صاحب الحساب الدعوة بنفسه");
    if (target.role === "owner" && target.status === "active" && (input.role !== "owner" || input.status !== "active")) {
      const remaining = await tx.select({ id: memberships.id }).from(memberships).where(and(eq(memberships.organizationId, input.organizationId), eq(memberships.role, "owner"), eq(memberships.status, "active"))).for("update");
      if (remaining.length <= 1) throw new AccountConflictError("لا يمكن إزالة أو تعطيل آخر مالك نشط للمدرسة");
    }
    await tx.update(memberships).set({ role: input.role, status: input.status, leftAt: input.status === "left" ? sql`CURRENT_TIMESTAMP` : null }).where(eq(memberships.id, target.id));
    return { id: target.id, role: input.role, status: input.status };
  });
}

export type NewAcademicYear = { ownerType: "personal" | "organization"; organizationId?: number; label: string; startsOn: string; endsOn: string; terms: Array<{ label: string; startsOn: string; endsOn: string }> };
function validDate(value: string) { return typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(Date.parse(value)) && new Date(value).toISOString().slice(0, 10) === value; }
export function validateAcademicYearInput(input: NewAcademicYear) {
  if (!["personal", "organization"].includes(input.ownerType) || (input.ownerType === "personal" && input.organizationId !== undefined)) throw new AccountValidationError("نطاق السنة غير صالح");
  if (input.ownerType === "organization") actor(input.organizationId!);
  const yearLabel = label(input.label);
  if (!validDate(input.startsOn) || !validDate(input.endsOn) || input.startsOn >= input.endsOn) throw new AccountValidationError("تواريخ السنة غير صالحة");
  if (!Array.isArray(input.terms) || input.terms.length < 1 || input.terms.length > 3) throw new AccountValidationError("حدد فصلًا واحدًا إلى ثلاثة فصول");
  const terms = input.terms.map(term => ({ ...term, label: label(term.label) }));
  for (let i = 0; i < terms.length; i++) {
    const term = terms[i];
    if (!validDate(term.startsOn) || !validDate(term.endsOn) || term.startsOn > term.endsOn || term.startsOn < input.startsOn || term.endsOn > input.endsOn || (i > 0 && terms[i - 1].endsOn >= term.startsOn)) throw new AccountValidationError("الفصول يجب أن تكون متتابعة وغير متداخلة وداخل السنة");
  }
  if (new Set(terms.map(term => term.label)).size !== terms.length) throw new AccountValidationError("أسماء الفصول يجب أن تكون مختلفة");
  return { ...input, label: yearLabel, terms };
}

export async function createAcademicYearForUser(userId: number, request: NewAcademicYear) {
  actor(userId); const input = validateAcademicYearInput(request); const db = await database();
  return db.transaction(async tx => {
    if (input.ownerType === "organization") {
      const member = await schoolMembership(tx, userId, input.organizationId!);
      if (!["owner", "admin"].includes(member.role)) throw new AccountAccessError();
    } else {
      const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
      if (!user) throw new AccountAccessError();
    }
    const scopeKey = input.ownerType === "personal" ? `personal:${userId}` : `organization:${input.organizationId}`;
    const [existing] = await tx.select({ id: academicYears.id }).from(academicYears).where(and(eq(academicYears.scopeKey, scopeKey), eq(academicYears.label, input.label))).limit(1);
    if (existing) throw new AccountConflictError("اسم السنة مسجل في هذه المساحة");
    const [inserted] = await tx.insert(academicYears).values({ scopeKey, ownerUserId: input.ownerType === "personal" ? userId : null, organizationId: input.organizationId ?? null, label: input.label, startsOn: input.startsOn, endsOn: input.endsOn });
    const id = Number(inserted.insertId);
    await tx.insert(academicTerms).values(input.terms.map((term, index) => ({ ...term, ordinal: index + 1, academicYearId: id })));
    return { id, label: input.label };
  });
}

export async function listAcademicYearsForUser(userId: number) {
  actor(userId); const db = await database();
  const scopes = await db.select({ id: organizations.id }).from(memberships).innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active")));
  const keys = [`personal:${userId}`, ...scopes.map(row => `organization:${row.id}`)];
  const years = await db.select().from(academicYears).where(inArray(academicYears.scopeKey, keys)).orderBy(desc(academicYears.startsOn), desc(academicYears.id));
  if (!years.length) return [];
  const terms = await db.select().from(academicTerms).where(inArray(academicTerms.academicYearId, years.map(year => year.id))).orderBy(asc(academicTerms.ordinal));
  return years.map(year => ({ ...year, terms: terms.filter(term => term.academicYearId === year.id) }));
}

/** Called from work creation's ownership transaction; cross-scope IDs are rejected.
 * Academic settings have no update API. Copy labels/dates so historical versions
 * remain stable if a trusted migration later renames a year. */
export async function captureAcademicContext(tx: Transaction, scopeKey: string, yearId?: number, termId?: number): Promise<AcademicContext | null> {
  if (!yearId) { if (termId) throw new AccountValidationError("اختر السنة قبل الفصل"); return null; }
  actor(yearId); if (termId) actor(termId);
  const [year] = await tx.select().from(academicYears).where(and(eq(academicYears.id, yearId), eq(academicYears.scopeKey, scopeKey))).limit(1).for("update");
  if (!year) throw new AccountAccessError();
  const [term] = termId ? await tx.select().from(academicTerms).where(and(eq(academicTerms.id, termId), eq(academicTerms.academicYearId, yearId))).limit(1).for("update") : [];
  if (termId && !term) throw new AccountAccessError();
  return { yearId: year.id, yearLabel: year.label, yearStartsOn: year.startsOn, yearEndsOn: year.endsOn, termId: term?.id ?? null, termLabel: term?.label ?? null, termStartsOn: term?.startsOn ?? null, termEndsOn: term?.endsOn ?? null };
}

export type AccountDataExportBundle = {
  schemaVersion: 1;
  exportedAt: string;
  scopePolicy: "personal_owned_only";
  user: {
    id: number;
    name: string | null;
    email: string | null;
    createdAt: string | null;
  };
  schoolMemberships: Array<{
    organizationId: number;
    organizationName: string;
    role: SchoolRole;
    status: string;
  }>;
  personalAcademicYears: Array<{
    id: number;
    label: string;
    startsOn: string;
    endsOn: string;
    terms: Array<{ label: string; ordinal: number; startsOn: string; endsOn: string }>;
  }>;
  personalWorks: Array<{
    id: number;
    type: string;
    title: string;
    status: string;
    currentVersionNumber: number;
    academicContext: AcademicContext | null;
    createdAt: string | null;
    updatedAt: string | null;
    blocks: Array<{ blockType: string; sortOrder: number; data: Record<string, unknown> }>;
    versions: Array<{ versionNumber: number; reason: string | null; createdAt: string | null }>;
    linkedAssetIds?: number[];
  }>;
  personalAssets: Array<{
    id: number;
    kind: string;
    title: string;
    mimeType: string | null;
    fileSize: number | null;
    externalUrl: string | null;
    textNote: string | null;
    linkedStandards: Array<{ standardKey: string; version: string; title: string; note: string | null }>;
    createdAt: string | null;
  }>;
  personalPurchases: Array<{
    id: number;
    productId: number;
    state: string;
    amountMinor: number;
    currency: string;
    createdAt: string | null;
  }>;
  personalEntitlements: Array<{
    id: number;
    productId: number;
    status: string;
    grantedAt: string | null;
    expiresAt: string | null;
  }>;
  personalNotifications: Array<{
    id: number;
    type: string;
    title: string;
    body: string | null;
    readAt: string | null;
    createdAt: string | null;
  }>;
};

/**
 * Pure serializer for R18 / P0-021 personal data export.
 * Explicitly allowlists safe fields so auth secrets (`openId`), private object
 * `storageKey`s, and school-owned data can never leak into exported JSON.
 */
export function buildSanitizedAccountExportBundle(raw: {
  exportedAt?: string;
  user: { id: number; name: string | null; email: string | null; createdAt?: Date | string | null; openId?: unknown };
  schools: Array<{ id: number; name: string; role: SchoolRole; status: string }>;
  years: Array<{
    id: number;
    label: string;
    startsOn: string;
    endsOn: string;
    terms: Array<{ label: string; ordinal: number; startsOn: string; endsOn: string }>;
  }>;
  works: Array<{
    id: number;
    type: string;
    title: string;
    status: string;
    currentVersionNumber: number;
    academicContext: AcademicContext | null;
    createdAt?: Date | string | null;
    updatedAt?: Date | string | null;
    blocks: Array<{ blockType: string; sortOrder: number; data: Record<string, unknown> }>;
    versions?: Array<{ versionNumber: number; reason: string | null; createdAt?: Date | string | null }>;
    linkedAssetIds?: number[];
  }>;
  assets: Array<{
    id: number;
    kind: string;
    title: string;
    mimeType: string | null;
    fileSize: number | null;
    externalUrl: string | null;
    metadata: Record<string, unknown> | null;
    storageKey?: unknown;
    createdAt?: Date | string | null;
    linkedStandards: Array<{ standardKey: string; version: string; title: string; note: string | null }>;
  }>;
  purchases?: Array<{
    id: number;
    productId: number;
    state: string;
    amountMinor: number;
    currency: string;
    createdAt?: Date | string | null;
  }>;
  entitlements?: Array<{
    id: number;
    productId: number;
    status: string;
    grantedAt?: Date | string | null;
    expiresAt?: Date | string | null;
  }>;
  notifications?: Array<{
    id: number;
    type: string;
    title: string;
    body: string | null;
    readAt?: Date | string | null;
    createdAt?: Date | string | null;
  }>;
}): AccountDataExportBundle {
  const toIso = (val: Date | string | null | undefined) =>
    val instanceof Date ? val.toISOString() : typeof val === "string" ? val : null;

  return {
    schemaVersion: 1,
    exportedAt: raw.exportedAt ?? new Date().toISOString(),
    scopePolicy: "personal_owned_only",
    user: {
      id: raw.user.id,
      name: raw.user.name ?? null,
      email: raw.user.email ?? null,
      createdAt: toIso(raw.user.createdAt),
    },
    schoolMemberships: raw.schools.map(s => ({
      organizationId: s.id,
      organizationName: s.name,
      role: s.role,
      status: s.status,
    })),
    personalAcademicYears: raw.years.map(y => ({
      id: y.id,
      label: y.label,
      startsOn: y.startsOn,
      endsOn: y.endsOn,
      terms: y.terms.map(t => ({
        label: t.label,
        ordinal: t.ordinal,
        startsOn: t.startsOn,
        endsOn: t.endsOn,
      })),
    })),
    personalWorks: raw.works.map(w => ({
      id: w.id,
      type: w.type,
      title: w.title,
      status: w.status,
      currentVersionNumber: w.currentVersionNumber,
      academicContext: w.academicContext ?? null,
      createdAt: toIso(w.createdAt),
      updatedAt: toIso(w.updatedAt),
      blocks: w.blocks
        .filter(b => b.blockType !== "report_template_history")
        .map(b => {
          const dataCopy = b.data && typeof b.data === "object" ? { ...b.data } : {};
          if (dataCopy.reportIdentity && typeof dataCopy.reportIdentity === "object") {
            const { schoolLogoPng: _droppedLogo, ...restIdentity } = dataCopy.reportIdentity as Record<string, unknown>;
            dataCopy.reportIdentity = restIdentity;
          }
          return {
            blockType: b.blockType,
            sortOrder: b.sortOrder,
            data: dataCopy,
          };
        }),
      versions: (w.versions ?? []).map(v => ({
        versionNumber: v.versionNumber,
        reason: v.reason ?? null,
        createdAt: toIso(v.createdAt),
      })),
      ...(w.linkedAssetIds ? { linkedAssetIds: w.linkedAssetIds } : {}),
    })),
    personalAssets: raw.assets.map(a => ({
      id: a.id,
      kind: a.kind,
      title: a.title,
      mimeType: a.mimeType ?? null,
      fileSize: a.fileSize ?? null,
      externalUrl: a.kind === "link" && typeof a.externalUrl === "string" && /^https?:\/\//i.test(a.externalUrl)
        ? a.externalUrl
        : null,
      textNote: a.kind === "text" && typeof a.metadata?.text === "string" ? a.metadata.text : null,
      linkedStandards: a.linkedStandards,
      createdAt: toIso(a.createdAt),
    })),
    personalPurchases: (raw.purchases ?? []).map(p => ({
      id: p.id,
      productId: p.productId,
      state: p.state,
      amountMinor: p.amountMinor,
      currency: p.currency,
      createdAt: toIso(p.createdAt),
    })),
    personalEntitlements: (raw.entitlements ?? []).map(e => ({
      id: e.id,
      productId: e.productId,
      status: e.status,
      grantedAt: toIso(e.grantedAt),
      expiresAt: toIso(e.expiresAt),
    })),
    personalNotifications: (raw.notifications ?? []).map(n => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body ?? null,
      readAt: toIso(n.readAt),
      createdAt: toIso(n.createdAt),
    })),
  };
}

const EXPORT_WINDOW_MS = 10 * 60 * 1000;
const EXPORT_MAX_PER_WINDOW = 5;

export async function exportAccountDataForUser(userId: number): Promise<AccountDataExportBundle> {
  actor(userId);
  const db = await database();
  const [user] = await db
    .select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  if (!user) throw new AccountAccessError();

  // Fast pre-check before running data queries; final atomic reservation happens right before returning.
  const preWindowStart = new Date(Date.now() - EXPORT_WINDOW_MS);
  const preCheck = await db
    .select({ id: auditLogs.id })
    .from(auditLogs)
    .where(and(
      eq(auditLogs.actorUserId, userId),
      eq(auditLogs.action, "account.data_exported"),
      gte(auditLogs.createdAt, preWindowStart),
    ))
    .limit(EXPORT_MAX_PER_WINDOW);
  if (preCheck.length >= EXPORT_MAX_PER_WINDOW) {
    throw new AccountConflictError("تم تجاوز الحد المسموح لتصدير البيانات مؤقتًا؛ حاول مرة أخرى بعد دقائق");
  }

  const schools = await db
    .select({
      id: organizations.id,
      name: organizations.name,
      role: memberships.role,
      status: memberships.status,
    })
    .from(memberships)
    .innerJoin(organizations, eq(memberships.organizationId, organizations.id))
    .where(and(
      eq(memberships.userId, userId),
      inArray(memberships.status, ["active", "invited"]),
      eq(organizations.status, "active"),
    ))
    .orderBy(organizations.name);

  const personalYears = await db
    .select()
    .from(academicYears)
    .where(eq(academicYears.scopeKey, `personal:${userId}`))
    .orderBy(desc(academicYears.startsOn));
  const personalTerms = personalYears.length > 0
    ? await db
      .select()
      .from(academicTerms)
      .where(inArray(academicTerms.academicYearId, personalYears.map(y => y.id)))
      .orderBy(asc(academicTerms.ordinal))
    : [];

  const personalWorksRows = await db
    .select()
    .from(workItems)
    .where(and(
      eq(workItems.ownerType, "personal"),
      eq(workItems.ownerUserId, userId),
      isNull(workItems.deletedAt),
    ))
    .orderBy(desc(workItems.updatedAt));

  const workBlocks = personalWorksRows.length > 0
    ? await db
        .select()
        .from(contentBlocks)
        .where(and(
          inArray(contentBlocks.workItemId, personalWorksRows.map(w => w.id)),
          ne(contentBlocks.blockType, "report_template_history"),
        ))
        .orderBy(asc(contentBlocks.sortOrder), asc(contentBlocks.id))
    : [];

  const personalWorkAssetLinkRows = personalWorksRows.length > 0
    ? await db
        .select({ workItemId: workAssetLinks.workItemId, assetId: workAssetLinks.assetId })
        .from(workAssetLinks)
        .where(inArray(workAssetLinks.workItemId, personalWorksRows.map(w => w.id)))
    : [];

  const personalWorkVersions = personalWorksRows.length > 0
    ? await db
        .select({
          workItemId: workVersions.workItemId,
          versionNumber: workVersions.versionNumber,
          reason: workVersions.reason,
          createdAt: workVersions.createdAt,
        })
        .from(workVersions)
        .where(inArray(workVersions.workItemId, personalWorksRows.map(w => w.id)))
        .orderBy(asc(workVersions.versionNumber))
    : [];

  const personalAssetRows = await db
    .select()
    .from(assets)
    .where(and(
      eq(assets.ownerType, "personal"),
      eq(assets.ownerUserId, userId),
      isNull(assets.deletedAt),
    ))
    .orderBy(desc(assets.createdAt));

  const standardLinks = personalAssetRows.length > 0
    ? await db
      .select({
        assetId: assetStandardLinks.assetId,
        note: assetStandardLinks.note,
        standardKey: standardVersions.standardKey,
        version: standardVersions.version,
        title: standardVersions.title,
      })
      .from(assetStandardLinks)
      .innerJoin(standardVersions, eq(assetStandardLinks.standardVersionId, standardVersions.id))
      .where(inArray(assetStandardLinks.assetId, personalAssetRows.map(a => a.id)))
    : [];

  const personalPurchaseRows = await db
    .select({
      id: purchases.id,
      productId: purchases.productId,
      state: purchases.state,
      amountMinor: purchases.amountMinor,
      currency: purchases.currency,
      createdAt: purchases.createdAt,
    })
    .from(purchases)
    .where(eq(purchases.userId, userId))
    .orderBy(desc(purchases.createdAt));

  const personalEntitlementRows = await db
    .select({
      id: entitlements.id,
      productId: entitlements.productId,
      status: entitlements.status,
      grantedAt: entitlements.grantedAt,
      expiresAt: entitlements.expiresAt,
    })
    .from(entitlements)
    .where(and(eq(entitlements.userId, userId), isNull(entitlements.organizationId)))
    .orderBy(desc(entitlements.grantedAt));

  // Exclude organization-scoped `review_*` notifications so school work titles never leak into personal export
  const personalNotificationRows = await db
    .select({
      id: notifications.id,
      type: notifications.type,
      title: notifications.title,
      body: notifications.body,
      readAt: notifications.readAt,
      createdAt: notifications.createdAt,
    })
    .from(notifications)
    .where(and(eq(notifications.userId, userId), notLike(notifications.type, "review_%")))
    .orderBy(desc(notifications.createdAt))
    .limit(500);

  const bundle = buildSanitizedAccountExportBundle({
    user,
    schools,
    years: personalYears.map(year => ({
      id: year.id,
      label: year.label,
      startsOn: year.startsOn,
      endsOn: year.endsOn,
      terms: personalTerms.filter(t => t.academicYearId === year.id),
    })),
    works: personalWorksRows.map(work => ({
      ...work,
      blocks: workBlocks.filter(b => b.workItemId === work.id),
      versions: personalWorkVersions.filter(v => v.workItemId === work.id),
      linkedAssetIds: personalWorkAssetLinkRows.filter(l => l.workItemId === work.id).map(l => l.assetId),
    })),
    assets: personalAssetRows.map(asset => ({
      ...asset,
      linkedStandards: standardLinks
        .filter(link => link.assetId === asset.id)
        .map(link => ({
          standardKey: link.standardKey,
          version: link.version,
          title: link.title,
          note: link.note,
        })),
    })),
    purchases: personalPurchaseRows,
    entitlements: personalEntitlementRows,
    notifications: personalNotificationRows,
  });

  // Commit atomic quota reservation + audit log AFTER data queries succeed.
  await db.transaction(async tx => {
    const [lockedUser] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!lockedUser) throw new AccountAccessError();
    const windowStart = new Date(Date.now() - EXPORT_WINDOW_MS);
    const recentExports = await tx
      .select({ id: auditLogs.id })
      .from(auditLogs)
      .where(and(
        eq(auditLogs.actorUserId, userId),
        eq(auditLogs.action, "account.data_exported"),
        gte(auditLogs.createdAt, windowStart),
      ))
      .limit(EXPORT_MAX_PER_WINDOW);
    if (recentExports.length >= EXPORT_MAX_PER_WINDOW) {
      throw new AccountConflictError("تم تجاوز الحد المسموح لتصدير البيانات مؤقتًا؛ حاول مرة أخرى بعد دقائق");
    }
    await tx.insert(auditLogs).values({
      actorUserId: userId,
      action: "account.data_exported",
      resourceType: "user",
      resourceId: String(userId),
      metadata: {
        scopePolicy: "personal_owned_only",
        personalWorksCount: bundle.personalWorks.length,
        personalAssetsCount: bundle.personalAssets.length,
      },
    });
  });

  return bundle;
}
