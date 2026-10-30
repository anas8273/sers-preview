import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream } from 'node:fs';
import { lstat, readdir, readFile, writeFile, mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_FILE, IMAGE_FILE, MAX_MANIFEST_BYTES, MAX_ARCHIVE_BYTES, validateCandidate } from './candidate.mjs';
import { REPOSITORY, REPOSITORY_ID, boundedJson, newPrivateDirectory, writeJson } from './github-evidence.mjs';

export const root = fileURLToPath(new URL('../../', import.meta.url));
export const registry = 'ghcr.io/anas8273/sers-preview-runtime';
export const APP_SERVICES = Object.freeze(['app', 'worker', 'migrate', 'seed-demo', 'storage-init']);
export function safeEnvironment(extra = {}) {
  const env = { ...process.env };
  for (const key of Object.keys(env)) if (/TOKEN|SECRET|PASSWORD|API_KEY|CREDENTIAL/i.test(key)) delete env[key];
  return { ...env, ...extra };
}

/** No shell interpolation, bounded output/deadline, and no inherited API tokens. */
export async function command(binary, args, { cwd = root, env, input = '', timeoutMs = 60_000, maxBuffer = 2 * 1024 ** 2 } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(binary, args, { cwd, env: safeEnvironment(env), stdio: ['pipe', 'pipe', 'pipe'] });
    let stdout = '', bytes = 0, failed = false;
    const timer = setTimeout(() => { failed = true; child.kill('SIGKILL'); }, timeoutMs);
    child.stdout.on('data', chunk => { bytes += chunk.length; if (bytes > maxBuffer) { failed = true; child.kill('SIGKILL'); } else stdout += chunk.toString(); });
    child.stderr.on('data', chunk => { bytes += chunk.length; if (bytes > maxBuffer) { failed = true; child.kill('SIGKILL'); } });
    child.stdin.on('error', () => { failed = true; child.kill('SIGKILL'); });
    child.once('error', () => { clearTimeout(timer); reject(new Error('Release command could not start')); });
    child.once('close', code => { clearTimeout(timer); code === 0 && !failed ? resolve(stdout.trim()) : reject(new Error(`Release command failed: ${binary}`)); });
    child.stdin.end(input);
  });
}

export async function sha256(file, maximum) {
  const hash = createHash('sha256'); let bytes = 0;
  for await (const block of createReadStream(file)) {
    bytes += block.length;
    if (bytes > maximum) throw new Error('Release file exceeds its bound');
    hash.update(block);
  }
  return { sha256: hash.digest('hex'), bytes };
}

export async function readCandidate(directory) {
  const info = await lstat(directory);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Candidate directory is invalid');
  const names = (await readdir(directory)).sort();
  if (JSON.stringify(names) !== JSON.stringify([CANDIDATE_FILE, IMAGE_FILE].sort())) throw new Error('Candidate contains unexpected files');
  const candidate = validateCandidate(await boundedJson(path.join(directory, CANDIDATE_FILE), MAX_MANIFEST_BYTES));
  if (candidate.repo !== REPOSITORY || candidate.repoID !== REPOSITORY_ID) throw new Error('Candidate is from an unexpected repository');
  const archive = path.join(directory, IMAGE_FILE), stat = await lstat(archive);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size !== candidate.archive.bytes || stat.size > MAX_ARCHIVE_BYTES) throw new Error('Candidate image size or file type is invalid');
  const actual = await sha256(archive, MAX_ARCHIVE_BYTES);
  if (actual.sha256 !== candidate.archive.sha256 || actual.bytes !== candidate.archive.bytes) throw new Error('Candidate image digest is invalid');
  return candidate;
}

