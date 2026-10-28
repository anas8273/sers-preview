import { readFile, lstat } from 'node:fs/promises';
try {
  const file = process.env.SERS_WORKER_HEARTBEAT_PATH;
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.uid !== process.getuid() || (info.mode & 0o077) !== 0 || info.size > 4096) throw new Error('Invalid worker state');
  const state = JSON.parse(await readFile(file, 'utf8')), value = Date.parse(state.updatedAt);
  if (state.status !== 'ok' || !Number.isSafeInteger(value) || Date.now() - value > 150_000 || value > Date.now()) process.exitCode = 1;
} catch { process.exitCode = 1; }
