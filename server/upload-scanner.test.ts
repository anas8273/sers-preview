import { createHash } from "node:crypto";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const daemon = vi.hoisted(() => ({ mode: "clean", streams: [] as Buffer[], connects: 0 }));
vi.mock("node:net", async () => {
  const { EventEmitter } = await import("node:events");
  class FakeSocket extends EventEmitter {
    destroyed = false;
    command = "";
    pending = Buffer.alloc(0);
    parts: Buffer[] = [];
    reply(value: string | Buffer) { setImmediate(() => { if (!this.destroyed) this.emit("data", Buffer.isBuffer(value) ? value : Buffer.from(value)); }); }
    destroy() { this.destroyed = true; return this; }
    write(value: Uint8Array, callback: (error?: Error) => void) {
      this.pending = Buffer.concat([this.pending, Buffer.from(value)]);
      queueMicrotask(() => callback());
      if (!this.command) {
        const end = this.pending.indexOf(0);
        if (end < 0) return true;
        this.command = this.pending.subarray(0, end).toString("ascii");
        this.pending = this.pending.subarray(end + 1);
        if (this.command === "zVERSION") {
          if (daemon.mode === "bad-version") this.reply("something else\0");
          else if (daemon.mode === "offline") setImmediate(() => this.emit("error", new Error("ECONNREFUSED")));
          else this.reply("ClamAV 1.4.2/27300/Mon Jan 1 00:00:00 2026\0");
          return true;
        }
        if (this.command !== "zINSTREAM") throw new Error("Unexpected command");
        // A false clean response before even one body chunk must never count.
        if (daemon.mode === "early-ok") this.emit("data", Buffer.from("stream: OK\0"));
      }
      while (this.command === "zINSTREAM" && this.pending.length >= 4) {
        const length = this.pending.readUInt32BE(0);
        if (this.pending.length < length + 4) break;
        this.parts.push(this.pending.subarray(4, length + 4));
        this.pending = this.pending.subarray(length + 4);
        if (!length) {
          daemon.streams.push(Buffer.concat(this.parts));
          if (daemon.mode === "found") this.reply("stream: Eicar-Test-Signature FOUND\0");
          else if (daemon.mode === "error") this.reply("INSTREAM size limit exceeded. ERROR\0");
          else if (daemon.mode === "multiple") this.reply("stream: OK\0stream: OK\0");
          else if (daemon.mode === "oversized") this.reply(Buffer.alloc(4097, 65));
          else if (daemon.mode === "unterminated") setImmediate(() => { this.emit("data", Buffer.from("stream: OK")); this.emit("close"); });
          else if (daemon.mode !== "timeout") this.reply("stream: OK\0");
          break;
        }
      }
      return true;
    }
  }
  return { createConnection: () => { daemon.connects++; const socket = new FakeSocket(); queueMicrotask(() => socket.emit("connect")); return socket; } };
});

import { createClamAvUploadScanner, hasDisallowedPdfObjects, UPLOAD_SCAN_POLICY_VERSION } from "./upload-scanner";

const scanner = () => createClamAvUploadScanner({ host: "private-clamd", port: 3310, timeoutMs: 2_000 });
const text = (bytes: Uint8Array = Buffer.from("دليل خاص\nPrivate evidence")) => ({ bytes, fileName: "evidence.txt", declaredMimeType: "text/plain" });
beforeEach(() => { daemon.mode = "clean"; daemon.streams.length = 0; daemon.connects = 0; });

