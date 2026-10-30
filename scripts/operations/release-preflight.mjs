import { fileURLToPath } from 'node:url';
import { access, lstat } from 'node:fs/promises';
import { constants } from 'node:fs';
import mysql from 'mysql2/promise';
import { tsImport } from 'tsx/esm/api';
import { verifyReleaseContract, assertSupportedSchema } from './release-contract.mjs';
const { trustedProxyAddresses } = await tsImport('../../server/_core/http-security.ts', import.meta.url);
const { getAuthConfig } = await tsImport('../../server/_core/env.ts', import.meta.url);

export function validateReleaseConfiguration(env) {
  if (!['production', 'development'].includes(env.NODE_ENV)) throw new Error('Unsupported runtime mode');
  for (const value of [env.JWT_SECRET, env.SERS_HEALTHCHECK_TOKEN]) if (typeof value !== 'string' || value.length < 32 || /[\r\n\0]/.test(value)) throw new Error('Required runtime secret is absent or invalid');
  const database = new URL(env.DATABASE_URL || '');
  if (database.protocol !== 'mysql:' || !/^\/sers_(staging|demo)$/.test(database.pathname)) throw new Error('Unsupported release database');
  if (env.NODE_ENV === 'production') {
    // Use the exact server validator, including secret diversity, app identity,
    // provider URL rules and callback bounds. A separate approximation can drift.
    trustedProxyAddresses(env.SERS_TRUSTED_PROXY_IPS ?? '');
    getAuthConfig({ appId: env.VITE_APP_ID ?? '', cookieSecret: env.JWT_SECRET ?? '', appPublicOrigin: env.APP_PUBLIC_ORIGIN ?? '', oAuthServerUrl: env.OAUTH_SERVER_URL ?? '', oAuthPortalUrl: env.OAUTH_PORTAL_URL ?? env.VITE_OAUTH_PORTAL_URL ?? '', isProduction: true });
    if (env.SERS_DEMO_MODE) throw new Error('Invalid production identity configuration');
  }
  for (const name of ['SERS_UPLOAD_PERSONAL_LIMIT_BYTES', 'SERS_UPLOAD_SCHOOL_LIMIT_BYTES', 'SERS_UPLOAD_MAX_ACTIVE_INTENTS', 'SERS_CLAMAV_PORT']) {
    if (!/^[1-9][0-9]*$/.test(env[name] || '') || !Number.isSafeInteger(Number(env[name]))) throw new Error('Upload limits must be explicit finite positive integers');
  }
  if (Number(env.SERS_UPLOAD_MAX_ACTIVE_INTENTS) > 1000 || Number(env.SERS_CLAMAV_PORT) > 65535 || !['0', '1'].includes(env.SERS_UPLOADS_ENABLED) || !env.SERS_CLAMAV_HOST || !env.SERS_PRIVATE_STORAGE_DIR?.startsWith('/') || !env.SERS_WORKER_HEARTBEAT_PATH?.startsWith('/')) throw new Error('Invalid runtime dependency configuration');
}
export async function releasePreflight(env = process.env, root = process.cwd()) {
  let stage = 'configuration';
  try {
  validateReleaseConfiguration(env);
  stage = 'runtime-identity';
  if (process.getuid?.() !== 10001 || Number(process.versions.node.split('.')[0]) !== 22) throw new Error('Release requires the non-root Node22 runtime');
  stage = 'image-contents';
  const contract = await verifyReleaseContract(root);
  stage = 'parser-binaries';
  for (const binary of ['/usr/bin/qpdf', '/usr/bin/prlimit', '/usr/bin/flock', '/usr/bin/pdfinfo', '/usr/bin/pdftoppm']) await access(binary, constants.X_OK);
  const storage = await lstat(env.SERS_PRIVATE_STORAGE_DIR);
  if (!storage.isDirectory() || storage.isSymbolicLink() || storage.uid !== 10001 || (storage.mode & 0o077) !== 0) throw new Error('Private storage ownership or mode is invalid');
  stage = 'database-connectivity';
  const connection = await mysql.createConnection({ uri: env.DATABASE_URL, connectTimeout: 5000 });
  try {
    const [identity] = await connection.query({ sql: 'SELECT DATABASE() AS name, VERSION() AS version', timeout: 5000 });
    if (!/^sers_(staging|demo)$/.test(identity[0].name) || !/^8\.4\./.test(identity[0].version)) throw new Error('Unsupported database engine or identity');
    stage = 'database-schema';
    const [migrations] = await connection.query({ sql: 'SELECT hash, created_at AS createdAt FROM __drizzle_migrations ORDER BY created_at,id', timeout: 5000 });
    const [columns] = await connection.query({ sql: "SELECT TABLE_NAME AS `table`, COLUMN_NAME AS `column`, COLUMN_TYPE AS type, IS_NULLABLE AS nullable FROM information_schema.COLUMNS WHERE TABLE_SCHEMA=DATABASE() AND TABLE_NAME<>'__drizzle_migrations' ORDER BY TABLE_NAME,COLUMN_NAME", timeout: 5000 });
    assertSupportedSchema(contract.schema, migrations, columns);
    return { passed: true, revision: contract.revision, imageContentsVerified: true, schemaPolicy: contract.schema.policy, migrations: migrations.length, configurationValidated: true, privateStorageOwnershipVerified: true, realOAuthLoginVerified: false };
  } finally { await connection.end(); }
  } catch { throw new Error(`Release preflight failed: ${stage}`); }
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  releasePreflight().then(result => console.log(JSON.stringify(result))).catch(error => { console.error(error.message); process.exitCode = 1; });
}
