import type { Page } from "puppeteer";

/** Read actual ciphertext persisted by the browser; never inspect React state.
 * Keys are fetched from the authenticated API and never returned to the runner. */
export async function decryptedRecords(page: Page) {
  await page.waitForSelector('[data-private-storage-pending="false"], [data-private-storage-error="true"]', { visible: false });
  return page.evaluate(async () => {
    const response = await fetch("/api/trpc/auth.browserStorageKey", { cache: "no-store" });
    if (!response.ok) throw new Error("Authenticated private storage unavailable");
    const { key: hex, scope } = (await response.json()).result.data.json;
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(hex.match(/../g)!, (part: string) => parseInt(part, 16)), "AES-GCM", false, ["decrypt"]);
    const result: Record<string, string> = {};
    for (const name of Object.keys(localStorage).filter(name => name.startsWith(`sers:vault:v1:${scope}:`))) {
      const envelope = JSON.parse(localStorage.getItem(name)!);
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0)), additionalData: new TextEncoder().encode(`${scope}:${name}`) }, key, Uint8Array.from(atob(envelope.ciphertext), c => c.charCodeAt(0)));
      const record = JSON.parse(new TextDecoder().decode(plain)); result[record.name] = record.value;
    }
    return result;
  });
}
export async function decryptedFile(page: Page, name: string) {
  return page.evaluate(async name => {
    const response = await fetch("/api/trpc/auth.browserStorageKey", { cache: "no-store" });
    const { key: hex, scope } = (await response.json()).result.data.json;
    const key = await crypto.subtle.importKey("raw", Uint8Array.from(hex.match(/../g)!, (part: string) => parseInt(part, 16)), "AES-GCM", false, ["decrypt"]);
    const rows = await new Promise<any[]>((resolve, reject) => {
      const request = indexedDB.open("sers_private_evidence_v1", 1);
      request.onerror = () => reject(new Error("Cannot inspect persisted encrypted files"));
      request.onsuccess = () => {
        const db = request.result, tx = db.transaction("evidence_files", "readonly"), read = tx.objectStore("evidence_files").getAll();
        read.onsuccess = () => resolve(read.result); read.onerror = () => reject(read.error); tx.oncomplete = () => db.close();
      };
    });
    for (const row of rows.filter(row => row.scope === scope)) {
      const { envelope } = row;
      const plain = await crypto.subtle.decrypt({ name: "AES-GCM", iv: Uint8Array.from(atob(envelope.iv), c => c.charCodeAt(0)), additionalData: new TextEncoder().encode(`${scope}:file:${row.id}`) }, key, Uint8Array.from(atob(envelope.ciphertext), c => c.charCodeAt(0)));
      const file = JSON.parse(new TextDecoder().decode(plain)); if (file.fileName === name) return file;
    }
  }, name);
}
