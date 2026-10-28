import { index, int, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { users } from "./schema";

// Only hashes of high-entropy browser/state/session credentials are persisted.
export const authOAuthAttempts = mysqlTable("auth_oauth_attempts", {
  stateHash: varchar("stateHash", { length: 64 }).primaryKey(),
  browserHash: varchar("browserHash", { length: 64 }).notNull(),
  appId: varchar("appId", { length: 64 }).notNull(),
  redirectUri: varchar("redirectUri", { length: 512 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  consumedAt: timestamp("consumedAt"),
}, table => ({ expiry: index("auth_oauth_attempt_expiry").on(table.expiresAt) }));

export const authSessions = mysqlTable("auth_sessions", {
  idHash: varchar("idHash", { length: 64 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  appId: varchar("appId", { length: 64 }).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  revokedAt: timestamp("revokedAt"),
}, table => ({ expiry: index("auth_session_expiry").on(table.expiresAt), user: index("auth_session_user").on(table.userId) }));

export const authRateLimits = mysqlTable("auth_rate_limits", {
  keyHash: varchar("keyHash", { length: 64 }).primaryKey(),
  windowStartedAt: timestamp("windowStartedAt").notNull(),
  count: int("count").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
}, table => ({ expiry: index("auth_rate_limit_expiry").on(table.expiresAt) }));
