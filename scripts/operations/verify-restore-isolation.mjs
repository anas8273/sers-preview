/** Adversarial restore regression, restricted to the disposable CI demo DB. */
import assert from 'node:assert/strict';
import { cp, mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { command, compose, sha256, stagingName, tableCounts, tableChecksums, verifiedManifest } from './ops-common.mjs';

if (process.env.GITHUB_ACTIONS !== 'true' || stagingName() !== 'sers_demo') throw new Error('Restore isolation test requires disposable CI sers_demo');
const source = process.argv[2], baseline = await verifiedManifest(source);
const temporary = await mkdtemp(path.join(tmpdir(), 'sers-restore-isolation-'));
try {
  for (const [name, prefix] of [
    ['client-command', '\\! touch /tmp/sers-restore-client-command\n'],
    ['database-escape', 'DROP DATABASE sers_demo;\n'],
  ]) {
    const copy = path.join(temporary, name);
    await cp(source, copy, { recursive: true });
    const sqlFile = path.join(copy, 'database.sql');
    const original = await readFile(sqlFile);
    if (original.length > 16 * 1024 * 1024) throw new Error('Synthetic regression fixture exceeds bound');
    await writeFile(sqlFile, Buffer.concat([Buffer.from(prefix), original]));
    const manifest = structuredClone(baseline); manifest.sha256['database.sql'] = await sha256(sqlFile);
    await writeFile(path.join(copy, 'manifest.json'), JSON.stringify(manifest));
    await assert.rejects(command(process.execPath, ['scripts/operations/restore-drill.mjs', copy]), /failed/);
    await compose(['exec', '-T', 'mysql', 'sh', '-c', 'test ! -e /tmp/sers-restore-client-command']);
    assert.deepEqual(await tableCounts('sers_demo'), baseline.tableCounts);
    assert.deepEqual(await tableChecksums('sers_demo', baseline.tableCounts), baseline.tableChecksums);
  }
  console.log('Restore rejects MySQL client commands and cross-database writes; source data unchanged.');
} finally { await rm(temporary, { recursive: true, force: true }); }
