/** Real browser -> tRPC -> MySQL sharing test. Identity is injected only in this
 * loopback test server; production OAuth and cloud storage are outside scope. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { join, resolve } from 'node:path';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import JSZip from 'jszip';
import express from 'express';
import puppeteer, { type Page } from 'puppeteer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { eq, sql } from 'drizzle-orm';
import { appRouter } from '../../server/root-router';
import { getDb } from '../../server/db';
import { users } from '../../drizzle/schema';
import { organizations, memberships, outputs, workVersions } from '../../drizzle/domain-core';
import { createWorkItemForUser } from '../../server/domain-db';
import { getReportDraftForUser } from '../../server/work-report-draft-db';
import { createAcademicYearForUser } from '../../server/account-db';
import { registerPrivateOutputRoutes } from '../../server/output-artifact-storage';
import { closeBrowser } from '../../server/pdf-renderer';
import { decryptedRecords } from './private-storage-helpers.mts';

// Refuse to touch an arbitrary database, even if someone supplies SERS_INTEGRATION.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.SERS_INTEGRATION, '1');
assert.equal(process.env.DATABASE_URL, 'mysql://root:root@127.0.0.1:3306/sers_test');

async function clickButton(page: Page, label: string) {
  await page.waitForFunction(value => Array.from(document.querySelectorAll('button')).some(button => button.textContent?.trim() === value && !button.disabled), {}, label);
  await page.evaluate(value => Array.from(document.querySelectorAll('button')).find(button => button.textContent?.trim() === value && !button.disabled)!.click(), label);
}

test('reports retain the latest overlapping edit through reload, review, PDF, editable Word and protected QR', { timeout: 150_000 }, async () => {
  const db = await getDb(); assert(db);
  const suffix = randomBytes(8).toString('hex');
  const session = randomBytes(32).toString('hex');
  const reviewerSession = randomBytes(32).toString('hex');
  const root = await mkdtemp(join(tmpdir(), 'sers-report-browser-'));
  process.env.SERS_PRIVATE_STORAGE_DIR = join(root, 'private');
  const firstSave = Promise.withResolvers<void>();
  const secondSave = Promise.withResolvers<void>();
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  let server: ReturnType<ReturnType<typeof express>['listen']> | undefined;
  try {
    const [rows] = await db.execute(sql`select database() as name, version() as version`);
    const actual = (rows as unknown as { name: string; version: string }[])[0];
    assert.equal(actual.name, 'sers_test'); assert.match(actual.version, /^8\.4\./);
    const owner = await db.insert(users).values({ openId: `browser-owner-${suffix}`, name: 'مالك اختبار' });
    const reviewer = await db.insert(users).values({ openId: `browser-reviewer-${suffix}`, name: 'مراجع اختبار' });
    const ownerId = Number(owner[0].insertId), reviewerId = Number(reviewer[0].insertId);
    const [user] = await db.select().from(users).where(eq(users.id, ownerId));
    const org = await db.insert(organizations).values({ name: `Browser School ${suffix}` });
    const organizationId = Number(org[0].insertId);
    await db.insert(memberships).values([
      { organizationId, userId: ownerId, role: 'owner', status: 'active' },
      { organizationId, userId: reviewerId, role: 'reviewer', status: 'active' },
    ]);
    const [reviewerUser] = await db.select().from(users).where(eq(users.id, reviewerId));
    const year = await createAcademicYearForUser(ownerId, { ownerType: 'organization', organizationId, label: 'عام الاختبار',
      startsOn: '2026-08-01', endsOn: '2027-07-31', terms: [{ label: 'الفصل الأول', startsOn: '2026-08-01', endsOn: '2026-12-31' }] });
    const portfolio = await createWorkItemForUser(ownerId, { title: 'ملف إنجاز اختبار التصفية', type: 'portfolio' });
    assert(portfolio);

    const app = express();
    const authenticate = async (req: express.Request) => req.headers.cookie === `sers_test_session=${session}` ? user
      : req.headers.cookie === `sers_test_session=${reviewerSession}` ? reviewerUser : null;
    registerPrivateOutputRoutes(app, authenticate);
    const gates = [firstSave, secondSave];
    app.use('/api/trpc', async (req, _res, next) => {
      if (req.method === 'POST' && req.path.includes('domain.reportDraft.save')) await gates.shift()?.promise;
      next();
    });
    app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext: async ({ req, res }) => ({ req, res, user: await authenticate(req) }) }));
    app.use(express.static(resolve('dist/public')));
    app.get('*', (_req, res) => res.sendFile(resolve('dist/public/index.html')));
    server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server!.once('listening', resolve));
    const address = server.address(); assert(address && typeof address !== 'string');
    const base = `http://127.0.0.1:${address.port}`;
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const ownerContext = await browser.createBrowserContext();
    await ownerContext.setCookie({ name: 'sers_test_session', value: session, url: base, httpOnly: true });
    const page = await ownerContext.newPage(); page.setDefaultTimeout(15_000);
    const visible = (text: string) => page.waitForFunction(value => document.body.innerText.includes(value), {}, text);
    const click = (label: string) => clickButton(page, label);
    await page.setViewport({ width: 390, height: 844 });
    await page.goto(base);
    await page.locator('button[aria-label="التقارير"]').click();
    await visible('إنشاء تقرير');
    assert.equal(new URL(page.url()).pathname, '/reports');

    // Keep a genuine device report under its original encrypted key and reopen it from the new entry.
    await page.locator('a[href="/reports/legacy"]').click();
    await click('قوالب جديدة');
    await page.locator('button[aria-label="تقرير مخصص"]').click();
    await page.locator('#report-field-title').fill('تقرير سابق محفوظ على الجهاز');
    await click('حفظ'); await visible('تم حفظ التقرير بنجاح');
    await click('العودة إلى التقارير');
    await page.locator('a[href="/reports/legacy"]').click();
    await visible('تقرير سابق محفوظ على الجهاز');
    await page.reload(); await visible('تقرير سابق محفوظ على الجهاز');
    await click('تعديل');
    assert.equal(await page.$eval('#report-field-title', input => (input as HTMLInputElement).value), 'تقرير سابق محفوظ على الجهاز');
    await click('العودة إلى التقارير');

    await visible('لا توجد تقارير في هذا الاختيار');
    assert.equal(await page.evaluate(title => document.body.innerText.includes(title), portfolio.title), false);
    await click('إنشاء تقرير');
    const title = 'تقرير اختبار المشاركة المتصلة';
    await page.locator('[aria-label="اسم التقرير الجديد"]').fill(title);
    await click('مدرسي');
    await page.select('[aria-label="مدرسة العمل"]', String(organizationId));
    await page.waitForSelector(`[aria-label="سنة العمل"] option[value="${year.id}"]`);
    await page.select('[aria-label="سنة العمل"]', String(year.id));
    await page.waitForSelector('[aria-label="فصل العمل"] option:nth-child(2)');
    const term = await page.$eval('[aria-label="فصل العمل"] option:nth-child(2)', option => (option as HTMLOptionElement).value);
    await page.select('[aria-label="فصل العمل"]', term);
    await click('إنشاء');
    await page.waitForFunction(() => /^\/work\/\d+\/report$/.test(location.pathname));
    const editorUrl = page.url(), workId = Number(new URL(editorUrl).pathname.split('/')[2]);
    const recoveryKey = `sers:report-draft:${workId}`;
    const summary = 'textarea[placeholder^="اكتب ملخصًا"]';
    const firstText = 'EARLIER_EDIT', finalText = 'BROWSER_MYSQL_APPROVED_CONTENT';
    const nextSave = () => page.waitForRequest(request => request.method() === 'POST' && request.url().includes('domain.reportDraft.save'));
    const firstRequest = nextSave();
    await page.locator(summary).fill(firstText);
    await firstRequest; // Autosave is now in flight.
    await page.locator(summary).fill(finalText);
    await click('إنشاء نسخة ثابتة');
    const secondRequest = nextSave();
    firstSave.resolve(); await secondRequest;
    await visible('مراجعة 1');
    const backup = JSON.parse((await decryptedRecords(page))[recoveryKey]);
    assert.equal(backup.fields.summary, finalText); assert.equal(backup.baseRevision, 1);
    assert.equal(await page.evaluate(() => document.body.innerText.includes('محفوظ في الخادم')), false);
    secondSave.resolve();
    await visible('تم إنشاء النسخة 1 من مراجعة التقرير 2');
    assert.equal((await decryptedRecords(page))[recoveryKey], undefined);
    const saved = await getReportDraftForUser(ownerId, workId);
    assert.equal(saved?.draft.fields.summary, finalText); assert.equal(saved?.draft.revision, 2);
    const versions = await db.select().from(workVersions).where(eq(workVersions.workItemId, workId));
    assert.equal(versions.length, 1);
    const version = versions[0];
    assert.equal((version.snapshot as { reportDraft: { fields: { summary: string } } }).reportDraft.fields.summary, finalText);

    await page.waitForSelector(`[aria-label="مراجع التقرير"] option[value="${reviewerId}"]`);
    await page.select('[aria-label="مراجع التقرير"]', String(reviewerId)); await click('إرسال النسخة للمراجعة');
    await page.waitForFunction(() => location.pathname === '/reviews');
    await page.goto(`${base}/reports`); await click('فتح التقرير');
    await page.reload(); await page.waitForSelector(summary);
    assert.equal(await page.$eval(summary, el => (el as HTMLTextAreaElement).value), finalText);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), true);
    // A later edit to the live draft must not change the version the reviewer or outputs receive.
    const later = 'DRAFT_AFTER_REVIEW';
    await page.locator(summary).fill(later); await click('حفظ الآن'); await visible('محفوظ في الخادم');
    const reviewerContext = await browser.createBrowserContext();
    await reviewerContext.setCookie({ name: 'sers_test_session', value: reviewerSession, url: base, httpOnly: true });
    const reviewerPage = await reviewerContext.newPage(); reviewerPage.setDefaultTimeout(15_000);
    await reviewerPage.goto(`${base}/reviews`);
    await reviewerPage.waitForFunction(title => Array.from(document.querySelectorAll('button p')).some(p => p.textContent === title), {}, title);
    await reviewerPage.evaluate(title => Array.from(document.querySelectorAll('button p')).find(p => p.textContent === title)!.closest('button')!.click(), title);
    const reviewBody = await reviewerPage.waitForSelector('section[aria-label="محتوى النسخة المرسلة"]'); assert(reviewBody);
    const reviewText = await reviewBody.evaluate(el => el.textContent);
    assert(reviewText?.includes(finalText)); assert(!reviewText.includes(later)); assert(!reviewText.includes(firstText));
    await clickButton(reviewerPage, 'اعتماد');
    await reviewerPage.waitForFunction(() => document.body.innerText.includes('معتمد'));
    await page.reload(); await page.waitForSelector(summary);
    await page.click('[aria-controls="report-pdf-actions"]');
    for (const format of ['PDF', 'Word'] as const) {
      if (format === 'Word') await click('Word قابل للتعديل');
      await click(`إنشاء ${format} خاص`); await visible(`تنزيل ${format}`);
      const link = await page.$eval('#report-pdf-actions a[download]', a => (a as HTMLAnchorElement).href);
      const [record] = await db.select().from(outputs).where(eq(outputs.id, Number(new URL(link).pathname.split('/')[3])));
      assert.equal(record.workVersionId, version.id); assert.equal(record.visibility, 'private');
      const response = await fetch(link, { headers: { Cookie: `sers_test_session=${session}` } });
      assert.equal(response.status, 200);
      const bytes = Buffer.from(await response.arrayBuffer());
      const body = format === 'PDF' ? execFileSync('pdftotext', ['-', '-'], { input: bytes, encoding: 'utf8' })
        : await (await JSZip.loadAsync(bytes)).file('word/document.xml')!.async('string');
      assert(body.includes(finalText), format); assert(!body.includes(firstText)); assert(!body.includes(later));
    }
    await page.click('[aria-label="إغلاق نافذة المخرجات"]');
    await visible('مشاركة النسخة'); await click('مشاركة النسخة');
    await page.waitForFunction(() => {
      const select = document.querySelector('#report-share-actions select') as HTMLSelectElement | null;
      return Boolean(select && select.value);
    });
    await click('QR'); await click('كلمة مرور');
    await page.type('#report-share-actions input[type=password]', 'browser-secret');
    await click('إنشاء QR');
    await visible('تم إنشاء مخرج محمي');
    await page.waitForSelector('#report-share-actions img[src^="data:image/png"]');
    const url = await page.$eval('#report-share-actions a[target="_blank"]', a => (a as HTMLAnchorElement).href);
    assert.match(url, new RegExp(`^${base}/output/[A-Za-z0-9_-]{32}$`));
    const token = url.split('/').at(-1)!;
    const [stored] = await db.select().from(outputs).where(eq(outputs.token, token));
    assert(stored); assert.equal(stored.workVersionId, version.id); assert.equal(stored.type, 'qr');
    assert.match(stored.passwordHash!, /^scrypt-v1\$/); assert.equal(stored.revokedAt, null);
    const visitorContext = await browser.createBrowserContext();
    const visitor = await visitorContext.newPage(); visitor.setDefaultTimeout(15_000);
    await visitor.goto(url);
    await visitor.waitForSelector('#output-password');
    assert.equal(await visitor.evaluate(() => document.body.innerText.includes('BROWSER_MYSQL_APPROVED_CONTENT')), false);
    await visitor.type('#output-password', 'browser-secret');
    await visitor.click('form button[type=submit]');
    await visitor.waitForFunction(() => document.body.innerText.includes('BROWSER_MYSQL_APPROVED_CONTENT'));
    await click('إلغاء المخرج');
    await page.waitForFunction(() => !document.body.innerText.includes('تم إنشاء مخرج محمي'));
    const [revoked] = await db.select().from(outputs).where(eq(outputs.id, stored.id)); assert(revoked.revokedAt);
    await visitor.reload();
    await visitor.waitForFunction(() => document.body.innerText.includes('المخرج غير متاح'));
    assert.equal(await visitor.$('article'), null);
  } finally {
    firstSave.resolve(); secondSave.resolve();
    await browser?.close();
    await closeBrowser();
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    await rm(root, { recursive: true, force: true });
    // The entire synthetic service DB is discarded by Actions; close the pool to exit cleanly.
    await (db as unknown as { $client: { promise(): { end(): Promise<void> } } }).$client.promise().end();
  }
});
