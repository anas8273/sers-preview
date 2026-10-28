/** Synthetic integration probe: real MySQL, filesystem, ClamAV and DOCX. */
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import JSZip from 'jszip';
import { seedDemoFixtures } from './seed-demo.mts';
import { getDb } from '../../server/db';
import { getUploadRuntime } from '../../server/upload-runtime';
import { beginUploadIntentForUser } from '../../server/upload-intent-db';
import { receiveUploadIntentForUser } from '../../server/upload-reception-service';
import { completeUploadIntentForUser, downloadReadyAssetForUser } from '../../server/upload-lifecycle-service';
import { generatePrivateDocxForWorkVersion } from '../../server/work-version-output-service';
import { readPrivateOutputForUser } from '../../server/output-artifact-storage';

try {
  const fixture = await seedDemoFixtures(), runtime = await getUploadRuntime();
  const bytes = Buffer.from('SERS synthetic evidence. No personal or school data.\n', 'utf8');
  const intent = await beginUploadIntentForUser(fixture.owner.id, {
    idempotencyKey: randomUUID(), fileName: 'synthetic-evidence.txt', mimeType: 'text/plain', expectedBytes: bytes.length,
    ownerType: 'organization', organizationId: fixture.schoolId, workId: fixture.workId,
  });
  async function* source() { yield bytes; }
  const received = await receiveUploadIntentForUser(fixture.owner.id, { id: intent.id, expectedRevision: intent.revision, source: source() }, runtime.storage);
  assert.equal(received?.state, 'quarantined');
  const completed = await completeUploadIntentForUser(fixture.owner.id, intent.id, runtime);
  assert.equal(completed?.state, 'ready', 'Real ClamAV scan must publish the synthetic evidence');
  assert.ok(completed.assetId);
  const download = await downloadReadyAssetForUser(fixture.owner.id, completed.assetId, runtime.storage);
  assert.ok(download); assert.deepEqual(Buffer.from(download.bytes), bytes);
  const output = await generatePrivateDocxForWorkVersion(fixture.owner.id, fixture.versionId);
  assert.ok(output); assert.equal(output.type, 'docx');
  const word = await readPrivateOutputForUser(fixture.reviewer.id, output.outputId);
  assert.ok(word, 'Authorized reviewer must read the private Word object');
  const zip = await JSZip.loadAsync(word.bytes);
  const xml = await zip.file('word/document.xml')?.async('string');
  assert.ok(xml?.includes('بيانات اصطناعية'));
  console.log(JSON.stringify({ synthetic: true, readyEvidenceVerified: 1, privateWordVerified: 1 }));
} finally {
  const db = await getDb();
  await (db as unknown as { $client: { promise(): { end(): Promise<void> } } })?.$client.promise().end();
}
