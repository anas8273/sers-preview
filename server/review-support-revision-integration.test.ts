import { randomUUID } from "node:crypto";
import { eq } from "drizzle-orm";
import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { users } from "../drizzle/schema";
import { contentBlocks, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { createWorkItemForUser } from "./domain-db";
import { createReportDraftVersionForUser, saveReportDraftForUser } from "./work-report-draft-db";
import { reviewSupportRouter } from "./review-support-router";
import { compareReportDraftToVersion } from "../shared/report-stale";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("server-projected immutable report revision on isolated MySQL", () => {
  let userId = 0;
  let workId = 0;
  beforeAll(async () => {
    const dsn = new URL(process.env.DATABASE_URL ?? "mysql://invalid");
    const allowed = dsn.hostname === "127.0.0.1" && dsn.pathname === "/sers_test" && (
      (dsn.port === "3306" && process.env.GITHUB_ACTIONS === "true") ||
      (dsn.port === "3307" && process.env.SERS_DISPOSABLE_LOCAL_MYSQL === "1")
    );
    if (!allowed) throw new Error("Refusing a non-disposable report revision database");
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
    const input = { workItemId: workId, templateId: "custom", themeId: "classic", fontFamily: "Cairo", evidenceAssetIds: [] as number[] };
    const saved = await saveReportDraftForUser(userId, { ...input, expectedRevision: 0, fields: { summary: "النص الأصلي" } });
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
