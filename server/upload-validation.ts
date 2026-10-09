import { TRPCError } from "@trpc/server";

export const MAX_EVIDENCE_BYTES = 16 * 1024 * 1024;
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_LOGO_BYTES = 2 * 1024 * 1024;
export const MAX_UPLOAD_BASE64_LENGTH = 4 * Math.ceil(MAX_EVIDENCE_BYTES / 3);

const office: Record<string, string> = {
  doc: "application/msword", xls: "application/vnd.ms-excel", ppt: "application/vnd.ms-powerpoint",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
};
const fail = (message: string): never => { throw new TRPCError({ code: "BAD_REQUEST", message }); };

/** Admission checks only: signatures do not prove malware-free or fully valid content. */
export function validateUpload(input: { fileName: string; mimeType: string; base64Data: string }, options: { maxBytes?: number; imagesOnly?: boolean } = {}) {
  const maxBytes = options.maxBytes ?? MAX_EVIDENCE_BYTES;
  if (!input.fileName.trim() || input.fileName.length > 255 || /[\\/\x00-\x1f\x7f:]/.test(input.fileName)) {
    fail("اسم الملف غير صالح");
  }
  const encoded = input.base64Data;
  if (!encoded || encoded.length > 4 * Math.ceil(maxBytes / 3)) fail("الملف فارغ أو يتجاوز الحجم المسموح");
  // Avoid a repeated-group regexp over a multi-megabyte string (stack exhaustion).
  if (encoded.length % 4 !== 0 || /[^A-Za-z0-9+/=]/.test(encoded)) fail("ترميز الملف غير صالح");
  const padding = encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0;
  if (encoded.slice(0, encoded.length - padding).includes("=")) fail("ترميز الملف غير صالح");
  const decodedLength = encoded.length / 4 * 3 - padding;
  if (!decodedLength || decodedLength > maxBytes) fail("الملف فارغ أو يتجاوز الحجم المسموح");
  const buffer = Buffer.from(encoded, "base64");
  if (buffer.toString("base64") !== encoded) fail("ترميز الملف غير صالح");
  const hex = (value: string) => buffer.subarray(0, value.length / 2).equals(Buffer.from(value, "hex"));
  const ascii = (start: number, end: number) => buffer.toString("latin1", start, end);
  let mimeType = "", extension = "";
  if (buffer.length >= 24 && hex("89504e470d0a1a0a") && ascii(12, 16) === "IHDR") { mimeType = "image/png"; extension = "png"; }
  else if (buffer.length >= 4 && hex("ffd8ff")) { mimeType = "image/jpeg"; extension = "jpg"; }
  else if (buffer.length >= 16 && ascii(0, 4) === "RIFF" && ascii(8, 12) === "WEBP") { mimeType = "image/webp"; extension = "webp"; }
  else if (buffer.length >= 13 && ["GIF87a", "GIF89a"].includes(ascii(0, 6))) { mimeType = "image/gif"; extension = "gif"; }
  else if (buffer.length >= 8 && ascii(0, 5) === "%PDF-") { mimeType = "application/pdf"; extension = "pdf"; }
  else if (buffer.length >= 16 && ascii(4, 8) === "ftyp") {
    const brand = ascii(8, 12);
    if (["isom", "iso2", "mp41", "mp42", "avc1", "M4V "].includes(brand)) { mimeType = "video/mp4"; extension = "mp4"; }
    else if (brand === "qt  ") { mimeType = "video/quicktime"; extension = "mov"; }
  } else if (buffer.length >= 16 && hex("1a45dfa3") && buffer.subarray(0, 4096).includes(Buffer.from("webm"))) { mimeType = "video/webm"; extension = "webm"; }
  else {
    const ext = input.fileName.split(".").pop()?.toLowerCase() ?? "";
    // Container signatures only; Office scanning/CDR remains a separate gate.
    if ((["doc", "xls", "ppt"].includes(ext) && buffer.length >= 512 && hex("d0cf11e0a1b11ae1")) ||
        (["docx", "xlsx", "pptx"].includes(ext) && buffer.length >= 30 && hex("504b0304"))) {
      mimeType = office[ext]; extension = ext;
    }
  }
  if (!mimeType || (options.imagesOnly && !mimeType.startsWith("image/"))) fail("نوع الملف غير مدعوم لهذا الرفع");
  const declared = input.mimeType.split(";")[0].trim().toLowerCase();
  if (declared && declared !== "application/octet-stream" && declared !== mimeType) fail("نوع الملف لا يطابق محتواه");
  // Stored names never inherit an extension from the untrusted display name.
  return { buffer, mimeType, extension };
}
