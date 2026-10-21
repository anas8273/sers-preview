/** Browser integration of the production bundle with deterministic HTTP fixtures.
 * MySQL authorization is covered separately; this is not cloud/storage E2E.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { resolve } from 'node:path';
import express from 'express';
import puppeteer from 'puppeteer';
import superjson from 'superjson';

const token = (name: string) => name.padEnd(32, '_');
const report = (name: string, visibility = 'public') => ({
  type: 'link', visibility, expiresAt: null, versionNumber: 1,
  report: { title: name, templateLabel: 'تقرير اختبار', capturedAt: '2026-10-21T00:00:00Z',
    fields: [{ key: 'summary', label: 'الملخص', value: 'محتوى عربي للاختبار فقط' }], evidence: [] },
});
const success = (data: unknown) => ({ result: { data: superjson.serialize(data) } });
const failure = (code: string, message: string) => ({ error: superjson.serialize({
  message, code: code === 'UNAUTHORIZED' ? -32001 : -32004,
  data: { code, httpStatus: code === 'UNAUTHORIZED' ? 401 : 404, path: 'publicOutput.resolve' },
}) });

test('public output browser flow with HTTP fixtures', { timeout: 90_000 }, async t => {
  const app = express();
  app.use(express.json());
  let releaseSlow: (() => void) | undefined;
  let slowRequested: (() => void) | undefined;
  let failNetwork = true;
  const requests: { token: string; password?: string }[] = [];
  app.post('/api/trpc/publicOutput.resolve', async (req, res) => {
    const batched = req.query.batch === '1';
    const input = superjson.deserialize<{ token: string; password?: string }>(batched ? req.body['0'] : req.body);
    requests.push(input);
    const send = (payload: unknown) => res.json(batched ? [payload] : payload);
    if (input.token === token('slow')) {
      slowRequested?.();
      await new Promise<void>(resolve => { releaseSlow = resolve; });
      return send(success(report('OLD_REPORT')));
    }
    if (input.token === token('network') && failNetwork) { req.socket.destroy(); return; }
    if (['revoked', 'expired', 'invalid'].some(name => input.token === token(name))) {
      return send(failure('NOT_FOUND', 'المخرج غير متاح أو انتهت صلاحيته.'));
    }
    if (input.token === token('protected')) {
      if (!input.password) return send(failure('UNAUTHORIZED', 'هذا المخرج محمي بكلمة مرور.'));
      if (input.password !== 'correct-secret') return send(failure('UNAUTHORIZED', 'كلمة المرور غير صحيحة.'));
      return send(success(report('PROTECTED_REPORT', 'protected')));
    }
    return send(success(report(input.token === token('next') ? 'NEXT_REPORT' : 'PUBLIC_REPORT')));
  });
  const publicDir = resolve('dist/public');
  app.use(express.static(publicDir));
  app.get('*', (_req, res) => res.sendFile(resolve(publicDir, 'index.html')));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const address = server.address();
  assert(address && typeof address !== 'string');
  const base = `http://127.0.0.1:${address.port}`;
  let browser: Awaited<ReturnType<typeof puppeteer.launch>> | undefined;
  try {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
    const page = await browser.newPage();
    page.setDefaultTimeout(10_000);
    const visible = (text: string) => page.waitForFunction(value => document.body.innerText.includes(value), {}, text);
    const goto = (name: string) => page.goto(`${base}/output/${token(name)}`);
    const clickText = async (text: string) => {
      await page.evaluate(value => {
        const button = Array.from(document.querySelectorAll('button')).find(button => button.textContent?.includes(value));
        if (!button) throw new Error(`Missing button ${value}`);
        button.click();
      }, text);
    };
    await t.test('public Arabic report renders at mobile width without workspace controls', async () => {
      await page.setViewport({ width: 390, height: 844 });
      await goto('public'); await visible('PUBLIC_REPORT');
      assert.equal(await page.$('#report-share-actions'), null);
      assert.equal(await page.$eval('main', element => element.getAttribute('dir')), 'rtl');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    });
    await t.test('protected report accepts only the correct password and clears the input', async () => {
      await goto('protected'); await visible('هذا المخرج محمي');
      assert.equal(await page.evaluate(() => document.body.innerText.includes('PROTECTED_REPORT')), false);
      await page.type('#output-password', 'wrong-secret'); await clickText('عرض المخرج');
      await visible('كلمة المرور غير صحيحة');
      await page.$eval('#output-password', element => { (element as HTMLInputElement).select(); });
      await page.type('#output-password', 'correct-secret'); await clickText('عرض المخرج');
      await visible('PROTECTED_REPORT');
      assert.equal(await page.$('#output-password'), null);
      assert.equal(await page.evaluate(() => JSON.stringify({ ...localStorage, ...sessionStorage }).includes('correct-secret')), false);
      assert.equal(page.url().includes('secret'), false);
    });
    for (const name of ['revoked', 'expired', 'invalid']) {
      await t.test(`${name} response shows no previous report`, async () => {
        await goto(name); await visible('المخرج غير متاح');
        assert.equal(await page.evaluate(() => document.querySelector('article')), null);
      });
    }
    await t.test('late response for A cannot replace report B after client navigation', async () => {
      const requested = new Promise<void>(resolve => { slowRequested = resolve; });
      await goto('slow'); await requested;
      await page.evaluate(path => { history.pushState({}, '', path); dispatchEvent(new PopStateEvent('popstate')); }, `/output/${token('next')}`);
      await visible('NEXT_REPORT');
      releaseSlow?.(); await page.waitForNetworkIdle({ idleTime: 200 });
      assert.equal(await page.evaluate(() => document.body.innerText.includes('OLD_REPORT')), false);
      assert.equal(await page.evaluate(() => document.body.innerText.includes('NEXT_REPORT')), true);
      assert(requests.some(request => request.token === token('next')));
    });
    await t.test('network failure offers a working retry', async () => {
      await goto('network'); await visible('المخرج غير متاح');
      failNetwork = false; await clickText('إعادة المحاولة'); await visible('PUBLIC_REPORT');
    });
  } finally {
    releaseSlow?.();
    await browser?.close();
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
