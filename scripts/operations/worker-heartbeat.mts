import { lstat, open, rename, rm } from 'node:fs/promises';
import { constants } from 'node:fs';
import { randomUUID } from 'node:crypto';
import path from 'node:path';

export async function writeWorkerHeartbeat(file: string, lastSuccess: string | null, status: 'ok' | 'error') {
  if (!path.isAbsolute(file)) throw new Error('Absolute worker heartbeat path required');
  const parent = await lstat(path.dirname(file));
  if (!parent.isDirectory() || parent.isSymbolicLink() || parent.uid !== process.getuid?.() || (parent.mode & 0o077) !== 0) throw new Error('Worker state directory must be private');
  const temporary = path.join(path.dirname(file), `.heartbeat-${randomUUID()}`);
  try {
    const handle = await open(temporary, constants.O_WRONLY | constants.O_CREAT | constants.O_EXCL | constants.O_NOFOLLOW, 0o600);
    try { await handle.writeFile(JSON.stringify({ updatedAt: lastSuccess ?? new Date(0).toISOString(), status })); await handle.sync(); }
    finally { await handle.close(); }
    await rename(temporary, file);
  } finally { await rm(temporary, { force: true }); }
}