export function validateImageInspection(image, candidate) {
  if (image?.Id !== candidate.appImageId || image.Os !== 'linux' || image.Architecture !== 'amd64' || image.Config?.User !== '10001:10001' || image.Config?.WorkingDir !== '/app' || image.Config?.Labels?.['org.opencontainers.image.revision'] !== candidate.testedMerge || image.Config?.Labels?.['org.opencontainers.image.source'] !== `https://github.com/${REPOSITORY}` || JSON.stringify(image.Config?.Entrypoint) !== JSON.stringify(['/usr/bin/tini', '--', 'node', 'scripts/operations/entrypoint.mjs']) || JSON.stringify(image.Config?.Cmd) !== JSON.stringify(['serve'])) throw new Error('Loaded image identity or runtime configuration differs');
  if (!Array.isArray(image.Config.Env) || !image.Config.Env.includes('NODE_ENV=production') || image.Config.Env.some(value => typeof value !== 'string' || /^(?:VITE_APP_ID|VITE_OAUTH_PORTAL_URL|OAUTH_PORTAL_URL|OAUTH_SERVER_URL|APP_PUBLIC_ORIGIN|DATABASE_URL|JWT_SECRET|BUILT_IN_FORGE_API_KEY|GITHUB_TOKEN)=./.test(value))) throw new Error('Loaded image embeds runtime identity or credentials');
  return image.Id;
}

export async function loadCandidateImage(directory, candidate, run = command) {
  const archive = path.join(directory, IMAGE_FILE);
  const inspected = JSON.parse(await run('/usr/bin/prlimit', ['--as=536870912', '--cpu=180', '--', 'python3', path.join(root, 'scripts/release/inspect-image-archive.py'), archive, candidate.appImageId], { timeoutMs: 4 * 60_000, maxBuffer: 64 * 1024 }));
  if (inspected.images !== 1 || inspected.configSha256 !== candidate.appImageId.slice(7)) throw new Error('Image archive identity differs');
  await run('docker', ['image', 'load', '--input', archive], { timeoutMs: 15 * 60_000, maxBuffer: 128 * 1024 });
  const images = JSON.parse(await run('docker', ['image', 'inspect', candidate.appImageId]));
  if (!Array.isArray(images) || images.length !== 1) throw new Error('Loaded image is ambiguous');
  validateImageInspection(images[0], candidate);
}

export function composeOverride(candidate, appReference) {
  validateCandidate(candidate);
  if (appReference !== candidate.appImageId && !new RegExp(`^${registry.replaceAll('.', '\\.')}@sha256:[a-f0-9]{64}$`).test(appReference)) throw new Error('Release application reference must be immutable');
  const lines = ['# This override must be used after the matching compose.staging.yml.', '# Requires Docker Compose 2.24.4 or newer. No service may rebuild the image.', 'services:'];
  for (const service of APP_SERVICES) lines.push(`  ${service}:`, `    image: ${appReference}`, '    platform: linux/amd64', '    build: !reset null');
  for (const service of ['mysql', 'clamav']) lines.push(`  ${service}:`, `    image: ${candidate.dependencies[service].ref}`, '    platform: linux/amd64');
  return lines.join('\n') + '\n';
}

export function validateComposeConfig(config, candidate, appReference) {
  if (!config || !config.services || Object.keys(config.services).length !== APP_SERVICES.length + 2) throw new Error('Unexpected release services');
  for (const [name, service] of Object.entries(config.services)) {
    if (service.build != null || service.platform !== 'linux/amd64') throw new Error('Release Compose contains a build or an untested platform');
    const expected = APP_SERVICES.includes(name) ? appReference : candidate.dependencies[name]?.ref;
    if (!expected || service.image !== expected) throw new Error('Release Compose image does not match the tested candidate');
  }
  return true;
}