describe("fail-closed upload scanner", () => {
  it("binds a clean receipt to every immutable byte, detected type, policy and daemon signature version", async () => {
    const bytes = Buffer.from("a".repeat(140_000)), original = Buffer.from(bytes);
    const pending = scanner().scan(text(bytes));
    bytes.fill(98);
    expect(await pending).toEqual({ status: "clean", policyVersion: UPLOAD_SCAN_POLICY_VERSION, sha256: createHash("sha256").update(original).digest("hex"), bytes: original.length, mimeType: "text/plain", engineVersion: "ClamAV 1.4.2/27300/Mon Jan 1 00:00:00 2026" });
    expect(daemon.streams).toEqual([original]);
  });

  it("rejects malware reported by ClamAV", async () => {
    daemon.mode = "found";
    expect(await scanner().scan(text())).toMatchObject({ status: "rejected", reason: "malware_detected" });
  });

  it.each(["early-ok", "offline", "error", "multiple", "oversized", "unterminated", "bad-version"])("never accepts %s as proof of a full clean scan", async mode => {
    daemon.mode = mode;
    expect(await scanner().scan(text())).toMatchObject({ status: "unknown" });
  });

  it("has a bounded timeout and honors caller cancellation", async () => {
    daemon.mode = "timeout";
    expect(await createClamAvUploadScanner({ host: "private-clamd", port: 3310, timeoutMs: 100 }).scan(text())).toMatchObject({ status: "unknown" });
    const controller = new AbortController(); controller.abort();
    expect(await scanner().scan({ ...text(), signal: controller.signal })).toMatchObject({ status: "unknown" });
  });

  it.each([
    { bytes: Buffer.from("PK\x03\x04fake office container"), fileName: "report.docx", declaredMimeType: "application/vnd.openxmlformats-officedocument.wordprocessingml.document" },
    { bytes: Buffer.from("\0\0\0\x18ftypmp42"), fileName: "clip.mp4", declaredMimeType: "video/mp4" },
    { bytes: Buffer.from([0xff, 0xfe, 0x00]), fileName: "binary.txt", declaredMimeType: "text/plain" },
    { bytes: Buffer.from("plain"), fileName: "evidence.txt", declaredMimeType: "image/png" },
    { bytes: Buffer.from("plain"), fileName: "../evidence.txt", declaredMimeType: "text/plain" },
  ])("rejects unsupported or mismatched content before scanning ($fileName)", async input => {
    expect(await scanner().scan(input)).toMatchObject({ status: "rejected" });
    expect(daemon.connects).toBe(0);
  });

  it("decodes real PNG/JPEG pixels and rejects corrupt or oversized image headers", async () => {
    const png = new PNG({ width: 2, height: 2 }); png.data.fill(255);
    const pngBytes = PNG.sync.write(png);
    expect(await scanner().scan({ bytes: pngBytes, fileName: "evidence.png", declaredMimeType: "image/png" })).toMatchObject({ status: "clean", mimeType: "image/png" });
    const jpegBytes = jpeg.encode({ data: png.data, width: 2, height: 2 }, 80).data;
    expect(await scanner().scan({ bytes: jpegBytes, fileName: "evidence.jpg", declaredMimeType: "image/jpeg" })).toMatchObject({ status: "clean", mimeType: "image/jpeg" });
    const huge = Buffer.from(pngBytes); huge.writeUInt32BE(100_000, 16);
    expect(await scanner().scan({ bytes: huge, fileName: "huge.png", declaredMimeType: "image/png" })).toMatchObject({ status: "rejected", reason: "invalid_image" });
    expect(await scanner().scan({ bytes: jpegBytes.subarray(0, 50), fileName: "truncated.jpg", declaredMimeType: "image/jpeg" })).toMatchObject({ status: "rejected", reason: "invalid_image" });
  });

  it("does not replace an unavailable PDF parser with a magic-byte success", async () => {
    const result = await createClamAvUploadScanner({ host: "private-clamd", port: 3310, qpdfPath: "/nonexistent/sers-qpdf", timeoutMs: 2_000 }).scan({ bytes: Buffer.from("%PDF-1.7\nfake pdf"), fileName: "evidence.pdf", declaredMimeType: "application/pdf" });
    expect(result).toMatchObject({ status: "unknown" });
    expect(daemon.connects).toBe(0);
  });

  it("rejects active or embedded PDF objects anywhere in parsed objects", () => {
    expect(hasDisallowedPdfObjects({ "obj:4 0 R": { value: { "/Names": { "/JavaScript": [] } } } })).toBe(true);
    expect(hasDisallowedPdfObjects({ "obj:7 0 R": { stream: { dict: { "/Type": "/EmbeddedFile" } } } })).toBe(true);
    expect(hasDisallowedPdfObjects({ "obj:2 0 R": { value: { "/Type": "/Pages", "/Count": 1 } } })).toBe(false);
  });
});
