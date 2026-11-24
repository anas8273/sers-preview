import { TRPCError } from "@trpc/server";
import { eq, and, desc, sql, gt, lt } from "drizzle-orm";
import { drizzle } from "drizzle-orm/mysql2";
import { InsertUser, users, auditLogs, portfolios, uploadedFiles, evidenceComments, onlineExams, onlineExamResponses, shareLinks, pdfTemplates, userThemes, type InsertAuditLog, type InsertPortfolio, type InsertUploadedFile, type InsertEvidenceComment, type InsertOnlineExam, type InsertOnlineExamResponse, type InsertShareLink, type InsertPdfTemplate, type InsertUserTheme } from "../drizzle/schema";
import { ENV } from './_core/env';
import { isMySqlDuplicateEntryError } from "./mysql-errors";

let _db: ReturnType<typeof drizzle> | null = null;

function assertAffectedRows(result: unknown, message = "العنصر غير موجود أو لا تملك صلاحية تعديله") {
  const candidate = Array.isArray(result) ? result[0] : result;
  const affected = candidate && typeof candidate === "object" && "affectedRows" in candidate
    ? Number((candidate as { affectedRows?: number }).affectedRows ?? 0)
    : 0;
  if (affected === 0) {
    throw new TRPCError({ code: "NOT_FOUND", message });
  }
}

export async function getDb() {
  if (!_db && process.env.DATABASE_URL) {
    try {
      _db = drizzle(process.env.DATABASE_URL);
    } catch (error) {
      console.warn(JSON.stringify({ event: "database_initialization_failed" }));
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
  } catch (error) { console.error(JSON.stringify({ event: "user_persistence_failed" })); throw error; }
}

export async function getUserByOpenId(openId: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(users).where(eq(users.openId, openId)).limit(1);
  return result.length > 0 ? result[0] : undefined;
}

// ─── Audit Log ──────────────────────────────────────────────
export async function createAuditLog(entry: InsertAuditLog) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(auditLogs).values(entry);
  return { id: Number(result[0].insertId) };
}

export async function getAuditLogs(actorUserId: number, isAdmin = false, limit = 50, portfolioId?: number) {
  const db = await getDb();
  if (!db) return [];
  const scopedConditions = [isAdmin ? undefined : eq(auditLogs.actorUserId, actorUserId), portfolioId ? eq(auditLogs.portfolioId, portfolioId) : undefined].filter(Boolean);
  const condition = scopedConditions.length ? and(...scopedConditions) : undefined;
  return db
    .select({
      id: auditLogs.id,
      actorUserId: auditLogs.actorUserId,
      action: auditLogs.action,
      resourceType: auditLogs.resourceType,
      resourceId: auditLogs.resourceId,
      portfolioId: auditLogs.portfolioId,
      metadata: auditLogs.metadata,
      createdAt: auditLogs.createdAt,
      actorName: users.name,
    })
    .from(auditLogs)
    .leftJoin(users, eq(auditLogs.actorUserId, users.id))
    .where(condition)
    .orderBy(desc(auditLogs.createdAt))
    .limit(Math.min(Math.max(limit, 1), 100));
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
  return db.transaction(async tx => {
    const [owned] = await tx.select({ id: portfolios.id }).from(portfolios)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .limit(1).for("update");
    if (!owned) throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية تعديل هذا الملف" });
    await tx.update(portfolios).set(data)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
    return { success: true };
  });
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
  return db.transaction(async (tx) => {
    // Authorize and lock the parent before touching any child rows. A failure in
    // any delete rolls back the whole operation instead of leaving a partial file.
    const [portfolio] = await tx.select({ id: portfolios.id }).from(portfolios)
      .where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)))
      .limit(1).for("update");
    if (!portfolio) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية حذف هذا الملف" });
    }
    await tx.delete(uploadedFiles).where(eq(uploadedFiles.portfolioId, id));
    await tx.delete(evidenceComments).where(eq(evidenceComments.portfolioId, id));
    await tx.delete(shareLinks).where(eq(shareLinks.portfolioId, id));
    await tx.delete(portfolios).where(and(eq(portfolios.id, id), eq(portfolios.userId, userId)));
    return { success: true };
  });
}

