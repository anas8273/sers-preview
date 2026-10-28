import { mkdir, writeFile, lstat } from 'node:fs/promises';
import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { repoRoot } from './ops-common.mjs';

const directory = process.argv[2];
if (!directory || !path.isAbsolute(directory) || path.resolve(directory).startsWith(path.resolve(repoRoot) + path.sep) || path.resolve(directory) === path.resolve(repoRoot)) throw new Error('Use an absolute private secrets directory outside the repository');
process.umask(0o077);
await mkdir(directory, { recursive: true, mode: 0o700 });
const info = await lstat(directory);
if (info.isSymbolicLink() || !info.isDirectory() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid()) throw new Error('Secrets directory must be owned by this user with mode 0700');
for (const name of ['mysql_password', 'mysql_root_password', 'jwt_secret']) {
  // Refuse overwrite: rotating only one side would invalidate the running DB.
  await writeFile(path.join(directory, name), randomBytes(32).toString('hex') + '\n', { mode: 0o600, flag: 'wx' });
}
console.log('Three secret files created; existing files are never overwritten.');
