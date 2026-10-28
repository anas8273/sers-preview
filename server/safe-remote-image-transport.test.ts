import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { EventEmitter } from "node:events";
import http from "node:http";
import https from "node:https";
import { createRequire } from "node:module";
const dns = vi.hoisted(() => ({ lookup: vi.fn() }));
vi.mock("node:dns/promises", () => dns);
import { fetchRemoteImage } from "./safe-remote-image";

const { PNG } = createRequire(import.meta.url)("pngjs");
const validPng: Buffer = PNG.sync.write({
  width: 2,
  height: 2,
  data: Buffer.alloc(16, 255),
});
type ResponseSpec = {
  status?: number;
  headers?: Record<string, string>;
  bytes?: Buffer;
  delay?: number;
  trickle?: boolean;
};
let responses: ResponseSpec[] = [],
  pinned: string[] = [],
  calls: string[] = [],
  destroyed = 0;
const timers = new Set<ReturnType<typeof setTimeout>>();
function mockRequest(options: any, callback: (response: any) => void) {
  calls.push(options.hostname);
  options.lookup(options.hostname, {}, (error: unknown, address: string) => {
    expect(error).toBeNull();
    pinned.push(address);
  });
  const request = new EventEmitter() as any;
  const response = new EventEmitter() as any;
  const spec = responses.shift() ?? { bytes: validPng };
  response.statusCode = spec.status ?? 200;
  response.headers = spec.headers ?? { "content-type": "image/png" };
  let closed = false,
    timer: ReturnType<typeof setTimeout> | undefined;
  const cleanup = () => {
    closed = true;
    if (timer) {
      clearTimeout(timer);
      timers.delete(timer);
    }
  };
  response.destroy = cleanup;
  request.destroy = (error?: Error) => {
    destroyed++;
    cleanup();
    if (error) queueMicrotask(() => request.emit("error", error));
    return request;
  };
  // Deliberately does not fire: trickled data continually defeats an idle timeout.
  request.setTimeout = vi.fn(() => request);
  request.end = () => {
    const send = () => {
      if (closed) return;
      callback(response);
      if (closed) return;
      if (spec.trickle) {
        const tick = () => {
          if (!closed) {
            response.emit("data", Buffer.from([1]));
            timer = setTimeout(tick, 5);
            timers.add(timer);
          }
        };
        tick();
      } else {
        response.emit("data", spec.bytes ?? validPng);
        response.emit("end");
      }
    };
    timer = setTimeout(send, spec.delay ?? 0);
    timers.add(timer);
  };
  return request;
}

beforeEach(() => {
  responses = [];
  pinned = [];
  calls = [];
  destroyed = 0;
  dns.lookup.mockReset().mockResolvedValue([{ address: "8.8.8.8", family: 4 }]);
  vi.spyOn(http, "request").mockImplementation(mockRequest as any);
  vi.spyOn(https, "request").mockImplementation(mockRequest as any);
});
afterEach(() => {
  vi.restoreAllMocks();
  for (const timer of timers) clearTimeout(timer);
  timers.clear();
});

describe("remote image end-to-end fetch budget", () => {
  it("pins the validated public address and returns decoded normalized bytes", async () => {
    const result = await fetchRemoteImage(
      "https://images.example.test/logo.png"
    );
    expect(pinned).toEqual(["8.8.8.8"]);
    expect(result.contentType).toBe("image/png");
    expect(PNG.sync.read(result.buffer).width).toBe(2);
  });

  it("rejects a redirect to loopback and mixed public/private DNS results before connecting", async () => {
    responses = [
      { status: 302, headers: { location: "http://127.0.0.1/private" } },
    ];
    await expect(
      fetchRemoteImage("https://images.example.test/start")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toHaveLength(1);
    dns.lookup.mockResolvedValueOnce([
      { address: "8.8.8.8", family: 4 },
      { address: "10.1.2.3", family: 4 },
    ]);
    await expect(
      fetchRemoteImage("https://mixed.example.test/x")
    ).rejects.toMatchObject({ statusCode: 400 });
    expect(calls).toHaveLength(1);
  });

  it("applies an absolute deadline to DNS and does not start HTTP after late resolution", async () => {
    let finish!: (value: unknown) => void;
    dns.lookup.mockImplementationOnce(
      () =>
        new Promise(resolve => {
          finish = resolve;
        })
    );
    const result = fetchRemoteImage("https://slow-dns.example.test/x", {
      timeoutMs: 30,
    });
    await expect(result).rejects.toMatchObject({ statusCode: 504 });
    finish([{ address: "8.8.8.8", family: 4 }]);
    await new Promise(resolve => setTimeout(resolve, 0));
    expect(calls).toHaveLength(0);
  });

  it("shares one deadline across redirects instead of restarting the clock", async () => {
    responses = Array.from({ length: 3 }, () => ({
      status: 302,
      headers: { location: "/again" },
      delay: 25,
    }));
    await expect(
      fetchRemoteImage("https://redirect.example.test/x", { timeoutMs: 40 })
    ).rejects.toMatchObject({ statusCode: 504 });
    expect(calls.length).toBeLessThanOrEqual(2);
    expect(destroyed).toBeGreaterThan(0);
  });

  it("terminates slow-trickle bodies even though the socket never becomes idle", async () => {
    responses = [{ trickle: true }];
    await expect(
      fetchRemoteImage("https://trickle.example.test/x", { timeoutMs: 30 })
    ).rejects.toMatchObject({ statusCode: 504 });
    expect(destroyed).toBeGreaterThan(0);
  });

  it("rejects advertised and streaming byte excess before raster decoding", async () => {
    responses = [
      { headers: { "content-type": "image/png", "content-length": "1000" } },
    ];
    await expect(
      fetchRemoteImage("https://large.example.test/x", { maxBytes: 100 })
    ).rejects.toMatchObject({ statusCode: 413 });
    responses = [{ bytes: Buffer.alloc(101) }];
    await expect(
      fetchRemoteImage("https://stream.example.test/x", { maxBytes: 100 })
    ).rejects.toMatchObject({ statusCode: 413 });
  });
});
