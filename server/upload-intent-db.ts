import { createHash, randomUUID } from "node:crypto";
import { and, eq, inArray, isNull, lte, sql } from "drizzle-orm";
import { uploadEvents, uploadIntents, uploadQuotaBudgets } from "../drizzle/upload-intents";
import { assets, memberships, notifications, organizations, workAssetLinks, workItems, workVersions } from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { getDb } from "./db";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";
import type { PrivateUploadResult } from "./private-upload-storage";

/** Transactional reception state. Network I/O never happens inside a transaction. */
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
  return { id: row.id, state: row.state, revision: row.revision, expiresAt: row.expiresAt, createdAt: row.createdAt,
    ...(row.state === "ready" && row.assetId ? { assetId: row.assetId } : {}),
  };
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
  return !!budget && [budget.limitBytes, budget.reservedBytes, budget.retainedBytes, budget.storedBytes, budget.maxActiveIntents, budget.activeIntents].every(n => Number.isSafeInteger(n) && n >= 0);
}
async function release(tx: Transaction, row: Intent, budget: Budget | undefined) {
  if (!row.reservationHeld) return;
  if (!validBudget(budget) || budget.reservedBytes < row.expectedBytes || budget.activeIntents < 1) throw new UploadIntentQuotaError();
  await tx.update(uploadQuotaBudgets).set({ reservedBytes: budget.reservedBytes - row.expectedBytes, activeIntents: budget.activeIntents - 1 }).where(eq(uploadQuotaBudgets.scopeKey, row.scopeKey));
  await tx.update(uploadIntents).set({ reservationHeld: false }).where(eq(uploadIntents.id, row.id));
  budget.reservedBytes -= row.expectedBytes; budget.activeIntents -= 1;
}
async function expireIfDue(tx: Transaction, row: Intent, budget: Budget | undefined): Promise<Intent> {
  if (!["issued", "receiving", "quarantined", "validating"].includes(row.state)) return row;
  await tx.update(uploadIntents).set({ state: "expired", revision: row.revision + 1, leaseToken: null, leaseUntil: null }).where(and(eq(uploadIntents.id, row.id), eq(uploadIntents.revision, row.revision), eq(uploadIntents.state, row.state), lte(uploadIntents.expiresAt, sql`CURRENT_TIMESTAMP`)));
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
    if (!validBudget(budget) || value.expectedBytes > budget.limitBytes - budget.reservedBytes - budget.retainedBytes - budget.storedBytes || budget.activeIntents >= budget.maxActiveIntents) throw new UploadIntentQuotaError();
    const id = randomUUID();
    await tx.insert(uploadIntents).values({ id, actorUserId: userId, ...value, reservationHeld: true, expiresAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)` });
    await tx.update(uploadQuotaBudgets).set({ reservedBytes: budget.reservedBytes + value.expectedBytes, activeIntents: budget.activeIntents + 1 }).where(eq(uploadQuotaBudgets.scopeKey, value.scopeKey));
    const [row] = await tx.select().from(uploadIntents).where(eq(uploadIntents.id, id)).limit(1);
    return project(row);
  });
}
async function ownedTransaction<T>(userId: number, id: string, operation: (tx: Transaction, row: Intent, budget: Budget | undefined) => Promise<T>) {
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
    if (!["issued", "receiving", "quarantined", "validating"].includes(row.state)) return project(row);
    if (row.revision !== expectedRevision) throw new UploadIntentConflictError();
    await tx.update(uploadIntents).set({ state: "cancelled", revision: row.revision + 1, leaseToken: null, leaseUntil: null }).where(and(eq(uploadIntents.id, row.id), eq(uploadIntents.state, row.state), eq(uploadIntents.revision, expectedRevision)));
    await release(tx, row, budget);
    return project({ ...row, state: "cancelled", revision: row.revision + 1, reservationHeld: false });
  });
}

/** Trusted maintenance only, deliberately not exported through an application router.
 * Releases only pre-storage reservations. Possible stored bytes remain charged. */
export async function expireUploadIntentsForScope(scopeKey: string, limit = 100) {
  if (!/^(personal|organization):[1-9][0-9]*$/.test(scopeKey) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid expiry sweep");
  const db = await database();
  return db.transaction(async tx => {
    const budget = await lockBudget(tx, scopeKey);
    const rows = await tx.select().from(uploadIntents).where(and(eq(uploadIntents.scopeKey, scopeKey), inArray(uploadIntents.state, ["issued", "receiving", "quarantined", "validating"]), lte(uploadIntents.expiresAt, sql`CURRENT_TIMESTAMP`))).orderBy(uploadIntents.expiresAt, uploadIntents.id).limit(limit).for("update");
    for (const row of rows) await expireIfDue(tx, row, budget);
    return { expired: rows.length };
  });
}

/** Server-only capability. Never serialize a lease or its object key to a client. */
export interface UploadReceptionLease {
  id: string;
  userId: number;
  token: string;
  key: string;
  expectedBytes: number;
  sha256: string | null;
}
const leaseFor = (row: Intent, userId: number): UploadReceptionLease => ({
  id: row.id, userId, token: row.leaseToken!, key: row.objectKey!,
  expectedBytes: row.expectedBytes, sha256: row.sha256,
});
async function leaseIsLive(tx: Transaction, row: Intent, lease: UploadReceptionLease) {
  if (row.state !== "receiving" || row.leaseToken !== lease.token || row.objectKey !== lease.key) return false;
  const [clock] = await tx.select({ live: sql<number>`${uploadIntents.leaseUntil} > CURRENT_TIMESTAMP` })
    .from(uploadIntents).where(eq(uploadIntents.id, row.id));
  return Number(clock?.live) === 1;
}

export async function claimUploadReceptionForUser(userId: number, id: string, expectedRevision: number) {
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Invalid upload revision");
  return ownedTransaction(userId, id, async (tx, found, budget) => {
    const row = await expireIfDue(tx, found, budget);
    if (["cancelled", "expired", "rejected"].includes(row.state)) return undefined;
    if (row.state !== "issued" || row.revision !== expectedRevision) throw new UploadIntentConflictError();
    if (!row.reservationHeld || row.storageChargeHeld || !validBudget(budget) || budget.reservedBytes < row.expectedBytes || budget.activeIntents < 1 || !Number.isSafeInteger(budget.retainedBytes + row.expectedBytes)) throw new UploadIntentQuotaError();
    // Commit the key and charge BEFORE accepting any bytes or contacting storage.
    const token = randomUUID(), key = `quarantine/${randomUUID()}`;
    await tx.update(uploadQuotaBudgets).set({
      reservedBytes: budget.reservedBytes - row.expectedBytes,
      retainedBytes: budget.retainedBytes + row.expectedBytes,
    }).where(eq(uploadQuotaBudgets.scopeKey, row.scopeKey));
    await tx.update(uploadIntents).set({ state: "receiving", revision: row.revision + 1,
      reservationHeld: false, storageChargeHeld: true, objectKey: key,
      leaseToken: token, leaseUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)`, attempts: 1,
    }).where(eq(uploadIntents.id, row.id));
    return leaseFor({ ...row, objectKey: key, leaseToken: token }, userId);
  });
}

