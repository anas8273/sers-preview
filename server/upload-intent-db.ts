import { createHash, randomUUID } from "node:crypto";
import { and, eq, isNull, lte, sql } from "drizzle-orm";
import { uploadIntents, uploadQuotaBudgets } from "../drizzle/upload-intents";
import { memberships, organizations, workItems } from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";

/** Reservation foundation only: no storage I/O or asset publication. */
export interface BeginUploadIntentInput {
  idempotencyKey: string;
  fileName: string;
  mimeType: string;
  expectedBytes: number;
  ownerType?: "personal" | "organization";
  organizationId?: number;
  workId?: number;
}
export class UploadIntentConflictError extends Error {
  constructor() { super("Upload intent conflict"); this.name = "UploadIntentConflictError"; }
}
export class UploadIntentAccessError extends Error {
  constructor() { super("Upload intent unavailable"); this.name = "UploadIntentAccessError"; }
}
export class UploadIntentQuotaError extends Error {
  constructor() { super("Upload budget unavailable or exceeded"); this.name = "UploadIntentQuotaError"; }
}
type Intent = typeof uploadIntents.$inferSelect;
type Budget = typeof uploadQuotaBudgets.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
type Scope = { ownerType: "personal" | "organization"; organizationId: number | null; workId: number | null; scopeKey: string };

function project(row: Intent) {
  return { id: row.id, state: row.state, revision: row.revision, expiresAt: row.expiresAt, createdAt: row.createdAt };
}
function assertActor(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0 || userId > 2147483647) throw new Error("Invalid upload actor");
}
function validated(userId: number, input: BeginUploadIntentInput) {
  if (typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) throw new Error("Invalid upload idempotency key");
  if (typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 255 || /[\\/\x00-\x1f\x7f:]/.test(input.fileName)) throw new Error("Invalid upload file name");
  if (typeof input.mimeType !== "string" || !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(input.mimeType) || input.mimeType.length > 128) throw new Error("Invalid upload MIME type");
  if (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes <= 0 || input.expectedBytes > MAX_EVIDENCE_BYTES) throw new Error("Invalid upload byte count");
  const ownerType = input.ownerType ?? "personal";
  if (ownerType !== "personal" && ownerType !== "organization") throw new Error("Invalid upload scope");
  const validId = (id: number | undefined) => Number.isSafeInteger(id) && id! > 0 && id! <= 2147483647;
  if ((ownerType === "organization" && !validId(input.organizationId)) || (ownerType === "personal" && input.organizationId !== undefined)) throw new Error("Invalid upload organization");
  if (input.workId !== undefined && !validId(input.workId)) throw new Error("Invalid upload work");
  const organizationId = input.organizationId ?? null, workId = input.workId ?? null;
  const scopeKey = `${ownerType}:${ownerType === "personal" ? userId : organizationId}`;
  const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
  const mimeType = input.mimeType.toLowerCase();
  // Preserve the first foundation's fingerprint for personal, unattached retries.
  const fingerprint = ownerType === "personal" && workId === null
    ? ["personal-v1", input.fileName, mimeType, input.expectedBytes]
    : ["scoped-v2", scopeKey, workId, input.fileName, mimeType, input.expectedBytes];
  return { ownerType, organizationId, workId, scopeKey,
    idempotencyKeyHash: sha256(input.idempotencyKey), requestFingerprint: sha256(JSON.stringify(fingerprint)),
    fileName: input.fileName, declaredMimeType: mimeType, expectedBytes: input.expectedBytes };
}
async function database() {
  const db = await getDb(); if (!db) throw new Error("Database not available"); return db;
}

/** Lock order: actor/organization -> membership -> work -> budget -> intent.
 * Scope and target fields never change after insert. Network I/O is forbidden here. */
