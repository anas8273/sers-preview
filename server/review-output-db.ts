import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  memberships,
  notifications,
  organizations,
  outputs,
  reviewComments,
  reviews,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { auditLogs, users } from "../drizzle/schema";
import { assertWorkAccess } from "./domain-db";
import { getDb } from "./db";
import { projectReportSnapshot } from "./public-output-service";

type MembershipRow = typeof memberships.$inferSelect;
type Database = NonNullable<Awaited<ReturnType<typeof getDb>>>;
type Transaction = Parameters<Parameters<Database["transaction"]>[0]>[0];
async function lockActiveOrganization(tx: Transaction, id: number) {
  const [organization] = await tx.select({ status: organizations.status }).from(organizations)
    .where(eq(organizations.id, id)).limit(1).for("update");
  return organization?.status === "active";
}

export class ReviewConflictError extends Error {
  constructor(message = "Review state conflict") {
    super(message);
    this.name = "ReviewConflictError";
  }
}

export class OutputValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputValidationError";
  }
}

const OUTPUT_TYPES = ["pdf", "link", "qr", "docx"] as const;
const OUTPUT_VISIBILITIES = ["private", "protected", "public"] as const;
type OutputType = (typeof OUTPUT_TYPES)[number];
type OutputVisibility = (typeof OUTPUT_VISIBILITIES)[number];

function isOutputType(value: unknown): value is OutputType {
  return typeof value === "string" && (OUTPUT_TYPES as readonly string[]).includes(value);
}

function isOutputVisibility(value: unknown): value is OutputVisibility {
  return typeof value === "string" && (OUTPUT_VISIBILITIES as readonly string[]).includes(value);
}

/**
 * The public resolver only has a delivery contract for link/QR records.
 * Keep this guard pure and before getDb/transaction so unsupported combinations
 * cannot leave dangling rows even when called outside a tRPC router.
 */
export function validateOutputContract(input: {
  type: unknown;
  visibility?: unknown;
  token?: unknown;
  passwordHash?: unknown;
  expiresAt?: Date;
  storageKey?: unknown;
}) {
  const visibility = input.visibility ?? "private";
  if (!isOutputType(input.type)) throw new OutputValidationError("Unsupported output type");
  if (!isOutputVisibility(visibility)) throw new OutputValidationError("Unsupported output visibility");
  if (input.type === "docx" && visibility !== "private") {
    throw new OutputValidationError("Editable DOCX outputs must remain private");
  }
  if (visibility !== "private" && input.type !== "link" && input.type !== "qr") {
    throw new OutputValidationError("Only link and QR outputs can be shared");
  }
  if ((input.type === "link" || input.type === "qr") && (typeof input.token !== "string" || !input.token.trim())) {
    throw new OutputValidationError("Link and QR outputs require a token");
  }
  if (visibility === "protected" && (typeof input.passwordHash !== "string" || !input.passwordHash.trim())) {
    throw new OutputValidationError("Protected outputs require a password hash");
  }
  if (visibility !== "protected" && input.passwordHash !== undefined && input.passwordHash !== null) {
    throw new OutputValidationError("Password hashes are only valid for protected outputs");
  }
  if (visibility !== "private" && input.storageKey !== undefined && input.storageKey !== null) {
    throw new OutputValidationError("Shared outputs cannot carry a private storage key");
  }
  if (input.expiresAt && (!Number.isFinite(input.expiresAt.getTime()) || input.expiresAt.getTime() <= Date.now())) {
    throw new OutputValidationError("Output expiry must be in the future");
  }
}

function shareAuditMetadata(input: {
  outputId: number;
  workVersionId: number;
  versionNumber: number;
  type: OutputType;
  visibility: OutputVisibility;
  expiresAt: Date | null;
  context: "create" | "revoke";
}) {
  return {
    outputId: input.outputId,
    workVersionId: input.workVersionId,
    versionNumber: input.versionNumber,
    outputType: input.type,
    grant: input.visibility,
    expiresAt: input.expiresAt?.toISOString() ?? null,
    context: input.context,
  };
}