/** Called only with the digest derived from the bounded server-side source.
 * A lost commit acknowledgement must stop the writer. Recovery inspects this row. */
export async function prepareUploadReception(lease: UploadReceptionLease, bytes: number, sha256: string) {
  if (bytes !== lease.expectedBytes || !/^[a-f0-9]{64}$/.test(sha256)) throw new UploadIntentConflictError();
  const prepared = await ownedTransaction(lease.userId, lease.id, async (tx, found, budget) => {
    const row = await expireIfDue(tx, found, budget);
    if (!await leaseIsLive(tx, row, lease) || row.sha256 !== null) return false;
    await tx.update(uploadIntents).set({ sha256, actualBytes: bytes }).where(eq(uploadIntents.id, row.id));
    return true;
  });
  if (!prepared) throw new UploadIntentAccessError();
}

export async function finishUploadReception(lease: UploadReceptionLease, result: PrivateUploadResult) {
  return ownedTransaction(lease.userId, lease.id, async (tx, found, budget) => {
    const row = await expireIfDue(tx, found, budget);
    if (!await leaseIsLive(tx, row, lease)) return project(row);
    if (result.status === "confirmed") {
      const receipt = result.receipt;
      if (!row.sha256 || receipt.key !== row.objectKey || receipt.bytes !== row.expectedBytes || receipt.sha256 !== row.sha256 || !receipt.version || receipt.version.length > 1024) throw new UploadIntentConflictError();
      await tx.update(uploadIntents).set({ state: "quarantined", revision: row.revision + 1,
        objectVersion: receipt.version, leaseToken: null, leaseUntil: null, nextAttemptAt: null, errorCode: null,
      }).where(eq(uploadIntents.id, row.id));
      return project({ ...row, state: "quarantined", revision: row.revision + 1 });
    }
    // Only a source rejection before durable preparation proves no put was started.
    if (result.status === "rejected" && row.sha256 === null) {
      if (!row.storageChargeHeld || !validBudget(budget) || budget.retainedBytes < row.expectedBytes || budget.activeIntents < 1) throw new UploadIntentQuotaError();
      await tx.update(uploadQuotaBudgets).set({ retainedBytes: budget.retainedBytes - row.expectedBytes,
        activeIntents: budget.activeIntents - 1,
      }).where(eq(uploadQuotaBudgets.scopeKey, row.scopeKey));
      await tx.update(uploadIntents).set({ state: "rejected", revision: row.revision + 1,
        storageChargeHeld: false, leaseToken: null, leaseUntil: null, nextAttemptAt: null, errorCode: "source_rejected",
      }).where(eq(uploadIntents.id, row.id));
      return project({ ...row, state: "rejected", revision: row.revision + 1 });
    }
    // A timeout can hide a successful put. Keep both the charge and stable digest.
    await tx.update(uploadIntents).set({ leaseToken: null, leaseUntil: null,
      nextAttemptAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 SECOND)`,
      errorCode: row.attempts >= 8 ? "reconciliation_required" : "storage_unconfirmed",
    }).where(eq(uploadIntents.id, row.id));
    return project(row);
  });
}

/** Recovery never accepts another source or repeats put. A stale writer cannot
 * replace the committed digest, even after process restart or lease takeover. */
export async function claimUploadReconciliationForUser(userId: number, id: string) {
  return ownedTransaction(userId, id, async (tx, found, budget) => {
    const row = await expireIfDue(tx, found, budget);
    if (row.state !== "receiving" || !row.objectKey || !row.storageChargeHeld || row.attempts >= 8) return undefined;
    const [clock] = await tx.select({ due: sql<number>`
      (${uploadIntents.leaseUntil} IS NULL OR ${uploadIntents.leaseUntil} <= CURRENT_TIMESTAMP)
      AND (${uploadIntents.nextAttemptAt} IS NULL OR ${uploadIntents.nextAttemptAt} <= CURRENT_TIMESTAMP)` })
      .from(uploadIntents).where(eq(uploadIntents.id, row.id));
    if (Number(clock?.due) !== 1) return undefined;
    const token = randomUUID();
    await tx.update(uploadIntents).set({ leaseToken: token,
      leaseUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)`, attempts: row.attempts + 1,
    }).where(eq(uploadIntents.id, row.id));
    return leaseFor({ ...row, leaseToken: token }, userId);
  });
}