export async function validateComposeFiles(directory, candidate, appReference, run = command) {
  const version = await run('docker', ['compose', 'version', '--short']);
  const match = /^v?(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/.exec(version);
  if (!match || Number(match[1]) < 2 || (Number(match[1]) === 2 && (Number(match[2]) < 24 || (Number(match[2]) === 24 && Number(match[3]) < 4)))) throw new Error('Docker Compose 2.24.4 or newer is required');
  const scratch = await mkdtemp(path.join(os.tmpdir(), 'sers-release-compose-'));
  try {
    // These values are used only to validate the Compose model, never saved in it.
    const env = { APP_PUBLIC_ORIGIN: 'https://sers-release-check.invalid', VITE_APP_ID: 'release-config-check', VITE_OAUTH_PORTAL_URL: 'https://identity-release-check.invalid', OAUTH_PORTAL_URL: 'https://identity-release-check.invalid', OAUTH_SERVER_URL: 'https://identity-release-check.invalid', SERS_DATABASE_NAME: 'sers_staging', SERS_BUILD_REVISION: candidate.testedMerge, SERS_SECRETS_DIR: scratch, COMPOSE_PROJECT_NAME: 'sers-release-verification', SERS_TRUSTED_PROXY_IPS: '' };
    for (const name of ['mysql_password', 'mysql_root_password', 'jwt_secret', 'healthcheck_token']) await writeFile(path.join(scratch, name), 'synthetic-configuration-only-not-a-runtime-secret\n', { mode: 0o600, flag: 'wx' });
    const raw = await run('docker', ['compose', '--project-name', 'sers-release-verification', '-f', path.join(directory, 'compose.staging.yml'), '-f', path.join(directory, 'compose.release.yml'), '--profile', '*', 'config', '--format', 'json'], { cwd: directory, env });
    validateComposeConfig(JSON.parse(raw), candidate, appReference);
  } finally { await rm(scratch, { recursive: true, force: true }); }
}

export async function createComposePackage(directory, candidate, appReference) {
  const destination = await newPrivateDirectory(directory);
  const base = await readFile(path.join(root, 'compose.staging.yml'));
  if (base.length > 128 * 1024) throw new Error('Compose source exceeds its bound');
  await writeFile(path.join(destination, 'compose.staging.yml'), base, { mode: 0o600, flag: 'wx' });
  await writeFile(path.join(destination, 'compose.release.yml'), composeOverride(candidate, appReference), { mode: 0o600, flag: 'wx' });
  return destination;
}

export async function verifyNonRootContract(candidate, run = command) {
  const program = "import {verifyReleaseContract} from './scripts/operations/release-contract.mjs';const c=await verifyReleaseContract(process.cwd());if(process.getuid()!==10001||Number(process.versions.node.split('.')[0])!==22)throw Error('Runtime identity');console.log(JSON.stringify({passed:true,uid:process.getuid(),nodeMajor:22,revision:c.revision,runtimeTreeSha256:c.runtimeTreeSha256}));";
  const raw = await run('docker', ['run', '--rm', '--network', 'none', '--read-only', '--cap-drop', 'ALL', '--security-opt', 'no-new-privileges:true', '--memory', '768m', '--cpus', '1', '--pids-limit', '128', '--user', '10001:10001', '--entrypoint', 'node', candidate.appImageId, '--input-type=module', '-e', program], { timeoutMs: 90_000, maxBuffer: 64 * 1024 });
  const proof = JSON.parse(raw);
  if (proof.passed !== true || proof.uid !== 10001 || proof.nodeMajor !== 22 || proof.revision !== candidate.testedMerge || !/^[a-f0-9]{64}$/.test(proof.runtimeTreeSha256 ?? '')) throw new Error('Loaded non-root runtime contract proof differs');
  return proof;
}

export async function writePackageChecksums(directory) {
  const names = (await readdir(directory)).sort();
  const entries = [];
  for (const name of names) {
    if (!/^[A-Za-z0-9_.-]+$/.test(name)) throw new Error('Unexpected release package filename');
    const info = await lstat(path.join(directory, name));
    if (!info.isFile() || info.isSymbolicLink()) throw new Error('Unexpected release package entry');
    entries.push(`${(await sha256(path.join(directory, name), 2 * 1024 ** 2)).sha256}  ${name}`);
  }
  await writeFile(path.join(directory, 'SHA256SUMS'), entries.join('\n') + '\n', { mode: 0o600, flag: 'wx' });
}
