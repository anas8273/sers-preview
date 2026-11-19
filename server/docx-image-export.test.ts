import { describe, it, expect } from 'vitest';
import { PNG } from 'pngjs';
import { deflateSync } from 'node:zlib';

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});
function crc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (const byte of bytes) crc = crcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}
function replacePngChunk(png: Buffer, target: string, replacement: Buffer): Buffer {
  const chunks: Buffer[] = [png.subarray(0, 8)];
  let offset = 8;
  while (offset < png.length) {
    const length = png.readUInt32BE(offset);
    const type = png.toString('ascii', offset + 4, offset + 8);
    const body = type === target ? replacement : png.subarray(offset + 8, offset + 8 + length);
    const chunk = Buffer.alloc(12 + body.length);
    chunk.writeUInt32BE(body.length, 0);
    chunk.write(type, 4, 4, 'ascii');
    body.copy(chunk, 8);
    chunk.writeUInt32BE(crc32(chunk.subarray(4, chunk.length - 4)), chunk.length - 4);
    chunks.push(chunk);
    offset += 12 + length;
  }
  return Buffer.concat(chunks);
}
function patchPngHeader(png: Buffer, width: number, height: number): Buffer {
  const header = Buffer.from(png.subarray(16, 29));
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  return replacePngChunk(png, 'IHDR', header);
}
function dataUrl(png: Buffer): string {
  return `data:image/png;base64,${png.toString('base64')}`;
}
function rgbaPng(width = 2, height = 2): Buffer {
  const png = new PNG({ width, height });
  png.data.fill(255);
  return PNG.sync.write(png);
}

describe('DOCX Image Export (renderImageToDocx)', () => {
  it('should have renderImageToDocx function exported', async () => {
    const { renderImageToDocx } = await import('./docx-renderer');
    expect(renderImageToDocx).toBeDefined();
    expect(typeof renderImageToDocx).toBe('function');
  });

  it('should accept base64 image and return a Buffer', async () => {
    const { renderImageToDocx } = await import('./docx-renderer');
    // Create a minimal valid PNG base64 (1x1 pixel transparent)
    const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await renderImageToDocx(minimalPng, 100, 100);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should handle base64 without data URI prefix', async () => {
    const { renderImageToDocx } = await import('./docx-renderer');
    const rawBase64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await renderImageToDocx(rawBase64, 200, 300);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(0);
  });

  it('should produce valid DOCX format (starts with PK zip header)', async () => {
    const { renderImageToDocx } = await import('./docx-renderer');
    const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await renderImageToDocx(minimalPng, 800, 1200);
    // DOCX files are ZIP archives, starting with PK header
    expect(result[0]).toBe(0x50); // P
    expect(result[1]).toBe(0x4B); // K
  });

  it('should handle different aspect ratios', async () => {
    const { renderImageToDocx } = await import('./docx-renderer');
    const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    
    // Wide image (landscape)
    const wideResult = await renderImageToDocx(minimalPng, 1200, 800);
    expect(wideResult).toBeInstanceOf(Buffer);
    
    // Tall image (portrait)
    const tallResult = await renderImageToDocx(minimalPng, 800, 1200);
    expect(tallResult).toBeInstanceOf(Buffer);
  });

  it('rejects non-PNG payloads, non-canonical base64, and unbounded canvas dimensions', async () => {
    const { validateDocxImageInput } = await import('./docx-renderer');
    const png = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    expect(() => validateDocxImageInput(`data:image/jpeg;base64,${png}`)).toThrow();
    expect(() => validateDocxImageInput(`${png}\n`)).toThrow();
    expect(() => validateDocxImageInput(png, 0, 100)).toThrow();
    expect(() => validateDocxImageInput(png, 20_000, 100)).toThrow();
    expect(() => validateDocxImageInput(png, 1_600, 1_600)).toThrow(/pixel/);
    expect(() => validateDocxImageInput(png, Number.NaN, 100)).toThrow();
    expect(() => validateDocxImageInput(png, Number.POSITIVE_INFINITY, 100)).toThrow();
  });

  it('rejects CRC corruption and truncation instead of trusting the PNG header', async () => {
    const { validateDocxImageInput } = await import('./docx-renderer');
    const valid = rgbaPng();
    const corrupt = Buffer.from(valid);
    corrupt[corrupt.length - 1] ^= 0x01;
    expect(() => validateDocxImageInput(valid.toString('base64').replace(/.$/, 'A'))).toThrow();
    expect(() => validateDocxImageInput(corrupt.toString('base64'))).toThrow(/checksum|PNG/);
    expect(() => validateDocxImageInput(valid.subarray(0, valid.length - 1).toString('base64'))).toThrow();
  });

  it('bounds decompression and pixel products before the actual decoder runs', async () => {
    const { validateDocxImageInput } = await import('./docx-renderer');
    const valid = rgbaPng();
    const bomb = replacePngChunk(valid, 'IDAT', deflateSync(Buffer.alloc(5 * 1024 * 1024)));
    expect(() => validateDocxImageInput(bomb.toString('base64'))).toThrow();
    expect(() => validateDocxImageInput(patchPngHeader(valid, 16_000, 16_000).toString('base64'))).toThrow(/dimensions|pixel/);
  });

  it('accepts valid non-interlaced PNG color buffers and returns fresh sanitized PNGs', async () => {
    const { validateDocxImageInput } = await import('./docx-renderer');
    const cases = [
      { colorType: 0, bytesPerPixel: 1 },
      { colorType: 2, bytesPerPixel: 3 },
      { colorType: 4, bytesPerPixel: 2 },
      { colorType: 6, bytesPerPixel: 4 },
    ];
    for (const { colorType, bytesPerPixel } of cases) {
      const source = PNG.sync.write(
        { width: 2, height: 2, data: Buffer.alloc(2 * 2 * bytesPerPixel, 127) } as unknown as PNG,
        { colorType, inputColorType: colorType } as any,
      );
      const output = validateDocxImageInput(dataUrl(source));
      const decoded = PNG.sync.read(output, { checkCRC: true });
      expect(decoded.width).toBe(2);
      expect(decoded.height).toBe(2);
      expect(decoded.data.length).toBe(16);
    }
  });
});

describe('DOCX Structured Export (renderStructuredDocx)', () => {
  it('should have renderStructuredDocx function exported', async () => {
    const { renderStructuredDocx } = await import('./docx-renderer');
    expect(renderStructuredDocx).toBeDefined();
    expect(typeof renderStructuredDocx).toBe('function');
  });
});

describe('DOCX Export API endpoint supports imageBase64', () => {
  it('should accept imageBase64 in request body', async () => {
    // This test verifies the endpoint handler logic exists
    // The actual HTTP test would need the server running
    const { renderImageToDocx } = await import('./docx-renderer');
    const minimalPng = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const result = await renderImageToDocx(minimalPng, 794, 1123);
    expect(result).toBeInstanceOf(Buffer);
    expect(result.length).toBeGreaterThan(100); // Should be a real DOCX
  });
});
