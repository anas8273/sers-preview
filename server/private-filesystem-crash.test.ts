import { createHash } from "node:crypto";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";

const fault = vi.hoisted(() => ({ stage: "" }));
vi.mock("node:child_process", async importOriginal => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  return { ...actual, execFile: (...parameters: any[]) => {
    const [file, args] = parameters;
    if (file === "/usr/bin/flock" && fault.stage) {
      const program = args.indexOf("-e") + 1, copy = [...args];
      const kill = "process.kill(process.pid,'SIGKILL');";
      const stages: Record<string, [string, string]> = {
        prepared: ["await write(at('blobs',prep.version),bytes);", `${kill}await write(at('blobs',prep.version),bytes);`],
        partial: ["await write(at('blobs',prep.version),bytes);", `await write(at('blobs',prep.version),bytes.subarray(0,3));${kill}`],
        complete: ["await sync('blobs');await publish(prep);", `await sync('blobs');${kill}await publish(prep);`],
        retired: ["await fs.unlink(at('blobs',version))", `${kill}await fs.unlink(at('blobs',version))`],
      };
      const [needle, injected] = stages[fault.stage]; fault.stage = "";
      if (!copy[program].includes(needle)) throw new Error("Crash injection point no longer exists");
      copy[program] = copy[program].replace(needle, injected);
      parameters[1] = copy;
    }
    // The real flock + writer are executed and the writer is actually SIGKILLed.
    // No production fault hook or fake filesystem is involved.
    return (actual.execFile as (...args: any[]) => unknown)(...parameters);
  } };
});

import { createPrivateFilesystemStorage } from "./private-filesystem-storage";

const folders: string[] = [];
const digest = (value: Uint8Array) => createHash("sha256").update(value).digest("hex");
afterEach(async () => { fault.stage = ""; await Promise.all(folders.splice(0).map(folder => rm(folder, { recursive: true, force: true }))); });
async function setup() {
  const rootDirectory = await mkdtemp(path.join(tmpdir(), "sers-killed-writer-")); folders.push(rootDirectory);
  const provider = await createPrivateFilesystemStorage({ rootDirectory });
  const bytes = Buffer.from("durable intended private payload");
  return { rootDirectory, provider, request: { key: "q/crash-test", bytes, sha256: digest(bytes) } };
}

describe("real writer process crash recovery", () => {
  it.each(["prepared", "partial"])("cleans exact private preparation after SIGKILL at %s stage", async stage => {
    const { rootDirectory, provider, request } = await setup();
    fault.stage = stage;
    expect(await provider.putPrivateIfAbsent(request)).toEqual({ status: "unknown" });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await restarted.headPrivate(request.key)).toEqual({ status: "unknown" });
    const prep = await restarted.inspectPrivatePreparation!(request.key);
    expect(prep).toMatchObject({ status: "prepared", bytes: request.bytes.length, sha256: request.sha256 });
    if (prep.status !== "prepared") throw new Error("Preparation identity was lost");
    expect(await restarted.deletePrivateIfVersion(request.key, prep.version)).toEqual({ status: "deleted" });
    expect(await restarted.putPrivateIfAbsent(request)).toEqual({ status: "exists" });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toEqual([]);
    expect(await restarted.headPrivate(request.key)).toEqual({ status: "missing" });
  });

  it("recovers exact complete bytes after SIGKILL before publication", async () => {
    const { rootDirectory, provider, request } = await setup();
    fault.stage = "complete";
    expect(await provider.putPrivateIfAbsent(request)).toEqual({ status: "unknown" });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    const prep = await restarted.inspectPrivatePreparation!(request.key);
    if (prep.status !== "prepared") throw new Error("Preparation identity was lost");
    expect(await restarted.headPrivate(request.key)).toEqual({ status: "found", version: prep.version, bytes: request.bytes.length, sha256: request.sha256, private: true });
    expect(await restarted.readPrivate(request.key, prep.version, 100)).toEqual({ status: "found", bytes: request.bytes });
  });

  it("keeps a crash-retired object inaccessible and finishes deleting its bytes on retry", async () => {
    const { rootDirectory, provider, request } = await setup();
    const receipt = await provider.putPrivateIfAbsent(request);
    if (receipt.status !== "created") throw new Error("No receipt");
    fault.stage = "retired";
    expect(await provider.deletePrivateIfVersion(request.key, receipt.version)).toEqual({ status: "unknown" });
    const restarted = await createPrivateFilesystemStorage({ rootDirectory });
    expect(await restarted.headPrivate(request.key)).toEqual({ status: "missing" });
    expect(await restarted.readPrivate(request.key, receipt.version, 100)).toEqual({ status: "missing" });
    expect(await readFile(path.join(rootDirectory, "blobs", receipt.version))).toEqual(request.bytes);
    expect(await restarted.deletePrivateIfVersion(request.key, receipt.version)).toEqual({ status: "deleted" });
    expect(await readdir(path.join(rootDirectory, "blobs"))).toEqual([]);
    expect(await restarted.putPrivateIfAbsent(request)).toEqual({ status: "exists" });
  });
});
