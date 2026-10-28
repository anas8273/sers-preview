import { mkdir, writeFile, lstat, realpath } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { assertQuiesced, compose, repoRoot, sha256, stagingName, tableCounts, tableChecksums } from './ops-common.mjs';

async function main() {
  const parent = process.argv[2];
  if (!parent || !path.isAbsolute(parent)) throw new Error('Provide an absolute private backup directory outside the repository');
  process.umask(0o077);
  const sourceDatabase = stagingName();
  await assertQuiesced();
  await mkdir(parent, { recursive: true, mode: 0o700 });
  const info = await lstat(parent), resolved = await realpath(parent), repository = await realpath(repoRoot);
  if (info.isSymbolicLink() || !info.isDirectory() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0 || resolved === repository || resolved.startsWith(repository + path.sep)) throw new Error('Backup destination must be private, owned by this user, and outside the repository');
  const directory = path.join(parent, `sers-${new Date().toISOString().replace(/[:.]/g, '-')}-${randomBytes(4).toString('hex')}`);
  await mkdir(directory, { recursive: true, mode: 0o700 });
  const counts = await tableCounts(sourceDatabase);
  const checksums = await tableChecksums(sourceDatabase, counts);
  // Stop all writers first: a SQL snapshot alone cannot synchronize filesystem data.
  await compose(['exec', '-T', 'mysql', 'sh', '-c', 'MYSQL_PWD="$(cat /run/secrets/mysql_root_password)" exec mysqldump -uroot --single-transaction --quick --hex-blob --set-gtid-purged=OFF --no-tablespaces --skip-comments --skip-dump-date --skip-add-locks --default-character-set=utf8mb4 ' + sourceDatabase], { outputFile: path.join(directory, 'database.sql') });
  await compose(['run', '--rm', '--no-deps', '-T', '--entrypoint', 'tar', 'app', '-C', '/var/lib/sers/evidence', '--hard-dereference', '-czf', '-', '.'], { outputFile: path.join(directory, 'evidence.tar.gz') });
  await assertQuiesced();
  const finalCounts = await tableCounts(sourceDatabase);
  const finalChecksums = await tableChecksums(sourceDatabase, finalCounts);
  if (JSON.stringify(counts) !== JSON.stringify(finalCounts) || JSON.stringify(checksums) !== JSON.stringify(finalChecksums)) throw new Error('Database changed during backup; discard this incomplete backup and stop all writers');
  const manifest = { format: 1, createdAt: new Date().toISOString(), sourceDatabase, tableCounts: counts, tableChecksums: checksums,
    consistency: 'Application and worker containers stopped; external writes must also be disabled',
    sha256: { 'database.sql': await sha256(path.join(directory, 'database.sql')), 'evidence.tar.gz': await sha256(path.join(directory, 'evidence.tar.gz')) } };
  // Manifest is written last, so interrupted folders cannot pass restore verification.
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify(manifest, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
  console.log(`Backup completed: ${directory}`);
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });
