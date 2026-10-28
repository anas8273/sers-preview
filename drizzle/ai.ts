import { boolean, index, int, mysqlEnum, mysqlTable, timestamp, varchar } from "drizzle-orm/mysql-core";
import { users } from "./schema";

export const aiRequestBudgets = mysqlTable("ai_request_budgets", {
  key: varchar("key", { length: 96 }).primaryKey(),
  windowStart: timestamp("windowStart").notNull(),
  requestCount: int("requestCount").notNull().default(0),
  expiresAt: timestamp("expiresAt").notNull(),
}, table => ({ expiry: index("ai_budget_expiry").on(table.expiresAt) }));

// No prompt, source document, response body, names, email or access tokens.
export const aiRequests = mysqlTable("ai_requests", {
  id: varchar("id", { length: 36 }).primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  operation: varchar("operation", { length: 64 }).notNull(),
  status: mysqlEnum("status", ["active", "succeeded", "failed", "abandoned"]).notNull(),
  provider: varchar("provider", { length: 32 }).notNull(),
  configuredModel: varchar("configuredModel", { length: 128 }).notNull(),
  returnedModel: varchar("returnedModel", { length: 128 }),
  promptVersion: varchar("promptVersion", { length: 64 }).notNull(),
  startedAt: timestamp("startedAt").notNull().defaultNow(),
  expiresAt: timestamp("expiresAt").notNull(),
  completedAt: timestamp("completedAt"),
  providerInvoked: boolean("providerInvoked").notNull().default(false),
  promptTokens: int("promptTokens"),
  completionTokens: int("completionTokens"),
  errorCode: varchar("errorCode", { length: 32 }),
}, table => ({ active: index("ai_request_active").on(table.provider, table.status, table.expiresAt), user: index("ai_request_user").on(table.userId, table.status, table.expiresAt) }));

export const aiProviderState = mysqlTable("ai_provider_state", {
  provider: varchar("provider", { length: 32 }).primaryKey(),
  failureCount: int("failureCount").notNull().default(0),
  openUntil: timestamp("openUntil"),
  probeRequestId: varchar("probeRequestId", { length: 36 }),
  probeExpiresAt: timestamp("probeExpiresAt"),
});
