import { deflateSync, inflateSync } from "node:zlib";
import jpeg from "jpeg-js";
import { PNG } from "pngjs";

const signature = Buffer.from("89504e470d0a1a0a", "hex");
const MAX_SOURCE_BYTES = 6 * 1024 * 1024;
const MAX_SOURCE_DIMENSION = 16_000;
const MAX_SOURCE_PIXELS = 8_000_000;
const MAX_INFLATED_SCANLINE_BYTES = 32 * 1024 * 1024;
const MAX_PREVIEW_DIMENSION = 1_600;
const MAX_PREVIEW_PIXELS = 1_000_000;
const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let bit = 0; bit < 8; bit++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
function crc32(data: Buffer) {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i++) crc = crcTable[(crc ^ data[i]) & 255] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function chunk(type: string, data: Buffer) {
  const nameAndData = Buffer.concat([Buffer.from(type, "ascii"), data]);
  const header = Buffer.alloc(4), tail = Buffer.alloc(4);
  header.writeUInt32BE(data.length); tail.writeUInt32BE(crc32(nameAndData));
  return Buffer.concat([header, nameAndData, tail]);
}

type PngSourceBounds = { width: number; height: number; colorType: number; inflatedBytes: number };

/**
 * Validate every PNG chunk before pngjs sees the bytes. pngjs bounds the
 * non-interlaced inflate with maxLength internally, but it allocates from IHDR;
 * therefore dimensions, scanline size, chunk extents, and CRCs must be checked
 * first. Interlaced PNG is rejected because pngjs uses an unbounded inflate path
 * for it.
 */
function validatePngSourceBounds(input: Buffer): PngSourceBounds {
  if (input.length < 33 || input.length > MAX_SOURCE_BYTES || !input.subarray(0, 8).equals(signature)) throw new Error("Invalid inline PNG");
  let offset = 8, count = 0, width = 0, height = 0, colorType = -1, inflatedBytes = 0;
  let header = false, imageData = false, ended = false;
  while (offset < input.length) {
    if (++count > 256 || offset + 12 > input.length) throw new Error("Invalid inline PNG chunks");
    const length = input.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > input.length) throw new Error("Invalid inline PNG chunk length");
    const name = input.toString("ascii", offset + 4, offset + 8);
    const body = input.subarray(offset + 8, end - 4);
    if (crc32(input.subarray(offset + 4, end - 4)) !== input.readUInt32BE(end - 4)) throw new Error("Invalid inline PNG checksum");
    if (ended) throw new Error("Invalid inline PNG trailing data");
    if (name === "IHDR") {
      if (header || count !== 1 || length !== 13) throw new Error("Invalid inline PNG header");
      header = true;
      width = body.readUInt32BE(0); height = body.readUInt32BE(4);
      const bitDepth = body[8]; colorType = body[9]; const interlace = body[12];
      const channels = ({ 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 } as Record<number, number>)[colorType];
      if (!width || !height || width > MAX_SOURCE_DIMENSION || height > MAX_SOURCE_DIMENSION
        || width * height > MAX_SOURCE_PIXELS || bitDepth !== 8 || channels === undefined
        || body[10] !== 0 || body[11] !== 0 || interlace !== 0) throw new Error("Unsupported inline PNG dimensions or encoding");
      const rowBytes = width * channels + 1;
      inflatedBytes = rowBytes * height;
      if (!Number.isSafeInteger(inflatedBytes) || inflatedBytes > MAX_INFLATED_SCANLINE_BYTES) throw new Error("Inline PNG inflate limit exceeded");
    } else {
      if (!header) throw new Error("Missing inline PNG header");
      if (name === "IDAT") imageData = imageData || length > 0;
      else if (name === "IEND") {
        if (length || !imageData || end !== input.length) throw new Error("Invalid inline PNG end");
        ended = true;
      } else if (/^[A-Z]/.test(name) && !["PLTE", "tRNS"].includes(name)) {
        throw new Error("Unsupported inline PNG format");
      }
    }
    offset = end;
  }
  if (!header || !imageData || !ended) throw new Error("Incomplete inline PNG");
  return { width, height, colorType, inflatedBytes };
}

