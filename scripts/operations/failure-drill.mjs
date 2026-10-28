import assert from 'node:assert/strict';
import { compose } from './ops-common.mjs';
import { assertDisposableCi, healthProbe, until } from './disposable-ci.mjs';

await assertDisposableCi();
const probe = await healthProbe(), observations = [];
const ready = () => until(async () => (await probe('/readyz')).status === 200, 120_000);
await ready();
assert.equal((await probe('/api/operations/health')).status, 401);
try {
  for (const [service, dependency] of [['mysql', 'database'], ['clamav', 'scanner'], ['worker', 'worker']]) {
    const started = performance.now();
    // Pause the worker to test a genuinely stale heartbeat, rather than relying
    // on its graceful-shutdown signal. Other services are actually stopped.
    await compose(service === 'worker' ? ['pause', service] : ['stop', '-t', '30', service]);
    const failed = await until(async () => {
      const publicHealth = await probe('/readyz');
      if (publicHealth.status !== 503) return false;
      assert.deepEqual(publicHealth.body, { status: 'unavailable' });
      const detail = await probe('/api/operations/health', true);
      return detail.body.dependencies?.[dependency] !== 'ok' ? detail : false;
    }, service === 'worker' ? 180_000 : 30_000);
    assert.equal(failed.status, 503);
    assert.ok(['error', 'timeout'].includes(failed.body.dependencies[dependency]));
    const live = await probe('/healthz'); assert.equal(live.status, 200); assert.deepEqual(live.body, { status: 'ok' });
    const detectedAfterMs = Math.round(performance.now() - started), recoveryStarted = performance.now();
    await compose(service === 'worker' ? ['unpause', service] : ['start', service]);
    await ready();
    const recovered = await probe('/api/operations/health', true);
    assert.equal(recovered.status, 200);
    assert.ok(Object.values(recovered.body.dependencies).every(value => value === 'ok'));
    observations.push({ dependency, failedAsExpected: true, livenessPreserved: true, recovered: true, detectedAfterMs, recoveryAfterRestartMs: Math.round(performance.now() - recoveryStarted) });
  }
  // A successful readiness response alone is not proof of successful work.
  await compose(['run', '--rm', '--no-deps', 'seed-demo', 'verify-demo']);
  console.log(JSON.stringify({ passed: true, scope: 'disposable synthetic CI', realEvidenceAndWordAfterRecovery: true, observations }));
} finally {
  await compose(['unpause', 'worker']).catch(() => {});
  await compose(['start', 'mysql', 'clamav', 'worker']);
}
