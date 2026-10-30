import assert from 'node:assert/strict';
import test from 'node:test';
import { createHash } from 'node:crypto';
import { mkdtemp, rm, writeFile, readFile, mkdir, open } from 'node:fs/promises';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { gzipSync } from 'node:zlib';
import os from 'node:os';
import path from 'node:path';
import { promotionContext, selectEvidence, verifyCandidateEvidence, assertSameEvidence, downloadArtifact, REPOSITORY, REPOSITORY_ID, WORKFLOWS } from './github-evidence.mjs';
import { validateImageInspection, composeOverride, validateComposeConfig, readCandidate, root, APP_SERVICES } from './runtime-package.mjs';
import { immutableTag, registryManifest } from './registry.mjs';

const exec = promisify(execFile);
const hash = value => createHash('sha256').update(value).digest('hex');
const source = 'a'.repeat(40), main = 'b'.repeat(40), tree = 'c'.repeat(40), testedMerge = 'd'.repeat(40), base = 'e'.repeat(40);
const imageId = 'sha256:' + 'f'.repeat(64);
const repo = { id: REPOSITORY_ID, full_name: REPOSITORY };
const context = { repo: REPOSITORY, repoID: REPOSITORY_ID, mainSha: main };
function candidate() { return { format: 1, repo: REPOSITORY, repoID: REPOSITORY_ID, prNumber: 37, sourceHead: source, sourceTree: tree, testedMerge, testedTree: tree, runId: 4004, runAttempt: 1, appImageId: imageId, platform: 'linux/amd64', archive: { sha256: '1'.repeat(64), bytes: 1024 }, dependencies: { mysql: { imageId: 'sha256:' + '2'.repeat(64), ref: 'mysql@sha256:' + '3'.repeat(64) }, clamav: { imageId: 'sha256:' + '4'.repeat(64), ref: 'clamav/clamav@sha256:' + '5'.repeat(64) } }, runtimeIdentity: 'operator-configured', syntheticProof: true }; }
function fixture() {
  const pr = { number: 37, merged: true, merged_at: '2026-10-31T00:00:00Z', draft: false, state: 'closed', merge_commit_sha: main, base: { ref: 'main', sha: base, repo }, head: { sha: source, repo } };
  const runs = WORKFLOWS.map((workflow, index) => ({ id: 4001 + index, workflow_id: workflow.id, path: workflow.path, event: 'pull_request', head_sha: source, repository: repo, head_repository: repo, run_attempt: 1, status: 'completed', conclusion: 'success', pull_requests: [{ number: 37, head: { sha: source, repo }, base: { sha: base, ref: 'main', repo } }] }));
  const artifact = { id: 1234, name: `sers-runtime-${source}-4004-1`, expired: false, size_in_bytes: 2048, digest: 'sha256:' + '6'.repeat(64), workflow_run: { id: 4004, repository_id: REPOSITORY_ID, head_repository_id: REPOSITORY_ID, head_sha: source } };
  const state = { pr, mainRef: main, mainTree: tree, mainParents: [{ sha: base }, { sha: source }], sourceTree: tree, mergeParents: [{ sha: base }, { sha: source }], runs, artifact, extraRuns: [], associatedAncestors: [] };
  const api = async route => {
    const url = new URL('https://api.github.com' + route), endpoint = url.pathname.replace(`/repos/${REPOSITORY}`, '');
    let result;
    if (endpoint === '/git/ref/heads/main') result = { object: { sha: state.mainRef } };
    else if (endpoint === `/git/commits/${main}`) result = { sha: main, tree: { sha: state.mainTree }, parents: state.mainParents };
    else if (endpoint === `/git/commits/${source}`) result = { sha: source, tree: { sha: state.sourceTree } };
    else if (endpoint === `/git/commits/${testedMerge}`) result = { sha: testedMerge, tree: { sha: state.mainTree }, parents: state.mergeParents };
    else if (endpoint === `/commits/${main}/pulls`) result = [state.pr, ...state.associatedAncestors];
    else if (endpoint === '/pulls/37') result = state.pr;
    else if (/^\/actions\/workflows\/\d+\/runs$/.test(endpoint)) { const id = Number(endpoint.split('/')[3]); const all = [...state.runs, ...state.extraRuns].filter(run => run.workflow_id === id); result = { total_count: all.length, workflow_runs: all }; }
    else if (/^\/actions\/runs\/\d+$/.test(endpoint)) result = [...state.runs, ...state.extraRuns].find(run => run.id === Number(endpoint.split('/')[3]));
    else if (endpoint === '/actions/runs/4004/artifacts') result = { total_count: 1, artifacts: [state.artifact] };
    else throw new Error('Unexpected fixture API route ' + endpoint);
    return structuredClone(result);
  };
  return { state, api };
}
async function temporary(operation) { const directory = await mkdtemp(path.join(os.tmpdir(), 'sers-release-test-')); try { return await operation(directory); } finally { await rm(directory, { recursive: true, force: true }); } }

