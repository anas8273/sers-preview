/** Explicit worker process; importing the application never starts maintenance. */
import { setTimeout as delay } from 'node:timers/promises';
import { asc, gt } from 'drizzle-orm';
import { uploadQuotaBudgets } from '../../drizzle/upload-intents';
import { getDb } from '../../server/db';
import { getUploadRuntime } from '../../server/upload-runtime';
import { expireUploadIntentsForScope } from '../../server/upload-intent-db';
import { reconcileUploadReceptionsForScope } from '../../server/upload-reception-service';
import { maintainUploadLifecycleForScope } from '../../server/upload-lifecycle-service';
import { writeWorkerHeartbeat } from './worker-heartbeat.mts';

const stop = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => stop.abort());
let cursor = '';
const heartbeatPath = process.env.SERS_WORKER_HEARTBEAT_PATH;
if (!heartbeatPath) throw new Error('Worker heartbeat path required');
let lastSuccess: string | null = null;
const heartbeat = async (status: 'ok' | 'error' = 'ok') => {
  if (status === 'ok') lastSuccess = new Date().toISOString();
  await writeWorkerHeartbeat(heartbeatPath, lastSuccess, status);
};
const watchdog = () => setTimeout(() => { console.error('Upload worker exceeded its bounded operation deadline'); process.exit(1); }, 120_000);
const db = await getDb();
if (!db) throw new Error('Database is required for upload maintenance');
try {
  while (!stop.signal.aborted) {
    const totals = { scopes: 0, expired: 0, reconciled: 0, inspected: 0, validated: 0, cleaned: 0 };
    let timer = watchdog();
    const progress = async () => { await heartbeat(); clearTimeout(timer); timer = watchdog(); };
    try {
      const runtime = await getUploadRuntime(); // Disabled intake still permits draining.
      const scopes = await db.select({ scopeKey: uploadQuotaBudgets.scopeKey }).from(uploadQuotaBudgets)
        .where(cursor ? gt(uploadQuotaBudgets.scopeKey, cursor) : undefined)
        .orderBy(asc(uploadQuotaBudgets.scopeKey)).limit(100);
      for (const { scopeKey } of scopes) {
        if (stop.signal.aborted) break;
        // One scan/cleanup candidate per scope keeps a slow scanner from starving
        // the registry. Durable leases/backoff remain authoritative across restart.
        const expiry = await expireUploadIntentsForScope(scopeKey, 100);
        await progress();
        const reception = await reconcileUploadReceptionsForScope(scopeKey, runtime.storage, 1);
        await progress();
        const lifecycle = await maintainUploadLifecycleForScope(scopeKey, runtime, 1);
        totals.scopes++; totals.expired += expiry.expired; totals.reconciled += reception.processed;
        totals.inspected += reception.inspected + lifecycle.inspected;
        totals.validated += lifecycle.validated; totals.cleaned += lifecycle.cleaned;
        cursor = scopeKey;
        await progress();
      }
      if (scopes.length < 100) cursor = '';
      await progress();
      console.log(JSON.stringify({ event: 'upload_maintenance', ...totals }));
    } catch {
      // Do not put account keys, storage keys, filenames or credentials in logs.
      console.error(JSON.stringify({ event: 'upload_maintenance_failed', ...totals }));
      await heartbeat('error').catch(() => {});
    } finally { clearTimeout(timer); }
    await delay(10_000, undefined, { signal: stop.signal }).catch(() => {});
  }
} finally {
  await heartbeat('error').catch(() => {});
  await (db as unknown as { $client: { promise(): { end(): Promise<void> } } }).$client.promise().end();
}
