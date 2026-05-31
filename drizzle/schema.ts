import { int, mysqlEnum, mysqlTable, text, timestamp, varchar, json, boolean } from "drizzle-orm/mysql-core";

export const users = mysqlTable("users", {
  id: int("id").autoincrement().primaryKey(),
  openId: varchar("openId", { length: 64 }).notNull().unique(),
  name: text("name"),
  email: varchar("email", { length: 320 }),
  passwordHash: varchar("passwordHash", { length: 256 }),
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

// ─── Template Engine Types (re-exported from shared) ─────
export type {
  TemplateFieldType, TemplateField, TemplateSection,
  LayoutType, FieldStyle, TitleStyle, SignatureStyle, FooterStyle,
  TemplateLayout, CanvasElement, CanvasElementType, CanvasElementProps,
  TemplateSchema, TemplateCanvasConfig,
} from "../shared/template-types";
import type { TemplateLayout, TemplateSchema } from "../shared/template-types";

// Legacy alias
export interface ThemeColors {
  headerBg: string;
  headerText: string;
  accent: string;
  borderColor: string;
  bodyBg: string;
  fontFamily?: string;
}

// FormEngine config type (for pdfTemplates.formSchema column)
export interface FormSchemaConfig {
  id?: string;
  title?: string;
  description?: string;
  version?: number;
  sections?: Array<{
    id: string;
    title: string;
    icon?: string;
    columns?: number;
    fields: Array<{
      id: string;
      label: string;
      type: string;
      placeholder?: string;
      required?: boolean;
      options?: string[];
      defaultValue?: string;
    }>;
  }>;
}

// ─── PDF Templates (Themes) ────────────────────────────────
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
  // Template Engine: JSON structure defining the layout and dynamic fields
  templateLayout: json("templateLayout").$type<TemplateLayout>(),
  // FormEngine: JSON schema defining the dynamic form fields and sections
  formSchema: json("formSchema").$type<FormSchemaConfig>(),
  // TemplateCanvas: JSON data for X/Y field positions on the background
  canvasData: json("canvasData").$type<TemplateSchema>(),
  isDefault: boolean("isDefault").default(false),
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  shareToken: varchar("shareToken", { length: 128 }).unique(),
  isShared: boolean("isShared").default(false),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type PdfTemplate = typeof pdfTemplates.$inferSelect;
export type InsertPdfTemplate = typeof pdfTemplates.$inferInsert;

// ─── User Custom Themes (حفظ الثيمات المخصصة للمستخدم) ────────────────────
export const userThemes = mysqlTable("user_themes", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId").notNull(),
  name: varchar("name", { length: 255 }).notNull(),
  description: text("description"),
  themeData: json("themeData").$type<Record<string, any>>().notNull(),
  isDefault: boolean("isDefault").default(false),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().onUpdateNow().notNull(),
});

export type UserTheme = typeof userThemes.$inferSelect;
export type InsertUserTheme = typeof userThemes.$inferInsert;

// ─── Activity Logs (سجل العمليات) ────────────────────────────
export const activityLogs = mysqlTable("activity_logs", {
  id: int("id").autoincrement().primaryKey(),
  userId: int("userId"),
  userName: varchar("userName", { length: 255 }),
  action: varchar("action", { length: 64 }).notNull(), // create, update, delete, login, review, export, etc.
  entity: varchar("entity", { length: 64 }).notNull(), // user, portfolio, template, theme, file, section, etc.
  entityId: int("entityId"),
  entityName: varchar("entityName", { length: 255 }),
  metadata: json("metadata").$type<Record<string, any>>(),
  ipAddress: varchar("ipAddress", { length: 64 }),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
});

export type ActivityLog = typeof activityLogs.$inferSelect;
export type InsertActivityLog = typeof activityLogs.$inferInsert;

// ─── Section Configs (تكوينات الأقسام) ───────────────────────
export const sectionConfigs = mysqlTable("section_configs", {
  id: int("id").autoincrement().primaryKey(),
  sectionId: varchar("sectionId", { length: 64 }).notNull(), // certificates, reports, covers, shared, exams, radio, etc.
  configType: varchar("configType", { length: 32 }).notNull(), // theme, template, type
  name: varchar("name", { length: 255 }).notNull(),
  description: varchar("description", { length: 500 }),
  data: json("data").$type<Record<string, any>>().notNull(), // colors, fields, gradient, fonts, etc.
  isActive: boolean("isActive").default(true),
  sortOrder: int("sortOrder").default(0),
  createdBy: int("createdBy"),
  createdAt: timestamp("createdAt").defaultNow().notNull(),
  updatedAt: timestamp("updatedAt").defaultNow().notNull(),
});

export type SectionConfig = typeof sectionConfigs.$inferSelect;
export type InsertSectionConfig = typeof sectionConfigs.$inferInsert;
