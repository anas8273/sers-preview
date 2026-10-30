import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrivateBrowserVault } from "../client/src/lib/private-browser-storage";
import { safeAuthReturnPath } from "../shared/auth-return-path";
class MemoryStorage {
  data = new Map<string, string>(); fail = false;
  get length() { return this.data.size; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  setItem(key: string, value: string) { if (this.fail) throw new Error("QuotaExceededError"); this.data.set(key, value); }
  removeItem(key: string) { if (this.fail) throw new Error("Storage denied"); this.data.delete(key); }
}
const alice = { key: "a1".repeat(32), scope: "b2".repeat(32) }, bob = { key: "c3".repeat(32), scope: "d4".repeat(32) };
const create = (store = new MemoryStorage()) => ({ store, vault: new PrivateBrowserVault(() => store, webcrypto as Crypto) });
describe("private browser cache boundaries", () => {
  it("persists ciphertext only, locks on logout, restores for the same account and isolates the next account", async () => {
    const { store, vault } = create();
    store.setItem("sers-reports", "UNOWNED_LEGACY");
    await vault.unlock(alice); expect(vault.getItem("sers-reports")).toBeNull();
    vault.setItem("sers:report-draft:123", "PRIVATE_ARABIC_REPORT مدرسة"); await vault.prepareLogout();
    const encoded = Array.from(store.data).filter(([name]) => name.startsWith("sers:vault:"));
    expect(JSON.stringify(encoded)).not.toMatch(/PRIVATE_ARABIC_REPORT|مدرسة|report-draft|a1a1a1/);
    expect(encoded).toHaveLength(1); vault.lock();
    expect(() => vault.getItem("sers:report-draft:123")).toThrow();
    await vault.unlock(bob); expect(vault.length).toBe(0);
    vault.setItem("sers:report-draft:123", "BOB"); await vault.flush();
    await vault.unlock(alice); expect(vault.getItem("sers:report-draft:123")).toBe("PRIVATE_ARABIC_REPORT مدرسة");
    expect(store.getItem("sers-reports")).toBe("UNOWNED_LEGACY");
  });
  it("refuses successful logout while data is not durable, retains edits and supports retry", async () => {
    const { store, vault } = create(); await vault.unlock(alice); store.fail = true;
    vault.setItem("report", "UNSAVED"); await expect(vault.prepareLogout()).rejects.toThrow();
    expect(vault.getItem("report")).toBe("UNSAVED"); expect(vault.hasWriteError).toBe(true);
    store.fail = false; await vault.retry(); await vault.prepareLogout(); vault.lock();
    await vault.unlock(alice); expect(vault.getItem("report")).toBe("UNSAVED");
  });
  it("does not publish failed evidence confirmation even to in-memory readers", async () => {
    const { store, vault } = create(); await vault.unlock(alice);
    await vault.setItemDurably("mapping", "before"); store.fail = true;
    await expect(vault.setItemDurably("mapping", "unconfirmed")).rejects.toThrow();
    expect(vault.getItem("mapping")).toBe("before");
    store.fail = false; await vault.unlock(alice); expect(vault.getItem("mapping")).toBe("before");
    await vault.setItemDurably("mapping", "confirmed"); await vault.unlock(alice); expect(vault.getItem("mapping")).toBe("confirmed");
  });
  it("binds encrypted files to account and record, randomizes IVs and rejects tampering", async () => {
    const { vault } = create(); await vault.unlock(alice);
    const first = await vault.seal({ content: "secret" }, "file:one"), second = await vault.seal({ content: "secret" }, "file:one");
    expect(first.iv).not.toBe(second.iv); expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(await vault.open(first, "file:one")).toEqual({ content: "secret" });
    await expect(vault.open(first, "file:two")).rejects.toThrow();
    await expect(vault.open({ ...first, ciphertext: "AAAA" + first.ciphertext.slice(4) }, "file:one")).rejects.toThrow();
    await vault.unlock(bob); await expect(vault.open(first, "file:one")).rejects.toThrow();
  });
  it("fails closed on damaged cache and does not erase the stored record", async () => {
    const { store, vault } = create(); await vault.unlock(alice); await vault.setItemDurably("report", "original");
    const name = store.key(0)!; store.setItem(name, "{}");
    await expect(vault.unlock(alice)).rejects.toThrow(); expect(vault.activeScope).toBeNull(); expect(store.getItem(name)).toBe("{}");
  });
  it("cannot write or unlock after an account transition invalidates asynchronous work", async () => {
    const { store, vault } = create(); await vault.unlock(alice);
    vault.setItem("report", "late"); vault.lock(); await new Promise(resolve => setTimeout(resolve, 10)); expect(store.length).toBe(0);
    const unlocking = vault.unlock(alice); vault.lock(); await expect(unlocking).rejects.toThrow(); expect(vault.activeScope).toBeNull();
  });
});
describe("OAuth return paths", () => {
  it.each(["/account", "/work", "/work/123/report", "/reports", "/performance-evidence"])("keeps a permitted path %s", path => expect(safeAuthReturnPath(path)).toBe(path));
  it.each(["https://evil.invalid", "//evil.invalid", "/\\evil.invalid", "/api/oauth/start", "/work/123/report?token=secret", "/work/123/report#secret", "/%2f%2fevil", "/work/0", "/work/123\n", undefined, ["/account"]])("rejects unsafe/secret-bearing return input %s", path => expect(safeAuthReturnPath(path)).toBe("/"));
});
