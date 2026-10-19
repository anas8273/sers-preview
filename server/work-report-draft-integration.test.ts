import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { users } from "../drizzle/schema";
import {
  assets,
  contentBlocks,
  memberships,
  organizations,
  outputs,
  reviewComments,
  reviews,
  workAssetLinks,
  workItems,
  workVersions,
} from "../drizzle/domain-core";
import { createAssetForUser, createWorkItemForUser, linkAssetToWorkForUser } from "./domain-db";
import { getDb } from "./db";
import {
  createReportDraftVersionForUser,
  getReportDraftForUser,
  ReportDraftConflictError,
  saveReportDraftForUser,
} from "./work-report-draft-db";

const integrationEnabled = process.env.SERS_INTEGRATION === "1";
const suite = integrationEnabled ? describe : describe.skip;

suite("server-backed report draft against real MySQL", () => {
  let userId = 0;

  async function clean() {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await db.delete(reviewComments);
    await db.delete(reviews);
    await db.delete(outputs);
    await db.delete(workAssetLinks);
    await db.delete(workVersions);
    await db.delete(contentBlocks);
    await db.delete(assets);
    await db.delete(workItems);
    await db.delete(memberships);
    await db.delete(organizations);
    await db.delete(users);
  }

  beforeAll(async () => {
    const db = await getDb();
    if (!db) throw new Error("Database not available");
    await clean();
    const inserted = await db.insert(users).values({ openId: "report-draft-user", name: "Report Draft User" });
    userId = Number(inserted[0].insertId);
  });

  afterAll(async () => {
    if (integrationEnabled) await clean();
  });

  it("persists a report draft on the server and detects stale revisions", async () => {
    const work = await createWorkItemForUser(userId, { title: "Server Report", type: "report" });
    const initial = await getReportDraftForUser(userId, work!.id);
    expect(initial?.draft.revision).toBe(0);

    const saved = await saveReportDraftForUser(userId, {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "program-report",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: {
        summary: "ملخص محفوظ في الخادم",
        objectives: "هدف أول",
      },
      evidenceAssetIds: [],
    });
    expect(saved.revision).toBe(1);

    const reloaded = await getReportDraftForUser(userId, work!.id);
    expect(reloaded?.draft.fields.summary).toBe("ملخص محفوظ في الخادم");
    expect(reloaded?.draft.revision).toBe(1);

    await expect(saveReportDraftForUser(userId, {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "program-report",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: { summary: "كتابة قديمة" },
      evidenceAssetIds: [],
    })).rejects.toBeInstanceOf(ReportDraftConflictError);
  });

  it("keeps only evidence already linked to the report work", async () => {
    const work = await createWorkItemForUser(userId, { title: "Evidence Report", type: "report" });
    const linkedAsset = await createAssetForUser(userId, { title: "Linked", kind: "text", metadata: { text: "proof" } });
    const unlinkedAsset = await createAssetForUser(userId, { title: "Unlinked", kind: "text", metadata: { text: "other" } });
    await linkAssetToWorkForUser(userId, { workItemId: work!.id, assetId: linkedAsset!.id });

    const saved = await saveReportDraftForUser(userId, {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "custom",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: { summary: "Evidence filter" },
      evidenceAssetIds: [linkedAsset!.id, unlinkedAsset!.id],
    });
    expect(saved.evidenceAssetIds).toEqual([linkedAsset!.id]);
  });

  it("serializes concurrent saves so only one writer can use a revision", async () => {
    const work = await createWorkItemForUser(userId, { title: "Concurrent Draft", type: "report" });
    const baseInput = {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "custom",
      themeId: "classic",
      fontFamily: "Cairo",
      evidenceAssetIds: [] as number[],
    };
    const results = await Promise.allSettled([
      saveReportDraftForUser(userId, { ...baseInput, fields: { summary: "Writer A" } }),
      saveReportDraftForUser(userId, { ...baseInput, fields: { summary: "Writer B" } }),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    expect(results.filter(result => result.status === "rejected")).toHaveLength(1);
  });

  it("creates an authoritative version from the saved server draft and linked assets", async () => {
    const work = await createWorkItemForUser(userId, { title: "Versioned Report", type: "report" });
    const asset = await createAssetForUser(userId, { title: "Version Evidence", kind: "link", externalUrl: "https://example.com/evidence" });
    await linkAssetToWorkForUser(userId, { workItemId: work!.id, assetId: asset!.id });
    const saved = await saveReportDraftForUser(userId, {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "visit-report",
      themeId: "formal",
      fontFamily: "Cairo",
      fields: { summary: "نسخة سلطوية", results: "نتيجة" },
      evidenceAssetIds: [asset!.id],
    });

    const version = await createReportDraftVersionForUser(userId, {
      workItemId: work!.id,
      expectedRevision: saved.revision,
      reason: "Ready for review",
    });
    expect(version.versionNumber).toBe(1);
    expect(version.reportRevision).toBe(saved.revision);

    const db = await getDb();
    const [stored] = await db!.select().from(workVersions).where(eq(workVersions.id, version.id)).limit(1);
    const snapshot = stored.snapshot as any;
    expect(snapshot.kind).toBe("report");
    expect(snapshot.reportDraft.fields.summary).toBe("نسخة سلطوية");
    expect(snapshot.assets).toHaveLength(1);
  });
});
