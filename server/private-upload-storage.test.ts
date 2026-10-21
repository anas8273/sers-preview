import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { receivePrivateUpload, type PrivateUploadStorage } from "./private-upload-storage";

const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
async function* source(...chunks: Uint8Array[]) { yield* chunks; }

// Test double only: never exported or selected by production configuration.
function privateStore() {
  const objects = new Map<string, { version: string; bytes: Uint8Array; sha256: string }>();
  let revision = 0;
  const adapter: PrivateUploadStorage = {
    capabilities: { privateObjects: true, conditionalCreate: true, versionedDelete: true },
    putPrivateIfAbsent: vi.fn(async ({ key, bytes, sha256 }) => {
      if (objects.has(key)) return { status: "exists" as const };
      const version = `v${++revision}`;
      objects.set(key, { version, bytes: bytes.slice(), sha256 });
      return { status: "created" as const, version };
    }),
    headPrivate: vi.fn(async (key, version) => {
      const item = objects.get(key);
      if (!item || (version !== undefined && item.version !== version)) return { status: "missing" as const };
      return { status: "found" as const, version: item.version, bytes: item.bytes.length, sha256: item.sha256, private: true };
    }),
    readPrivate: vi.fn(async (key, version, maxBytes) => {
      const item = objects.get(key);
      if (!item || item.version !== version) return { status: "missing" as const };
      if (item.bytes.length > maxBytes) return { status: "unknown" as const };
      return { status: "found" as const, bytes: item.bytes.slice() };
    }),
    deletePrivateIfVersion: vi.fn(async (key, version) => {
      const item = objects.get(key);
      if (!item) return { status: "missing" as const };
      if (item.version !== version) return { status: "version_mismatch" as const };
      objects.delete(key);
      return { status: "deleted" as const };
    }),
  };
  return { adapter, objects };
}