test('publisher accepts only trusted main context, a merged same-repository source and the latest four successful attempts', async () => {
  const env = { GITHUB_ACTIONS: 'true', GITHUB_REPOSITORY: REPOSITORY, GITHUB_REPOSITORY_ID: String(REPOSITORY_ID), GITHUB_REF: 'refs/heads/main', GITHUB_EVENT_NAME: 'push', GITHUB_SHA: main };
  assert.deepEqual(promotionContext(env), context);
  for (const delta of [{ GITHUB_EVENT_NAME: 'pull_request_target' }, { GITHUB_REF: 'refs/pull/37/merge' }, { GITHUB_REPOSITORY: 'attacker/fork' }, { GITHUB_SHA: 'main' }]) assert.throws(() => promotionContext({ ...env, ...delta }));
  const { api } = fixture();
  const evidence = await selectEvidence(api, context);
  assert.equal(evidence.gates.length, 4);
  assert.equal(evidence.producer.runId, 4004);
  await verifyCandidateEvidence(candidate(), evidence, api);
});

test('post-merge runs with cleared pull-request arrays still bind exact main and tested-merge ancestry', async () => {
  const { state, api } = fixture();
  for (const run of state.runs) run.pull_requests = [];
  const evidence = await selectEvidence(api, context);
  await verifyCandidateEvidence(candidate(), evidence, api);
  state.mergeParents[0].sha = '0'.repeat(40);
  await assert.rejects(verifyCandidateEvidence(candidate(), evidence, api), /ancestry/);
  state.mainParents = [{ sha: base }];
  await assert.rejects(selectEvidence(api, context), /two-parent/);
});

test('automatically closed ancestor PRs cannot replace the exact second-parent merge source', async () => {
  const { state, api } = fixture();
  state.associatedAncestors.push({ ...structuredClone(state.pr), number: 36, head: { sha: '0'.repeat(40), repo } });
  assert.equal((await selectEvidence(api, context)).prNumber, 37);
  state.associatedAncestors[0].head.sha = source;
  await assert.rejects(selectEvidence(api, context), /exact merge of one/);
});

test('promotion refuses changed main, untested merge content, forks and a mismatched available PR link', async () => {
  for (const mutate of [state => { state.mainRef = '0'.repeat(40); }, state => { state.sourceTree = '0'.repeat(40); }, state => { state.pr.head.repo = { ...repo, id: 42 }; }, state => { state.runs[0].pull_requests[0].base.sha = '0'.repeat(40); }]) {
    const { state, api } = fixture(); mutate(state); await assert.rejects(selectEvidence(api, context));
  }
});

test('older green runs and stale artifacts cannot bypass a failed, pending or newer attempt', async () => {
  for (const conclusion of ['failure', 'cancelled', null]) {
    const { state, api } = fixture();
    state.extraRuns.push({ ...state.runs[0], id: 9001, conclusion, status: conclusion ? 'completed' : 'in_progress' });
    await assert.rejects(selectEvidence(api, context), /latest required/);
  }
  const { state, api } = fixture();
  state.runs[3].run_attempt = 2;
  await assert.rejects(selectEvidence(api, context), /unique runtime candidate/);
});

test('artifact identity requires a digest, exact repository/head, unexpired data and the selected run', async () => {
  for (const mutate of [artifact => { delete artifact.digest; }, artifact => { artifact.expired = true; }, artifact => { artifact.workflow_run.head_repository_id = 7; }, artifact => { artifact.workflow_run.head_sha = main; }, artifact => { artifact.workflow_run.id = 3999; }]) {
    const { state, api } = fixture(); mutate(state.artifact); await assert.rejects(selectEvidence(api, context), /provenance/);
  }
  const { api } = fixture(); const evidence = await selectEvidence(api, context);
  assert.throws(() => assertSameEvidence(evidence, { ...evidence, mainSha: source }), /changed/);
});

