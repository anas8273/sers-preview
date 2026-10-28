import assert from 'node:assert/strict';
import { test } from 'node:test';
import { mkdtemp, mkdir, readFile, writeFile, rm, chmod, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { createReleaseContract, verifyReleaseContract, assertSupportedSchema } from './release-contract.mjs';
import { validateReleaseConfiguration } from './release-preflight.mjs';
import { recoveryTargets, recoveryObservations, measuredRun } from './dr-observations.mjs';
import { rollbackDecision } from './rollback-drill.mjs';
import { writeWorkerHeartbeat } from './worker-heartbeat.mts';

test('image contract detects modified runtime content and rejects unsupported applied schema', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sers-release-contract-'));
  try {
    for (const name of ['dist', 'server', 'shared', 'scripts', 'drizzle/meta']) await mkdir(path.join(directory, name), { recursive: true });
    for (const name of ['dist/index.js', 'package.json', 'drizzle.config.ts', 'tsconfig.json']) await writeFile(path.join(directory, name), '{}');
    await writeFile(path.join(directory, 'drizzle/meta/_journal.json'), JSON.stringify({ dialect: 'mysql', entries: [{ idx: 0, when: 1000, tag: '0000_fixture' }] }));
    await writeFile(path.join(directory, 'drizzle/0000_fixture.sql'), 'CREATE TABLE fixture (id int NOT NULL);');
    await writeFile(path.join(directory, 'drizzle/meta/0000_snapshot.json'), JSON.stringify({ tables: { fixture: { name: 'fixture', columns: { id: { name: 'id', type: 'int', notNull: true } } } } }));
    const contract = await createReleaseContract(directory, 'a'.repeat(40));
    await writeFile(path.join(directory, 'dist/release-contract.json'), JSON.stringify(contract));
    assert.equal((await verifyReleaseContract(directory)).revision, 'a'.repeat(40));
    assertSupportedSchema(contract.schema, contract.schema.migrations, [{ table: 'fixture', column: 'id', type: 'int', nullable: 'NO' }]);
    assert.throws(() => assertSupportedSchema(contract.schema, [...contract.schema.migrations, { hash: 'b'.repeat(64), createdAt: 2000 }]), /does not support/);
    assert.throws(() => assertSupportedSchema(contract.schema, contract.schema.migrations, [{ table: 'fixture', column: 'id', type: 'int', nullable: 'YES' }]), /columns differ/);
    assert.equal(rollbackDecision(null, contract.schema.migrations).allowed, false);
    assert.equal(rollbackDecision(contract, contract.schema.migrations, contract.schema.columns).allowed, true);
    assert.equal(rollbackDecision(contract, [...contract.schema.migrations, { hash: 'c'.repeat(64), createdAt: 2000 }]).allowed, false);
    await writeFile(path.join(directory, 'dist/index.js'), 'modified executable');
    await assert.rejects(verifyReleaseContract(directory), /missing or modified/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('release config rejects insecure production auth, unbounded budgets and demo bypass flags without echoing secrets', () => {
  const env = { NODE_ENV: 'production', JWT_SECRET: '0123456789abcdef'.repeat(4), SERS_HEALTHCHECK_TOKEN: 'b'.repeat(64), DATABASE_URL: 'mysql://sers:private-password@mysql/sers_staging', APP_PUBLIC_ORIGIN: 'https://sers.example', OAUTH_SERVER_URL: 'https://identity.example', OAUTH_PORTAL_URL: 'https://identity.example', VITE_APP_ID: 'registered-app', SERS_UPLOAD_PERSONAL_LIMIT_BYTES: '10000', SERS_UPLOAD_SCHOOL_LIMIT_BYTES: '100000', SERS_UPLOAD_MAX_ACTIVE_INTENTS: '20', SERS_UPLOADS_ENABLED: '1', SERS_CLAMAV_HOST: 'clamav', SERS_CLAMAV_PORT: '3310', SERS_PRIVATE_STORAGE_DIR: '/var/lib/sers/evidence', SERS_WORKER_HEARTBEAT_PATH: '/var/run/sers-worker/heartbeat.json' };
  validateReleaseConfiguration(env);
  assert.throws(() => validateReleaseConfiguration({ ...env, APP_PUBLIC_ORIGIN: 'http://sers.example' }), /Authentication configuration/);
  assert.throws(() => validateReleaseConfiguration({ ...env, JWT_SECRET: 'a'.repeat(64) }), /Authentication configuration/);
  assert.throws(() => validateReleaseConfiguration({ ...env, OAUTH_SERVER_URL: 'https://identity.example?unexpected=1' }), /Authentication configuration/);
  assert.throws(() => validateReleaseConfiguration({ ...env, VITE_APP_ID: 'invalid app' }), /Authentication configuration/);
  assert.throws(() => validateReleaseConfiguration({ ...env, SERS_DEMO_MODE: 'synthetic-only' }), /production identity/);
  assert.throws(() => validateReleaseConfiguration({ ...env, SERS_UPLOAD_MAX_ACTIVE_INTENTS: '1001' }), /dependency configuration/);
  assert.throws(() => validateReleaseConfiguration({ ...env, SERS_UPLOAD_SCHOOL_LIMIT_BYTES: 'Infinity' }), /finite positive/);
  assert.throws(() => validateReleaseConfiguration({ ...env, SERS_HEALTHCHECK_TOKEN: '' }), /secret.*invalid/);
});

test('DR observations separate backup age and fixture duration from actual data-loss and service-RTO claims', async () => {
  const targets = recoveryTargets({ SERS_DR_TARGET_RESTORE_SECONDS: '30', SERS_DR_TARGET_BACKUP_AGE_SECONDS: '60' });
  const manifest = { sourceDatabase: 'sers_demo', createdAt: '2026-10-28T00:00:00Z', measurement: { quiescenceObservedAt: '2026-10-27T23:59:50Z' } };
  const measured = recoveryObservations(manifest, '2026-10-28T00:00:30Z', 10000, targets);
  assert.equal(measured.backupAgeAtRestoreStartMs, 40000);
  assert.equal(measured.actualLostCommits, null);
  assert.equal(measured.fullServiceRtoMeasured, false);
  assert.equal(measured.scope, 'synthetic fixture');
  assert.deepEqual(measured.checks, { isolatedRestoreWithinTarget: true, backupFreshnessWithinTarget: true });
  assert.equal(recoveryObservations(manifest, '2026-10-28T00:02:00Z', 40000, targets).checks.backupFreshnessWithinTarget, false);
  assert.equal(recoveryObservations(manifest, '2026-10-28T00:00:30Z', 10000, recoveryTargets({})).checks.isolatedRestoreWithinTarget, null);
  assert.throws(() => recoveryTargets({ SERS_DR_TARGET_RESTORE_SECONDS: '-1' }), /positive whole seconds/);
  assert.throws(() => recoveryObservations(manifest, '2026-10-27T22:00:00Z', 1, targets), /timestamps/);
  const run = measuredRun(); await assert.rejects(run.phase('failedOperation', async () => { throw new Error('expected'); }));
  assert.ok(Number.isSafeInteger(run.phasesMs.failedOperation));
});

test('worker failure keeps last successful heartbeat time, uses private atomic file and rejects public directory', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sers-worker-state-'));
  try {
    const file = path.join(directory, 'heartbeat.json'), success = '2026-10-28T00:00:00.000Z';
    await writeWorkerHeartbeat(file, success, 'ok');
    await writeWorkerHeartbeat(file, success, 'error');
    assert.deepEqual(JSON.parse(await readFile(file, 'utf8')), { updatedAt: success, status: 'error' });
    assert.equal((await stat(file)).mode & 0o777, 0o600);
    await chmod(directory, 0o755);
    await assert.rejects(writeWorkerHeartbeat(file, success, 'ok'), /must be private/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