// ─── Collaborative Evidence Comments ───────────────────────
export async function createEvidenceComment(data: InsertEvidenceComment, isAdmin = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    // Serialize with deletion and recheck access after obtaining the parent lock.
    // isAdmin is supplied only by the authenticated server context.
    const [portfolio] = await tx.select({ userId: portfolios.userId }).from(portfolios)
      .where(eq(portfolios.id, data.portfolioId)).limit(1).for("update");
    if (!portfolio || (!isAdmin && portfolio.userId !== data.userId)) {
      throw new TRPCError({ code: "FORBIDDEN", message: "لا تملك صلاحية الوصول إلى تعليقات هذا الملف" });
    }
    const result = await tx.insert(evidenceComments).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getEvidenceComments(portfolioId: number, criterionId: string, evidenceId: string) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: evidenceComments.id,
      portfolioId: evidenceComments.portfolioId,
      criterionId: evidenceComments.criterionId,
      evidenceId: evidenceComments.evidenceId,
      userId: evidenceComments.userId,
      content: evidenceComments.content,
      createdAt: evidenceComments.createdAt,
      updatedAt: evidenceComments.updatedAt,
      authorName: users.name,
    })
    .from(evidenceComments)
    .leftJoin(users, eq(evidenceComments.userId, users.id))
    .where(and(
      eq(evidenceComments.portfolioId, portfolioId),
      eq(evidenceComments.criterionId, criterionId),
      eq(evidenceComments.evidenceId, evidenceId),
    ))
    .orderBy(desc(evidenceComments.createdAt));
}

export async function deleteEvidenceComment(id: number, userId: number, isAdmin = false) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const where = isAdmin ? eq(evidenceComments.id, id) : and(eq(evidenceComments.id, id), eq(evidenceComments.userId, userId));
  const result = await db.delete(evidenceComments).where(where);
  assertAffectedRows(result, "التعليق غير موجود أو لا تملك صلاحية حذفه");
  return { success: true };
}

// ─── Online Exams ───────────────────────────────────────────
export async function createOnlineExam(data: InsertOnlineExam) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(onlineExams).values(data);
  return { id: Number(result[0].insertId), token: data.token };
}

export async function getOnlineExamByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(onlineExams).where(and(eq(onlineExams.token, token), eq(onlineExams.isActive, true))).limit(1);
  return result[0];
}

export async function getOnlineExamById(id: number) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(onlineExams).where(eq(onlineExams.id, id)).limit(1);
  return result[0];
}

export async function deactivateOnlineExam(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(onlineExams).set({ isActive: false }).where(and(eq(onlineExams.id, id), eq(onlineExams.userId, userId)));
  assertAffectedRows(result, "الاختبار غير موجود أو لا تملك صلاحية إيقافه");
  return { success: true };
}

export async function createOnlineExamResponse(data: InsertOnlineExamResponse) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const summary = {
    id: onlineExamResponses.id,
    attemptId: onlineExamResponses.attemptId,
    studentName: onlineExamResponses.studentName,
    studentId: onlineExamResponses.studentId,
    autoScore: onlineExamResponses.autoScore,
    autoMaxScore: onlineExamResponses.autoMaxScore,
    submittedAt: onlineExamResponses.submittedAt,
  };
  const sameSubmission = (existing: any) => {
    if (!existing) return false;
    if (existing.studentName !== data.studentName || (existing.studentId ?? null) !== (data.studentId ?? null)) return false;
    return JSON.stringify(existing.answers ?? null) === JSON.stringify(data.answers);
  };
  const resultFor = (row: any, deduplicated: boolean) => ({
    id: Number(row.id),
    autoScore: Number(row.autoScore),
    autoMaxScore: Number(row.autoMaxScore),
    submittedAt: row.submittedAt,
    deduplicated,
  });

  // Legacy clients omit attemptId by policy. They remain accepted, but each
  // request is a distinct submission and is protected by the router limiter.
  if (!data.attemptId) {
    const result = await db.insert(onlineExamResponses).values(data);
    return { id: Number(result[0].insertId), autoScore: data.autoScore, autoMaxScore: data.autoMaxScore, deduplicated: false };
  }

  const findExisting = async (connection: any) => {
    const rows = await connection.select({ ...summary, answers: onlineExamResponses.answers })
      .from(onlineExamResponses)
      .where(and(eq(onlineExamResponses.onlineExamId, data.onlineExamId), eq(onlineExamResponses.attemptId, data.attemptId!)))
      .limit(1);
    return rows[0];
  };
  const assertSameSubmission = (existing: any) => {
    if (!sameSubmission(existing)) throw new TRPCError({ code: "CONFLICT", message: "معرف المحاولة مستخدم لطالب أو إجابات مختلفة" });
    return resultFor(existing, true);
  };

  try {
    return await db.transaction(async tx => {
      const existing = await findExisting(tx);
      if (existing) return assertSameSubmission(existing);
      const inserted = await tx.insert(onlineExamResponses).values(data);
      return {
        id: Number(inserted[0].insertId),
        autoScore: data.autoScore,
        autoMaxScore: data.autoMaxScore,
        deduplicated: false,
      };
    });
  } catch (error) {
    // Two requests can both observe no row before one inserts. Only a unique
    // constraint race is resolved by reading the committed winner; all other
    // DB errors remain failures instead of being hidden as idempotency.
    if (!isMySqlDuplicateEntryError(error)) throw error;
    const existing = await findExisting(db);
    if (!existing) throw new Error("تعذر تثبيت محاولة الاختبار بأمان");
    return assertSameSubmission(existing);
  }
}

