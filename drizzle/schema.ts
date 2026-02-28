import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  loginMethod: varchar("loginMethod", { length: 64 }),
  role: mysqlEnum("role", ["user", "admin"]).default("user").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
  lastSignedIn: timestamp("lastSignedIn").defaultNow().notNull(),
});

export type User = typeof users.$inferSelect;
export type InsertUser = typeof users.$inferInsert;

export const portfolios = mysqlTable("portfolios", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  jobId: varchar("jobId", { length: 64 }).notNull(),
  jobTitle: varchar("jobTitle", { length: 255 }).notNull(),
  personalInfo: json("personalInfo").$type<Record<string, string>>().notNull(),
  criteriaData: json("criteriaData").$type<Record<string, any>>().notNull(),
  customCriteria: json("customCriteria").$type<any[]>(),
  themeId: varchar("themeId", { length: 64 }).default("classic"),
  completionPercentage: int("completionPercentage").default(0),
  status: mysqlEnum("status", ["draft", "submitted", "reviewed", "approved", "rejected"]).default("draft").notNull(),
  reviewNotes: text("reviewNotes"),
  reviewedBy: int("reviewedBy"),
  reviewedAt: timestamp("reviewedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type Portfolio = typeof portfolios.$inferSelect;
export type InsertPortfolio = typeof portfolios.$inferInsert;

export const uploadedFiles = mysqlTable("uploaded_files", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  portfolioId: int("portfolioId"),
  fileKey: varchar("fileKey", { length: 512 }).notNull(),
  url: text("url").notNull(),
  originalName: varchar("originalName", { length: 512 }),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  criterionId: varchar("criterionId", { length: 128 }),
  subEvidenceId: varchar("subEvidenceId", { length: 128 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type UploadedFile = typeof uploadedFiles.$inferSelect;
export type InsertUploadedFile = typeof uploadedFiles.$inferInsert;

export const shareLinks = mysqlTable("share_links", {
  id: int("id").autoincrement().primaryKey(),
  portfolioId: int("portfolioId").notNull(),
  userId: int("userId").notNull(),
  token: varchar("token", { length: 128 }).notNull().unique(),
  expiresAt: timestamp("expiresAt").notNull(),
  hasPassword: boolean("hasPassword").default(false),
  passwordHash: varchar("passwordHash", { length: 256 }),
  viewCount: int("viewCount").default(0),
  maxViews: int("maxViews").default(0),
  isActive: boolean("isActive").default(true),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ShareLink = typeof shareLinks.$inferSelect;
export type InsertShareLink = typeof shareLinks.$inferInsert;