function getAffectedRows(result: unknown): number {
  const candidate = Array.isArray(result) ? result[0] : result;
  if (candidate && typeof candidate === "object" && "affectedRows" in candidate) {
    return Number((candidate as { affectedRows?: number }).affectedRows ?? 0);
  }
  return 0;
}

async function getVersion(versionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ version: workVersions, work: workItems })
    .from(workVersions)
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(and(eq(workVersions.id, versionId), isNull(workItems.deletedAt)))
    .limit(1);
  return row;
}

export async function getWorkVersionForUser(userId: number, versionId: number, mode: "read" | "write" = "read") {
  const row = await getVersion(versionId);
  if (!row) return undefined;
  const work = await assertWorkAccess(userId, row.work.id, mode);
  if (!work) return undefined;
  return { ...row.version, work };
}

async function activeOrganizationMember(userId: number, organizationId: number): Promise<MembershipRow | undefined> {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [membership] = await db
    .select({ membership: memberships })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.status, "active"),
      eq(organizations.status, "active"),
    ))
    .limit(1);
  return membership?.membership;
}

function canWriteOrganization(role: MembershipRow["role"]) {
  return role === "owner" || role === "admin" || role === "member";
}

function canReviewOrganization(role: MembershipRow["role"]) {
  return role === "reviewer" || role === "admin" || role === "owner";
}

// Hint reads only locate the scope. Authorization and mutable state are current
// locking reads after the scope lock, even at MySQL REPEATABLE READ isolation.
async function lockWorkAccess(tx: Transaction, userId: number, hint: typeof workItems.$inferSelect, mode: "read" | "write" | "review") {
  if (hint.ownerType === "organization") {
    if (!hint.ownerOrganizationId || !await lockActiveOrganization(tx, hint.ownerOrganizationId)) return undefined;
    const [membership] = await tx.select().from(memberships).where(and(
      eq(memberships.organizationId, hint.ownerOrganizationId), eq(memberships.userId, userId), eq(memberships.status, "active"),
    )).limit(1).for("update");
    if (!membership || (mode === "write" && !canWriteOrganization(membership.role)) || (mode === "review" && !canReviewOrganization(membership.role))) return undefined;
  } else {
    if (mode === "review") return undefined;
    const [user] = await tx.select({ id: users.id }).from(users).where(eq(users.id, userId)).limit(1).for("update");
    if (!user) return undefined;
  }
  const [work] = await tx.select().from(workItems).where(and(eq(workItems.id, hint.id), isNull(workItems.deletedAt))).limit(1).for("update");
  if (!work || work.ownerType !== hint.ownerType || work.ownerOrganizationId !== hint.ownerOrganizationId) return undefined;
  if (work.ownerType === "personal" && work.ownerUserId !== userId) return undefined;
  return work;
}

export async function listEligibleReviewersForUser(userId: number, organizationId: number) {
  const membership = await activeOrganizationMember(userId, organizationId);
  if (!membership) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select({ userId: memberships.userId, name: users.name, role: memberships.role })
    .from(memberships)
    .innerJoin(users, eq(memberships.userId, users.id))
    .where(and(
      eq(memberships.organizationId, organizationId),
      eq(memberships.status, "active"),
      inArray(memberships.role, ["reviewer", "admin", "owner"]),
    ))
    .orderBy(users.name);
}