test('artifact transfer strips GitHub authentication on redirects and rejects a digest mismatch or foreign host', async () => temporary(async directory => {
  const content = Buffer.from('synthetic archive');
  const evidence = { artifact: { id: 1234, bytes: content.length, sha256: hash(content) } };
  const calls = [];
  const fetcher = async (url, options) => { calls.push({ url: String(url), headers: options.headers }); return calls.length === 1 ? new Response(null, { status: 302, headers: { location: 'https://example.blob.core.windows.net/signed-fixture' } }) : new Response(content); };
  await downloadArtifact(evidence, 'synthetic-token', path.join(directory, 'good.zip'), fetcher);
  assert.equal(calls[0].headers.Authorization, 'Bearer synthetic-token');
  assert.deepEqual(calls[1].headers, {});
  await assert.rejects(downloadArtifact({ artifact: { ...evidence.artifact, sha256: '0'.repeat(64) } }, 'synthetic-token', path.join(directory, 'bad.zip'), async () => new Response(content)), /SHA256/);
  await assert.rejects(downloadArtifact(evidence, 'synthetic-token', path.join(directory, 'foreign.zip'), async () => new Response(null, { status: 302, headers: { location: 'https://attacker.invalid/archive' } })), /host/);
}));

test('candidate reader verifies exact file set, regular files, bytes and compressed archive digest', async () => temporary(async directory => {
  const content = Buffer.alloc(1024, 7), c = candidate(); c.archive.sha256 = hash(content);
  await writeFile(path.join(directory, 'image.tar.gz'), content);
  await writeFile(path.join(directory, 'candidate.json'), JSON.stringify(c));
  assert.equal((await readCandidate(directory)).appImageId, imageId);
  await writeFile(path.join(directory, 'image.tar.gz'), Buffer.alloc(1024, 8));
  await assert.rejects(readCandidate(directory), /digest/);
  await writeFile(path.join(directory, 'extra.sh'), 'false');
  await assert.rejects(readCandidate(directory), /unexpected files/);
}));

test('ZIP extraction accepts only the two regular candidate files and rejects traversal, duplicates and symlinks', async () => temporary(async directory => {
  const make = `import sys,zipfile,stat\np=sys.argv[1];kind=sys.argv[2]\nwith zipfile.ZipFile(p,'w') as z:\n z.writestr('candidate.json','{}')\n if kind=='symlink':\n  i=zipfile.ZipInfo('image.tar.gz');i.external_attr=(stat.S_IFLNK|0o777)<<16;z.writestr(i,'outside')\n else:z.writestr('../image.tar.gz' if kind=='traversal' else 'image.tar.gz','synthetic')\n if kind=='duplicate':z.writestr('candidate.json','{}')\n`;
  for (const kind of ['valid', 'traversal', 'duplicate', 'symlink']) {
    const archive = path.join(directory, kind + '.zip'), destination = path.join(directory, kind);
    await exec('python3', ['-c', make, archive, kind]);
    const operation = exec('python3', [path.join(root, 'scripts/release/extract-candidate.py'), archive, destination]);
    if (kind === 'valid') { await operation; assert.equal(await readFile(path.join(destination, 'image.tar.gz'), 'utf8'), 'synthetic'); }
    else await assert.rejects(operation);
  }
}));

test('Docker outer tar requires exactly one matching config and refuses sparse logical expansion', async () => temporary(async directory => {
  const config = Buffer.from('{}'), digest = hash(config), expected = 'sha256:' + digest;
  await writeFile(path.join(directory, digest + '.json'), config);
  await writeFile(path.join(directory, 'manifest.json'), JSON.stringify([{ Config: digest + '.json', RepoTags: null, Layers: ['layer.tar'] }]));
  await writeFile(path.join(directory, 'layer.tar'), 'synthetic layer');
  const tar = path.join(directory, 'image.tar');
  await exec('tar', ['-C', directory, '-cf', tar, 'manifest.json', digest + '.json', 'layer.tar']);
  const archive = path.join(directory, 'image.tar.gz');
  await writeFile(archive, gzipSync(await readFile(tar)));
  const accepted = await exec('python3', [path.join(root, 'scripts/release/inspect-image-archive.py'), archive, expected]);
  assert.equal(JSON.parse(accepted.stdout).images, 1);
  await assert.rejects(exec('python3', [path.join(root, 'scripts/release/inspect-image-archive.py'), archive, imageId]));
  const layer = await open(path.join(directory, 'layer.tar'), 'w');
  try { await layer.truncate(9 * 1024 ** 3); } finally { await layer.close(); }
  await exec('tar', ['--sparse', '--format=gnu', '-C', directory, '-cf', tar, 'manifest.json', digest + '.json', 'layer.tar']);
  assert.ok((await readFile(tar)).length < 64 * 1024);
  await writeFile(archive, gzipSync(await readFile(tar)));
  await assert.rejects(exec('python3', [path.join(root, 'scripts/release/inspect-image-archive.py'), archive, expected]));
}));

