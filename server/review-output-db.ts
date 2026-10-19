import { and, desc, eq, inArray, isNull, or } from "drizzle-orm";
import {
  memberships,
  outputs,
  reviewComments,
  reviews,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { users } from "../drizzle/schema";
import { assertWorkAccess } from "./domain-db";
import { getDb } from "./db";

type MembershipRow = typeof memberships.$inferSelect;

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
    .select()
    .from(memberships)
    .where(and(
      eq(memberships.userId, userId),
      eq(memberships.organizationId, organizationId),
      eq(memberships.status, "active"),
    ))
    .limit(1);
  return membership;
}

function canWriteOrganization(role: MembershipRow["role"]) {
  return role === "owner" || role === "admin" || role === "member";
}

function canReviewOrganization(role: MembershipRow["role"]) {
  return role === "reviewer" || role === "admin" || role === "owner";
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
    if (row.work.status === "archived") throw new ReviewConflictError("Archived work cannot be reviewed");
    if (row.version.versionNumber !== row.work.currentVersionNumber) {
      throw new ReviewConflictError("Only the current work version can be submitted for review");
    }

    const [requesterMembership] = await tx
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.userId, requestedByUserId),
        eq(memberships.organizationId, row.work.ownerOrganizationId),
        eq(memberships.status, "active"),
      ))
      .limit(1);
    if (!requesterMembership || !canWriteOrganization(requesterMembership.role)) return undefined;

    const [reviewerMembership] = await tx
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.userId, reviewerUserId),
        eq(memberships.organizationId, row.work.ownerOrganizationId),
        eq(memberships.status, "active"),
      ))
      .limit(1);
    if (!reviewerMembership || !canReviewOrganization(reviewerMembership.role)) {
      throw new Error("Reviewer is not eligible for organization review");
    }

    const [pendingReview] = await tx
      .select({ id: reviews.id })
      .from(reviews)
      .where(and(eq(reviews.workVersionId, workVersionId), eq(reviews.status, "pending")))
      .limit(1);
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
    .where(and(
      eq(reviews.id, reviewId),
      or(eq(reviews.requestedByUserId, userId), eq(reviews.reviewerUserId, userId)),
    ))
    .limit(1);
  if (!row) return undefined;
  const work = await assertWorkAccess(userId, row.work.id, "read");
  if (!work) return undefined;
  const comments = await db.select().from(reviewComments).where(eq(reviewComments.reviewId, reviewId)).orderBy(reviewComments.createdAt);
  return { ...row.review, versionNumber: row.version.versionNumber, workId: row.work.id, workTitle: row.work.title, comments };
}

export async function listReviewsForUser(userId: number) {
  const db = await getDb();
  if (!db) return [];
  const candidates = await db
    .select({ review: reviews, version: workVersions, work: workItems })
    .from(reviews)
    .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(or(eq(reviews.requestedByUserId, userId), eq(reviews.reviewerUserId, userId)))
    .orderBy(desc(reviews.updatedAt));

  const visible = [];
  for (const row of candidates) {
    if (await assertWorkAccess(userId, row.work.id, "read")) {
      visible.push({ ...row.review, versionNumber: row.version.versionNumber, workId: row.work.id, workTitle: row.work.title });
    }
  }
  return visible;
}

export async function addReviewCommentForUser(userId: number, reviewId: number, content: string, anchor?: Record<string, unknown>) {
  const review = await getReviewForUser(userId, reviewId);
  if (!review) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviewComments).values({
    reviewId,
    userId,
    content,
    anchor: anchor ?? null,
  });
  return { id: Number(result[0].insertId) };
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
    if (row.review.status !== "pending") throw new ReviewConflictError("Review is already decided");
    if (row.work.ownerType !== "organization" || !row.work.ownerOrganizationId) return undefined;

    const [membership] = await tx
      .select()
      .from(memberships)
      .where(and(
        eq(memberships.userId, userId),
        eq(memberships.organizationId, row.work.ownerOrganizationId),
        eq(memberships.status, "active"),
      ))
      .limit(1);
    if (!membership || !canReviewOrganization(membership.role)) return undefined;

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

    return reviewId;
  });

  return decidedId ? getReviewForUser(userId, decidedId) : undefined;
}

export async function createOutputForUser(userId: number, input: {
  workVersionId: number;
  type: "pdf" | "link" | "qr";
  visibility?: "private" | "protected" | "public";
  token?: string;
  passwordHash?: string;
  storageKey?: string;
  expiresAt?: Date;
}) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const visibility = input.visibility ?? "private";

  if ((input.type === "link" || input.type === "qr") && !input.token) {
    throw new OutputValidationError("Link and QR outputs require a token");
  }
  if (visibility === "protected" && !input.passwordHash) {
    throw new OutputValidationError("Protected outputs require a password hash");
  }
  if (input.expiresAt && input.expiresAt.getTime() <= Date.now()) {
    throw new OutputValidationError("Output expiry must be in the future");
  }

  const outputId = await db.transaction(async tx => {
    const [row] = await tx
      .select({ version: workVersions, work: workItems })
      .from(workVersions)
      .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
      .where(and(eq(workVersions.id, input.workVersionId), isNull(workItems.deletedAt)))
      .limit(1);
    if (!row) return undefined;

    if (row.work.ownerType === "personal") {
      if (row.work.ownerUserId !== userId && row.work.creatorUserId !== userId) return undefined;
    } else {
      if (!row.work.ownerOrganizationId) return undefined;
      const [membership] = await tx
        .select()
        .from(memberships)
        .where(and(
          eq(memberships.userId, userId),
          eq(memberships.organizationId, row.work.ownerOrganizationId),
          eq(memberships.status, "active"),
        ))
        .limit(1);
      if (!membership || !canWriteOrganization(membership.role)) return undefined;
    }

    if (visibility !== "private") {
      const [approvedReview] = await tx
        .select({ id: reviews.id })
        .from(reviews)
        .where(and(eq(reviews.workVersionId, input.workVersionId), eq(reviews.status, "approved")))
        .limit(1);
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
    return Number(inserted[0].insertId);
  });

  return outputId ? getOutputForUser(userId, outputId) : undefined;
}

export async function getOutputForUser(userId: number, outputId: number) {
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

export async function listOutputsForWorkForUser(userId: number, workItemId: number) {
  if (!(await assertWorkAccess(userId, workItemId, "read"))) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  return db
    .select({ output: outputs, versionNumber: workVersions.versionNumber })
    .from(outputs)
    .innerJoin(workVersions, eq(outputs.workVersionId, workVersions.id))
    .where(eq(workVersions.workItemId, workItemId))
    .orderBy(desc(outputs.createdAt));
}

export async function revokeOutputForUser(userId: number, outputId: number) {
  const output = await getOutputForUser(userId, outputId);
  if (!output) return false;
  if (!(await assertWorkAccess(userId, output.workId, "write"))) return false;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  await db.update(outputs).set({ revokedAt: new Date() }).where(and(eq(outputs.id, outputId), isNull(outputs.revokedAt)));
  return true;
}
