export const MAX_COVER_BACKGROUND_SIZE = 5 * 1024 * 1024;

export function validateCoverBackgroundFile(file: Pick<File, "type" | "size">): string | null {
  if (!file.type.startsWith("image/")) return "يرجى اختيار صورة مناسبة لخلفية الغلاف.";
  if (file.size > MAX_COVER_BACKGROUND_SIZE) return "حجم الخلفية يجب ألا يتجاوز 5 ميجابايت.";
  return null;
}
