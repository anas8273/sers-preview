/** Real MySQL gate. Intentionally excluded from the hermetic Vitest suite. */
import assert from "node:assert/strict";
import { after, before, test } from "node:test";
import { randomUUID } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import mysql, { type Connection, type RowDataPacket } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { createPortfolio, createUploadedFile, createShareLink, deletePortfolio, getDb } from "./db";

// This suite never accepts a staging/production URL, even when explicitly enabled.
const syntheticUrl = "mysql://root:sers-ci-only@127.0.0.1:3307/sers_legacy_integration";
if (process.env.INTEGRATION_TESTS !== "1" || process.env.DATABASE_URL !== syntheticUrl) {
  throw new Error("Requires INTEGRATION_TESTS=1 and the exact isolated MySQL CI URL");
}
let observer: Connection;
let blocker: Connection;
const owner = 910001;
const stranger = 910002;

before(async () => {
  observer = await mysql.createConnection(syntheticUrl);
  const [existing] = await observer.query<RowDataPacket[]>("SHOW TABLES");
  assert.equal(existing.length, 0, "Refusing to migrate a nonempty database; use a fresh CI service");
  const [version] = await observer.query<RowDataPacket[]>("SELECT VERSION() AS version");
  assert.match(version[0].version, /^8\.4\./, "This gate requires MySQL 8.4");
  await migrate(drizzle(observer), { migrationsFolder: "drizzle" });
  blocker = await mysql.createConnection(syntheticUrl);
});

after(async () => {
  if (blocker) { await blocker.rollback(); await blocker.end(); }
  const db = await getDb();
  if (db) await db.$client.end();
  if (observer) await observer.end();
});

async function portfolio() {
  return (await createPortfolio({ userId: owner, jobId: "teacher", jobTitle: "Integration fixture", personalInfo: {}, criteriaData: {} })).id;
}
async function upload(id: number, userId = owner) {
  return createUploadedFile({ portfolioId: id, userId, fileKey: `integration/${randomUUID()}`, url: "https://example.invalid/fixture" });
}
async function share(id: number, userId = owner) {
  return createShareLink({ portfolioId: id, userId, token: randomUUID(), expiresAt: new Date(Date.now() + 86400000) });
}
async function counts(id: number) {
  const result: Record<string, number> = {};
  for (const table of ["portfolios", "uploaded_files", "evidence_comments", "share_links"]) {
    const column = table === "portfolios" ? "id" : "portfolioId";
    const [rows] = await observer.query<RowDataPacket[]>(`SELECT COUNT(*) AS n FROM \`${table}\` WHERE \`${column}\` = ?`, [id]);
    result[table] = Number(rows[0].n);
  }
  return result;
}
async function populated() {
  const id = await portfolio();
  await upload(id);
  await share(id);
  await observer.execute("INSERT INTO evidence_comments (portfolioId, criterionId, evidenceId, userId, content) VALUES (?, 'c', 'e', ?, 'fixture')", [id, owner]);
  return id;
}
const empty = { portfolios: 0, uploaded_files: 0, evidence_comments: 0, share_links: 0 };
const populatedCounts = { portfolios: 1, uploaded_files: 1, evidence_comments: 1, share_links: 1 };

// Top-level node:test tests run sequentially; each uses a fresh portfolio.
test("non-owner delete rejects before any child deletion; owner delete affects only its portfolio", async () => {
  const id = await populated();
  const untouched = await populated();
  await assert.rejects(deletePortfolio(id, stranger), { code: "FORBIDDEN" });
  assert.deepEqual(await counts(id), populatedCounts);
  await deletePortfolio(id, owner);
  assert.deepEqual(await counts(id), empty);
  assert.deepEqual(await counts(untouched), populatedCounts);
  await deletePortfolio(untouched, owner);
});

test("a real SQL failure after child deletes rolls the entire transaction back", async () => {
  const id = await populated();
  await observer.query("CREATE TRIGGER integration_fail_parent_delete BEFORE DELETE ON portfolios FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'integration injected delete failure'");
  try {
    await assert.rejects(deletePortfolio(id, owner), (error: unknown) => {
      // Require the injected SQL failure, not an unrelated early rejection.
      let cause = error;
      while (cause instanceof Error) {
        if (cause.message.includes("integration injected delete failure")) return true;
        cause = cause.cause;
      }
      return false;
    });
    assert.deepEqual(await counts(id), populatedCounts);
  } finally {
    await observer.query("DROP TRIGGER integration_fail_parent_delete");
  }
  await deletePortfolio(id, owner);
  assert.deepEqual(await counts(id), empty);
});

test("both writers reject a foreign or deleted parent without inserting children", async () => {
  const id = await portfolio();
  for (const writer of [upload, share]) await assert.rejects(writer(id, stranger), { code: "FORBIDDEN" });
  assert.deepEqual(await counts(id), { ...empty, portfolios: 1 });
  await deletePortfolio(id, owner);
  for (const writer of [upload, share]) await assert.rejects(writer(id), { code: "FORBIDDEN" });
  assert.deepEqual(await counts(id), empty);
});

async function waitForParentWaiters(expected: number) {
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    const [rows] = await observer.query<RowDataPacket[]>(`
      SELECT COUNT(DISTINCT w.REQUESTING_ENGINE_TRANSACTION_ID) AS n
      FROM performance_schema.data_lock_waits w
      JOIN performance_schema.data_locks l ON l.ENGINE = w.ENGINE AND l.ENGINE_LOCK_ID = w.REQUESTING_ENGINE_LOCK_ID
      WHERE l.OBJECT_SCHEMA = 'sers_legacy_integration' AND l.OBJECT_NAME = 'portfolios'`);
    if (Number(rows[0].n) >= expected) return;
    await delay(20);
  }
  assert.fail(`Expected ${expected} actual parent lock waiters; no timing-only race assumptions`);
}

for (const [name, writer] of [["upload", upload], ["share", share]] as const) {
  for (const first of ["delete", "writer"] as const) {
    test(`${name}: ${first} queued first against a locked parent leaves no orphan`, { timeout: 30000 }, async () => {
      const id = await portfolio();
      await blocker.beginTransaction();
      await blocker.execute("SELECT id FROM portfolios WHERE id = ? FOR UPDATE", [id]);
      // Attach rejection handlers immediately so a failed operation is observed.
      const settle = (promise: Promise<unknown>) => promise.then(
        value => ({ status: "fulfilled" as const, value }),
        reason => ({ status: "rejected" as const, reason }),
      );
      let firstOperation: ReturnType<typeof settle> | undefined;
      let secondOperation: ReturnType<typeof settle> | undefined;
      try {
        firstOperation = settle(first === "delete" ? deletePortfolio(id, owner) : writer(id));
        await waitForParentWaiters(1);
        secondOperation = settle(first === "delete" ? writer(id) : deletePortfolio(id, owner));
        await waitForParentWaiters(2);
        await blocker.commit();
        const [firstResult, secondResult] = await Promise.all([firstOperation, secondOperation]);
        assert.equal(firstResult.status, "fulfilled");
        if (first === "delete") {
          assert.equal(secondResult.status, "rejected");
          if (secondResult.status === "rejected") assert.equal(secondResult.reason.code, "FORBIDDEN");
        } else {
          assert.equal(secondResult.status, "fulfilled");
        }
        assert.deepEqual(await counts(id), empty);
      } finally {
        await blocker.rollback();
        await Promise.all([firstOperation, secondOperation]);
      }
    });
  }
}
