import { boolean, int, json, mysqlEnum, mysqlTable, text, timestamp, uniqueIndex, varchar } from "drizzle-orm/mysql-core";

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
  organizationId: int("organizationId").notNull(),
  userId: int("userId").notNull(),
  role: mysqlEnum("role", ["owner", "admin", "reviewer", "member"]).default("member").notNull(),
  status: mysqlEnum("status", ["invited", "active", "suspended", "left"]).default("active").notNull(),
  joinedAt: timestamp("joinedAt").defaultNow().notNull(),
  leftAt: timestamp("leftAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
}, (table) => ({ membershipUnique: uniqueIndex("membership_org_user_unique").on(table.organizationId, table.userId) }));

export const workItems = mysqlTable("work_items", {
  id: int("id").autoincrement().primaryKey(),
  creatorUserId: int("creatorUserId").notNull(),
  ownerType: mysqlEnum("ownerType", ["personal", "organization"]).default("personal").notNull(),
  ownerUserId: int("ownerUserId"),
  ownerOrganizationId: int("ownerOrganizationId"),
  type: mysqlEnum("type", ["report", "portfolio"]).notNull(),
  title: varchar("title", { length: 255 }).notNull(),
  status: mysqlEnum("status", ["draft", "in_review", "approved", "archived"]).default("draft").notNull(),
  currentVersionNumber: int("currentVersionNumber").default(0).notNull(),
  metadata: json("metadata").$type<Record<string, unknown>>(),
  deletedAt: timestamp("deletedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const contentBlocks = mysqlTable("content_blocks", {
  id: int("id").autoincrement().primaryKey(),
  workItemId: int("workItemId").notNull(),
  blockType: varchar("blockType", { length: 64 }).notNull(),
  sortOrder: int("sortOrder").default(0).notNull(),
  data: json("data").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const assets = mysqlTable("assets", {
  id: int("id").autoincrement().primaryKey(),
  creatorUserId: int("creatorUserId").notNull(),
  ownerType: mysqlEnum("ownerType", ["personal", "organization"]).default("personal").notNull(),
  ownerUserId: int("ownerUserId"),
  ownerOrganizationId: int("ownerOrganizationId"),
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
});

export const workAssetLinks = mysqlTable("work_asset_links", {
  id: int("id").autoincrement().primaryKey(),
  workItemId: int("workItemId").notNull(),
  assetId: int("assetId").notNull(),
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
  assetId: int("assetId").notNull(),
  standardVersionId: int("standardVersionId").notNull(),
  note: text("note"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ assetStandardUnique: uniqueIndex("asset_standard_unique").on(table.assetId, table.standardVersionId) }));

export const workVersions = mysqlTable("work_versions", {
  id: int("id").autoincrement().primaryKey(),
  workItemId: int("workItemId").notNull(),
  versionNumber: int("versionNumber").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
  reason: varchar("reason", { length: 255 }),
  snapshot: json("snapshot").$type<Record<string, unknown>>().notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
}, (table) => ({ workVersionUnique: uniqueIndex("work_version_unique").on(table.workItemId, table.versionNumber) }));

export const reviews = mysqlTable("reviews", {
  id: int("id").autoincrement().primaryKey(),
  workVersionId: int("workVersionId").notNull(),
  requestedByUserId: int("requestedByUserId").notNull(),
  reviewerUserId: int("reviewerUserId").notNull(),
  status: mysqlEnum("status", ["pending", "changes_requested", "approved", "rejected", "cancelled"]).default("pending").notNull(),
  decisionNote: text("decisionNote"),
  decidedAt: timestamp("decidedAt"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const reviewComments = mysqlTable("review_comments", {
  id: int("id").autoincrement().primaryKey(),
  reviewId: int("reviewId").notNull(),
  userId: int("userId").notNull(),
  anchor: json("anchor").$type<Record<string, unknown>>(),
  content: text("content").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export const outputs = mysqlTable("outputs", {
  id: int("id").autoincrement().primaryKey(),
  workVersionId: int("workVersionId").notNull(),
  createdByUserId: int("createdByUserId").notNull(),
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
  templateId: int("templateId"),
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
  userId: int("userId").notNull(),
  productId: int("productId").notNull(),
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
  userId: int("userId"),
  organizationId: int("organizationId"),
  productId: int("productId").notNull(),
  purchaseId: int("purchaseId"),
  status: mysqlEnum("status", ["active", "revoked", "expired"]).default("active").notNull(),
  grantedAt: timestamp("grantedAt").defaultNow().notNull(),
  expiresAt: timestamp("expiresAt"),
}, (table) => ({ userProductUnique: uniqueIndex("entitlement_user_product_unique").on(table.userId, table.productId) }));

export const notifications = mysqlTable("notifications", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
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