export async function createReviewForUser(requestedByUserId: number, workVersionId: number, reviewerUserId: number) {
  if (requestedByUserId === reviewerUserId) throw new Error("Reviewer must be another user");
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const reviewId = await db.transaction(async tx => {
    const [row] = await tx
      .select({ version: workVersions, work: workItems })
      .from(workVersions)
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
      .where(and(eq(workVersions.id, workVersionId), isNull(workItems.deletedAt)))
      .limit(1);
    if (!row) return undefined;
    if (row.work.ownerType !== "organization" || !row.work.ownerOrganizationId) {
      throw new Error("Review requires organization-owned work");
    }
    const work = await lockWorkAccess(tx, requestedByUserId, row.work, "write");
    if (!work || !work.ownerOrganizationId) return undefined;
    row.work = work;
    if (row.work.status === "archived") throw new ReviewConflictError("Archived work cannot be reviewed");
    if (row.version.versionNumber !== row.work.currentVersionNumber) {
      throw new ReviewConflictError("Only the current work version can be submitted for review");
    }

    const [reviewerMembership] = await tx
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.userId, reviewerUserId),
        eq(memberships.organizationId, work.ownerOrganizationId),
        eq(memberships.status, "active"),
      ))
      .limit(1).for("update");
    if (!reviewerMembership || !canReviewOrganization(reviewerMembership.role)) {
      throw new Error("Reviewer is not eligible for organization review");
    }

    const [pendingReview] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.workVersionId, workVersionId), eq(reviews.status, "pending")))
      .limit(1).for("update");
    if (pendingReview) throw new ReviewConflictError("A pending review already exists for this version");

    const inserted = await tx.insert(reviews).values({
      workVersionId,
      requestedByUserId,
      reviewerUserId,
      status: "pending",
    });
    const updatedWork = await tx
      .update(workItems)
      .set({ status: "in_review" })
      .where(and(
        eq(workItems.id, row.work.id),
        eq(workItems.currentVersionNumber, row.version.versionNumber),
        inArray(workItems.status, ["draft", "in_review"]),
        isNull(workItems.deletedAt),
      ));
    if (getAffectedRows(updatedWork) !== 1) throw new ReviewConflictError("Work changed while review was being requested");
    await tx.insert(notifications).values({
      userId: reviewerUserId,
      type: "review_requested",
      dedupeKey: `review:${inserted[0].insertId}:requested`,
      title: "تقرير جديد بانتظار مراجعتك",
      body: `${row.work.title} — نسخة ${row.version.versionNumber}`,
      targetType: "review",
      targetId: String(inserted[0].insertId),
    });
    return Number(inserted[0].insertId);
  });

  return reviewId ? getReviewForUser(requestedByUserId, reviewId) : undefined;
}

export async function getReviewForUser(userId: number, reviewId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ review: reviews, version: workVersions, work: workItems })
    .from(reviews)
    .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(and(eq(reviews.id, reviewId), isNull(workItems.deletedAt)))
    .limit(1);
  if (!row) return undefined;
  const work = await assertWorkAccess(userId, row.work.id, "read");
  if (!work) return undefined;

  let actorOrgRole: MembershipRow["role"] | null = null;
  if (row.work.ownerType === "organization" && row.work.ownerOrganizationId) {
    const member = await activeOrganizationMember(userId, row.work.ownerOrganizationId);
    actorOrgRole = member?.role ?? null;
  }
  const isParticipant = row.review.requestedByUserId === userId || row.review.reviewerUserId === userId;
  const isSchoolAdmin = actorOrgRole === "owner" || actorOrgRole === "admin";
  if (!isParticipant && !isSchoolAdmin) return undefined;

  const canReassign =
    row.review.status === "pending" &&
    row.work.ownerType === "organization" &&
    Boolean(row.work.ownerOrganizationId) &&
    (isSchoolAdmin || (row.review.requestedByUserId === userId && actorOrgRole !== null && canWriteOrganization(actorOrgRole)));

  const comments = await db.select().from(reviewComments).where(eq(reviewComments.reviewId, reviewId)).orderBy(reviewComments.createdAt);
  return {
    ...row.review,
    versionNumber: row.version.versionNumber,
    versionCreatedByUserId: row.version.createdByUserId,
    workId: row.work.id,
    workTitle: row.work.title,
    ownerOrganizationId: row.work.ownerOrganizationId,
    canReassign,
    comments,
    report: projectReportSnapshot(row.version.snapshot),
  };
}

