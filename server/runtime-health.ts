import { randomBytes, createHash, timingSafeEqual } from "node:crypto";
import { constants } from "node:fs";
import { open, lstat, unlink } from "node:fs/promises";
import { createConnection } from "node:net";
import path from "node:path";
import mysql from "mysql2";
import { getConfiguredPrivateStorage } from "./upload-runtime";

export type DependencyName = "database" | "storage" | "scanner" | "worker";
export type DependencyStatus = "ok" | "error" | "timeout";
export type HealthChecks = Partial<Record<DependencyName, (signal: AbortSignal) => Promise<void>>>;
export type HealthSnapshot = { status: "ready" | "unavailable"; checkedAt: string; dependencies: Partial<Record<DependencyName, DependencyStatus>> };
const names: DependencyName[] = ["database", "storage", "scanner", "worker"];

/** Single flight per dependency remains held until the underlying work settles,
 * even after its deadline. A stuck provider cannot accumulate health requests. */
export function createHealthService(checks: HealthChecks, options: { timeoutMs?: number; cacheMs?: number; onTransition?: (snapshot: HealthSnapshot) => void } = {}) {
  const timeoutMs = options.timeoutMs ?? 3500, cacheMs = options.cacheMs ?? 1000;
  const active = new Map<DependencyName, { result: Promise<DependencyStatus>; timedOut: boolean }>();
  let cached: HealthSnapshot | undefined, cachedUntil = 0, inflight: Promise<HealthSnapshot> | undefined, signature = "";
  const run = (name: DependencyName, check: NonNullable<HealthChecks[DependencyName]>) => {
    const prior = active.get(name);
    if (prior) return prior.timedOut ? Promise.resolve("timeout" as const) : prior.result;
    const controller = new AbortController();
    const record = { result: undefined as unknown as Promise<DependencyStatus>, timedOut: false };
    let timer: ReturnType<typeof setTimeout>;
    const work = Promise.resolve().then(() => check(controller.signal)).then<DependencyStatus, DependencyStatus>(() => "ok", () => "error").finally(() => { clearTimeout(timer); active.delete(name); });
    const deadline = new Promise<DependencyStatus>(resolve => { timer = setTimeout(() => { record.timedOut = true; controller.abort(); resolve("timeout"); }, timeoutMs); });
    record.result = Promise.race([work, deadline]); active.set(name, record);
    return record.result;
  };
  return {
    async snapshot(): Promise<HealthSnapshot> {
      if (cached && Date.now() < cachedUntil) return cached;
      if (inflight) return inflight;
      inflight = (async () => {
        const dependencies: HealthSnapshot["dependencies"] = {};
        await Promise.all(names.filter(name => checks[name]).map(async name => { dependencies[name] = await run(name, checks[name]!); }));
        const snapshot: HealthSnapshot = { status: dependencies.database === "ok" && Object.values(dependencies).every(value => value === "ok") ? "ready" : "unavailable", checkedAt: new Date().toISOString(), dependencies };
        const nextSignature = names.map(name => dependencies[name] ?? "off").join(":");
        if (signature !== nextSignature) { signature = nextSignature; options.onTransition?.(snapshot); }
        cached = snapshot; cachedUntil = Date.now() + cacheMs;
        return snapshot;
      })().finally(() => { inflight = undefined; });
      return inflight;
    },
  };
}

export function validHealthBearer(header: unknown, secret: string | undefined): boolean {
  if (!secret || secret.length < 32 || secret.length > 512 || typeof header !== "string" || header.length > 600 || !header.startsWith("Bearer ")) return false;
  const digest = (value: string) => createHash("sha256").update(value).digest();
  return timingSafeEqual(digest(header.slice(7)), digest(secret));
}

