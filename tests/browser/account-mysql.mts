/** Synthetic identities exist only in this loopback test, never application auth. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import express from "express";
import puppeteer, { type Page } from "puppeteer";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { and, eq, sql } from "drizzle-orm";
import { appRouter } from "../../server/root-router";
import { getDb } from "../../server/db";
import { users } from "../../drizzle/schema";
import { academicYears, memberships, organizations, workItems } from "../../drizzle/domain-core";

assert.equal(process.env.GITHUB_ACTIONS, "true");
assert.equal(process.env.SERS_INTEGRATION, "1");
assert.equal(process.env.DATABASE_URL, "mysql://root:root@127.0.0.1:3306/sers_test");

test("browser manages a school invitation, academic year and work using real MySQL", { timeout: 120_000 }, async () => {
  const db = await getDb(); assert(db);
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let server: ReturnType<ReturnType<typeof express>["listen"]> | undefined;
  const suffix = randomBytes(8).toString("hex");
  const ownerSession = randomBytes(32).toString("hex"), memberSession = randomBytes(32).toString("hex");
  const visible = (page: Page, text: string) => page.waitForFunction(value => document.body.innerText.includes(value), {}, text);
  const click = async (page: Page, text: string) => {
    await page.waitForFunction(value => Array.from(document.querySelectorAll("button")).some(b => b.textContent?.trim() === value && !b.disabled), {}, text);
    await page.evaluate(value => {
      const button = Array.from(document.querySelectorAll("button")).find(b => b.textContent?.trim() === value && !b.disabled);
      if (!button) throw new Error(`Unavailable button: ${value}`); button.click();
    }, text);
  };
  const select = async (page: Page, selector: string, value: string) => {
    await page.waitForFunction((query, expected) => {
      const element = document.querySelector(query) as HTMLSelectElement | null;
      return element && !element.disabled && Array.from(element.options).some(option => option.value === expected);
    }, {}, selector, value);
    await page.select(selector, value);
  };
  const fill = async (page: Page, selector: string, value: string) => {
    await page.waitForSelector(selector);
    await page.$eval(selector, (input, text) => {
      const element = input as HTMLInputElement;
      const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")!.set!;
      setter.call(element, text); element.dispatchEvent(new Event("input", { bubbles: true })); element.dispatchEvent(new Event("change", { bubbles: true }));
    }, value);
  };
  try {
    const [rows] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    assert.equal((rows as any)[0].name, "sers_test"); assert.match((rows as any)[0].version, /^8\.4\./);
    const [ownerInsert] = await db.insert(users).values({ openId: `account-browser-owner-${suffix}`, name: "مالك المدرسة التجريبية" });
    const [memberInsert] = await db.insert(users).values({ openId: `account-browser-member-${suffix}`, name: "عضو المدرسة التجريبية" });
    const ownerId = Number(ownerInsert.insertId), memberId = Number(memberInsert.insertId);
    const [owner] = await db.select().from(users).where(eq(users.id, ownerId));
    const [member] = await db.select().from(users).where(eq(users.id, memberId));
    const app = express();
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext: ({ req, res }) => ({ req, res, user: req.headers.cookie === `account_test_session=${ownerSession}` ? owner : req.headers.cookie === `account_test_session=${memberSession}` ? member : null }) }));
    app.use(express.static(resolve("dist/public"))); app.get("*", (_req, res) => res.sendFile(resolve("dist/public/index.html")));
    server = app.listen(0, "127.0.0.1"); await new Promise<void>(resolve => server!.once("listening", resolve));
    const address = server.address(); assert(address && typeof address !== "string"); const base = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox"] });
    const ownerContext = await browser.createBrowserContext(), memberContext = await browser.createBrowserContext();
    await ownerContext.setCookie({ name: "account_test_session", value: ownerSession, url: base, httpOnly: true });
    await memberContext.setCookie({ name: "account_test_session", value: memberSession, url: base, httpOnly: true });
    const page = await ownerContext.newPage(), memberPage = await memberContext.newPage(); page.setDefaultTimeout(15_000); memberPage.setDefaultTimeout(15_000);
    await page.goto(`${base}/account`); await visible(page, "معرّف حسابك:");
    const schoolName = `مدرسة متصفح ${suffix}`;
    await fill(page, '[aria-label="اسم المدرسة الجديدة"]', schoolName); await click(page, "إنشاء المدرسة"); await visible(page, schoolName);
    const [school] = await db.select().from(organizations).where(eq(organizations.name, schoolName)); assert(school);
    await fill(page, '[aria-label="معرّف الحساب المدعو"]', String(memberId));
    await select(page, '[aria-label="دور العضو المدعو"]', "member"); await click(page, "إضافة دعوة"); await visible(page, "دعوة بانتظار القبول");
    const [invitation] = await db.select().from(memberships).where(and(eq(memberships.organizationId, school.id), eq(memberships.userId, memberId)));
    assert.equal(invitation.status, "invited"); assert.equal(invitation.invitationAccepted, false);
    await memberPage.goto(`${base}/account`); await visible(memberPage, `دعوة إلى ${schoolName}`); await click(memberPage, "قبول الدعوة");
    await memberPage.waitForFunction(() => !document.body.innerText.includes("قبول الدعوة"));
    const [accepted] = await db.select().from(memberships).where(eq(memberships.id, invitation.id)); assert.equal(accepted.status, "active"); assert.equal(accepted.invitationAccepted, true);
    await page.reload(); await visible(page, schoolName);
    await select(page, '[aria-label="مساحة السنة الدراسية"]', String(school.id));
    const yearLabel = `عام ${suffix}`;
    await fill(page, '[aria-label="اسم السنة الدراسية"]', yearLabel);
    await fill(page, '[aria-label="بداية السنة الدراسية"]', "2026-08-01"); await fill(page, '[aria-label="نهاية السنة الدراسية"]', "2027-07-31");
    await fill(page, '[aria-label="الفصل 1 startsOn"]', "2026-08-01"); await fill(page, '[aria-label="الفصل 1 endsOn"]', "2027-07-31");
    await click(page, "حفظ السنة والفصول"); await visible(page, yearLabel);
    const [year] = await db.select().from(academicYears).where(and(eq(academicYears.organizationId, school.id), eq(academicYears.label, yearLabel))); assert(year);
    await memberPage.goto(`${base}/work`); await visible(memberPage, "إنشاء عمل"); await click(memberPage, "إنشاء عمل");
    await fill(memberPage, '[aria-label="اسم العمل الجديد"]', `تقرير ${suffix}`); await click(memberPage, "مدرسي");
    await select(memberPage, '[aria-label="مدرسة العمل"]', String(school.id));
    await memberPage.waitForFunction(id => Boolean(document.querySelector(`[aria-label="سنة العمل"] option[value="${id}"]`)), {}, String(year.id));
    await select(memberPage, '[aria-label="سنة العمل"]', String(year.id));
    await memberPage.waitForFunction(() => ((document.querySelector('[aria-label="فصل العمل"]') as HTMLSelectElement | null)?.options.length ?? 0) > 1);
    const termId = await memberPage.$eval('[aria-label="فصل العمل"]', select => (select as HTMLSelectElement).options[1].value);
    await select(memberPage, '[aria-label="فصل العمل"]', termId); await click(memberPage, "إنشاء");
    await memberPage.waitForFunction(() => /^\/work\/\d+$/.test(location.pathname));
    const workId = Number(new URL(memberPage.url()).pathname.split("/").at(-1));
    const [work] = await db.select().from(workItems).where(eq(workItems.id, workId)); assert.equal(work.academicYearId, year.id); assert.equal(work.academicTermId, Number(termId)); assert.equal(work.academicContext?.yearLabel, yearLabel);
    await memberPage.goto(`${base}/work`);
    await memberPage.waitForFunction(id => Boolean(document.querySelector(`[aria-label="تصفية حسب السنة الدراسية"] option[value="${id}"]`)), {}, String(year.id));
    await select(memberPage, '[aria-label="تصفية حسب السنة الدراسية"]', String(year.id)); await visible(memberPage, `تقرير ${suffix}`);
    await page.reload(); await visible(page, "عضو المدرسة التجريبية");
    await page.evaluate(userId => {
      const card = Array.from(document.querySelectorAll("div")).find(el => el.classList.contains("rounded-xl") && el.innerText.includes(`معرّف ${userId} ·`));
      const button = Array.from(card?.querySelectorAll("button") ?? []).find(b => b.textContent?.trim() === "إيقاف");
      if (!button) throw new Error("Member suspension action missing"); button.click();
    }, memberId);
    await visible(page, "موقوف");
    await memberPage.reload(); await visible(memberPage, "لا توجد أعمال");
    assert.equal(await memberPage.evaluate(title => document.body.innerText.includes(title), `تقرير ${suffix}`), false);
  } finally {
    await browser?.close(); if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    await (db as unknown as { $client: { promise(): { end(): Promise<void> } } }).$client.promise().end();
  }
});
