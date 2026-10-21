import { int, mysqlEnum, mysqlTable, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { users } from "./schema";

/** B04 foundation only. No storage operation may use these intents yet. */
export const uploadIntents = mysqlTable("upload_intents", {
  id: varchar("id", { length: 36 }).primaryKey(),
  actorUserId: int("actorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  // Scope is deliberately personal-only: actorUserId is also the owner.
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
  actorKeyUnique: uniqueIndex("upload_intent_actor_key_unique").on(table.actorUserId, table.idempotencyKeyHash),
}));
