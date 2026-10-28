import { createHash } from "node:crypto";
import {
  claimUploadCleanup, claimUploadValidationForUser, finishUploadCleanup, finishUploadValidation,
  getReadyUploadAssetForUser, getUploadIntentForUser, listUploadLifecycleCandidates,
  prepareUploadCleanupDeletion, type UploadValidationResult,
} from "./upload-intent-db";
import { withUploadAbort, type PrivateUploadStorage } from "./private-upload-storage";
import type { UploadScanner } from "./upload-scanner";

export type UploadLifecycleDependencies = { storage: PrivateUploadStorage; scanner: UploadScanner };
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const supportsPrivateStorage = (storage: PrivateUploadStorage) => storage.capabilities.privateObjects === true
  && storage.capabilities.conditionalCreate === true && storage.capabilities.versionedDelete === true;

/** Completes a server-owned intent with the configured scanner only. The client
 * never submits a clean verdict, digest, policy, storage key or object version. */
export async function completeUploadIntentForUser(userId: number, id: string, dependencies: UploadLifecycleDependencies) {
  const existing = await getUploadIntentForUser(userId, id);
  if (!existing || existing.state === "ready") return existing;
  if (!supportsPrivateStorage(dependencies.storage)) return existing;
  const lease = await claimUploadValidationForUser(userId, id, dependencies.scanner.policyVersion);
  if (!lease) return getUploadIntentForUser(userId, id);
  let result: UploadValidationResult = { status: "unknown", policyVersion: lease.policyVersion, reason: "scan_unavailable" };
  try {
    const signal = AbortSignal.timeout(60_000);
    const head = await withUploadAbort(dependencies.storage.headPrivate(lease.key, lease.version), signal);
    if (head.status === "found" && head.private === true && head.version === lease.version && head.bytes === lease.bytes && head.sha256 === lease.sha256) {
      const read = await withUploadAbort(dependencies.storage.readPrivate(lease.key, lease.version, lease.bytes), signal);
      if (read.status === "found" && read.bytes instanceof Uint8Array) {
        if (read.bytes.byteLength !== lease.bytes || hash(read.bytes) !== lease.sha256) {
          result = { status: "rejected", policyVersion: lease.policyVersion, reason: "integrity_mismatch" };
        } else {
          const scan = await withUploadAbort(dependencies.scanner.scan({ bytes: read.bytes, fileName: lease.fileName, declaredMimeType: lease.declaredMimeType, signal }), signal);
          if (scan.policyVersion === lease.policyVersion) {
            if (scan.status === "clean") {
              // Trust neither provider metadata nor a mismatched scanner receipt.
              if (scan.sha256 === lease.sha256 && scan.bytes === lease.bytes && scan.engineVersion) result = scan;
            } else result = scan;
          }
        }
      }
    }
  } catch { /* Leave quarantine, capacity and durable retry state intact. */ }
  // A failed/ambiguous DB commit must not cause compensating storage deletion.
  // Retry reads ready and returns the same Asset ID if publication committed.
  return finishUploadValidation(lease, result);
}

/** Protected bytes, not a bearer URL. Recheck authorization after provider I/O so
 * revocation while the object is read does not deliver it to the revoked actor. */
export async function downloadReadyAssetForUser(userId: number, assetId: number, storage: PrivateUploadStorage) {
  if (!supportsPrivateStorage(storage)) return undefined;
  const asset = await getReadyUploadAssetForUser(userId, assetId);
  if (!asset) return undefined;
  try {
    const signal = AbortSignal.timeout(30_000);
    const head = await withUploadAbort(storage.headPrivate(asset.key, asset.version), signal);
    if (head.status !== "found" || head.private !== true || head.version !== asset.version || head.bytes !== asset.bytes || head.sha256 !== asset.sha256) return undefined;
    const read = await withUploadAbort(storage.readPrivate(asset.key, asset.version, asset.bytes), signal);
    if (read.status !== "found" || !(read.bytes instanceof Uint8Array) || read.bytes.byteLength !== asset.bytes || hash(read.bytes) !== asset.sha256) return undefined;
    const current = await getReadyUploadAssetForUser(userId, assetId);
    if (!current || current.intentId !== asset.intentId || current.key !== asset.key || current.version !== asset.version || current.sha256 !== asset.sha256) return undefined;
    return { bytes: Buffer.from(read.bytes), fileName: asset.fileName, mimeType: asset.mimeType };
  } catch { return undefined; }
}

/** Trusted maintenance only. The provider must permanently consume deleted keys;
 * otherwise a late put could recreate a blob after its quota was released. */
export async function cleanupUploadIntent(id: string, storage: PrivateUploadStorage) {
  const lease = await claimUploadCleanup(id);
  if (!lease) return { completed: false };
  if ("complete" in lease) return { completed: true };
  if (!supportsPrivateStorage(storage) || storage.capabilities.permanentKeyRetirement !== true) {
    await finishUploadCleanup(lease, "unknown");
    return { completed: false };
  }
  try {
    const signal = AbortSignal.timeout(30_000);
    let version = lease.version;
    if (!version) {
      const head = await withUploadAbort(storage.headPrivate(lease.key), signal);
      if (head.status === "found" && head.private === true && head.bytes === lease.bytes && head.sha256 === lease.sha256 && head.version && head.version.length <= 1024) {
        version = head.version;
      } else if (head.status !== "found" && storage.inspectPrivatePreparation) {
        // A durable preparation can identify an interrupted partial write. It is
        // only a deletion target, never proof of complete or scan-ready bytes.
        const prepared = await withUploadAbort(storage.inspectPrivatePreparation(lease.key), signal);
        if (prepared.status === "prepared" && prepared.bytes === lease.bytes && prepared.sha256 === lease.sha256
          && prepared.version && prepared.version.length <= 1024) version = prepared.version;
      }
      // Missing alone never proves a timed-out reception write has finished.
      if (!version) {
        await finishUploadCleanup(lease, "unknown");
        return { completed: false };
      }
    }
    // Persist the precise deletion target before invoking any destructive I/O.
    if (!await prepareUploadCleanupDeletion(lease, version)) return { completed: false };
    const outcome = await withUploadAbort(storage.deletePrivateIfVersion(lease.key, version), signal);
    return { completed: Boolean(await finishUploadCleanup(lease, outcome.status)) };
  } catch {
    // Deletion may already have happened; retain the durable version and retry
    // the same conditional deletion after lease/backoff, never an arbitrary key.
    await finishUploadCleanup(lease, "unknown");
    return { completed: false };
  }
}

export async function maintainUploadLifecycleForScope(scopeKey: string, dependencies: UploadLifecycleDependencies, limit = 50) {
  const validation = await listUploadLifecycleCandidates(scopeKey, "validation", limit);
  const cleanup = await listUploadLifecycleCandidates(scopeKey, "cleanup", limit);
  let validated = 0, cleaned = 0;
  for (const item of validation) {
    if ((await completeUploadIntentForUser(item.userId, item.id, dependencies))?.state === "ready") validated++;
  }
  for (const item of cleanup) if ((await cleanupUploadIntent(item.id, dependencies.storage)).completed) cleaned++;
  return { inspected: validation.length + cleanup.length, validated, cleaned };
}
