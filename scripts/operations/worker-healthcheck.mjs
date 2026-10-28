import { readFile } from 'node:fs/promises';
try {
  const value = Number(await readFile('/tmp/sers-worker-heartbeat', 'utf8'));
  if (!Number.isSafeInteger(value) || Date.now() - value > 180_000 || value > Date.now()) process.exitCode = 1;
} catch { process.exitCode = 1; }