export async function listReviewsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];

  const adminOrgs = await db
    .select({ organizationId: memberships.organizationId })
    .from(memberships)
    .innerJoin(organizations, eq(organizations.id, memberships.organizationId))
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.status, "active"),
      eq(organizations.status, "active"),
      inArray(memberships.role, ["owner", "admin"]),
    ));
  const adminOrgIds = adminOrgs.map(item => item.organizationId);

  const scopeFilter = adminOrgIds.length > 0
    ? or(
      eq(reviews.requestedByUserId, userId),
      eq(reviews.reviewerUserId, userId),
      and(eq(workItems.ownerType, "organization"), inArray(workItems.ownerOrganizationId, adminOrgIds)),
    )
    : or(eq(reviews.requestedByUserId, userId), eq(reviews.reviewerUserId, userId));

  const candidates = await db
    .select({ review: reviews, version: workVersions, work: workItems })
    .from(reviews)
    .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(and(isNull(workItems.deletedAt), scopeFilter))
    .orderBy(desc(reviews.updatedAt));

  const visible = [];
  for (const row of candidates) {
    if (await assertWorkAccess(userId, row.work.id, "read")) {
      visible.push({
        ...row.review,
        versionNumber: row.version.versionNumber,
        workId: row.work.id,
        workTitle: row.work.title,
        ownerOrganizationId: row.work.ownerOrganizationId,
      });
    }
  }
  return visible;
}

export function evaluateReviewReassignEligibility(input: {
  reviewStatus: string;
  actorUserId: number;
  actorOrgRole: string | null;
  requestedByUserId: number;
  versionCreatorUserId: number;
  currentReviewerUserId: number;
  targetReviewerUserId: number;
  targetReviewerOrgRole: string | null;
  targetReviewerStatus: string | null;
}): { ok: true } | { ok: false; code: "forbidden" | "conflict" | "bad_request"; message: string } {
  if (input.reviewStatus !== "pending") {
    return { ok: false, code: "conflict", message: "لا يمكن إعادة تعيين المراجع إلا للمراجعات المعلقة بانتظار القرار" };
  }
  const isSchoolAdmin = input.actorOrgRole === "owner" || input.actorOrgRole === "admin";
  const isRequesterWriter =
    input.actorUserId === input.requestedByUserId &&
    (input.actorOrgRole === "owner" || input.actorOrgRole === "admin" || input.actorOrgRole === "member");
  if (!isSchoolAdmin && !isRequesterWriter) {
    return { ok: false, code: "forbidden", message: "لا تملك صلاحية إعادة تعيين المراجع لهذه النسخة" };
  }
  if (input.targetReviewerUserId === input.currentReviewerUserId) {
    return { ok: false, code: "bad_request", message: "المراجع المختار معيّن بالفعل لهذه المراجعة" };
  }
  if (
    input.targetReviewerUserId === input.requestedByUserId ||
    input.targetReviewerUserId === input.versionCreatorUserId
  ) {
    return { ok: false, code: "bad_request", message: "لا يجوز تعيين مُعدّ النسخة أو طالب المراجعة مراجعًا لنفس النسخة" };
  }
  if (
    input.targetReviewerStatus !== "active" ||
    !input.targetReviewerOrgRole ||
    !canReviewOrganization(input.targetReviewerOrgRole as MembershipRow["role"])
  ) {
    return { ok: false, code: "bad_request", message: "المراجع الجديد يجب أن يكون عضوًا نشطًا بدور مراجع أو مدير أو مالك في المدرسة" };
  }
  return { ok: true };
}

