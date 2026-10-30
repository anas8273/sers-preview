import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readCandidate, loadCandidateImage, createComposePackage, validateComposeFiles, verifyNonRootContract, writePackageChecksums } from './runtime-package.mjs';
import { writeJson, atStage, safeFailureStage } from './github-evidence.mjs';

export async function verifyCandidateRuntime(directory, output, env = process.env) {
  if (env.GITHUB_ACTIONS !== 'true' || env.GITHUB_EVENT_NAME !== 'pull_request' || env.GITHUB_REPOSITORY !== 'anas8273/sers-preview' || env.GITHUB_REPOSITORY_ID !== '1182003064') throw new Error('Portable runtime proof requires the read-only repository CI');
  const candidate = await atStage('candidate-digest', () => readCandidate(directory));
  if (candidate.runId !== Number(env.GITHUB_RUN_ID) || candidate.runAttempt !== Number(env.GITHUB_RUN_ATTEMPT) || candidate.testedMerge !== env.GITHUB_SHA) throw new Error('Portable candidate does not belong to this CI attempt');
  await atStage('image-load', () => loadCandidateImage(directory, candidate));
  const proof = await atStage('runtime-contract', () => verifyNonRootContract(candidate));
  const destination = await atStage('package', () => createComposePackage(output, candidate, candidate.appImageId));
  await atStage('package', () => validateComposeFiles(destination, candidate, candidate.appImageId));
  const result = { passed: true, scope: 'fresh-runner synthetic image portability', archiveDigestVerified: true, exactImageLoaded: true, nonRootRuntimeContract: proof, noBuildComposeVerified: true, externalDeploymentVerified: false };
  await writeJson(path.join(destination, 'portability.json'), result);
  await writePackageChecksums(destination);
  return result;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  (async () => {
    if (process.argv.length !== 4) throw new Error('Expected candidate and proof directories');
    console.log(JSON.stringify(await verifyCandidateRuntime(process.argv[2], process.argv[3])));
  })().catch(error => { console.error(`Portable tested runtime verification failed: ${safeFailureStage(error)}`); process.exitCode = 1; });
}
