import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { rm } from 'node:fs/promises';
import { promotionContext, githubClient, selectEvidence, verifyCandidateEvidence, downloadArtifact, newPrivateDirectory, writeJson, atStage, safeFailureStage } from './github-evidence.mjs';
import { command, readCandidate, root } from './runtime-package.mjs';

export async function selectCandidate(directory, env = process.env) {
  const context = promotionContext(env), api = githubClient(env.GITHUB_TOKEN);
  const evidence = await atStage('github-evidence', () => selectEvidence(api, context));
  const output = await newPrivateDirectory(directory);
  try {
    const archive = path.join(output, 'artifact.zip');
    await atStage('artifact-digest', () => downloadArtifact(evidence, env.GITHUB_TOKEN, archive));
    await atStage('extraction', () => command('/usr/bin/prlimit', ['--as=536870912', '--cpu=180', '--', 'python3', path.join(root, 'scripts/release/extract-candidate.py'), archive, path.join(output, 'payload')], { timeoutMs: 4 * 60_000, maxBuffer: 64 * 1024 }));
    const candidate = await atStage('candidate-digest', () => readCandidate(path.join(output, 'payload')));
    await atStage('merge-ancestry', () => verifyCandidateEvidence(candidate, evidence, api));
    await writeJson(path.join(output, 'selection.json'), evidence);
    await rm(archive);
    return { sourceHead: candidate.sourceHead, testedMerge: candidate.testedMerge, artifactId: evidence.artifact.id, imageId: candidate.appImageId };
  } catch (error) {
    await rm(output, { recursive: true, force: true });
    throw error;
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv.length !== 3) throw new Error('Expected one candidate destination');
    console.log(JSON.stringify({ candidateSelected: true, ...await selectCandidate(process.argv[2]) }));
  })().catch(error => { console.error(`Trusted runtime candidate selection refused: ${safeFailureStage(error)}`); process.exitCode = 1; });
}
