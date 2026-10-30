import { decryptedRecords, decryptedFile } from "./private-storage-helpers.mts";
/** Real browser + production OAuth/AI routes + disposable MySQL. The separate
 * provider is synthetic; proposed classifications are never execution proof. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { test } from "node:test";
import { PNG } from "pngjs";
import puppeteer, { type Page } from "puppeteer";
import { startAiHarness } from "../fixtures/ai-http-harness";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.SERS_INTEGRATION, "1");
assert.equal(process.env.DATABASE_URL, "mysql://root:root@127.0.0.1:3306/sers_test");

const classification = (confidence: number) => JSON.stringify({ standardId: "std-1", standardNumber: 1,
  standardName: "اسم يقترحه المزود ولا يحل محل التصنيف المحلي", indicatorIndex: 1, indicatorText: "اقتراح اصطناعي",
  subIndicatorIndex: 0, subIndicatorText: "", confidence, reasoning: "اقتراح تنظيمي يحتاج مراجعة بشرية",
  contentDescription: "صورة اختبار اصطناعية وليست دليل تنفيذ", suggestedPriority: "supporting", suggestedKeywords: ["تخطيط"] });
const visible = (page: Page, value: string) => page.waitForFunction(text => document.body.innerText.includes(text), {}, value);
async function clickButton(page: Page, text: string, selector = "body") {
  await page.waitForFunction(({ text, selector }) => Array.from(document.querySelector(selector)?.querySelectorAll("button") ?? []).some(button => button.textContent?.trim() === text && !button.disabled), {}, { text, selector });
  await page.evaluate(({ text, selector }) => {
    const button = Array.from(document.querySelector(selector)?.querySelectorAll("button") ?? []).find(item => item.textContent?.trim() === text && !item.disabled);
    if (!button) throw new Error("Required user control unavailable"); button.click();
  }, { text, selector });
}
async function storedState(page: Page, userId: number) {
  const records = await decryptedRecords(page);
  const stored = JSON.parse(records.sers_perf_state ?? "{}");
  const pending = JSON.parse(records[`sers_pending_evidence_v2_${userId}_teacher`] ?? "[]");
  const learning = JSON.parse(records[`sers_learning_log_v2_${userId}_teacher`] ?? "[]");
    const associations = Object.entries(stored.criteriaData ?? {}).flatMap(([criterionId, value]) =>
      ((value as { evidences?: Array<{ id: string; fileName: string; subEvidenceId: string }> }).evidences ?? []).map(evidence => ({ criterionId, id: evidence.id, fileName: evidence.fileName, subEvidenceId: evidence.subEvidenceId })));
    return { pending, learning, associations };
}
const localFile = decryptedFile;
async function chooseDestination(page: Page, article: string, optionIndex: number) {
  const criterion = `${article} select[id^="criterion-"]`, sub = `${article} select[id^="sub-"]`;
  const criterionId = await page.$eval(criterion, (element, index) => (element as HTMLSelectElement).options[index].value, optionIndex);
  await page.select(criterion, criterionId);
  await page.waitForFunction(selector => ((document.querySelector(selector) as HTMLSelectElement | null)?.options.length ?? 0) > 1, {}, sub);
  const subEvidenceId = await page.$eval(sub, element => (element as HTMLSelectElement).options[1].value);
  await page.select(sub, subEvidenceId); return { criterionId, subEvidenceId };
}

test("AI suggestions require explicit user confirmation; low confidence, rejection and provider outage retain manual work", { timeout: 120_000 }, async () => {
  const harness = await startAiHarness({ env: { SERS_AI_USER_MINUTE_LIMIT: "10", SERS_AI_USER_DAILY_LIMIT: "30", SERS_AI_GLOBAL_DAILY_LIMIT: "300" } });
  const temporary = await mkdtemp(path.join(tmpdir(), "sers-ai-browser-"));
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  const png = new PNG({ width: 2, height: 2 }); png.data.fill(230);
  const bytes = PNG.sync.write(png), originalData = `data:image/png;base64,${bytes.toString("base64")}`;
  const names = ["low-confidence.png", "high-confidence.png", "provider-outage.png", "idb-write-failure.png", "mapping-write-failure.png"];
  const largePng = new PNG({ width: 256, height: 256 }); largePng.data.set(randomBytes(largePng.data.length));
  const largeBytes = PNG.sync.write(largePng), largeOriginalData = `data:image/png;base64,${largeBytes.toString("base64")}`;
  assert(largeOriginalData.length > 100_000);
  for (const name of names) await writeFile(path.join(temporary, name), name === names[3] ? largeBytes : bytes);
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const context = await browser.createBrowserContext(), page = await context.newPage(); page.setDefaultTimeout(20_000);
    const calledRoutes: string[] = [];
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = request.url(); calledRoutes.push(url);
      if (url.startsWith(`${harness.base}/`) || url.startsWith(`${harness.issuerBase}/`) || url.startsWith("data:") || url.startsWith("blob:")) void request.continue();
      else void request.abort();
    });
    await page.goto(`${harness.base}/account`); await visible(page, "تسجيل الدخول");
    await Promise.all([page.waitForNavigation(), page.click('a[href^="/api/oauth/start"]')]);
    await page.waitForSelector("#issuer-sign-in");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#issuer-sign-in")]);
    const me = await page.evaluate(async () => {
      const response = await fetch("/api/trpc/auth.me"); return (await response.json()).result.data.json;
    });
    assert(Number.isSafeInteger(me.id)); const userId = me.id as number;
    await page.goto(`${harness.base}/performance-evidence`); await visible(page, "معلم / معلمة");
    await page.evaluate(() => {
      const heading = Array.from(document.querySelectorAll("h3")).find(item => item.textContent?.trim() === "معلم / معلمة");
      if (!heading) throw new Error("Teacher role choice unavailable"); heading.click();
    });
    const uploadSelector = 'input[type="file"][aria-label="إضافة ملفات للمراجعة"]';
    await page.waitForSelector(uploadSelector);
    await page.evaluate(() => localStorage.setItem("sers_learning_log_teacher", JSON.stringify([{ fileName: "OTHER_ACCOUNT_PRIVATE_LEGACY_MARKER", criterionId: "std-1", criterionTitle: "قديم", subEvidenceId: "std-1-item-1", subEvidenceTitle: "قديم", confirmedByUser: true }])));
    const upload = async (name: string) => {
      const input = await page.$(uploadSelector); assert(input); await input.uploadFile(path.join(temporary, name));
      await page.waitForSelector(`article[aria-label="مراجعة ${name}"]`);
    };
    const article = (name: string) => `article[aria-label="مراجعة ${name}"]`;

    harness.setDefault("success", classification(0.35));
    await upload(names[0]); await visible(page, "الثقة منخفضة؛ اختر التصنيف بنفسك قبل الاعتماد.");
    let state = await storedState(page, userId);
    assert.equal(state.pending.length, 1); assert.equal(state.learning.length, 0); assert.equal(state.associations.length, 0);
    assert.deepEqual(await page.$$eval(`${article(names[0])} select`, elements => elements.map(element => (element as HTMLSelectElement).value)), ["", ""]);
    assert.equal((await localFile(page, names[0]))?.data, originalData);
    const callsBeforeReload = harness.calls.length;
    await page.reload(); await visible(page, "الثقة منخفضة؛ اختر التصنيف بنفسك قبل الاعتماد.");
    assert.equal(harness.calls.length, callsBeforeReload);
    state = await storedState(page, userId); assert.equal(state.pending.length, 1); assert.equal(state.associations.length, 0);
    await clickButton(page, "رفض الاقتراح", article(names[0])); await visible(page, "رُفض الاقتراح.");
    state = await storedState(page, userId); assert.equal(state.pending[0].status, "unclassified"); assert.equal(state.learning.length, 0);
    assert.equal((await localFile(page, names[0]))?.data, originalData);
    const selected = await chooseDestination(page, article(names[0]), 2);
    await clickButton(page, "اعتماد التصنيف", article(names[0]));
    await page.waitForSelector(article(names[0]), { hidden: true });
    state = await storedState(page, userId);
    assert.equal(state.pending.length, 0); assert.equal(state.associations.length, 1); assert.equal(state.learning.length, 1);
    assert.equal(state.associations[0].criterionId, selected.criterionId); assert.equal(state.associations[0].subEvidenceId, selected.subEvidenceId);
    assert.equal(state.learning[0].confirmedByUser, true); assert.equal(state.learning[0].fileName, names[0]);
    await page.reload(); await page.waitForSelector(uploadSelector);
    assert.equal((await storedState(page, userId)).associations.length, 1);

    harness.setDefault("success", classification(0.95));
    await upload(names[1]); await visible(page, "اقتراح غير معتمد.");
    await page.waitForFunction(selector => Array.from(document.querySelectorAll(`${selector} select`)).every(element => Boolean((element as HTMLSelectElement).value)), {}, article(names[1]));
    state = await storedState(page, userId); assert.equal(state.associations.length, 1); assert.equal(state.learning.length, 1);
    assert.equal(state.associations.some((row: { fileName: string }) => row.fileName === names[1]), false);
    await clickButton(page, "رفض الاقتراح", article(names[1]));
    await page.waitForFunction(selector => Array.from(document.querySelectorAll(`${selector} select`)).every(element => !(element as HTMLSelectElement).value), {}, article(names[1]));
    assert.equal((await storedState(page, userId)).learning.length, 1);

    harness.setDefault("failure"); await upload(names[2]);
    await page.waitForFunction(selector => {
      const element = document.querySelector(selector); return Boolean(element && !element.textContent?.includes("جارٍ إعداد اقتراح") && element.textContent?.includes("يدوي"));
    }, {}, article(names[2]));
    state = await storedState(page, userId);
    assert.equal(state.pending.length, 2); assert.equal(state.associations.length, 1); assert.equal(state.learning.length, 1);
    assert.equal((await localFile(page, names[2]))?.data, originalData);
    await page.reload(); await page.waitForSelector(article(names[2]));
    assert.equal((await localFile(page, names[2]))?.data, originalData);
    const outageDestination = await chooseDestination(page, article(names[2]), 1);
    await clickButton(page, "اعتماد التصنيف", article(names[2])); await page.waitForSelector(article(names[2]), { hidden: true });
    state = await storedState(page, userId);
    assert.equal(state.associations.length, 2); assert.equal(state.learning.length, 2); assert.equal(state.pending.length, 1);
    const outageEvidence = state.associations.find((row: { fileName: string }) => row.fileName === names[2]);
    assert(outageEvidence); assert.equal(outageEvidence.criterionId, outageDestination.criterionId); assert.equal(outageEvidence.subEvidenceId, outageDestination.subEvidenceId);
    assert.equal(state.learning.every((entry: { confirmedByUser: boolean }) => entry.confirmedByUser === true), true);
    assert.equal(state.pending[0].fileName, names[1]); assert.equal((await localFile(page, names[1]))?.data, originalData);

    // A large original kept only in memory must not be silently dropped by
    // local draft serialization when its first IndexedDB write fails.
    harness.setDefault("success", classification(0.95));
    await page.evaluate(() => {
      const original = IDBFactory.prototype.open;
      (window as unknown as { __sersRestoreIDB?: () => void }).__sersRestoreIDB = () => { IDBFactory.prototype.open = original; };
      IDBFactory.prototype.open = function () { throw new DOMException("Synthetic local storage denial", "QuotaExceededError"); };
    });
    try {
      await upload(names[3]); await visible(page, "لم يكتمل الحفظ على الجهاز.");
      await page.waitForFunction(selector => Array.from(document.querySelectorAll(`${selector} select`)).every(element => Boolean((element as HTMLSelectElement).value)), {}, article(names[3]));
      await clickButton(page, "اعتماد التصنيف", article(names[3]));
      await page.waitForFunction(selector => document.querySelector(selector)?.textContent?.includes("لم يُعتمد التصنيف"), {}, article(names[3]));
      state = await storedState(page, userId);
      assert.equal(state.associations.length, 2); assert.equal(state.learning.length, 2);
      assert.equal(state.pending.some((entry: { fileName: string }) => entry.fileName === names[3]), false, "RAM-only bytes must not be represented as a durably stored queue entry");
      assert(await page.$(article(names[3])), "The unsaved original must remain in the visible pending queue");
    } finally {
      await page.evaluate(() => (window as unknown as { __sersRestoreIDB?: () => void }).__sersRestoreIDB?.());
    }
    await clickButton(page, "اعتماد التصنيف", article(names[3])); await page.waitForSelector(article(names[3]), { hidden: true });
    state = await storedState(page, userId); assert.equal(state.associations.length, 3); assert.equal(state.learning.length, 3);
    assert.equal((await localFile(page, names[3]))?.data, largeOriginalData);
    await page.reload(); await page.waitForSelector(uploadSelector);
    assert.equal((await localFile(page, names[3]))?.data, largeOriginalData); assert.equal((await storedState(page, userId)).associations.length, 3);

    // If a mapping cannot be saved, a retry with a different selected target
    // must move the one original ID and record the same destination in learning.
    await upload(names[4]); await visible(page, "اقتراح غير معتمد.");
    await page.waitForFunction(selector => Array.from(document.querySelectorAll(`${selector} select`)).every(element => Boolean((element as HTMLSelectElement).value)), {}, article(names[4]));
    const initialDestination = await chooseDestination(page, article(names[4]), 1);
    await page.evaluate(async () => {
      const { scope } = (await (await fetch("/api/trpc/auth.browserStorageKey")).json()).result.data.json;
      const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode("sers_perf_state"))), v => v.toString(16).padStart(2, "0")).join("");
      const encryptedKey = `sers:vault:v1:${scope}:${digest}`;
      const original = Storage.prototype.setItem;
      (window as unknown as { __sersRestoreDraft?: () => void }).__sersRestoreDraft = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function (key, value) {
        if (this === localStorage && key === encryptedKey) throw new DOMException("Synthetic draft storage denial", "QuotaExceededError");
        return original.call(this, key, value);
      };
    });
    try {
      await clickButton(page, "اعتماد التصنيف", article(names[4])); await visible(page, "تعذر حفظ التصنيف على الجهاز");
      state = await storedState(page, userId);
      assert.equal(state.associations.length, 3); assert.equal(state.learning.length, 3);
      assert(state.pending.some((entry: { fileName: string }) => entry.fileName === names[4]));
      assert(await page.$(article(names[4])));
    } finally {
      await page.evaluate(() => (window as unknown as { __sersRestoreDraft?: () => void }).__sersRestoreDraft?.());
    }
    const replacementDestination = await chooseDestination(page, article(names[4]), 2);
    assert.notEqual(initialDestination.criterionId, replacementDestination.criterionId);
    await clickButton(page, "اعتماد التصنيف", article(names[4])); await page.waitForSelector(article(names[4]), { hidden: true });
    state = await storedState(page, userId);
    const replacement = state.associations.filter(row => row.fileName === names[4]);
    assert.equal(replacement.length, 1); assert.equal(replacement[0].criterionId, replacementDestination.criterionId); assert.equal(replacement[0].subEvidenceId, replacementDestination.subEvidenceId);
    const learnedReplacement = state.learning.filter((row: { fileName: string }) => row.fileName === names[4]);
    assert.equal(learnedReplacement.length, 1); assert.equal(learnedReplacement[0].criterionId, replacementDestination.criterionId); assert.equal(learnedReplacement[0].subEvidenceId, replacementDestination.subEvidenceId);
    assert.equal(state.associations.length, 4); assert.equal(state.learning.length, 4); assert.equal(state.pending.length, 1);
    await page.reload(); await page.waitForSelector(uploadSelector);
    state = await storedState(page, userId); assert.equal(state.associations.filter(row => row.fileName === names[4]).length, 1);
    assert.equal(calledRoutes.some(url => url.includes("file.upload")), false, "Unconfirmed smart intake must not invoke legacy public storage");
    assert.equal(harness.calls.length, 5); assert.equal(harness.stats().redirects, 0);
    assert.equal(JSON.stringify(harness.calls).includes("OTHER_ACCOUNT_PRIVATE_LEGACY_MARKER"), false, "Old shared learning entries must not be sent as this account's confirmed examples");
    assert.equal(await page.evaluate(secret => document.body.innerText.includes(secret), harness.privateFailure), false);
    await context.close();
  } finally { await browser?.close(); await harness.close(); await rm(temporary, { recursive: true, force: true }); }
});
