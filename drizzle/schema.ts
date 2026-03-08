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

// ─── PDF Templates (Visual Themes) ────────────────────────────
export const pdfTemplates = mysqlTable("pdf_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  headerBg: varchar("headerBg", { length: 128 }).notNull().default("linear-gradient(135deg, #059669, #047857)"),
  headerText: varchar("headerText", { length: 32 }).notNull().default("#ffffff"),
  accent: varchar("accent", { length: 32 }).notNull().default("#059669"),
  borderColor: varchar("borderColor", { length: 32 }).notNull().default("#e5e7eb"),
  bodyBg: varchar("bodyBg", { length: 32 }).notNull().default("#ffffff"),
  fontFamily: varchar("fontFamily", { length: 128 }).default("'Cairo', 'Tajawal', sans-serif"),
  coverImageUrl: text("coverImageUrl"),
  logoUrl: text("logoUrl"),
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PdfTemplate = typeof pdfTemplates.$inferSelect;
export type InsertPdfTemplate = typeof pdfTemplates.$inferInsert;

// ─── Report Templates (Dynamic Form + Layout Definition) ────────────
// Each report template defines: fields (form inputs), layout (how they appear in preview/PDF),
// and metadata. Admin can CRUD these. Users pick a template, fill the form, preview & export.
export const reportTemplates = mysqlTable("report_templates", {
  id: int("id").autoincrement().primaryKey(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  category: varchar("category", { length: 128 }).default("general"),
  // JSON array of field definitions: [{id, label, type, placeholder, required, gridCol, gridRow, section, options}]
  fields: json("fields").$type<ReportField[]>().notNull(),
  // JSON layout config: {columns, headerStyle, sections, backgroundUrl, ...}
  layout: json("layout").$type<ReportLayout>().notNull(),
  // Which visual theme (pdfTemplates) to use by default
  defaultThemeId: int("defaultThemeId"),
  thumbnailUrl: text("thumbnailUrl"),
  isActive: boolean("isActive").default(true),
  isDefault: boolean("isDefault").default(false),
  sortOrder: int("sortOrder").default(0),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type ReportTemplate = typeof reportTemplates.$inferSelect;
export type InsertReportTemplate = typeof reportTemplates.$inferInsert;

// ─── TypeScript types for report template JSON fields ────────────

export interface ReportField {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select" | "image" | "images" | "list" | "signature";
  placeholder?: string;
  required?: boolean;
  section?: string; // group fields under a section heading
  gridCol?: number; // 1-based column in grid layout (1, 2, or 3)
  gridRow?: number; // row ordering
  options?: string[]; // for select type
  defaultValue?: string;
  maxItems?: number; // for list/images type
  helpText?: string;
}

export interface ReportLayoutSection {
  id: string;
  title: string;
  type: "header" | "fields" | "content" | "images" | "signatures" | "footer";
  columns?: number; // 1, 2, or 3
  fieldIds?: string[]; // which fields go in this section
  style?: Record<string, string>;
}

export interface ReportLayout {
  pageSize?: "A4" | "letter";
  direction?: "rtl" | "ltr";
  columns?: number;
  backgroundUrl?: string;
  headerStyle?: "ministry" | "simple" | "custom";
  showSchoolName?: boolean;
  showMinistryLogo?: boolean;
  showSignatures?: boolean;
  showFooter?: boolean;
  sections: ReportLayoutSection[];
}

// ─── User Reports (filled data from a report template) ────────────
export const userReports = mysqlTable("user_reports", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  portfolioId: int("portfolioId"),
  reportTemplateId: int("reportTemplateId").notNull(),
  themeId: int("themeId"),
  title: varchar("title", { length: 512 }).notNull(),
  // JSON object: { fieldId: value, ... }
  data: json("data").$type<Record<string, any>>().notNull(),
  // Which criterion/sub-evidence this report belongs to
  criterionId: varchar("criterionId", { length: 128 }),
  subEvidenceId: varchar("subEvidenceId", { length: 128 }),
  evidenceId: varchar("evidenceId", { length: 128 }),
  status: mysqlEnum("status", ["draft", "completed"]).default("draft").notNull(),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserReport = typeof userReports.$inferSelect;
export type InsertUserReport = typeof userReports.$inferInsert;
