import { eq, and, desc, sql, gt, lt, count, gte, lte } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, portfolios, uploadedFiles, shareLinks, pdfTemplates, userThemes, activityLogs, sectionConfigs, type InsertPortfolio, type InsertUploadedFile, type InsertShareLink, type InsertPdfTemplate, type InsertUserTheme, type InsertActivityLog, type InsertSectionConfig } from "../drizzle/schema";
import { ENV } from './_core/env';
// Password hashing — single source of truth
import { hashPassword as hashPw } from './utils/crypto';

let _db: ReturnType<typeof drizzle> | null = null;
let _migrated = false;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
  }
  // Auto-migrate + seed
  if (_db && !_migrated) {
    _migrated = true;
    // Helper: detect "Duplicate column" MySQL error inside DrizzleQueryError
    const isDupCol = (e: any) => {
      const full = `${e?.message || ''} ${e?.cause?.sqlMessage || ''} ${e?.cause?.message || ''}`;
      return full.includes('Duplicate column') || full.includes('Duplicate entry');
    };
    // Helper: run ALTER TABLE safely
    const safeAlter = async (label: string, query: any) => {
      try { await _db!.execute(query); console.log(`[Migration] ✅ ${label}`); }
      catch (e: any) { if (!isDupCol(e)) console.warn(`[Migration] ${label}:`, e?.cause?.sqlMessage || e?.message || ''); }
    };
    // Users table
    await safeAlter('users.passwordHash', sql`ALTER TABLE users ADD COLUMN passwordHash VARCHAR(256) DEFAULT NULL`);
    await safeAlter('users.role', sql`ALTER TABLE users ADD COLUMN role ENUM('user','admin') NOT NULL DEFAULT 'user'`);
    // pdf_templates table
    await safeAlter('pdf_templates.formSchema', sql`ALTER TABLE pdf_templates ADD COLUMN formSchema JSON DEFAULT NULL`);
    await safeAlter('pdf_templates.canvasData', sql`ALTER TABLE pdf_templates ADD COLUMN canvasData JSON DEFAULT NULL`);
    await safeAlter('pdf_templates.shareToken', sql`ALTER TABLE pdf_templates ADD COLUMN shareToken VARCHAR(128) DEFAULT NULL UNIQUE`);
    await safeAlter('pdf_templates.isShared', sql`ALTER TABLE pdf_templates ADD COLUMN isShared TINYINT(1) DEFAULT 0`);
    await safeAlter('pdf_templates.createdBy', sql`ALTER TABLE pdf_templates ADD COLUMN createdBy INT DEFAULT NULL`);
    // activity_logs table
    await safeAlter('activity_logs table', sql`CREATE TABLE IF NOT EXISTS activity_logs (id INT AUTO_INCREMENT PRIMARY KEY, userId INT, userName VARCHAR(255), action VARCHAR(64) NOT NULL, entity VARCHAR(64) NOT NULL, entityId INT, entityName VARCHAR(255), metadata JSON, ipAddress VARCHAR(64), createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL)`);
    // section_configs table
    await safeAlter('section_configs table', sql`CREATE TABLE IF NOT EXISTS section_configs (id INT AUTO_INCREMENT PRIMARY KEY, sectionId VARCHAR(64) NOT NULL, configType VARCHAR(32) NOT NULL, name VARCHAR(255) NOT NULL, description VARCHAR(500), data JSON NOT NULL, isActive TINYINT(1) DEFAULT 1, sortOrder INT DEFAULT 0, createdBy INT, createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP NOT NULL, updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP NOT NULL)`);
    // Seed admin + test user
    try {
      const adminExists = await _db.select().from(users).where(eq(users.email, "admin@sers.com")).limit(1);
      if (adminExists.length === 0) {
        const h = await hashPw("Admin@123");
        await _db.insert(users).values({ openId: "local-admin-seed", name: "مدير النظام", email: "admin@sers.com", passwordHash: h, loginMethod: "local", role: "admin", lastSignedIn: new Date() });
        console.log("[Seed] ✅ Admin: admin@sers.com / Admin@123");
      } else if (adminExists[0].role !== "admin") {
        // Force-update role to admin if user exists but role is not admin
        await _db.update(users).set({ role: "admin" }).where(eq(users.email, "admin@sers.com"));
        console.log("[Seed] ✅ Updated admin@sers.com role to admin");
      }
      const userExists = await _db.select().from(users).where(eq(users.email, "user@sers.com")).limit(1);
      if (userExists.length === 0) {
        const h = await hashPw("User@123");
        await _db.insert(users).values({ openId: "local-user-seed", name: "مستخدم تجريبي", email: "user@sers.com", passwordHash: h, loginMethod: "local", role: "user", lastSignedIn: new Date() });
        console.log("[Seed] ✅ User: user@sers.com / User@123");
      }
    } catch (e: any) { console.warn("[Seed]", e?.cause?.sqlMessage || String(e?.message || e).slice(0, 100)); }
  }
  return _db;
}

