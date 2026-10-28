import { createHash } from "node:crypto";
import {
  claimUploadReceptionForUser, claimUploadReconciliationForUser, finishUploadReception,
  listUploadReconciliationCandidates, prepareUploadReception, UploadIntentAccessError,
} from "./upload-intent-db";
import { receivePrivateUpload, withUploadAbort, type PrivateUploadResult, type PrivateUploadStorage } from "./private-upload-storage";

/** Internal service only. No production provider, HTTP route, scan or publication
 * is selected here. A client never supplies a storage key, hash or lease token. */
export async function receiveUploadIntentForUser(userId: number, input: {
  id: string; expectedRevision: number; source: AsyncIterable<Uint8Array>; signal?: AbortSignal;
}, adapter: PrivateUploadStorage) {
  const lease = await claimUploadReceptionForUser(userId, input.id, input.expectedRevision);
  if (!lease) throw new UploadIntentAccessError();
  const timeout = AbortSignal.timeout(30_000);
  const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
  const result = await receivePrivateUpload(adapter, {
    key: lease.key, source: input.source, expectedBytes: lease.expectedBytes, signal,
    beforeStore: ({ bytes, sha256 }) => prepareUploadReception(lease, bytes, sha256),
  });
  // If this commit fails, the durable receiving row and digest survive. Never
  // compensate by deleting the object or rolling back its capacity charge.
  return finishUploadReception(lease, result);
}

export async function reconcileUploadIntentForUser(userId: number, id: string, adapter: PrivateUploadStorage) {
  const lease = await claimUploadReconciliationForUser(userId, id);
  if (!lease) return undefined;
  let result: PrivateUploadResult = { status: "unknown", reason: "storage_unconfirmed" };
  if (!lease.sha256) {
    // No writer can pass preparation with the old token after this takeover.
    result = { status: "rejected", reason: "unprepared_source" };
  } else if (adapter.capabilities.privateObjects && adapter.capabilities.conditionalCreate && adapter.capabilities.versionedDelete) {
    try {
      const signal = AbortSignal.timeout(30_000);
      const head = await withUploadAbort(adapter.headPrivate(lease.key), signal);
      if (head.status === "found" && head.private === true && typeof head.version === "string" && head.version.length > 0 && head.version.length <= 1024 && head.bytes === lease.expectedBytes && head.sha256 === lease.sha256) {
        // Verify the immutable bytes too: metadata alone cannot repair a partial
        // or inconsistent write. Recovery never overwrites or deletes anything.
        const read = await withUploadAbort(adapter.readPrivate(lease.key, head.version, lease.expectedBytes), signal);
        if (read.status === "found" && read.bytes instanceof Uint8Array && read.bytes.byteLength === lease.expectedBytes && createHash("sha256").update(read.bytes).digest("hex") === lease.sha256) {
          result = { status: "confirmed", receipt: { key: lease.key, version: head.version, bytes: head.bytes, sha256: head.sha256 } };
        }
      }
      // Missing is also inconclusive: a timed-out writer might still complete.
    } catch { /* Retain the charge and schedule bounded reconciliation. */ }
  }
  return finishUploadReception(lease, result);
}

/** Caller schedules explicitly; there is no background worker enabled by import. */
export async function reconcileUploadReceptionsForScope(scopeKey: string, adapter: PrivateUploadStorage, limit = 100) {
  const candidates = await listUploadReconciliationCandidates(scopeKey, limit);
  let processed = 0;
  for (const candidate of candidates) {
    if (await reconcileUploadIntentForUser(candidate.userId, candidate.id, adapter)) processed++;
  }
  return { inspected: candidates.length, processed };
}