function databaseCheck(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!process.env.DATABASE_URL) { reject(new Error("Unavailable")); return; }
    const connection = mysql.createConnection({ uri: process.env.DATABASE_URL, connectTimeout: 1500, multipleStatements: false });
    let finished = false;
    const done = (error?: unknown) => { if (finished) return; finished = true; signal.removeEventListener("abort", abort); connection.destroy(); error ? reject(new Error("Unavailable")) : resolve(); };
    const abort = () => done(new Error("Timeout"));
    signal.addEventListener("abort", abort, { once: true });
    connection.on("error", done);
    if (signal.aborted) { abort(); return; }
    connection.query({ sql: "SELECT 1", timeout: 1500 }, error => done(error));
  });
}

export function pingClamAv(host: string, port: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (!host || !Number.isInteger(port) || port < 1 || port > 65535) { reject(new Error("Unavailable")); return; }
    const socket = createConnection({ host, port });
    let finished = false, response = Buffer.alloc(0);
    const done = (success = false) => { if (finished) return; finished = true; signal.removeEventListener("abort", abort); socket.destroy(); success ? resolve() : reject(new Error("Unavailable")); };
    const abort = () => done(); signal.addEventListener("abort", abort, { once: true });
    socket.setTimeout(1500, abort); socket.once("error", abort); socket.once("close", abort);
    socket.once("connect", () => socket.write("zPING\0"));
    socket.on("data", chunk => { response = Buffer.concat([response, chunk]); if (response.length > 32) { done(); return; } if (response.includes(0)) done(response.equals(Buffer.from("PONG\0"))); });
    if (signal.aborted) abort();
  });
}

async function storageCheck(signal: AbortSignal) {
  const storage = await getConfiguredPrivateStorage();
  // Revalidate every managed provider directory after initialization. One stable
  // health key bounds provider locking metadata; no object is ever created here.
  const head = await storage.headPrivate("health/runtime-readiness");
  if (head.status === "unknown" || (head.status === "found" && !head.private)) throw new Error("Unavailable");
  if (signal.aborted) throw new Error("Timeout");
  const root = process.env.SERS_PRIVATE_STORAGE_DIR!;
  const info = await lstat(root);
  if (!info.isDirectory() || info.isSymbolicLink() || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error("Unavailable");
  const filename = path.join(root, `.health-${randomBytes(16).toString("hex")}`), data = randomBytes(32);
  const file = await open(filename, constants.O_CREAT | constants.O_EXCL | constants.O_RDWR | constants.O_NOFOLLOW, 0o600);
  try {
    await file.write(data, 0, data.length, 0); await file.sync();
    const read = Buffer.alloc(data.length), result = await file.read(read, 0, read.length, 0);
    if (signal.aborted || result.bytesRead !== data.length || !read.equals(data)) throw new Error("Unavailable");
  } finally { await file.close(); await unlink(filename); }
}

export async function checkWorkerHeartbeat(filename: string, now = Date.now()) {
  const file = await open(filename, constants.O_RDONLY | constants.O_NOFOLLOW);
  try {
    const info = await file.stat();
    if (!info.isFile() || info.size > 4096 || (info.mode & 0o077) !== 0 || info.uid !== process.getuid?.()) throw new Error("Unavailable");
    const value = JSON.parse(await file.readFile("utf8"));
    const updatedAt = Date.parse(value.updatedAt);
    if (value.status !== "ok" || !Number.isFinite(updatedAt) || updatedAt > now + 5000 || now - updatedAt > 150_000) throw new Error("Unavailable");
  } finally { await file.close(); }
}

export function runtimeHealthChecks(): HealthChecks {
  const checks: HealthChecks = { database: databaseCheck };
  if (process.env.SERS_PRIVATE_STORAGE_DIR) checks.storage = storageCheck;
  if (process.env.SERS_CLAMAV_HOST || process.env.SERS_UPLOADS_ENABLED === "1") checks.scanner = signal => pingClamAv(process.env.SERS_CLAMAV_HOST ?? "", Number(process.env.SERS_CLAMAV_PORT), signal);
  if (process.env.SERS_WORKER_HEARTBEAT_PATH) checks.worker = () => checkWorkerHeartbeat(process.env.SERS_WORKER_HEARTBEAT_PATH!);
  return checks;
}
