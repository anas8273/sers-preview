import { dataUrlUploadPayload } from "./upload-data-url";

type RemoteEvidence = { type: string; link?: string; uploadedUrl?: string };
export function getEvidenceRemoteUrl(evidence: RemoteEvidence): string | null {
  const raw = evidence.type === "link" ? evidence.link : evidence.uploadedUrl;
  if (!raw) return null;
  try {
    const url = new URL(raw);
    return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : null;
  } catch { return null; }
}

export async function retryEvidenceUpload(
  evidence: { fileName?: string; fileData?: string | null },
  dependencies: {
    readLocalFile: (id: string) => Promise<{ data: string } | undefined | null>;
    upload: (input: { fileName: string; mimeType: string; base64Data: string }) => Promise<{ url: string }>;
  },
): Promise<string> {
  let data = evidence.fileData;
  if (data?.startsWith("idb://")) data = (await dependencies.readLocalFile(data.slice(6)))?.data;
  if (!data) throw new Error("الملف غير موجود على هذا الجهاز. أعد اختيار الملف الأصلي.");
  const payload = dataUrlUploadPayload(data);
  const result = await dependencies.upload({ fileName: evidence.fileName || "attachment", ...payload });
  const url = getEvidenceRemoteUrl({ type: "file", uploadedUrl: result.url });
  if (!url) throw new Error("لم يرجع الرفع رابطًا صالحًا. حاول مرة أخرى.");
  return url;
}
