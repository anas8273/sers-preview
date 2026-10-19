import { lookup } from "node:dns/promises";
import http from "node:http";
import https from "node:https";
import net from "node:net";

const DEFAULT_MAX_BYTES = 8 * 1024 * 1024;
const DEFAULT_TIMEOUT_MS = 8_000;
const DEFAULT_MAX_REDIRECTS = 3;
const ALLOWED_CONTENT_TYPES = new Set(["image/png", "image/jpeg", "image/webp", "image/gif"]);

type ResolvedPublicAddress = { address: string; family: 4 | 6 };

export class RemoteImageError extends Error {
  constructor(message: string, public readonly statusCode = 400) {
    super(message);
    this.name = "RemoteImageError";
  }
}

function isPublicIpv4(address: string) {
  const parts = address.split(".").map(Number);
  if (parts.length !== 4 || parts.some(part => !Number.isInteger(part) || part < 0 || part > 255)) return false;
  const [a, b, c] = parts;
  if (a === 0 || a === 10 || a === 127 || a >= 224) return false;
  if (a === 100 && b >= 64 && b <= 127) return false;
  if (a === 169 && b === 254) return false;
  if (a === 172 && b >= 16 && b <= 31) return false;
  if (a === 192 && b === 168) return false;
  if (a === 192 && b === 0) return false;
  if (a === 192 && b === 0 && c === 2) return false;
  if (a === 198 && (b === 18 || b === 19)) return false;
  if (a === 198 && b === 51 && c === 100) return false;
  if (a === 203 && b === 0 && c === 113) return false;
  return true;
}

function isPublicIpv6(address: string) {
  const normalized = address.toLowerCase();
  if (normalized.startsWith("::ffff:")) return isPublicIpv4(normalized.slice(7));
  if (normalized === "::" || normalized === "::1") return false;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return false;
  if (/^fe[89ab]/.test(normalized)) return false;
  if (normalized.startsWith("ff")) return false;
  if (normalized.startsWith("2001:db8")) return false;
  return true;
}

export function isPublicIpAddress(address: string) {
  const family = net.isIP(address);
  if (family === 4) return isPublicIpv4(address);
  if (family === 6) return isPublicIpv6(address);
  return false;
}

export function validateRemoteImageUrl(value: string, base?: URL) {
  let url: URL;
  try {
    url = base ? new URL(value, base) : new URL(value);
  } catch {
    throw new RemoteImageError("Invalid image URL");
  }
  if (url.protocol !== "https:" && url.protocol !== "http:") {
    throw new RemoteImageError("Only HTTP and HTTPS image URLs are allowed");
  }
  if (url.username || url.password) throw new RemoteImageError("Image URL credentials are not allowed");
  const port = url.port || (url.protocol === "https:" ? "443" : "80");
  if (port !== "80" && port !== "443") throw new RemoteImageError("Non-standard image URL ports are not allowed");
  if (!url.hostname || url.hostname.endsWith(".")) throw new RemoteImageError("Invalid image hostname");
  return url;
}

async function resolvePublicAddress(hostname: string): Promise<ResolvedPublicAddress> {
  const literalFamily = net.isIP(hostname);
  if (literalFamily) {
    if (!isPublicIpAddress(hostname)) throw new RemoteImageError("Private or reserved image address is not allowed");
    return { address: hostname, family: literalFamily === 6 ? 6 : 4 };
  }

  const records = await lookup(hostname, { all: true, verbatim: true });
  if (records.length === 0) throw new RemoteImageError("Image hostname could not be resolved", 502);
  if (records.some(record => !isPublicIpAddress(record.address))) {
    throw new RemoteImageError("Image hostname resolves to a private or reserved address");
  }
  const record = records[0];
  return { address: record.address, family: record.family === 6 ? 6 : 4 };
}

function normalizeContentType(value?: string) {
  return (value || "").split(";", 1)[0].trim().toLowerCase();
}

