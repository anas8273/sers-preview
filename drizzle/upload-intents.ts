import { bigint, boolean, index, int, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { users } from "./schema";
import { organizations, workItems } from "./domain-core";

/** Provisioned by trusted operations only; absence never grants a default budget. */
export const uploadQuotaBudgets = mysqlTable("upload_quota_budgets", {
  scopeKey: varchar("scopeKey", { length: 64 }).primaryKey(),
  limitBytes: bigint("limitBytes", { mode: "number" }).notNull(),
  maxActiveIntents: int("maxActiveIntents").notNull(),
  reservedBytes: bigint("reservedBytes", { mode: "number" }).default(0).notNull(),
  activeIntents: int("activeIntents").default(0).notNull(),
});

/** B04 reservation foundation. No storage operation may use these intents yet. */
export const uploadIntents = mysqlTable("upload_intents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  actorUserId: int("actorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  ownerType: mysqlEnum("ownerType", ["personal", "organization"]).default("personal").notNull(),
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "restrict" }),
  workId: int("workId").references(() => workItems.id, { onDelete: "restrict" }),
  scopeKey: varchar("scopeKey", { length: 64 }).notNull(),
  reservationHeld: boolean("reservationHeld").default(false).notNull(),
  idempotencyKeyHash: varchar("idempotencyKeyHash", { length: 64 }).notNull(),
  requestFingerprint: varchar("requestFingerprint", { length: 64 }).notNull(),
  fileName: varchar("fileName", { length: 255 }).notNull(),
  declaredMimeType: varchar("declaredMimeType", { length: 128 }).notNull(),
  expectedBytes: int("expectedBytes").notNull(),
  state: mysqlEnum("state", ["issued", "cancelled", "expired"]).default("issued").notNull(),
  revision: int("revision").default(0).notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  scopeExpiry: index("upload_intent_scope_expiry_idx").on(table.scopeKey, table.state, table.expiresAt, table.id),
  actorKeyUnique: uniqueIndex("upload_intent_actor_scope_key_unique").on(table.actorUserId, table.scopeKey, table.idempotencyKeyHash),
}));
