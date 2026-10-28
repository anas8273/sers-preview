import { createHash } from "node:crypto";
import { execFile } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { createConnection } from "node:net";
import { Worker } from "node:worker_threads";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";

export const UPLOAD_SCAN_POLICY_VERSION = "sers-files-v1-pdf-png-jpeg-text";
export type UploadScanResult =
  | { status: "clean"; policyVersion: string; sha256: string; bytes: number; mimeType: string; engineVersion: string }
  | { status: "rejected"; policyVersion: string; reason: string }
  | { status: "unknown"; policyVersion: string; reason: string };
export interface UploadScanner {
  readonly policyVersion: string;
  scan(input: { bytes: Uint8Array; fileName: string; declaredMimeType: string; signal?: AbortSignal }): Promise<UploadScanResult>;
}
export interface ClamAvScannerOptions { host: string; port: number; qpdfPath?: string; prlimitPath?: string; timeoutMs?: number }
const failure = (status: "rejected" | "unknown", reason: string): UploadScanResult => ({ status, reason, policyVersion: UPLOAD_SCAN_POLICY_VERSION });
const checksum = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");

/** Only daemon protocol responses count as malware scan results. No fallback to
 * extensions, signatures, an unavailable scanner, or a client-provided digest.
 * TCP must stay on a trusted private network: ClamD has no authentication/TLS.
 * Protocol: https://docs.clamav.net/manual/Usage/ClamdProtocol.html
 */
async function clamdCommand(options: ClamAvScannerOptions, command: "VERSION" | "INSTREAM", bytes: Uint8Array | undefined, signal: AbortSignal): Promise<string> {
  return new Promise((resolve, reject) => {
    const socket = createConnection({ host: options.host, port: options.port });
    let settled = false, response = Buffer.alloc(0), streamComplete = command !== "INSTREAM";
    const finish = (error?: Error, value?: string) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener("abort", abort);
      socket.destroy();
      if (error) reject(error); else resolve(value!);
    };
    const abort = () => finish(new Error("Scanner timed out"));
    signal.addEventListener("abort", abort, { once: true });
    if (signal.aborted) { abort(); return; }
    socket.on("error", error => finish(error));
    socket.on("close", () => { if (!settled) finish(new Error("Incomplete scanner response")); });
    socket.on("data", chunk => {
      if (response.length + chunk.length > 4096) { finish(new Error("Scanner response too large")); return; }
      response = Buffer.concat([response, chunk]);
      const end = response.indexOf(0);
      if (end >= 0) {
        if (end !== response.length - 1) finish(new Error("Multiple scanner responses"));
        else if (!streamComplete) finish(new Error("Premature scanner response"));
        else finish(undefined, response.subarray(0, end).toString("utf8"));
      }
    });
    const write = (chunk: Uint8Array) => new Promise<void>((done, failed) => {
      socket.write(chunk, error => error ? failed(error) : done());
    });
    socket.once("connect", () => {
      void (async () => {
        await write(Buffer.from(`z${command}\0`, "ascii"));
        if (command === "INSTREAM") {
          for (let offset = 0; offset < bytes!.length; offset += 64 * 1024) {
            if (signal.aborted || settled) throw new Error("Scan stopped");
            const part = bytes!.subarray(offset, offset + 64 * 1024), size = Buffer.alloc(4);
            size.writeUInt32BE(part.length);
            await write(size); await write(part);
          }
          await write(Buffer.alloc(4));
          streamComplete = true;
        }
      })().catch(error => finish(error));
    });
  });
}

function detectMime(bytes: Buffer, fileName: string): string | undefined {
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) return "image/png";
  if (bytes.length >= 4 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return "image/jpeg";
  if (bytes.length >= 8 && /^%PDF-[12]\.[0-9]/.test(bytes.toString("ascii", 0, 8))) return "application/pdf";
  if (/\.txt$/i.test(fileName)) {
    try {
      const value = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
      if (!/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/.test(value)) return "text/plain";
    } catch { /* A binary or non-UTF-8 source is not plain text. */ }
  }
  return undefined;
}

// Decode off the request thread, with fixed libraries and bounded raster/memory.
// PNG interlacing is deliberately rejected: pngjs' interlaced inflate is not bounded.
const IMAGE_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
try {
  const bytes = Buffer.from(workerData.bytes);
  let decoded;
  if (workerData.mime === 'image/png') {
    if (bytes.length < 33 || bytes.toString('ascii',12,16) !== 'IHDR' || bytes.readUInt32BE(8)!==13 || bytes[24]!==8 || bytes[28]!==0) throw Error('unsupported png');
    const w=bytes.readUInt32BE(16), h=bytes.readUInt32BE(20);
    if (!w || !h || w*h>8000000 || w>16000 || h>16000) throw Error('raster too large');
    decoded=require('pngjs').PNG.sync.read(bytes,{checkCRC:true});
  } else {
    decoded=require('jpeg-js').decode(bytes,{useTArray:true,formatAsRGBA:true,tolerantDecoding:false,maxResolutionInMP:8,maxMemoryUsageInMB:128});
  }
  if(!decoded.width || !decoded.height || decoded.width*decoded.height>8000000 || decoded.data.length!==decoded.width*decoded.height*4) throw Error('invalid raster');
  parentPort.postMessage({ok:true});
} catch { parentPort.postMessage({ok:false}); }
`;
async function validImage(bytes: Buffer, mime: string, signal: AbortSignal) {
  return new Promise<boolean>((resolve, reject) => {
    const worker = new Worker(IMAGE_WORKER, { eval: true, workerData: { bytes, mime }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } });
    let settled = false;
    const finish = (error?: Error, result = false) => {
      if (settled) return; settled = true;
      signal.removeEventListener("abort", abort);
      void worker.terminate();
      error ? reject(error) : resolve(result);
    };
    const abort = () => finish(new Error("Image parser timed out"));
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", value => finish(undefined, value?.ok === true));
    worker.once("error", error => finish(error));
    worker.once("exit", () => { if (!settled) finish(new Error("Image parser exited")); });
    if (signal.aborted) abort();
  });
}

function runQpdf(options: ClamAvScannerOptions, args: string[], signal: AbortSignal): Promise<{ code: number | string | null; stdout: string; stderr: string }> {
  return new Promise(resolve => {
    // prlimit caps native parser address space, CPU and descriptors. No shell or
    // user-controlled path/option is used. qpdf requires a seekable private file.
    execFile(options.prlimitPath ?? "/usr/bin/prlimit", ["--as=268435456", "--cpu=15", "--nofile=64", "--", options.qpdfPath ?? "/usr/bin/qpdf", ...args],
      { encoding: "utf8", maxBuffer: 2 * 1024 * 1024, timeout: options.timeoutMs ?? 20_000, killSignal: "SIGKILL", signal, env: { ...process.env, LC_ALL: "C" } },
      (error, stdout, stderr) => resolve({ code: error ? (error as NodeJS.ErrnoException & { code?: number | string }).code ?? null : 0, stdout, stderr }));
  });
}
const DISALLOWED_PDF_NAMES = new Set(["/JavaScript", "/JS", "/OpenAction", "/AA", "/Launch", "/EmbeddedFile", "/EmbeddedFiles", "/RichMedia", "/XFA", "/GoToR", "/SubmitForm", "/ImportData"]);
function isInDocumentView(value: unknown, objects: unknown): boolean {
  // PDF 1.7 8.2.1: an OpenAction may be a passive initial-page destination,
  // rather than executable action. Only direct explicit arrays are supported.
  // Named destinations, indirect arrays and action dictionaries stay rejected.
  if (!Array.isArray(value) || value.length < 2 || value.length > 6 || typeof value[0] !== "string" || !/^[1-9][0-9]{0,9} [0-9]{1,5} R$/.test(value[0]) || !objects || typeof objects !== "object") return false;
  const key = `obj:${value[0]}`;
  if (!Object.hasOwn(objects, key)) return false;
  const page = (objects as Record<string, { value?: Record<string, unknown> }>)[key];
  if (!page || page.value?.["/Type"] !== "/Page") return false;
  const number = (item: unknown) => typeof item === "number" && Number.isFinite(item);
  const coordinate = (item: unknown) => item === null || number(item);
  switch (value[1]) {
    case "/Fit": case "/FitB": return value.length === 2;
    case "/FitH": case "/FitV": case "/FitBH": case "/FitBV": return value.length === 3 && coordinate(value[2]);
    case "/FitR": return value.length === 6 && value.slice(2).every(number);
    case "/XYZ": return value.length === 5 && coordinate(value[2]) && coordinate(value[3]) && (value[4] === null || (number(value[4]) && value[4] >= 0));
    default: return false;
  }
}
export function hasDisallowedPdfObjects(value: unknown): boolean {
  const pending: unknown[] = [value]; let count = 0;
  while (pending.length) {
    if (++count > 100_000) return true;
    const current = pending.pop();
    if (typeof current === "string" && DISALLOWED_PDF_NAMES.has(current)) return true;
    if (current && typeof current === "object") {
      for (const [key, child] of Object.entries(current)) {
        if (key === "/OpenAction") { if (!isInDocumentView(child, value)) return true; continue; }
        if (DISALLOWED_PDF_NAMES.has(key)) return true;
        pending.push(child);
      }
    }
  }
  return false;
}
async function validatePdf(bytes: Buffer, options: ClamAvScannerOptions, signal: AbortSignal): Promise<"valid" | "rejected" | "unknown"> {
  const folder = await mkdtemp(path.join(tmpdir(), "sers-scan-"));
  try {
    const input = path.join(folder, "input.pdf");
    await writeFile(input, bytes, { flag: "wx", mode: 0o600 });
    const check = await runQpdf(options, ["--check", input], signal);
    if (check.code !== 0) return check.code === 2 || check.code === 3 ? "rejected" : "unknown";
    const encryption = await runQpdf(options, ["--is-encrypted", input], signal);
    if (encryption.code === 0) return "rejected";
    if (encryption.code !== 2) return "unknown";
    const objects = await runQpdf(options, ["--json=2", "--json-key=qpdf", "--json-stream-data=none", input], signal);
    if (objects.code !== 0) return "unknown";
    try {
      const json = JSON.parse(objects.stdout);
      if (!Array.isArray(json.qpdf) || json.qpdf[0]?.jsonversion !== 2 || !json.qpdf[1] || typeof json.qpdf[1] !== "object") return "unknown";
      return hasDisallowedPdfObjects(json.qpdf[1]) ? "rejected" : "valid";
    } catch { return "unknown"; }
  } finally { await rm(folder, { recursive: true, force: true }); }
}

export function createClamAvUploadScanner(options: ClamAvScannerOptions): UploadScanner {
  if (typeof options.host !== "string" || !options.host || options.host.length > 253 || /[\s/\\\0]/.test(options.host) || !Number.isSafeInteger(options.port) || options.port < 1 || options.port > 65535 || (options.timeoutMs !== undefined && (!Number.isInteger(options.timeoutMs) || options.timeoutMs < 100 || options.timeoutMs > 30_000)) || (options.qpdfPath && !path.isAbsolute(options.qpdfPath)) || (options.prlimitPath && !path.isAbsolute(options.prlimitPath))) throw new Error("Invalid scanner configuration");
  return {
    policyVersion: UPLOAD_SCAN_POLICY_VERSION,
    async scan(input) {
      if (!(input.bytes instanceof Uint8Array) || input.bytes.length < 1 || input.bytes.length > MAX_EVIDENCE_BYTES || typeof input.fileName !== "string" || input.fileName.length > 255 || /[\\/\x00-\x1f\x7f]/.test(input.fileName) || typeof input.declaredMimeType !== "string") return failure("rejected", "invalid_input");
      const bytes = Buffer.from(input.bytes), mimeType = detectMime(bytes, input.fileName);
      if (!mimeType) return failure("rejected", "unsupported_content");
      const declared = input.declaredMimeType.toLowerCase().split(";")[0].trim();
      if (declared && declared !== "application/octet-stream" && declared !== mimeType) return failure("rejected", "mime_mismatch");
      const timeout = AbortSignal.timeout(options.timeoutMs ?? 20_000);
      const signal = input.signal ? AbortSignal.any([input.signal, timeout]) : timeout;
      try {
        if (signal.aborted) return failure("unknown", "scan_unavailable");
        if (mimeType.startsWith("image/") && !await validImage(bytes, mimeType, signal)) return failure("rejected", "invalid_image");
        if (mimeType === "application/pdf") {
          const parsed = await validatePdf(bytes, options, signal);
          if (parsed !== "valid") return failure(parsed, parsed === "rejected" ? "invalid_or_active_pdf" : "pdf_parser_unavailable");
        }
        const engineVersion = await clamdCommand(options, "VERSION", undefined, signal);
        if (!/^ClamAV \d+\.\d+\.\d+\//.test(engineVersion) || engineVersion.length > 255) return failure("unknown", "scanner_version_unavailable");
        const scanned = await clamdCommand(options, "INSTREAM", bytes, signal);
        if (scanned === "stream: OK") return { status: "clean", policyVersion: UPLOAD_SCAN_POLICY_VERSION, sha256: checksum(bytes), bytes: bytes.length, mimeType, engineVersion };
        if (/^stream: .+ FOUND$/.test(scanned)) return failure("rejected", "malware_detected");
        return failure("unknown", "scan_unavailable");
      } catch { return failure("unknown", "scan_unavailable"); }
    },
  };
}