/** Trusted bounded maintenance discovery; not an application router. */
export async function listUploadReconciliationCandidates(scopeKey: string, limit = 100) {
  if (!/^(personal|organization):[1-9][0-9]*$/.test(scopeKey) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid reconciliation sweep");
  const db = await database();
  return db.select({ id: uploadIntents.id, userId: uploadIntents.actorUserId }).from(uploadIntents)
    .where(and(eq(uploadIntents.scopeKey, scopeKey), eq(uploadIntents.state, "receiving"),
      sql`${uploadIntents.attempts} < 8`,
      sql`(${uploadIntents.leaseUntil} IS NULL OR ${uploadIntents.leaseUntil} <= CURRENT_TIMESTAMP)`,
      sql`(${uploadIntents.nextAttemptAt} IS NULL OR ${uploadIntents.nextAttemptAt} <= CURRENT_TIMESTAMP)`))
    .orderBy(uploadIntents.expiresAt, uploadIntents.id).limit(limit);
}

/** Provision an explicitly configured server policy once, never reset usage or
 * silently change an existing school's budget through a user request. */
export async function provisionUploadBudgetForUser(userId: number, input: BeginUploadIntentInput, limits: { limitBytes: number; maxActiveIntents: number }) {
  assertActor(userId);
  if (!Number.isSafeInteger(limits.limitBytes) || limits.limitBytes < 1 || !Number.isSafeInteger(limits.maxActiveIntents) || limits.maxActiveIntents < 1 || limits.maxActiveIntents > 1000) throw new Error("Invalid upload budget policy");
  const scope = validated(userId, input), db = await database();
  return db.transaction(async tx => {
    if (!await authorize(tx, userId, scope)) throw new UploadIntentAccessError();
    const existing = await lockBudget(tx, scope.scopeKey);
    if (!existing) await tx.insert(uploadQuotaBudgets).values({ scopeKey: scope.scopeKey, ...limits });
    return { provisioned: !existing };
  });
}

export interface UploadValidationLease {
  id: string; userId: number; token: string; key: string; version: string;
  bytes: number; sha256: string; fileName: string; declaredMimeType: string; policyVersion: string;
}
export type UploadValidationResult =
  | { status: "clean"; policyVersion: string; sha256: string; bytes: number; mimeType: string; engineVersion: string }
  | { status: "rejected"; policyVersion: string; reason: string }
  | { status: "unknown"; policyVersion: string; reason: string };

export async function claimUploadValidationForUser(userId: number, id: string, policyVersion: string) {
  if (!policyVersion || policyVersion.length > 128 || /[\x00-\x1f]/.test(policyVersion)) throw new Error("Invalid scan policy");
  return ownedTransaction(userId, id, async (tx, found, budget): Promise<UploadValidationLease | undefined> => {
    const row = await expireIfDue(tx, found, budget);
    if (!["quarantined", "validating"].includes(row.state) || !row.objectKey || !row.objectVersion || !row.sha256 || row.actualBytes !== row.expectedBytes || row.assetId || row.tombstonedAt || !row.storageChargeHeld || row.validationAttempts >= 8) return undefined;
    const [clock] = await tx.select({ due: sql<number>`
      (${uploadIntents.leaseUntil} IS NULL OR ${uploadIntents.leaseUntil} <= CURRENT_TIMESTAMP)
      AND (${uploadIntents.nextValidationAt} IS NULL OR ${uploadIntents.nextValidationAt} <= CURRENT_TIMESTAMP)` })
      .from(uploadIntents).where(eq(uploadIntents.id, row.id));
    if (Number(clock?.due) !== 1) return undefined;
    const token = randomUUID();
    await tx.update(uploadIntents).set({ state: "validating", revision: row.revision + 1,
      leaseToken: token, leaseUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 90 SECOND)`,
      validationAttempts: row.validationAttempts + 1, scanPolicyVersion: policyVersion,
    }).where(eq(uploadIntents.id, row.id));
    return { id: row.id, userId, token, key: row.objectKey, version: row.objectVersion,
      bytes: row.expectedBytes, sha256: row.sha256, fileName: row.fileName, declaredMimeType: row.declaredMimeType, policyVersion };
  });
}

export async function finishUploadValidation(lease: UploadValidationLease, result: UploadValidationResult) {
  return ownedTransaction(lease.userId, lease.id, async (tx, found, budget) => {
    const row = await expireIfDue(tx, found, budget);
    if (row.state === "ready") return project(row);
    const [clock] = await tx.select({ live: sql<number>`${uploadIntents.leaseUntil} > CURRENT_TIMESTAMP` }).from(uploadIntents).where(eq(uploadIntents.id, row.id));
    if (row.state !== "validating" || row.leaseToken !== lease.token || Number(clock?.live) !== 1 || row.tombstonedAt || row.assetId || row.objectKey !== lease.key || row.objectVersion !== lease.version || row.sha256 !== lease.sha256 || row.scanPolicyVersion !== lease.policyVersion) return project(row);
    if (result.policyVersion !== lease.policyVersion) throw new UploadIntentConflictError();
    if (result.status === "unknown") {
      await tx.update(uploadIntents).set({ state: "quarantined", revision: row.revision + 1,
        leaseToken: null, leaseUntil: null, nextValidationAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 SECOND)`,
        errorCode: row.validationAttempts >= 8 ? "scan_review_required" : "scan_unavailable",
      }).where(eq(uploadIntents.id, row.id));
      return project({ ...row, state: "quarantined", revision: row.revision + 1 });
    }
    if (result.status === "rejected") {
      await tx.update(uploadIntents).set({ state: "rejected", revision: row.revision + 1,
        leaseToken: null, leaseUntil: null, nextValidationAt: null, errorCode: "scan_rejected", scanCompletedAt: sql`CURRENT_TIMESTAMP`,
      }).where(eq(uploadIntents.id, row.id));
      return project({ ...row, state: "rejected", revision: row.revision + 1 });
    }
    if (result.sha256 !== row.sha256 || result.bytes !== row.expectedBytes || !/^[a-z0-9!#$&^_.+-]+\/[a-z0-9!#$&^_.+-]+$/.test(result.mimeType) || result.mimeType.length > 128 || !result.engineVersion || result.engineVersion.length > 255) throw new UploadIntentConflictError();
    if (!row.storageChargeHeld || !validBudget(budget) || budget.retainedBytes < row.expectedBytes || budget.activeIntents < 1 || !Number.isSafeInteger(budget.storedBytes + row.expectedBytes)) throw new UploadIntentQuotaError();
    const [created] = await tx.insert(assets).values({ creatorUserId: lease.userId, ownerType: row.ownerType,
      ownerUserId: row.ownerType === "personal" ? lease.userId : null,
      ownerOrganizationId: row.organizationId, kind: "file", title: row.fileName,
      storageKey: row.objectKey, mimeType: result.mimeType, fileSize: result.bytes,
      metadata: { uploadIntentId: row.id, objectVersion: row.objectVersion, sha256: row.sha256, scanPolicyVersion: result.policyVersion },
    });
    const assetId = Number(created.insertId);
    if (row.workId) await tx.insert(workAssetLinks).values({ workItemId: row.workId, assetId, role: "evidence" });
    await tx.insert(uploadEvents).values({ intentId: row.id, eventType: "asset.ready", payload: { assetId, actorUserId: lease.userId, scopeKey: row.scopeKey } });
    await tx.insert(notifications).values({ userId: lease.userId, type: "asset.ready", dedupeKey: `upload-ready:${row.id}`,
      title: "اكتمل رفع الشاهد", body: row.fileName, targetType: "asset", targetId: String(assetId),
    });
    await tx.update(uploadQuotaBudgets).set({ retainedBytes: budget.retainedBytes - row.expectedBytes,
      storedBytes: budget.storedBytes + row.expectedBytes, activeIntents: budget.activeIntents - 1,
    }).where(eq(uploadQuotaBudgets.scopeKey, row.scopeKey));
    await tx.update(uploadIntents).set({ state: "ready", revision: row.revision + 1, assetId,
      storageChargeHeld: false, detectedMimeType: result.mimeType, scanEngineVersion: result.engineVersion,
      scanCompletedAt: sql`CURRENT_TIMESTAMP`, leaseToken: null, leaseUntil: null, nextValidationAt: null, errorCode: null,
    }).where(eq(uploadIntents.id, row.id));
    return project({ ...row, state: "ready", assetId, revision: row.revision + 1 });
  });
}

/** Read authorization is independent of the originating work and uploader.
 * A member may read school evidence even after it is unlinked from its work. */
export async function getReadyUploadAssetForUser(userId: number, assetId: number) {
  assertActor(userId);
  if (!Number.isSafeInteger(assetId) || assetId < 1) return undefined;
  const db = await database();
  const [row] = await db.select({ asset: assets, intent: uploadIntents }).from(assets)
    .innerJoin(uploadIntents, eq(uploadIntents.assetId, assets.id))
    .where(and(eq(assets.id, assetId), isNull(assets.deletedAt), eq(uploadIntents.state, "ready"), isNull(uploadIntents.tombstonedAt))).limit(1);
  if (!row || !row.intent.objectKey || !row.intent.objectVersion || !row.intent.sha256 || !row.intent.detectedMimeType || !row.intent.scanCompletedAt || !row.intent.scanPolicyVersion || row.asset.storageKey !== row.intent.objectKey) return undefined;
  if (row.asset.ownerType === "personal") {
    if (row.asset.ownerUserId !== userId) return undefined;
  } else {
    if (!row.asset.ownerOrganizationId) return undefined;
    const [membership] = await db.select({ id: memberships.id }).from(memberships)
      .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
      .where(and(eq(memberships.organizationId, row.asset.ownerOrganizationId), eq(memberships.userId, userId), eq(memberships.status, "active"), eq(organizations.status, "active"))).limit(1);
    if (!membership) return undefined;
  }
  return { id: row.asset.id, intentId: row.intent.id, key: row.intent.objectKey, version: row.intent.objectVersion,
    bytes: row.intent.expectedBytes, sha256: row.intent.sha256, mimeType: row.intent.detectedMimeType, fileName: row.intent.fileName };
}

function terminalForCleanup(row: Intent) { return ["cancelled", "expired", "rejected"].includes(row.state) && !row.assetId; }
async function hasStorageReferences(tx: Transaction, row: Intent) {
  if (!row.objectKey) return false;
  // Even soft-deleted assets may be referenced by immutable reports; keep them.
  const [asset] = await tx.select({ id: assets.id }).from(assets).where(eq(assets.storageKey, row.objectKey)).limit(1);
  if (asset) return true;
  const [version] = await tx.select({ id: workVersions.id }).from(workVersions)
    .where(sql`INSTR(CAST(${workVersions.snapshot} AS CHAR), JSON_QUOTE(${row.objectKey})) > 0`).limit(1);
  return Boolean(version);
}
async function cleanupTransaction<T>(id: string, operation: (tx: Transaction, row: Intent, budget: Budget | undefined) => Promise<T>) {
  const db = await database();
  const [hint] = await db.select({ scopeKey: uploadIntents.scopeKey }).from(uploadIntents).where(eq(uploadIntents.id, id)).limit(1);
  if (!hint) return undefined;
  return db.transaction(async tx => {
    const budget = await lockBudget(tx, hint.scopeKey);
    const [row] = await tx.select().from(uploadIntents).where(eq(uploadIntents.id, id)).limit(1).for("update");
    return row ? operation(tx, row, budget) : undefined;
  });
}
async function releaseRetained(tx: Transaction, row: Intent, budget: Budget | undefined) {
  if (!row.storageChargeHeld) return;
  if (!validBudget(budget) || budget.retainedBytes < row.expectedBytes || budget.activeIntents < 1) throw new UploadIntentQuotaError();
  await tx.update(uploadQuotaBudgets).set({ retainedBytes: budget.retainedBytes - row.expectedBytes, activeIntents: budget.activeIntents - 1 }).where(eq(uploadQuotaBudgets.scopeKey, row.scopeKey));
}
export interface UploadCleanupLease {
  id: string; token: string; key: string; version: string | null; sha256: string;
  bytes: number;
}
/** Trusted maintenance, deliberately does not depend on a still-active uploader. */
export async function claimUploadCleanup(id: string) {
  return cleanupTransaction(id, async (tx, row, budget): Promise<{ complete: true } | UploadCleanupLease | undefined> => {
    if (!terminalForCleanup(row) || row.legalHold || row.cleanupState === "blocked") return undefined;
    if (!row.storageChargeHeld) return { complete: true };
    if (await hasStorageReferences(tx, row)) {
      await tx.update(uploadIntents).set({ cleanupState: "blocked", errorCode: "cleanup_live_reference" }).where(eq(uploadIntents.id, id));
      return undefined;
    }
    const [clock] = await tx.select({ due: sql<number>`
      (${uploadIntents.cleanupLeaseUntil} IS NULL OR ${uploadIntents.cleanupLeaseUntil} <= CURRENT_TIMESTAMP)
      AND (${uploadIntents.nextCleanupAt} IS NULL OR ${uploadIntents.nextCleanupAt} <= CURRENT_TIMESTAMP)` }).from(uploadIntents).where(eq(uploadIntents.id, id));
    if (Number(clock?.due) !== 1 || row.cleanupAttempts >= 8) return undefined;
    // No digest means preparation never committed; terminal state fences every
    // outstanding reader before it can begin put. There is nothing to delete.
    if (!row.sha256) {
      await releaseRetained(tx, row, budget);
      await tx.update(uploadIntents).set({ storageChargeHeld: false, cleanupState: "complete", tombstonedAt: sql`CURRENT_TIMESTAMP`, cleanupToken: null, cleanupLeaseUntil: null }).where(eq(uploadIntents.id, id));
      return { complete: true };
    }
    if (!row.objectKey) return undefined;
    const token = randomUUID();
    await tx.update(uploadIntents).set({ cleanupState: "deleting", tombstonedAt: sql`COALESCE(${uploadIntents.tombstonedAt}, CURRENT_TIMESTAMP)`,
      cleanupToken: token, cleanupLeaseUntil: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 60 SECOND)`, cleanupAttempts: row.cleanupAttempts + 1,
    }).where(eq(uploadIntents.id, id));
    return { id, token, key: row.objectKey, version: row.cleanupObjectVersion ?? row.objectVersion, sha256: row.sha256, bytes: row.expectedBytes };
  });
}
async function liveCleanup(tx: Transaction, row: Intent, lease: UploadCleanupLease) {
  if (!terminalForCleanup(row) || row.legalHold || !row.tombstonedAt || row.cleanupToken !== lease.token || row.objectKey !== lease.key || row.cleanupState !== "deleting") return false;
  const [clock] = await tx.select({ live: sql<number>`${uploadIntents.cleanupLeaseUntil} > CURRENT_TIMESTAMP` }).from(uploadIntents).where(eq(uploadIntents.id, row.id));
  return Number(clock?.live) === 1 && !await hasStorageReferences(tx, row);
}
export async function prepareUploadCleanupDeletion(lease: UploadCleanupLease, version: string) {
  if (!version || version.length > 1024) return false;
  return cleanupTransaction(lease.id, async (tx, row) => {
    if (!await liveCleanup(tx, row, lease) || (row.cleanupObjectVersion && row.cleanupObjectVersion !== version) || (row.objectVersion && row.objectVersion !== version)) return false;
    await tx.update(uploadIntents).set({ cleanupObjectVersion: version }).where(eq(uploadIntents.id, row.id));
    return true;
  });
}
export async function finishUploadCleanup(lease: UploadCleanupLease, outcome: "deleted" | "missing" | "unknown" | "version_mismatch") {
  return cleanupTransaction(lease.id, async (tx, row, budget) => {
    if (!await liveCleanup(tx, row, lease)) return false;
    if ((outcome === "deleted" || outcome === "missing") && row.cleanupObjectVersion) {
      await releaseRetained(tx, row, budget);
      await tx.update(uploadIntents).set({ storageChargeHeld: false, cleanupState: "complete", cleanupToken: null, cleanupLeaseUntil: null, nextCleanupAt: null, errorCode: null }).where(eq(uploadIntents.id, row.id));
      return true;
    }
    await tx.update(uploadIntents).set({ cleanupState: "pending", cleanupToken: null, cleanupLeaseUntil: null,
      nextCleanupAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 30 SECOND)`,
      errorCode: row.cleanupAttempts >= 8 ? "cleanup_review_required" : "cleanup_unconfirmed",
    }).where(eq(uploadIntents.id, row.id));
    return false;
  });
}

