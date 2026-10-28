import { Worker } from "node:worker_threads";
import { AIProviderError } from "./ai-provider-policy";

export const AI_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
export const AI_MAX_IMAGE_DATA_URL_CHARS = 8_500_000;
const PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

function inspectImageDataUrl(value: unknown) {
  if (typeof value !== "string" || value.length > AI_MAX_IMAGE_DATA_URL_CHARS) throw new AIProviderError("invalid_request");
  const match = /^data:(image\/(?:png|jpeg));base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match) throw new AIProviderError("invalid_request");
  const base64 = match[2], padding = base64.endsWith("==") ? 2 : base64.endsWith("=") ? 1 : 0;
  const byteLength = base64.length / 4 * 3 - padding;
  const last = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/".indexOf(base64[base64.length - padding - 1]);
  if (base64.length % 4 || byteLength <= 0 || byteLength > AI_MAX_IMAGE_BYTES || (padding === 2 && last % 16 !== 0) || (padding === 1 && last % 4 !== 0)) throw new AIProviderError("invalid_request");
  // Route validation allocates only this tiny prefix; full base64 decoding and
  // pixel work happen later, after durable request admission.
  const prefix = Buffer.from(base64.slice(0, 12), "base64");
  if (match[1] === "image/png" ? !prefix.subarray(0, 8).equals(PNG_SIGNATURE) : !prefix.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) throw new AIProviderError("invalid_request");
  return { base64, mime: match[1] };
}

/** Cheap route admission only. Pixel decoding is always required before provider I/O. */
export function validateAiImageDataUrl(value: unknown): boolean {
  try { inspectImageDataUrl(value); return true; } catch { return false; }
}

// Decode and fresh PNG encoding run outside the application event loop. PNG
// interlacing is rejected because pngjs does not bound interlaced inflation.
const IMAGE_WORKER = `
const { parentPort, workerData } = require('node:worker_threads');
try {
  const bytes = Buffer.from(workerData.bytes);
  const { PNG } = require('pngjs');
  let decoded;
  if (workerData.mime === 'image/png') {
    if (bytes.length < 33 || bytes.toString('ascii', 12, 16) !== 'IHDR' || bytes.readUInt32BE(8) !== 13 || bytes[24] !== 8 || bytes[28] !== 0) throw Error();
    const w = bytes.readUInt32BE(16), h = bytes.readUInt32BE(20);
    if (!w || !h || w > 16000 || h > 16000 || w * h > 8000000) throw Error();
    let offset = 8, chunks = 0, ended = false;
    while (offset < bytes.length) {
      if (++chunks > 512 || offset + 12 > bytes.length) throw Error();
      const length = bytes.readUInt32BE(offset), end = offset + 12 + length;
      if (end > bytes.length) throw Error();
      const name = bytes.toString('ascii', offset + 4, offset + 8);
      if (['acTL', 'fcTL', 'fdAT'].includes(name)) throw Error();
      if (name === 'IEND') { if (length !== 0 || end !== bytes.length) throw Error(); ended = true; }
      offset = end;
    }
    if (!ended) throw Error();
    decoded = PNG.sync.read(bytes, { checkCRC: true });
  } else {
    decoded = require('jpeg-js').decode(bytes, { useTArray: true, formatAsRGBA: true, tolerantDecoding: false, maxResolutionInMP: 8, maxMemoryUsageInMB: 128 });
  }
  if (!decoded.width || !decoded.height || decoded.width * decoded.height > 8000000 || decoded.data.length !== decoded.width * decoded.height * 4) throw Error();
  // Only raster pixels and dimensions survive. EXIF, comments, profiles and
  // ancillary source chunks are never forwarded to the provider.
  const output = PNG.sync.write({ width: decoded.width, height: decoded.height, data: decoded.data }, { colorType: 6, inputColorType: 6, bitDepth: 8 });
  if (output.length > workerData.maxBytes) throw Error();
  parentPort.postMessage({ ok: true, bytes: output });
} catch { parentPort.postMessage({ ok: false }); }
`;

/** Shared bounded raster conversion for callers that already own image bytes. */
export async function normalizeAiImageBytes(bytes: Buffer, mime: string, signal: AbortSignal): Promise<Buffer> {
  if (!Buffer.isBuffer(bytes) || !bytes.length || bytes.length > AI_MAX_IMAGE_BYTES || !["image/png", "image/jpeg"].includes(mime)) throw new AIProviderError("invalid_request");
  if (mime === "image/png" ? !bytes.subarray(0, 8).equals(PNG_SIGNATURE) : !bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))) throw new AIProviderError("invalid_request");
  if (signal.aborted) throw new AIProviderError("timeout");
  return new Promise((resolve, reject) => {
    const worker = new Worker(IMAGE_WORKER, { eval: true, workerData: { bytes, mime, maxBytes: AI_MAX_IMAGE_BYTES }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 } });
    let settled = false;
    const finish = (error?: AIProviderError, bytes?: Uint8Array) => {
      if (settled) return;
      settled = true; clearTimeout(timer); signal.removeEventListener("abort", abort);
      // Keep the caller's admission slot until CPU work has actually stopped.
      void worker.terminate().then(() => {
        if (error || !bytes) reject(error ?? new AIProviderError("invalid_request"));
        else resolve(Buffer.from(bytes));
      }, () => reject(new AIProviderError("invalid_request")));
    };
    const abort = () => finish(new AIProviderError("timeout"));
    const timer = setTimeout(() => finish(new AIProviderError("invalid_request")), 5000);
    signal.addEventListener("abort", abort, { once: true });
    worker.once("message", result => result?.ok === true && result.bytes instanceof Uint8Array && result.bytes.length <= AI_MAX_IMAGE_BYTES ? finish(undefined, result.bytes) : finish(new AIProviderError("invalid_request")));
    worker.once("error", () => finish(new AIProviderError("invalid_request")));
    worker.once("exit", () => { if (!settled) finish(new AIProviderError("invalid_request")); });
    if (signal.aborted) abort();
  });
}

export async function normalizeAiInlineImage(value: string, signal: AbortSignal): Promise<string> {
  const parsed = inspectImageDataUrl(value);
  const bytes = await normalizeAiImageBytes(Buffer.from(parsed.base64, "base64"), parsed.mime, signal);
  return `data:image/png;base64,${bytes.toString("base64")}`;
}
