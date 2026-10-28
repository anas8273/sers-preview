/** Production OAuth/session/context code against a synthetic loopback issuer.
 * This proves the application's protocol and persistence, not external Manus login. */
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

test("production auth browser journey with synthetic issuer: login, account, work, logout and denied cookie replay", { timeout: 120_000 }, async () => {
  const harness = await startAuthHarness();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  const visible = (page: Page, text: string) => page.waitForFunction(value => document.body.innerText.includes(value), {}, text);
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
    await Promise.all([page.waitForNavigation(), page.click('a[href="/api/oauth/start"]')]);
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
    assert.equal(page.url(), `${harness.base}/`);
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

    await page.goto(`${harness.base}/account`); await visible(page, "معرّف حسابك:");
    const logoutResponse = page.waitForResponse(response => response.url().includes("auth.logout"));
    await click(page, "تسجيل الخروج"); assert.equal((await logoutResponse).status(), 200);
    await visible(page, "تسجيل الدخول");
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
    await replayContext.close(); await context.close();
  } finally { await browser?.close(); await harness.close(); }
});
