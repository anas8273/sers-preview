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
import { createOutputForUser, revokeOutputForUser } from "./review-output-db";
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

  it("renders, hashes, stores, records, and returns a private PDF exactly once on sequential requests", async () => {
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
    expect(first?.rendererVersion).toBe(2);
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

  it("deduplicates concurrent PDF generation with one renderer-version output row", async () => {
    const { version } = await createVersion();
    const pdfBytes = Buffer.from("%PDF-1.4\nconcurrent-output\n%%EOF", "utf8");
    let renderCalls = 0;
    let uploadCalls = 0;

    const dependencies = {
      renderPdf: async () => {
        renderCalls += 1;
        await new Promise(resolve => setTimeout(resolve, 20));
        return pdfBytes;
      },
      putStorage: async (key: string) => {
        uploadCalls += 1;
        await new Promise(resolve => setTimeout(resolve, 10));
        return { key, url: `upload://${key}` };
      },
      getStorage: async (key: string) => ({ key, url: `https://signed.example/${encodeURIComponent(key)}` }),
    };

    const [first, second] = await Promise.all([
      generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies),
      generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies),
    ]);

    expect(first?.outputId).toBe(second?.outputId);
    expect([first?.reused, second?.reused].sort()).toEqual([false, true]);
    expect(renderCalls).toBe(2);
    expect(uploadCalls).toBe(2);

    const db = await getDb();
    const rows = await db!.select().from(outputs).where(eq(outputs.workVersionId, version.id));
    expect(rows).toHaveLength(1);
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

  it("keeps r1 downloads readable and blocks resurrection across the r2 renderer upgrade", async () => {
    const { work, version } = await createVersion();
    const oldBytes = Buffer.from("%PDF-1.4\nold-renderer\n%%EOF");
    const oldHash = createHash("sha256").update(oldBytes).digest("hex");
    const old = (await createOutputForUser(ownerId, { workVersionId: version.id, type: "pdf", visibility: "private",
      token: `artifact:v${version.id}:pdf:r1`, storageKey: `outputs/work-${work.id}/version-${version.id}/${oldHash}.pdf` }))!;
    let renders = 0;
    const dependencies = { renderPdf: async () => { renders++; return Buffer.from("%PDF-1.4\nnew-renderer\n%%EOF"); },
      putStorage: async (key: string) => ({ key, url: "" }), getStorage: async (key: string) => ({ key, url: `https://signed.example/${key}` }) };
    expect(await getPrivatePdfDownloadForUser(ownerId, old.id, dependencies)).toMatchObject({ rendererVersion: 1, contentHash: oldHash });
    const current = (await generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies))!;
    expect(current).toMatchObject({ rendererVersion: 2, reused: false });
    expect(current.outputId).not.toBe(old.id);
    expect(await getPrivatePdfDownloadForUser(ownerId, old.id, dependencies)).toMatchObject({ rendererVersion: 1 });
    await revokeOutputForUser(ownerId, old.id);
    await expect(generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies)).rejects.toThrow(/revoked/);
    await expect(getPrivatePdfDownloadForUser(ownerId, current.outputId, dependencies)).rejects.toThrow(/revoked/);
    expect(renders).toBe(1);

    const next = await createVersion();
    const legacy = (await createOutputForUser(ownerId, { workVersionId: next.version.id, type: "pdf", visibility: "private",
      token: `artifact:v${next.version.id}:pdf:r1`, storageKey: `outputs/work-${next.work.id}/version-${next.version.id}/${oldHash}.pdf` }))!;
    await revokeOutputForUser(ownerId, legacy.id);
    await expect(generatePrivatePdfForWorkVersion(ownerId, next.version.id, dependencies)).rejects.toThrow(/revoked/);
    expect(renders).toBe(1);
  });

  it("rejects an old renderer record whose storage identity belongs to another work/version", async () => {
    const { work, version } = await createVersion();
    const record = (await createOutputForUser(ownerId, { workVersionId: version.id, type: "pdf", visibility: "private",
      token: `artifact:v${version.id}:pdf:r1`, storageKey: `outputs/work-${work.id + 1}/version-${version.id}/${"a".repeat(64)}.pdf` }))!;
    let reads = 0;
    await expect(getPrivatePdfDownloadForUser(ownerId, record.id, { getStorage: async key => { reads++; return { key, url: "https://signed.example" }; } })).rejects.toThrow(/Private artifact/);
    expect(reads).toBe(0);
  });

  it("refuses download and regeneration after a version output is revoked", async () => {
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
    await expect(generatePrivatePdfForWorkVersion(ownerId, version.id, dependencies))
      .rejects.toThrow(/revoked/i);
  });
});
