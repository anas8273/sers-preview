import { QueryClient } from "@tanstack/react-query";
import { clearPrivateQueryCache } from "../client/src/lib/private-query-cache";
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
  it("locks immediately on remote logout and preserves a failed autosave as ciphertext until retry", async () => {
    const { store, vault } = create(); await vault.unlock(alice);
    await vault.setItemDurably("report", "OLDER_SERVER_DRAFT");
    store.fail = true; vault.setItem("report", "PRIVATE_UNSENT_DRAFT");
    await expect(vault.flush()).rejects.toThrow();
    const suspended = vault.suspendForAuthChange();
    expect(vault.activeScope).toBeNull();
    expect(() => vault.getItem("report")).toThrow();
    await expect(suspended).rejects.toThrow();
    expect(vault.hasEncryptedRecovery).toBe(true);
    expect(vault.recoveryIncomplete).toBe(false);
    expect(JSON.stringify(Array.from(store.data))).not.toContain("PRIVATE_UNSENT_DRAFT");
    // A new identity cannot replace the pending recovery or expose the old key.
    await expect(vault.unlock(bob)).rejects.toThrow();
    expect(vault.activeScope).toBeNull();
    store.fail = false; await vault.retryEncryptedRecovery();
    expect(vault.activeScope).toBeNull(); expect(vault.hasEncryptedRecovery).toBe(false);
    await vault.unlock(bob); expect(vault.getItem("report")).toBeNull();
    await vault.unlock(alice); expect(vault.getItem("report")).toBe("PRIVATE_UNSENT_DRAFT");
  });
  it("retains an autosave still encrypting when a session is invalidated, without reopening readable state", async () => {
    const { store, vault } = create(); await vault.unlock(alice);
    vault.setItem("report", "PENDING_ENCRYPTION");
    vault.lock();
    expect(vault.activeScope).toBeNull(); expect(() => vault.getItem("report")).toThrow();
    await vault.retryEncryptedRecovery();
    expect(vault.activeScope).toBeNull();
    expect(JSON.stringify(Array.from(store.data))).not.toContain("PENDING_ENCRYPTION");
    await vault.unlock(alice); expect(vault.getItem("report")).toBe("PENDING_ENCRYPTION");
  });
  it("bounds recovery records and requires explicit acknowledgement when preservation was incomplete", async () => {
    const { store, vault } = create(); await vault.unlock(alice); store.fail = true;
    for (let i = 0; i < 65; i++) vault.setItem(`draft-${i}`, `PRIVATE_${i}`);
    await expect(vault.flush()).rejects.toThrow();
    await expect(vault.suspendForAuthChange()).rejects.toThrow();
    expect(vault.recoveryIncomplete).toBe(true);
    expect(() => vault.acknowledgeRecoveryLoss()).toThrow();
    store.fail = false; await expect(vault.retryEncryptedRecovery()).rejects.toThrow();
    expect(store.length).toBe(64); expect(vault.canAcknowledgeRecoveryLoss).toBe(true);
    await expect(vault.unlock(bob)).rejects.toThrow();
    vault.acknowledgeRecoveryLoss(); await vault.unlock(bob); expect(vault.length).toBe(0);
    await vault.unlock(alice); expect(vault.length).toBe(64);
  });
  it("does not publish failed evidence confirmation even to in-memory readers", async () => {
    const { store, vault } = create(); await vault.unlock(alice);
    await vault.setItemDurably("mapping", "before"); store.fail = true;
    await expect(vault.setItemDurably("mapping", "unconfirmed")).rejects.toThrow();
    expect(vault.getItem("mapping")).toBe("before");
    store.fail = false; await vault.unlock(alice); expect(vault.getItem("mapping")).toBe("before");
    await vault.setItemDurably("mapping", "confirmed"); await vault.unlock(alice); expect(vault.getItem("mapping")).toBe("confirmed");
  });
  it("does not let a queued durable commit overwrite a later edit", async () => {
    const { vault } = create(); await vault.unlock(alice);
    const outdated = vault.setItemDurably("report", "older");
    vault.setItem("report", "newer");
    await expect(outdated).rejects.toThrow(); await vault.flush();
    expect(vault.getItem("report")).toBe("newer");
    await vault.unlock(alice); expect(vault.getItem("report")).toBe("newer");
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


describe("private query cache on identity change", () => {
  it("removes previous-account records and prevents a late request from restoring them", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const identity = [["auth", "me"], { type: "query" }];
    const report = [["domain", "reportDraft", "get"], { input: { workItemId: 1 }, type: "query" }];
    client.setQueryData(identity, { id: 2 });
    client.setQueryData([["account", "overview"]], { private: "FIRST_ACCOUNT" });
    let finish!: (value: unknown) => void;
    const request = client.fetchQuery({ queryKey: report, queryFn: () => new Promise(resolve => { finish = resolve; }) }).catch(() => {});
    await clearPrivateQueryCache(client);
    finish({ private: "LATE_FIRST_ACCOUNT" }); await request;
    expect(client.getQueryData(identity)).toEqual({ id: 2 });
    expect(client.getQueryData(report)).toBeUndefined();
    expect(client.getQueryCache().getAll()).toHaveLength(1);
    client.clear();
  });
});
