/** Production UI against deterministic HTTP fixtures. This verifies interaction,
 * layout, RTL/mobile viewports (320/360/390/1440), personal onboarding, and
 * reportIdentity schema v2 persistence — not MySQL authorization or external OAuth. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { mkdir } from "node:fs/promises";
import { resolve } from "node:path";
import express from "express";
import puppeteer from "puppeteer";
import superjson from "superjson";
import {
  applyTemplateSwitch,
  getReportTemplate,
  normalizeReportDraft,
  previewTemplateSwitch,
  REPORT_SCHEMA_VERSION,
  REPORT_TEMPLATE_DEFINITIONS,
} from "../../shared/report-projection";
import type { ReportIdentity } from "../../shared/report-appearance";

const ok = (data: unknown) => ({ result: { data: superjson.serialize(data) } });
const failure = (path: string, message: string) => ({ error: superjson.serialize({
  message, code: -32603, data: { code: "INTERNAL_SERVER_ERROR", httpStatus: 500, path },
}) });
const longText = "تقريرعربيطويلللتحققمنالتفافالنص".repeat(8);
const programTemplate = getReportTemplate("program-report")!;

test("report editor mobile layout, recovery, reportIdentity v2 and personal onboarding workflow", { timeout: 120_000 }, async t => {
  const app = express(); app.use(express.json());
  let loadFailure = true;
  let reviewFailure = true;
  let releaseSave: (() => void) | undefined;
  let delaySave = false;
  let saveStarted: (() => void) | undefined;
  let versionCalls = 0;
  let reviewCalls = 0;
  let createdWorks: Array<{ title: string; type: string; ownerType: string; academicYearId?: number; academicTermId?: number }> = [];
  const work = {
    id: 1, title: longText, type: "report", ownerType: "organization", ownerOrganizationId: 1,
    status: "draft", currentVersionNumber: 0,
    assets: [{ id: 11, title: longText, kind: "text", role: "evidence" }],
  };
  let draft: {
    schemaVersion: number;
    revision: number;
    templateId: string;
    templateVersionId: string;
    themeId: string;
    fontFamily: string;
    fields: Record<string, string | number | string[]>;
    fieldDefinitions: typeof programTemplate.fields;
    reportIdentity?: ReportIdentity;
    evidenceAssetIds: number[];
    updatedAt: string;
  } = {
    schemaVersion: REPORT_SCHEMA_VERSION,
    revision: 1,
    templateId: "program-report",
    templateVersionId: `${programTemplate.id}@${programTemplate.version}`,
    themeId: "formal",
    fontFamily: "Cairo",
    fields: { summary: longText },
    fieldDefinitions: programTemplate.fields,
    evidenceAssetIds: [],
    updatedAt: new Date().toISOString(),
  };
  const versions: { id: number; versionNumber: number; reason: string; reportRevision?: number }[] = [];
  const saved: Array<typeof draft> = [];
  const templateHistory: Array<{
    historyId: string;
    switchedAt: string;
    fromTemplateId: string;
    fromTemplateLabel: string;
    snapshot: typeof draft;
  }> = [];
  const switchCalls: Array<{ expectedRevision: number; targetTemplateId: string; unmappedStrategy: string }> = [];
  const rollbackCalls: Array<{ expectedRevision: number; historyId: string }> = [];
  let fixtureAssets = [
    {
      id: 11,
      title: "شاهد مرتبط بعمل نشط",
      kind: "text" as const,
      ownerType: "personal" as const,
      ownerUserId: 1,
      ownerOrganizationId: null,
      mimeType: null,
      fileSize: null,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      externalUrl: null,
      metadata: { text: "نص الشاهد التجريبي" },
    },
  ];
  const deleteAssetCalls: Array<{ id: number; unlinkActive?: boolean }> = [];
  app.all("/api/trpc/:paths", async (req, res) => {
    const paths = req.params.paths.split(",");
    const batched = req.query.batch === "1";
    const inputs = req.method === "POST" ? req.body : JSON.parse(String(req.query.input ?? "null"));
    const responses = await Promise.all(paths.map(async (path, index) => {
      const input: any = (batched ? inputs?.[index] : inputs) ? superjson.deserialize(batched ? inputs[index] : inputs) : undefined;
      switch (path) {
        case "auth.me": return ok({ id: 1, name: "مستخدم اصطناعي", role: "user" });
        case "auth.browserStorageKey": return ok({ key: "a".repeat(64), scope: "b".repeat(64) });
        case "domain.work.list": return ok([work]);
        case "domain.work.create": {
          createdWorks.push(input);
          return ok({ id: 99, title: input.title, type: input.type });
        }
        case "domain.work.get": return ok(work);
        case "domain.reportDraft.get": return loadFailure ? failure(path, "تعذر تحميل التقرير التجريبي") : ok({ work, draft, blockId: 1 });
        case "domain.reportDraft.previewTemplateSwitch": {
          const normalized = normalizeReportDraft(draft, { allowLegacy: false });
          return ok(previewTemplateSwitch(normalized, input.targetTemplateId));
        }
        case "domain.reportDraft.switchTemplate": {
          assert.equal(input.expectedRevision, draft.revision);
          switchCalls.push({
            expectedRevision: input.expectedRevision,
            targetTemplateId: input.targetTemplateId,
            unmappedStrategy: input.unmappedStrategy,
          });
          const normalized = normalizeReportDraft(draft, { allowLegacy: false });
          const switched = applyTemplateSwitch(normalized, input.targetTemplateId, input.unmappedStrategy);
          const historyId = `hist-${templateHistory.length + 1}`;
          const switchedAt = new Date().toISOString();
          templateHistory.unshift({
            historyId,
            switchedAt,
            fromTemplateId: draft.templateId,
            fromTemplateLabel: REPORT_TEMPLATE_DEFINITIONS[draft.templateId]?.label ?? draft.templateId,
            snapshot: structuredClone(draft),
          });
          draft = {
            ...switched,
            revision: draft.revision + 1,
            updatedAt: switchedAt,
          };
          return ok({ revision: draft.revision, updatedAt: draft.updatedAt, historyId });
        }
        case "domain.reportDraft.rollbackTemplate": {
          assert.equal(input.expectedRevision, draft.revision);
          rollbackCalls.push({ expectedRevision: input.expectedRevision, historyId: input.historyId });
          const entry = templateHistory.find(item => item.historyId === input.historyId);
          assert(entry, "history entry must exist for rollback");
          draft = {
            ...structuredClone(entry.snapshot),
            revision: draft.revision + 1,
            updatedAt: new Date().toISOString(),
          };
          return ok({ revision: draft.revision, updatedAt: draft.updatedAt });
        }
        case "domain.reportDraft.templateHistory":
          return ok(templateHistory.map(({ historyId, switchedAt, fromTemplateId, fromTemplateLabel }) => ({
            historyId, switchedAt, fromTemplateId, fromTemplateLabel,
          })));
        case "domain.asset.list": return ok(fixtureAssets);
        case "domain.asset.usage":
          return ok({
            assetId: input.id,
            activeLinks: [{ workItemId: 1, workTitle: "تقرير البرنامج الرئيسي", workType: "report", workStatus: "draft", role: "evidence" }],
            historicalVersionCount: 2,
          });
        case "domain.asset.delete": {
          deleteAssetCalls.push({ id: input.id, unlinkActive: input.unlinkActive });
          if (!input.unlinkActive) {
            return {
              error: superjson.serialize({
                message: "الشاهد مستخدم في أعمال أخرى. أكد فك الربط ثم الحذف.",
                code: -32009,
                data: { code: "CONFLICT", httpStatus: 409, path },
              }),
            };
          }
          fixtureAssets = fixtureAssets.filter(asset => asset.id !== input.id);
          return ok({ deleted: true, unlinkedCount: 1 });
        }
        case "reviewSupport.reviewers": return ok([{ userId: 2, name: "المراجع التجريبي", role: "reviewer" }]);
        case "reviewSupport.versions": return ok(versions);
        case "domain.reportDraft.save": {
          if (delaySave) { saveStarted?.(); await new Promise<void>(done => { releaseSave = done; }); }
          assert.equal(input.expectedRevision, draft.revision);
          draft = { ...draft, ...input, revision: draft.revision + 1, updatedAt: new Date().toISOString() };
          saved.push(structuredClone(draft));
          return ok({ revision: draft.revision, updatedAt: draft.updatedAt });
        }
        case "domain.reportDraft.createVersion": {
          assert.equal(input.expectedRevision, draft.revision); versionCalls++;
          const version = { id: versionCalls, versionNumber: versionCalls, reason: "نسخة اختبار", reportRevision: draft.revision };
          versions.push(version); return ok(version);
        }
        case "domain.review.request": reviewCalls++; return reviewFailure ? failure(path, "تعذر إرسال المراجعة، حاول مجددًا") : ok({ id: 1 });
        case "shareOutput.create": return ok({ id: 1, token: "synthetic-token".padEnd(64, "x"), type: input.type, visibility: input.visibility, expiresAt: null });
        case "domain.output.revoke": return ok({ id: 1 });
        case "domain.organization.listMine": return ok([]);
        case "account.academicYears.list": return ok([]);
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
    await page.setViewport({ width: 360, height: 740 });
    await page.goto(`${base}/work/1/report`);
    await t.test("initial load failure has an in-place retry", async () => {
      await visible("تعذر تحميل التقرير التجريبي"); loadFailure = false;
      await click("إعادة تحميل التقرير"); await page.waitForSelector('input[name="schoolName"]');
      assert.equal(page.url(), `${base}/work/1/report`);
      assert(await page.$eval("aside.fixed", node => node.getBoundingClientRect().left >= innerWidth - 1), "mobile sidebar starts closed");
    });
    await t.test("mobile back control stays reachable beside the fixed menu button at 390, 360 and 320px", async () => {
      for (const width of [390, 360, 320]) {
        await page.setViewport({ width, height: 740 });
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
      await page.setViewport({ width: 360, height: 740 });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.$eval("main", node => getComputedStyle(node).direction), "rtl");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
      await click("معاينة A4");
      const bounds = await page.$eval("article", node => ({ client: node.clientWidth, scroll: node.scrollWidth }));
      assert(bounds.scroll <= bounds.client + 1, "preview must wrap long content rather than clip it");
      if (artifactDir) await page.screenshot({ path: resolve(artifactDir, "editor-mobile-360.png"), fullPage: true });
      await click("التحرير");
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
    await t.test("top-level reportIdentity and evidence save before version creation even while a save is pending", async () => {
      await page.locator('input[name="schoolName"]').fill("مدرسة التحقق");
      await page.locator('input[name="reportPreparer"]').fill("معد التقرير التجريبي");
      await page.locator('input[name="schoolPrincipal"]').fill("مدير المدرسة التجريبي");
      await page.click('input[name="ministryLogo"]');
      const schoolLogo = await page.$('input[name="schoolLogoPng"]'); assert(schoolLogo);
      await (schoolLogo as import("puppeteer").ElementHandle<HTMLInputElement>).uploadFile(resolve("shared/report-assets/ministry-logo.png"));
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
      assert.equal(saved.at(-1)?.reportIdentity?.schoolName, "مدرسة التحقق");
      assert.equal(saved.at(-1)?.reportIdentity?.ministryLogo, true);
      assert(saved.at(-1)?.reportIdentity?.schoolLogoPng);
      assert.equal("schoolName" in (saved.at(-1)?.fields ?? {}), false, "v2 fields must not contain identity smuggling keys");
      assert.deepEqual(saved.at(-1)?.evidenceAssetIds, [11]);
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
    await t.test("QR sharing and PDF panels stay mutually exclusive and on screen at 360px", async () => {
      await page.click('[aria-controls="report-share-actions"]');
      await page.waitForSelector("#report-share-actions"); await click("QR"); await click("إنشاء QR");
      await page.waitForSelector('img[alt="QR للمخرج الموثق"]');
      const rect = await page.$eval("#report-share-actions", node => { const box = node.getBoundingClientRect(); return { top: box.top, bottom: box.bottom, left: box.left, right: box.right, viewport: innerWidth }; });
      assert(rect.top >= 0 && rect.left >= 0 && rect.right <= rect.viewport, JSON.stringify(rect));
      await page.evaluate(() => Object.defineProperty(navigator, "clipboard", { configurable: true, value: { async writeText() { throw new Error("Clipboard access denied"); } } }));
      await click("نسخ الرابط"); await visible("تعذّر نسخ الرابط تلقائيًا");
      assert.deepEqual(errors, []);
      await click("إلغاء المخرج"); await visible("إنشاء QR");
      // Mutual exclusion: opening PDF panel while Share is open must close Share panel
      await page.click('[aria-controls="report-pdf-actions"]');
      await page.waitForSelector("#report-pdf-actions");
      assert.equal(await page.$("#report-share-actions"), null, "PDF panel opening must close Share panel");
      assert(await page.$eval("#report-pdf-actions", node => node.getBoundingClientRect().top >= 0));
      await page.click('[aria-label="إغلاق نافذة المخرجات"]');
    });
    await t.test("personal user creates a work without any school or academic year (WorkHub DG-02)", async () => {
      await page.goto(`${base}/work`);
      await click("إنشاء عمل");
      await page.waitForSelector('[role="dialog"]');
      await page.locator("#work-title").fill("تقرير معلم فردي بدون مدرسة");
      await click("إنشاء");
      await page.waitForFunction(() => location.pathname === "/work/99");
      assert.equal(createdWorks.length, 1);
      assert.equal(createdWorks[0].ownerType, "personal");
      assert.equal(createdWorks[0].academicYearId, undefined);
      assert.equal(createdWorks[0].academicTermId, undefined);
    });
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
    await t.test("evidence delete with active links requires explicit unlink checkbox confirmation (R04)", async () => {
      await visible("شاهد مرتبط بعمل نشط");
      const deleteButton = await page.waitForSelector('button[aria-label="حذف الشاهد شاهد مرتبط بعمل نشط"]');
      assert(deleteButton);
      await deleteButton.evaluate(node => node.scrollIntoView({ block: "center" }));
      await deleteButton.click();
      await page.waitForSelector('[role="dialog"]');
      await visible("النسخ الثابتة المحفوظة سابقًا لا تتأثر بالحذف");
      await visible("مستخدم في 2 نسخة ثابتة محفوظة");
      await visible("تقرير البرنامج الرئيسي");
      const disabledBeforeCheck = await page.evaluate(() => {
        const btn = Array.from(document.querySelectorAll('[role="dialog"] button')).find(node => node.textContent?.trim() === "حذف الشاهد") as HTMLButtonElement | undefined;
        return Boolean(btn?.disabled);
      });
      assert.equal(disabledBeforeCheck, true, "delete confirm button must stay disabled until checkbox is ticked");
      await page.click('[role="dialog"] input[type="checkbox"]');
      await click("حذف الشاهد");
      await page.waitForSelector('[role="dialog"]', { hidden: true });
      assert.deepEqual(deleteAssetCalls, [{ id: 11, unlinkActive: true }]);
      await visible("مكتبة الشواهد فارغة");
    });
    await t.test("non-destructive v2 template switch previews mappings, appends unmapped fields, and supports rollback (R12)", async () => {
      // Seed an unmapped program-report field before switching to initiative-report
      draft = {
        ...draft,
        fields: {
          ...draft.fields,
          subject: "برنامج التفوق العلمي",
        },
      };
      await page.goto(`${base}/work/1/report`);
      await page.waitForSelector('input[name="schoolName"]');
      const revisionBeforeSwitch = draft.revision;
      await page.select("section select", "initiative-report");
      await page.waitForSelector('[role="dialog"]');
      await visible("تبديل قالب التقرير بأمان");
      await visible("الحقول المنقولة تلقائيًا");
      await visible("حقول ممتلئة غير موجودة في القالب الجديد");
      await visible("برنامج التفوق العلمي");
      await click("تطبيق القالب بأمان");
      await page.waitForSelector('[role="dialog"]', { hidden: true });
      await visible("تم تبديل القالب");
      assert.equal(switchCalls.length, 1);
      assert.equal(switchCalls[0].expectedRevision, revisionBeforeSwitch);
      assert.equal(switchCalls[0].targetTemplateId, "initiative-report");
      assert.equal(switchCalls[0].unmappedStrategy, "append_to_summary");
      assert.equal(draft.templateId, "initiative-report");
      assert(String(draft.fields.summary).includes("برنامج التفوق العلمي"));
      await click("تراجع");
      await page.waitForFunction(() => !document.body.innerText.includes("تم تبديل القالب"));
      assert.equal(rollbackCalls.length, 1);
      assert.equal(draft.templateId, "program-report");
    });
    assert.deepEqual(errors, []);
  } finally {
    releaseSave?.(); await browser.close(); server.closeAllConnections();
    await new Promise<void>(done => server.close(() => done()));
  }
});
