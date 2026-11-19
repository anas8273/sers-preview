import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { contentBlocks, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { createWorkItemForUser } from "./domain-db";
import { createReportDraftVersionForUser, getReportDraftForUser, saveReportDraftForUser } from "./work-report-draft-db";
import { reviewSupportRouter } from "./review-support-router";
import { compareReportDraftToVersion } from "../shared/report-stale";
import { assertDisposableMySQL } from "../tests/fixtures/assert-disposable-mysql";
import { reportDraftSaveInput } from "../tests/fixtures/report-draft-contract";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("server-projected immutable report revision on isolated MySQL", () => {
  let userId = 0;
  let workId = 0;
  beforeAll(async () => {
    assertDisposableMySQL();
    const db = (await getDb())!;
    const [inserted] = await db.insert(users).values({ openId: `revision-${randomUUID()}`, name: "مستخدم اصطناعي" });
    userId = Number(inserted.insertId);
    workId = (await createWorkItemForUser(userId, { title: "تقرير مراجعة اصطناعي", type: "report" }))!.id;
  });
  afterAll(async () => {
    if (!workId) return;
    const db = (await getDb())!;
    await db.delete(workVersions).where(eq(workVersions.workItemId, workId));
    await db.delete(contentBlocks).where(eq(contentBlocks.workItemId, workId));
    await db.delete(workItems).where(eq(workItems.id, workId));
    await db.delete(users).where(eq(users.id, userId));
  });
  it("returns the frozen revision and distinguishes a subsequently changed draft", async () => {
    const db = (await getDb())!;
    const initial = (await getReportDraftForUser(userId, workId))!;
    const input = reportDraftSaveInput(initial.draft, { workItemId: workId, expectedRevision: initial.draft.revision, fields: {}, evidenceAssetIds: [] });
    const saved = await saveReportDraftForUser(userId, { ...input, fields: { summary: "النص الأصلي" } });
    const version = await createReportDraftVersionForUser(userId, { workItemId: workId, expectedRevision: saved.revision, reason: "اختبار المقارنة" });
    const [user] = await db.select().from(users).where(eq(users.id, userId));
    const caller = reviewSupportRouter.createCaller({ user, req: {} as any, res: {} as any });
    const projected = (await caller.versions({ workItemId: workId }))[0];
    expect(projected.id).toBe(version.id);
    expect(projected.reportRevision).toBe(saved.revision);
    expect(projected).not.toHaveProperty("snapshot");
    expect(compareReportDraftToVersion(saved.revision, projected)).toBe("fresh");
    const edited = await saveReportDraftForUser(userId, { ...input, expectedRevision: saved.revision, fields: { summary: "تعديل بعد النسخة" } });
    const unchanged = (await caller.versions({ workItemId: workId }))[0];
    expect(unchanged.reportRevision).toBe(saved.revision);
    expect(compareReportDraftToVersion(edited.revision, unchanged)).toBe("stale");
  });
});
