import { bigint, boolean, index, int, json, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { assets, organizations, workItems } from "./domain-core";

/** Provisioned by trusted operations only; absence never grants a default budget. */
export const uploadQuotaBudgets = mysqlTable("upload_quota_budgets", {
  scopeKey: varchar("scopeKey", { length: 64 }).primaryKey(),
  limitBytes: bigint("limitBytes", { mode: "number" }).notNull(),
  maxActiveIntents: int("maxActiveIntents").notNull(),
  reservedBytes: bigint("reservedBytes", { mode: "number" }).default(0).notNull(),
  retainedBytes: bigint("retainedBytes", { mode: "number" }).default(0).notNull(),
  storedBytes: bigint("storedBytes", { mode: "number" }).default(0).notNull(),
  activeIntents: int("activeIntents").default(0).notNull(),
});

/** Private reception and scan-bound publication. Only ready assets may download. */
export const uploadIntents = mysqlTable("upload_intents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  actorUserId: int("actorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  ownerType: mysqlEnum("ownerType", ["personal", "organization"]).default("personal").notNull(),
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "restrict" }),
  workId: int("workId").references(() => workItems.id, { onDelete: "restrict" }),
  scopeKey: varchar("scopeKey", { length: 64 }).notNull(),
  reservationHeld: boolean("reservationHeld").default(false).notNull(),
  storageChargeHeld: boolean("storageChargeHeld").default(false).notNull(),
  idempotencyKeyHash: varchar("idempotencyKeyHash", { length: 64 }).notNull(),
  requestFingerprint: varchar("requestFingerprint", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  declaredMimeType: varchar("declaredMimeType", { length: 128 }).notNull(),
  expectedBytes: int("expectedBytes").notNull(),
  state: mysqlEnum("state", ["issued", "cancelled", "expired", "receiving", "quarantined", "rejected", "validating", "ready"]).default("issued").notNull(),
  revision: int("revision").default(0).notNull(),
  objectKey: varchar("objectKey", { length: 255 }),
  objectVersion: varchar("objectVersion", { length: 1024 }),
  sha256: varchar("sha256", { length: 64 }),
  actualBytes: int("actualBytes"),
  leaseToken: varchar("leaseToken", { length: 36 }),
  leaseUntil: timestamp("leaseUntil"),
  attempts: int("attempts").default(0).notNull(),
  nextAttemptAt: timestamp("nextAttemptAt"),
  errorCode: varchar("errorCode", { length: 64 }),
  assetId: int("assetId").references(() => assets.id, { onDelete: "restrict" }),
  scanPolicyVersion: varchar("scanPolicyVersion", { length: 128 }),
  scanEngineVersion: varchar("scanEngineVersion", { length: 255 }),
  detectedMimeType: varchar("detectedMimeType", { length: 128 }),
  scanCompletedAt: timestamp("scanCompletedAt"),
  validationAttempts: int("validationAttempts").default(0).notNull(),
  nextValidationAt: timestamp("nextValidationAt"),
  legalHold: boolean("legalHold").default(false).notNull(),
  tombstonedAt: timestamp("tombstonedAt"),
  cleanupState: mysqlEnum("cleanupState", ["pending", "deleting", "complete", "blocked"]).default("pending").notNull(),
  cleanupToken: varchar("cleanupToken", { length: 36 }),
  cleanupLeaseUntil: timestamp("cleanupLeaseUntil"),
  cleanupObjectVersion: varchar("cleanupObjectVersion", { length: 1024 }),
  cleanupAttempts: int("cleanupAttempts").default(0).notNull(),
  nextCleanupAt: timestamp("nextCleanupAt"),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  scopeExpiry: index("upload_intent_scope_expiry_idx").on(table.scopeKey, table.state, table.expiresAt, table.id),
  actorKeyUnique: uniqueIndex("upload_intent_actor_scope_key_unique").on(table.actorUserId, table.scopeKey, table.idempotencyKeyHash),
  objectKeyUnique: uniqueIndex("upload_intent_object_key_unique").on(table.objectKey),
  assetUnique: uniqueIndex("upload_intent_asset_unique").on(table.assetId),
}));

/** Durable domain event, committed in the same transaction as Asset + intent.
 * Notifications are written atomically too; future consumers dedupe by intentId. */
export const uploadEvents = mysqlTable("upload_events", {
  intentId: varchar("intentId", { length: 36 }).primaryKey().references(() => uploadIntents.id, { onDelete: "restrict" }),
  eventType: varchar("eventType", { length: 64 }).notNull(),
  payload: json("payload").$type<{ assetId: number; actorUserId: number; scopeKey: string }>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});