export async function getOnlineExamResponses(onlineExamId: number, options?: { limit?: number; cursor?: string }) {
  const db = await getDb();
  if (!db) return [];
  const limit = Math.min(Math.max(options?.limit ?? 50, 1), 100);
  const paginated = options?.limit !== undefined || options?.cursor !== undefined;
  const cursor = options?.cursor === undefined ? undefined : Number(options.cursor);
  if (cursor !== undefined && (!Number.isSafeInteger(cursor) || cursor <= 0)) {
    throw new TRPCError({ code: "BAD_REQUEST", message: "مؤشر صفحات التسليمات غير صالح" });
  }
  const condition = and(eq(onlineExamResponses.onlineExamId, onlineExamId), cursor === undefined ? undefined : lt(onlineExamResponses.id, cursor));
  const rows = await db.select({
    id: onlineExamResponses.id,
    attemptId: onlineExamResponses.attemptId,
    studentName: onlineExamResponses.studentName,
    studentId: onlineExamResponses.studentId,
    autoScore: onlineExamResponses.autoScore,
    autoMaxScore: onlineExamResponses.autoMaxScore,
    submittedAt: onlineExamResponses.submittedAt,
  }).from(onlineExamResponses).where(condition).orderBy(desc(onlineExamResponses.id)).limit(limit + 1);
  if (!paginated) {
    if (rows.length > limit) {
      throw new TRPCError({ code: "PRECONDITION_FAILED", message: "توجد تسليمات إضافية؛ استخدم التصفح بالصفحات لعرض جميع النتائج" });
    }
    return rows;
  }
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  return { items, nextCursor: hasMore ? String(items[items.length - 1].id) : null };
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
  const result = await db.update(portfolios).set({
    status: status as any,
    reviewNotes: notes,
    reviewedBy: reviewerId,
    reviewedAt: new Date(),
  }).where(eq(portfolios.id, id));
  assertAffectedRows(result, "ملف الإنجاز غير موجود");
  return { success: true };
}

// ─── Uploaded Files ──────────────────────────────────────
export async function createUploadedFile(data: InsertUploadedFile) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  // Unattached uploads retain their original behavior. Linked uploads must
  // serialize with portfolio deletion and re-check ownership after storage I/O.
  if (data.portfolioId == null) {
    const result = await db.insert(uploadedFiles).values(data);
    return { id: Number(result[0].insertId) };
  }
  return db.transaction(async (tx) => {
    const [portfolio] = await tx.select({ id: portfolios.id }).from(portfolios)
      .where(and(eq(portfolios.id, data.portfolioId!), eq(portfolios.userId, data.userId)))
      .limit(1).for("update");
    if (!portfolio) throw new TRPCError({ code: "FORBIDDEN", message: "الملف غير متاح أو لا تملك صلاحية إرفاق ملفات به" });
    const result = await tx.insert(uploadedFiles).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getFilesByPortfolio(portfolioId: number, options?: { publicProjection?: boolean }) {
  const db = await getDb();
  if (!db) return [];
  if (options?.publicProjection) {
    return db.select({
      id: uploadedFiles.id,
      originalName: uploadedFiles.originalName,
      mimeType: uploadedFiles.mimeType,
      fileSize: uploadedFiles.fileSize,
      criterionId: uploadedFiles.criterionId,
      subEvidenceId: uploadedFiles.subEvidenceId,
      createdAt: uploadedFiles.createdAt,
    }).from(uploadedFiles).where(eq(uploadedFiles.portfolioId, portfolioId)).orderBy(desc(uploadedFiles.createdAt));
  }
  return db.select().from(uploadedFiles).where(eq(uploadedFiles.portfolioId, portfolioId)).orderBy(desc(uploadedFiles.createdAt));
}

export async function deleteUploadedFile(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(uploadedFiles).where(and(eq(uploadedFiles.id, id), eq(uploadedFiles.userId, userId)));
  assertAffectedRows(result, "الملف غير موجود أو لا تملك صلاحية حذفه");
  return { success: true };
}

// ─── Share Links ─────────────────────────────────────────
export async function createShareLink(data: InsertShareLink) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async (tx) => {
    const [portfolio] = await tx.select({ id: portfolios.id }).from(portfolios)
      .where(and(eq(portfolios.id, data.portfolioId), eq(portfolios.userId, data.userId)))
      .limit(1).for("update");
    if (!portfolio) throw new TRPCError({ code: "FORBIDDEN", message: "الملف غير متاح أو لا تملك صلاحية مشاركته" });
    const result = await tx.insert(shareLinks).values(data);
    return { id: Number(result[0].insertId) };
  });
}

