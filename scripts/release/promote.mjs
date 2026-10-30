import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { promotionContext, githubClient, selectEvidence, verifyCandidateEvidence, assertSameEvidence, boundedJson, writeJson, atStage, safeFailureStage } from './github-evidence.mjs';
import { root, registry, command, readCandidate, loadCandidateImage, createComposePackage, validateComposeFiles, writePackageChecksums } from './runtime-package.mjs';
import { immutableTag, registryManifest } from './registry.mjs';

export async function promote(directory, output, env = process.env) {
  const context = promotionContext(env), api = githubClient(env.GITHUB_TOKEN);
  const original = await boundedJson(path.join(directory, 'selection.json'));
  const evidence = await atStage('github-evidence', () => selectEvidence(api, context));
  await atStage('github-evidence', () => assertSameEvidence(original, evidence));
  const candidate = await atStage('candidate-digest', () => readCandidate(path.join(directory, 'payload')));
  await atStage('merge-ancestry', () => verifyCandidateEvidence(candidate, evidence, api));
  await atStage('image-load', () => loadCandidateImage(path.join(directory, 'payload'), candidate));
  // The publisher never runs the downloaded container or any artifact-supplied script.
  // Fresh-runner non-root execution is proved by the completed read-only Operations job.
  const tag = immutableTag(context.mainSha, candidate.appImageId);
  const tagged = `${registry}:${tag}`;
  const dockerConfig = await mkdtemp(path.join(os.tmpdir(), 'sers-release-registry-'));
  let published;
  try {
    await atStage('github-evidence', async () => assertSameEvidence(evidence, await selectEvidence(api, context)));
    const existing = await atStage('registry', () => registryManifest(tag, candidate.appImageId, env.GITHUB_ACTOR, env.GITHUB_TOKEN));
    if (existing) published = existing;
    else {
      await atStage('registry', async () => {
        await command('docker', ['login', 'ghcr.io', '--username', env.GITHUB_ACTOR, '--password-stdin'], { env: { DOCKER_CONFIG: dockerConfig }, input: env.GITHUB_TOKEN + '\n' });
        await command('docker', ['image', 'tag', candidate.appImageId, tagged], { env: { DOCKER_CONFIG: dockerConfig } });
        await command('docker', ['image', 'push', tagged], { env: { DOCKER_CONFIG: dockerConfig }, timeoutMs: 15 * 60_000, maxBuffer: 2 * 1024 ** 2 });
        published = await registryManifest(tag, candidate.appImageId, env.GITHUB_ACTOR, env.GITHUB_TOKEN);
        if (!published) throw new Error('Published image cannot be resolved by digest');
      });
    }
  } finally { await rm(dockerConfig, { recursive: true, force: true }); }
  // A main update can leave an unused immutable image, but never a misleading
  // deploy package or a moving tag that silently changes a previous release.
  await atStage('github-evidence', async () => assertSameEvidence(evidence, await selectEvidence(api, context)));
  const destination = await atStage('package', () => createComposePackage(output, candidate, published.reference));
  await atStage('package', () => validateComposeFiles(destination, candidate, published.reference));
  const provenance = { format: 1, repo: context.repo, mergedMain: context.mainSha, sourceHead: candidate.sourceHead, sourceTree: candidate.sourceTree, testedMerge: candidate.testedMerge, prNumber: candidate.prNumber, image: { reference: published.reference, tag: tagged, imageId: candidate.appImageId, platform: candidate.platform }, archive: candidate.archive, artifact: evidence.artifact, gates: evidence.gates, dependencies: candidate.dependencies, publishedAt: new Date().toISOString(), runtimeIdentity: 'operator-configured', syntheticProof: true, realOAuthVerified: false, externalDeploymentVerified: false };
  await writeJson(path.join(destination, 'provenance.json'), provenance);
  const guide = await readFile(path.join(root, 'docs/operations/TESTED_RUNTIME_RELEASE.md'), 'utf8');
  await writeFile(path.join(destination, 'RELEASE.md'), guide.replaceAll('(STAGING_RUNBOOK.md)', `(https://github.com/${context.repo}/blob/${context.mainSha}/docs/operations/STAGING_RUNBOOK.md)`), { mode: 0o600, flag: 'wx' });
  await writePackageChecksums(destination);
  if (env.GITHUB_STEP_SUMMARY) await writeFile(env.GITHUB_STEP_SUMMARY, `### Tested SERS runtime published\n\nImage: \`${published.reference}\`\n\nSource: \`${candidate.sourceHead}\`; merged main: \`${context.mainSha}\`. All four latest CI workflow attempts and the exact portable image were verified. No image rebuild or host deployment occurred. Configure real SERS OAuth and the host before use.\n`, { flag: 'a' });
  return { published: true, image: published.reference, sourceHead: candidate.sourceHead, mergedMain: context.mainSha, deploymentPerformed: false };
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv.length !== 4) throw new Error('Expected candidate and release output directories');
    console.log(JSON.stringify(await promote(process.argv[2], process.argv[3])));
  })().catch(error => { console.error(`Tested runtime promotion refused: ${safeFailureStage(error)}`); process.exitCode = 1; });
}
