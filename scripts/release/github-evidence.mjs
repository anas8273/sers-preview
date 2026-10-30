import { readFile, writeFile, mkdir, lstat } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { createWriteStream } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { Readable, Transform } from 'node:stream';
import path from 'node:path';

export const REPOSITORY = 'anas8273/sers-preview';
export const REPOSITORY_ID = 1182003064;
export const WORKFLOWS = Object.freeze([
  { id: 356759996, path: '.github/workflows/ci.yml' },
  { id: 357137371, path: '.github/workflows/integration.yml' },
  { id: 379201327, path: '.github/workflows/mysql-legacy.yml' },
  { id: 399003176, path: '.github/workflows/operations.yml' },
]);
export const MAX_ARTIFACT_BYTES = 3 * 1024 ** 3 + 1024 ** 2;
export const SHA = /^[a-f0-9]{40}$/;
export const SHA256 = /^[a-f0-9]{64}$/;
export const positiveInteger = value => Number.isSafeInteger(value) && value > 0;
const STAGES = new Set(['context', 'github-evidence', 'artifact-digest', 'extraction', 'candidate-digest', 'merge-ancestry', 'image-load', 'runtime-contract', 'registry', 'package']);
export async function atStage(stage, operation) {
  if (!STAGES.has(stage)) throw new Error('Unknown release stage');
  try { return await operation(); }
  catch { const error = new Error('Release verification failed'); error.releaseStage = stage; throw error; }
}
export const safeFailureStage = error => STAGES.has(error?.releaseStage) ? error.releaseStage : 'context';

export function promotionContext(env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_REPOSITORY !== REPOSITORY || Number(env.GITHUB_REPOSITORY_ID) !== REPOSITORY_ID || env.GITHUB_REF !== 'refs/heads/main' || !['push', 'workflow_dispatch'].includes(env.GITHUB_EVENT_NAME) || !SHA.test(env.GITHUB_SHA ?? '')) throw new Error('Promotion requires the trusted repository main workflow');
  return { repo: REPOSITORY, repoID: REPOSITORY_ID, mainSha: env.GITHUB_SHA };
}

export function githubClient(token, fetcher = fetch) {
  if (typeof token !== 'string' || !token || token.length > 4096 || /\s/.test(token)) throw new Error('GitHub credential is missing or invalid');
  return async route => {
    if (!route.startsWith(`/repos/${REPOSITORY}/`) || /[\r\n#]/.test(route)) throw new Error('Unexpected GitHub API route');
    const response = await fetcher(`https://api.github.com${route}`, { redirect: 'error', signal: AbortSignal.timeout(30_000), headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } });
    if (!response.ok) throw new Error(`GitHub evidence request failed (${response.status})`);
    const declared = response.headers.get('content-length');
    if (declared && (!/^\d+$/.test(declared) || Number(declared) > 8 * 1024 ** 2)) throw new Error('GitHub evidence exceeds its bound');
    const chunks = []; let bytes = 0;
    for await (const chunk of response.body ?? []) {
      bytes += chunk.length;
      if (bytes > 8 * 1024 ** 2) throw new Error('GitHub evidence exceeds its bound');
      chunks.push(Buffer.from(chunk));
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); }
    catch { throw new Error('GitHub evidence is not valid JSON'); }
  };
}

