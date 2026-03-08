import { eq, and, desc, sql, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, portfolios, uploadedFiles, shareLinks, pdfTemplates, type InsertPortfolio, type InsertUploadedFile, type InsertShareLink, type InsertPdfTemplate } from "../drizzle/schema";
import { ENV } from './_core/env';

let _db: ReturnType<typeof drizzle> | null = null;

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn("[Database] Failed to connect:", error);
      _db = null;
    }
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

export async function seedDefaultTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(pdfTemplates).limit(1);
  if (existing.length > 0) return;
  
  const baseFields = [
    { id: 'programName', label: 'اسم البرنامج', type: 'text', required: true },
    { id: 'executionDate', label: 'تاريخ التنفيذ', type: 'date' },
    { id: 'beneficiaries', label: 'المستفيدون', type: 'text' },
    { id: 'field', label: 'المجال', type: 'text' },
    { id: 'executor', label: 'المنفذ/ون', type: 'text' },
    { id: 'participants', label: 'المشارك/ون', type: 'text' },
    { id: 'location', label: 'مكان التنفيذ', type: 'text' },
    { id: 'duration', label: 'مدة التنفيذ', type: 'text' },
  ];

  const baseSections = [
    { id: 'info', title: 'تقرير عن برنامج', columns: 2, fields: baseFields },
    { id: 'goals', title: 'الأهداف', columns: 1, fields: [{ id: 'goals', label: 'الأهداف', type: 'list' }] },
    { id: 'steps', title: 'خطوات التنفيذ / الوصف', columns: 1, fields: [{ id: 'steps', label: 'خطوات التنفيذ', type: 'list' }] },
    { id: 'impact', title: 'أثر البرنامج', columns: 2, fields: [{ id: 'impact', label: 'أثر البرنامج', type: 'list' }, { id: 'recommendations', label: 'التوصيات', type: 'list' }] },
  ];

  const makeLayout = (overrides: Record<string, any>): any => ({
    version: 1,
    pageSize: 'A4' as const,
    direction: 'rtl' as const,
    showMoeLogo: true,
    showSchoolLogo: true,
    showEvidenceSection: true,
    evidenceDisplay: 'mixed',
    sections: baseSections,
    signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
    footerText: 'SERS - نظام السجلات التعليمية الذكي',
    ...overrides,
  });

  const defaults: InsertPdfTemplate[] = [
    // 1. ترويسة داكنة + جدول (PDF صفحة 4-5)
    {
      name: "الهوية البصرية - ترويسة داكنة",
      description: "ترويسة تدرج أزرق-أخضر داكنة مع حقول جدول",
      headerBg: "linear-gradient(135deg, #0c4a6e, #065f46)",
      headerText: "#ffffff",
      accent: "#0d9488",
      borderColor: "#0d9488",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'dark-header-table', fieldStyle: 'table', titleStyle: 'full-width', signatureStyle: 'boxed', footerStyle: 'gradient' }),
      isDefault: true,
      sortOrder: 1,
    },
    // 2. أبيض كلاسيكي + عنوان مستدير (PDF صفحة 2-3)
    {
      name: "الهوية البصرية - أبيض كلاسيكي",
      description: "ترويسة بيضاء مع عنوان مستدير وحقول تحتية",
      headerBg: "#ffffff",
      headerText: "#0c4a6e",
      accent: "#0d9488",
      borderColor: "#0d9488",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'white-header-classic', fieldStyle: 'underlined', titleStyle: 'rounded', signatureStyle: 'lined', footerStyle: 'solid' }),
      isDefault: false,
      sortOrder: 2,
    },
    // 3. شريط جانبي ملون (PDF صفحة 9-10)
    {
      name: "الهوية البصرية - شريط جانبي",
      description: "شريط جانبي ملون مع حقول بطاقات",
      headerBg: "#ffffff",
      headerText: "#0c4a6e",
      accent: "#0d9488",
      borderColor: "#0d9488",
      bodyBg: "#f8fafc",
      templateLayout: makeLayout({ layoutType: 'white-header-sidebar', fieldStyle: 'cards', titleStyle: 'badge', signatureStyle: 'stamped', footerStyle: 'gradient' }),
      isDefault: false,
      sortOrder: 3,
    },
    // 4. تدرج أزرق-أخضر (PDF صفحة 7-8)
    {
      name: "الهوية البصرية - تدرج",
      description: "ترويسة تدرج مع حقول fieldset",
      headerBg: "linear-gradient(135deg, #0c4a6e, #065f46)",
      headerText: "#ffffff",
      accent: "#0d9488",
      borderColor: "#0d9488",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'dark-header-simple', fieldStyle: 'fieldset', titleStyle: 'full-width', signatureStyle: 'lined', footerStyle: 'gradient' }),
      isDefault: false,
      sortOrder: 4,
    },
    // 5. أبيض خفيف (PDF صفحة 1)
    {
      name: "الهوية البصرية - خفيف",
      description: "ترويسة بيضاء خفيفة مع شريط سفلي تدرج",
      headerBg: "#ffffff",
      headerText: "#0c4a6e",
      accent: "#0d9488",
      borderColor: "#d1d5db",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'white-header-light', fieldStyle: 'fieldset', titleStyle: 'underlined', signatureStyle: 'simple', footerStyle: 'gradient' }),
      isDefault: false,
      sortOrder: 5,
    },
    // 6. أعمدة متعددة (PDF صفحة 6)
    {
      name: "الهوية البصرية - أعمدة",
      description: "ترويسة داكنة مع حقول أعمدة متعددة",
      headerBg: "linear-gradient(135deg, #0c4a6e, #065f46)",
      headerText: "#ffffff",
      accent: "#0d9488",
      borderColor: "#0d9488",
      bodyBg: "#f0fdfa",
      templateLayout: makeLayout({ layoutType: 'white-header-multi', fieldStyle: 'table', titleStyle: 'bordered', signatureStyle: 'boxed', footerStyle: 'solid' }),
      isDefault: false,
      sortOrder: 6,
    },
    // 7. بسيط نظيف
    {
      name: "بسيط نظيف",
      description: "تصميم بسيط بدون زخرفة",
      headerBg: "#ffffff",
      headerText: "#374151",
      accent: "#6b7280",
      borderColor: "#e5e7eb",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'minimal-clean', fieldStyle: 'minimal', titleStyle: 'simple', signatureStyle: 'simple', footerStyle: 'line' }),
      isDefault: false,
      sortOrder: 7,
    },
    // 8. أزرق رسمي
    {
      name: "أزرق رسمي",
      description: "تصميم أزرق رسمي للتقارير",
      headerBg: "linear-gradient(135deg, #1e40af, #1e3a8a)",
      headerText: "#ffffff",
      accent: "#2563EB",
      borderColor: "#dbeafe",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'dark-header-table', fieldStyle: 'table', titleStyle: 'full-width', signatureStyle: 'boxed', footerStyle: 'gradient' }),
      isDefault: false,
      sortOrder: 8,
    },
    // 9. بنفسجي عصري
    {
      name: "بنفسجي عصري",
      description: "تصميم بنفسجي عصري",
      headerBg: "linear-gradient(135deg, #7c3aed, #6d28d9)",
      headerText: "#ffffff",
      accent: "#7C3AED",
      borderColor: "#ede9fe",
      bodyBg: "#ffffff",
      templateLayout: makeLayout({ layoutType: 'white-header-classic', fieldStyle: 'cards', titleStyle: 'rounded', signatureStyle: 'stamped', footerStyle: 'solid' }),
      isDefault: false,
      sortOrder: 9,
    },
    // 10. ذهبي فاخر
    {
      name: "ذهبي فاخر",
      description: "تصميم ذهبي فاخر",
      headerBg: "linear-gradient(135deg, #92400e, #78350f)",
      headerText: "#fef3c7",
      accent: "#b45309",
      borderColor: "#fde68a",
      bodyBg: "#fffbeb",
      templateLayout: makeLayout({ layoutType: 'dark-header-simple', fieldStyle: 'fieldset', titleStyle: 'bordered', signatureStyle: 'lined', footerStyle: 'gradient' }),
      isDefault: false,
      sortOrder: 10,
    },
    // 11. أحمر وطني
    {
      name: "أحمر وطني",
      description: "تصميم بألوان العلم السعودي",
      headerBg: "linear-gradient(135deg, #166534, #15803d)",
      headerText: "#ffffff",
      accent: "#166534",
      borderColor: "#bbf7d0",
      bodyBg: "#f0fdf4",
      templateLayout: makeLayout({ layoutType: 'white-header-sidebar', fieldStyle: 'underlined', titleStyle: 'badge', signatureStyle: 'boxed', footerStyle: 'solid' }),
      isDefault: false,
      sortOrder: 11,
    },
  ];
  
  for (const t of defaults) {
    await db.insert(pdfTemplates).values(t);
  }
}
