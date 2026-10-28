import { createHash, randomUUID } from "node:crypto";
import { chmod, mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it } from "vitest";
import { createPrivateFilesystemStorage } from "./private-filesystem-storage";

const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
const folders: string[] = [];
async function root() { const folder = await mkdtemp(path.join(tmpdir(), "sers-private-test-")); folders.push(folder); return folder; }
afterEach(async () => { await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });

describe("private filesystem storage", () => {
  it("stores exact private bytes, validates receipts, and survives provider restart", async () => {
    const rootDirectory = await root(), provider = await createPrivateFilesystemStorage({ rootDirectory });
    const bytes = Buffer.from([0, 255, 12, 4, 10]), key = "quarantine/file";
    const put = await provider.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) });
    expect(put.status).toBe("created");
    if (put.status !== "created") throw new Error("Missing receipt");
    expect(await provider.headPrivate(key, put.version)).toEqual({ status: "found", version: put.version, bytes: bytes.length, sha256: digest(bytes), private: true });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await restarted.readPrivate(key, put.version, bytes.length)).toEqual({ status: "found", bytes });
    expect((await stat(path.join(rootDirectory, "blobs", put.version))).mode & 0o777).toBe(0o600);
    for (const folder of [rootDirectory, path.join(rootDirectory, "refs"), path.join(rootDirectory, "blobs")]) expect((await stat(folder)).mode & 0o777).toBe(0o700);
    expect(await restarted.readPrivate(key, put.version, bytes.length - 1)).toEqual({ status: "unknown" });
  });

  it("allows only one creation across independent providers and conflicting bytes", async () => {
    const rootDirectory = await root();
    const providers = await Promise.all(Array.from({ length: 8 }, () => createPrivateFilesystemStorage({ rootDirectory })));
    const outcomes = await Promise.all(providers.map((provider, i) => { const bytes = Buffer.from(`file ${i}`); return provider.putPrivateIfAbsent({ key: "q/concurrent", bytes, sha256: digest(bytes) }); }));
    expect(outcomes.filter(result => result.status === "created")).toHaveLength(1);
    expect(outcomes.filter(result => result.status === "exists")).toHaveLength(7);
    const winner = outcomes.findIndex(result => result.status === "created");
    const receipt = outcomes[winner]; if (receipt.status !== "created") throw new Error("Missing receipt");
    expect(await providers[0].readPrivate("q/concurrent", receipt.version, 100)).toEqual({ status: "found", bytes: Buffer.from(`file ${winner}`) });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toHaveLength(1);
  });

  it("permanently consumes deleted keys across restarts and concurrent late puts", async () => {
    const rootDirectory = await root(), provider = await createPrivateFilesystemStorage({ rootDirectory });
    const bytes = Buffer.from("original"), key = "q/retired", request = { key, bytes, sha256: digest(bytes) };
    const result = await provider.putPrivateIfAbsent(request); if (result.status !== "created") throw new Error("Missing receipt");
    expect(await provider.deletePrivateIfVersion(key, randomUUID())).toEqual({ status: "version_mismatch" });
    const outcomes = await Promise.all([provider.deletePrivateIfVersion(key, result.version), ...Array.from({ length: 8 }, () => provider.putPrivateIfAbsent(request))]);
    expect(outcomes[0]).toEqual({ status: "deleted" });
    expect(outcomes.slice(1).every(outcome => outcome.status === "exists")).toBe(true);
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await restarted.putPrivateIfAbsent(request)).toEqual({ status: "exists" });
    expect(await restarted.headPrivate(key)).toEqual({ status: "missing" });
    expect(await restarted.readPrivate(key, result.version, 100)).toEqual({ status: "missing" });
    expect(await restarted.deletePrivateIfVersion(key, result.version)).toEqual({ status: "deleted" });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toHaveLength(0);
    expect(await readFile(path.join(rootDirectory, "tombstones", digest(key)), "ascii")).toBe(result.version);
  });

  it("does not claim an absent key was retired while a writer may still prepare it", async () => {
    const provider = await createPrivateFilesystemStorage({ rootDirectory: await root() });
    expect(await provider.deletePrivateIfVersion("q/unknown", randomUUID())).toEqual({ status: "unknown" });
  });

  it("recovers a complete prepared blob after a crash before reference publication", async () => {
    const rootDirectory = await root(); await createPrivateFilesystemStorage({ rootDirectory });
    const key = "q/crash-complete", version = randomUUID(), bytes = Buffer.from("recoverable payload");
    await writeFile(path.join(rootDirectory, "preparations", digest(key)), JSON.stringify({ format: 1, keyHash: digest(key), version, bytes: bytes.length, sha256: digest(bytes) }), { mode: 0o600 });
    await writeFile(path.join(rootDirectory, "blobs", version), bytes, { mode: 0o600 });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await restarted.headPrivate(key)).toEqual({ status: "found", version, bytes: bytes.length, sha256: digest(bytes), private: true });
    expect(await restarted.readPrivate(key, version, 100)).toEqual({ status: "found", bytes });
    expect(await readdir(path.join(rootDirectory, "refs"))).toContain(digest(key));
  });

  it("exposes only preparation identity for a partial crash and retires its exact version safely", async () => {
    const rootDirectory = await root(); await createPrivateFilesystemStorage({ rootDirectory });
    const key = "q/crash-partial", version = randomUUID(), bytes = Buffer.from("full intended payload");
    await writeFile(path.join(rootDirectory, "preparations", digest(key)), JSON.stringify({ format: 1, keyHash: digest(key), version, bytes: bytes.length, sha256: digest(bytes) }), { mode: 0o600 });
    await writeFile(path.join(rootDirectory, "blobs", version), bytes.subarray(0, 3), { mode: 0o600 });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await restarted.headPrivate(key)).toEqual({ status: "unknown" });
    expect(await restarted.inspectPrivatePreparation!(key)).toEqual({ status: "prepared", version, bytes: bytes.length, sha256: digest(bytes) });
    expect(await restarted.deletePrivateIfVersion(key, randomUUID())).toEqual({ status: "version_mismatch" });
    const results = await Promise.all([restarted.deletePrivateIfVersion(key, version), restarted.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) })]);
    expect(results[0]).toEqual({ status: "deleted" });
    expect(["created", "exists"]).toContain(results[1].status);
    expect(await restarted.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) })).toEqual({ status: "exists" });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toEqual([]);
    expect(await restarted.headPrivate(key)).toEqual({ status: "missing" });
  });

  it("resumes an unpublished partial write only with the same bytes and durable identity", async () => {
    const rootDirectory = await root(); await createPrivateFilesystemStorage({ rootDirectory });
    const key = "outputs/crash-partial", version = randomUUID(), bytes = Buffer.from("full intended output");
    await writeFile(path.join(rootDirectory, "preparations", digest(key)), JSON.stringify({ format: 1, keyHash: digest(key), version, bytes: bytes.length, sha256: digest(bytes) }), { mode: 0o600 });
    await writeFile(path.join(rootDirectory, "blobs", version), bytes.subarray(0, 3), { mode: 0o600 });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    const other = Buffer.from("different output");
    expect(await restarted.putPrivateIfAbsent({ key, bytes: other, sha256: digest(other) })).toEqual({ status: "exists" });
    expect(await readFile(path.join(rootDirectory, "blobs", version))).toEqual(bytes.subarray(0, 3));
    expect(await restarted.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) })).toEqual({ status: "created", version });
    expect(await restarted.headPrivate(key)).toEqual({ status: "found", version, bytes: bytes.length, sha256: digest(bytes), private: true });
    expect(await restarted.readPrivate(key, version, 100)).toEqual({ status: "found", bytes });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toEqual([version]);
  });

  it.each(["../secret", "/root/private", "q/../file", "q//file", "https://host/file", "q/file/"])("rejects untrusted key %s without files", async key => {
    const rootDirectory = await root(), provider = await createPrivateFilesystemStorage({ rootDirectory });
    const bytes = Buffer.from("original");
    expect(await provider.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) })).toEqual({ status: "unknown" });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toHaveLength(0);
  });

  it("rejects a checksum mismatch and never publishes malformed metadata", async () => {
    const rootDirectory = await root(), provider = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await provider.putPrivateIfAbsent({ key: "q/bad", bytes: Buffer.from("x"), sha256: "0".repeat(64) })).toEqual({ status: "unknown" });
    await writeFile(path.join(rootDirectory, "refs", digest("q/bad")), "{}", { mode: 0o600 });
    expect(await provider.headPrivate("q/bad")).toEqual({ status: "unknown" });
  });

  it("does not follow blob symlinks or return modified object bytes", async () => {
    const rootDirectory = await root(), provider = await createPrivateFilesystemStorage({ rootDirectory });
    const key = "q/corrupt", bytes = Buffer.from("original"), receipt = await provider.putPrivateIfAbsent({ key, bytes, sha256: digest(bytes) });
    if (receipt.status !== "created") throw new Error("Missing receipt");
    const blob = path.join(rootDirectory, "blobs", receipt.version);
    await writeFile(blob, Buffer.from("tampered"));
    expect(await provider.headPrivate(key)).toEqual({ status: "unknown" });
    expect(await provider.readPrivate(key, receipt.version, 100)).toEqual({ status: "unknown" });
    await rm(blob);
    const secret = path.join(rootDirectory, "secret"); await writeFile(secret, bytes, { mode: 0o600 });
    await symlink(secret, blob);
    expect(await provider.readPrivate(key, receipt.version, 100)).toEqual({ status: "unknown" });
  });

  it("rejects public permissions, symlink roots and writable non-sticky ancestry", async () => {
    const parent = await root(), real = path.join(parent, "real"), alias = path.join(parent, "alias");
    await mkdir(real, { mode: 0o700 }); await symlink(real, alias);
    await expect(createPrivateFilesystemStorage({ rootDirectory: alias })).rejects.toThrow();
    await chmod(real, 0o755);
    await expect(createPrivateFilesystemStorage({ rootDirectory: real })).rejects.toThrow();
    await chmod(real, 0o700); await chmod(parent, 0o777);
    await expect(createPrivateFilesystemStorage({ rootDirectory: real })).rejects.toThrow();
  });

  it("stops working when managed directory permissions are changed", async () => {
    const rootDirectory = await root(), provider = await createPrivateFilesystemStorage({ rootDirectory });
    await chmod(path.join(rootDirectory, "blobs"), 0o755);
    expect(await provider.putPrivateIfAbsent({ key: "q/private", bytes: Buffer.from("x"), sha256: digest("x") })).toEqual({ status: "unknown" });
  });
});
