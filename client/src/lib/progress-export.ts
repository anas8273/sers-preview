export function buildProgressExportFileName(baseName: string, extension: "png" | "pdf"): string {
  const normalized = baseName
    .trim()
    .replace(/[\\/:*?"<>|]/g, "-")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
  return `${normalized || "تقرير_التقدم_المتقدم"}.${extension}`;
}
