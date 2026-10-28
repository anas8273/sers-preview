import { createHash, randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { outputs, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { createWorkItemForUser, createWorkVersionForUser } from "./domain-db";
import { createOutputForUser, revokeOutputForUser } from "./review-output-db";
import { readPrivateOutputForUser, storagePut } from "./output-artifact-storage";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("private output HTTP reader across PDF renderer revisions", () => {
  let owner = 0, directory = "";
  const workIds: number[] = [], versionIds: number[] = [];
  const previousDirectory = process.env.SERS_PRIVATE_STORAGE_DIR;
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Requires disposable CI database");
    const db = (await getDb())!;
    const [raw] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    const row = (raw as unknown as { name: string; version: string }[])[0];
    expect(row.name).toBe("sers_test"); expect(row.version).toMatch(/^8\.4\./);
    directory = await mkdtemp(join(tmpdir(), "sers-private-output-reader-"));
    process.env.SERS_PRIVATE_STORAGE_DIR = directory;
    const [user] = await db.insert(users).values({ openId: `output-reader-${randomUUID()}` }); owner = Number(user.insertId);
  });
  afterAll(async () => {
    if (owner) {
      const db = (await getDb())!;
      if (versionIds.length) await db.delete(outputs).where(inArray(outputs.workVersionId, versionIds));
      if (workIds.length) {
        await db.delete(workVersions).where(inArray(workVersions.workItemId, workIds));
        await db.delete(workItems).where(inArray(workItems.id, workIds));
      }
      await db.delete(users).where(eq(users.id, owner));
    }
    if (previousDirectory === undefined) delete process.env.SERS_PRIVATE_STORAGE_DIR;
    else process.env.SERS_PRIVATE_STORAGE_DIR = previousDirectory;
    if (directory) await rm(directory, { recursive: true, force: true });
  });
  async function fixture() {
    const work = (await createWorkItemForUser(owner, { title: "ملف تجريبي خاص", type: "report" }))!; workIds.push(work.id);
    const version = (await createWorkVersionForUser(owner, work.id, { kind: "report", work: { title: work.title }, reportDraft: { fields: { summary: "بيانات اصطناعية" } } }))!; versionIds.push(version.id);
    async function artifact(type: "pdf" | "docx", revision: number, content: string) {
      const bytes = Buffer.from(content), sha = createHash("sha256").update(bytes).digest("hex");
      const key = `outputs/work-${work.id}/version-${version.id}/${sha}.${type}`;
      await storagePut(key, bytes);
      const output = (await createOutputForUser(owner, { workVersionId: version.id, type, visibility: "private", token: `artifact:v${version.id}:${type}:r${revision}`, storageKey: key }))!;
      return { ...output, bytes };
    }
    return { work, version, artifact };
  }

  it("reads actual private bytes, blocks a known r2 URL after r1 revocation, and leaves DOCX available", async () => {
    const { artifact } = await fixture();
    const old = await artifact("pdf", 1, "%PDF-1.4 old private bytes");
    const current = await artifact("pdf", 2, "%PDF-1.4 current private bytes");
    const word = await artifact("docx", 1, "synthetic document storage bytes");
    expect((await readPrivateOutputForUser(owner, old.id))?.bytes).toEqual(old.bytes);
    expect((await readPrivateOutputForUser(owner, current.id))?.bytes).toEqual(current.bytes);
    expect(await readPrivateOutputForUser(owner + 100000, current.id)).toBeUndefined();
    await revokeOutputForUser(owner, old.id);
    expect(await readPrivateOutputForUser(owner, current.id)).toBeUndefined();
    expect((await readPrivateOutputForUser(owner, word.id))?.bytes).toEqual(word.bytes);
  });

  it("ignores malformed legacy identities and unknown renderer tokens for cross-revision revocation", async () => {
    const { version, artifact } = await fixture();
    const current = await artifact("pdf", 2, "%PDF-1.4 current authorized bytes");
    const malformed = (await createOutputForUser(owner, { workVersionId: version.id, type: "pdf", token: `artifact:v${version.id}:pdf:r1`, storageKey: "untrusted/arbitrary-key" }))!;
    await revokeOutputForUser(owner, malformed.id);
    const unknown = await artifact("pdf", 999, "%PDF future unknown bytes");
    await revokeOutputForUser(owner, unknown.id);
    expect((await readPrivateOutputForUser(owner, current.id))?.bytes).toEqual(current.bytes);
    expect(await readPrivateOutputForUser(owner, unknown.id)).toBeUndefined();
  });
});
