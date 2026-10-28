import { spawn } from 'node:child_process';
import { createReadStream, createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const repoRoot = fileURLToPath(new URL('../../', import.meta.url));
export function stagingName() {
  const name = process.env.SERS_DATABASE_NAME || 'sers_staging';
  if (!/^sers_(staging|demo)$/.test(name)) throw new Error('Only sers_staging or sers_demo may be backed up by this tool');
  return name;
}
export function restoreName(value) {
  if (!/^sers_restore_[a-f0-9]{24}$/.test(value)) throw new Error('Restore drill requires its newly generated database name');
  return value;
}
export function identifier(value) {
  if (!/^[A-Za-z0-9_]+$/.test(value)) throw new Error('Unexpected database identifier');
  return `\`${value}\``;
}
export async function sha256(file) {
  const hash = createHash('sha256');
  for await (const chunk of createReadStream(file)) hash.update(chunk);
  return hash.digest('hex');
}
export async function command(binary, args, options = {}) {
  const timeoutMs = options.timeoutMs ?? 600_000;
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs < 1 || timeoutMs > 3_600_000) throw new Error('Invalid command deadline');
  const child = spawn(binary, args, { cwd: repoRoot, env: options.env ? { ...process.env, ...options.env } : process.env, stdio: ['pipe', 'pipe', 'pipe'] });
  const timer = setTimeout(() => child.kill('SIGKILL'), timeoutMs);
  let stderr = '', output = '';
  child.stderr.on('data', chunk => { if (stderr.length < 4096) stderr += chunk.toString(); });
  const completion = new Promise((resolve, reject) => {
    child.once('error', reject);
    child.once('exit', code => code === 0 ? resolve() : reject(new Error(`${binary} failed (${code}); inspect the service logs`)));
  });
  const transfer = options.outputFile
    ? pipeline(child.stdout, createWriteStream(options.outputFile, { mode: 0o600, flags: 'wx' }))
    : new Promise((resolve, reject) => {
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        if (output.length > (options.maxBuffer || 8 * 1024 * 1024)) { child.kill('SIGTERM'); reject(new Error('Command output exceeded bound')); }
      });
      child.stdout.once('end', resolve); child.stdout.once('error', reject);
    });
  if (options.inputFile && options.inputPrefix) child.stdin.write(options.inputPrefix);
  const input = options.inputFile ? pipeline(createReadStream(options.inputFile), child.stdin) : Promise.resolve(child.stdin.end(options.input || ''));
  try { await Promise.all([completion, transfer, input]); }
  catch (error) { child.kill('SIGKILL'); throw error; }
  finally { clearTimeout(timer); }
  return output;
}
export const compose = (args, options) => command('docker', ['compose', '-f', path.join(repoRoot, process.env.SERS_COMPOSE_MODE === 'demo' ? 'compose.demo.yml' : 'compose.staging.yml'), ...args], options);
const mysqlCommand = 'MYSQL_PWD="$(cat /run/secrets/mysql_root_password)" exec mysql -uroot --batch --raw --skip-column-names';
export function sql(query, database) {
  return compose(['exec', '-T', 'mysql', 'sh', '-c', mysqlCommand + (database ? ` --database=${identifier(database).slice(1, -1)}` : '')], { input: query + '\n' });
}
export async function tableCounts(database) {
  const rows = await sql('SELECT TABLE_NAME FROM information_schema.TABLES WHERE TABLE_SCHEMA=DATABASE() AND TABLE_TYPE=\'BASE TABLE\' ORDER BY TABLE_NAME;', database);
  const counts = {};
  for (const name of rows.trim().split('\n').filter(Boolean)) counts[name] = Number((await sql(`SELECT COUNT(*) FROM ${identifier(name)};`, database)).trim());
  if (!Object.keys(counts).length || Object.values(counts).some(n => !Number.isSafeInteger(n) || n < 0)) throw new Error('No valid migrated database tables were found');
  return counts;
}
export async function tableChecksums(database, counts) {
  const checksums = {};
  for (const name of Object.keys(counts)) {
    const row = (await sql(`CHECKSUM TABLE ${identifier(name)} EXTENDED;`, database)).trim().split('\t');
    if (!/^[0-9]+$/.test(row[1] || '')) throw new Error('Database cannot verify a table checksum');
    checksums[name] = row[1];
  }
  return checksums;
}
export async function assertQuiesced() {
  if (process.env.SERS_BACKUP_MODE !== 'quiesced') throw new Error('Set SERS_BACKUP_MODE=quiesced after stopping all writers');
  const raw = await compose(['ps', '--all', '--format', 'json']);
  let items;
  try { items = JSON.parse(raw); if (!Array.isArray(items)) items = [items]; }
  catch { items = raw.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)); }
  if (items.some(item => item.State === 'running' && !['mysql', 'clamav'].includes(item.Service))) throw new Error('Stop app, worker and other writer services before backup');
}
export async function verifiedManifest(directory) {
  const manifest = JSON.parse(await readFile(path.join(directory, 'manifest.json'), 'utf8'));
  if (manifest.format !== 1 || !/^sers_(staging|demo)$/.test(manifest.sourceDatabase) || !manifest.tableCounts || typeof manifest.tableCounts !== 'object' || !Object.keys(manifest.tableCounts).length || !manifest.tableChecksums) throw new Error('Invalid backup manifest');
  for (const name of ['database.sql', 'evidence.tar.gz']) {
    if (!/^[a-f0-9]{64}$/.test(manifest.sha256?.[name] || '') || await sha256(path.join(directory, name)) !== manifest.sha256[name]) throw new Error(`Backup integrity failure: ${name}`);
  }
  for (const [table, count] of Object.entries(manifest.tableCounts)) {
    identifier(table);
    if (!Number.isSafeInteger(count) || count < 0 || !/^[0-9]+$/.test(manifest.tableChecksums[table] || '')) throw new Error('Invalid table count/checksum');
  }
  return manifest;
}