export async function getShareLinkByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db.select().from(shareLinks)
    .where(and(eq(shareLinks.token, token), eq(shareLinks.isActive, true)))
    .limit(1);
  return result.length > 0 ? result[0] : undefined;
}

export async function incrementShareLinkViews(id: number, expectedPasswordHash: string | null): Promise<boolean> {
  const db = await getDb();
  if (!db) throw new Error("Share view admission unavailable");
  // Claim exactly one view while the grant is still the one whose password was
  // verified. This statement finishes before parent/file reads to avoid a
  // share→portfolio lock order opposite to create/delete operations.
  try {
    const [result] = await db.update(shareLinks).set({ viewCount: sql`COALESCE(${shareLinks.viewCount}, 0) + 1` }).where(and(
      eq(shareLinks.id, id), eq(shareLinks.isActive, true), gt(shareLinks.expiresAt, sql`CURRENT_TIMESTAMP`),
      sql`BINARY ${shareLinks.passwordHash} <=> BINARY ${expectedPasswordHash}`,
      sql`(COALESCE(${shareLinks.maxViews}, 0) = 0 OR COALESCE(${shareLinks.viewCount}, 0) < ${shareLinks.maxViews})`,
    ));
    return result.affectedRows === 1;
  } catch { throw new Error("Share view admission unavailable"); }
}

export async function getShareLinksByPortfolio(portfolioId: number) {
  const db = await getDb();
  if (!db) return [];
  return db.select().from(shareLinks).where(eq(shareLinks.portfolioId, portfolioId)).orderBy(desc(shareLinks.createdAt));
}

export async function deactivateShareLink(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.update(shareLinks).set({ isActive: false }).where(and(eq(shareLinks.id, id), eq(shareLinks.userId, userId)));
  assertAffectedRows(result, "رابط المشاركة غير موجود أو لا تملك صلاحية إيقافه");
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
  const result = await db.update(pdfTemplates).set(data).where(eq(pdfTemplates.id, id));
  assertAffectedRows(result, "القالب غير موجود");
  return { success: true };
}

export async function deletePdfTemplate(id: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(pdfTemplates).where(eq(pdfTemplates.id, id));
  assertAffectedRows(result, "القالب غير موجود");
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

export async function getSharedPdfTemplateByToken(token: string) {
  const db = await getDb();
  if (!db) return undefined;
  const result = await db
    .select()
    .from(pdfTemplates)
    .where(and(eq(pdfTemplates.shareToken, token), eq(pdfTemplates.isShared, true)))
    .limit(1);
  return result[0];
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
  const result = await db.update(userThemes).set(data).where(and(eq(userThemes.id, id), eq(userThemes.userId, userId)));
  assertAffectedRows(result, "الثيم غير موجود أو لا تملك صلاحية تعديله");
  return { success: true };
}

export async function deleteUserTheme(id: number, userId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.delete(userThemes).where(and(eq(userThemes.id, id), eq(userThemes.userId, userId)));
  assertAffectedRows(result, "الثيم غير موجود أو لا تملك صلاحية حذفه");
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

export async function seedDefaultTemplates() {
  const db = await getDb();
  if (!db) return;
  // إعادة إنشاء القوالب إذا كانت فارغة
  const existing = await db.select().from(pdfTemplates).limit(1);
  if (existing.length > 0) return;
  
  const baseFields = [
    { id: 'subject', label: 'الموضوع', type: 'text', required: true },
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

  // === قالب واحد فقط في DB (بطاقات - شريط جانبي) ===
  // القوالب الأساسية (ترويسة بيضاء، ترويسة داكنة، خفيف حبر) مدمجة في الكود BUILTIN_THEMES
  // الإدارة يمكنها إضافة قوالب إضافية من لوحة التحكم
  const defaults: InsertPdfTemplate[] = [
    // بطاقات - شريط جانبي + بطاقات
    {
      name: "بطاقات - شريط جانبي",
      description: "شريط جانبي ملون مع حقول بطاقات - الهوية البصرية الرسمية",
      headerBg: "#ffffff",
      headerText: "#0d7377",
      accent: "#0d7377",
      borderColor: "#0a5c5f",
      bodyBg: "#f8fafb",
      templateLayout: makeLayout({ layoutType: 'white-header-sidebar', fieldStyle: 'cards', titleStyle: 'badge', signatureStyle: 'stamped', footerStyle: 'gradient', coverStyle: 'diagonal', sectionCoverStyle: 'card-center', coverAccent2: '#2ea87a' }),
      isDefault: false,
      sortOrder: 1,
    },
  ];
  
  for (const t of defaults) {
    await db.insert(pdfTemplates).values(t);
  }
}
