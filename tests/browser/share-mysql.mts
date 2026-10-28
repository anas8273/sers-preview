/** Real browser -> tRPC -> MySQL sharing test. Identity is injected only in this
 * loopback test server; production OAuth and cloud storage are outside scope. */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { randomBytes } from 'node:crypto';
import { resolve } from 'node:path';
import express from 'express';
import puppeteer from 'puppeteer';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { eq, sql } from 'drizzle-orm';
import { appRouter } from '../../server/root-router';
import { getDb } from '../../server/db';
import { users } from '../../drizzle/schema';
import { organizations, memberships, outputs } from '../../drizzle/domain-core';
import { createWorkItemForUser } from '../../server/domain-db';
import { saveReportDraftForUser, createReportDraftVersionForUser } from '../../server/work-report-draft-db';
import { createReviewForUser, decideReviewForUser } from '../../server/review-output-db';

// Refuse to touch an arbitrary database, even if someone supplies SERS_INTEGRATION.
assert.equal(process.env.GITHUB_ACTIONS, 'true');
assert.equal(process.env.SERS_INTEGRATION, '1');
assert.equal(process.env.DATABASE_URL, 'mysql://root:root@127.0.0.1:3306/sers_test');

test('browser creates, opens and revokes protected QR against real MySQL', { timeout: 90_000 }, async () => {
  const db = await getDb(); assert(db);
  const suffix = randomBytes(8).toString('hex');
  const session = randomBytes(32).toString('hex');
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
    const work = await createWorkItemForUser(ownerId, { title: 'تقرير اختبار المشاركة المتصلة', type: 'report', ownerType: 'organization', organizationId });
    assert(work);
    const draft = await saveReportDraftForUser(ownerId, { workItemId: work.id, expectedRevision: 0,
      templateId: 'program-report', themeId: 'formal', fontFamily: 'Cairo', fields: { summary: 'BROWSER_MYSQL_APPROVED_CONTENT' }, evidenceAssetIds: [] });
    const version = await createReportDraftVersionForUser(ownerId, { workItemId: work.id, expectedRevision: draft.revision, reason: 'اختبار اصطناعي' });
    const review = await createReviewForUser(ownerId, version.id, reviewerId); assert(review);
    await decideReviewForUser(reviewerId, review.id, 'approved', 'Synthetic browser fixture');

    const app = express();
    app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext: ({ req, res }) => ({ req, res,
      user: req.headers.cookie === `sers_test_session=${session}` ? user : null,
    }) }));
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
    const click = (text: string) => page.evaluate(value => {
      const button = Array.from(document.querySelectorAll('button')).find(b => b.textContent?.trim() === value);
      if (!button || button.disabled) throw new Error(`Unavailable button: ${value}`); button.click();
    }, text);
    await page.goto(`${base}/work/${work.id}/report`);
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
    await browser?.close();
    if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server!.close(() => resolve())); }
    // The entire synthetic service DB is discarded by Actions; close the pool to exit cleanly.
    await (db as unknown as { $client: { promise(): { end(): Promise<void> } } }).$client.promise().end();
  }
});
