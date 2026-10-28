import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, mkdir, readFile, writeFile, rm, symlink, stat } from 'node:fs/promises';
import path from 'node:path';
import { tmpdir } from 'node:os';
import { runtimeEnvironment } from './entrypoint.mjs';
import { command, identifier, restoreName, sha256, verifiedManifest } from './ops-common.mjs';
import { extractEvidenceArchive } from './archive.mjs';
import { assertDemoConfiguration } from './seed-demo.mts';
import { verifyRestoredEvidence } from './verify-restored-evidence.mts';
import { createPrivateFilesystemStorage } from '../../server/private-filesystem-storage';

const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

test('operations refuse production/ambiguous database identity and malformed restore targets', async () => {
  await assert.rejects(runtimeEnvironment({ DATABASE_URL: 'mysql://user:pass@localhost/production', JWT_SECRET: 'a'.repeat(64) }), /refuse/);
  assert.throws(() => assertDemoConfiguration({ NODE_ENV: 'production', SERS_DEMO_MODE: 'synthetic-only', DATABASE_URL: 'mysql://user:pass@localhost/sers_demo' }), /outside production/);
  assert.throws(() => assertDemoConfiguration({ NODE_ENV: 'development', SERS_DEMO_MODE: 'synthetic-only', DATABASE_URL: 'mysql://user:pass@localhost/sers_staging' }), /except sers_demo/);
  assert.throws(() => assertDemoConfiguration({ NODE_ENV: 'development', DATABASE_URL: 'mysql://user:pass@localhost/sers_demo' }), /explicit/);
  assert.throws(() => restoreName('sers_staging'), /newly generated/);
  assert.throws(() => identifier('sers_demo; DROP DATABASE sers_demo'), /Unexpected/);
  assert.equal(restoreName(`sers_restore_${'ab'.repeat(12)}`), `sers_restore_${'ab'.repeat(12)}`);
});

test('runtime reads bounded secrets, encodes database credentials and does not mutate inputs', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sers-ops-secret-'));
  try {
    const secret = path.join(directory, 'secret'); await writeFile(secret, 'a'.repeat(64), { mode: 0o600 });
    const source = { SERS_DATABASE_NAME: 'sers_demo', SERS_DATABASE_HOST: '127.0.0.1', SERS_DATABASE_PORT: '13306', MYSQL_PASSWORD_FILE: secret, JWT_SECRET_FILE: secret, SERS_HEALTHCHECK_TOKEN_FILE: secret };
    const env = await runtimeEnvironment(source), url = new URL(env.DATABASE_URL);
    assert.equal(url.pathname, '/sers_demo'); assert.equal(url.port, '13306'); assert.equal(url.password, 'a'.repeat(64));
    assert.equal(Object.hasOwn(source, 'DATABASE_URL'), false);
    await writeFile(secret, 'short'); await assert.rejects(runtimeEnvironment(source), /32–512/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('manifest validates both artifacts and refuses modified or incomplete backups', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sers-ops-manifest-'));
  try {
    await assert.rejects(verifiedManifest(directory));
    for (const name of ['database.sql', 'evidence.tar.gz']) await writeFile(path.join(directory, name), name);
    const manifest = { format: 1, sourceDatabase: 'sers_demo', tableCounts: { users: 2 }, tableChecksums: { users: '1234' }, sha256: {
      'database.sql': await sha256(path.join(directory, 'database.sql')), 'evidence.tar.gz': await sha256(path.join(directory, 'evidence.tar.gz')),
    } };
    await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest));
    assert.equal((await verifiedManifest(directory)).sourceDatabase, 'sers_demo');
    await writeFile(path.join(directory, 'database.sql'), 'modified');
    await assert.rejects(verifiedManifest(directory), /integrity failure/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('real private provider survives full tar restore, verifies ready evidence and Word, and detects corruption', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sers-ops-restore-'));
  try {
    const source = path.join(directory, 'source'), destination = path.join(directory, 'restored');
    await mkdir(source, { mode: 0o700 }); await mkdir(destination, { mode: 0o700 });
    const storage = await createPrivateFilesystemStorage({ rootDirectory: source });
    const bytes = Buffer.from('synthetic evidence'), key = 'evidence/synthetic/one';
    const put = await storage.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) });
    assert.equal(put.status, 'created'); if (put.status !== 'created') throw new Error('Fixture storage unavailable');
    const wordBytes = Buffer.from('synthetic immutable Word artifact'), storageKey = `outputs/work-1/version-1/${digest(wordBytes)}.docx`;
    assert.equal((await storage.putPrivateIfAbsent({ key: `artifacts/${digest(storageKey)}`, bytes: wordBytes, sha256: digest(wordBytes) })).status, 'created');
    const archive = path.join(directory, 'evidence.tar.gz');
    await command('tar', ['-C', source, '--hard-dereference', '-czf', archive, '.']);
    await extractEvidenceArchive(archive, destination);
    assert.equal((await stat(path.join(destination, 'refs'))).mode & 0o777, 0o700);
    const references = [{ kind: 'upload' as const, key, assetKey: key, version: put.version, bytes: bytes.length, sha256: digest(bytes) }, { kind: 'output' as const, storageKey }];
    assert.deepEqual(await verifyRestoredEvidence(destination, references), { uploads: 1, outputs: 1, bytes: bytes.length + wordBytes.length });
    await assert.rejects(verifyRestoredEvidence(destination, [{ ...references[0], kind: 'upload', key, assetKey: 'evidence/wrong', version: put.version, bytes: bytes.length, sha256: digest(bytes) }]), /Invalid restored upload/);
    await writeFile(path.join(destination, 'blobs', put.version), 'corrupt');
    await assert.rejects(verifyRestoredEvidence(destination, references), /unavailable|mismatched/);
    // The source remained intact: the drill only touched its extracted copy.
    assert.deepEqual(await readFile(path.join(source, 'blobs', put.version)), bytes);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

test('archive extraction refuses links before writing an escaped member', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'sers-ops-archive-'));
  try {
    const source = path.join(directory, 'source'), destination = path.join(directory, 'restored');
    await mkdir(source, { mode: 0o700 }); await mkdir(destination, { mode: 0o700 });
    await symlink('/etc/passwd', path.join(source, 'unsafe'));
    const archive = path.join(directory, 'unsafe.tar.gz');
    await command('tar', ['-C', source, '-czf', archive, '.']);
    await assert.rejects(extractEvidenceArchive(archive, destination), /failed/);
    await assert.rejects(stat(path.join(destination, 'unsafe')));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
