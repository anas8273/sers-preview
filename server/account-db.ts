import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { academicTerms, academicYears, memberships, organizations, type AcademicContext } from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
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
