/** Production OAuth/session/context code against a synthetic loopback issuer.
 * This proves the application's protocol and persistence, not external Manus login. */
import { decryptedRecords } from "./private-storage-helpers.mts";
import assert from "node:assert/strict";
import { test } from "node:test";
import { eq } from "drizzle-orm";
import puppeteer, { type Page } from "puppeteer";
import { users } from "../../drizzle/schema";
import { academicYears, memberships, organizations, workItems } from "../../drizzle/domain-core";
import { authSessions } from "../../drizzle/auth";
import { authRpc, startAuthHarness } from "../fixtures/auth-http-harness";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.SERS_INTEGRATION, "1");
assert.equal(process.env.DATABASE_URL, "mysql://root:root@127.0.0.1:3306/sers_test");

test("production auth browser journey with synthetic issuer: login, account, work, logout, report re-entry, account isolation and denied cookie replay", { timeout: 120_000 }, async () => {
  const harness = await startAuthHarness();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  const visible = async (page: Page, text: string) => {
    try { await page.waitForFunction(value => document.body.innerText.includes(value), { polling: "mutation" }, text); }
    catch (error) {
      console.error("Synthetic browser checkpoint", await page.evaluate(() => ({ path: location.pathname, body: document.body.innerText.slice(0, 1800) })));
      throw error;
    }
  };
  const click = async (page: Page, text: string) => {
    await page.waitForFunction(value => Array.from(document.querySelectorAll("button")).some(button => button.textContent?.trim() === value && !button.disabled), {}, text);
    await page.evaluate(value => {
      const button = Array.from(document.querySelectorAll("button")).find(item => item.textContent?.trim() === value && !item.disabled);
      if (!button) throw new Error(`Unavailable button: ${value}`); button.click();
    }, text);
  };
  const fill = async (page: Page, selector: string, value: string) => {
    await page.waitForSelector(selector);
    await page.$eval(selector, (element, text) => {
      const input = element as HTMLInputElement;
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!.call(input, text);
      input.dispatchEvent(new Event("input", { bubbles: true })); input.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };
  try {
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const context = await browser.createBrowserContext(), page = await context.newPage(); page.setDefaultTimeout(20_000);
    const seen: Array<{ url: string; referer?: string }> = [];
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = request.url();
      seen.push({ url, referer: request.headers().referer });
      if (url.startsWith(`${harness.base}/`) || url.startsWith(`${harness.issuerBase}/`) || url.startsWith("data:")) void request.continue();
      else void request.abort();
    });
    assert.equal((await authRpc(harness.base, "account.overview")).response.status, 401);
    await page.goto(`${harness.base}/account`); await visible(page, "تسجيل الدخول");
    await Promise.all([page.waitForNavigation(), page.click('a[href^="/api/oauth/start"]')]);
    await page.waitForSelector("#issuer-sign-in");
    assert.equal(new URL(page.url()).origin, harness.issuerBase);
    const authorization = harness.authorizations.at(-1); assert(authorization);
    const attemptCookie = (await context.cookies()).find(cookie => cookie.name === "oauth_attempt"); assert(attemptCookie);
    assert.equal(attemptCookie.httpOnly, true); assert.equal(attemptCookie.sameSite, "Lax"); assert.equal(attemptCookie.path, "/api/oauth");
    const callbackResponse = page.waitForResponse(response => response.url() === authorization.callback);
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#issuer-sign-in")]);
    const callback = await callbackResponse;
    assert.equal(callback.status(), 302); assert.equal(callback.headers()["referrer-policy"], "no-referrer");
    assert.match(callback.headers()["cache-control"], /no-store/);
    assert.equal(page.url(), `${harness.base}/account`);
    assert.equal(await page.evaluate(() => location.search), "");
    assert.equal(await page.evaluate(() => document.referrer), "");
    assert.equal(seen.filter(request => request.url.includes(authorization.code)).length, 1);
    assert(seen.every(request => !request.referer?.includes(authorization.code) && !request.referer?.includes(authorization.state)));
    const session = (await context.cookies()).find(cookie => cookie.name === "app_session_id"); assert(session);
    assert.equal(session.httpOnly, true); assert.equal(session.sameSite, "Lax"); assert.equal(session.path, "/");
    assert.equal(await page.evaluate(() => document.cookie.includes("app_session_id")), false);
    assert(harness.exchanged.some(request => request.clientId === harness.appId && request.code === authorization.code && request.redirectUri === `${harness.base}/api/oauth/callback`));
    const [user] = await harness.db.select().from(users).where(eq(users.openId, authorization.openId)); assert(user);
    assert.equal(user.name, "حساب مصادقة تجريبي"); assert.equal(user.role, "user");
    const sessions = await harness.db.select().from(authSessions).where(eq(authSessions.userId, user.id));
    assert.equal(sessions.length, 1); assert.equal(sessions[0].revokedAt, null);
    const oldCookie = `app_session_id=${session.value}`;

    await page.goto(`${harness.base}/account`); await visible(page, "معرّف حسابك:"); await visible(page, user.name!);
    const schoolName = `مدرسة المصادقة ${harness.prefix}`;
    await fill(page, '[aria-label="اسم المدرسة الجديدة"]', schoolName); await click(page, "إنشاء المدرسة"); await visible(page, schoolName);
    const [school] = await harness.db.select().from(organizations).where(eq(organizations.name, schoolName)); assert(school);
    const [membership] = await harness.db.select().from(memberships).where(eq(memberships.organizationId, school.id));
    assert.equal(membership.userId, user.id); assert.equal(membership.role, "owner");
    const yearLabel = `عام المصادقة ${harness.prefix}`;
    await fill(page, '[aria-label="اسم السنة الدراسية"]', yearLabel);
    await fill(page, '[aria-label="بداية السنة الدراسية"]', "2026-08-01"); await fill(page, '[aria-label="نهاية السنة الدراسية"]', "2027-07-31");
    await fill(page, '[aria-label="الفصل 1 startsOn"]', "2026-08-01"); await fill(page, '[aria-label="الفصل 1 endsOn"]', "2027-07-31");
    await click(page, "حفظ السنة والفصول"); await visible(page, yearLabel);
    const [year] = await harness.db.select().from(academicYears).where(eq(academicYears.label, yearLabel)); assert(year); assert.equal(year.ownerUserId, user.id);
    await page.goto(`${harness.base}/work`); await visible(page, "إنشاء عمل"); await click(page, "إنشاء عمل");
    const title = `عمل مصادقة ${harness.prefix}`;
    await fill(page, '[aria-label="اسم العمل الجديد"]', title);
    await page.waitForFunction(id => Boolean(document.querySelector(`[aria-label="سنة العمل"] option[value="${id}"]`)), {}, String(year.id));
    await page.select('[aria-label="سنة العمل"]', String(year.id));
    await page.waitForFunction(() => ((document.querySelector('[aria-label="فصل العمل"]') as HTMLSelectElement | null)?.options.length ?? 0) > 1);
    const termId = await page.$eval('[aria-label="فصل العمل"]', element => (element as HTMLSelectElement).options[1].value);
    await page.select('[aria-label="فصل العمل"]', termId); await click(page, "إنشاء");
    await page.waitForFunction(() => /^\/work\/\d+$/.test(location.pathname));
    const workId = Number(new URL(page.url()).pathname.split("/").at(-1));
    const [work] = await harness.db.select().from(workItems).where(eq(workItems.id, workId));
    assert.equal(work.ownerUserId, user.id); assert.equal(work.academicYearId, year.id); assert.equal(work.title, title);
    await page.goto(`${harness.base}/work`); await visible(page, title); await page.reload(); await visible(page, title);

    const reportUrl = `${harness.base}/work/${workId}/report`;
    await page.goto(reportUrl); await page.waitForSelector("textarea");
    const reportText = `PRIVATE_SERVER_REPORT_${harness.prefix}`;
    const savedReportResponse = page.waitForResponse(response => response.url().includes("reportDraft.save"));
    await page.$eval("textarea", (element, text) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, text);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, reportText);
    assert.equal((await savedReportResponse).status(), 200);
    await visible(page, "محفوظ في الخادم");
    await page.reload(); await page.waitForFunction(text => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === text, {}, reportText);
    // Keep a second live tab open to prove remote logout clears displayed data.
    const otherTab = await context.newPage(); await otherTab.goto(reportUrl);
    await otherTab.waitForFunction(text => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === text, {}, reportText);
    await decryptedRecords(otherTab);
    await page.bringToFront();
    // Create an offline backup through the editor while the authenticated page
    // is open, then restore the network before logout.
    await page.evaluate('Object.defineProperty(navigator, "onLine", { configurable: true, get() { return false; } }); window.dispatchEvent(new Event("offline"));');
    const draftText = `PRIVATE_UNSENT_DRAFT_${harness.prefix}`;
    await page.$eval("textarea", (element, text) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, text);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, draftText);
    await visible(page, "غير متصل بالخادم");
    const persistedDraft = await decryptedRecords(page);
    assert(persistedDraft[`sers:report-draft:${workId}`]?.includes(draftText));
    const rawCache = await page.evaluate(() => JSON.stringify({ ...localStorage }));
    assert(!rawCache.includes(draftText)); assert(!rawCache.includes(reportText));
    // No online event: keep the encrypted unsent draft for re-entry recovery.
    await page.evaluate(() => { delete (navigator as any).onLine; });
    await page.goto(`${harness.base}/account`); await visible(page, "معرّف حسابك:");
    const logoutResponse = page.waitForResponse(response => response.url().includes("auth.logout"));
    await click(page, "تسجيل الخروج"); assert.equal((await logoutResponse).status(), 200);
    await visible(page, "تسجيل الدخول");
    await otherTab.bringToFront();
    await visible(otherTab, "تسجيل الدخول");
    assert.equal(await otherTab.$("textarea"), null);
    await otherTab.close();
    assert.equal(await page.evaluate(value => document.body.innerText.includes(value), schoolName), false);
    const [revoked] = await harness.db.select().from(authSessions).where(eq(authSessions.idHash, sessions[0].idHash));
    assert(revoked.revokedAt instanceof Date);
    assert.equal((await context.cookies()).some(cookie => cookie.name === "app_session_id"), false);
    assert.equal((await authRpc(harness.base, "account.overview", oldCookie)).response.status, 401);
    assert.equal((await authRpc(harness.base, "domain.work.list", oldCookie)).response.status, 401);
    assert.equal((await authRpc(harness.base, "auth.me", oldCookie)).data, null);
    // A separately isolated browser replaying the stolen pre-logout token also
    // traverses production createContext and cannot see the protected account.
    const replayContext = await browser.createBrowserContext();
    await replayContext.setCookie({ name: session.name, value: session.value, domain: new URL(harness.base).hostname, path: "/", httpOnly: true, sameSite: "Lax" });
    const replayPage = await replayContext.newPage(); await replayPage.goto(`${harness.base}/account`);
    await visible(replayPage, "تسجيل الدخول");
    assert.equal(await replayPage.evaluate(value => document.body.innerText.includes(value), schoolName), false);
    await replayContext.close();
    // Same identity returns to the exact report URL and decrypts its own draft.
    harness.loginAs(authorization.openId);
    await page.goto(reportUrl); await visible(page, "تسجيل الدخول");
    await Promise.all([page.waitForNavigation(), page.click('a[href^="/api/oauth/start"]')]);
    await page.waitForSelector("#issuer-sign-in");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#issuer-sign-in")]);
    assert.equal(page.url(), reportUrl);
    await page.waitForFunction(text => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === text, {}, draftText);
    await visible(page, "محفوظ في الخادم");
    await page.reload(); await page.waitForFunction(text => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === text, {}, draftText);
    await page.goto(`${harness.base}/account`); await visible(page, "معرّف حسابك:"); await click(page, "تسجيل الخروج"); await visible(page, "تسجيل الدخول");
    // A different identity in the SAME browser cannot obtain the original key,
    // local records, or the protected server report.
    await page.goto(reportUrl); await visible(page, "تسجيل الدخول");
    await Promise.all([page.waitForNavigation(), page.click('a[href^="/api/oauth/start"]')]);
    await page.waitForSelector("#issuer-sign-in");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#issuer-sign-in")]);
    assert.equal((await decryptedRecords(page))[`sers:report-draft:${workId}`], undefined);
    assert.equal(await page.$("textarea"), null);
    assert.equal(await page.evaluate(text => document.body.innerText.includes(text), draftText), false);
    const forbiddenReport = await page.evaluate(async id => {
      const url = `/api/trpc/domain.reportDraft.get?input=${encodeURIComponent(JSON.stringify({ json: { workItemId: id } }))}`;
      return (await fetch(url)).status;
    }, workId);
    assert([403, 404].includes(forbiddenReport));

    // A failed autosave must survive a logout initiated in another live tab.
    // The old account's readable UI locks immediately; a bounded ciphertext
    // recovery screen keeps the tab open until the encrypted write succeeds.
    await page.goto(`${harness.base}/account`); await visible(page, "معرّف حسابك:");
    await click(page, "تسجيل الخروج"); await visible(page, "تسجيل الدخول");
    harness.loginAs(authorization.openId);
    await page.goto(reportUrl); await visible(page, "تسجيل الدخول");
    await Promise.all([page.waitForNavigation(), page.click('a[href^="/api/oauth/start"]')]);
    await page.waitForSelector("#issuer-sign-in");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#issuer-sign-in")]);
    await page.waitForSelector("textarea");
    const logoutTab = await context.newPage(); await logoutTab.goto(`${harness.base}/account`);
    await visible(logoutTab, "معرّف حسابك:");
    await page.bringToFront();
    await page.evaluate(() => {
      Object.defineProperty(navigator, "onLine", { configurable: true, get: () => false });
      window.dispatchEvent(new Event("offline"));
      const original = Storage.prototype.setItem;
      (window as any).__restoreSyntheticStorage = () => { Storage.prototype.setItem = original; };
      Storage.prototype.setItem = function(name, value) {
        if (name.startsWith("sers:vault:v1:")) throw new DOMException("Synthetic quota failure", "QuotaExceededError");
        return original.call(this, name, value);
      };
    });
    const failedDraft = `PRIVATE_QUOTA_FAILED_DRAFT_${harness.prefix}`;
    await page.$eval("textarea", (element, text) => {
      Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")!.set!.call(element, text);
      element.dispatchEvent(new Event("input", { bubbles: true }));
    }, failedDraft);
    await page.waitForSelector('[data-private-storage-error="true"]');
    await logoutTab.bringToFront(); await click(logoutTab, "تسجيل الخروج"); await visible(logoutTab, "تسجيل الدخول");
    await page.bringToFront(); await page.waitForSelector('[data-private-recovery="blocked"]');
    assert.equal(await page.$("textarea"), null);
    assert.equal(await page.evaluate(text => document.body.innerText.includes(text), failedDraft), false);
    assert.equal(await page.evaluate(text => JSON.stringify({ ...localStorage }).includes(text), failedDraft), false);
    await visible(page, "قد تُفقد إذا أغلقته");
    // A different account may sign in in the other tab while the old draft
    // remains locked. It still cannot read that report or its local cache.
    await Promise.all([logoutTab.waitForNavigation(), logoutTab.click('a[href^="/api/oauth/start"]')]);
    await logoutTab.waitForSelector("#issuer-sign-in");
    await Promise.all([logoutTab.waitForNavigation({ waitUntil: "networkidle0" }), logoutTab.click("#issuer-sign-in")]);
    await visible(logoutTab, "معرّف حسابك:");
    assert.equal((await decryptedRecords(logoutTab))[`sers:report-draft:${workId}`], undefined);
    const recoveryForbiddenReport = await logoutTab.evaluate(async id => {
      const url = `/api/trpc/domain.reportDraft.get?input=${encodeURIComponent(JSON.stringify({ json: { workItemId: id } }))}`;
      return (await fetch(url)).status;
    }, workId);
    assert([403, 404].includes(recoveryForbiddenReport));
    await click(logoutTab, "تسجيل الخروج"); await visible(logoutTab, "تسجيل الدخول");
    await logoutTab.close();
    await page.bringToFront();
    await page.evaluate(() => { (window as any).__restoreSyntheticStorage(); });
    await Promise.all([page.waitForNavigation(), click(page, "إعادة حفظ النسخة المشفّرة")]);
    await visible(page, "تسجيل الدخول");
    harness.loginAs(authorization.openId);
    await Promise.all([page.waitForNavigation(), page.click('a[href^="/api/oauth/start"]')]);
    await page.waitForSelector("#issuer-sign-in");
    await Promise.all([page.waitForNavigation({ waitUntil: "networkidle0" }), page.click("#issuer-sign-in")]);
    assert.equal(page.url(), reportUrl);
    await page.waitForFunction(text => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === text, {}, failedDraft);
    await visible(page, "محفوظ في الخادم");
    await page.reload(); await page.waitForFunction(text => (document.querySelector("textarea") as HTMLTextAreaElement)?.value === text, {}, failedDraft);
    await context.close();
  } finally { await browser?.close(); await harness.close(); }
});
