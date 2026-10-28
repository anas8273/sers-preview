import { createHash } from 'node:crypto';
import { readFile, writeFile, readdir, lstat } from 'node:fs/promises';
import { createReadStream } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const hash = value => createHash('sha256').update(value).digest('hex');
export const contractPath = 'dist/release-contract.json';
export async function migrationContract(root) {
  const journal = JSON.parse(await readFile(path.join(root, 'drizzle/meta/_journal.json'), 'utf8'));
  if (journal.dialect !== 'mysql' || !Array.isArray(journal.entries) || !journal.entries.length || journal.entries.length > 1000) throw new Error('Invalid migration journal');
  const migrations = [];
  for (const [index, entry] of journal.entries.entries()) {
    if (entry.idx !== index || !Number.isSafeInteger(entry.when) || entry.when <= (migrations.at(-1)?.createdAt ?? 0) || !/^\d{4}_[a-z0-9_]+$/.test(entry.tag)) throw new Error('Invalid migration identity');
    migrations.push({ hash: hash(await readFile(path.join(root, `drizzle/${entry.tag}.sql`))), createdAt: entry.when });
  }
  const snapshot = JSON.parse(await readFile(path.join(root, `drizzle/meta/${String(journal.entries.at(-1).idx).padStart(4, '0')}_snapshot.json`), 'utf8'));
  const columns = Object.values(snapshot.tables).flatMap(table => Object.values(table.columns).map(column => ({ table: table.name, column: column.name, type: normalizeColumnType(column.type), nullable: !column.notNull })));
  columns.sort((a, b) => `${a.table}\0${a.column}`.localeCompare(`${b.table}\0${b.column}`, 'en'));
  return { policy: 'exact-migration-history-and-columns', migrations, columns };
}
export function normalizeColumnType(value) {
  return String(value).toLowerCase().replace(/\s+/g, '').replace(/^boolean$/, 'tinyint(1)');
}
export function assertSupportedSchema(contract, migrations, columns) {
  if (contract?.policy !== 'exact-migration-history-and-columns' || !Array.isArray(contract.migrations) || !contract.migrations.length || !Array.isArray(contract.columns) || !contract.columns.length) throw new Error('Image has no supported schema contract');
  if (migrations.length !== contract.migrations.length || migrations.some((row, index) => row.hash !== contract.migrations[index].hash || Number(row.createdAt) !== contract.migrations[index].createdAt)) throw new Error('Image does not support the applied migration history');
  if (columns) {
    const actual = columns.map(row => ({ table: row.table, column: row.column, type: normalizeColumnType(row.type), nullable: row.nullable === true || row.nullable === 'YES' }));
    actual.sort((a, b) => `${a.table}\0${a.column}`.localeCompare(`${b.table}\0${b.column}`, 'en'));
    if (JSON.stringify(actual) !== JSON.stringify(contract.columns)) throw new Error('Database columns differ from the image schema contract');
  }
}
export async function runtimeTreeHash(root) {
  const records = []; let bytes = 0;
  async function visit(relative) {
    const file = path.join(root, relative), info = await lstat(file);
    if (info.isSymbolicLink()) throw new Error('Runtime source cannot contain symlinks');
    if (info.isDirectory()) {
      for (const child of (await readdir(file)).sort()) await visit(`${relative}/${child}`);
      return;
    }
    if (!info.isFile() || relative === contractPath) return;
    bytes += info.size;
    if (records.length >= 20_000 || bytes > 256 * 1024 ** 2) throw new Error('Runtime contract exceeds verification bounds');
    const digest = createHash('sha256');
    for await (const chunk of createReadStream(file)) digest.update(chunk);
    records.push([relative, digest.digest('hex')]);
  }
  for (const entry of ['dist', 'server', 'shared', 'scripts', 'drizzle', 'package.json', 'drizzle.config.ts', 'tsconfig.json']) await visit(entry);
  return hash(JSON.stringify(records));
}
export async function createReleaseContract(root, revision) {
  if (!/^[a-f0-9]{40}$/.test(revision ?? '')) throw new Error('Build requires the full Git commit revision');
  return { format: 1, revision, nodeMajor: 22, runtimeTreeSha256: await runtimeTreeHash(root), schema: await migrationContract(root) };
}
export async function verifyReleaseContract(root) {
  const value = JSON.parse(await readFile(path.join(root, contractPath), 'utf8'));
  if (value.format !== 1 || !/^[a-f0-9]{40}$/.test(value.revision ?? '') || value.nodeMajor !== 22 || value.runtimeTreeSha256 !== await runtimeTreeHash(root)) throw new Error('Image release contract is missing or modified');
  if (JSON.stringify(value.schema) !== JSON.stringify(await migrationContract(root))) throw new Error('Image migration contract is modified');
  return value;
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv[2] !== 'write') throw new Error('Unknown release contract action');
  const result = await createReleaseContract(process.cwd(), process.env.SERS_BUILD_REVISION);
  await writeFile(path.join(process.cwd(), contractPath), JSON.stringify(result) + '\n', { mode: 0o644 });
  console.log('Image release contract written.');
}
