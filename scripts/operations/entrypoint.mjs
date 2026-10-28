import { readFile } from 'node:fs/promises';
import { spawn } from 'node:child_process';

export async function runtimeEnvironment(source = process.env) {
  const env = { ...source };
  const secret = async (path, label) => {
    if (!path) throw new Error(`${label} file is required`);
    const value = (await readFile(path, 'utf8')).trim();
    if (value.length < 32 || value.length > 512 || /[\r\n\0]/.test(value)) throw new Error(`${label} must contain 32–512 characters on one line`);
    return value;
  };
  if (!env.DATABASE_URL) {
    const name = env.SERS_DATABASE_NAME;
    if (!/^sers_(staging|demo)$/.test(name ?? '')) throw new Error('Staging database must be sers_staging or sers_demo');
    const port = env.SERS_DATABASE_PORT || '3306';
    if (!/^[0-9]+$/.test(port) || Number(port) < 1 || Number(port) > 65535) throw new Error('Invalid database port');
    const url = new URL(`mysql://${env.SERS_DATABASE_HOST || 'mysql'}:${port}/${name}`);
    url.username = env.SERS_DATABASE_USER || 'sers';
    url.password = await secret(env.MYSQL_PASSWORD_FILE, 'MySQL password');
    env.DATABASE_URL = url.href;
  }
  const database = new URL(env.DATABASE_URL);
  if (database.protocol !== 'mysql:' || !/^\/sers_(staging|demo)$/.test(database.pathname)) throw new Error('Operations refuse databases other than sers_staging or sers_demo');
  if (!env.JWT_SECRET) env.JWT_SECRET = await secret(env.JWT_SECRET_FILE, 'Session secret');
  if (env.JWT_SECRET.length < 32) throw new Error('Session secret is too short');
  if (!env.SERS_HEALTHCHECK_TOKEN) env.SERS_HEALTHCHECK_TOKEN = await secret(env.SERS_HEALTHCHECK_TOKEN_FILE, 'Health probe secret');
  return env;
}

export async function main() {
  const action = process.argv[2] || 'serve';
  const env = await runtimeEnvironment();
  const commands = {
    serve: ['dist/index.js'],
    migrate: ['node_modules/drizzle-kit/bin.cjs', 'migrate', '--config', 'drizzle.config.ts'],
    'seed-demo': ['--import', 'tsx', 'scripts/operations/seed-demo.mts'],
    demo: ['--import', 'tsx', 'scripts/operations/demo-server.mts'],
    worker: ['--import', 'tsx', 'scripts/operations/upload-worker.mts'],
    'verify-demo': ['--import', 'tsx', 'scripts/operations/verify-demo.mts'],
    'verify-output-runtime': ['--import', 'tsx', 'scripts/operations/verify-output-runtime.mts'],
    preflight: ['scripts/operations/release-preflight.mjs'],
    'inspect-health': ['scripts/operations/inspect-health.mjs'],
  };
  if (!Object.hasOwn(commands, action)) throw new Error('Unknown operations action');
  if (action === 'serve' && (!env.VITE_APP_ID || !env.OAUTH_SERVER_URL || !env.VITE_OAUTH_PORTAL_URL)) throw new Error('Staging OAuth configuration is required');
  if (['serve', 'worker', 'demo', 'verify-output-runtime'].includes(action)) {
    const { releasePreflight } = await import('./release-preflight.mjs');
    try { await releasePreflight(env); }
    catch (error) { throw new Error(`Startup refused. ${error.message}`); }
  }
  const child = spawn(process.execPath, commands[action], { env, stdio: 'inherit' });
  for (const signal of ['SIGTERM', 'SIGINT']) process.on(signal, () => child.kill(signal));
  child.on('error', () => { console.error('Unable to start staging process'); process.exitCode = 1; });
  child.on('exit', (code, signal) => { process.exitCode = code ?? (signal ? 1 : 0); });
}
if (process.argv[1] && new URL(import.meta.url).pathname === process.argv[1]) {
  main().catch(error => { console.error(error.message); process.exitCode = 1; });
}
