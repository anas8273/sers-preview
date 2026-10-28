import jsQR from "jsqr";
import { PNG } from "pngjs";
import JSZip from "jszip";

export function decodeQrPng(bytes: Buffer) {
  const png = PNG.sync.read(bytes);
  return jsQR(new Uint8ClampedArray(png.data), png.width, png.height, { inversionAttempts: "dontInvert" })?.data ?? null;
}
export function plainXml(value: string) {
  return value.replace(/<[^>]+>/g, "").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&");
}
export function comparableText(value: string) { return value.replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, "").replace(/\s+/g, "").normalize("NFC"); }
export async function inspectNativeDocx(bytes: Buffer) {
  const zip = await JSZip.loadAsync(bytes);
  const xml = await zip.file("word/document.xml")!.async("string");
  const media = await Promise.all(Object.values(zip.files).filter(file => /^word\/media\/.*\.png$/.test(file.name)).map(file => file.async("nodebuffer")));
  return { text: plainXml(xml), nativeTables: (xml.match(/<w:tbl>/g) ?? []).length, decodedQr: media.map(decodeQrPng).filter(Boolean), imageCount: media.length };
}
