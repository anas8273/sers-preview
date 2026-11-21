import { execFile, spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { lstat, mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { Transform } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import { promisify } from 'node:util';
import { createGzip } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { CANDIDATE_FILE, IMAGE_FILE, MAX_ARCHIVE_BYTES, MAX_IMAGE_TAR_BYTES, candidateArtifactName, validateCandidate } from './candidate.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const exec = promisify(execFile);
const sha = /^[a-f0-9]{40}$/;
const imageIdPattern = /^sha256:[a-f0-9]{64}$/;
const STAGES = new Set(['context', 'event-identity', 'source-checkout', 'source-clean', 'operation-proofs', 'destination', 'app-container', 'worker-container', 'app-image', 'mysql-image', 'clamav-image', 'image-archive', 'manifest-write']);
const FAILURE_REASONS = new Set([
  'verification-failed',
  'container-command', 'container-json', 'container-identity', 'container-ambiguous-count',
  'image-command', 'image-json', 'image-identity', 'image-platform', 'image-labels', 'image-digests',
  'immutable-reference-missing', 'immutable-reference-ambiguous',
]);
const COMMAND_SUBREASONS = new Set(['code', 'noimage', 'template', 'timeout', 'exit', 'buffer']);
export const PRODUCER_FAILURE_REASONS = Object.freeze([...FAILURE_REASONS]);
export const PRODUCER_COMMAND_SUBREASONS = Object.freeze([...COMMAND_SUBREASONS]);
export const producerFailureStage = error => STAGES.has(error?.producerStage) ? error.producerStage : 'context';
export const producerFailureReason = error => FAILURE_REASONS.has(error?.producerReason) ? error.producerReason : 'verification-failed';
export const producerFailureSubreason = error => COMMAND_SUBREASONS.has(error?.producerSubreason) ? error.producerSubreason : undefined;
export const producerFailureDiagnostic = error => {
  const diagnostic = `${producerFailureStage(error)}:${producerFailureReason(error)}`;
  const subreason = producerFailureSubreason(error);
  return subreason ? `${diagnostic}:${subreason}` : diagnostic;
};
function failure(reason, message = 'Candidate verification failed', subreason) {
  const error = new Error(message);
  if (FAILURE_REASONS.has(reason)) error.producerReason = reason;
  if (reason === 'image-command' && COMMAND_SUBREASONS.has(subreason)) error.producerSubreason = subreason;
  return error;
}
async function atStage(stage, operation) {
  if (!STAGES.has(stage)) throw new Error('Unknown producer verification stage');
  try { return await operation(); }
  catch (cause) {
    const error = new Error('Candidate verification refused');
    error.producerStage = STAGES.has(cause?.producerStage) ? cause.producerStage : stage;
    error.producerReason = FAILURE_REASONS.has(cause?.producerReason) ? cause.producerReason : 'verification-failed';
    if (COMMAND_SUBREASONS.has(cause?.producerSubreason)) error.producerSubreason = cause.producerSubreason;
    throw error;
  }
}
function commandSubreason(error) {
  if (error?.code === 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER') return 'buffer';
  if (error?.code === 'ETIMEDOUT' || error?.killed === true || error?.signal === 'SIGTERM') return 'timeout';
  const stderr = typeof error?.stderr === 'string' ? error.stderr : '';
  if (/no such (?:image|object)|manifest unknown|image\s+[^\n]*\s+not found/i.test(stderr)) return 'noimage';
  if (/template (?:parsing|execution) error|can't evaluate field|executing .* at <.*>:/i.test(stderr)) return 'template';
  if (error?.code === 'ENOENT' || error?.code === 'EACCES') return 'code';
  return 'exit';
}
export async function runProducerCommand(binary, args, options = {}, runner = exec) {
  const { failureReason = 'verification-failed', ...execOptions } = options;
  try { return (await runner(binary, args, { cwd: root, timeout: 30_000, maxBuffer: 2 * 1024 ** 2, ...execOptions })).stdout.trim(); }
  catch (cause) { throw failure(failureReason, 'Candidate verification command failed', failureReason === 'image-command' ? commandSubreason(cause) : undefined); }
}
const command = (binary, args, options = {}) => runProducerCommand(binary, args, options);
const compose = args => command('docker', ['compose', '-f', path.join(root, 'compose.staging.yml'), ...args], { failureReason: 'container-command' });
function number(value) { if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid GitHub numeric identity'); return Number(value); }
async function json(file, maximum = 128 * 1024) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) throw new Error('Invalid candidate input file');
  return JSON.parse(await readFile(file, 'utf8'));
}
export async function readProducerIdentity(env = process.env) {
  const { event, repoID, pr } = await atStage('event-identity', async () => {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'pull_request' || env.SERS_DATABASE_NAME !== 'sers_demo' || !sha.test(env.GITHUB_SHA || '') || env.SERS_BUILD_REVISION !== env.GITHUB_SHA || !imageIdPattern.test(env.SERS_TESTED_IMAGE_ID || '') || !path.isAbsolute(env.RUNNER_TEMP || '') || !path.isAbsolute(env.GITHUB_EVENT_PATH || '')) throw new Error('Candidate export requires an isolated pull-request operations run');
  const event = await json(env.GITHUB_EVENT_PATH, 2 * 1024 ** 2);
  const repoID = number(env.GITHUB_REPOSITORY_ID), pr = event.pull_request;
  if (!pr || pr.number !== event.number || !Number.isSafeInteger(pr.number) || pr.number < 1 || pr.base?.ref !== 'main' || !sha.test(pr.head?.sha || '') || !sha.test(pr.base?.sha || '') || [event.repository, pr.head?.repo, pr.base?.repo].some(repository => repository?.full_name !== env.GITHUB_REPOSITORY || repository?.id !== repoID)) throw new Error('Candidate must originate from the same repository pull request');
  return { event, repoID, pr };
  });
  const { head, sourceTree, testedTree } = await atStage('source-checkout', async () => {
  const head = await command('git', ['rev-parse', 'HEAD']);
  const parents = (await command('git', ['show', '-s', '--format=%P', head])).split(' ');
  const sourceTree = await command('git', ['rev-parse', `${pr.head.sha}^{tree}`]);
  const testedTree = await command('git', ['rev-parse', `${head}^{tree}`]);
  if (head !== env.GITHUB_SHA || parents.length !== 2 || parents[0] !== pr.base.sha || parents[1] !== pr.head.sha || sourceTree !== testedTree) throw new Error('Candidate checkout does not match the tested pull-request merge');
  return { head, sourceTree, testedTree };
  });
  await atStage('source-clean', async () => {
  await command('git', ['diff', '--exit-code']);
  await command('git', ['diff', '--cached', '--exit-code']);
  });
  return { format: 1, repo: env.GITHUB_REPOSITORY, repoID, prNumber: pr.number, sourceHead: pr.head.sha, sourceTree, testedMerge: head, testedTree, runId: number(env.GITHUB_RUN_ID), runAttempt: number(env.GITHUB_RUN_ATTEMPT), appImageId: env.SERS_TESTED_IMAGE_ID, platform: 'linux/amd64', runtimeIdentity: 'operator-configured', syntheticProof: true };
}

export async function assertOperationProofs(directory, identity) {
  const names = ['preflight', 'output-runtime', 'failure', 'rollback', 'restore'];
  const [preflight, runtime, failure, rollback, restore] = await Promise.all(names.map(name => json(path.join(directory, `${name}-result.json`))));
  if (![preflight, runtime, failure, rollback, restore].every(proof => proof?.passed === true)) throw new Error('Candidate lacks completed operational proofs');
  if (preflight.revision !== identity.testedMerge || preflight.imageContentsVerified !== true || preflight.configurationValidated !== true || preflight.privateStorageOwnershipVerified !== true || preflight.realOAuthLoginVerified !== false) throw new Error('Candidate preflight proof is incomplete');
  if (runtime.synthetic !== true || runtime.uid !== 10001 || runtime.nodeMajor !== 22 || runtime.actualChromiumPdf !== true || runtime.actualPopplerVisualWord !== true || runtime.pdfPages !== 1 || runtime.wordImageParts !== 1 || runtime.privateDataWritten !== false) throw new Error('Candidate output runtime proof is incomplete');
  if (failure.realEvidenceAndWordAfterRecovery !== true || !Array.isArray(failure.observations) || failure.observations.length !== 3 || ['database', 'scanner', 'worker'].some(dependency => !failure.observations.some(item => item.dependency === dependency && item.failedAsExpected === true && item.livenessPreserved === true && item.recovered === true))) throw new Error('Candidate recovery proof is incomplete');
  if (rollback.newSchemaDataPreserved !== true || rollback.allTableCountsAndChecksumsPreserved !== true || rollback.databaseRollbackAttempted !== false || rollback.currentReleaseRecovered !== true) throw new Error('Candidate rollback decision proof is incomplete');
  if (restore.dataIntegrityPassed !== true || restore.dataCountsMatch !== true || restore.rowChecksumsMatch !== true || restore.archiveIntegrityVerified !== true || restore.productionDatabaseModified !== false || !(restore.privateContentVerified?.uploads >= 1) || !(restore.privateContentVerified?.outputs >= 1) || restore.recoveryObservations?.actualLostCommits !== null || restore.recoveryObservations?.fullServiceRtoMeasured !== false || restore.recoveryObservations?.checks?.isolatedRestoreWithinTarget !== true || restore.recoveryObservations?.checks?.backupFreshnessWithinTarget !== true) throw new Error('Candidate isolated restore proof is incomplete');
}

export function parseContainerList(output) {
  if (typeof output !== 'string') throw failure('container-ambiguous-count');
  const containers = output.trim() ? output.trim().split(/\s+/) : [];
  if (containers.length !== 1) throw failure('container-ambiguous-count');
  if (!/^[a-f0-9]{12,64}$/.test(containers[0])) throw failure('container-identity');
  return containers[0];
}
export function parseContainerInspection(container, info) {
  if (typeof container !== 'string' || !/^[a-f0-9]{12,64}$/.test(container) || typeof info?.id !== 'string' || !/^[a-f0-9]{64}$/.test(info.id) || !info.id.startsWith(container) || typeof info.imageId !== 'string' || !imageIdPattern.test(info.imageId)) throw failure('container-identity', 'Invalid exercised service container identity');
  return info.imageId;
}
export function parseInspectionJson(output, reason) {
  if (!['container-json', 'image-json'].includes(reason)) throw new Error('Unknown inspection JSON reason');
  try { return JSON.parse(output); } catch { throw failure(reason); }
}
async function exercisedImage(service) {
  const container = parseContainerList(await compose(['ps', '--all', '--quiet', service]));
  const inspected = await command('docker', ['container', 'inspect', '--format', '{"id":{{json .Id}},"imageId":{{json .Image}}}', container], { failureReason: 'container-command' });
  const info = parseInspectionJson(inspected, 'container-json');
  return parseContainerInspection(container, info);
}
export function parseImageInspection(imageId, info) {
  if (typeof imageId !== 'string' || !imageIdPattern.test(imageId) || typeof info?.id !== 'string' || info.id !== imageId) throw failure('image-identity', 'Invalid exercised image identity');
  if (info.os !== 'linux' || info.architecture !== 'amd64') throw failure('image-platform', 'Candidate image platform is not the tested linux/amd64 platform');
  if (info.labels != null && (typeof info.labels !== 'object' || Array.isArray(info.labels))) throw failure('image-labels', 'Invalid image labels');
  if (info.digests != null && (!Array.isArray(info.digests) || info.digests.some(value => typeof value !== 'string'))) throw failure('image-digests', 'Invalid image digests');
  return { ...info, revision: info.labels?.['org.opencontainers.image.revision'], source: info.labels?.['org.opencontainers.image.source'], digests: info.digests ?? [] };
}
export function parseImageInspectionJson(output, imageId) {
  const inspected = parseInspectionJson(output, 'image-json');
  if (!Array.isArray(inspected) || inspected.length !== 1) throw failure('image-json');
  const raw = inspected[0];
  return parseImageInspection(imageId, {
    id: raw?.Id,
    os: raw?.Os,
    architecture: raw?.Architecture,
    labels: raw?.Config?.Labels ?? null,
    digests: raw?.RepoDigests ?? [],
  });
}
export async function inspectImage(imageId, run = command) {
  // Inspect the exact content-addressed image ID without platform re-selection.
  // Docker may resolve --platform to a distinct multi-platform variant ID.
  // parseImageInspectionJson still requires an exact ID match AND linux/amd64;
  // this never trusts a mutable tag or accepts a different platform.
  const inspected = await run('docker', ['image', 'inspect', imageId], { failureReason: 'image-command' });
  return parseImageInspectionJson(inspected, imageId);
}
export function immutableReference(repository, digests) {
  const prefix = `${repository}@sha256:`;
  const normalized = [...new Set((Array.isArray(digests) ? digests : []).map(ref => typeof ref === 'string' ? ref.replace(/^docker\.io\/(?:library\/)?/, '') : '').filter(ref => ref.startsWith(prefix) && ref.length === prefix.length + 64 && /^[a-f0-9]{64}$/.test(ref.slice(prefix.length))))];
  if (normalized.length === 0) throw failure('immutable-reference-missing', 'Exercised dependency has no immutable registry reference');
  if (normalized.length !== 1) throw failure('immutable-reference-ambiguous', 'Exercised dependency has ambiguous immutable registry references');
  return normalized[0];
}
export async function dependency(service, repository, run = command) {
  const imageId = await exercisedImage(service), info = await inspectImage(imageId, run);
  return { imageId, ref: immutableReference(repository, info.digests) };
}
async function saveImage(imageId, file) {
  const child = spawn('docker', ['image', 'save', imageId], { cwd: root, stdio: ['ignore', 'pipe', 'ignore'] });
  const completion = new Promise((resolve, reject) => { child.once('error', reject); child.once('close', code => code === 0 ? resolve() : reject(new Error('Image export failed'))); });
  const timer = setTimeout(() => child.kill('SIGKILL'), 10 * 60_000);
  const hash = createHash('sha256'); let rawBytes = 0, bytes = 0;
  const rawLimit = new Transform({ transform(chunk, _encoding, callback) { rawBytes += chunk.length; callback(rawBytes > MAX_IMAGE_TAR_BYTES ? new Error('Image tar exceeds release limit') : null, chunk); } });
  const archiveLimit = new Transform({ transform(chunk, _encoding, callback) { bytes += chunk.length; hash.update(chunk); callback(bytes > MAX_ARCHIVE_BYTES ? new Error('Image archive exceeds release limit') : null, chunk); } });
  try {
    await Promise.all([completion, pipeline(child.stdout, rawLimit, createGzip({ level: 6 }), archiveLimit, createWriteStream(file, { flags: 'wx', mode: 0o600 }))]);
    return { sha256: hash.digest('hex'), bytes };
  } catch { child.kill('SIGKILL'); await completion.catch(() => {}); throw new Error('Candidate image export failed'); }
  finally { clearTimeout(timer); }
}

export async function exportCandidate(directory, env = process.env) {
  const identity = await readProducerIdentity(env);
  await atStage('operation-proofs', () => assertOperationProofs(env.RUNNER_TEMP, identity));
  const destination = await atStage('destination', async () => {
  const destination = path.resolve(directory), parent = await lstat(path.dirname(destination));
  const relative = path.relative(path.resolve(env.RUNNER_TEMP), destination);
  if (!parent.isDirectory() || parent.isSymbolicLink() || !relative || relative.startsWith('..') || path.isAbsolute(relative) || path.dirname(destination) !== path.resolve(env.RUNNER_TEMP)) throw new Error('Candidate directory must be a fresh direct child of RUNNER_TEMP');
  return destination;
  });
  for (const service of ['app', 'worker']) await atStage(`${service}-container`, async () => {
    if (await exercisedImage(service) !== identity.appImageId) throw new Error('Candidate image differs from the exercised service');
  });
  await atStage('app-image', async () => {
  const app = await inspectImage(identity.appImageId);
  if (app.revision !== identity.testedMerge || app.source !== `https://github.com/${identity.repo}`) throw new Error('Candidate image source labels do not match checkout');
  });
  const dependencies = { mysql: await atStage('mysql-image', () => dependency('mysql', 'mysql')), clamav: await atStage('clamav-image', () => dependency('clamav', 'clamav/clamav')) };
  await atStage('destination', () => mkdir(destination, { mode: 0o700 }));
  try {
    const part = path.join(destination, `${IMAGE_FILE}.part`);
    const archive = await atStage('image-archive', () => saveImage(identity.appImageId, part));
    const candidate = await atStage('manifest-write', async () => {
    const candidate = validateCandidate({ ...identity, archive, dependencies });
    await rename(part, path.join(destination, IMAGE_FILE));
    await writeFile(path.join(destination, CANDIDATE_FILE), JSON.stringify(candidate, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    return candidate;
    });
    return candidate;
  } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Candidate export requires one destination directory');
  exportCandidate(process.argv[2]).then(candidate => console.log(JSON.stringify({ candidateArtifact: candidateArtifactName(candidate), imageId: candidate.appImageId, sourceHead: candidate.sourceHead, syntheticProof: true, bytes: candidate.archive.bytes }))).catch(error => { console.error(`Tested runtime candidate export refused: ${producerFailureDiagnostic(error)}`); process.exitCode = 1; });
}