describe("bounded private upload receipt contract", () => {
  it("preserves all original video bytes and derives the checksum server-side", async () => {
    const { adapter, objects } = privateStore();
    const bytes = Buffer.concat([Buffer.from("000000186674797069736f6d0000020069736f6d69736f32", "hex"), Buffer.from([0, 255, 13, 10, 1, 0, 128])]);
    const result = await receivePrivateUpload(adapter, { key: "quarantine/video_1", source: source(bytes.subarray(0, 9), bytes.subarray(9)), expectedBytes: bytes.length });
    expect(result).toEqual({ status: "confirmed", receipt: { key: "quarantine/video_1", version: "v1", bytes: bytes.length, sha256: hash(bytes) } });
    expect(Buffer.from(objects.get("quarantine/video_1")!.bytes)).toEqual(bytes);
    expect(adapter.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it("stops consuming an oversized source before another chunk and writes nothing", async () => {
    const { adapter } = privateStore();
    let visitedTail = false, closed = false;
    async function* oversized() {
      try {
        yield new Uint8Array([1, 2]);
        yield new Uint8Array([3, 4, 5]);
        visitedTail = true;
        yield new Uint8Array(1000);
      } finally { closed = true; }
    }
    const result = await receivePrivateUpload(adapter, { key: "q/oversized", source: oversized(), expectedBytes: 4 });
    expect(result.status).toBe("rejected");
    expect(visitedTail).toBe(false);
    expect(closed).toBe(true);
    expect(adapter.putPrivateIfAbsent).not.toHaveBeenCalled();
  });

  it("rejects a short or interrupted source without storage side effects", async () => {
    const { adapter } = privateStore();
    expect((await receivePrivateUpload(adapter, { key: "q/short", source: source(new Uint8Array([1])), expectedBytes: 2 })).status).toBe("rejected");
    async function* interrupted() { yield new Uint8Array([1]); throw new Error("network interrupted"); }
    expect((await receivePrivateUpload(adapter, { key: "q/interrupted", source: interrupted(), expectedBytes: 2 })).status).toBe("rejected");
    expect(adapter.putPrivateIfAbsent).not.toHaveBeenCalled();
  });

  it("copies yielded chunks before a producer reuses its buffer", async () => {
    const { adapter, objects } = privateStore();
    async function* reused() {
      const chunk = new Uint8Array([1, 2]);
      yield chunk;
      chunk.set([3, 4]);
      yield chunk;
    }
    const result = await receivePrivateUpload(adapter, { key: "q/reused", source: reused(), expectedBytes: 4 });
    expect(result.status).toBe("confirmed");
    expect(Array.from(objects.get("q/reused")!.bytes)).toEqual([1, 2, 3, 4]);
  });

  it("bounds an endless sequence of empty chunks without writing", async () => {
    const { adapter } = privateStore();
    let consumed = 0, closed = false;
    async function* emptyChunks() {
      try { while (true) { consumed++; yield new Uint8Array(0); } }
      finally { closed = true; }
    }
    expect((await receivePrivateUpload(adapter, { key: "q/empty-chunks", source: emptyChunks(), expectedBytes: 1 })).status).toBe("rejected");
    expect(consumed).toBeLessThanOrEqual(65537);
    expect(closed).toBe(true);
    expect(adapter.putPrivateIfAbsent).not.toHaveBeenCalled();
  });

  it("treats a thrown write as unknown and never compensates by deleting", async () => {
    const { adapter } = privateStore();
    vi.mocked(adapter.putPrivateIfAbsent).mockRejectedValue(new Error("provider timeout"));
    const result = await receivePrivateUpload(adapter, { key: "q/timeout", source: source(new Uint8Array([1])), expectedBytes: 1 });
    expect(result.status).toBe("unknown");
    expect(adapter.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it("keeps a committed write after lost acknowledgement and reconciles an identical retry", async () => {
    const { adapter, objects } = privateStore();
    const originalPut = adapter.putPrivateIfAbsent;
    adapter.putPrivateIfAbsent = vi.fn(async args => { await originalPut(args); return { status: "unknown" }; });
    const bytes = new Uint8Array([1, 2, 3]);
    const request = () => ({ key: "q/lostack", source: source(bytes), expectedBytes: bytes.length });
    expect((await receivePrivateUpload(adapter, request())).status).toBe("unknown");
    expect(objects.size).toBe(1);
    expect(await adapter.headPrivate("q/lostack")).toMatchObject({ status: "found", version: "v1", bytes: 3, sha256: hash(bytes), private: true });
    adapter.putPrivateIfAbsent = originalPut;
    expect(await receivePrivateUpload(adapter, request())).toEqual({ status: "confirmed", receipt: { key: "q/lostack", version: "v1", bytes: 3, sha256: hash(bytes) } });
    expect(objects.size).toBe(1);
    expect(adapter.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it("never overwrites an existing key when retry bytes differ", async () => {
    const { adapter, objects } = privateStore();
    const key = "q/conflict";
    await receivePrivateUpload(adapter, { key, source: source(new Uint8Array([1, 2])), expectedBytes: 2 });
    expect((await receivePrivateUpload(adapter, { key, source: source(new Uint8Array([3, 4])), expectedBytes: 2 })).status).toBe("conflict");
    expect(Array.from(objects.get(key)!.bytes)).toEqual([1, 2]);
    expect(objects.get(key)!.version).toBe("v1");
    expect(adapter.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it.each([
    { sha256: "0".repeat(64) }, { bytes: 999 }, { version: "wrong-version" }, { private: false },
  ])("does not confirm a receipt with inconsistent provider metadata: %j", async patch => {
    const { adapter } = privateStore();
    vi.mocked(adapter.headPrivate).mockResolvedValue({ status: "found", version: "v1", bytes: 1, sha256: hash(new Uint8Array([1])), private: true, ...patch });
    expect((await receivePrivateUpload(adapter, { key: "q/bad-metadata", source: source(new Uint8Array([1])), expectedBytes: 1 })).status).toBe("unknown");
    expect(adapter.deletePrivateIfVersion).not.toHaveBeenCalled();
  });

  it.each([0, -1, 1.5, 16 * 1024 * 1024 + 1])("rejects invalid expected size %s before reading or writing", async expectedBytes => {
    const { adapter } = privateStore();
    let read = false;
    async function* unread() { read = true; yield new Uint8Array([1]); }
    expect((await receivePrivateUpload(adapter, { key: "q/invalid-size", source: unread(), expectedBytes })).status).toBe("rejected");
    expect(read).toBe(false);
    expect(adapter.putPrivateIfAbsent).not.toHaveBeenCalled();
  });

  it.each(["https://example.com/object", "../object", "q/../object", "q/object\n", "/absolute/object", "q//object", "q/object/", ""])("rejects invalid key %j before reading or writing", async key => {
    const { adapter } = privateStore();
    let read = false;
    async function* unread() { read = true; yield new Uint8Array([1]); }
    expect((await receivePrivateUpload(adapter, { key, source: unread(), expectedBytes: 1 })).status).toBe("rejected");
    expect(read).toBe(false);
    expect(adapter.putPrivateIfAbsent).not.toHaveBeenCalled();
  });

  it.each(["privateObjects", "conditionalCreate", "versionedDelete"] as const)("rejects unsupported %s capability before reading or writing", async capability => {
    const { adapter } = privateStore();
    adapter.capabilities[capability] = false;
    let read = false;
    async function* unread() { read = true; yield new Uint8Array([1]); }
    expect((await receivePrivateUpload(adapter, { key: "q/unsupported", source: unread(), expectedBytes: 1 })).status).toBe("rejected");
    expect(read).toBe(false);
    expect(adapter.putPrivateIfAbsent).not.toHaveBeenCalled();
  });
});
