/** Encrypted, account-isolated browser cache. Only ciphertext is persistent.
 * The non-extractable WebCrypto key and decoded records exist in memory while
 * an authenticated workspace is open. Unowned legacy plaintext is never read. */
export type VaultEnvelope = { version: 1; iv: string; ciphertext: string };
type Store = Pick<Storage, "getItem" | "setItem" | "removeItem" | "key" | "length">;
const PREFIX = "sers:vault:v1:";
const bytes = (value: string) => new TextEncoder().encode(value);
const b64 = (value: Uint8Array) => {
  let text = "";
  for (let offset = 0; offset < value.length; offset += 8192) text += String.fromCharCode(...Array.from(value.subarray(offset, offset + 8192)));
  return btoa(text);
};
const unb64 = (value: string) => Uint8Array.from(atob(value), c => c.charCodeAt(0));

export class PrivateBrowserVault {
  private cryptoKey?: CryptoKey;
  private scope = "";
  private generation = 0;
  private frozen = false;
  private records = new Map<string, string>();
  private dirty = new Map<string, string | null>();
  private queue: Promise<void> = Promise.resolve();
  private failure = false;
  private durableWrites = 0;
  private revisions = new Map<string, number>();
  private serial = 0;
  constructor(private store: () => Store, private crypt: Crypto, private changed: () => void = () => {}) {}