function resizeRgba(data: Buffer, sourceWidth: number, sourceHeight: number) {
  const scale = Math.min(1, MAX_PREVIEW_DIMENSION / sourceWidth, MAX_PREVIEW_DIMENSION / sourceHeight,
    Math.sqrt(MAX_PREVIEW_PIXELS / (sourceWidth * sourceHeight)));
  const width = Math.max(1, Math.floor(sourceWidth * scale));
  const height = Math.max(1, Math.floor(sourceHeight * scale));
  if (width === sourceWidth && height === sourceHeight) return { data, width, height };
  const output = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    const sourceY = Math.min(sourceHeight - 1, Math.floor(y * sourceHeight / height));
    for (let x = 0; x < width; x++) {
      const sourceX = Math.min(sourceWidth - 1, Math.floor(x * sourceWidth / width));
      const sourceOffset = (sourceY * sourceWidth + sourceX) * 4;
      const outputOffset = (y * width + x) * 4;
      output[outputOffset] = data[sourceOffset];
      output[outputOffset + 1] = data[sourceOffset + 1];
      output[outputOffset + 2] = data[sourceOffset + 2];
      output[outputOffset + 3] = data[sourceOffset + 3];
    }
  }
  return { data: output, width, height };
}

/** A deliberately small, bounded inline preview format. Parse and reconstruct a
 * static 8-bit RGBA PNG, discarding metadata/extra chunks; never dereference URLs.
 * This does not authorize an original Asset or replace its malware scan. */
export function sanitizeInlinePng(base64: string) {
  if (base64.length > 1_400_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("Invalid inline PNG");
  const input = Buffer.from(base64, "base64");
  if (input.toString("base64") !== base64) throw new Error("Invalid inline PNG");
  const bounds = validatePngSourceBounds(input);
  if (bounds.colorType !== 6 || bounds.width > MAX_PREVIEW_DIMENSION || bounds.height > MAX_PREVIEW_DIMENSION || bounds.width * bounds.height > MAX_PREVIEW_PIXELS) throw new Error("Unsupported inline PNG dimensions or encoding");
  const pixels = inflateSync(Buffer.concat(readIdatChunks(input)), { maxOutputLength: bounds.inflatedBytes });
  if (pixels.length !== bounds.inflatedBytes) throw new Error("Invalid inline PNG pixels");
  for (let y = 0; y < bounds.height; y++) if (pixels[y * (bounds.width * 4 + 1)] > 4) throw new Error("Invalid inline PNG filter");
  return { bytes: Buffer.concat([signature, chunk("IHDR", input.subarray(16, 29)), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]), width: bounds.width, height: bounds.height };
}

function readIdatChunks(input: Buffer): Buffer[] {
  const chunks: Buffer[] = [];
  let offset = 8;
  while (offset < input.length) {
    const length = input.readUInt32BE(offset), name = input.toString("ascii", offset + 4, offset + 8);
    if (name === "IDAT") chunks.push(input.subarray(offset + 8, offset + 8 + length));
    offset += 12 + length;
  }
  return chunks;
}

/** Decode an already scanned private image and produce a bounded, metadata-free
 * PNG preview. This function never accepts URLs and never replaces the source
 * object; the immutable version stores both its source identity and this copy.
 */
export function sanitizeEvidenceImage(input: Uint8Array, mimeType: string) {
  const bytes = Buffer.from(input);
  if (bytes.length < 1 || bytes.length > MAX_SOURCE_BYTES) throw new Error("Evidence image exceeds the preview limit");
  let decoded: { width: number; height: number; data: Buffer };
  if (mimeType === "image/png") {
    const bounds = validatePngSourceBounds(bytes);
    const parsed = PNG.sync.read(bytes, { checkCRC: true });
    if (parsed.width !== bounds.width || parsed.height !== bounds.height) throw new Error("Invalid PNG dimensions");
    decoded = { width: parsed.width, height: parsed.height, data: Buffer.from(parsed.data) };
  } else if (mimeType === "image/jpeg") {
    const parsed = jpeg.decode(bytes, { useTArray: true, maxMemoryUsageInMB: 64, maxResolutionInMP: 8 });
    decoded = { width: parsed.width, height: parsed.height, data: Buffer.from(parsed.data) };
  } else {
    throw new Error("Unsupported evidence image type");
  }
  if (!Number.isSafeInteger(decoded.width) || !Number.isSafeInteger(decoded.height) || decoded.width < 1 || decoded.height < 1
    || decoded.width > MAX_SOURCE_DIMENSION || decoded.height > MAX_SOURCE_DIMENSION || decoded.width * decoded.height > MAX_SOURCE_PIXELS
    || decoded.data.length !== decoded.width * decoded.height * 4) throw new Error("Evidence image dimensions exceed the preview limit");
  const preview = resizeRgba(decoded.data, decoded.width, decoded.height);
  const output = new PNG({ width: preview.width, height: preview.height });
  output.data = preview.data;
  return { bytes: PNG.sync.write(output, { colorType: 6, inputColorType: 6 }), width: preview.width, height: preview.height };
}