export async function reassignReviewForUser(actorUserId: number, reviewId: number, newReviewerUserId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const updatedId = await db.transaction(async tx => {
    const [row] = await tx
      .select({ review: reviews, version: workVersions, work: workItems })
      .from(reviews)
      .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
      .where(and(eq(reviews.id, reviewId), isNull(workItems.deletedAt)))
      .limit(1);
    if (!row || row.work.ownerType !== "organization" || !row.work.ownerOrganizationId) return undefined;

    const orgId = row.work.ownerOrganizationId;
    if (!await lockActiveOrganization(tx, orgId)) return undefined;

    const [actorMembership] = await tx
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.organizationId, orgId),
        eq(memberships.userId, actorUserId),
        eq(memberships.status, "active"),
      ))
      .limit(1)
      .for("update");
    if (!actorMembership) return undefined;

    const [lockedWork] = await tx
      .select()
      .from(workItems)
      .where(and(eq(workItems.id, row.work.id), isNull(workItems.deletedAt)))
      .limit(1)
      .for("update");
    if (!lockedWork || lockedWork.status === "archived") {
      throw new ReviewConflictError("لا يمكن تعديل مراجعة لعمل مؤرشف");
    }

    const [lockedReview] = await tx
      .select()
      .from(reviews)
      .where(eq(reviews.id, reviewId))
      .limit(1)
      .for("update");
    if (!lockedReview) return undefined;

    const [targetMembership] = await tx
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.organizationId, orgId),
        eq(memberships.userId, newReviewerUserId),
      ))
      .limit(1)
      .for("update");

    const check = evaluateReviewReassignEligibility({
      reviewStatus: lockedReview.status,
      actorUserId,
      actorOrgRole: actorMembership.role,
      requestedByUserId: lockedReview.requestedByUserId,
      versionCreatorUserId: row.version.createdByUserId,
      currentReviewerUserId: lockedReview.reviewerUserId,
      targetReviewerUserId: newReviewerUserId,
      targetReviewerOrgRole: targetMembership?.role ?? null,
      targetReviewerStatus: targetMembership?.status ?? null,
    });
    if (!check.ok) {
      if (check.code === "forbidden") return undefined;
      if (check.code === "conflict") throw new ReviewConflictError(check.message);
      throw new Error(`REASSIGN_INVALID:${check.message}`);
    }

    const [duplicateOnVersion] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(
        eq(reviews.workVersionId, lockedReview.workVersionId),
        eq(reviews.reviewerUserId, newReviewerUserId),
      ))
      .limit(1)
      .for("update");
    if (duplicateOnVersion && duplicateOnVersion.id !== reviewId) {
      throw new ReviewConflictError("سبق تسجيل مراجعة لهذا العضو على نفس النسخة؛ اختر مراجعًا آخر أو أنشئ نسخة محدثة");
    }

    const updatedReview = await tx
      .update(reviews)
      .set({ reviewerUserId: newReviewerUserId })
      .where(and(eq(reviews.id, reviewId), eq(reviews.status, "pending")));
    if (getAffectedRows(updatedReview) !== 1) {
      throw new ReviewConflictError("تغيرت حالة المراجعة أثناء إعادة التعيين");
    }

    await tx.insert(notifications).values({
      userId: newReviewerUserId,
      type: "review_requested",
      dedupeKey: `review:${reviewId}:reassigned:${newReviewerUserId}:${Date.now()}`,
      title: "تم تفويضك لمراجعة نسخة عمل مدرسي",
      body: `${lockedWork.title} — نسخة ${row.version.versionNumber}`,
      targetType: "review",
      targetId: String(reviewId),
    });

    return reviewId;
  });

  return updatedId ? getReviewForUser(actorUserId, updatedId) : undefined;
}

export async function addReviewCommentForUser(userId: number, reviewId: number, content: string, anchor?: Record<string, unknown>) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const [hint] = await tx.select({ work: workItems }).from(reviews)
      .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id)).where(eq(reviews.id, reviewId)).limit(1);
    if (!hint || !await lockWorkAccess(tx, userId, hint.work, "read")) return undefined;
    const [review] = await tx.select().from(reviews).where(and(eq(reviews.id, reviewId),
      or(eq(reviews.requestedByUserId, userId), eq(reviews.reviewerUserId, userId)),
    )).limit(1).for("update");
    if (!review) return undefined;
    const result = await tx.insert(reviewComments).values({ reviewId, userId, content, anchor: anchor ?? null });
    return { id: Number(result[0].insertId) };
  });
}

