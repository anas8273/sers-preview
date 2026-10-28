import { describe, expect, it } from "vitest";
import {
  normalizeRemoteImagePayload,
  isPublicIpAddress,
  RemoteImageError,
  validateRemoteImageUrl,
} from "./safe-remote-image";

describe("remote image URL policy", () => {
  it("accepts ordinary HTTP and HTTPS URLs on standard ports", () => {
    expect(
      validateRemoteImageUrl("https://images.example.com/logo.png").protocol
    ).toBe("https:");
    expect(
      validateRemoteImageUrl("http://images.example.com:80/logo.png").port
    ).toBe("");
  });

  it.each([
    "file:///etc/passwd",
    "ftp://example.com/image.png",
    "https://user:secret@example.com/image.png",
    "https://example.com:8443/image.png",
    "https://example.com./image.png",
  ])("rejects unsafe URL %s", value => {
    expect(() => validateRemoteImageUrl(value)).toThrow(RemoteImageError);
  });

  it("resolves relative redirects against the previous URL", () => {
    const redirected = validateRemoteImageUrl(
      "/next.png",
      new URL("https://example.com/a/current.png")
    );
    expect(redirected.toString()).toBe("https://example.com/next.png");
  });
});

describe("public IP policy", () => {
  it.each([
    "127.0.0.1",
    "10.0.0.1",
    "172.16.0.1",
    "192.168.1.1",
    "169.254.169.254",
    "100.64.0.1",
    "192.0.2.10",
    "198.51.100.10",
    "203.0.113.10",
    "::1",
    "fc00::1",
    "fe80::1",
    "2001:db8::1",
    "::ffff:127.0.0.1",
  ])("rejects private or reserved address %s", address => {
    expect(isPublicIpAddress(address)).toBe(false);
  });

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])(
    "accepts public address %s",
    address => {
      expect(isPublicIpAddress(address)).toBe(true);
    }
  );
});

describe("remote image payload policy", () => {
  it.each([
    [
      "image/png",
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    ],
    ["image/jpeg", Buffer.from([0xff, 0xd8, 0xff])],
    ["image/gif", Buffer.from("GIF89a")],
    ["image/webp", Buffer.from("RIFF0000WEBP")],
    ["image/svg+xml", Buffer.from("<svg/>")],
  ])(
    "rejects corrupt or unsupported %s bytes after real decoding",
    async (mime, bytes) => {
      await expect(
        normalizeRemoteImagePayload(
          mime as string,
          bytes as Buffer,
          new AbortController().signal
        )
      ).rejects.toMatchObject({ statusCode: 415 });
    }
  );

  it("decodes JPEG pixels and returns a fresh PNG without source comments or metadata", async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url);
    const { PNG } = require("pngjs"),
      jpeg = require("jpeg-js");
    const original: Buffer = jpeg.encode(
      { width: 2, height: 2, data: Buffer.alloc(16, 255) },
      90
    ).data;
    const privateComment = Buffer.from(
      "PRIVATE EXIF GPS metadata must not survive"
    );
    const commentLength = privateComment.length + 2;
    const source = Buffer.concat([
      original.subarray(0, 2),
      Buffer.from([255, 254, commentLength >> 8, commentLength & 255]),
      privateComment,
      original.subarray(2),
    ]);
    const output = await normalizeRemoteImagePayload(
      "image/jpeg; charset=binary",
      source,
      new AbortController().signal
    );
    expect(output.contentType).toBe("image/png");
    expect(output.buffer.includes(privateComment)).toBe(false);
    const decoded = PNG.sync.read(output.buffer);
    expect([decoded.width, decoded.height]).toEqual([2, 2]);
    expect(decoded.data).toHaveLength(16);
    await expect(
      normalizeRemoteImagePayload(
        "image/png",
        source,
        new AbortController().signal
      )
    ).rejects.toMatchObject({ statusCode: 415 });
  });

  it("refuses oversized dimensions and cancellation before a worker starts", async () => {
    const { createRequire } = await import("node:module");
    const require = createRequire(import.meta.url),
      { PNG } = require("pngjs");
    const source: Buffer = PNG.sync.write({
      width: 1,
      height: 1,
      data: Buffer.alloc(4, 255),
    });
    // A valid compressed image above 8 MP, rather than a corrupt CRC fixture
    // that a decoder could reject without enforcing the pixel policy.
    const bomb: Buffer = PNG.sync.write({
      width: 3000,
      height: 3000,
      data: Buffer.alloc(3000 * 3000 * 4, 255),
    });
    await expect(
      normalizeRemoteImagePayload(
        "image/png",
        bomb,
        new AbortController().signal
      )
    ).rejects.toMatchObject({ statusCode: 415 });
    const cancelled = new AbortController();
    cancelled.abort();
    await expect(
      normalizeRemoteImagePayload("image/png", source, cancelled.signal)
    ).rejects.toMatchObject({ statusCode: 504 });
  });
});
