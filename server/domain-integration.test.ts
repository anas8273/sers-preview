import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import {
  assets,
  entitlements,
  memberships,
  notifications,
  organizations,
  outputs,
  purchases,
  reviewComments,
  reviews,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import {
  assertAssetAccess,
  assertWorkAccess,
  createAssetForUser,
  createWorkItemForUser,
  createWorkVersionForUser,
  getWorkItemForUser,
  linkAssetToWorkForUser,
  unlinkAssetFromWorkForUser,
} from "./domain-db";
import {
  createOutputForUser,
  createReviewForUser,
  decideReviewForUser,
  revokeOutputForUser,
} from "./review-output-db";
import { getDb } from "./db";

const integrationEnabled = process.env.SERS_INTEGRATION === "1";
const suite = integrationEnabled ? describe : describe.skip;

suite("SERS domain integration against real MySQL", () => {
  let ownerId = 0;
  let reviewerId = 0;
  let memberId = 0;
  let outsiderId = 0;
  let orgId = 0;
  let otherOrgId = 0;

  async function cleanDomainData() {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(reviewComments);
    await db.delete(reviews);
    await db.delete(outputs);
    await db.delete(workAssetLinks);
    await db.delete(workVersions);
    await db.delete(notifications);
    await db.delete(entitlements);
    await db.delete(purchases);
    await db.delete(assets);
    await db.delete(workItems);
    await db.delete(memberships);
    await db.delete(organizations);
    await db.delete(users);
  }

  async function createOrganizationWork(title: string) {
    return createWorkItemForUser(ownerId, {
      title,
      type: "report",
      ownerType: "organization",
      organizationId: orgId,
    });
  }

  async function setReviewerRole(role: "reviewer" | "member") {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.update(memberships).set({ role }).where(and(
      eq(memberships.organizationId, orgId),
      eq(memberships.userId, reviewerId),
    ));
  }

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await cleanDomainData();

    const insertedUsers = await Promise.all([
      db.insert(users).values({ openId: "integration-owner", name: "Owner" }),
      db.insert(users).values({ openId: "integration-reviewer", name: "Reviewer" }),
      db.insert(users).values({ openId: "integration-member", name: "Member" }),
      db.insert(users).values({ openId: "integration-outsider", name: "Outsider" }),
    ]);
    [ownerId, reviewerId, memberId, outsiderId] = insertedUsers.map(result => Number(result[0].insertId));

    const orgInsert = await db.insert(organizations).values({ name: "Integration School" });
    orgId = Number(orgInsert[0].insertId);
    const otherOrgInsert = await db.insert(organizations).values({ name: "Other School" });
    otherOrgId = Number(otherOrgInsert[0].insertId);

    await db.insert(memberships).values([
      { organizationId: orgId, userId: ownerId, role: "owner", status: "active" },
      { organizationId: orgId, userId: reviewerId, role: "reviewer", status: "active" },
      { organizationId: orgId, userId: memberId, role: "member", status: "active" },
      { organizationId: otherOrgId, userId: outsiderId, role: "owner", status: "active" },
    ]);
  });

  afterAll(async () => {
    if (integrationEnabled) await cleanDomainData();
  });

  it("isolates personal work from other users", async () => {
    const work = await createWorkItemForUser(ownerId, { title: "Personal Work", type: "report" });
    expect(work?.ownerUserId).toBe(ownerId);
    expect(await assertWorkAccess(outsiderId, work!.id, "read")).toBeUndefined();
    expect(await assertWorkAccess(outsiderId, work!.id, "write")).toBeUndefined();
  });

  it("enforces organization membership and separates reviewer write access", async () => {
    const work = await createOrganizationWork("School Work");
    expect(await assertWorkAccess(reviewerId, work!.id, "read")).toBeTruthy();
    expect(await assertWorkAccess(reviewerId, work!.id, "write")).toBeUndefined();
    expect(await assertWorkAccess(memberId, work!.id, "write")).toBeTruthy();
    expect(await assertWorkAccess(outsiderId, work!.id, "read")).toBeUndefined();
  });

  it("reuses one asset and unlinking does not delete the source", async () => {
    const work = await createWorkItemForUser(ownerId, {
      title: "Evidence Work",
      type: "portfolio",
      ownerType: "organization",
      organizationId: orgId,
    });
    const asset = await createAssetForUser(ownerId, {
      title: "Reusable Evidence",
      kind: "link",
      externalUrl: "https://example.com/evidence",
      ownerType: "organization",
      organizationId: orgId,
    });
    const linked = await linkAssetToWorkForUser(ownerId, { workItemId: work!.id, assetId: asset!.id });
    expect(linked?.success).toBe(true);
    expect((await getWorkItemForUser(ownerId, work!.id))?.assets).toHaveLength(1);

    expect(await unlinkAssetFromWorkForUser(ownerId, { workItemId: work!.id, assetId: asset!.id })).toBe(true);
    expect((await getWorkItemForUser(ownerId, work!.id))?.assets).toHaveLength(0);
    expect(await assertAssetAccess(ownerId, asset!.id, "read")).toBeTruthy();
  });

  it("rejects implicit evidence links across personal and organization ownership scopes", async () => {
    const work = await createOrganizationWork("Scoped Evidence Work");
    const personalAsset = await createAssetForUser(ownerId, {
      title: "Personal Evidence",
      kind: "text",
      metadata: { text: "Personal only" },
    });
    expect(await linkAssetToWorkForUser(ownerId, { workItemId: work!.id, assetId: personalAsset!.id })).toBeUndefined();
  });

  it("creates unique sequential versions under concurrent writers", async () => {
    const work = await createWorkItemForUser(ownerId, { title: "Concurrent Versions", type: "report" });
    const created = await Promise.all([
      createWorkVersionForUser(ownerId, work!.id, { writer: "A" }, "A"),
      createWorkVersionForUser(ownerId, work!.id, { writer: "B" }, "B"),
    ]);
    expect(created.map(version => version!.versionNumber).sort()).toEqual([1, 2]);

    const db = await getDb();
    const stored = await db!.select().from(workVersions).where(eq(workVersions.workItemId, work!.id));
    expect(stored.map(version => version.versionNumber).sort()).toEqual([1, 2]);
  });

  it("binds reviews to immutable current versions and rejects ordinary members as reviewers", async () => {
    const work = await createOrganizationWork("Review Work");
    const version = await createWorkVersionForUser(ownerId, work!.id, { title: work!.title, frozen: true }, "Ready for review");
    expect(version?.versionNumber).toBe(1);

    await expect(createReviewForUser(ownerId, version!.id, memberId)).rejects.toThrow(/eligible/i);
    const review = await createReviewForUser(ownerId, version!.id, reviewerId);
    expect(review?.workVersionId).toBe(version!.id);
    expect(review?.versionNumber).toBe(1);

    expect(await decideReviewForUser(ownerId, review!.id, "approved")).toBeUndefined();
    const decided = await decideReviewForUser(reviewerId, review!.id, "approved", "Approved integration review");
    expect(decided?.status).toBe("approved");

    const db = await getDb();
    const [storedVersion] = await db!.select().from(workVersions).where(eq(workVersions.id, version!.id)).limit(1);
    expect(storedVersion.snapshot).toMatchObject({ frozen: true });
  });

  it("rechecks reviewer membership at decision time", async () => {
    const work = await createOrganizationWork("Reviewer Revocation");
    const version = await createWorkVersionForUser(ownerId, work!.id, { frozen: true });
    const review = await createReviewForUser(ownerId, version!.id, reviewerId);

    await setReviewerRole("member");
    expect(await decideReviewForUser(reviewerId, review!.id, "approved")).toBeUndefined();

    const db = await getDb();
    const [storedReview] = await db!.select().from(reviews).where(eq(reviews.id, review!.id)).limit(1);
    expect(storedReview.status).toBe("pending");
    await setReviewerRole("reviewer");
  });

  it("lets only one concurrent decision win", async () => {
    const work = await createOrganizationWork("Concurrent Decision");
    const version = await createWorkVersionForUser(ownerId, work!.id, { frozen: true });
    const review = await createReviewForUser(ownerId, version!.id, reviewerId);

    const decisions = await Promise.allSettled([
      decideReviewForUser(reviewerId, review!.id, "approved", "first"),
      decideReviewForUser(reviewerId, review!.id, "rejected", "second"),
    ]);
    expect(decisions.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(decisions.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("does not let approval of an older version approve the current work", async () => {
    const work = await createOrganizationWork("Stale Review");
    const first = await createWorkVersionForUser(ownerId, work!.id, { revision: 1 });
    const review = await createReviewForUser(ownerId, first!.id, reviewerId);
    const second = await createWorkVersionForUser(ownerId, work!.id, { revision: 2 });
    expect(second?.versionNumber).toBe(2);

    const decided = await decideReviewForUser(reviewerId, review!.id, "approved");
    expect(decided?.status).toBe("approved");

    const db = await getDb();
    const [storedWork] = await db!.select().from(workItems).where(eq(workItems.id, work!.id)).limit(1);
    expect(storedWork.currentVersionNumber).toBe(2);
    expect(storedWork.status).not.toBe("approved");
    await expect(createReviewForUser(ownerId, first!.id, reviewerId)).rejects.toThrow(/current work version/i);
  });

  it("requires exact-version approval before shared output creation", async () => {
    const work = await createOrganizationWork("Shared Output");
    const version = await createWorkVersionForUser(ownerId, work!.id, { title: "Frozen shared output" });

    await expect(createOutputForUser(ownerId, {
      workVersionId: version!.id,
      type: "link",
      visibility: "public",
      token: "not-approved-yet",
    })).rejects.toThrow(/approved review/i);

    const privatePreview = await createOutputForUser(ownerId, {
      workVersionId: version!.id,
      type: "pdf",
      visibility: "private",
    });
    expect(privatePreview?.workVersionId).toBe(version!.id);

    const review = await createReviewForUser(ownerId, version!.id, reviewerId);
    await decideReviewForUser(reviewerId, review!.id, "approved");
    const shared = await createOutputForUser(ownerId, {
      workVersionId: version!.id,
      type: "link",
      visibility: "public",
      token: "approved-output-token",
      expiresAt: new Date(Date.now() + 60_000),
    });
    expect(shared?.visibility).toBe("public");
  });

  it("pins outputs to versions and revocation preserves work/version", async () => {
    const work = await createWorkItemForUser(ownerId, { title: "Output Work", type: "report" });
    const version = await createWorkVersionForUser(ownerId, work!.id, { title: "Frozen output source" }, "Publish");
    const output = await createOutputForUser(ownerId, {
      workVersionId: version!.id,
      type: "link",
      visibility: "private",
      token: "integration-output-token",
    });
    expect(output?.workVersionId).toBe(version!.id);
    expect(await revokeOutputForUser(ownerId, output!.id)).toBe(true);

    const db = await getDb();
    const [storedOutput] = await db!.select().from(outputs).where(eq(outputs.id, output!.id)).limit(1);
    const [storedWork] = await db!.select().from(workItems).where(eq(workItems.id, work!.id)).limit(1);
    const [storedVersion] = await db!.select().from(workVersions).where(eq(workVersions.id, version!.id)).limit(1);
    expect(storedOutput.revokedAt).toBeTruthy();
    expect(storedWork.id).toBe(work!.id);
    expect(storedVersion.id).toBe(version!.id);
  });
});