export async function decideReviewForUser(userId: number, reviewId: number, decision: "approved" | "changes_requested" | "rejected", decisionNote?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const decidedId = await db.transaction(async tx => {
    const [row] = await tx
      .select({ review: reviews, version: workVersions, work: workItems })
      .from(reviews)
      .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
      .where(and(eq(reviews.id, reviewId), eq(reviews.reviewerUserId, userId), isNull(workItems.deletedAt)))
      .limit(1);
    if (!row) return undefined;
    const work = await lockWorkAccess(tx, userId, row.work, "review");
    if (!work) return undefined;
    row.work = work;
    const [review] = await tx.select().from(reviews).where(and(eq(reviews.id, reviewId), eq(reviews.reviewerUserId, userId))).limit(1).for("update");
    if (!review) return undefined;
    row.review = review;
    if (review.status !== "pending") throw new ReviewConflictError("Review is already decided");

    const updatedReview = await tx
      .update(reviews)
      .set({ status: decision, decisionNote: decisionNote ?? null, decidedAt: new Date() })
      .where(and(
        eq(reviews.id, reviewId),
        eq(reviews.reviewerUserId, userId),
        eq(reviews.status, "pending"),
      ));
    if (getAffectedRows(updatedReview) !== 1) throw new ReviewConflictError("Review was decided by another request");

    if (row.version.versionNumber === row.work.currentVersionNumber) {
      const updatedWork = await tx
        .update(workItems)
        .set({ status: decision === "approved" ? "approved" : "draft" })
        .where(and(
          eq(workItems.id, row.work.id),
          eq(workItems.currentVersionNumber, row.version.versionNumber),
          eq(workItems.status, "in_review"),
          isNull(workItems.deletedAt),
        ));
      if (getAffectedRows(updatedWork) !== 1) throw new ReviewConflictError("Current work state changed while review was being decided");
    }

    await tx.insert(notifications).values({
      userId: row.review.requestedByUserId,
      type: "review_decided",
      dedupeKey: `review:${reviewId}:decided`,
      title: decision === "approved" ? "تم اعتماد التقرير" : decision === "changes_requested" ? "التقرير يحتاج تعديلات" : "لم يعتمد التقرير",
      body: `${row.work.title} — نسخة ${row.version.versionNumber}`,
      targetType: "review",
      targetId: String(reviewId),
    });
    return reviewId;
  });

  return decidedId ? getReviewForUser(userId, decidedId) : undefined;
}

export async function createOutputForUser(userId: number, input: {
  workVersionId: number;
  type: "pdf" | "link" | "qr" | "docx";
  visibility?: "private" | "protected" | "public";
  token?: string;
  passwordHash?: string;
  storageKey?: string;
  expiresAt?: Date;
}) {
  const visibility = input.visibility === undefined ? "private" : input.visibility;
  validateOutputContract({ ...input, visibility });
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  const outputId = await db.transaction(async tx => {
    const [row] = await tx
      .select({ version: workVersions, work: workItems })
      .from(workVersions)
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
      .where(and(eq(workVersions.id, input.workVersionId), isNull(workItems.deletedAt)))
      .limit(1);
    if (!row) return undefined;

    if (!await lockWorkAccess(tx, userId, row.work, "write")) return undefined;

    if (visibility !== "private") {
      const [approvedReview] = await tx
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(eq(reviews.workVersionId, input.workVersionId), eq(reviews.status, "approved")))
        .limit(1).for("update");
      if (!approvedReview) throw new OutputValidationError("Shared outputs require an approved review for this exact version");
    }

    const inserted = await tx.insert(outputs).values({
      workVersionId: input.workVersionId,
      createdByUserId: userId,
      type: input.type,
      visibility,
      token: input.token ?? null,
      passwordHash: input.passwordHash ?? null,
      storageKey: input.storageKey ?? null,
      expiresAt: input.expiresAt ?? null,
    });
    const id = Number(inserted[0].insertId);
    if (visibility !== "private") {
      await tx.insert(auditLogs).values({
        actorUserId: userId,
        action: "output.share_created",
        resourceType: "output",
        resourceId: String(id),
        metadata: shareAuditMetadata({
          outputId: id,
          workVersionId: input.workVersionId,
          versionNumber: row.version.versionNumber,
          type: input.type,
          visibility,
          expiresAt: input.expiresAt ?? null,
          context: "create",
        }),
      });
    }
    return id;
  });

  return outputId ? getPublicationReceiptForUser(userId, outputId) : undefined;
}

