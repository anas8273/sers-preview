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
async function command(binary, args, options = {}) {
  try { return (await exec(binary, args, { cwd: root, timeout: 30_000, maxBuffer: 2 * 1024 ** 2, ...options })).stdout.trim(); }
  catch { throw new Error(`Candidate verification command failed: ${binary}`); }
}
const compose = args => command('docker', ['compose', '-f', path.join(root, 'compose.staging.yml'), ...args]);
function number(value) { if (typeof value !== 'string' || !/^[1-9][0-9]*$/.test(value) || !Number.isSafeInteger(Number(value))) throw new Error('Invalid GitHub numeric identity'); return Number(value); }
async function json(file, maximum = 128 * 1024) {
  const stat = await lstat(file);
  if (!stat.isFile() || stat.isSymbolicLink() || stat.size > maximum) throw new Error('Invalid candidate input file');
  return JSON.parse(await readFile(file, 'utf8'));
}
export async function readProducerIdentity(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'pull_request' || env.SERS_DATABASE_NAME !== 'sers_demo' || !sha.test(env.GITHUB_SHA || '') || env.SERS_BUILD_REVISION !== env.GITHUB_SHA || !imageIdPattern.test(env.SERS_TESTED_IMAGE_ID || '') || !path.isAbsolute(env.RUNNER_TEMP || '') || !path.isAbsolute(env.GITHUB_EVENT_PATH || '')) throw new Error('Candidate export requires an isolated pull-request operations run');
  const event = await json(env.GITHUB_EVENT_PATH, 2 * 1024 ** 2);
  const repoID = number(env.GITHUB_REPOSITORY_ID), pr = event.pull_request;
  if (!pr || pr.number !== event.number || !Number.isSafeInteger(pr.number) || pr.number < 1 || pr.base?.ref !== 'main' || !sha.test(pr.head?.sha || '') || !sha.test(pr.base?.sha || '') || [event.repository, pr.head?.repo, pr.base?.repo].some(repository => repository?.full_name !== env.GITHUB_REPOSITORY || repository?.id !== repoID)) throw new Error('Candidate must originate from the same repository pull request');
  const head = await command('git', ['rev-parse', 'HEAD']);
  const parents = (await command('git', ['show', '-s', '--format=%P', head])).split(' ');
  const sourceTree = await command('git', ['rev-parse', `${pr.head.sha}^{tree}`]);
  const testedTree = await command('git', ['rev-parse', `${head}^{tree}`]);
  if (head !== env.GITHUB_SHA || parents.length !== 2 || parents[0] !== pr.base.sha || parents[1] !== pr.head.sha || sourceTree !== testedTree) throw new Error('Candidate checkout does not match the tested pull-request merge');
  await command('git', ['diff', '--exit-code']);
  await command('git', ['diff', '--cached', '--exit-code']);
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

async function exercisedImage(service) {
  const container = await compose(['ps', '--all', '--quiet', service]);
  if (!/^[a-f0-9]{64}$/.test(container)) throw new Error('Expected one exercised service container');
  const imageId = await command('docker', ['container', 'inspect', '--format', '{{.Image}}', container]);
  if (!imageIdPattern.test(imageId)) throw new Error('Invalid exercised service image');
  return imageId;
}
async function inspectImage(imageId) {
  const format = '{"id":{{json .Id}},"os":{{json .Os}},"architecture":{{json .Architecture}},"revision":{{json (index .Config.Labels "org.opencontainers.image.revision")}},"source":{{json (index .Config.Labels "org.opencontainers.image.source")}},"digests":{{json .RepoDigests}}}';
  const info = JSON.parse(await command('docker', ['image', 'inspect', '--format', format, imageId]));
  if (info.id !== imageId || info.os !== 'linux' || info.architecture !== 'amd64') throw new Error('Candidate image platform is not the tested linux/amd64 platform');
  return info;
}
async function dependency(service, repository) {
  const imageId = await exercisedImage(service), info = await inspectImage(imageId);
  const refs = [...new Set((info.digests ?? []).map(ref => ref.replace(/^docker\.io\/(?:library\/)?/, '')).filter(ref => ref.startsWith(`${repository}@sha256:`)))];
  if (refs.length !== 1) throw new Error('Exercised dependency has no unique immutable registry reference');
  return { imageId, ref: refs[0] };
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
  await assertOperationProofs(env.RUNNER_TEMP, identity);
  const destination = path.resolve(directory), parent = await lstat(path.dirname(destination));
  const relative = path.relative(path.resolve(env.RUNNER_TEMP), destination);
  if (!parent.isDirectory() || parent.isSymbolicLink() || !relative || relative.startsWith('..') || path.isAbsolute(relative) || path.dirname(destination) !== path.resolve(env.RUNNER_TEMP)) throw new Error('Candidate directory must be a fresh direct child of RUNNER_TEMP');
  if (await exercisedImage('app') !== identity.appImageId || await exercisedImage('worker') !== identity.appImageId) throw new Error('Candidate image differs from the exercised app or worker');
  const app = await inspectImage(identity.appImageId);
  if (app.revision !== identity.testedMerge || app.source !== `https://github.com/${identity.repo}`) throw new Error('Candidate image source labels do not match checkout');
  const dependencies = { mysql: await dependency('mysql', 'mysql'), clamav: await dependency('clamav', 'clamav/clamav') };
  await mkdir(destination, { mode: 0o700 });
  try {
    const part = path.join(destination, `${IMAGE_FILE}.part`);
    const archive = await saveImage(identity.appImageId, part);
    const candidate = validateCandidate({ ...identity, archive, dependencies });
    await rename(part, path.join(destination, IMAGE_FILE));
    await writeFile(path.join(destination, CANDIDATE_FILE), JSON.stringify(candidate, null, 2) + '\n', { mode: 0o600, flag: 'wx' });
    return candidate;
  } catch (error) { await rm(destination, { recursive: true, force: true }); throw error; }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  if (process.argv.length !== 3) throw new Error('Candidate export requires one destination directory');
  exportCandidate(process.argv[2]).then(candidate => console.log(JSON.stringify({ candidateArtifact: candidateArtifactName(candidate), imageId: candidate.appImageId, sourceHead: candidate.sourceHead, syntheticProof: true, bytes: candidate.archive.bytes }))).catch(() => { console.error('Tested runtime candidate export refused'); process.exitCode = 1; });
}
