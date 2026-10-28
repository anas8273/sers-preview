import { readFile } from 'node:fs/promises';
import { setTimeout as delay } from 'node:timers/promises';
import path from 'node:path';
import { sql, stagingName } from './ops-common.mjs';

export async function assertDisposableCi() {
  if (process.env.GITHUB_ACTIONS !== 'true' || stagingName() !== 'sers_demo' || process.env.SERS_COMPOSE_MODE || !/^sers-ci-[0-9]+-[0-9]+$/.test(process.env.COMPOSE_PROJECT_NAME || '')) throw new Error('This destructive failure drill requires the isolated CI demo project');
  const identity = (await sql('SELECT CONCAT(DATABASE(),\':\',VERSION());', 'sers_demo')).trim();
  if (!/^sers_demo:8\.4\./.test(identity)) throw new Error('Disposable database identity mismatch');
}
export async function healthProbe() {
  const port = process.env.SERS_HTTP_PORT || '3000';
  if (!/^[1-9][0-9]*$/.test(port) || Number(port) > 65535) throw new Error('Invalid loopback probe port');
  const token = (await readFile(path.join(process.env.SERS_SECRETS_DIR, 'healthcheck_token'), 'utf8')).trim();
  if (!/^[a-f0-9]{64}$/.test(token)) throw new Error('Invalid health probe credential');
  const base = `http://127.0.0.1:${port}`;
  return async (route, protectedRoute = false) => {
    const response = await fetch(base + route, { signal: AbortSignal.timeout(6000), headers: protectedRoute ? { Authorization: `Bearer ${token}` } : {} });
    const text = await response.text();
    if (text.length > 4096 || text.includes(token) || /mysql:\/\/|\/var\/lib|\/run\/secrets/.test(text)) throw new Error('Health response disclosed runtime details');
    return { status: response.status, body: JSON.parse(text) };
  };
}
export async function until(operation, timeoutMs) {
  const deadline = performance.now() + timeoutMs;
  let lastError;
  do {
    try { const result = await operation(); if (result) return result; } catch (error) { lastError = error; }
    await delay(1000);
  } while (performance.now() < deadline);
  throw new Error(lastError ? 'Bounded recovery probe failed' : 'Recovery probe exceeded its deadline');
}
