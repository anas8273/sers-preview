import { describe, expect, it } from "vitest";
import { validateUpload } from "./upload-validation";
const png = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a2ioAAAAASUVORK5CYII=";
const input = { fileName: "شاهد.png", mimeType: "image/png", base64Data: png };

describe("upload admission", () => {
  it("uses content to choose storage type even with an untrusted extension", () => {
    expect(validateUpload({ ...input, fileName: "payload.html" })).toMatchObject({ mimeType: "image/png", extension: "png" });
    expect(validateUpload({ ...input, mimeType: "application/octet-stream" }).mimeType).toBe("image/png");
  });
  it.each(["", "eA", "eA==\n", "!!!!", "e===", "Zh==", "data:image/png;base64," + png])("rejects invalid or noncanonical Base64 %s", base64Data => {
    expect(() => validateUpload({ ...input, base64Data })).toThrow();
  });
  it("checks exact decoded size including same-length padded encodings", () => {
    const size = Buffer.from(png, "base64").length;
    expect(validateUpload(input, { maxBytes: size }).buffer.length).toBe(size);
    expect(() => validateUpload(input, { maxBytes: size - 1 })).toThrow();
    const overflow = Buffer.concat([Buffer.from(png, "base64"), Buffer.from([0])]).toString("base64");
    expect(() => validateUpload({ ...input, base64Data: overflow }, { maxBytes: size })).toThrow();
  });
  it.each(["../a.png", "a\\b.png", "a:b.png", "a\u0000.png", " ", "a".repeat(256)])("rejects unsafe names", fileName => {
    expect(() => validateUpload({ ...input, fileName })).toThrow();
  });
  it("rejects active text disguised as an image and MIME mismatch", () => {
    expect(() => validateUpload({ ...input, base64Data: Buffer.from('<svg onload="alert(1)"/>').toString("base64") })).toThrow();
    expect(() => validateUpload({ ...input, mimeType: "image/jpeg" })).toThrow();
  });
  it("rejects high-bit bytes that only resemble ASCII signatures after masking", () => {
    const fake = Buffer.alloc(16);
    Buffer.from([0xd2, 0xc9, 0xc6, 0xc6]).copy(fake, 0);
    Buffer.from([0xd7, 0xc5, 0xc2, 0xd0]).copy(fake, 8);
    expect(() => validateUpload({ ...input, mimeType: "image/webp", base64Data: fake.toString("base64") })).toThrow();
  });
  it("restricts template uploads to raster images", () => {
    const pdf = { fileName: "proof.pdf", mimeType: "application/pdf", base64Data: Buffer.from("%PDF-1.7\nfixture\n%%EOF").toString("base64") };
    expect(validateUpload(pdf).extension).toBe("pdf");
    expect(() => validateUpload(pdf, { imagesOnly: true })).toThrow();
  });
  it("recognizes browser JPEG and WebM header families without trusting original names", () => {
    expect(validateUpload({ fileName: "original.png", mimeType: "image/jpeg", base64Data: Buffer.from([255,216,255,224]).toString("base64") }).extension).toBe("jpg");
    const webm = Buffer.concat([Buffer.from("1a45dfa3", "hex"), Buffer.from("fixture-webm-header")]);
    expect(validateUpload({ fileName: "original.mp4", mimeType: "video/webm;codecs=vp9", base64Data: webm.toString("base64") }).extension).toBe("webm");
  });
});