export function assertAllowedImagePayload(contentTypeHeader: string | undefined, payload: Buffer) {
  const contentType = normalizeContentType(contentTypeHeader);
  if (!ALLOWED_CONTENT_TYPES.has(contentType)) throw new RemoteImageError("Remote resource is not an allowed raster image", 415);

  const isPng = payload.length >= 8 && payload.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
  const isJpeg = payload.length >= 3 && payload[0] === 0xff && payload[1] === 0xd8 && payload[2] === 0xff;
  const signature = payload.subarray(0, 6).toString("ascii");
  const isGif = signature === "GIF87a" || signature === "GIF89a";
  const isWebp = payload.length >= 12 && payload.subarray(0, 4).toString("ascii") === "RIFF" && payload.subarray(8, 12).toString("ascii") === "WEBP";

  const matches = contentType === "image/png" ? isPng
    : contentType === "image/jpeg" ? isJpeg
      : contentType === "image/gif" ? isGif
        : contentType === "image/webp" ? isWebp
          : false;
  if (!matches) throw new RemoteImageError("Remote image signature does not match its content type", 415);
  return contentType;
}

function requestOnce(url: URL, address: string, family: 4 | 6, maxBytes: number, timeoutMs: number) {
  return new Promise<{ statusCode: number; headers: http.IncomingHttpHeaders; body: Buffer }>((resolve, reject) => {
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || undefined,
      path: `${url.pathname}${url.search}`,
      method: "GET",
      headers: {
        Accept: "image/png,image/jpeg,image/webp,image/gif;q=0.9",
        "Accept-Encoding": "identity",
        "User-Agent": "SERS-Image-Proxy/1.0",
      },
      lookup: (_hostname, _options, callback) => callback(null, address, family),
      servername: url.protocol === "https:" ? url.hostname : undefined,
    }, response => {
      const chunks: Buffer[] = [];
      let total = 0;
      response.on("data", chunk => {
        const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
        total += buffer.length;
        if (total > maxBytes) {
          request.destroy(new RemoteImageError("Remote image exceeds the size limit", 413));
          return;
        }
        chunks.push(buffer);
      });
      response.on("end", () => resolve({
        statusCode: response.statusCode || 502,
        headers: response.headers,
        body: Buffer.concat(chunks),
      }));
      response.on("error", reject);
    });
    request.setTimeout(timeoutMs, () => request.destroy(new RemoteImageError("Remote image request timed out", 504)));
    request.on("error", reject);
    request.end();
  });
}

export async function fetchRemoteImage(
  rawUrl: string,
  options?: { maxBytes?: number; timeoutMs?: number; maxRedirects?: number },
) {
  const maxBytes = options?.maxBytes ?? DEFAULT_MAX_BYTES;
  const timeoutMs = options?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const maxRedirects = options?.maxRedirects ?? DEFAULT_MAX_REDIRECTS;
  let url = validateRemoteImageUrl(rawUrl);

  for (let redirect = 0; redirect <= maxRedirects; redirect += 1) {
    const resolved = await resolvePublicAddress(url.hostname);
    const response = await requestOnce(url, resolved.address, resolved.family, maxBytes, timeoutMs);

    if ([301, 302, 303, 307, 308].includes(response.statusCode)) {
      const location = response.headers.location;
      if (!location) throw new RemoteImageError("Remote image redirect is missing a location", 502);
      if (redirect === maxRedirects) throw new RemoteImageError("Remote image exceeded the redirect limit", 508);
      url = validateRemoteImageUrl(location, url);
      continue;
    }

    if (response.statusCode < 200 || response.statusCode >= 300) {
      throw new RemoteImageError("Remote image server returned an error", 502);
    }
    if (response.body.length === 0) throw new RemoteImageError("Remote image is empty", 422);
    const contentType = assertAllowedImagePayload(response.headers["content-type"], response.body);
    return { buffer: response.body, contentType, finalUrl: url.toString() };
  }

  throw new RemoteImageError("Remote image could not be fetched", 502);
}