  get activeScope() { return this.cryptoKey ? this.scope : null; }
  get hasPendingWrites() { return this.dirty.size > 0 || this.durableWrites > 0; }
  get hasWriteError() { return this.failure; }
  private current() {
    if (!this.cryptoKey) throw new Error("سجّل الدخول لفتح بياناتك الخاصة");
    return { key: this.cryptoKey, scope: this.scope, generation: this.generation };
  }
  private assertCurrent(generation: number) {
    if (!this.cryptoKey || generation !== this.generation) throw new Error("أُغلقت مساحة البيانات الخاصة");
  }
  private async recordId(name: string) {
    return Array.from(new Uint8Array(await this.crypt.subtle.digest("SHA-256", bytes(name))), v => v.toString(16).padStart(2, "0")).join("");
  }
  async seal(value: unknown, purpose: string): Promise<VaultEnvelope> {
    const current = this.current();
    const iv = this.crypt.getRandomValues(new Uint8Array(12));
    const encrypted = await this.crypt.subtle.encrypt({ name: "AES-GCM", iv, additionalData: bytes(`${current.scope}:${purpose}`) }, current.key, bytes(JSON.stringify(value)));
    this.assertCurrent(current.generation);
    return { version: 1, iv: b64(iv), ciphertext: b64(new Uint8Array(encrypted)) };
  }
  async open<T>(value: VaultEnvelope, purpose: string): Promise<T> {
    const current = this.current();
    if (value?.version !== 1 || typeof value.iv !== "string" || typeof value.ciphertext !== "string" || value.ciphertext.length > 48 * 1024 * 1024) throw new Error("Invalid encrypted record");
    const iv = unb64(value.iv);
    if (iv.length !== 12) throw new Error("Invalid encrypted record");
    const plain = await this.crypt.subtle.decrypt({ name: "AES-GCM", iv, additionalData: bytes(`${current.scope}:${purpose}`) }, current.key, unb64(value.ciphertext));
    this.assertCurrent(current.generation);
    return JSON.parse(new TextDecoder().decode(plain)) as T;
  }
  async unlock(input: { key: string; scope: string }) {
    this.lock();
    if (!/^[a-f0-9]{64}$/.test(input.key) || !/^[a-f0-9]{64}$/.test(input.scope)) throw new Error("Invalid private storage identity");
    const generation = this.generation;
    const keyBytes = Uint8Array.from(input.key.match(/../g)!, part => parseInt(part, 16));
    const key = await this.crypt.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
    keyBytes.fill(0);
    if (generation !== this.generation) throw new Error("Private storage initialization cancelled");
    this.cryptoKey = key; this.scope = input.scope;
    try {
      const store = this.store(), prefix = `${PREFIX}${this.scope}:`;
      const names = Array.from({ length: store.length }, (_, i) => store.key(i)).filter((k): k is string => Boolean(k?.startsWith(prefix)));
      if (names.length > 2000) throw new Error("Too many local records");
      for (const name of names) {
        const raw = store.getItem(name);
        if (!raw) continue;
        const item = await this.open<{ name: string; value: string }>(JSON.parse(raw), name);
        if (typeof item.name !== "string" || typeof item.value !== "string" || name !== prefix + await this.recordId(item.name)) throw new Error("Invalid private record binding");
        this.assertCurrent(generation);
        this.records.set(item.name, item.value);
      }
      this.changed();
    } catch {
      if (generation === this.generation) this.lock();
      throw new Error("تعذر فتح النسخة المحلية بأمان. لم تُحذف بياناتك؛ أعد المحاولة أو استخدم نسخة الخادم.");
    }
  }
  lock() {
    this.generation++; this.cryptoKey = undefined; this.scope = ""; this.frozen = false;
    this.records.clear(); this.dirty.clear(); this.revisions.clear(); this.failure = false; this.durableWrites = 0; this.queue = Promise.resolve(); this.changed();
  }
  getItem(name: string) { this.current(); return this.records.get(name) ?? null; }
  get length() { this.current(); return this.records.size; }
  key(index: number) { this.current(); return Array.from(this.records.keys())[index] ?? null; }
  private schedule(name: string, value: string | null) {
    const current = this.current();
    const revision = ++this.serial; this.revisions.set(name, revision);
    this.dirty.set(name, value); this.changed();
    this.queue = this.queue.then(async () => {
      this.assertCurrent(current.generation);
      if (this.revisions.get(name) !== revision) return;
      const key = `${PREFIX}${current.scope}:${await this.recordId(name)}`;
      if (value === null) { this.assertCurrent(current.generation); if (this.revisions.get(name) !== revision) return; this.store().removeItem(key); }
      else {
        const sealed = await this.seal({ name, value }, key);
        this.assertCurrent(current.generation);
        if (this.revisions.get(name) !== revision) return;
        this.store().setItem(key, JSON.stringify(sealed));
      }
      if (this.revisions.get(name) === revision) this.dirty.delete(name);
      if (!this.dirty.size) this.failure = false;
    }).catch(() => {
      if (this.generation === current.generation) this.failure = true;
    }).finally(() => { if (this.generation === current.generation) this.changed(); });
  }
  setItem(name: string, value: string) {
    this.current();
    if (this.frozen) throw new Error("انتظر اكتمال تسجيل الخروج");
    if (name.length > 1024 || typeof value !== "string" || bytes(value).length > 8 * 1024 * 1024) throw new Error("النسخة المحلية أكبر من الحد المسموح");
    this.records.set(name, value); this.schedule(name, value);
  }
  removeItem(name: string) {
    this.current();
    if (this.frozen) throw new Error("انتظر اكتمال تسجيل الخروج");
    this.records.delete(name); this.schedule(name, null);
  }
  clear() { for (const name of Array.from(this.records.keys())) this.removeItem(name); }
  /** Commit before publishing to readers. Failure leaves the previous record
   * intact, so evidence confirmation cannot advance on an in-memory write. */
  async setItemDurably(name: string, value: string) {
    const current = this.current();
    if (this.frozen) throw new Error("انتظر اكتمال تسجيل الخروج");
    if (name.length > 1024 || bytes(value).length > 8 * 1024 * 1024) throw new Error("النسخة المحلية أكبر من الحد المسموح");
    const revision = ++this.serial; this.revisions.set(name, revision);
    this.durableWrites++; this.changed();
    const operation = this.queue.then(async () => {
      this.assertCurrent(current.generation);
      const key = `${PREFIX}${current.scope}:${await this.recordId(name)}`;
      const sealed = await this.seal({ name, value }, key);
      this.assertCurrent(current.generation);
      if (this.revisions.get(name) !== revision) throw new Error("تغيرت البيانات أثناء الحفظ؛ أعد المحاولة");
      this.store().setItem(key, JSON.stringify(sealed));
      this.records.set(name, value);
      this.dirty.delete(name);
      if (!this.dirty.size) this.failure = false;
    });
    this.queue = operation.catch(() => {}).finally(() => { if (this.generation === current.generation) { this.durableWrites--; this.changed(); } });
    await operation;
  }
  async flush() {
    await this.queue;
    if (this.dirty.size || this.failure) throw new Error("لم يكتمل حفظ بياناتك على الجهاز. أبق الصفحة مفتوحة وأعد المحاولة قبل الخروج.");
  }
  async retry() {
    for (const [name, value] of Array.from(this.dirty)) this.schedule(name, value);
    await this.flush();
  }
  async prepareLogout() { this.frozen = true; try { await this.flush(); } catch (error) { this.frozen = false; throw error; } }
  cancelLogout() { this.frozen = false; }
}

// No browser globals are accessed at import time (server/unit tests can import).
export const privateLocalStorage = new PrivateBrowserVault(
  () => window.localStorage,
  globalThis.crypto,
  () => { if (typeof window !== "undefined") window.dispatchEvent(new Event("sers-private-storage-change")); },
);

export const AUTH_CHANGE_KEY = "sers:auth-change:v1";
export function broadcastAuthChange() {
  try { window.localStorage.setItem(AUTH_CHANGE_KEY, crypto.randomUUID()); } catch { /* BroadcastChannel also reaches live tabs. */ }
  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(AUTH_CHANGE_KEY); channel.postMessage("changed"); channel.close();
  }
}
export function onRemoteAuthChange(callback: () => void) {
  const listener = (event: StorageEvent) => { if (event.key === AUTH_CHANGE_KEY) callback(); };
  window.addEventListener("storage", listener);
  const channel = typeof BroadcastChannel === "undefined" ? undefined : new BroadcastChannel(AUTH_CHANGE_KEY);
  if (channel) channel.onmessage = callback;
  return () => { window.removeEventListener("storage", listener); channel?.close(); };
}