async function authorize(tx: Transaction, userId: number, scope: Scope) {
  if (scope.ownerType === "personal") {
    if (scope.scopeKey !== `personal:${userId}` || scope.organizationId !== null) return false;
    const [actor] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!actor) return false;
  } else {
    if (!scope.organizationId || scope.scopeKey !== `organization:${scope.organizationId}`) return false;
    const [organization] = await tx.select().from(organizations).where(eq(organizations.id, scope.organizationId)).limit(1).for("update");
    if (!organization || organization.status !== "active") return false;
    const [membership] = await tx.select().from(memberships).where(and(eq(memberships.organizationId, scope.organizationId), eq(memberships.userId, userId))).limit(1).for("update");
    if (!membership || membership.status !== "active" || !["owner", "admin", "member"].includes(membership.role)) return false;
  }
  if (scope.workId !== null) {
    const [work] = await tx.select().from(workItems).where(and(eq(workItems.id, scope.workId), isNull(workItems.deletedAt))).limit(1).for("update");
    if (!work || work.ownerType !== scope.ownerType) return false;
    if (scope.ownerType === "personal" ? work.ownerUserId !== userId : work.ownerOrganizationId !== scope.organizationId) return false;
  }
  return true;
}
async function lockBudget(tx: Transaction, scopeKey: string) {
  const [budget] = await tx.select().from(uploadQuotaBudgets).where(eq(uploadQuotaBudgets.scopeKey, scopeKey)).limit(1).for("update");
  return budget;
}
function validBudget(budget: Budget | undefined): budget is Budget {
  return !!budget && [budget.limitBytes, budget.reservedBytes, budget.maxActiveIntents, budget.activeIntents].every(n => Number.isSafeInteger(n) && n >= 0);
}
async function release(tx: Transaction, row: Intent, budget: Budget | undefined) {
  if (!row.reservationHeld) return;
  if (!validBudget(budget) || budget.reservedBytes < row.expectedBytes || budget.activeIntents < 1) throw new UploadIntentQuotaError();
  await tx.update(uploadQuotaBudgets).set({ reservedBytes: budget.reservedBytes - row.expectedBytes, activeIntents: budget.activeIntents - 1 }).where(eq(uploadQuotaBudgets.scopeKey, row.scopeKey));
  await tx.update(uploadIntents).set({ reservationHeld: false }).where(eq(uploadIntents.id, row.id));
  budget.reservedBytes -= row.expectedBytes; budget.activeIntents -= 1;
}
async function expireIfDue(tx: Transaction, row: Intent, budget: Budget | undefined): Promise<Intent> {
  if (row.state !== "issued") return row;
  await tx.update(uploadIntents).set({ state: "expired", revision: row.revision + 1 }).where(and(eq(uploadIntents.id, row.id), eq(uploadIntents.revision, row.revision), eq(uploadIntents.state, "issued"), lte(uploadIntents.expiresAt, sql`CURRENT_TIMESTAMP`)));
  const [current] = await tx.select().from(uploadIntents).where(eq(uploadIntents.id, row.id)).limit(1);
  if (!current) throw new Error("Upload intent disappeared");
  if (current.state === "expired") { await release(tx, current, budget); current.reservationHeld = false; }
  return current;
}
export async function beginUploadIntentForUser(userId: number, input: BeginUploadIntentInput) {
  assertActor(userId); const value = validated(userId, input); const db = await database();
  return db.transaction(async tx => {
    if (!await authorize(tx, userId, value)) throw new UploadIntentAccessError();
    const budget = await lockBudget(tx, value.scopeKey);
    const [existing] = await tx.select().from(uploadIntents).where(and(eq(uploadIntents.actorUserId, userId), eq(uploadIntents.scopeKey, value.scopeKey), eq(uploadIntents.idempotencyKeyHash, value.idempotencyKeyHash))).limit(1).for("update");
    if (existing) {
      if (existing.requestFingerprint !== value.requestFingerprint) throw new UploadIntentConflictError();
      return project(await expireIfDue(tx, existing, budget));
    }
    if (!validBudget(budget) || value.expectedBytes > budget.limitBytes - budget.reservedBytes || budget.activeIntents >= budget.maxActiveIntents) throw new UploadIntentQuotaError();
    const id = randomUUID();
    await tx.insert(uploadIntents).values({ id, actorUserId: userId, ...value, reservationHeld: true, expiresAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)` });
    await tx.update(uploadQuotaBudgets).set({ reservedBytes: budget.reservedBytes + value.expectedBytes, activeIntents: budget.activeIntents + 1 }).where(eq(uploadQuotaBudgets.scopeKey, value.scopeKey));
    const [row] = await tx.select().from(uploadIntents).where(eq(uploadIntents.id, id)).limit(1);
    return project(row);
  });
}
async function ownedTransaction(userId: number, id: string, operation: (tx: Transaction, row: Intent, budget: Budget | undefined) => Promise<ReturnType<typeof project>>) {
  assertActor(userId); const db = await database();
  // Non-locking lookup only obtains immutable scope; authorization and all mutations
  // happen inside the transaction after the budget has been locked.
  const [hint] = await db.select().from(uploadIntents).where(and(eq(uploadIntents.id, id), eq(uploadIntents.actorUserId, userId))).limit(1);
  if (!hint) return undefined;
  return db.transaction(async tx => {
    if (!await authorize(tx, userId, hint)) return undefined;
    const budget = await lockBudget(tx, hint.scopeKey);
    const [row] = await tx.select().from(uploadIntents).where(and(eq(uploadIntents.id, id), eq(uploadIntents.actorUserId, userId), eq(uploadIntents.scopeKey, hint.scopeKey))).limit(1).for("update");
    if (!row) return undefined;
    return operation(tx, row, budget);
  });
}
export async function getUploadIntentForUser(userId: number, id: string) {
  return ownedTransaction(userId, id, async (tx, row, budget) => project(await expireIfDue(tx, row, budget)));
}
export async function cancelUploadIntentForUser(userId: number, id: string, expectedRevision: number) {
  assertActor(userId);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Invalid upload revision");
  return ownedTransaction(userId, id, async (tx, found, budget) => {
    const row = await expireIfDue(tx, found, budget);
    if (row.state !== "issued") return project(row);
    if (row.revision !== expectedRevision) throw new UploadIntentConflictError();
    await tx.update(uploadIntents).set({ state: "cancelled", revision: row.revision + 1 }).where(and(eq(uploadIntents.id, row.id), eq(uploadIntents.state, "issued"), eq(uploadIntents.revision, expectedRevision)));
    await release(tx, row, budget);
    return project({ ...row, state: "cancelled", revision: row.revision + 1, reservationHeld: false });
  });
}

/** Trusted maintenance only, deliberately not exported through an application router.
 * Releases only pre-storage reservations; no blob cleanup and no user impersonation. */
export async function expireUploadIntentsForScope(scopeKey: string, limit = 100) {
  if (!/^(personal|organization):[1-9][0-9]*$/.test(scopeKey) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid expiry sweep");
  const db = await database();
  return db.transaction(async tx => {
    const budget = await lockBudget(tx, scopeKey);
    const rows = await tx.select().from(uploadIntents).where(and(eq(uploadIntents.scopeKey, scopeKey), eq(uploadIntents.state, "issued"), lte(uploadIntents.expiresAt, sql`CURRENT_TIMESTAMP`))).orderBy(uploadIntents.expiresAt, uploadIntents.id).limit(limit).for("update");
    for (const row of rows) await expireIfDue(tx, row, budget);
    return { expired: rows.length };
  });
}
