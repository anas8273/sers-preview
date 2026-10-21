import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, inArray, sql } from "drizzle-orm";
import { users } from "../drizzle/schema";
import { uploadIntents } from "../drizzle/upload-intents";
import { getDb } from "./db";
import {
  beginUploadIntentForUser, getUploadIntentForUser, cancelUploadIntentForUser,
  UploadIntentConflictError,
} from "./upload-intent-db";

const enabled = process.env.SERS_INTEGRATION === "1";
const suite = enabled ? describe : describe.skip;
suite("personal upload intent persistence on real MySQL", () => {
  let owner = 0, outsider = 0;
  const input = (key = randomUUID()) => ({ idempotencyKey: key, fileName: "شاهد.pdf", mimeType: "application/pdf", expectedBytes: 128 });

  beforeAll(async () => {
    // This suite writes fixtures only to the disposable Actions service database.
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") {
      throw new Error("Upload intent integration requires the disposable CI database");
    }
    const db = (await getDb())!;
    const [result] = await db.execute(sql`SELECT DATABASE() AS dbName, VERSION() AS dbVersion`);
    const row = (result as unknown as Array<{ dbName: string; dbVersion: string }>)[0];
    expect(row.dbName).toBe("sers_test");
    expect(row.dbVersion).toMatch(/^8\.4\./);
    for (const role of ["owner", "outsider"]) {
      const [created] = await db.insert(users).values({ openId: `upload-${role}-${randomUUID()}` });
      if (role === "owner") owner = Number(created.insertId); else outsider = Number(created.insertId);
    }
  });

  afterAll(async () => {
    if (!owner && !outsider) return;
    const db = (await getDb())!;
    await db.delete(uploadIntents).where(inArray(uploadIntents.actorUserId, [owner, outsider]));
    await db.delete(users).where(inArray(users.id, [owner, outsider]));
  });

  it("persists one intent for concurrent identical retries", async () => {
    const request = input();
    const results = await Promise.all(Array.from({ length: 6 }, () => beginUploadIntentForUser(owner, request)));
    expect(new Set(results.map(x => x.id)).size).toBe(1);
    expect(results.every(x => x.state === "issued" && x.revision === 0)).toBe(true);
    const db = (await getDb())!;
    const rows = await db.select().from(uploadIntents).where(eq(uploadIntents.id, results[0].id));
    expect(rows).toHaveLength(1);
    expect(await getUploadIntentForUser(owner, results[0].id)).toEqual(results[0]);
    expect(results[0]).not.toHaveProperty("storageKey");
    expect(results[0]).not.toHaveProperty("idempotencyKeyHash");
  });

  it("rejects changed semantic fields without replacing the accepted request", async () => {
    const request = input();
    const first = await beginUploadIntentForUser(owner, request);
    for (const patch of [{ expectedBytes: 129 }, { fileName: "other.pdf" }, { mimeType: "image/png" }]) {
      await expect(beginUploadIntentForUser(owner, { ...request, ...patch })).rejects.toBeInstanceOf(UploadIntentConflictError);
    }
    expect(await beginUploadIntentForUser(owner, request)).toEqual(first);
  });

  it("isolates users even with the same idempotency key", async () => {
    const request = input();
    const a = await beginUploadIntentForUser(owner, request);
    const b = await beginUploadIntentForUser(outsider, request);
    expect(a.id).not.toBe(b.id);
    expect(await getUploadIntentForUser(outsider, a.id)).toBeUndefined();
    expect(await cancelUploadIntentForUser(outsider, a.id, a.revision)).toBeUndefined();
    expect((await getUploadIntentForUser(owner, a.id))?.state).toBe("issued");
  });

  it("rejects stale revisions and makes concurrent cancellation retry-safe", async () => {
    const request = input();
    const first = await beginUploadIntentForUser(owner, request);
    await expect(cancelUploadIntentForUser(owner, first.id, first.revision + 1)).rejects.toBeInstanceOf(UploadIntentConflictError);
    const cancelled = await Promise.all(Array.from({ length: 4 }, () => cancelUploadIntentForUser(owner, first.id, first.revision)));
    expect(cancelled.every(x => x?.state === "cancelled" && x.revision === first.revision + 1)).toBe(true);
    expect((await beginUploadIntentForUser(owner, request)).state).toBe("cancelled");
  });

  it("expires using database time and never revives an expired idempotency key", async () => {
    const request = input();
    const first = await beginUploadIntentForUser(owner, request);
    const db = (await getDb())!;
    await db.update(uploadIntents).set({ expiresAt: sql`DATE_SUB(CURRENT_TIMESTAMP, INTERVAL 1 SECOND)` }).where(eq(uploadIntents.id, first.id));
    const expired = await getUploadIntentForUser(owner, first.id);
    expect(expired?.state).toBe("expired");
    expect(expired?.revision).toBe(first.revision + 1);
    expect((await beginUploadIntentForUser(owner, request)).state).toBe("expired");
    expect((await getUploadIntentForUser(owner, first.id))?.revision).toBe(expired?.revision);
    expect(await cancelUploadIntentForUser(owner, first.id, first.revision)).toEqual(expired);
  });

  it("does not leave an intent for a nonexistent actor after a failed insert", async () => {
    await expect(beginUploadIntentForUser(2147483647, input())).rejects.toThrow();
    const db = (await getDb())!;
    expect(await db.select().from(uploadIntents).where(eq(uploadIntents.actorUserId, 2147483647))).toHaveLength(0);
  });
});
