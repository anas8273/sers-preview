import { mkdir, lstat, chown, chmod, open, readFile } from 'node:fs/promises';
import { constants } from 'node:fs';
// This one-shot process has no network and does not recurse through existing data.
const root = '/var/lib/sers/evidence';
await mkdir(root, { recursive: true, mode: 0o700 });
const stat = await lstat(root);
if (!stat.isDirectory() || stat.isSymbolicLink()) throw new Error('Private storage root must be a directory');
await chown(root, 10001, 10001);
await chmod(root, 0o700);
// Compose file secrets preserve host ownership. Copy only app secrets into a
// private volume so UID10001 can read them without world-readable host files.
const secrets = '/var/run/sers-secrets';
await mkdir(secrets, { recursive: true, mode: 0o700 });
const secretInfo = await lstat(secrets);
if (!secretInfo.isDirectory() || secretInfo.isSymbolicLink()) throw new Error('Invalid runtime secret directory');
await chown(secrets, 10001, 10001); await chmod(secrets, 0o700);
for (const name of ['mysql_password', 'jwt_secret', 'healthcheck_token']) {
  const value = (await readFile(`/run/secrets/${name}`, 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(value)) throw new Error('Use 32-byte hexadecimal staging secrets');
  const file = await open(`${secrets}/${name}`, constants.O_WRONLY | constants.O_CREAT | constants.O_TRUNC | constants.O_NOFOLLOW, 0o600);
  try { await file.chown(10001, 10001); await file.chmod(0o600); await file.writeFile(value); await file.sync(); }
  finally { await file.close(); }
}
const workerState = '/var/run/sers-worker';
await mkdir(workerState, { recursive: true, mode: 0o700 });
const workerInfo = await lstat(workerState);
if (!workerInfo.isDirectory() || workerInfo.isSymbolicLink()) throw new Error('Invalid worker state directory');
await chown(workerState, 10001, 10001); await chmod(workerState, 0o700);
