import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { describe, expect, it } from "vitest";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("upload quota migration of existing personal intents", () => {
  it("preserves history while expiring old unreserved requests", async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") {
      throw new Error("Migration test requires disposable CI MySQL");
    }
    const admin = await mysql.createConnection(process.env.DATABASE_URL);
    const databaseName = `sers_upload_migration_${randomUUID().replaceAll("-", "")}`;
    const folder = mkdtempSync(path.join(tmpdir(), "sers-upload-migration-"));
    let connection: Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
    let created = false;
    try {
      const [versionRows] = await admin.query("SELECT VERSION() AS version");
      expect((versionRows as Array<{ version: string }>)[0].version).toMatch(/^8\.4\./);
      await admin.query(`CREATE DATABASE \`${databaseName}\``);
      created = true;
      connection = await mysql.createConnection({ host: "127.0.0.1", port: 3306, user: "root", password: "root", database: databaseName });
      cpSync(path.resolve("drizzle"), folder, { recursive: true });
      const journalPath = path.join(folder, "meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.filter((x: { idx: number }) => x.idx <= 12) }));
      const db = drizzle(connection);
      await migrate(db, { migrationsFolder: folder });
      await connection.execute("INSERT INTO users (id, openId) VALUES (1, 'migration-owner')");
      for (const state of ["issued", "cancelled", "expired"]) {
        await connection.execute(
          "INSERT INTO upload_intents (id, actorUserId, idempotencyKeyHash, requestFingerprint, fileName, declaredMimeType, expectedBytes, state, revision, expiresAt) VALUES (?,1,?,?,'proof.pdf','application/pdf',128,?,2,DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))",
          [state, state.padEnd(64, "0"), "a".repeat(64), state],
        );
      }
      writeFileSync(journalPath, JSON.stringify(journal));
      await migrate(db, { migrationsFolder: folder });
      // Re-running a successful migration must be harmless.
      await migrate(db, { migrationsFolder: folder });
      const [raw] = await connection.query("SELECT id, state, revision, scopeKey, reservationHeld FROM upload_intents ORDER BY id");
      const rows = raw as Array<{ id: string; state: string; revision: number; scopeKey: string; reservationHeld: number }>;
      expect(rows).toHaveLength(3);
      expect(rows.every(row => row.scopeKey === "personal:1" && row.reservationHeld === 0)).toBe(true);
      expect(rows.find(row => row.id === "issued")).toMatchObject({ state: "expired", revision: 3 });
      expect(rows.find(row => row.id === "cancelled")).toMatchObject({ state: "cancelled", revision: 2 });
      expect(rows.find(row => row.id === "expired")).toMatchObject({ state: "expired", revision: 2 });
    } finally {
      await connection?.end();
      if (created) await admin.query(`DROP DATABASE \`${databaseName}\``);
      await admin.end();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60000);

  it("upgrades reserved and terminal records from 0014 without losing capacity or history", async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Migration test requires disposable CI MySQL");
    const admin = await mysql.createConnection(process.env.DATABASE_URL);
    const databaseName = `sers_reception_migration_${randomUUID().replaceAll("-", "")}`;
    const folder = mkdtempSync(path.join(tmpdir(), "sers-reception-migration-"));
    let connection: Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
    let created = false;
    try {
      const [versionRows] = await admin.query("SELECT VERSION() AS version");
      expect((versionRows as Array<{ version: string }>)[0].version).toMatch(/^8\.4\./);
      await admin.query(`CREATE DATABASE \`${databaseName}\``);
      created = true;
      connection = await mysql.createConnection({ host: "127.0.0.1", port: 3306, user: "root", password: "root", database: databaseName });
      cpSync(path.resolve("drizzle"), folder, { recursive: true });
      const journalPath = path.join(folder, "meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.filter((x: { idx: number }) => x.idx <= 14) }));
      const db = drizzle(connection);
      await migrate(db, { migrationsFolder: folder });
      await connection.execute("INSERT INTO users (id, openId) VALUES (1, 'reception-migration-owner')");
      await connection.execute("INSERT INTO upload_quota_budgets (scopeKey, limitBytes, maxActiveIntents, reservedBytes, activeIntents) VALUES ('personal:1',1024,4,128,1)");
      for (const state of ["issued", "cancelled", "expired"]) {
        await connection.execute(
          "INSERT INTO upload_intents (id, actorUserId, scopeKey, reservationHeld, idempotencyKeyHash, requestFingerprint, fileName, declaredMimeType, expectedBytes, state, revision, expiresAt) VALUES (?,1,'personal:1',?, ?,?,'proof.pdf','application/pdf',128,?,2,DATE_ADD(CURRENT_TIMESTAMP, INTERVAL 1 HOUR))",
          [state, state === "issued", state.padEnd(64, "0"), "a".repeat(64), state],
        );
      }
      writeFileSync(journalPath, JSON.stringify(journal));
      await migrate(db, { migrationsFolder: folder });
      await migrate(db, { migrationsFolder: folder });
      const [raw] = await connection.query("SELECT id,state,revision,reservationHeld,storageChargeHeld,objectKey,sha256,attempts FROM upload_intents ORDER BY id");
      const rows = raw as Array<Record<string, unknown>>;
      expect(rows).toHaveLength(3);
      for (const row of rows) expect(row).toMatchObject({ state: row.id, revision: 2, storageChargeHeld: 0, objectKey: null, sha256: null, attempts: 0 });
      expect(rows.find(row => row.id === "issued")).toMatchObject({ reservationHeld: 1 });
      const [budgets] = await connection.query("SELECT reservedBytes,retainedBytes,activeIntents FROM upload_quota_budgets");
      expect(budgets).toEqual([{ reservedBytes: 128, retainedBytes: 0, activeIntents: 1 }]);
    } finally {
      await connection?.end();
      if (created) await admin.query(`DROP DATABASE \`${databaseName}\``);
      await admin.end();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60000);
});
