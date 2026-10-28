import { deflateSync, inflateSync } from "node:zlib";

const signature = Buffer.from("89504e470d0a1a0a", "hex");
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

/** A deliberately small, bounded inline preview format. Parse and reconstruct a
 * static 8-bit RGBA PNG, discarding metadata/extra chunks; never dereference URLs.
 * This does not authorize an original Asset or replace its malware scan. */
export function sanitizeInlinePng(base64: string) {
  if (base64.length > 1_400_000 || !/^[A-Za-z0-9+/]*={0,2}$/.test(base64)) throw new Error("Invalid inline PNG");
  const input = Buffer.from(base64, "base64");
  if (input.toString("base64") !== base64 || input.length > 1024 * 1024 || !input.subarray(0, 8).equals(signature)) throw new Error("Invalid inline PNG");
  let offset = 8, count = 0, header: Buffer | undefined, ended = false;
  const compressed: Buffer[] = [];
  while (offset < input.length) {
    if (++count > 64 || offset + 12 > input.length) throw new Error("Invalid inline PNG chunks");
    const length = input.readUInt32BE(offset), end = offset + 12 + length;
    if (end > input.length) throw new Error("Invalid inline PNG chunk length");
    const name = input.toString("ascii", offset + 4, offset + 8);
    const body = input.subarray(offset + 8, end - 4);
    if (crc32(input.subarray(offset + 4, end - 4)) !== input.readUInt32BE(end - 4)) throw new Error("Invalid inline PNG checksum");
    if (name === "IHDR") {
      if (count !== 1 || length !== 13) throw new Error("Invalid inline PNG header");
      header = Buffer.from(body);
    } else if (!header) throw new Error("Missing inline PNG header");
    else if (name === "IDAT") compressed.push(body);
    else if (name === "IEND") {
      if (length || end !== input.length || !compressed.length) throw new Error("Invalid inline PNG end");
      ended = true;
    } else if (["acTL", "fcTL", "fdAT"].includes(name) || /^[A-Z]/.test(name)) throw new Error("Unsupported inline PNG format");
    offset = end;
  }
  if (!header || !ended) throw new Error("Incomplete inline PNG");
  const width = header.readUInt32BE(0), height = header.readUInt32BE(4);
  if (!width || !height || width > 1600 || height > 1600 || width * height > 1_000_000 || header[8] !== 8 || header[9] !== 6 || header[10] || header[11] || header[12]) throw new Error("Unsupported inline PNG dimensions or encoding");
  const stride = width * 4 + 1, expected = stride * height;
  const pixels = inflateSync(Buffer.concat(compressed), { maxOutputLength: expected });
  if (pixels.length !== expected) throw new Error("Invalid inline PNG pixels");
  for (let y = 0; y < height; y++) if (pixels[y * stride] > 4) throw new Error("Invalid inline PNG filter");
  return { bytes: Buffer.concat([signature, chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]), width, height };
}
