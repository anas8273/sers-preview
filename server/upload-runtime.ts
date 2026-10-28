import { createPrivateFilesystemStorage } from "./private-filesystem-storage";
import { createClamAvUploadScanner } from "./upload-scanner";
import type { PrivateUploadStorage } from "./private-upload-storage";

export class UploadRuntimeUnavailableError extends Error {
  constructor() { super("رفع الملفات غير متاح حاليًا في هذه البيئة"); }
}
export class UploadRuntimeBusyError extends Error {
  constructor() { super("توجد عملية رفع أو فحص جارية؛ حاول بعد قليل"); }
}
function positiveSetting(name: string, maximum: number) {
  const raw = process.env[name];
  if (!raw || !/^[1-9][0-9]*$/.test(raw)) throw new UploadRuntimeUnavailableError();
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value > maximum) throw new UploadRuntimeUnavailableError();
  return value;
}
export const SUPPORTED_EVIDENCE_MIME_TYPES = ["application/pdf", "image/png", "image/jpeg", "text/plain"] as const;
export function uploadPolicy(requireEnabled = true) {
  if ((requireEnabled && process.env.SERS_UPLOADS_ENABLED !== "1") || !process.env.SERS_PRIVATE_STORAGE_DIR || !process.env.SERS_CLAMAV_HOST) throw new UploadRuntimeUnavailableError();
  return {
    personalLimitBytes: positiveSetting("SERS_UPLOAD_PERSONAL_LIMIT_BYTES", Number.MAX_SAFE_INTEGER),
    schoolLimitBytes: positiveSetting("SERS_UPLOAD_SCHOOL_LIMIT_BYTES", Number.MAX_SAFE_INTEGER),
    maxActiveIntents: positiveSetting("SERS_UPLOAD_MAX_ACTIVE_INTENTS", 1000),
    clamavHost: process.env.SERS_CLAMAV_HOST,
    clamavPort: positiveSetting("SERS_CLAMAV_PORT", 65535),
  };
}
let privateStorage: Promise<PrivateUploadStorage> | undefined;
export function getConfiguredPrivateStorage() {
  const rootDirectory = process.env.SERS_PRIVATE_STORAGE_DIR;
  if (!rootDirectory) throw new UploadRuntimeUnavailableError();
  if (!privateStorage) privateStorage = createPrivateFilesystemStorage({ rootDirectory }).catch(error => { privateStorage = undefined; throw error; });
  return privateStorage;
}
export async function getUploadRuntime() {
  const policy = uploadPolicy(false);
  return { storage: await getConfiguredPrivateStorage(), scanner: createClamAvUploadScanner({ host: policy.clamavHost, port: policy.clamavPort }), policy };
}
export type UploadRuntime = Awaited<ReturnType<typeof getUploadRuntime>>;

// Bound the in-process buffering/decoder load. Durable quota and leases remain
// the authority when more than one application process is configured.
const activeActors = new Set<number>();
export async function withUploadSlot<T>(userId: number, operation: () => Promise<T>): Promise<T> {
  if (activeActors.size >= 4 || activeActors.has(userId)) throw new UploadRuntimeBusyError();
  activeActors.add(userId);
  try { return await operation(); } finally { activeActors.delete(userId); }
}
