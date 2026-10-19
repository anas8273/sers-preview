/** Preserve the MIME of the bytes actually uploaded after browser compression.
 * The server independently validates the payload and chooses the storage extension.
 */
export function dataUrlUploadPayload(dataUrl: string): { mimeType: string; base64Data: string } {
  const separator = dataUrl.indexOf(",");
  const header = separator < 0 ? null : /^data:([^;,]*)(?:;[^,]*)?;base64$/i.exec(dataUrl.slice(0, separator));
  if (!header || separator === dataUrl.length - 1) {
    throw new Error("تعذر تجهيز بيانات الملف للرفع.");
  }
  return {
    mimeType: header[1].toLowerCase() || "application/octet-stream",
    base64Data: dataUrl.slice(separator + 1),
  };
}
