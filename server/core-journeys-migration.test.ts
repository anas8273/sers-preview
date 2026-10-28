import { randomUUID } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import { migrate } from "drizzle-orm/mysql2/migrator";
import { describe, expect, it } from "vitest";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("0016 core journeys upgrade from populated 0015", () => {
  it("preserves existing works, outputs and upload capacity while backfilling unaccepted invitations", async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Core journeys migration requires disposable CI MySQL");
    const admin = await mysql.createConnection(process.env.DATABASE_URL);
    const databaseName = `sers_core_upgrade_${randomUUID().replaceAll("-", "")}`;
    const folder = mkdtempSync(path.join(tmpdir(), "sers-core-upgrade-"));
    let connection: Awaited<ReturnType<typeof mysql.createConnection>> | undefined;
    let created = false;
    try {
      const [identityRows] = await admin.query("SELECT DATABASE() AS name, VERSION() AS version");
      expect((identityRows as Array<{ name: string; version: string }>)[0]).toMatchObject({ name: "sers_test", version: expect.stringMatching(/^8\.4\./) });
      await admin.query(`CREATE DATABASE \`${databaseName}\``); created = true;
      connection = await mysql.createConnection({ host: "127.0.0.1", port: 3306, user: "root", password: "root", database: databaseName });
      cpSync(path.resolve("drizzle"), folder, { recursive: true });
      const journalPath = path.join(folder, "meta/_journal.json");
      const journal = JSON.parse(readFileSync(journalPath, "utf8"));
      expect(journal.entries.some((entry: { idx: number; tag: string }) => entry.idx === 16 && entry.tag === "0016_core_journeys")).toBe(true);
      writeFileSync(journalPath, JSON.stringify({ ...journal, entries: journal.entries.filter((entry: { idx: number }) => entry.idx <= 15) }));
      const db = drizzle(connection);
      await migrate(db, { migrationsFolder: folder });
      for (let id = 1; id <= 4; id++) await connection.execute("INSERT INTO users (id,openId) VALUES (?,?)", [id, `legacy-core-user-${id}`]);
      await connection.execute("INSERT INTO organizations (id,name) VALUES (1,'Legacy school')");
      const statuses = ["active", "invited", "suspended", "left"];
      for (const [index, status] of statuses.entries()) await connection.execute(
        "INSERT INTO memberships (organizationId,userId,role,status) VALUES (1,?,?,?)",
        [index + 1, index === 0 ? "owner" : "member", status],
      );
      await connection.execute("INSERT INTO work_items (id,creatorUserId,ownerType,ownerUserId,type,title,status,currentVersionNumber,metadata) VALUES (1,1,'personal',1,'report','تقرير محفوظ','draft',1,?)", [JSON.stringify({ legacy: true })]);
      const snapshot = { kind: "report", work: { title: "نسخة قديمة ثابتة" }, reportDraft: { fields: { summary: "نص عربي قديم" } }, capturedAt: "2026-10-20T12:00:00.000Z" };
      await connection.execute("INSERT INTO work_versions (id,workItemId,versionNumber,createdByUserId,snapshot) VALUES (1,1,1,1,?)", [JSON.stringify(snapshot)]);
      for (const [index, type] of ["pdf", "link", "qr"].entries()) await connection.execute(
        "INSERT INTO outputs (id,workVersionId,createdByUserId,type,visibility,token,passwordHash,storageKey) VALUES (?,1,1,?,?,?,?,?)",
        [index + 1, type, type === "pdf" ? "private" : type === "link" ? "protected" : "public", `legacy-${type}`, type === "link" ? "a".repeat(64) : null, type === "pdf" ? "legacy/report.pdf" : null],
      );
      await connection.execute("INSERT INTO assets (id,creatorUserId,ownerType,ownerUserId,kind,title,metadata) VALUES (1,1,'personal',1,'text','شاهد قديم',?)", [JSON.stringify({ text: "محتوى سابق" })]);
      await connection.execute("INSERT INTO work_asset_links (workItemId,assetId,role) VALUES (1,1,'evidence')");
      await connection.execute("INSERT INTO upload_quota_budgets (scopeKey,limitBytes,maxActiveIntents,reservedBytes,retainedBytes,activeIntents) VALUES ('personal:1',4096,10,128,256,3)");
      for (const [index, state] of ["issued", "cancelled", "expired", "receiving", "quarantined", "rejected"].entries()) {
        const prepared = ["receiving", "quarantined"].includes(state);
        await connection.execute(
          "INSERT INTO upload_intents (id,actorUserId,scopeKey,reservationHeld,storageChargeHeld,idempotencyKeyHash,requestFingerprint,fileName,declaredMimeType,expectedBytes,state,revision,objectKey,objectVersion,sha256,actualBytes,attempts,expiresAt) VALUES (?,1,'personal:1',?,?,?,?, 'proof.txt','text/plain',128,?,?,?,?,?,?,?,DATE_ADD(CURRENT_TIMESTAMP,INTERVAL 1 HOUR))",
          [state, state === "issued", prepared, String(index).padStart(64, "0"), "f".repeat(64), state, index + 2,
            prepared ? `quarantine/legacy-${state}` : null, state === "quarantined" ? "legacy-version" : null,
            prepared ? "b".repeat(64) : null, prepared ? 128 : null, prepared ? 1 : 0],
        );
      }
      const [beforeRows] = await connection.query("SELECT id,state,revision,reservationHeld,storageChargeHeld,objectKey,objectVersion,sha256,actualBytes,attempts,expiresAt FROM upload_intents ORDER BY id");
      const [beforeOutputs] = await connection.query("SELECT id,type,visibility,token,passwordHash,storageKey FROM outputs ORDER BY id");
      writeFileSync(journalPath, JSON.stringify(journal));
      await migrate(db, { migrationsFolder: folder });
      await migrate(db, { migrationsFolder: folder });
      const [afterRows] = await connection.query("SELECT id,state,revision,reservationHeld,storageChargeHeld,objectKey,objectVersion,sha256,actualBytes,attempts,expiresAt FROM upload_intents ORDER BY id");
      expect(afterRows).toEqual(beforeRows);
      const [newFields] = await connection.query("SELECT assetId,scanPolicyVersion,scanEngineVersion,detectedMimeType,scanCompletedAt,validationAttempts,legalHold,tombstonedAt,cleanupState,cleanupAttempts FROM upload_intents");
      expect(newFields).toHaveLength(6);
      for (const row of newFields as Array<Record<string, unknown>>) expect(row).toEqual({ assetId: null, scanPolicyVersion: null, scanEngineVersion: null, detectedMimeType: null, scanCompletedAt: null, validationAttempts: 0, legalHold: 0, tombstonedAt: null, cleanupState: "pending", cleanupAttempts: 0 });
      const [quotaRows] = await connection.query("SELECT reservedBytes,retainedBytes,storedBytes,activeIntents,limitBytes,maxActiveIntents FROM upload_quota_budgets");
      expect(quotaRows).toEqual([{ reservedBytes: 128, retainedBytes: 256, storedBytes: 0, activeIntents: 3, limitBytes: 4096, maxActiveIntents: 10 }]);
      const [memberRows] = await connection.query("SELECT userId,status,invitationAccepted FROM memberships ORDER BY userId");
      expect(memberRows).toEqual(statuses.map((status, index) => ({ userId: index + 1, status, invitationAccepted: status === "invited" ? 0 : 1 })));
      const [afterOutputs] = await connection.query("SELECT id,type,visibility,token,passwordHash,storageKey FROM outputs ORDER BY id");
      expect(afterOutputs).toEqual(beforeOutputs);
      const [workRows] = await connection.query("SELECT title,currentVersionNumber,academicYearId,academicTermId,academicContext,CAST(metadata AS CHAR) AS metadata FROM work_items WHERE id=1");
      expect((workRows as Array<Record<string, unknown>>)[0]).toMatchObject({ title: "تقرير محفوظ", currentVersionNumber: 1, academicYearId: null, academicTermId: null, academicContext: null });
      expect(JSON.parse((workRows as Array<{ metadata: string }>)[0].metadata)).toEqual({ legacy: true });
      const [versionRows] = await connection.query("SELECT CAST(snapshot AS CHAR) AS snapshot FROM work_versions WHERE id=1");
      expect(JSON.parse((versionRows as Array<{ snapshot: string }>)[0].snapshot)).toEqual(snapshot);
      const [links] = await connection.query("SELECT workItemId,assetId,role FROM work_asset_links");
      expect(links).toEqual([{ workItemId: 1, assetId: 1, role: "evidence" }]);
      for (const table of ["academic_years", "academic_terms", "upload_events"]) {
        const [rows] = await connection.query(`SELECT COUNT(*) AS count FROM \`${table}\``);
        expect((rows as Array<{ count: number }>)[0].count).toBe(0);
      }
      // The upgraded enum accepts new DOCX rows without rewriting prior outputs.
      await connection.execute("INSERT INTO outputs (workVersionId,createdByUserId,type,visibility,token) VALUES (1,1,'docx','private','new-docx')");
      const [docxRows] = await connection.query("SELECT type,visibility FROM outputs WHERE token='new-docx'");
      expect(docxRows).toEqual([{ type: "docx", visibility: "private" }]);
    } finally {
      await connection?.end();
      if (created) await admin.query(`DROP DATABASE \`${databaseName}\``);
      await admin.end();
      rmSync(folder, { recursive: true, force: true });
    }
  }, 60000);
});