test('loaded image verification rejects root, foreign source/revision and baked runtime credentials', () => {
  const image = { Id: imageId, Os: 'linux', Architecture: 'amd64', Config: { User: '10001:10001', WorkingDir: '/app', Labels: { 'org.opencontainers.image.source': 'https://github.com/' + REPOSITORY, 'org.opencontainers.image.revision': testedMerge }, Entrypoint: ['/usr/bin/tini', '--', 'node', 'scripts/operations/entrypoint.mjs'], Cmd: ['serve'], Env: ['NODE_ENV=production'] } };
  assert.equal(validateImageInspection(image, candidate()), imageId);
  for (const mutate of [value => { value.Config.User = '0:0'; }, value => { value.Config.Labels['org.opencontainers.image.revision'] = main; }, value => { value.Config.Env.push('JWT_SECRET=synthetic-not-permitted'); }, value => { value.Config.Entrypoint = ['sh']; }]) {
    const changed = structuredClone(image); mutate(changed); assert.throws(() => validateImageInspection(changed, candidate()));
  }
});

test('release Compose pins every service and refuses builds, wrong digests or unexpected services', () => {
  const c = candidate(), override = composeOverride(c, imageId), config = { services: {} };
  assert.equal((override.match(/build: !reset null/g) ?? []).length, 5);
  for (const service of APP_SERVICES) config.services[service] = { image: imageId, platform: 'linux/amd64' };
  for (const service of ['mysql', 'clamav']) config.services[service] = { image: c.dependencies[service].ref, platform: 'linux/amd64' };
  assert.equal(validateComposeConfig(config, c, imageId), true);
  for (const mutate of [value => { value.services.app.build = { context: '.' }; }, value => { value.services.mysql.image = 'mysql:latest'; }, value => { value.services.injected = { image: imageId, platform: 'linux/amd64' }; }]) {
    const changed = structuredClone(config); mutate(changed); assert.throws(() => validateComposeConfig(changed, c, imageId));
  }
});

test('registry verifies immutable image config and manifest digest; 401 never becomes not-found', async () => {
  const tag = immutableTag(main, imageId);
  assert.equal(tag.length, 115);
  assert.notEqual(tag, immutableTag(main, 'sha256:' + '0'.repeat(64)));
  const body = JSON.stringify({ schemaVersion: 2, mediaType: 'application/vnd.docker.distribution.manifest.v2+json', config: { digest: imageId }, layers: [{ digest: 'sha256:' + '7'.repeat(64) }] });
  let calls = 0;
  const fetcher = async () => ++calls % 2 === 1 ? new Response(JSON.stringify({ token: 'synthetic-registry-token' })) : new Response(body, { headers: { 'docker-content-digest': 'sha256:' + hash(body) } });
  assert.equal((await registryManifest(tag, imageId, 'synthetic-user', 'synthetic-token', fetcher)).digest, 'sha256:' + hash(body));
  await assert.rejects(registryManifest(tag, 'sha256:' + '0'.repeat(64), 'synthetic-user', 'synthetic-token', fetcher), /different/);
  await assert.rejects(registryManifest(tag, imageId, 'synthetic-user', 'synthetic-token', async () => new Response(null, { status: 401 })), /authentication/);
  let attempt = 0;
  assert.equal(await registryManifest(tag, imageId, 'synthetic-user', 'synthetic-token', async () => ++attempt === 1 ? new Response(JSON.stringify({ token: 'synthetic-registry-token' })) : new Response(null, { status: 404 })), null);
});
