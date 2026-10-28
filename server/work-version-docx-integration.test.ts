import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { and, eq, inArray, sql } from "drizzle-orm";
import JSZip from "jszip";
import { users } from "../drizzle/schema";
import { contentBlocks, memberships, notifications, organizations, outputs, reviewComments, reviews, workAssetLinks, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { createWorkItemForUser, createWorkVersionForUser } from "./domain-db";
import { createReportDraftVersionForUser, saveReportDraftForUser } from "./work-report-draft-db";
import { addReviewCommentForUser, createOutputForUser, createReviewForUser, decideReviewForUser, getOutputForUser, revokeOutputForUser } from "./review-output-db";
import { renderReportWorkVersionDocx } from "./work-version-docx-renderer";
import { generatePrivateDocxForWorkVersion, generatePrivatePdfForWorkVersion, getPrivateDocxDownloadForUser, getPrivatePdfDownloadForUser } from "./work-version-output-service";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("immutable editable WorkVersion DOCX on disposable MySQL", () => {
  let owner = 0, outsider = 0, reviewer = 0, school = 0;
  const actorIds: number[] = [], workIds: number[] = [], versionIds: number[] = [];
  const blobs = new Map<string, Buffer>();
  const storage = {
    putStorage: vi.fn(async (key: string, data: string | Buffer | Uint8Array) => { blobs.set(key, Buffer.from(data)); return { key, url: `upload://${key}` }; }),
    getStorage: vi.fn(async (key: string) => ({ key, url: `https://signed.example/${encodeURIComponent(key)}` })),
  };
  const dependencies = { ...storage, renderDocx: renderReportWorkVersionDocx };
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("DOCX integration requires disposable CI database");
    const db = (await getDb())!;
    const [raw] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    const row = (raw as unknown as { name: string; version: string }[])[0];
    expect(row.name).toBe("sers_test"); expect(row.version).toMatch(/^8\.4\./);
    for (const role of ["owner", "outsider", "reviewer"]) {
      const [created] = await db.insert(users).values({ openId: `docx-${role}-${randomUUID()}` }); actorIds.push(Number(created.insertId));
    }
    [owner, outsider, reviewer] = actorIds;
    const [created] = await db.insert(organizations).values({ name: `docx-school-${randomUUID()}` }); school = Number(created.insertId);
    await db.insert(memberships).values([{ userId: owner, organizationId: school, role: "owner", status: "active" }, { userId: reviewer, organizationId: school, role: "reviewer", status: "active" }]);
  });
  afterAll(async () => {
    if (!actorIds.length) return;
    const db = (await getDb())!;
    if (versionIds.length) {
      const reviewRows = await db.select({ id: reviews.id }).from(reviews).where(inArray(reviews.workVersionId, versionIds));
      if (reviewRows.length) await db.delete(reviewComments).where(inArray(reviewComments.reviewId, reviewRows.map(row => row.id)));
      await db.delete(reviews).where(inArray(reviews.workVersionId, versionIds));
      await db.delete(outputs).where(inArray(outputs.workVersionId, versionIds));
    }
    if (workIds.length) {
      await db.delete(workAssetLinks).where(inArray(workAssetLinks.workItemId, workIds));
      await db.delete(workVersions).where(inArray(workVersions.workItemId, workIds));
      await db.delete(contentBlocks).where(inArray(contentBlocks.workItemId, workIds));
      await db.delete(workItems).where(inArray(workItems.id, workIds));
    }
    await db.delete(notifications).where(inArray(notifications.userId, actorIds));
    if (school) { await db.delete(memberships).where(eq(memberships.organizationId, school)); await db.delete(organizations).where(eq(organizations.id, school)); }
    await db.delete(users).where(inArray(users.id, actorIds));
  });
  async function version(organization = false) {
    const work = (await createWorkItemForUser(owner, { title: "تقرير ثابت قابل للتحرير", type: "report", ...(organization ? { ownerType: "organization" as const, organizationId: school } : {}) }))!;
    workIds.push(work.id);
    const draft = await saveReportDraftForUser(owner, { workItemId: work.id, expectedRevision: 0, templateId: "custom", themeId: "formal", fontFamily: "Arial", fields: { summary: "محتوى مثبت قبل التعديل", objectives: "قياس التحسن في القراءة" }, evidenceAssetIds: [] });
    const frozen = await createReportDraftVersionForUser(owner, { workItemId: work.id, expectedRevision: draft.revision });
    versionIds.push(frozen.id); return { work, frozen, draft };
  }

  it("exports editable content once and reuses the same artifact after the live draft changes", async () => {
    const { work, frozen, draft } = await version();
    const first = (await generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies))!;
    expect(first).toMatchObject({ type: "docx", versionNumber: 1, reused: false });
    expect(first.filename).toMatch(/\.docx$/);
    const buffer = blobs.get(first.storageKey)!;
    const zip = await JSZip.loadAsync(buffer);
    expect(await zip.file("word/document.xml")!.async("string")).toContain("محتوى مثبت قبل التعديل");
    await saveReportDraftForUser(owner, { workItemId: work.id, expectedRevision: draft.revision, templateId: "custom", themeId: "formal", fontFamily: "Arial", fields: { summary: "مسودة جديدة لا تدخل النسخة السابقة" }, evidenceAssetIds: [] });
    const second = (await generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies))!;
    expect(second).toMatchObject({ outputId: first.outputId, contentHash: first.contentHash, storageKey: first.storageKey, reused: true });
    expect(blobs.get(second.storageKey)).toEqual(buffer);
  });

  it("deduplicates concurrent DOCX requests and keeps PDF and Word artifacts distinct", async () => {
    const { frozen } = await version();
    const [a, b] = await Promise.all([generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies), generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies)]);
    expect(a!.outputId).toBe(b!.outputId); expect(a!.storageKey).toBe(b!.storageKey);
    const pdf = (await generatePrivatePdfForWorkVersion(owner, frozen.id, { ...storage, renderPdf: async () => Buffer.from("%PDF-1.4\ntest\n%%EOF") }))!;
    expect(pdf.outputId).not.toBe(a!.outputId);
    const db = (await getDb())!;
    expect((await db.select().from(outputs).where(eq(outputs.workVersionId, frozen.id))).map(row => row.type).sort()).toEqual(["docx", "pdf"]);
    await expect(getPrivateDocxDownloadForUser(owner, pdf.outputId, storage)).rejects.toThrow(/Private artifact/);
    await expect(getPrivatePdfDownloadForUser(owner, a!.outputId, storage)).rejects.toThrow(/Private artifact/);
  });

  it("does not render for outsiders and blocks revoked, expired and deleted work downloads", async () => {
    const { frozen, work } = await version();
    const renderDocx = vi.fn(renderReportWorkVersionDocx);
    expect(await generatePrivateDocxForWorkVersion(outsider, frozen.id, { ...storage, renderDocx })).toBeUndefined();
    expect(renderDocx).not.toHaveBeenCalled();
    const artifact = (await generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies))!;
    expect(await getPrivateDocxDownloadForUser(outsider, artifact.outputId, storage)).toBeUndefined();
    const db = (await getDb())!;
    await db.update(outputs).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(outputs.id, artifact.outputId));
    await expect(getPrivateDocxDownloadForUser(owner, artifact.outputId, storage)).rejects.toThrow(/expired/);
    await db.update(outputs).set({ expiresAt: null }).where(eq(outputs.id, artifact.outputId));
    await revokeOutputForUser(owner, artifact.outputId);
    await expect(getPrivateDocxDownloadForUser(owner, artifact.outputId, storage)).rejects.toThrow(/revoked/);
    await expect(generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies)).rejects.toThrow(/revoked/);
    await db.update(workItems).set({ deletedAt: new Date() }).where(eq(workItems.id, work.id));
    expect(await getPrivateDocxDownloadForUser(owner, artifact.outputId, storage)).toBeUndefined();
    await expect(createOutputForUser(owner, { workVersionId: frozen.id, type: "docx", visibility: "public" })).rejects.toThrow(/private/);
  });

  it("enforces membership revocation and archived school state across output and review mutations", async () => {
    const { frozen } = await version(true);
    const artifact = (await generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies))!;
    const db = (await getDb())!;
    await db.update(memberships).set({ status: "suspended" }).where(and(eq(memberships.userId, owner), eq(memberships.organizationId, school)));
    expect(await getPrivateDocxDownloadForUser(owner, artifact.outputId, storage)).toBeUndefined();
    expect(await generatePrivateDocxForWorkVersion(owner, frozen.id, dependencies)).toBeUndefined();
    await db.update(memberships).set({ status: "active" }).where(and(eq(memberships.userId, owner), eq(memberships.organizationId, school)));
    await db.update(organizations).set({ status: "archived" }).where(eq(organizations.id, school));
    expect(await createReviewForUser(owner, frozen.id, reviewer)).toBeUndefined();
    expect(await createOutputForUser(owner, { workVersionId: frozen.id, type: "docx", storageKey: "test.docx" })).toBeUndefined();
    await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, school));
  });

  it.each(["report", "generic"] as const)("starts a new review after approving version one through the %s version creator", async creator => {
    const { work, frozen, draft } = await version(true);
    const db = (await getDb())!;
    const [original] = await db.select().from(workVersions).where(eq(workVersions.id, frozen.id));
    const firstReview = (await createReviewForUser(owner, frozen.id, reviewer))!;
    await decideReviewForUser(reviewer, firstReview.id, "approved");
    const sharedFirst = (await createOutputForUser(owner, { workVersionId: frozen.id, type: "link", visibility: "public", token: randomUUID() }))!;
    expect((await db.select().from(workItems).where(eq(workItems.id, work.id)))[0]).toMatchObject({ status: "approved", currentVersionNumber: 1 });
    const nextDraft = await saveReportDraftForUser(owner, { workItemId: work.id, expectedRevision: draft.revision, templateId: "custom", themeId: "formal", fontFamily: "Arial", fields: { summary: "محتوى النسخة الثانية قيد المراجعة" }, evidenceAssetIds: [] });
    const createNext = () => creator === "report"
      ? createReportDraftVersionForUser(owner, { workItemId: work.id, expectedRevision: nextDraft.revision })
      : createWorkVersionForUser(owner, work.id, { ...(original.snapshot as Record<string, unknown>), reportDraft: nextDraft });
    const second = (await createNext())!;
    versionIds.push(second.id);
    expect(second.versionNumber).toBe(2);
    expect((await db.select().from(workItems).where(eq(workItems.id, work.id)))[0]).toMatchObject({ status: "draft", currentVersionNumber: 2 });
    expect((await db.select().from(workVersions).where(eq(workVersions.id, frozen.id)))[0].snapshot).toEqual(original.snapshot);
    expect(await getOutputForUser(owner, sharedFirst.id)).toMatchObject({ workVersionId: frozen.id, revokedAt: null });
    await expect(createOutputForUser(owner, { workVersionId: second.id, type: "link", visibility: "public", token: randomUUID() })).rejects.toThrow(/approved review/);
    const secondReview = (await createReviewForUser(owner, second.id, reviewer))!;
    expect((await db.select().from(workItems).where(eq(workItems.id, work.id)))[0]).toMatchObject({ status: "in_review", currentVersionNumber: 2 });
    await decideReviewForUser(reviewer, secondReview.id, "approved");
    expect((await db.select().from(workItems).where(eq(workItems.id, work.id)))[0]).toMatchObject({ status: "approved", currentVersionNumber: 2 });
    expect(await db.select().from(reviews).where(inArray(reviews.id, [firstReview.id, secondReview.id]))).toMatchObject([{ status: "approved" }, { status: "approved" }]);
    expect(await createOutputForUser(owner, { workVersionId: second.id, type: "link", visibility: "public", token: randomUUID() })).toMatchObject({ workVersionId: second.id });
    // Creating a new version must not become an implicit unarchive operation.
    await db.update(workItems).set({ status: "archived" }).where(eq(workItems.id, work.id));
    await expect(createNext()).rejects.toThrow();
    expect((await db.select().from(workItems).where(eq(workItems.id, work.id)))[0]).toMatchObject({ status: "archived", currentVersionNumber: 2 });
  });

  it("rechecks current membership after waiting on the organization lock", async () => {
    const { frozen } = await version(true);
    const review = (await createReviewForUser(owner, frozen.id, reviewer))!;
    const artifact = (await createOutputForUser(owner, { workVersionId: frozen.id, type: "docx", storageKey: "race.docx" }))!;
    const db = (await getDb())!;
    async function suspendWhileWaiting<T>(userId: number, action: () => Promise<T>) {
      let pending: Promise<T> | undefined;
      try {
        await db.transaction(async tx => {
          await tx.select({ id: organizations.id }).from(organizations).where(eq(organizations.id, school)).for("update");
          pending = action();
          // Observe the actual InnoDB waiter, ensuring its hint read occurred
          // before revocation commits; no timing-only concurrency assertion.
          let waiting = false;
          for (let attempt = 0; attempt < 200; attempt++) {
            const [raw] = await db.execute(sql`SELECT COUNT(*) AS count FROM performance_schema.data_lock_waits w JOIN performance_schema.data_locks l ON l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID WHERE l.OBJECT_SCHEMA = 'sers_test' AND l.OBJECT_NAME = 'organizations' AND l.INDEX_NAME = 'PRIMARY' AND l.LOCK_DATA = ${String(school)}`);
            if (Number((raw as unknown as { count: number }[])[0].count) > 0) { waiting = true; break; }
            await new Promise(resolve => setTimeout(resolve, 10));
          }
          expect(waiting).toBe(true);
          await tx.update(memberships).set({ status: "suspended" }).where(and(eq(memberships.userId, userId), eq(memberships.organizationId, school)));
        });
        return await pending!;
      } finally {
        if (pending) await pending.catch(() => undefined);
        await db.update(memberships).set({ status: "active" }).where(and(eq(memberships.userId, userId), eq(memberships.organizationId, school)));
      }
    }
    expect(await suspendWhileWaiting(owner, () => createReviewForUser(owner, frozen.id, reviewer))).toBeUndefined();
    expect(await suspendWhileWaiting(owner, () => createOutputForUser(owner, { workVersionId: frozen.id, type: "docx", storageKey: "denied.docx" }))).toBeUndefined();
    expect(await suspendWhileWaiting(reviewer, () => decideReviewForUser(reviewer, review.id, "approved"))).toBeUndefined();
    expect(await suspendWhileWaiting(reviewer, () => addReviewCommentForUser(reviewer, review.id, "must not persist"))).toBeUndefined();
    expect(await suspendWhileWaiting(owner, () => revokeOutputForUser(owner, artifact.id))).toBe(false);
    expect((await db.select().from(outputs).where(eq(outputs.id, artifact.id)))[0].revokedAt).toBeNull();
    expect((await db.select().from(reviews).where(eq(reviews.id, review.id)))[0].status).toBe("pending");
    expect(await db.select().from(reviewComments).where(eq(reviewComments.reviewId, review.id))).toHaveLength(0);
    expect(await db.select().from(outputs).where(and(eq(outputs.workVersionId, frozen.id), eq(outputs.storageKey, "denied.docx")))).toHaveLength(0);
  });

  it("persists review request/decision notifications atomically and blocks archived school decisions", async () => {
    const { frozen } = await version(true);
    const review = (await createReviewForUser(owner, frozen.id, reviewer))!;
    const db = (await getDb())!;
    expect(await db.select().from(notifications).where(eq(notifications.dedupeKey, `review:${review.id}:requested`))).toMatchObject([{ userId: reviewer, targetType: "review", targetId: String(review.id) }]);
    await db.update(organizations).set({ status: "archived" }).where(eq(organizations.id, school));
    expect(await decideReviewForUser(reviewer, review.id, "approved")).toBeUndefined();
    expect(await db.select().from(notifications).where(eq(notifications.dedupeKey, `review:${review.id}:decided`))).toHaveLength(0);
    await db.update(organizations).set({ status: "active" }).where(eq(organizations.id, school));
    await decideReviewForUser(reviewer, review.id, "approved");
    await expect(decideReviewForUser(reviewer, review.id, "approved")).rejects.toThrow(/already decided/);
    expect(await db.select().from(notifications).where(eq(notifications.dedupeKey, `review:${review.id}:decided`))).toMatchObject([{ userId: owner, targetType: "review", targetId: String(review.id) }]);
  });
});
