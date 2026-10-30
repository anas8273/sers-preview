import { lstat, readdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const CANDIDATE_FILE = 'candidate.json';
export const IMAGE_FILE = 'image.tar.gz';
export const MAX_ARCHIVE_BYTES = 3 * 1024 ** 3;
export const MAX_IMAGE_TAR_BYTES = 8 * 1024 ** 3;
export const MAX_MANIFEST_BYTES = 16 * 1024;
const sha = /^[a-f0-9]{40}$/;
const digest = /^[a-f0-9]{64}$/;
const imageId = /^sha256:[a-f0-9]{64}$/;

function object(value, keys, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || Object.getPrototypeOf(value) !== Object.prototype || Object.keys(value).length !== keys.length || keys.some(key => !Object.hasOwn(value, key))) throw new Error(`Invalid candidate ${label}`);
  return value;
}
function positive(value) { return Number.isSafeInteger(value) && value > 0; }

/** An archive is only a candidate. Independent GitHub/main evidence is required
 * before any registry publication; nothing in this file grants that authority. */
export function validateCandidate(input) {
  const c = object(input, ['format', 'repo', 'repoID', 'prNumber', 'sourceHead', 'sourceTree', 'testedMerge', 'testedTree', 'runId', 'runAttempt', 'appImageId', 'platform', 'archive', 'dependencies', 'runtimeIdentity', 'syntheticProof'], 'manifest');
  if (c.format !== 1 || typeof c.repo !== 'string' || !/^[A-Za-z0-9][A-Za-z0-9-]{0,38}\/[A-Za-z0-9][A-Za-z0-9_.-]{0,99}$/.test(c.repo) || ![c.repoID, c.prNumber, c.runId, c.runAttempt].every(positive)) throw new Error('Invalid candidate repository or run identity');
  if (![c.sourceHead, c.sourceTree, c.testedMerge, c.testedTree].every(value => typeof value === 'string' && sha.test(value)) || c.sourceTree !== c.testedTree || c.sourceHead === c.testedMerge) throw new Error('Invalid candidate source tree identity');
  if (typeof c.appImageId !== 'string' || !imageId.test(c.appImageId) || c.platform !== 'linux/amd64' || c.runtimeIdentity !== 'operator-configured' || c.syntheticProof !== true) throw new Error('Invalid candidate runtime identity');
  const archive = object(c.archive, ['sha256', 'bytes'], 'archive');
  if (typeof archive.sha256 !== 'string' || !digest.test(archive.sha256) || !Number.isSafeInteger(archive.bytes) || archive.bytes < 1024 || archive.bytes > MAX_ARCHIVE_BYTES) throw new Error('Invalid candidate archive bounds');
  object(c.dependencies, ['mysql', 'clamav'], 'dependencies');
  const dependencies = {};
  for (const [key, repository] of [['mysql', 'mysql'], ['clamav', 'clamav/clamav']]) {
    const dependency = object(c.dependencies[key], ['imageId', 'ref'], `${key} image`);
    if (typeof dependency.imageId !== 'string' || !imageId.test(dependency.imageId) || typeof dependency.ref !== 'string' || !dependency.ref.startsWith(`${repository}@sha256:`) || !digest.test(dependency.ref.slice(repository.length + 8))) throw new Error(`Invalid candidate ${key} digest`);
    dependencies[key] = { imageId: dependency.imageId, ref: dependency.ref };
  }
  return { format: 1, repo: c.repo, repoID: c.repoID, prNumber: c.prNumber, sourceHead: c.sourceHead, sourceTree: c.sourceTree, testedMerge: c.testedMerge, testedTree: c.testedTree, runId: c.runId, runAttempt: c.runAttempt, appImageId: c.appImageId, platform: c.platform, archive: { sha256: archive.sha256, bytes: archive.bytes }, dependencies, runtimeIdentity: 'operator-configured', syntheticProof: true };
}

export function candidateArtifactName(value) {
  const c = validateCandidate(value);
  return `sers-runtime-${c.sourceHead}-${c.runId}-${c.runAttempt}`;
}

/** OAuth is resolved by /api/oauth/start at runtime. Reject fixture credentials
 * in the browser bundle rather than promote an image with synthetic defaults. */
export async function assertRuntimeIdentity(directory) {
  let files = 0, bytes = 0;
  const root = path.resolve(directory);
  const index = await lstat(path.join(root, 'index.html'));
  if (!index.isFile() || index.isSymbolicLink()) throw new Error('Browser entrypoint missing');
  async function visit(relative) {
    const full = path.join(root, relative), info = await lstat(full);
    if (info.isSymbolicLink()) throw new Error('Browser artifact contains a symlink');
    if (info.isDirectory()) {
      for (const name of await readdir(full)) await visit(path.join(relative, name));
    } else {
      if (!info.isFile() || ++files > 10_000 || (bytes += info.size) > 128 * 1024 ** 2) throw new Error('Browser artifact exceeds verification bounds');
      if (/\.(?:html|js|mjs|css|json|svg|map)$/.test(relative)) {
        const data = await readFile(full);
        if (data.includes('synthetic-ci-only') || data.includes('oauth-ci.invalid')) throw new Error('Browser artifact embeds synthetic identity configuration');
      }
    }
  }
  await visit('');
  return { files, bytes };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 4 || process.argv[2] !== 'verify-static-identity') throw new Error('Unknown candidate verification action');
  assertRuntimeIdentity(process.argv[3]).then(() => console.log('Browser artifact uses runtime identity configuration.')).catch(() => { console.error('Browser identity verification failed'); process.exitCode = 1; });
}
