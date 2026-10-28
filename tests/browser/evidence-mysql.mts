/** Actual browser -> application routers -> MySQL -> private filesystem -> ClamAV.
 * Test identity belongs only to this loopback harness, never the production app. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomUUID, randomBytes } from "node:crypto";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import express from "express";
import puppeteer from "puppeteer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { and, eq, sql } from "drizzle-orm";
import { getDb } from "../../server/db";
import { users } from "../../drizzle/schema";
import { assets, outputs, workAssetLinks } from "../../drizzle/domain-core";
import { uploadIntents } from "../../drizzle/upload-intents";
import { appRouter } from "../../server/root-router";
import { registerEvidenceHttpRoutes } from "../../server/evidence-http-routes";
import { registerPrivateOutputRoutes } from "../../server/output-artifact-storage";
import { createWorkItemForUser, linkAssetToWorkForUser } from "../../server/domain-db";
import { saveReportDraftForUser, createReportDraftVersionForUser } from "../../server/work-report-draft-db";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.SERS_INTEGRATION, "1");
assert.equal(process.env.SERS_SCANNER_INTEGRATION, "1");
assert.equal(process.env.DATABASE_URL, "mysql://root:root@127.0.0.1:3306/sers_test");

test("browser uploads, scans, links and downloads evidence and editable Word from an immutable version", { timeout: 120_000 }, async () => {
  const root = await mkdtemp(join(tmpdir(), "sers-evidence-browser-"));
  process.env.SERS_UPLOADS_ENABLED = "1";
  process.env.SERS_PRIVATE_STORAGE_DIR = join(root, "private");
  process.env.SERS_UPLOAD_PERSONAL_LIMIT_BYTES = "33554432";
  process.env.SERS_UPLOAD_SCHOOL_LIMIT_BYTES = "67108864";
  process.env.SERS_UPLOAD_MAX_ACTIVE_INTENTS = "10";
  process.env.SERS_CLAMAV_HOST = "127.0.0.1";
  process.env.SERS_CLAMAV_PORT = "3310";
  const db = (await getDb())!;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  try {
    const [rows] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    const actual = (rows as unknown as { name: string; version: string }[])[0];
    assert.equal(actual.name, "sers_test"); assert.match(actual.version, /^8\.4\./);
    const [inserted] = await db.insert(users).values({ openId: `evidence-browser-${randomUUID()}`, name: "مالك رحلة الشواهد" });
    const ownerId = Number(inserted.insertId);
    const [user] = await db.select().from(users).where(eq(users.id, ownerId));
    const [outsiderInserted] = await db.insert(users).values({ openId: `evidence-outsider-${randomUUID()}`, name: "حساب اختبار مستقل" });
    const [outsider] = await db.select().from(users).where(eq(users.id, Number(outsiderInserted.insertId)));
    const session = randomBytes(32).toString("hex");
    const outsiderSession = randomBytes(32).toString("hex");
    const authenticate = async (req: express.Request) => req.headers.cookie === `sers_evidence_test=${session}` ? user : req.headers.cookie === `sers_evidence_test=${outsiderSession}` ? outsider : null;
    const app = express();
    registerEvidenceHttpRoutes(app, { authenticate });
    registerPrivateOutputRoutes(app, authenticate);
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext: async ({ req, res }) => ({ req, res, user: await authenticate(req) }) }));
    app.use(express.static(resolve("dist/public")));
    app.get("*", (_req, res) => res.sendFile(resolve("dist/public/index.html")));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(done => server!.once("listening", done));
    const address = server.address(); assert(address && typeof address !== "string");
    const base = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const context = await browser.createBrowserContext();
    await context.setCookie({ name: "sers_evidence_test", value: session, url: base, httpOnly: true });
    const page = await context.newPage(); page.setDefaultTimeout(30_000);
    await page.setViewport({ width: 390, height: 844 });
    const click = async (label: string) => {
      await page.waitForFunction(value => Array.from(document.querySelectorAll("button")).some(button => button.textContent?.trim() === value && !button.disabled), {}, label);
      await page.evaluate(value => { (Array.from(document.querySelectorAll("button")).find(button => button.textContent?.trim() === value) as HTMLButtonElement).click(); }, label);
    };
    const text = "شاهد عربي اصطناعي لا يتضمن بيانات حقيقية\nBROWSER_SAFE_EVIDENCE";
    const file = join(root, "شاهد-اختبار.txt"); await writeFile(file, text);
    await page.goto(`${base}/evidence`);
    await page.evaluate(({ userId, id }) => sessionStorage.setItem(`sers-evidence-upload-v2:${userId}`, JSON.stringify({ id, state: "quarantined", revision: 1 })), { userId: ownerId, id: randomUUID() });
    await page.reload();
    await click("تحقق من الحالة واستكمل");
    await page.waitForFunction(() => document.body.innerText.includes("الطلب السابق لم يعد متاحًا"));
    assert.equal(await page.evaluate(userId => sessionStorage.getItem(`sers-evidence-upload-v2:${userId}`), ownerId), null);
    const input = await page.waitForSelector('section[aria-label="رفع ملف شاهد"] input[type="file"]'); assert(input);
    await (input as import("puppeteer").ElementHandle<HTMLInputElement>).uploadFile(file);
    await click("رفع وفحص الملف");
    await page.waitForFunction(() => document.body.innerText.includes("أُضيف الشاهد إلى مكتبتك"));
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);
    const [intent] = await db.select().from(uploadIntents).where(eq(uploadIntents.actorUserId, ownerId));
    assert.equal(intent.state, "ready"); assert(intent.assetId); assert(intent.scanPolicyVersion); assert(intent.scanEngineVersion);
    const [asset] = await db.select().from(assets).where(eq(assets.id, intent.assetId));
    assert.equal(asset.kind, "file"); assert.equal(asset.mimeType, "text/plain");
    const downloaded = await page.evaluate(async url => { const response = await fetch(url); return { status: response.status, text: await response.text(), disposition: response.headers.get("content-disposition") }; }, `/api/evidence/assets/${asset.id}/download`);
    assert.equal(downloaded.status, 200); assert.equal(downloaded.text, text); assert.match(downloaded.disposition!, /^attachment/);
    assert.equal((await fetch(`${base}/api/evidence/assets/${asset.id}/download`)).status, 401);
    assert.equal((await fetch(`${base}/api/evidence/assets/${asset.id}/download`, { headers: { Cookie: `sers_evidence_test=${outsiderSession}` } })).status, 404);
    const spoof = await fetch(`${base}/api/evidence/uploads/${intent.id}?revision=0`, { method: "PUT", headers: { Cookie: `sers_evidence_test=${session}`, Origin: "https://other.invalid", "Content-Type": "application/octet-stream" }, body: text });
    assert.equal(spoof.status, 403);

    const work = await createWorkItemForUser(ownerId, { title: "تقرير رحلة الشاهد والـWord", type: "report" }); assert(work);
    assert(await linkAssetToWorkForUser(ownerId, { workItemId: work.id, assetId: asset.id, role: "evidence" }));
    const draft = await saveReportDraftForUser(ownerId, { workItemId: work.id, expectedRevision: 0, templateId: "program-report", themeId: "formal", fontFamily: "Cairo", fields: { summary: "IMMUTABLE_WORD_ARABIC_REPORT تقرير عربي قابل للتعديل" }, evidenceAssetIds: [asset.id] });
    const version = await createReportDraftVersionForUser(ownerId, { workItemId: work.id, expectedRevision: draft.revision, reason: "اختبار" });
    await page.goto(`${base}/work/${work.id}/report`);
    await page.click('[aria-controls="report-pdf-actions"]');
    await page.waitForSelector('#report-pdf-actions');
    await click("Word قابل للتعديل");
    await click("إنشاء Word خاص");
    await page.waitForFunction(() => document.body.innerText.includes("تنزيل Word"));
    const [output] = await db.select().from(outputs).where(and(eq(outputs.workVersionId, version.id), eq(outputs.type, "docx")));
    assert(output); assert.equal(output.visibility, "private");
    const docx = await page.evaluate(async url => { const result = await fetch(url); return { status: result.status, mime: result.headers.get("content-type"), bytes: Array.from(new Uint8Array(await result.arrayBuffer())) }; }, `/api/work-outputs/${output.id}/download`);
    assert.equal(docx.status, 200); assert.match(docx.mime!, /wordprocessingml/); assert.deepEqual(docx.bytes.slice(0, 2), [80, 75]);
    const { default: JSZip } = await import("jszip");
    const archive = await JSZip.loadAsync(Buffer.from(docx.bytes));
    const xml = await archive.file("word/document.xml")!.async("string");
    assert.match(xml, /IMMUTABLE_WORD_ARABIC_REPORT/); assert.match(xml, /<w:bidi/);
    assert.equal((await fetch(`${base}/api/work-outputs/${output.id}/download`)).status, 401);
    assert.equal((await fetch(`${base}/api/work-outputs/${output.id}/download`, { headers: { Cookie: `sers_evidence_test=${outsiderSession}` } })).status, 404);
    // Revocation blocks a previously issued authenticated URL immediately.
    await db.update(outputs).set({ revokedAt: new Date() }).where(eq(outputs.id, output.id));
    assert.equal(await page.evaluate(async url => (await fetch(url)).status, `/api/work-outputs/${output.id}/download`), 404);
    assert.equal((await db.select().from(workAssetLinks).where(eq(workAssetLinks.assetId, asset.id))).length, 1);
  } finally {
    await browser?.close();
    if (server) { server.closeAllConnections(); await new Promise<void>(done => server!.close(() => done())); }
    await (db as unknown as { $client: { promise(): { end(): Promise<void> } } }).$client.promise().end();
    await rm(root, { recursive: true, force: true });
  }
});
