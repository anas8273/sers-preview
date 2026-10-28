import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { createPrivateFilesystemStorage } from '../../server/private-filesystem-storage';
import { MAX_EVIDENCE_BYTES } from '../../server/upload-validation';

type Reference = { kind: 'upload'; key: string; assetKey: string; version: string; bytes: number; sha256: string }
  | { kind: 'output'; storageKey: string };
const digest = (value: string | Uint8Array) => createHash('sha256').update(value).digest('hex');

/** Exercise the real private provider against restored files, including its
 * ownership/mode, tombstone, version and content-integrity checks. */
export async function verifyRestoredEvidence(directory: string, references: Reference[]) {
  if (!Array.isArray(references) || references.length > 100_000) throw new Error('Restore reference count exceeds bound');
  const storage = await createPrivateFilesystemStorage({ rootDirectory: directory });
  let uploads = 0, outputs = 0, bytes = 0;
  for (const reference of references) {
    let key: string, hash: string, expectedBytes: number | undefined, version: string | undefined;
    if (reference.kind === 'upload') {
      if (typeof reference.key !== 'string' || reference.key !== reference.assetKey || typeof reference.version !== 'string'
        || !/^[a-f0-9]{64}$/.test(reference.sha256) || !Number.isSafeInteger(reference.bytes) || reference.bytes < 1 || reference.bytes > MAX_EVIDENCE_BYTES) throw new Error('Invalid restored upload reference');
      key = reference.key; hash = reference.sha256; expectedBytes = reference.bytes; version = reference.version; uploads++;
    } else if (reference.kind === 'output') {
      const match = /^outputs\/work-[1-9][0-9]*\/version-[1-9][0-9]*\/([a-f0-9]{64})\.(pdf|docx)$/.exec(reference.storageKey);
      if (!match) throw new Error('Invalid restored output reference');
      key = `artifacts/${digest(reference.storageKey)}`; hash = match[1]; outputs++;
    } else throw new Error('Unknown restored reference type');
    const head = await storage.headPrivate(key, version);
    if (head.status !== 'found' || !head.private || head.sha256 !== hash || (expectedBytes !== undefined && head.bytes !== expectedBytes) || head.bytes < 1 || head.bytes > MAX_EVIDENCE_BYTES || (version !== undefined && head.version !== version)) throw new Error('Restored private reference is unavailable or mismatched');
    bytes += head.bytes;
    if (bytes > 16 * 1024 ** 3) throw new Error('Restored evidence verification exceeds byte bound');
    const read = await storage.readPrivate(key, head.version, MAX_EVIDENCE_BYTES);
    if (read.status !== 'found' || read.bytes.byteLength !== head.bytes || digest(read.bytes) !== hash) throw new Error('Restored private content is unavailable or corrupt');
  }
  return { uploads, outputs, bytes };
}
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  let input = '';
  for await (const chunk of process.stdin) {
    input += chunk.toString();
    if (input.length > 64 * 1024 * 1024) throw new Error('Restore reference input exceeds bound');
  }
  const references = input.trim().split('\n').filter(Boolean).map(line => JSON.parse(line)) as Reference[];
  console.log(JSON.stringify(await verifyRestoredEvidence(process.argv[2], references)));
}
