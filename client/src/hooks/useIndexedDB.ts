import { privateLocalStorage as vault, type VaultEnvelope } from "@/lib/private-browser-storage";

// Never assign the unowned legacy database to the next account using a device.
const DB_NAME = "sers_private_evidence_v1";
const FILE_STORE = "evidence_files";
type EncryptedFile = { id: string; scope: string; envelope: VaultEnvelope };
export interface StoredFile { id: string; data: string; fileName: string; fileType: string; timestamp: number }

function identity(id = "") {
  const scope = vault.activeScope;
  if (!scope) throw new Error("سجّل الدخول لفتح ملفاتك الخاصة");
  if (id.length > 256) throw new Error("Invalid local file id");
  return { scope, id: `${scope}:${id}` };
}
function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onerror = () => reject(new Error("Local file storage unavailable"));
    request.onblocked = () => reject(new Error("Local file storage blocked"));
    request.onsuccess = () => resolve(request.result);
    request.onupgradeneeded = () => request.result.createObjectStore(FILE_STORE, { keyPath: "id" });
  });
}
async function transaction<T>(scope: string, mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    let result: T;
    const fail = () => { db.close(); reject(new Error("Local file transaction failed")); };
    try {
      if (vault.activeScope !== scope) throw new Error("Account changed");
      const tx = db.transaction(FILE_STORE, mode);
      const request = operation(tx.objectStore(FILE_STORE));
      request.onsuccess = () => { result = request.result; };
      tx.onabort = fail; tx.onerror = fail;
      tx.oncomplete = () => {
        db.close();
        if (vault.activeScope !== scope) reject(new Error("Account changed")); else resolve(result);
      };
    } catch { fail(); }
  });
}
export async function saveFileToIDB(file: StoredFile): Promise<void> {
  const target = identity(file.id);
  if (file.data.length > 24 * 1024 * 1024) throw new Error("Local file exceeds size limit");
  const envelope = await vault.seal(file, `file:${target.id}`);
  await transaction(target.scope, "readwrite", store => store.put({ ...target, envelope } satisfies EncryptedFile));
}
export async function getFileFromIDB(id: string): Promise<StoredFile | null> {
  const target = identity(id);
  const row: EncryptedFile | undefined = await transaction(target.scope, "readonly", store => store.get(target.id));
  if (!row) return null;
  if (row.scope !== target.scope || row.id !== target.id) throw new Error("Invalid local file scope");
  const file = await vault.open<StoredFile>(row.envelope, `file:${target.id}`);
  if (file.id !== id) throw new Error("Invalid local file binding");
  return file;
}
export async function deleteFileFromIDB(id: string): Promise<void> {
  const target = identity(id);
  await transaction(target.scope, "readwrite", store => store.delete(target.id));
}
export async function getAllFilesFromIDB(): Promise<StoredFile[]> {
  const { scope } = identity();
  const rows: EncryptedFile[] = await transaction(scope, "readonly", store => store.getAll(IDBKeyRange.bound(`${scope}:`, `${scope}:\uffff`)));
  return Promise.all(rows.map(async row => {
    if (row.scope !== scope) throw new Error("Invalid local file scope");
    return vault.open<StoredFile>(row.envelope, `file:${row.id}`);
  }));
}
