import { createHash } from "node:crypto";
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
import { createWorkItemForUser } from "./domain-db";
import { getDb } from "./db";
import { revokeOutputForUser } from "./review-output-db";
import { createReportDraftVersionForUser, saveReportDraftForUser } from "./work-report-draft-db";
import {
  generatePrivatePdfForWorkVersion,
  getPrivatePdfDownloadForUser,
  OutputArtifactUnavailableError,
} from "./work-version-output-service";

const integrationEnabled = process.env.SERS_INTEGRATION === "1";
const suite = integrationEnabled ? describe : describe.skip;

suite("immutable WorkVersion PDF output pipeline against real MySQL", () => {
  let ownerId = 0;
  let outsiderId = 0;

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
    const owner = await db.insert(users).values({ openId: "output-owner", name: "Output Owner" });
    const outsider = await db.insert(users).values({ openId: "output-outsider", name: "Output Outsider" });
    ownerId = Number(owner[0].insertId);
    outsiderId = Number(outsider[0].insertId);
  });

  afterAll(async () => {
    if (integrationEnabled) await clean();
  });

  async function createVersion() {
    const work = await createWorkItemForUser(ownerId, { title: "تقرير مخرج ثابت", type: "report" });
    const draft = await saveReportDraftForUser(ownerId, {
      workItemId: work!.id,
      expectedRevision: 0,
      templateId: "program-report",
      themeId: "formal",
      fontFamily: "Cairo",
      fields: {
        summary: "ملخص مثبت داخل النسخة",
        objectives: "هدف قابل للقياس",
      },
      evidenceAssetIds: [],
    });
    const version = await createReportDraftVersionForUser(ownerId, {
      workItemId: work!.id,
      expectedRevision: draft.revision,
      reason: "جاهزة للإخراج",
    });
    return { work: work!, version };
  }

  it("renders, hashes, stores, records, and returns a signed private PDF exactly once", async () => {
    const { version } = await createVersion();
    const pdfBytes = Buffer.from("%PDF-1.4\nimmutable-report-output\n%%EOF", "utf8");
    const expectedHash = createHash("sha256").update(pdfBytes).digest("hex");
    let renderCalls = 0;
    let uploadCalls = 0;
    const storedKeys: string[] = [];

    const dependencies = {
      renderPdf: async (html: string) => {
        renderCalls += 1;
        expect(html).toContain("ملخص مثبت داخل النسخة");
        expect(html).toContain("نسخة 1");
        return pdfBytes;
      },
      putStorage: async (key: string, data: Buffer | Uint8Array | string, contentType?: string) => {
        uploadCalls += 1;
        storedKeys.push(key);
        expect(Buffer.from(data as Buffer)).toEqual(pdfBytes);
        expect(contentType).toBe("application/pdf");
        return { key, url: `upload://${key}` };
      },
      getStorage: async (key: string) => ({ key, url: `https://signed.example/${encodeURIComponent(key)}` }),
    };

    const first = await generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies);
    expect(first?.reused).toBe(false);
    expect(first?.contentHash).toBe(expectedHash);
    expect(first?.storageKey).toContain(`/version-${version.id}/${expectedHash}.pdf`);
    expect(first?.downloadUrl).toContain("https://signed.example/");
    expect(first?.fileSize).toBe(pdfBytes.length);

    const second = await generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies);
    expect(second?.outputId).toBe(first?.outputId);
    expect(second?.reused).toBe(true);
    expect(renderCalls).toBe(1);
    expect(uploadCalls).toBe(1);
    expect(storedKeys).toHaveLength(1);

    const db = await getDb();
    const rows = await db!.select().from(outputs).where(eq(outputs.workVersionId, version.id));
    expect(rows).toHaveLength(1);
    expect(rows[0].type).toBe("pdf");
    expect(rows[0].visibility).toBe("private");
    expect(rows[0].storageKey).toBe(first?.storageKey);
  });

  it("does not render or upload when the caller cannot write the WorkVersion", async () => {
    const { version } = await createVersion();
    let renderCalls = 0;
    let uploadCalls = 0;
    const result = await generatePrivatePdfForWorkVersion(outsiderId, version.id, {
      renderPdf: async () => {
        renderCalls += 1;
        return Buffer.from("%PDF");
      },
      putStorage: async (key: string) => {
        uploadCalls += 1;
        return { key, url: `upload://${key}` };
      },
      getStorage: async (key: string) => ({ key, url: `https://signed.example/${key}` }),
    });
    expect(result).toBeUndefined();
    expect(renderCalls).toBe(0);
    expect(uploadCalls).toBe(0);
  });

  it("refuses to issue a download after the output is revoked", async () => {
    const { version } = await createVersion();
    const dependencies = {
      renderPdf: async () => Buffer.from("%PDF-1.4\nrevocable\n%%EOF"),
      putStorage: async (key: string) => ({ key, url: `upload://${key}` }),
      getStorage: async (key: string) => ({ key, url: `https://signed.example/${key}` }),
    };
    const generated = await generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies);
    expect(generated).toBeTruthy();
    expect(await revokeOutputForUser(ownerId, generated!.outputId)).toBe(true);

    await expect(getPrivatePdfDownloadForUser(ownerId, generated!.outputId, {
      getStorage: dependencies.getStorage,
    })).rejects.toBeInstanceOf(OutputArtifactUnavailableError);
  });
});
