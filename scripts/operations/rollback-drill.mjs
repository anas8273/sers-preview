import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdtemp, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { command, compose, repoRoot, sql, tableCounts, tableChecksums } from './ops-common.mjs';
import { assertSupportedSchema } from './release-contract.mjs';
import { assertDisposableCi, healthProbe, until } from './disposable-ci.mjs';

export function rollbackDecision(candidate, appliedMigrations, columns) {
  if (candidate?.format !== 1 || !/^[a-f0-9]{40}$/.test(candidate.revision || '') || !/^[a-f0-9]{64}$/.test(candidate.runtimeTreeSha256 || '')) return { allowed: false, reason: 'previous-image-has-no-release-contract' };
  try { assertSupportedSchema(candidate.schema, appliedMigrations, columns); }
  catch { return { allowed: false, reason: 'previous-image-does-not-support-current-schema' }; }
  return { allowed: true, reason: 'exact-schema-support-declared' };
}
async function main() {
  await assertDisposableCi();
  const previousImage = process.env.SERS_PREVIOUS_IMAGE_ID;
  if (!/^sha256:[a-f0-9]{64}$/.test(previousImage || '')) throw new Error('Rollback candidate must be a locally built immutable image ID');
  const inspected = JSON.parse(await command('docker', ['image', 'inspect', previousImage, '--format', '{{json .}}']));
  if (inspected.Id !== previousImage || inspected.Config.User !== '10001:10001') throw new Error('Unsupported rollback image identity or user');
  const candidate = JSON.parse(await command('docker', ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--entrypoint', 'node', previousImage, '-e', "const fs=require('fs');try{console.log(fs.readFileSync('/app/dist/release-contract.json','utf8'))}catch(e){if(e.code==='ENOENT')console.log('null');else process.exit(1)}"]));
  const probe = await healthProbe();
  await until(async () => (await probe('/readyz')).status === 200, 120_000);
  const marker = createHash('sha256').update('synthetic-rollback-rate-limit').digest('hex');
  await sql(`INSERT INTO auth_rate_limits (keyHash,windowStartedAt,count,expiresAt) VALUES ('${marker}',UTC_TIMESTAMP(),1,DATE_ADD(UTC_TIMESTAMP(),INTERVAL 1 DAY)) ON DUPLICATE KEY UPDATE count=count+1;`, 'sers_demo');
  const temporary = await mkdtemp(path.join(tmpdir(), 'sers-code-rollback-'));
  let result, activated = false;
  try {
    await compose(['stop', 'app', 'worker']);
    const counts = await tableCounts('sers_demo'), checksums = await tableChecksums('sers_demo', counts);
    const migrations = (await sql("SELECT JSON_OBJECT('hash',hash,'createdAt',created_at) FROM __drizzle_migrations ORDER BY created_at,id;", 'sers_demo')).trim().split('\n').filter(Boolean).map(JSON.parse);
    const columns = (await sql("SELECT JSON_OBJECT('table',TABLE_NAME,'column',COLUMN_NAME,'type',COLUMN_TYPE,'nullable',IS_NULLABLE) FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME<>'__drizzle_migrations';", 'sers_demo')).trim().split('\n').filter(Boolean).map(JSON.parse);
    const decision = rollbackDecision(candidate, migrations, columns);
    if (decision.allowed) {
      const override = path.join(temporary, 'previous-image.json');
      await writeFile(override, JSON.stringify({ services: { app: { image: previousImage }, worker: { image: previousImage } } }), { mode: 0o600 });
      activated = true;
      // Never run migrations or restore a DB backup during a code rollback.
      await command('docker', ['compose', '-f', path.join(repoRoot, 'compose.staging.yml'), '-f', override, 'up', '-d', '--no-build', '--wait', '--wait-timeout', '240', 'app', 'worker']);
      await until(async () => (await probe('/readyz')).status === 200, 120_000);
      await compose(['stop', 'app', 'worker']);
    }
    assert.deepEqual(await tableCounts('sers_demo'), counts);
    assert.deepEqual(await tableChecksums('sers_demo', counts), checksums);
    assert.equal(Number((await sql(`SELECT COUNT(*) FROM auth_rate_limits WHERE keyHash='${marker}' AND count>=1;`, 'sers_demo')).trim()), 1);
    result = { passed: true, candidateImageId: previousImage, activation: activated ? 'compatible-previous-image-tested' : 'refused', reason: decision.reason, newSchemaDataPreserved: true, allTableCountsAndChecksumsPreserved: true, databaseRollbackAttempted: false };
  } finally {
    await compose(['up', '-d', '--no-build', '--wait', '--wait-timeout', '240', 'app', 'worker']);
    await rm(temporary, { recursive: true, force: true });
  }
  await until(async () => (await probe('/readyz')).status === 200, 120_000);
  console.log(JSON.stringify({ ...result, currentReleaseRecovered: true }));
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) main().catch(() => { console.error('Disposable code rollback drill failed'); process.exitCode = 1; });
