import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, rm, symlink, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { MAX_ARCHIVE_BYTES, assertRuntimeIdentity, candidateArtifactName, validateCandidate } from './candidate.mjs';
import { assertOperationProofs, readProducerIdentity } from './export-candidate.mjs';

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
  await assert.rejects(readProducerIdentity({}), /isolated pull-request/);
  await assert.rejects(readProducerIdentity({ GITHUB_ACTIONS: 'true', GITHUB_EVENT_NAME: 'workflow_dispatch' }), /isolated pull-request/);
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
