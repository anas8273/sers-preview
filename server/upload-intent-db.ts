import { createHash, randomUUID } from "node:crypto";
import { and, eq, lte, sql } from "drizzle-orm";
import { uploadIntents } from "../drizzle/upload-intents";
import { getDb } from "./db";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";

/** Persistence foundation only: no upload, quota reservation or asset publication. */
export interface BeginUploadIntentInput {
  idempotencyKey: string;
  fileName: string;
  mimeType: string;
  expectedBytes: number;
}

export class UploadIntentConflictError extends Error {
  constructor() {
    super("Upload intent conflict");
    this.name = "UploadIntentConflictError";
  }
}

type Intent = typeof uploadIntents.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];

// Projection intentionally excludes display names, hashes and other internal data.
function project(row: Intent) {
  return { id: row.id, state: row.state, revision: row.revision, expiresAt: row.expiresAt, createdAt: row.createdAt };
}

function assertActor(userId: number) {
  if (!Number.isSafeInteger(userId) || userId <= 0) throw new Error("Invalid upload actor");
}

function validated(input: BeginUploadIntentInput) {
  if (typeof input.idempotencyKey !== "string" || !/^[A-Za-z0-9_-]{16,128}$/.test(input.idempotencyKey)) {
    throw new Error("Invalid upload idempotency key");
  }
  if (typeof input.fileName !== "string" || !input.fileName.trim() || input.fileName.length > 255 || /[\\/\x00-\x1f\x7f:]/.test(input.fileName)) {
    throw new Error("Invalid upload file name");
  }
  if (typeof input.mimeType !== "string" || !/^[a-zA-Z0-9!#$&^_.+-]+\/[a-zA-Z0-9!#$&^_.+-]+$/.test(input.mimeType) || input.mimeType.length > 128) {
    throw new Error("Invalid upload MIME type");
  }
  if (!Number.isSafeInteger(input.expectedBytes) || input.expectedBytes <= 0 || input.expectedBytes > MAX_EVIDENCE_BYTES) {
    throw new Error("Invalid upload byte count");
  }
  const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");
  const mimeType = input.mimeType.toLowerCase();
  return {
    idempotencyKeyHash: sha256(input.idempotencyKey),
    requestFingerprint: sha256(JSON.stringify(["personal-v1", input.fileName, mimeType, input.expectedBytes])),
    fileName: input.fileName,
    declaredMimeType: mimeType,
    expectedBytes: input.expectedBytes,
  };
}

async function database() {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db;
}

/** Caller holds the intent row lock; DB clock is authoritative for expiry. */
async function expireIfDue(tx: Transaction, row: Intent): Promise<Intent> {
  if (row.state !== "issued") return row;
  await tx.update(uploadIntents).set({ state: "expired", revision: row.revision + 1 })
    .where(and(eq(uploadIntents.id, row.id), eq(uploadIntents.revision, row.revision),
      eq(uploadIntents.state, "issued"), lte(uploadIntents.expiresAt, sql`CURRENT_TIMESTAMP`)));
  const [current] = await tx.select().from(uploadIntents).where(eq(uploadIntents.id, row.id)).limit(1);
  if (!current) throw new Error("Upload intent disappeared");
  return current;
}

export async function beginUploadIntentForUser(userId: number, input: BeginUploadIntentInput) {
  assertActor(userId);
  const value = validated(input);
  const db = await database();
  return db.transaction(async (tx) => {
    // The unique actor/key constraint serializes duplicate requests. A duplicate
    // never replaces the original payload, terminal state or expiration date.
    await tx.insert(uploadIntents).values({
      id: randomUUID(), actorUserId: userId, ...value,
      expiresAt: sql`DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 15 MINUTE)`,
    }).onDuplicateKeyUpdate({ set: { id: sql`${uploadIntents.id}` } });
    const [row] = await tx.select().from(uploadIntents).where(and(
      eq(uploadIntents.actorUserId, userId), eq(uploadIntents.idempotencyKeyHash, value.idempotencyKeyHash),
    )).limit(1).for("update");
    if (!row) throw new Error("Upload intent insert not confirmed");
    if (row.requestFingerprint !== value.requestFingerprint) throw new UploadIntentConflictError();
    return project(await expireIfDue(tx, row));
  });
}

export async function getUploadIntentForUser(userId: number, id: string) {
  assertActor(userId);
  const db = await database();
  return db.transaction(async (tx) => {
    const [row] = await tx.select().from(uploadIntents).where(and(
      eq(uploadIntents.id, id), eq(uploadIntents.actorUserId, userId),
    )).limit(1).for("update");
    return row ? project(await expireIfDue(tx, row)) : undefined;
  });
}

export async function cancelUploadIntentForUser(userId: number, id: string, expectedRevision: number) {
  assertActor(userId);
  if (!Number.isSafeInteger(expectedRevision) || expectedRevision < 0) throw new Error("Invalid upload revision");
  const db = await database();
  return db.transaction(async (tx) => {
    const [found] = await tx.select().from(uploadIntents).where(and(
      eq(uploadIntents.id, id), eq(uploadIntents.actorUserId, userId),
    )).limit(1).for("update");
    if (!found) return undefined;
    const row = await expireIfDue(tx, found);
    // Repeated cancellation or an expired intent never reopens the request.
    if (row.state !== "issued") return project(row);
    if (row.revision !== expectedRevision) throw new UploadIntentConflictError();
    await tx.update(uploadIntents).set({ state: "cancelled", revision: row.revision + 1 })
      .where(and(eq(uploadIntents.id, row.id), eq(uploadIntents.actorUserId, userId),
        eq(uploadIntents.state, "issued"), eq(uploadIntents.revision, expectedRevision)));
    const [current] = await tx.select().from(uploadIntents).where(eq(uploadIntents.id, row.id)).limit(1);
    if (!current || current.state !== "cancelled" || current.revision !== expectedRevision + 1) {
      throw new UploadIntentConflictError();
    }
    return project(current);
  });
}
