import { sql } from "drizzle-orm";
import { boolean, check, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";
import { pdfTemplates, users } from "./schema";

export const organizations = mysqlTable("organizations", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["active", "archived"]).default("active").notNull(),
  settings: json("settings").$type<Record<string, unknown>>(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const memberships = mysqlTable("memberships", {
  id: int("id").autoincrement().primaryKey(),
  organizationId: int("organizationId").notNull().references(() => organizations.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  role: mysqlEnum("role", ["owner", "admin", "reviewer", "member"]).default("member").notNull(),
  status: mysqlEnum("status", ["invited", "active", "suspended", "left"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ membershipUnique: uniqueIndex("membership_org_user_unique").on(table.organizationId, table.userId) }));

export const workItems = mysqlTable("work_items", {
  id: int("id").autoincrement().primaryKey(),
  creatorUserId: int("creatorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  ownerType: mysqlEnum("ownerType", ["personal", "organization"]).default("personal").notNull(),
  ownerUserId: int("ownerUserId").references(() => users.id, { onDelete: "restrict" }),
  ownerOrganizationId: int("ownerOrganizationId").references(() => organizations.id, { onDelete: "restrict" }),
  type: mysqlEnum("type", ["report", "portfolio"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "in_review", "approved", "archived"]).default("draft").notNull(),
  currentVersionNumber: int("currentVersionNumber").default(0).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerCheck: check("work_items_owner_check", sql`(
    (${table.ownerType} = 'personal' AND ${table.ownerUserId} IS NOT NULL AND ${table.ownerOrganizationId} IS NULL)
    OR
    (${table.ownerType} = 'organization' AND ${table.ownerOrganizationId} IS NOT NULL AND ${table.ownerUserId} IS NULL)
  )`),
}));

export const contentBlocks = mysqlTable("content_blocks", {
  id: int("id").autoincrement().primaryKey(),
  workItemId: int("workItemId").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  blockType: varchar("blockType", { length: 64 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  data: json("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  creatorUserId: int("creatorUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  ownerType: mysqlEnum("ownerType", ["personal", "organization"]).default("personal").notNull(),
  ownerUserId: int("ownerUserId").references(() => users.id, { onDelete: "restrict" }),
  ownerOrganizationId: int("ownerOrganizationId").references(() => organizations.id, { onDelete: "restrict" }),
  kind: mysqlEnum("kind", ["file", "link", "text"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  storageKey: varchar("storageKey", { length: 512 }),
  externalUrl: text("externalUrl"),
  mimeType: varchar("mimeType", { length: 128 }),
  fileSize: int("fileSize"),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  ownerCheck: check("assets_owner_check", sql`(
    (${table.ownerType} = 'personal' AND ${table.ownerUserId} IS NOT NULL AND ${table.ownerOrganizationId} IS NULL)
    OR
    (${table.ownerType} = 'organization' AND ${table.ownerOrganizationId} IS NOT NULL AND ${table.ownerUserId} IS NULL)
  )`),
}));

export const workAssetLinks = mysqlTable("work_asset_links", {
  id: int("id").autoincrement().primaryKey(),
  workItemId: int("workItemId").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  assetId: int("assetId").notNull().references(() => assets.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 64 }).default("evidence").notNull(),
  caption: text("caption"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workAssetUnique: uniqueIndex("work_asset_unique").on(table.workItemId, table.assetId, table.role) }));

export const standardVersions = mysqlTable("standard_versions", {
  id: int("id").autoincrement().primaryKey(),
  standardKey: varchar("standardKey", { length: 128 }).notNull(),
  version: varchar("version", { length: 64 }).notNull(),
  title: varchar("title", { length: 512 }).notNull(),
  data: json("data").$type<Record<string, unknown>>(),
  effectiveFrom: timestamp("effectiveFrom"),
  effectiveTo: timestamp("effectiveTo"),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ standardVersionUnique: uniqueIndex("standard_version_unique").on(table.standardKey, table.version) }));

export const assetStandardLinks = mysqlTable("asset_standard_links", {
  id: int("id").autoincrement().primaryKey(),
  assetId: int("assetId").notNull().references(() => assets.id, { onDelete: "cascade" }),
  standardVersionId: int("standardVersionId").notNull().references(() => standardVersions.id, { onDelete: "restrict" }),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ assetStandardUnique: uniqueIndex("asset_standard_unique").on(table.assetId, table.standardVersionId) }));

export const workVersions = mysqlTable("work_versions", {
  id: int("id").autoincrement().primaryKey(),
  workItemId: int("workItemId").notNull().references(() => workItems.id, { onDelete: "cascade" }),
  versionNumber: int("versionNumber").notNull(),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  reason: varchar("reason", { length: 255 }),
  snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workVersionUnique: uniqueIndex("work_version_unique").on(table.workItemId, table.versionNumber) }));

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  workVersionId: int("workVersionId").notNull().references(() => workVersions.id, { onDelete: "cascade" }),
  requestedByUserId: int("requestedByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  reviewerUserId: int("reviewerUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  status: mysqlEnum("status", ["pending", "changes_requested", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  decisionNote: text("decisionNote"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({
  versionReviewerUnique: uniqueIndex("review_version_reviewer_unique").on(table.workVersionId, table.reviewerUserId),
}));

export const reviewComments = mysqlTable("review_comments", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull().references(() => reviews.id, { onDelete: "cascade" }),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
  anchor: json("anchor").$type<Record<string, unknown>>(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const outputs = mysqlTable("outputs", {
  id: int("id").autoincrement().primaryKey(),
  workVersionId: int("workVersionId").notNull().references(() => workVersions.id, { onDelete: "restrict" }),
  createdByUserId: int("createdByUserId").notNull().references(() => users.id, { onDelete: "restrict" }),
  type: mysqlEnum("type", ["pdf", "link", "qr"]).notNull(),
  visibility: mysqlEnum("visibility", ["private", "protected", "public"]).default("private").notNull(),
  token: varchar("token", { length: 128 }).unique(),
  passwordHash: varchar("passwordHash", { length: 256 }),
  storageKey: varchar("storageKey", { length: 512 }),
  expiresAt: timestamp("expiresAt"),
  revokedAt: timestamp("revokedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export const products = mysqlTable("products", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  productType: mysqlEnum("productType", ["template", "package"]).notNull(),
  templateId: int("templateId").references(() => pdfTemplates.id, { onDelete: "set null" }),
  priceMinor: int("priceMinor").default(0).notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  compatibility: json("compatibility").$type<Record<string, unknown>>(),
  licenseKey: varchar("licenseKey", { length: 128 }),
  isActive: boolean("isActive").default(true).notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const purchases = mysqlTable("purchases", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "restrict" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  idempotencyKey: varchar("idempotencyKey", { length: 128 }).notNull().unique(),
  state: mysqlEnum("state", ["pending", "paid", "failed", "refunded"]).default("pending").notNull(),
  amountMinor: int("amountMinor").notNull(),
  currency: varchar("currency", { length: 3 }).default("SAR").notNull(),
  provider: varchar("provider", { length: 64 }),
  providerPaymentRef: varchar("providerPaymentRef", { length: 255 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const entitlements = mysqlTable("entitlements", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").references(() => users.id, { onDelete: "cascade" }),
  organizationId: int("organizationId").references(() => organizations.id, { onDelete: "cascade" }),
  productId: int("productId").notNull().references(() => products.id, { onDelete: "restrict" }),
  purchaseId: int("purchaseId").references(() => purchases.id, { onDelete: "set null" }),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({
  userProductUnique: uniqueIndex("entitlement_user_product_unique").on(table.userId, table.productId),
  organizationProductUnique: uniqueIndex("entitlement_org_product_unique").on(table.organizationId, table.productId),
  ownerCheck: check("entitlements_owner_check", sql`(
    (${table.userId} IS NOT NULL AND ${table.organizationId} IS NULL)
    OR
    (${table.userId} IS NULL AND ${table.organizationId} IS NOT NULL)
  )`),
}));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull().references(() => users.id, { onDelete: "cascade" }),
  type: varchar("type", { length: 64 }).notNull(),
  dedupeKey: varchar("dedupeKey", { length: 255 }).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  body: text("body"),
  targetType: varchar("targetType", { length: 64 }),
  targetId: varchar("targetId", { length: 128 }),
  readAt: timestamp("readAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ userDedupeUnique: uniqueIndex("notification_user_dedupe_unique").on(table.userId, table.dedupeKey) }));

export type Organization = typeof organizations.$inferSelect;
export type Membership = typeof memberships.$inferSelect;
export type WorkItem = typeof workItems.$inferSelect;
export type ContentBlock = typeof contentBlocks.$inferSelect;
export type Asset = typeof assets.$inferSelect;
export type WorkVersion = typeof workVersions.$inferSelect;
export type Review = typeof reviews.$inferSelect;
export type Output = typeof outputs.$inferSelect;
export type Product = typeof products.$inferSelect;
export type Purchase = typeof purchases.$inferSelect;
export type Entitlement = typeof entitlements.$inferSelect;
export type Notification = typeof notifications.$inferSelect;
