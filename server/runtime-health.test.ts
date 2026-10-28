import { afterEach, describe, expect, it, vi } from "vitest";
import { chmod, mkdtemp, readdir, rm, symlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { tmpdir } from "node:os";
import { checkWorkerHeartbeat, createHealthService, runtimeHealthChecks, validHealthBearer } from "./runtime-health";

afterEach(() => vi.unstubAllEnvs());

describe("bounded and private runtime readiness", () => {
  it("coalesces callers and does not multiply a hung dependency after its deadline", async () => {
    let finish!: () => void;
    const check = vi.fn(() => new Promise<void>(resolve => { finish = resolve; }));
    const service = createHealthService({ database: check }, { timeoutMs: 15, cacheMs: 0 });
    const results = await Promise.all(Array.from({ length: 50 }, () => service.snapshot()));
    expect(check).toHaveBeenCalledTimes(1);
    expect(results.every(value => value.status === "unavailable" && value.dependencies.database === "timeout")).toBe(true);
    expect((await service.snapshot()).dependencies.database).toBe("timeout");
    expect(check).toHaveBeenCalledTimes(1);
    finish(); await new Promise(resolve => setTimeout(resolve, 0));
    check.mockImplementation(async () => {});
    expect((await service.snapshot()).status).toBe("ready");
    expect(check).toHaveBeenCalledTimes(2);
  });

  it("reports dependency loss and recovery without exception data or repeated transition logs", async () => {
    let fails = false;
    const log = vi.fn();
    const service = createHealthService({ database: async () => {}, scanner: async () => { if (fails) throw new Error("secret-token PRIVATE_USER@school.invalid"); } }, { cacheMs: 0, onTransition: log });
    expect((await service.snapshot()).status).toBe("ready");
    await service.snapshot(); expect(log).toHaveBeenCalledTimes(1);
    fails = true; expect((await service.snapshot()).status).toBe("unavailable");
    await service.snapshot(); expect(log).toHaveBeenCalledTimes(2);
    fails = false; expect((await service.snapshot()).status).toBe("ready");
    expect(log).toHaveBeenCalledTimes(3);
    expect(JSON.stringify(log.mock.calls)).not.toMatch(/secret-token|PRIVATE_USER|school.invalid/);
    expect((await createHealthService({}).snapshot()).status).toBe("unavailable");
  });

  it("rejects absent/weak/mismatched monitoring credentials and accepts only the exact bearer", () => {
    const secret = "a9b8c7d6e5f40312".repeat(4);
    expect(validHealthBearer(`Bearer ${secret}`, secret)).toBe(true);
    for (const header of [undefined, [secret], secret, `Bearer ${secret}x`, `Basic ${secret}`, "Bearer short", `Bearer ${"x".repeat(1000)}`]) expect(validHealthBearer(header, secret)).toBe(false);
    expect(validHealthBearer("Bearer short", "short")).toBe(false);
    expect(validHealthBearer(`Bearer ${secret}`, undefined)).toBe(false);
  });

  it("fails when managed private directories become unsafe after provider initialization", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "sers-health-provider-"));
    vi.stubEnv("SERS_PRIVATE_STORAGE_DIR", path.join(parent, "private"));
    try {
      const check = runtimeHealthChecks().storage!;
      await check(new AbortController().signal);
      const before = (await readdir(path.join(parent, "private", "locks"))).length;
      await check(new AbortController().signal);
      expect((await readdir(path.join(parent, "private", "locks"))).length).toBe(before);
      await chmod(path.join(parent, "private", "refs"), 0o755);
      await expect(check(new AbortController().signal)).rejects.toThrow("Unavailable");
      await chmod(path.join(parent, "private", "refs"), 0o700);
      await check(new AbortController().signal);
      expect((await readdir(path.join(parent, "private"))).some(name => name.startsWith(".health-"))).toBe(false);
    } finally { await rm(parent, { recursive: true, force: true }); }
  });

  it("distinguishes fresh successful worker progress from stale/error/future or unsafe heartbeat", async () => {
    const parent = await mkdtemp(path.join(tmpdir(), "sers-health-worker-")), filename = path.join(parent, "heartbeat.json"), now = Date.now();
    try {
      const write = async (status: string, offset = 0) => writeFile(filename, JSON.stringify({ status, updatedAt: new Date(now + offset).toISOString() }), { mode: 0o600 });
      await write("ok"); await checkWorkerHeartbeat(filename, now);
      for (const [status, offset] of [["error", 0], ["ok", -150_001], ["ok", 60_000]] as const) { await write(status, offset); await expect(checkWorkerHeartbeat(filename, now)).rejects.toThrow(); }
      await write("ok"); await chmod(filename, 0o644); await expect(checkWorkerHeartbeat(filename, now)).rejects.toThrow();
      await chmod(filename, 0o600); await writeFile(filename, "x".repeat(4097)); await expect(checkWorkerHeartbeat(filename, now)).rejects.toThrow();
      await rm(filename); await symlink("/etc/passwd", filename); await expect(checkWorkerHeartbeat(filename, now)).rejects.toThrow();
    } finally { await rm(parent, { recursive: true, force: true }); }
  });
});
