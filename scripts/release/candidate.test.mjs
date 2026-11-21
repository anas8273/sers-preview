import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_ARCHIVE_BYTES, assertRuntimeIdentity, candidateArtifactName, validateCandidate } from './candidate.mjs';
import { assertOperationProofs, immutableReference, inspectImage, parseContainerInspection, parseContainerList, parseImageInspection, parseImageInspectionJson, parseInspectionJson, producerFailureDiagnostic, producerFailureReason, producerFailureStage, producerFailureSubreason, PRODUCER_COMMAND_SUBREASONS, PRODUCER_FAILURE_REASONS, readProducerIdentity, runProducerCommand } from './export-candidate.mjs';

const h = character => character.repeat(40), d = character => character.repeat(64);
function fixture() {
  return { format: 1, repo: 'anas8273/sers-preview', repoID: 1182003064, prNumber: 37, sourceHead: h('a'), sourceTree: h('b'), testedMerge: h('c'), testedTree: h('b'), runId: 123456, runAttempt: 2, appImageId: `sha256:${d('d')}`, platform: 'linux/amd64', archive: { sha256: d('e'), bytes: 2048 }, dependencies: { mysql: { imageId: `sha256:${d('1')}`, ref: `mysql@sha256:${d('2')}` }, clamav: { imageId: `sha256:${d('3')}`, ref: `clamav/clamav@sha256:${d('4')}` } }, runtimeIdentity: 'operator-configured', syntheticProof: true };
}
test('candidate identity is normalized without granting publication authority', () => {
  const input = fixture(), output = validateCandidate(input);
  assert.deepEqual(output, input);
  assert.notEqual(output, input);
  assert.notEqual(output.dependencies, input.dependencies);
  assert.equal(candidateArtifactName(input), `sers-runtime-${h('a')}-123456-2`);
});
test('candidate refuses tree drift, mutable references, unsafe identities and unsupported platforms', () => {
  for (const change of [
    c => { c.sourceTree = h('f'); }, c => { c.testedMerge = c.sourceHead; },
    c => { c.repo = '../escape/repository'; }, c => { c.runId = 12.5; },
    c => { c.runAttempt = 0; }, c => { c.repoID = Number.MAX_SAFE_INTEGER + 1; },
    c => { c.sourceHead = 'main'; }, c => { c.appImageId = 'sers:latest'; },
    c => { c.dependencies.mysql.ref = 'mysql:8.4'; },
    c => { c.dependencies.mysql.ref = `attacker/mysql@sha256:${d('2')}`; },
    c => { c.dependencies.clamav.ref = `clamav/clamav@sha256:${d('4')}\n`; },
    c => { c.platform = 'linux/arm64'; }, c => { c.syntheticProof = false; },
    c => { c.runtimeIdentity = 'real-oauth-verified'; },
  ]) { const c = fixture(); change(c); assert.throws(() => validateCandidate(c)); }
});
test('candidate archive limits and exact field allowlists reject poisoned metadata', () => {
  for (const change of [
    c => { c.archive.bytes = MAX_ARCHIVE_BYTES + 1; }, c => { c.archive.bytes = 1; },
    c => { c.archive.bytes = Infinity; }, c => { c.archive.sha256 = '../image.tar.gz'; },
    c => { c.archive.file = '../../script.mjs'; }, c => { c.executable = 'run-this'; },
    c => { c.dependencies.other = { ref: 'another:latest' }; },
    c => { c.dependencies.mysql.command = 'echo unexpected'; }, c => { delete c.syntheticProof; },
  ]) { const c = fixture(); change(c); assert.throws(() => validateCandidate(c)); }
  const c = fixture(); c.archive.bytes = MAX_ARCHIVE_BYTES; assert.equal(validateCandidate(c).archive.bytes, MAX_ARCHIVE_BYTES);
});
test('producer refuses non-CI and arbitrary workflow events before external commands', async () => {
  for (const env of [{}, { GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch' }]) await assert.rejects(readProducerIdentity(env), error => producerFailureStage(error) === 'event-identity' && error.message === 'Candidate verification refused');
  assert.equal(producerFailureStage({ producerStage: 'raw-secret-value' }), 'context');
});
test('Docker dependency inspection accepts null labels while preserving immutable identity', () => {
  const imageId = `sha256:${d('a')}`;
  const info = { id: imageId, os: 'linux', architecture: 'amd64', labels: null, digests: [`mysql@sha256:${d('b')}`] };
  const parsed = parseImageInspection(imageId, info);
  assert.equal(parsed.revision, undefined);
  assert.deepEqual(parsed.digests, info.digests);
  assert.throws(() => parseImageInspection(`sha256:${d('c')}`, info));
  assert.throws(() => parseImageInspection(imageId, { ...info, architecture: 'arm64' }));
  assert.throws(() => parseImageInspection(imageId, { ...info, labels: 'invalid' }));
  const labels = { 'org.opencontainers.image.revision': h('c'), 'org.opencontainers.image.source': 'https://github.com/anas8273/sers-preview' };
  assert.equal(parseImageInspection(imageId, { ...info, labels }).revision, h('c'));
});
test('short Compose IDs are resolved to matching canonical IDs without permitting names or ambiguous input', () => {
  const id = d('a'), imageId = `sha256:${d('b')}`;
  assert.equal(parseContainerInspection(id, { id, imageId }), imageId);
  assert.equal(parseContainerInspection(id.slice(0, 12), { id, imageId }), imageId);
  for (const value of ['', 'app', `${id}\n${id}`, id.slice(0, 11), d('c')]) assert.throws(() => parseContainerInspection(value, { id, imageId }));
  assert.throws(() => parseContainerInspection(id.slice(0, 12), { id: id.slice(0, 12), imageId }));
});
test('producer diagnostics are stage-compatible and bounded to an allowlist', async () => {
  assert.deepEqual(PRODUCER_FAILURE_REASONS, [
    'verification-failed', 'container-command', 'container-json', 'container-identity', 'container-ambiguous-count',
    'image-command', 'image-json', 'image-identity', 'image-platform', 'image-labels', 'image-digests',
    'immutable-reference-missing', 'immutable-reference-ambiguous',
  ]);
  assert.equal(producerFailureDiagnostic({ producerStage: 'mysql-image', producerReason: 'image-json', message: 'secret SQL stderr' }), 'mysql-image:image-json');
  assert.equal(producerFailureDiagnostic({ producerStage: 'mysql-image', producerReason: 'stderr-secret' }), 'mysql-image:verification-failed');
  assert.deepEqual(PRODUCER_COMMAND_SUBREASONS, ['code', 'noimage', 'template', 'timeout', 'exit', 'buffer']);
  assert.equal(producerFailureDiagnostic({ producerStage: 'mysql-image', producerReason: 'image-command', producerSubreason: 'timeout', message: 'secret SQL stderr' }), 'mysql-image:image-command:timeout');
  assert.equal(producerFailureSubreason({ producerSubreason: 'SECRET' }), undefined);
  assert.equal(producerFailureStage({ producerStage: 'raw-secret-value' }), 'context');
  assert.equal(producerFailureReason({ producerReason: 'raw-secret-value' }), 'verification-failed');
  for (const [cause, subreason] of [
    [{ code: 'ENOENT', stderr: 'SECRET=not-public' }, 'code'],
    [{ code: 1, stderr: 'Error response from daemon: No such image: mysql' }, 'noimage'],
    [{ code: 1, stderr: 'template parsing error: secret SQL' }, 'template'],
    [{ code: 'ETIMEDOUT', stderr: 'DATABASE_URL=private' }, 'timeout'],
    [{ code: 1, stderr: 'exit status; token=private' }, 'exit'],
    [{ code: 'ERR_CHILD_PROCESS_STDIO_MAXBUFFER', stderr: 'secret output' }, 'buffer'],
  ]) {
    await assert.rejects(runProducerCommand('docker', [], { failureReason: 'image-command' }, async () => { throw cause; }), error => producerFailureSubreason(error) === subreason && !error.message.includes('SECRET') && !error.message.includes('SQL') && !error.message.includes('DATABASE_URL'));
  }
  await assert.rejects(
    runProducerCommand('docker', [], { failureReason: 'container-command' }, async () => { throw new Error('stderr SECRET SQL'); }),
    error => producerFailureReason(error) === 'container-command' && !error.message.includes('SECRET') && !error.message.includes('SQL'),
  );
});
test('inspection JSON and container count boundaries classify malformed and ambiguous output safely', () => {
  for (const reason of ['container-json', 'image-json']) {
    assert.throws(() => parseInspectionJson('{malformed', reason), error => producerFailureReason(error) === reason && error.message === 'Candidate verification failed');
  }
  const id = d('a');
  assert.equal(parseContainerList(`\n${id.slice(0, 12)}\n`), id.slice(0, 12));
  for (const output of ['', `${id}\n${d('b')}`, 'not-a-container']) {
    const expected = output === 'not-a-container' ? 'container-identity' : 'container-ambiguous-count';
    assert.throws(() => parseContainerList(output), error => producerFailureReason(error) === expected);
  }
});
test('image inspection binds the exact content ID and validates linux/amd64 without exposing metadata', async () => {
  const imageId = `sha256:${d('a')}`;
  const calls = [];
  const raw = [{ Id: imageId, Os: 'linux', Architecture: 'amd64', Config: { Labels: null, Env: ['DATABASE_URL=must-not-be-returned'] }, RepoDigests: [`mysql@sha256:${d('b')}`] }];
  const info = await inspectImage(imageId, async (binary, args, options) => { calls.push({ binary, args, options }); return JSON.stringify(raw); });
  assert.equal(info.id, imageId);
  assert.deepEqual(info.digests, raw[0].RepoDigests);
  assert.equal(info.labels, null);
  assert.deepEqual(calls[0].args, ['image', 'inspect', imageId]);
  assert.equal(calls[0].options.failureReason, 'image-command');
  assert.equal(info.env, undefined);
  assert.throws(() => parseImageInspectionJson(JSON.stringify([{ ...raw[0], Architecture: 'arm64' }]), imageId), error => producerFailureReason(error) === 'image-platform');
  assert.throws(() => parseImageInspectionJson(JSON.stringify([{ ...raw[0], Id: `sha256:${d('c')}` }]), imageId), error => producerFailureReason(error) === 'image-identity');
  assert.throws(() => parseImageInspectionJson('{}', imageId), error => producerFailureReason(error) === 'image-json');
});
test('image identity, platform and metadata diagnostics remain separate', () => {
  const imageId = `sha256:${d('a')}`;
  const info = { id: imageId, os: 'linux', architecture: 'amd64', labels: null, digests: [] };
  assert.equal(parseImageInspection(imageId, info).labels, null);
  for (const [change, reason] of [
    [value => ({ ...value, id: `sha256:${d('b')}` }), 'image-identity'],
    [value => ({ ...value, architecture: 'arm64' }), 'image-platform'],
    [value => ({ ...value, labels: [] }), 'image-labels'],
    [value => ({ ...value, digests: [42] }), 'image-digests'],
  ]) assert.throws(() => parseImageInspection(imageId, change(info)), error => producerFailureReason(error) === reason);
});
test('immutable dependency references normalize aliases and reject mutable, fake, unknown and distinct refs', () => {
  const digestA = d('a'), digestB = d('b');
  assert.equal(immutableReference('mysql', [`docker.io/library/mysql@sha256:${digestA}`]), `mysql@sha256:${digestA}`);
  assert.equal(immutableReference('mysql', [`mysql@sha256:${digestA}`, `docker.io/library/mysql@sha256:${digestA}`, `mysql@sha256:${digestA}`]), `mysql@sha256:${digestA}`);
  for (const [digests, reason] of [
    [['mysql:8.4'], 'immutable-reference-missing'],
    [['mysql@sha256:fake'], 'immutable-reference-missing'],
    [[`attacker/mysql@sha256:${digestA}`], 'immutable-reference-missing'],
    [[`mysql@sha256:${digestA}`, `mysql@sha256:${digestB}`], 'immutable-reference-ambiguous'],
  ]) assert.throws(() => immutableReference('mysql', digests), error => producerFailureReason(error) === reason);
});
test('browser build rejects synthetic OAuth identity and symlinked output', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sers-static-identity-'));
  try {
    await mkdir(path.join(directory, 'assets'));
    await writeFile(path.join(directory, 'index.html'), '<html><script src="/assets/app.js"></script></html>');
    await writeFile(path.join(directory, 'assets/app.js'), 'const login="/api/oauth/start";');
    assert.equal((await assertRuntimeIdentity(directory)).files, 2);
    for (const marker of ['synthetic-ci-only', 'oauth-ci.invalid']) {
      await writeFile(path.join(directory, 'assets/app.js'), JSON.stringify(marker));
      await assert.rejects(assertRuntimeIdentity(directory), /synthetic identity/);
    }
    await writeFile(path.join(directory, 'assets/app.js'), 'safe();');
    await symlink(path.join(directory, 'assets/app.js'), path.join(directory, 'assets/linked.js'));
    await assert.rejects(assertRuntimeIdentity(directory), /symlink/);
  } finally { await rm(directory, { recursive: true, force: true }); }
});

function proofs() {
  return {
    preflight: { passed: true, revision: h('c'), imageContentsVerified: true, configurationValidated: true, privateStorageOwnershipVerified: true, realOAuthLoginVerified: false },
    'output-runtime': { passed: true, synthetic: true, uid: 10001, nodeMajor: 22, actualChromiumPdf: true, actualPopplerVisualWord: true, pdfPages: 1, wordImageParts: 1, privateDataWritten: false },
    failure: { passed: true, realEvidenceAndWordAfterRecovery: true, observations: ['database', 'scanner', 'worker'].map(dependency => ({ dependency, failedAsExpected: true, livenessPreserved: true, recovered: true })) },
    rollback: { passed: true, newSchemaDataPreserved: true, allTableCountsAndChecksumsPreserved: true, databaseRollbackAttempted: false, currentReleaseRecovered: true },
    restore: { passed: true, dataIntegrityPassed: true, dataCountsMatch: true, rowChecksumsMatch: true, archiveIntegrityVerified: true, productionDatabaseModified: false, privateContentVerified: { uploads: 2, outputs: 1 }, recoveryObservations: { actualLostCommits: null, fullServiceRtoMeasured: false, checks: { isolatedRestoreWithinTarget: true, backupFreshnessWithinTarget: true } } },
  };
}
test('producer requires independent successful output, recovery, rollback and restore observations', async () => {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'sers-candidate-proof-'));
  const save = async value => { for (const [name, proof] of Object.entries(value)) await writeFile(path.join(directory, `${name}-result.json`), JSON.stringify(proof)); };
  try {
    await save(proofs());
    await assertOperationProofs(directory, fixture());
    for (const change of [
      p => { p.preflight.revision = h('f'); },
      p => { p['output-runtime'].uid = 0; },
      p => { p['output-runtime'].actualPopplerVisualWord = false; },
      p => { p.failure.observations = p.failure.observations.slice(0, 2); },
      p => { p.rollback.allTableCountsAndChecksumsPreserved = false; },
      p => { p.restore.rowChecksumsMatch = false; },
      p => { p.restore.privateContentVerified.outputs = 0; },
      p => { p.restore.recoveryObservations.fullServiceRtoMeasured = true; },
    ]) {
      const p = proofs(); change(p); await save(p);
      await assert.rejects(assertOperationProofs(directory, fixture()));
    }
    await save(proofs());
    await rm(path.join(directory, 'restore-result.json'));
    await assert.rejects(assertOperationProofs(directory, fixture()));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
