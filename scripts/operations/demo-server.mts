/** Standalone local synthetic harness. Not imported by the production server. */
import { randomBytes, timingSafeEqual } from 'node:crypto';
import { resolve } from 'node:path';
import express, { type Request } from 'express';
import { createExpressMiddleware } from '@trpc/server/adapters/express';
import { appRouter } from '../../server/root-router';
import { registerEvidenceHttpRoutes } from '../../server/evidence-http-routes';
import { registerPrivateOutputRoutes } from '../../server/output-artifact-storage';
import { getDb } from '../../server/db';
import { assertDemoConfiguration, seedDemoFixtures } from './seed-demo.mts';

assertDemoConfiguration();
if (process.env.SERS_DEMO_HOST && process.env.SERS_DEMO_HOST !== '127.0.0.1') throw new Error('Demo may only bind 127.0.0.1');
const port = Number(process.env.SERS_DEMO_PORT || '3100');
if (!Number.isInteger(port) || port < 1024 || port > 65535) throw new Error('Invalid loopback demo port');
const base = `http://127.0.0.1:${port}`, fixture = await seedDemoFixtures();
const bootstrap = randomBytes(32).toString('hex'), gate = randomBytes(32).toString('hex');
const sessions = new Map<string, { user: typeof fixture.owner; expiresAt: number }>();
const cookie = (req: Request, name: string) => req.headers.cookie?.split(';').map(part => part.trim()).find(part => part.startsWith(`${name}=`))?.slice(name.length + 1);
const equal = (value: unknown, expected: string) => typeof value === 'string' && /^[a-f0-9]{64}$/.test(value) && timingSafeEqual(Buffer.from(value), Buffer.from(expected));
const authenticate = async (req: Request) => {
  const token = cookie(req, 'sers_demo_session') || '', session = sessions.get(token);
  if (!session || session.expiresAt <= Date.now()) { sessions.delete(token); return null; }
  return session.user;
};
const app = express();
app.disable('x-powered-by');
app.use((req, res, next) => {
  if (req.headers.host !== `127.0.0.1:${port}` || !['127.0.0.1', '::ffff:127.0.0.1'].includes(req.socket.remoteAddress || '')) { res.status(403).end(); return; }
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('Referrer-Policy', 'no-referrer');
  next();
});
registerEvidenceHttpRoutes(app, { authenticate });
registerPrivateOutputRoutes(app, authenticate);
app.use(express.urlencoded({ extended: false, limit: '1kb' }));
app.get('/demo', (req, res) => {
  if (equal(req.query.key, bootstrap)) {
    res.cookie('sers_demo_gate', gate, { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 });
    res.redirect('/demo'); return;
  }
  if (!equal(cookie(req, 'sers_demo_gate'), gate)) { res.status(403).send('Open the local launch URL printed in the terminal.'); return; }
  res.type('html').send(`<!doctype html><html lang="ar" dir="rtl"><meta charset="utf-8"><title>SERS — عرض اصطناعي محلي</title><body style="max-width:700px;margin:4rem auto;font-family:Arial;line-height:2"><h1>عرض SERS المحلي</h1><p>هذه بيئة اصطناعية على جهازك. لا تدخل بيانات حقيقية.</p><form method="post" action="/demo/session"><button name="actor" value="owner">الدخول بصفة المالك</button> <button name="actor" value="reviewer">الدخول بصفة المراجع</button></form><p>ارفع شاهدًا من المكتبة، اربطه بالتقرير، أنشئ نسخة، ثم عد إلى هذه الصفحة لتبديل الدور واعتمادها.</p></body></html>`);
});
app.post('/demo/session', (req, res) => {
  if (req.get('origin') !== base || !equal(cookie(req, 'sers_demo_gate'), gate) || !['owner', 'reviewer'].includes(req.body.actor)) { res.status(403).end(); return; }
  const token = randomBytes(32).toString('hex');
  const old = cookie(req, 'sers_demo_session'); if (old) sessions.delete(old);
  for (const [key, session] of sessions) if (session.expiresAt <= Date.now()) sessions.delete(key);
  if (sessions.size >= 20) { res.status(429).send('Restart the demo to clear sessions.'); return; }
  sessions.set(token, { user: req.body.actor === 'owner' ? fixture.owner : fixture.reviewer, expiresAt: Date.now() + 8 * 60 * 60 * 1000 });
  res.cookie('sers_demo_session', token, { httpOnly: true, sameSite: 'strict', maxAge: 8 * 60 * 60 * 1000 });
  res.redirect(req.body.actor === 'owner' ? `/work/${fixture.workId}/report` : '/reviews');
});
app.use('/api/trpc', createExpressMiddleware({ router: appRouter, createContext: async ({ req, res }) => ({ req, res, user: await authenticate(req) }) }));
app.use(express.static(resolve('dist/public')));
app.get('*', (_req, res) => res.sendFile(resolve('dist/public/index.html')));
const server = app.listen(port, '127.0.0.1', () => {
  console.log(`Synthetic demo only. Open ${base}/demo?key=${bootstrap}`);
  console.log(`Return to ${base}/demo to switch owner/reviewer. All sessions end on restart.`);
});
let shuttingDown = false;
async function shutdown() {
  if (shuttingDown) return; shuttingDown = true;
  server.closeAllConnections();
  await new Promise<void>(done => server.close(() => done()));
  const db = await getDb();
  await (db as unknown as { $client: { promise(): { end(): Promise<void> } } })?.$client.promise().end();
}
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
