import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const processMock = vi.hoisted(() => ({ spawn: vi.fn() }));
vi.mock("node:child_process", () => processMock);
import { pdfPageCount, runPoppler } from "./render-limits";
let child: any;
beforeEach(() => {
  child = new EventEmitter();
  child.stdout = new EventEmitter();
  child.stderr = new EventEmitter();
  child.kill = vi.fn();
  processMock.spawn.mockReset().mockReturnValue(child);
});
afterEach(() => vi.useRealTimers());

describe("bounded native PDF conversion", () => {
  it("kills on cancellation and waits for actual child close before releasing", async () => {
    const controller = new AbortController();
    const result = runPoppler(
      "pdfinfo",
      ["/private/output.pdf"],
      controller.signal
    );
    let settled = false;
    const assertion = expect(
      result.finally(() => {
        settled = true;
      })
    ).rejects.toMatchObject({ statusCode: 504 });
    controller.abort();
    await Promise.resolve();
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    expect(settled).toBe(false);
    child.emit("close", null, "SIGKILL");
    await assertion;
    expect(processMock.spawn.mock.calls[0][0]).toBe("/usr/bin/prlimit");
    expect(processMock.spawn.mock.calls[0][1]).toEqual(
      expect.arrayContaining([
        "--as=536870912",
        "--cpu=20",
        "--nofile=64",
        "--fsize=8388608",
        "pdfinfo",
      ])
    );
  });

  it("kills a parser that exceeds its own deadline or output budget", async () => {
    vi.useFakeTimers();
    const first = runPoppler(
      "pdfinfo",
      ["x.pdf"],
      new AbortController().signal
    );
    const timedOut = expect(first).rejects.toMatchObject({ statusCode: 504 });
    await vi.advanceTimersByTimeAsync(30_000);
    expect(child.kill).toHaveBeenCalledWith("SIGKILL");
    child.emit("close", null);
    await timedOut;
    const second = runPoppler(
      "pdfinfo",
      ["y.pdf"],
      new AbortController().signal
    );
    const tooLarge = expect(second).rejects.toThrow("output limit");
    child.stdout.emit("data", Buffer.alloc(65_537));
    child.emit("close", null);
    await tooLarge;
  });

  it("rejects missing or excessive page counts instead of returning truncated content", () => {
    expect(pdfPageCount("Pages: 16\nEncrypted: no\n", 80)).toBe(16);
    expect(() => pdfPageCount("Pages: 81\n", 80)).toThrow("page limit");
    expect(() => pdfPageCount("Pages: 21\n", 20)).toThrow("page limit");
    expect(() => pdfPageCount("Pages: unknown\n", 80)).toThrow("page count");
  });
});
