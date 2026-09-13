import { and, desc, eq, inArray, or } from "drizzle-orm";
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

async function getVersion(versionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ version: workVersions, work: workItems })
    .from(workVersions)
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(eq(workVersions.id, versionId))
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
  const version = await getWorkVersionForUser(requestedByUserId, workVersionId, "write");
  if (!version) return undefined;
  if (version.work.ownerType !== "organization" || !version.work.ownerOrganizationId) {
    throw new Error("Review requires organization-owned work");
  }
  const reviewerMembership = await activeOrganizationMember(reviewerUserId, version.work.ownerOrganizationId);
  if (!reviewerMembership || !canReviewOrganization(reviewerMembership.role)) {
    throw new Error("Reviewer is not eligible for organization review");
  }

  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(reviews).values({
    workVersionId,
    requestedByUserId,
    reviewerUserId,
    status: "pending",
  });
  await db.update(workItems).set({ status: "in_review" }).where(eq(workItems.id, version.work.id));
  return getReviewForUser(requestedByUserId, Number(result[0].insertId));
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
  const [row] = await db
    .select({ review: reviews, version: workVersions })
    .from(reviews)
    .innerJoin(workVersions, eq(reviews.workVersionId, workVersions.id))
    .where(and(eq(reviews.id, reviewId), eq(reviews.reviewerUserId, userId)))
    .limit(1);
  if (!row) return undefined;
  if (row.review.status !== "pending") throw new Error("Review is already decided");
  if (!(await assertWorkAccess(userId, row.version.workItemId, "read"))) return undefined;

  await db.transaction(async tx => {
    await tx.update(reviews).set({ status: decision, decisionNote: decisionNote ?? null, decidedAt: new Date() }).where(eq(reviews.id, reviewId));
    await tx.update(workItems).set({ status: decision === "approved" ? "approved" : "draft" }).where(eq(workItems.id, row.version.workItemId));
  });
  return getReviewForUser(userId, reviewId);
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
  const version = await getWorkVersionForUser(userId, input.workVersionId, "write");
  if (!version) return undefined;
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const result = await db.insert(outputs).values({
    workVersionId: input.workVersionId,
    createdByUserId: userId,
    type: input.type,
    visibility: input.visibility ?? "private",
    token: input.token ?? null,
    passwordHash: input.passwordHash ?? null,
    storageKey: input.storageKey ?? null,
    expiresAt: input.expiresAt ?? null,
  });
  return getOutputForUser(userId, Number(result[0].insertId));
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
  await db.update(outputs).set({ revokedAt: new Date() }).where(eq(outputs.id, outputId));
  return true;
}