export async function listUploadLifecycleCandidates(scopeKey: string, kind: "validation" | "cleanup", limit = 50) {
  if (!/^(personal|organization):[1-9][0-9]*$/.test(scopeKey) || !Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error("Invalid upload maintenance scope");
  const db = await database();
  return db.select({ id: uploadIntents.id, userId: uploadIntents.actorUserId }).from(uploadIntents)
    .where(and(eq(uploadIntents.scopeKey, scopeKey), kind === "validation"
      ? and(inArray(uploadIntents.state, ["quarantined", "validating"]), sql`${uploadIntents.validationAttempts} < 8`, sql`(${uploadIntents.leaseUntil} IS NULL OR ${uploadIntents.leaseUntil} <= CURRENT_TIMESTAMP)`, sql`(${uploadIntents.nextValidationAt} IS NULL OR ${uploadIntents.nextValidationAt} <= CURRENT_TIMESTAMP)`)
      : and(inArray(uploadIntents.state, ["cancelled", "expired", "rejected"]), eq(uploadIntents.storageChargeHeld, true), eq(uploadIntents.legalHold, false), inArray(uploadIntents.cleanupState, ["pending", "deleting"]), sql`${uploadIntents.cleanupAttempts} < 8`, sql`(${uploadIntents.cleanupLeaseUntil} IS NULL OR ${uploadIntents.cleanupLeaseUntil} <= CURRENT_TIMESTAMP)`, sql`(${uploadIntents.nextCleanupAt} IS NULL OR ${uploadIntents.nextCleanupAt} <= CURRENT_TIMESTAMP)`)))
    .orderBy(uploadIntents.createdAt, uploadIntents.id).limit(limit);
}