async function list(api, route, key) {
  const all = [];
  for (let page = 1; page <= 10; page++) {
    const value = await api(`${route}${route.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
    const entries = key ? value[key] : value;
    if (!Array.isArray(entries) || entries.length > 100 || (key && (!Number.isSafeInteger(value.total_count) || value.total_count > 1000))) throw new Error('GitHub evidence pagination is invalid');
    all.push(...entries);
    if (entries.length < 100 || (key && all.length >= value.total_count)) return all;
  }
  throw new Error('GitHub evidence pagination exceeds its bound');
}

function sameRepository(value) { return value?.id === REPOSITORY_ID && value?.full_name === REPOSITORY; }
export async function selectEvidence(api, context) {
  if (context.repo !== REPOSITORY || context.repoID !== REPOSITORY_ID || !SHA.test(context.mainSha ?? '')) throw new Error('Unexpected promotion context');
  const prefix = `/repos/${REPOSITORY}`;
  const ref = await api(`${prefix}/git/ref/heads/main`);
  if (ref.object?.sha !== context.mainSha) throw new Error('Main changed before promotion');
  const main = await api(`${prefix}/git/commits/${context.mainSha}`);
  if (main.sha !== context.mainSha || !SHA.test(main.tree?.sha ?? '')) throw new Error('Main tree cannot be verified');
  if (main.parents?.length !== 2 || !main.parents.every(parent => SHA.test(parent?.sha ?? ''))) throw new Error('Promotion requires the exact two-parent pull-request merge');
  const associated = await list(api, `${prefix}/commits/${context.mainSha}/pulls`);
  const candidates = associated.filter(pr => pr.merge_commit_sha === context.mainSha && pr.merged_at && pr.state === 'closed' && pr.base?.ref === 'main' && pr.head?.sha === main.parents[1].sha);
  if (candidates.length !== 1 || !positiveInteger(candidates[0].number)) throw new Error('Main must be the exact merge of one reviewed pull request');
  const pr = await api(`${prefix}/pulls/${candidates[0].number}`);
  if (!pr.merged || pr.draft || pr.state !== 'closed' || pr.merge_commit_sha !== context.mainSha || pr.base?.ref !== 'main' || !sameRepository(pr.base?.repo) || !sameRepository(pr.head?.repo) || !SHA.test(pr.head?.sha ?? '')) throw new Error('Merged pull request identity is invalid');
  // GitHub can clear run.pull_requests after merge. Bind the source to the
  // actual main merge ancestry instead of treating that ephemeral list as proof.
  if (main.parents?.length !== 2 || !SHA.test(main.parents[0]?.sha ?? '') || main.parents[1]?.sha !== pr.head.sha) throw new Error('Promotion requires the exact two-parent pull-request merge');
  const baseSha = main.parents[0].sha;
  const head = await api(`${prefix}/git/commits/${pr.head.sha}`);
  if (head.sha !== pr.head.sha || head.tree?.sha !== main.tree.sha) throw new Error('Merged content differs from the tested source tree');
  const gates = [];
  let producer;
  for (const workflow of WORKFLOWS) {
    const runs = await list(api, `${prefix}/actions/workflows/${workflow.id}/runs?event=pull_request&head_sha=${pr.head.sha}`, 'workflow_runs');
    if (!runs.length || runs.some(run => !positiveInteger(run.id))) throw new Error('A required workflow has no bounded evidence');
    const newest = runs.reduce((left, right) => left.id > right.id ? left : right);
    const run = await api(`${prefix}/actions/runs/${newest.id}`);
    const linked = run.pull_requests?.filter(item => item.number === pr.number && item.head?.sha === pr.head.sha && item.head?.repo?.id === REPOSITORY_ID && item.base?.repo?.id === REPOSITORY_ID && item.base?.ref === 'main' && item.base?.sha === baseSha);
    if (run.id !== newest.id || run.workflow_id !== workflow.id || run.path !== workflow.path || run.event !== 'pull_request' || run.head_sha !== pr.head.sha || !sameRepository(run.repository) || !sameRepository(run.head_repository) || !positiveInteger(run.run_attempt) || run.status !== 'completed' || run.conclusion !== 'success' || !Array.isArray(run.pull_requests) || (run.pull_requests.length > 0 && linked.length !== 1)) throw new Error('The latest required workflow attempt is not a successful same-repository proof');
    gates.push({ workflowId: workflow.id, path: workflow.path, runId: run.id, runAttempt: run.run_attempt });
    if (workflow.path === '.github/workflows/operations.yml') producer = { ...gates.at(-1), baseSha };
  }
  if (!producer) throw new Error('No operations producer was verified');
  const artifactName = `sers-runtime-${pr.head.sha}-${producer.runId}-${producer.runAttempt}`;
  const artifacts = await list(api, `${prefix}/actions/runs/${producer.runId}/artifacts`, 'artifacts');
  const matching = artifacts.filter(item => item.name === artifactName);
  if (matching.length !== 1) throw new Error('The successful producer has no unique runtime candidate');
  const artifact = matching[0];
  if (!positiveInteger(artifact.id) || artifact.expired !== false || !positiveInteger(artifact.size_in_bytes) || artifact.size_in_bytes > MAX_ARTIFACT_BYTES || !/^sha256:[a-f0-9]{64}$/.test(artifact.digest ?? '') || artifact.workflow_run?.id !== producer.runId || artifact.workflow_run?.repository_id !== REPOSITORY_ID || artifact.workflow_run?.head_repository_id !== REPOSITORY_ID || artifact.workflow_run?.head_sha !== pr.head.sha) throw new Error('Runtime artifact provenance is invalid');
  return { format: 1, repo: REPOSITORY, repoID: REPOSITORY_ID, mainSha: context.mainSha, sourceHead: pr.head.sha, sourceTree: main.tree.sha, prNumber: pr.number, producer, gates, artifact: { id: artifact.id, name: artifactName, sha256: artifact.digest.slice(7), bytes: artifact.size_in_bytes } };
}

export async function verifyCandidateEvidence(candidate, evidence, api) {
  if (candidate.repo !== evidence.repo || candidate.repoID !== evidence.repoID || candidate.prNumber !== evidence.prNumber || candidate.sourceHead !== evidence.sourceHead || candidate.sourceTree !== evidence.sourceTree || candidate.testedTree !== evidence.sourceTree || candidate.runId !== evidence.producer.runId || candidate.runAttempt !== evidence.producer.runAttempt) throw new Error('Candidate and GitHub evidence disagree');
  const merge = await api(`/repos/${REPOSITORY}/git/commits/${candidate.testedMerge}`);
  if (merge.sha !== candidate.testedMerge || merge.tree?.sha !== evidence.sourceTree || merge.parents?.length !== 2 || merge.parents[0]?.sha !== evidence.producer.baseSha || merge.parents[1]?.sha !== evidence.sourceHead) throw new Error('Tested merge ancestry or tree differs from the release');
}

export function assertSameEvidence(previous, current) {
  if (JSON.stringify(previous) !== JSON.stringify(current)) throw new Error('Promotion evidence changed; select the latest candidate again');
}

export async function newPrivateDirectory(directory) {
  const absolute = path.resolve(directory);
  await mkdir(absolute, { mode: 0o700 });
  const info = await lstat(absolute);
  if (!info.isDirectory() || info.isSymbolicLink()) throw new Error('Release output must be a new private directory');
  return absolute;
}

export async function boundedJson(file, maximum = 128 * 1024) {
  const info = await lstat(file);
  if (!info.isFile() || info.isSymbolicLink() || info.size < 1 || info.size > maximum) throw new Error('Release metadata file exceeds its bound');
  try { return JSON.parse(await readFile(file, 'utf8')); }
  catch { throw new Error('Release metadata is invalid JSON'); }
}

export async function writeJson(file, value) { await writeFile(file, JSON.stringify(value, null, 2) + '\n', { mode: 0o600, flag: 'wx' }); }

function permittedDownload(url) {
  return url.protocol === 'https:' && !url.username && !url.password && !url.port && (url.hostname === 'api.github.com' || url.hostname.endsWith('.blob.core.windows.net') || url.hostname.endsWith('.actions.githubusercontent.com') || url.hostname.endsWith('.githubusercontent.com'));
}

/** Authentication is sent only to the initial GitHub API request, never a signed redirect. */
export async function downloadArtifact(evidence, token, file, fetcher = fetch) {
  let url = new URL(`https://api.github.com/repos/${REPOSITORY}/actions/artifacts/${evidence.artifact.id}/zip`);
  const signal = AbortSignal.timeout(15 * 60_000);
  let response;
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (!permittedDownload(url)) throw new Error('Unexpected artifact download host');
    response = await fetcher(url, { signal, redirect: 'manual', headers: redirects === 0 ? { Accept: 'application/vnd.github+json', Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' } : {} });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location'); await response.body?.cancel();
      if (!location || redirects === 5) throw new Error('Artifact redirect bound exceeded');
      url = new URL(location, url); continue;
    }
    break;
  }
  if (!response?.ok || !response.body) throw new Error('Artifact download failed');
  const declared = response.headers.get('content-length');
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_ARTIFACT_BYTES)) throw new Error('Artifact download exceeds its bound');
  const digest = createHash('sha256'); let bytes = 0;
  const bounded = new Transform({ transform(chunk, encoding, callback) {
    bytes += chunk.length;
    if (bytes > MAX_ARTIFACT_BYTES) return callback(new Error('Artifact download exceeds its bound'));
    digest.update(chunk); callback(null, chunk);
  } });
  await pipeline(Readable.fromWeb(response.body), bounded, createWriteStream(file, { flags: 'wx', mode: 0o600 }));
  if (bytes !== evidence.artifact.bytes || digest.digest('hex') !== evidence.artifact.sha256) throw new Error('Artifact SHA256 or size does not match GitHub');
}
