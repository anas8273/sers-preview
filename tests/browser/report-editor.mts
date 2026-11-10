/** Production UI against deterministic HTTP fixtures. This verifies interaction,
 * layout and recovery, not MySQL authorization or external OAuth. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import puppeteer from "puppeteer";
import superjson from "superjson";

const ok = (data: unknown) => ({ result: { data: superjson.serialize(data) } });
const failure = (path: string, message: string) => ({ error: superjson.serialize({
  message, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, path },
}) });
const longText = "تقريرعربيطويلللتحققمنالتفافالنص".repeat(8);

test("report editor mobile layout, recovery and version workflow", { timeout: 120_000 }, async t => {
  const app = express(); app.use(express.json());
  let loadFailure = true;
  let reviewFailure = true;
  let releaseSave: (() => void) | undefined;
  let delaySave = false;
  let saveStarted: (() => void) | undefined;
  let versionCalls = 0;
  let reviewCalls = 0;
  const work = { id: 1, title: longText, type: "report", ownerType: "organization", ownerOrganizationId: 1,
    status: "draft", currentVersionNumber: 0,
    assets: [{ id: 11, title: longText, kind: "text", role: "evidence" }] };
  let draft = { revision: 1, templateId: "program-report", themeId: "formal", fontFamily: "Cairo",
    fields: { summary: longText } as Record<string, string>, evidenceAssetIds: [] as number[], updatedAt: new Date().toISOString() };
  const versions: { id: number; versionNumber: number; reason: string }[] = [];
  const saved: typeof draft[] = [];
  app.all("/api/trpc/:paths", async (req, res) => {
    const paths = req.params.paths.split(",");
    const batched = req.query.batch === "1";
    const inputs = req.method === "POST" ? req.body : JSON.parse(String(req.query.input ?? "null"));
    const responses = await Promise.all(paths.map(async (path, index) => {
      const input: any = (batched ? inputs?.[index] : inputs) ? superjson.deserialize(batched ? inputs[index] : inputs) : undefined;
      switch (path) {
        case "auth.me": return ok({ id: 1, name: "مستخدم اصطناعي", role: "user" });
        case "auth.browserStorageKey": return ok({ key: "a".repeat(64), scope: "b".repeat(64) });
        case "domain.work.get": return ok(work);
        case "domain.reportDraft.get": return loadFailure ? failure(path, "تعذر تحميل التقرير التجريبي") : ok({ work, draft, blockId: 1 });
        case "reviewSupport.reviewers": return ok([{ userId: 2, name: "المراجع التجريبي", role: "reviewer" }]);
        case "reviewSupport.versions": return ok(versions);
        case "domain.reportDraft.save": {
          if (delaySave) { saveStarted?.(); await new Promise<void>(done => { releaseSave = done; }); }
          assert.equal(input.expectedRevision, draft.revision);
          draft = { ...input, revision: draft.revision + 1, updatedAt: new Date().toISOString() };
          saved.push(structuredClone(draft)); return ok({ revision: draft.revision, updatedAt: draft.updatedAt });
        }
        case "domain.reportDraft.createVersion": {
          assert.equal(input.expectedRevision, draft.revision); versionCalls++;
          const version = { id: versionCalls, versionNumber: versionCalls, reason: "نسخة اختبار" }; versions.push(version); return ok(version);
        }
        case "domain.review.request": reviewCalls++; return reviewFailure ? failure(path, "تعذر إرسال المراجعة، حاول مجددًا") : ok({ id: 1 });
        case "shareOutput.create": return ok({ id: 1, token: "synthetic-token".padEnd(64, "x"), type: input.type, visibility: input.visibility, expiresAt: null });
        case "domain.output.revoke": return ok({ id: 1 });
        case "domain.organization.listMine": return ok([]);
        case "evidenceUpload.capabilities": return ok({ enabled: false, maxBytes: 0 });
        default: return ok([]);
      }
    }));
    res.json(batched ? responses : responses[0]);
  });
  app.use(express.static(resolve("dist/public")));
  app.get("*", (_req, res) => res.sendFile(resolve("dist/public/index.html")));
  const server = app.listen(0, "127.0.0.1");
  await new Promise<void>(done => server.once("listening", done));
  const address = server.address(); assert(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  const artifactDir = process.env.SERS_EDITOR_ARTIFACT_DIR;
  if (artifactDir) await mkdir(artifactDir, { recursive: true });
  const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
  try {
    const page = await browser.newPage(); page.setDefaultTimeout(10_000);
    const errors: string[] = [];
    page.on("pageerror", error => errors.push(error.message));
    const visible = (value: string) => page.waitForFunction(text => document.body.innerText.includes(text), {}, value);
    const click = async (value: string) => {
      const button = await page.waitForFunction(text => Array.from(document.querySelectorAll("button")).find(node => node.textContent?.trim() === text && !node.disabled), {}, value);
      await button.asElement()!.evaluate(node => node.scrollIntoView({ block: "center" }));
      await button.asElement()!.click(); await button.dispose();
    };
    await page.setViewport({ width: 320, height: 700 });
    await page.goto(`${base}/work/1/report`);
    await t.test("initial load failure has an in-place retry", async () => {
      await visible("تعذر تحميل التقرير التجريبي"); loadFailure = false;
      await click("إعادة تحميل التقرير"); await page.waitForSelector('input[name="schoolName"]');
      assert.equal(page.url(), `${base}/work/1/report`);
      assert(await page.$eval("aside.fixed", node => node.getBoundingClientRect().left >= innerWidth - 1), "mobile sidebar starts closed");
    });
    await t.test("mobile back control stays reachable beside the fixed menu button", async () => {
      for (const width of [390, 320]) {
        await page.setViewport({ width, height: 700 });
        const target = await page.evaluate(() => {
          window.scrollTo(0, 0);
          const back = Array.from(document.querySelectorAll("main button")).find(node => node.textContent?.trim() === "العودة إلى العمل")!;
          const arrow = back.querySelector("svg")!.getBoundingClientRect();
          const rect = back.getBoundingClientRect();
          const hit = document.elementFromPoint(arrow.x + arrow.width / 2, arrow.y + arrow.height / 2);
          return { reachable: back.contains(hit), rect: { x: rect.x, y: rect.y, width: rect.width, height: rect.height }, hit: hit?.closest("button")?.getAttribute("aria-label") };
        });
        assert.equal(target.reachable, true, JSON.stringify({ width, ...target }));
      }
    });
    await t.test("long report content fits a narrow RTL viewport and remains visible", async () => {
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.$eval("main", node => getComputedStyle(node).direction), "rtl");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      const bounds = await page.$eval("article", node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
      assert(bounds.scroll <= bounds.client + 1, "preview must wrap long content rather than clip it");
      if (artifactDir) await page.screenshot({ path: resolve(artifactDir, "editor-mobile.png"), fullPage: true });
    });
    await t.test("autosave persists edits and reconnect saves the offline draft", async () => {
      await page.locator("textarea").fill("تقرير محفوظ تلقائيًا — AUTOSAVE");
      await visible("محفوظ في الخادم");
      assert.equal(saved.at(-1)?.fields.summary, "تقرير محفوظ تلقائيًا — AUTOSAVE");
      await page.setOfflineMode(true);
      await page.locator("textarea").fill("تعديل أثناء انقطاع الشبكة — OFFLINE_RECOVERY");
      await visible("غير متصل بالخادم");
      assert.notEqual(saved.at(-1)?.fields.summary, "تعديل أثناء انقطاع الشبكة — OFFLINE_RECOVERY");
      await page.setOfflineMode(false); await visible("محفوظ في الخادم");
      assert.equal(saved.at(-1)?.fields.summary, "تعديل أثناء انقطاع الشبكة — OFFLINE_RECOVERY");
    });
    await t.test("identity and evidence save before version creation even while a save is pending", async () => {
      await page.locator('input[name="schoolName"]').fill("مدرسة التحقق");
      await page.locator('input[name="reportPreparer"]').fill("معد التقرير التجريبي");
      await page.locator('input[name="schoolPrincipal"]').fill("مدير المدرسة التجريبي");
      await page.click('input[name="ministryLogo"]');
      const schoolLogo = await page.$('input[name="schoolLogoPng"]'); assert(schoolLogo);
      await (schoolLogo as import("puppeteer").ElementHandle<HTMLInputElement>).uploadFile(resolve("shared/report-assets/ministry-logo.png"));
      await page.waitForSelector('article img[alt="شعار المدرسة"]');
      await visible("أُضيف شعار المدرسة إلى المسودة");
      await page.focus('input[name="schoolLogoPng"]');
      assert.equal(await page.evaluate(() => document.activeElement?.getAttribute("name")), "schoolLogoPng", "custom Arabic logo picker remains keyboard focusable");
      const checkboxes = await page.$$('section input[type="checkbox"]');
      assert(checkboxes.length >= 2); await checkboxes[1].click();
      const started = new Promise<void>(done => { saveStarted = done; }); delaySave = true;
      await click("حفظ الآن"); await started;
      await click("إنشاء نسخة ثابتة");
      assert.equal(versionCalls, 0, "version creation must wait for pending server save");
      delaySave = false; releaseSave?.();
      await visible("تم إنشاء النسخة 1");
      assert.equal(saved.at(-1)?.fields.schoolName, "مدرسة التحقق");
      assert.deepEqual(saved.at(-1)?.evidenceAssetIds, [11]);
      assert.equal(saved.at(-1)?.fields.ministryLogo, "yes");
      assert(saved.at(-1)?.fields.schoolLogoPng);
      assert.equal(versionCalls, 1);
    });
    await t.test("review rejection preserves the version and retries without an uncaught promise", async () => {
      await page.select('select[aria-label="مراجع التقرير"]', "2");
      await click("إرسال النسخة للمراجعة"); await visible("تعذر إرسال المراجعة، حاول مجددًا");
      assert.equal(page.url(), `${base}/work/1/report`);
      assert.deepEqual(errors, []);
      reviewFailure = false; await click("إرسال النسخة للمراجعة");
      await page.waitForFunction(() => location.pathname === "/reviews"); assert.equal(reviewCalls, 2);
      await page.goto(`${base}/work/1/report`); await page.waitForSelector('input[name="schoolName"]');
    });
    await t.test("QR sharing panel stays on screen with reachable close and revoke controls", async () => {
      await page.click('[aria-controls="report-share-actions"]');
      await page.waitForSelector("#report-share-actions"); await click("QR"); await click("إنشاء QR");
      await page.waitForSelector('img[alt="QR للمخرج الموثق"]');
      const rect = await page.$eval("#report-share-actions", node => { const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, viewport: innerWidth }; });
      assert(rect.top >= 0 && rect.left >= 0 && rect.right <= rect.viewport, JSON.stringify(rect));
      if (artifactDir) await page.screenshot({ path: resolve(artifactDir, "share-mobile.png") });
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { async writeText() { throw new Error("Clipboard access denied"); } } }));
      await click("نسخ الرابط"); await visible("تعذّر نسخ الرابط تلقائيًا");
      assert.deepEqual(errors, []);
      await click("إلغاء المخرج"); await visible("إنشاء QR");
      await page.click('[aria-label="إغلاق نافذة المشاركة"]');
      await page.click('[aria-controls="report-pdf-actions"]'); await page.waitForSelector("#report-pdf-actions");
      assert(await page.$eval("#report-pdf-actions", node => node.getBoundingClientRect().top >= 0));
      await page.click('[aria-label="إغلاق نافذة المخرجات"]');
    });
    if (artifactDir) {
      work.title = "تقرير برنامج تنمية مهارات القراءة";
      draft.fields.summary = "نُفذ البرنامج لدعم مهارات القراءة والفهم، بمشاركة فريق المدرسة. يوثق التقرير الأنشطة الفعلية والشواهد والنتائج، مع مراجعتها قبل الاعتماد.";
      await page.setViewport({ width: 1440, height: 1000 }); await page.reload();
      await page.waitForSelector('input[name="schoolName"]'); await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ path: resolve(artifactDir, "editor-desktop.png"), fullPage: true });
      await page.setViewport({ width: 390, height: 844 });
      await page.waitForFunction(() => (document.querySelector("aside.fixed")?.getBoundingClientRect().left ?? 0) >= innerWidth - 1);
      await page.screenshot({ path: resolve(artifactDir, "editor-mobile-identity.png"), fullPage: true });
    }
    await t.test("personal reports explain the school-approval requirement without offering an impossible share", async () => {
      work.ownerType = "personal";
      await page.goto(`${base}/work/1/report`); await page.waitForSelector('input[name="schoolName"]');
      await page.click('[aria-controls="report-share-actions"]');
      await visible("التقارير الشخصية تدعم تنزيل PDF وWord بشكل خاص");
      assert.equal(await page.$eval("#report-share-actions", node => Array.from(node.querySelectorAll("button")).some(button => /إنشاء (QR|الرابط)/.test(button.textContent ?? ""))), false);
      await page.click('[aria-label="إغلاق نافذة المشاركة"]');
      await page.click('[aria-controls="report-pdf-actions"]');
      await click("Word قابل للتعديل");
      assert(await page.waitForFunction(() => Array.from(document.querySelectorAll("button")).some(button => button.textContent?.trim() === "إنشاء Word خاص" && !button.disabled)));
    });
    await t.test("evidence creation dialog has named fields, contains focus and closes with Escape", async () => {
      await page.goto(`${base}/evidence`); await click("إضافة شاهد");
      await page.waitForSelector('[role="dialog"]');
      assert.equal(await page.$eval("#evidence-title", node => document.activeElement === node), true);
      await page.locator("#evidence-title").fill("شاهد اصطناعي");
      assert(await page.$('label[for="evidence-title"]'));
      await page.focus('[role="dialog"] button:last-of-type'); await page.keyboard.press("Tab");
      assert.equal(await page.evaluate(() => document.querySelector('[role="dialog"]')?.contains(document.activeElement)), true);
      await page.keyboard.press("Escape"); await page.waitForSelector('[role="dialog"]', { hidden: true });
      assert.equal(await page.evaluate(() => document.activeElement?.textContent?.trim()), "إضافة شاهد");
    });
    assert.deepEqual(errors, []);
  } finally {
    releaseSave?.(); await browser.close(); server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
  }
});
