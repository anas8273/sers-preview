const SAFE_DATA_IMAGE_PATTERN = /^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/i;
const MAX_SAFE_IMAGE_DATA_LENGTH = 2_500_000;

export function safeExternalHttpUrl(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") return null;
    return parsed.href;
  } catch {
    return null;
  }
}

export function safeImageSrc(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  if (!trimmed || /[\u0000-\u001f\u007f]/.test(trimmed)) return null;
  if (trimmed.length <= MAX_SAFE_IMAGE_DATA_LENGTH && SAFE_DATA_IMAGE_PATTERN.test(trimmed)) {
    return trimmed;
  }
  return safeExternalHttpUrl(trimmed);
}
