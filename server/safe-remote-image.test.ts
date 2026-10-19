import { describe, expect, it } from "vitest";
import {
  assertAllowedImagePayload,
  isPublicIpAddress,
  RemoteImageError,
  validateRemoteImageUrl,
} from "./safe-remote-image";

describe("remote image URL policy", () => {
  it("accepts ordinary HTTP and HTTPS URLs on standard ports", () => {
    expect(validateRemoteImageUrl("https://images.example.com/logo.png").protocol).toBe("https:");
    expect(validateRemoteImageUrl("http://images.example.com:80/logo.png").port).toBe("");
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
    const redirected = validateRemoteImageUrl("/next.png", new URL("https://example.com/a/current.png"));
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

  it.each(["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111"])("accepts public address %s", address => {
    expect(isPublicIpAddress(address)).toBe(true);
  });
});

describe("remote image payload policy", () => {
  const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00]);
  const jpeg = Buffer.from([0xff, 0xd8, 0xff, 0x00]);
  const gif = Buffer.from("GIF89a-content", "ascii");
  const webp = Buffer.concat([Buffer.from("RIFF", "ascii"), Buffer.alloc(4), Buffer.from("WEBP", "ascii")]);

  it("accepts signatures matching allowed raster content types", () => {
    expect(assertAllowedImagePayload("image/png", png)).toBe("image/png");
    expect(assertAllowedImagePayload("image/jpeg; charset=binary", jpeg)).toBe("image/jpeg");
    expect(assertAllowedImagePayload("image/gif", gif)).toBe("image/gif");
    expect(assertAllowedImagePayload("image/webp", webp)).toBe("image/webp");
  });

  it("rejects SVG, HTML, and content-type/signature mismatches", () => {
    expect(() => assertAllowedImagePayload("image/svg+xml", Buffer.from("<svg/>"))).toThrow(RemoteImageError);
    expect(() => assertAllowedImagePayload("text/html", Buffer.from("<html/>"))).toThrow(RemoteImageError);
    expect(() => assertAllowedImagePayload("image/png", jpeg)).toThrow(RemoteImageError);
  });
});
