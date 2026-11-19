import { readFileSync } from "node:fs";
import { webcrypto } from "node:crypto";
import { describe, expect, it } from "vitest";
import { PrivateBrowserVault } from "../client/src/lib/private-browser-storage";

class MemoryStorage {
  data = new Map<string, string>();
  fail = false;
  get length() { return this.data.size; }
  getItem(key: string) { return this.data.get(key) ?? null; }
  key(index: number) { return Array.from(this.data.keys())[index] ?? null; }
  setItem(key: string, value: string) {
    if (this.fail) throw new Error("QuotaExceededError");
    this.data.set(key, value);
  }
  removeItem(key: string) {
    if (this.fail) throw new Error("Storage denied");
    this.data.delete(key);
  }
}

const alice = { key: "a1".repeat(32), scope: "b2".repeat(32) };

describe("user profile private vault boundary", () => {
  it("uses the existing encrypted storage while retaining the logical sers-user name", () => {
    const source = readFileSync("client/src/stores/userStore.ts", "utf8");
    expect(source).toContain("name: 'sers-user'");
    expect(source).toContain("storage: privateUserStorage");
    expect(source).not.toContain("createJSONStorage(() => localStorage)");
  });

  it("does not auto-claim an unowned legacy plaintext record", () => {
    const storeSource = readFileSync("client/src/stores/userStore.ts", "utf8");
    const accountSource = readFileSync("client/src/pages/AccountHub.tsx", "utf8");
    expect(storeSource).not.toContain("readLegacyPlaintextUserRecord");
    expect(accountSource).toContain("window.confirm(");
    expect(accountSource).toContain("setItemDurably(\"sers-user\", raw)");
    expect(accountSource).toContain("removeLegacyPlaintextUserRecord();");
  });

  it("keeps the legacy source until an encrypted durable copy exists", async () => {
    const store = new MemoryStorage();
    const vault = new PrivateBrowserVault(() => store, webcrypto as Crypto);
    const legacy = JSON.stringify({ state: { personalInfo: { department: "private" }, profile: { fullName: "private" } }, version: 0 });
    store.setItem("sers-user", legacy);

    await vault.unlock(alice);
    await vault.setItemDurably("sers-user", legacy);
    await vault.flush();
    expect(store.getItem("sers-user")).toBe(legacy);
    const encrypted = Array.from(store.data).find(([key]) => key.startsWith("sers:vault:"));
    expect(encrypted).toBeDefined();
    expect(encrypted?.[1]).not.toContain("private");

    // This models the explicit post-success removal step; failures before it
    // leave the plaintext source untouched.
    store.removeItem("sers-user");
    await vault.prepareLogout();
    vault.lock();
    await vault.unlock(alice);
    expect(vault.getItem("sers-user")).toBe(legacy);
  });
});
