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
  
  const defaults: InsertPdfTemplate[] = [
    { name: "كلاسيكي", description: "تصميم كلاسيكي احترافي", headerBg: "linear-gradient(135deg, #059669, #047857)", headerText: "#ffffff", accent: "#059669", borderColor: "#e5e7eb", bodyBg: "#ffffff", isDefault: true, sortOrder: 1 },
    { name: "أزرق رسمي", description: "تصميم أزرق رسمي للتقارير", headerBg: "linear-gradient(135deg, #1e40af, #1e3a8a)", headerText: "#ffffff", accent: "#2563EB", borderColor: "#dbeafe", bodyBg: "#ffffff", isDefault: false, sortOrder: 2 },
    { name: "بنفسجي عصري", description: "تصميم بنفسجي عصري", headerBg: "linear-gradient(135deg, #7c3aed, #6d28d9)", headerText: "#ffffff", accent: "#7C3AED", borderColor: "#ede9fe", bodyBg: "#ffffff", isDefault: false, sortOrder: 3 },
    { name: "ذهبي فاخر", description: "تصميم ذهبي فاخر", headerBg: "linear-gradient(135deg, #92400e, #78350f)", headerText: "#fef3c7", accent: "#b45309", borderColor: "#fde68a", bodyBg: "#fffbeb", isDefault: false, sortOrder: 4 },
    { name: "أحمر وطني", description: "تصميم بألوان العلم السعودي", headerBg: "linear-gradient(135deg, #166534, #15803d)", headerText: "#ffffff", accent: "#166534", borderColor: "#bbf7d0", bodyBg: "#f0fdf4", isDefault: false, sortOrder: 5 },
  ];
  
  for (const t of defaults) {
    await db.insert(pdfTemplates).values(t);
  }
}

// ─── Report Templates (Dynamic Form + Layout) ─────────────────
import { reportTemplates, userReports, type InsertReportTemplate, type InsertUserReport, type ReportField, type ReportLayout } from "../drizzle/schema";

export async function createReportTemplate(data: InsertReportTemplate) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reportTemplates).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateReportTemplate(id: number, data: Partial<InsertReportTemplate>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(reportTemplates).set(data).where(eq(reportTemplates.id, id));
  return { success: true };
}

export async function deleteReportTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(reportTemplates).where(eq(reportTemplates.id, id));
  return { success: true };
}

export async function getActiveReportTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportTemplates).where(eq(reportTemplates.isActive, true)).orderBy(reportTemplates.sortOrder);
}

export async function getAllReportTemplates() {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(reportTemplates).orderBy(reportTemplates.sortOrder);
}