// ─── Users ───────────────────────────────────────────────
export async function upsertUser(user: InsertUser): Promise<void> {
  if (!user.openId) throw new Error("User openId is required for upsert");
  const db = await getDb();
  if (!db) { console.warn("[Database] Cannot upsert user: database not available"); return; }

  try {
    const values: InsertUser = { openId: user.openId };
    const updateSet: Record<string, unknown> = {};
    const textFields = ["name", "email", "loginMethod"] as const;
    type TextField = (typeof textFields)[number];
    const assignNullable = (field: TextField) => {
      const value = user[field];
      if (value === undefined) return;
      const normalized = value ?? null;
      values[field] = normalized;
      updateSet[field] = normalized;
    };
    textFields.forEach(assignNullable);
    if (user.lastSignedIn !== undefined) { values.lastSignedIn = user.lastSignedIn; updateSet.lastSignedIn = user.lastSignedIn; }
    if (user.role !== undefined) { values.role = user.role; updateSet.role = user.role; }
    else if (user.openId === ENV.ownerOpenId) { values.role = 'admin'; updateSet.role = 'admin'; }
    if (!values.lastSignedIn) values.lastSignedIn = new Date();
    if (Object.keys(updateSet).length === 0) updateSet.lastSignedIn = new Date();
    await db.insert(users).values(values).onDuplicateKeyUpdate({ set: updateSet });
  } catch (error) { console.error("[Database] Failed to upsert user:", error); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function getUserByEmail(email: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.email, email)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function registerLocalUser(data: { name: string; email: string; passwordHash: string }) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Generate unique openId for local users
  const openId = `local-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  await db.insert(users).values({
    openId,
    name: data.name,
    email: data.email,
    passwordHash: data.passwordHash,
    loginMethod: "local",
    role: "user",
    lastSignedIn: new Date(),
  });
  const user = await getUserByEmail(data.email);
  return user;
}

// ─── Admin: User Management ─────────────────────────────
export async function getAllUsers() {
  const db = await getDb();
  if (!db) return [];
  return db.select({ id: users.id, name: users.name, email: users.email, role: users.role, loginMethod: users.loginMethod, createdAt: users.createdAt, lastSignedIn: users.lastSignedIn }).from(users).orderBy(desc(users.createdAt));
}

export async function updateUserRole(userId: number, role: "user" | "admin") {
  const db = await getDb();
  if (!db) return;
  await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function deleteUser(userId: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(users).where(eq(users.id, userId));
}

export async function getUserStats(userId: number) {
  const db = await getDb();
  if (!db) return { portfolios: 0, files: 0, templates: 0 };
  const [pC] = await db.select({ count: count() }).from(portfolios).where(eq(portfolios.userId, userId));
  const [fC] = await db.select({ count: count() }).from(uploadedFiles).where(eq(uploadedFiles.userId, userId));
  const [tC] = await db.select({ count: count() }).from(userThemes).where(eq(userThemes.userId, userId));
  return { portfolios: pC?.count || 0, files: fC?.count || 0, templates: tC?.count || 0 };
}

export async function getTotalStats() {
  const db = await getDb();
  if (!db) return { users: 0, portfolios: 0, templates: 0, files: 0 };
  const [uC] = await db.select({ count: count() }).from(users);
  const [pC] = await db.select({ count: count() }).from(portfolios);
  const [tC] = await db.select({ count: count() }).from(pdfTemplates);
  const [fC] = await db.select({ count: count() }).from(uploadedFiles);
  return { users: uC?.count || 0, portfolios: pC?.count || 0, templates: tC?.count || 0, files: fC?.count || 0 };
}

// ─── Portfolios ──────────────────────────────────────────
export async function createPortfolio(data: InsertPortfolio) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(portfolios).values(data);
  const id = Number(result[0].insertId);
  return { id };
}

export async function updatePortfolio(id: number, userId: number, data: Partial<InsertPortfolio>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(portfolios).set(data).where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
  return { success: true };
}

export async function getPortfoliosByUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(portfolios).where(eq(portfolios.userId, userId)).orderBy(desc(portfolios.updatedAt));
}

export async function getPortfolioById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(portfolios).where(eq(portfolios.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deletePortfolio(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(uploadedFiles).where(eq(uploadedFiles.portfolioId, id));
  await db.delete(shareLinks).where(eq(shareLinks.portfolioId, id));
  await db.delete(portfolios).where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
  return { success: true };
}

// ─── Admin: All Portfolios ──────────────────────────────
export async function getAllPortfolios(page = 1, limit = 20, status?: string) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const offset = (page - 1) * limit;

  const conditions = status ? and(eq(portfolios.status, status as any)) : undefined;

  const items = await db
    .select({
      id: portfolios.id,
      userId: portfolios.userId,
      jobId: portfolios.jobId,
      jobTitle: portfolios.jobTitle,
      completionPercentage: portfolios.completionPercentage,
      status: portfolios.status,
      reviewNotes: portfolios.reviewNotes,
      createdAt: portfolios.createdAt,
      updatedAt: portfolios.updatedAt,
      userName: users.name,
      userEmail: users.email,
    })
    .from(portfolios)
    .leftJoin(users, eq(portfolios.userId, users.id))
    .where(conditions)
    .orderBy(desc(portfolios.updatedAt))
    .limit(limit)
    .offset(offset);

  const countResult = await db
    .select({ count: sql<number>`count(*)` })
    .from(portfolios)
    .where(conditions);

  return { items, total: countResult[0]?.count ?? 0 };
}

export async function reviewPortfolio(id: number, reviewerId: number, status: string, notes: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(portfolios).set({
    status: status as any,
    reviewNotes: notes,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
  }).where(eq(portfolios.id, id));
  return { success: true };
}

// ─── Uploaded Files ──────────────────────────────────────
export async function createUploadedFile(data: InsertUploadedFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(uploadedFiles).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getFilesByPortfolio(portfolioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(uploadedFiles).where(eq(uploadedFiles.portfolioId, portfolioId)).orderBy(desc(uploadedFiles.createdAt));
}

export async function deleteUploadedFile(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.userId, userId)));
  return { success: true };
}

// ─── Share Links ─────────────────────────────────────────
export async function createShareLink(data: InsertShareLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(shareLinks).values(data);
  return { id: Number(result[0].insertId) };
}

export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareLinks)
    .where(and(eq(shareLinks.token, token), eq(shareLinks.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementShareLinkViews(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.update(shareLinks).set({ viewCount: sql`${shareLinks.viewCount} + 1` }).where(eq(shareLinks.id, id));
}

export async function getShareLinksByPortfolio(portfolioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareLinks).where(eq(shareLinks.portfolioId, portfolioId)).orderBy(desc(shareLinks.createdAt));
}

export async function deactivateShareLink(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(shareLinks).set({ isActive: false }).where(and(eq(shareLinks.id, id), eq(shareLinks.userId, userId)));
  return { success: true };
}

// ─── PDF Templates ─────────────────────────────────
export async function createPdfTemplate(data: InsertPdfTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(pdfTemplates).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updatePdfTemplate(id: number, data: Partial<InsertPdfTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(pdfTemplates).set(data).where(eq(pdfTemplates.id, id));
  return { success: true };
}

export async function deletePdfTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(pdfTemplates).where(eq(pdfTemplates.id, id));
  return { success: true };
}

export async function getActivePdfTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pdfTemplates).where(eq(pdfTemplates.isActive, true)).orderBy(pdfTemplates.sortOrder);
}

export async function getAllPdfTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(pdfTemplates).orderBy(pdfTemplates.sortOrder);
}

export async function getPdfTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(pdfTemplates).where(eq(pdfTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── User Custom Themes ──────────────────────────────────────
export async function createUserTheme(data: InsertUserTheme) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userThemes).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateUserTheme(id: number, userId: number, data: Partial<InsertUserTheme>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userThemes).set(data).where(and(eq(userThemes.id, id), eq(userThemes.userId, userId)));
  return { success: true };
}

export async function deleteUserTheme(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userThemes).where(and(eq(userThemes.id, id), eq(userThemes.userId, userId)));
  return { success: true };
}

export async function getUserThemes(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(userThemes).where(eq(userThemes.userId, userId)).orderBy(desc(userThemes.updatedAt));
}

export async function getUserThemeById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userThemes).where(eq(userThemes.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function seedDefaultTemplates(force = false) {
  const db = await getDb();
  if (!db) return;
  
  if (force) {
    // Force reseed: delete ONLY default templates (preserve custom/canvas ones)
    await db.delete(pdfTemplates).where(eq(pdfTemplates.isDefault, true));
    console.log('[Seed] 🗑️ Cleared default templates for force reseed (custom templates preserved)');
  } else {
    // Normal: only seed if no templates exist yet
    const existing = await db.select().from(pdfTemplates).limit(1);
    if (existing.length > 0) return;
  }
  
  // All 8 built-in themes migrated to database with full ThemeConfig
  const defaults: InsertPdfTemplate[] = [
    {
      name: 'الهوية البصرية تدرج',
      description: 'إطارات مستديرة مع الهوية البصرية الرسمية لوزارة التعليم',
      headerBg: '#ffffff', headerText: '#1a6b6a',
      accent: '#1a6b6a', borderColor: '#2ea87a', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'white-header-classic', fieldStyle: 'fieldset',
        titleStyle: 'rounded', signatureStyle: 'dotted', footerStyle: 'gradient',
        titleBg: '#1a6b6a', fieldLabelBg: '#1a6b6a', footerBg: '#1a6b6a',
        coverStyle: 'gradient-center', sectionCoverStyle: 'full-gradient', coverAccent2: '#5bb784',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: false, showBottomBar: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: true, sortOrder: 1,
    },
    {
      name: 'جدول رسمي',
      description: 'ترويسة داكنة مع جدول رسمي - مناسب للتقارير الموحدة',
      headerBg: '#1a6b6a', headerText: '#ffffff',
      accent: '#1a6b6a', borderColor: '#2ea87a', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'dark-header-table', fieldStyle: 'table',
        titleStyle: 'full-width', signatureStyle: 'boxed', footerStyle: 'gradient',
        titleBg: '#1a6b6a', fieldLabelBg: '#1a6b6a', footerBg: '#1a6b6a',
        tableStyle: true,
        coverStyle: 'top-bar', sectionCoverStyle: 'numbered-bar', coverAccent2: '#5bb784',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: false, showBottomBar: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 2,
    },
    {
      name: 'خطوط أنيقة',
      description: 'تصميم أنيق مع خطوط سفلية وألوان هادئة',
      headerBg: '#ffffff', headerText: '#1a6b6a',
      accent: '#1a6b6a', borderColor: '#2ea87a', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'white-header-classic', fieldStyle: 'underlined',
        titleStyle: 'underlined', signatureStyle: 'lined', footerStyle: 'line',
        titleBg: '#1a6b6a', fieldLabelBg: '#e8f5f0', footerBg: '#1a6b6a',
        coverStyle: 'split-left', sectionCoverStyle: 'left-stripe', coverAccent2: '#5bb784',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: true, showBottomBar: true, headerSeparator: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 3,
    },
    {
      name: 'بطاقات حديثة',
      description: 'تصميم عصري مع بطاقات ملونة وأيقونات',
      headerBg: '#ffffff', headerText: '#1a6b6a',
      accent: '#1a6b6a', borderColor: '#2ea87a', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'white-header-cards', fieldStyle: 'cards',
        titleStyle: 'rounded', signatureStyle: 'stamped', footerStyle: 'gradient',
        titleBg: '#1a6b6a', fieldLabelBg: '#1a6b6a', footerBg: '#1a6b6a',
        coverStyle: 'framed-elegant', sectionCoverStyle: 'card-center', coverAccent2: '#5bb784',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: false, showBottomBar: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 4,
    },
    {
      name: 'النموذج الرسمي',
      description: 'نموذج رسمي مع ترويسة داكنة وجدول - مناسب للمراسلات الرسمية',
      headerBg: '#0d4f4f', headerText: '#ffffff',
      accent: '#0d4f4f', borderColor: '#1a8a7a', bodyBg: '#f9fafb',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'dark-header-table', fieldStyle: 'table',
        titleStyle: 'full-width', signatureStyle: 'boxed', footerStyle: 'solid',
        titleBg: '#0d4f4f', fieldLabelBg: '#0d4f4f', footerBg: '#0d4f4f',
        tableStyle: true,
        coverStyle: 'diagonal', sectionCoverStyle: 'numbered-bar', coverAccent2: '#1a8a7a',
        headerVariant: 'full-header-sections',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: true, showBottomBar: true, headerSeparator: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 5,
    },
    {
      name: 'توفير حبر',
      description: 'تصميم بسيط بأقل حبر - مناسب للطباعة الاقتصادية',
      headerBg: '#ffffff', headerText: '#374151',
      accent: '#6B7280', borderColor: '#D1D5DB', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'white-header-classic', fieldStyle: 'underlined',
        titleStyle: 'underlined', signatureStyle: 'dotted', footerStyle: 'line',
        titleBg: '#F3F4F6', fieldLabelBg: '#F9FAFB', footerBg: '#F3F4F6',
        coverStyle: 'minimal-line', sectionCoverStyle: 'clean-divider', coverAccent2: '#9CA3AF',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: false, showBottomBar: false,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 6,
    },
    {
      name: 'الهوية الذهبية',
      description: 'تصميم فاخر مع ألوان ذهبية وترويسة داكنة',
      headerBg: '#1a3a4a', headerText: '#ffffff',
      accent: '#1a3a4a', borderColor: '#C8A951', bodyBg: '#FFFDF5',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'dark-header-table', fieldStyle: 'cards',
        titleStyle: 'full-width', signatureStyle: 'stamped', footerStyle: 'gradient',
        titleBg: '#1a3a4a', fieldLabelBg: '#1a3a4a', footerBg: '#1a3a4a',
        tableStyle: true,
        coverStyle: 'gradient-center', sectionCoverStyle: 'card-center', coverAccent2: '#C8A951',
        headerVariant: 'right-text-left-logo',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: true, showBottomBar: true, headerSeparator: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 7,
    },
    {
      name: 'تصميم نظيف',
      description: 'تصميم بسيط ونظيف - مناسب للاستخدام اليومي',
      headerBg: '#ffffff', headerText: '#1a6b6a',
      accent: '#1a6b6a', borderColor: '#2ea87a', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'performance',
        layoutType: 'minimal-clean', fieldStyle: 'minimal',
        titleStyle: 'simple', signatureStyle: 'lined', footerStyle: 'line',
        titleBg: '#1a6b6a', fieldLabelBg: '#f0fdf4', footerBg: '#1a6b6a',
        coverStyle: 'minimal-line', sectionCoverStyle: 'clean-divider', coverAccent2: '#5bb784',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: true,
        showTopLine: false, showBottomBar: false,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      } as any,
      isDefault: false, sortOrder: 8,
    },
    // ========== نموذج تقرير — قسم التقارير ==========
    {
      name: 'نموذج تقرير',
      description: 'نموذج تقرير رسمي مع ترويسة وزارة التعليم — مخصص للتقارير الإدارية والمدرسية',
      headerBg: '#1a3a5c', headerText: '#ffffff',
      accent: '#1a3a5c', borderColor: '#2563EB', bodyBg: '#ffffff',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'reports',
        layoutType: 'dark-header-table', fieldStyle: 'table',
        titleStyle: 'full-width', signatureStyle: 'boxed', footerStyle: 'gradient',
        titleBg: '#1a3a5c', fieldLabelBg: '#1a3a5c', footerBg: '#1a3a5c',
        tableStyle: true,
        coverStyle: 'top-bar', sectionCoverStyle: 'numbered-bar', coverAccent2: '#2563EB',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: false,
        showTopLine: true, showBottomBar: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'معد التقرير', left: 'مدير المدرسة / المشرف' },
      } as any,
      isDefault: false, sortOrder: 9,
    },
    // ========== نموذج التقييم النهائي — قسم الاختبارات ==========
    {
      name: 'نموذج التقييم النهائي',
      description: 'نموذج التقييم النهائي للأداء الوظيفي — يتضمن الدرجات والتوصيات',
      headerBg: '#7f1d1d', headerText: '#ffffff',
      accent: '#7f1d1d', borderColor: '#DC2626', bodyBg: '#FFFBEB',
      templateLayout: {
        version: 1, pageSize: 'A4' as const, direction: 'rtl' as const,
        sectionId: 'exams',
        layoutType: 'dark-header-table', fieldStyle: 'fieldset',
        titleStyle: 'full-width', signatureStyle: 'boxed', footerStyle: 'gradient',
        titleBg: '#7f1d1d', fieldLabelBg: '#7f1d1d', footerBg: '#7f1d1d',
        tableStyle: false,
        coverStyle: 'gradient-center', sectionCoverStyle: 'full-gradient', coverAccent2: '#DC2626',
        headerVariant: 'right-text-center-logo-left-info',
        showMoeLogo: true, showSchoolLogo: true, showEvidenceSection: false,
        showTopLine: true, showBottomBar: true,
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المقيَّم (المعلم)', left: 'المقيِّم (المدير/المشرف)' },
      } as any,
      isDefault: false, sortOrder: 10,
    },
  ];
  
  for (const t of defaults) {
    await db.insert(pdfTemplates).values(t);
  }
  console.log('[Seed] ✅ Seeded 10 built-in templates into database');
}

// ─── Activity Logs ──────────────────────────────────────────
export async function createActivityLog(data: InsertActivityLog) {
  const db = await getDb();
  if (!db) return;
  try {
    await db.insert(activityLogs).values(data);
  } catch (e) {
    console.warn("[ActivityLog] Failed to log:", e);
  }
}

export async function getActivityLogs(page = 1, limit = 50, filters?: { action?: string; entity?: string; userId?: number }) {
  const db = await getDb();
  if (!db) return { items: [], total: 0 };
  const offset = (page - 1) * limit;
  
  const conditions: any[] = [];
  if (filters?.action) conditions.push(eq(activityLogs.action, filters.action));
  if (filters?.entity) conditions.push(eq(activityLogs.entity, filters.entity));
  if (filters?.userId) conditions.push(eq(activityLogs.userId, filters.userId));
  
  const where = conditions.length > 0 ? and(...conditions) : undefined;
  
  const items = await db.select().from(activityLogs).where(where).orderBy(desc(activityLogs.createdAt)).limit(limit).offset(offset);
  const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(activityLogs).where(where);
  
  return { items, total: countResult?.count ?? 0 };
}

export async function getAdvancedStats() {
  const db = await getDb();
  if (!db) return { users: 0, portfolios: 0, templates: 0, files: 0, themes: 0, shareLinks: 0, activities: 0, statusBreakdown: {}, recentUsers: [], recentPortfolios: [] };
  
  const [uC] = await db.select({ count: count() }).from(users);
  const [pC] = await db.select({ count: count() }).from(portfolios);
  const [tC] = await db.select({ count: count() }).from(pdfTemplates);
  const [fC] = await db.select({ count: count() }).from(uploadedFiles);
  const [thC] = await db.select({ count: count() }).from(userThemes);
  const [sC] = await db.select({ count: count() }).from(shareLinks);

  // Activity count (last 30 days)
  let activities = 0;
  try {
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const [aC] = await db.select({ count: count() }).from(activityLogs).where(gte(activityLogs.createdAt, thirtyDaysAgo));
    activities = aC?.count ?? 0;
  } catch { /* table may not exist yet */ }

  // Portfolio status breakdown
  const statusRows = await db.select({ status: portfolios.status, count: count() }).from(portfolios).groupBy(portfolios.status);
  const statusBreakdown: Record<string, number> = {};
  statusRows.forEach(r => { statusBreakdown[r.status] = r.count; });

  // Recent 5 users
  const recentUsers = await db.select({ id: users.id, name: users.name, email: users.email, role: users.role, createdAt: users.createdAt }).from(users).orderBy(desc(users.createdAt)).limit(5);

  // Recent 5 portfolios
  const recentPortfolios = await db.select({
    id: portfolios.id, jobTitle: portfolios.jobTitle, status: portfolios.status,
    completionPercentage: portfolios.completionPercentage, updatedAt: portfolios.updatedAt,
    userName: users.name,
  }).from(portfolios).leftJoin(users, eq(portfolios.userId, users.id)).orderBy(desc(portfolios.updatedAt)).limit(5);

  return {
    users: uC?.count ?? 0,
    portfolios: pC?.count ?? 0,
    templates: tC?.count ?? 0,
    files: fC?.count ?? 0,
    themes: thC?.count ?? 0,
    shareLinks: sC?.count ?? 0,
    activities,
    statusBreakdown,
    recentUsers,
    recentPortfolios,
  };
}

// ─── Section Configs ────────────────────────────────────────
export async function getSectionConfigs(sectionId?: string) {
  const db = await getDb();
  if (!db) return [];
  if (sectionId) {
    return db.select().from(sectionConfigs).where(eq(sectionConfigs.sectionId, sectionId)).orderBy(sectionConfigs.sortOrder);
  }
  return db.select().from(sectionConfigs).orderBy(sectionConfigs.sortOrder);
}

export async function getActiveSectionConfigs(sectionId: string) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(sectionConfigs)
    .where(and(eq(sectionConfigs.sectionId, sectionId), eq(sectionConfigs.isActive, true)))
    .orderBy(sectionConfigs.sortOrder);
}

export async function createSectionConfig(data: InsertSectionConfig) {
  const db = await getDb();
  if (!db) return null;
  const [result] = await db.insert(sectionConfigs).values(data);
  return result.insertId;
}

export async function updateSectionConfig(id: number, data: Partial<InsertSectionConfig>) {
  const db = await getDb();
  if (!db) return;
  await db.update(sectionConfigs).set({ ...data, updatedAt: new Date() }).where(eq(sectionConfigs.id, id));
}

export async function deleteSectionConfig(id: number) {
  const db = await getDb();
  if (!db) return;
  await db.delete(sectionConfigs).where(eq(sectionConfigs.id, id));
}