/**
 * The database row contains bearer material and private storage coordinates.
 * Keep the full row behind this explicitly internal helper; callers serving
 * read/list RPCs must use getOutputForUser/listOutputsForWorkForUser below.
 */
export async function getOutputRecordForUser(userId: number, outputId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ output: outputs, version: workVersions, work: workItems })
    .from(outputs)
    .innerJoin(workVersions, eq(outputs.workVersionId, workVersions.id))
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(eq(outputs.id, outputId))
    .limit(1);
  if (!row || !(await assertWorkAccess(userId, row.work.id, "read"))) return undefined;
  return { ...row.output, versionNumber: row.version.versionNumber, workId: row.work.id, workTitle: row.work.title };
}

type OutputRecord = NonNullable<Awaited<ReturnType<typeof getOutputRecordForUser>>>;

/** Safe output projection for protected reader/list callers. Never expose bearer material or private coordinates. */
function projectOutputForUser(row: OutputRecord, userId: number) {
  return {
    id: row.id, workVersionId: row.workVersionId, versionNumber: row.versionNumber,
    workId: row.workId, workTitle: row.workTitle, type: row.type, visibility: row.visibility,
    createdByUserId: row.createdByUserId, createdAt: row.createdAt,
    expiresAt: row.expiresAt, revokedAt: row.revokedAt,
  };
}

export async function getOutputForUser(userId: number, outputId: number) {
  const row = await getOutputRecordForUser(userId, outputId);
  return row ? projectOutputForUser(row, userId) : undefined;
}

/**
 * Publication creation/management receipt, never used by reader/list RPCs:
 * only the creator who still has write access may receive a share bearer.
 */
export async function getPublicationReceiptForUser(userId: number, outputId: number) {
  const row = await getOutputRecordForUser(userId, outputId);
  if (!row || row.createdByUserId !== userId || !(await assertWorkAccess(userId, row.workId, "write"))) return undefined;
  return {
    ...projectOutputForUser(row, userId),
    token: row.visibility === "private" ? null : row.token,
  };
}

export async function listOutputsForWorkForUser(userId: number, workItemId: number) {
  if (!(await assertWorkAccess(userId, workItemId, "read"))) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const rows = await db
    .select({ output: outputs, versionNumber: workVersions.versionNumber })
    .from(outputs)
    .innerJoin(workVersions, eq(outputs.workVersionId, workVersions.id))
    .where(eq(workVersions.workItemId, workItemId))
    .orderBy(desc(outputs.createdAt));
  return rows.map(row => projectOutputForUser({ ...row.output, versionNumber: row.versionNumber, workId: workItemId, workTitle: "" }, userId));
}

export async function revokeOutputForUser(userId: number, outputId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db.transaction(async tx => {
    const [hint] = await tx.select({ work: workItems, version: workVersions }).from(outputs)
      .innerJoin(workVersions, eq(outputs.workVersionId, workVersions.id))
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id)).where(eq(outputs.id, outputId)).limit(1);
    if (!hint || !await lockWorkAccess(tx, userId, hint.work, "write")) return false;
    const [output] = await tx.select().from(outputs).where(eq(outputs.id, outputId)).limit(1).for("update");
    if (!output) return false;
    if (!output.revokedAt) {
      await tx.update(outputs).set({ revokedAt: new Date() }).where(eq(outputs.id, outputId));
      if (output.visibility !== "private") {
        await tx.insert(auditLogs).values({
          actorUserId: userId,
          action: "output.share_revoked",
          resourceType: "output",
          resourceId: String(output.id),
          metadata: shareAuditMetadata({
            outputId: output.id,
            workVersionId: output.workVersionId,
            versionNumber: hint.version.versionNumber,
            type: output.type,
            visibility: output.visibility,
            expiresAt: output.expiresAt,
            context: "revoke",
          }),
        });
      }
    }
    return true;
  });
}