export async function getReportTemplateById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(reportTemplates).where(eq(reportTemplates.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function seedDefaultReportTemplates() {
  const db = await getDb();
  if (!db) return;
  const existing = await db.select().from(reportTemplates).limit(1);
  if (existing.length > 0) return;

  const defaultTemplates: InsertReportTemplate[] = [
    {
      name: "تقرير برنامج / نشاط",
      description: "نموذج شامل لتوثيق البرامج والأنشطة التعليمية بالهوية البصرية لوزارة التعليم",
      category: "programs",
      fields: [
        { id: "programName", label: "اسم البرنامج", type: "text", required: true, section: "info", gridCol: 1, gridRow: 1 },
        { id: "executor", label: "المنفذ/ون", type: "text", required: true, section: "info", gridCol: 1, gridRow: 2 },
        { id: "participants", label: "المشارك/ون", type: "text", section: "info", gridCol: 2, gridRow: 2 },
        { id: "executionPlace", label: "مكان التنفيذ", type: "text", section: "info", gridCol: 1, gridRow: 3 },
        { id: "duration", label: "مدة التنفيذ", type: "text", section: "info", gridCol: 2, gridRow: 3 },
        { id: "executionDate", label: "تاريخ التنفيذ", type: "date", section: "info", gridCol: 3, gridRow: 3 },
        { id: "beneficiaries", label: "المستفيدون / العدد", type: "text", section: "info", gridCol: 1, gridRow: 4 },
        { id: "field", label: "المجال", type: "text", section: "info", gridCol: 2, gridRow: 4 },
        { id: "objectives", label: "الأهداف", type: "list", section: "content", gridCol: 1, gridRow: 5, maxItems: 10 },
        { id: "steps", label: "خطوات التنفيذ / الوصف", type: "list", section: "content", gridCol: 2, gridRow: 5, maxItems: 10 },
        { id: "evidenceImages", label: "الشواهد", type: "images", section: "evidence", maxItems: 6 },
        { id: "teacherName", label: "اسم المعلم/ة", type: "text", section: "signatures", gridCol: 1 },
        { id: "principalName", label: "مدير/ة المدرسة", type: "text", section: "signatures", gridCol: 2 },
      ] as ReportField[],
      layout: {
        pageSize: "A4",
        direction: "rtl",
        columns: 2,
        headerStyle: "ministry",
        showSchoolName: true,
        showMinistryLogo: true,
        showSignatures: true,
        showFooter: true,
        sections: [
          { id: "header", title: "الترويسة", type: "header" },
          { id: "info", title: "معلومات البرنامج", type: "fields", columns: 2, fieldIds: ["programName", "executor", "participants", "executionPlace", "duration", "executionDate", "beneficiaries", "field"] },
          { id: "content", title: "المحتوى", type: "content", columns: 2, fieldIds: ["objectives", "steps"] },
          { id: "evidence", title: "الشواهد", type: "images", fieldIds: ["evidenceImages"] },
          { id: "signatures", title: "التوقيعات", type: "signatures", columns: 2, fieldIds: ["teacherName", "principalName"] },
          { id: "footer", title: "التذييل", type: "footer" },
        ],
      } as ReportLayout,
      isDefault: true,
      isActive: true,
      sortOrder: 1,
    },
    {
      name: "تقرير برنامج إرشادي",
      description: "نموذج تقرير عن برنامج إرشادي مع شواهد",
      category: "programs",
      fields: [
        { id: "programName", label: "اسم البرنامج", type: "text", required: true, section: "info", gridCol: 1, gridRow: 1 },
        { id: "executionDate", label: "تاريخ التنفيذ", type: "date", section: "info", gridCol: 2, gridRow: 1 },
        { id: "beneficiaries", label: "المستفيدون", type: "text", section: "info", gridCol: 1, gridRow: 2 },
        { id: "field", label: "المجال", type: "text", section: "info", gridCol: 2, gridRow: 2 },
        { id: "objectives", label: "أهداف البرنامج", type: "list", section: "content", gridCol: 1, gridRow: 3, maxItems: 10 },
        { id: "executionSteps", label: "آلية تنفيذ البرنامج", type: "list", section: "content", gridCol: 2, gridRow: 3, maxItems: 10 },
        { id: "evidenceImages", label: "شواهد البرنامج", type: "images", section: "evidence", maxItems: 6 },
        { id: "teacherName", label: "اسم المعلم/ة", type: "text", section: "signatures", gridCol: 1 },
        { id: "principalName", label: "مدير/ة المدرسة", type: "text", section: "signatures", gridCol: 2 },
      ] as ReportField[],
      layout: {
        pageSize: "A4",
        direction: "rtl",
        columns: 2,
        headerStyle: "ministry",
        showSchoolName: true,
        showMinistryLogo: true,
        showSignatures: true,
        showFooter: true,
        sections: [
          { id: "header", title: "الترويسة", type: "header" },
          { id: "info", title: "تقرير عن برنامج إرشادي", type: "fields", columns: 2, fieldIds: ["programName", "executionDate", "beneficiaries", "field"] },
          { id: "content", title: "المحتوى", type: "content", columns: 2, fieldIds: ["objectives", "executionSteps"] },
          { id: "evidence", title: "شواهد البرنامج", type: "images", fieldIds: ["evidenceImages"] },
          { id: "signatures", title: "التوقيعات", type: "signatures", columns: 2, fieldIds: ["teacherName", "principalName"] },
          { id: "footer", title: "التذييل", type: "footer" },
        ],
      } as ReportLayout,
      isActive: true,
      sortOrder: 2,
    },
    {
      name: "تقرير مبادرة",
      description: "نموذج تقرير تفعيل مبادرة شامل مع الأهداف والأنشطة والمؤشرات",
      category: "initiatives",
      fields: [
        { id: "initiativeName", label: "اسم المبادرة", type: "text", required: true, section: "info", gridCol: 1, gridRow: 1 },
        { id: "executionMethod", label: "أسلوب التنفيذ", type: "text", section: "info", gridCol: 1, gridRow: 2 },
        { id: "participants", label: "المشاركين", type: "text", section: "info", gridCol: 2, gridRow: 2 },
        { id: "executionDate", label: "تاريخ التنفيذ", type: "date", section: "info", gridCol: 3, gridRow: 2 },
        { id: "slogan", label: "شعار المبادرة", type: "text", section: "info", gridCol: 1, gridRow: 3 },
        { id: "place", label: "مكان المبادرة", type: "text", section: "info", gridCol: 2, gridRow: 3 },
        { id: "targetGroup", label: "الفئة المستهدفة", type: "text", section: "info", gridCol: 3, gridRow: 3 },
        { id: "mainIdea", label: "فكرة المبادرة (الهدف العام)", type: "textarea", section: "content", gridCol: 1, gridRow: 4 },
        { id: "objectives", label: "الأهداف", type: "list", section: "content", gridCol: 1, gridRow: 5, maxItems: 10 },
        { id: "components", label: "مكونات المبادرة (آلية التنفيذ)", type: "list", section: "content", gridCol: 2, gridRow: 5, maxItems: 10 },
        { id: "activities", label: "الأنشطة", type: "list", section: "content", gridCol: 1, gridRow: 6, maxItems: 10 },
        { id: "successIndicators", label: "مؤشرات النجاح (المخرجات المتوقعة)", type: "list", section: "content", gridCol: 2, gridRow: 6, maxItems: 10 },
        { id: "evidenceImages", label: "الشواهد", type: "images", section: "evidence", maxItems: 6 },
        { id: "teacherName", label: "المعلم / اسم المعلم", type: "text", section: "signatures", gridCol: 1 },
        { id: "principalName", label: "مدير المدرسة / اسم المدير", type: "text", section: "signatures", gridCol: 2 },
      ] as ReportField[],
      layout: {
        pageSize: "A4",
        direction: "rtl",
        columns: 2,
        headerStyle: "ministry",
        showSchoolName: true,
        showMinistryLogo: true,
        showSignatures: true,
        showFooter: true,
        sections: [
          { id: "header", title: "الترويسة", type: "header" },
          { id: "info", title: "معلومات المبادرة", type: "fields", columns: 3, fieldIds: ["initiativeName", "executionMethod", "participants", "executionDate", "slogan", "place", "targetGroup"] },
          { id: "mainIdea", title: "فكرة المبادرة", type: "content", columns: 1, fieldIds: ["mainIdea"] },
          { id: "content", title: "التفاصيل", type: "content", columns: 2, fieldIds: ["objectives", "components", "activities", "successIndicators"] },
          { id: "evidence", title: "الشواهد", type: "images", fieldIds: ["evidenceImages"] },
          { id: "signatures", title: "التوقيعات", type: "signatures", columns: 2, fieldIds: ["teacherName", "principalName"] },
          { id: "footer", title: "التذييل", type: "footer" },
        ],
      } as ReportLayout,
      isActive: true,
      sortOrder: 3,
    },
    {
      name: "تقرير درس عن بُعد",
      description: "نموذج تقرير تفعيل درس عن بُعد باستخدام مدرستي وتيمز",
      category: "lessons",
      fields: [
        { id: "lessonTitle", label: "عنوان التقرير", type: "text", required: true, section: "info", gridCol: 1, gridRow: 1 },
        { id: "subject", label: "المادة", type: "text", section: "info", gridCol: 1, gridRow: 2 },
        { id: "targetGroup", label: "الفئة المستهدفة", type: "text", section: "info", gridCol: 2, gridRow: 2 },
        { id: "executionTime", label: "وقت التنفيذ", type: "text", section: "info", gridCol: 3, gridRow: 2 },
        { id: "description", label: "وصف البرنامج", type: "textarea", section: "content", gridCol: 1, gridRow: 3 },
        { id: "objectives", label: "أهداف استخدام البرنامج", type: "list", section: "content", gridCol: 1, gridRow: 4, maxItems: 10 },
        { id: "steps", label: "خطوات وآلية الاستخدام", type: "list", section: "content", gridCol: 2, gridRow: 4, maxItems: 10 },
        { id: "impact", label: "أثر البرنامج", type: "list", section: "content", gridCol: 1, gridRow: 5, maxItems: 10 },
        { id: "recommendations", label: "التوصيات", type: "list", section: "content", gridCol: 2, gridRow: 5, maxItems: 10 },
        { id: "teacherName", label: "المعلم / اسم المعلم", type: "text", section: "signatures", gridCol: 1 },
        { id: "principalName", label: "مدير المدرسة / اسم المدير", type: "text", section: "signatures", gridCol: 2 },
      ] as ReportField[],
      layout: {
        pageSize: "A4",
        direction: "rtl",
        columns: 2,
        headerStyle: "ministry",
        showSchoolName: true,
        showMinistryLogo: true,
        showSignatures: true,
        showFooter: true,
        sections: [
          { id: "header", title: "الترويسة", type: "header" },
          { id: "info", title: "معلومات الدرس", type: "fields", columns: 3, fieldIds: ["lessonTitle", "subject", "targetGroup", "executionTime"] },
          { id: "description", title: "وصف البرنامج", type: "content", columns: 1, fieldIds: ["description"] },
          { id: "content", title: "التفاصيل", type: "content", columns: 2, fieldIds: ["objectives", "steps", "impact", "recommendations"] },
          { id: "signatures", title: "التوقيعات", type: "signatures", columns: 2, fieldIds: ["teacherName", "principalName"] },
          { id: "footer", title: "التذييل", type: "footer" },
        ],
      } as ReportLayout,
      isActive: true,
      sortOrder: 4,
    },
  ];

  for (const t of defaultTemplates) {
    await db.insert(reportTemplates).values(t);
  }
}

// ─── User Reports (filled data) ─────────────────────────────
export async function createUserReport(data: InsertUserReport) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(userReports).values(data);
  return { id: Number(result[0].insertId) };
}

export async function updateUserReport(id: number, userId: number, data: Partial<InsertUserReport>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(userReports).set(data).where(and(eq(userReports.id, id), eq(userReports.userId, userId)));
  return { success: true };
}

export async function getUserReports(userId: number, portfolioId?: number) {
  const db = await getDb();
  if (!db) return [];
  const conditions = portfolioId
    ? and(eq(userReports.userId, userId), eq(userReports.portfolioId, portfolioId))
    : eq(userReports.userId, userId);
  return db.select().from(userReports).where(conditions).orderBy(desc(userReports.updatedAt));
}

export async function getUserReportById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(userReports).where(eq(userReports.id, id)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function deleteUserReport(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.delete(userReports).where(and(eq(userReports.id, id), eq(userReports.userId, userId)));
  return { success: true };
}
