import { describe, it, expect, vi } from "vitest";
import { getEvidenceRemoteUrl, retryEvidenceUpload } from "../client/src/lib/evidence-upload-state";

describe("evidence remote state and retry", () => {
  it.each([undefined, "proof.pdf", "idb://123", "data:image/png;base64,eA==", "javascript:alert(1)", "https://user:secret@example.com/a"])("does not turn local data or unsafe targets into QR links", uploadedUrl => {
    expect(getEvidenceRemoteUrl({ type: "file", uploadedUrl })).toBeNull();
  });
  it("uses explicit links for link evidence and uploaded URLs for attachments", () => {
    expect(getEvidenceRemoteUrl({ type: "link", link: "https://example.com/proof", uploadedUrl: "https://example.com/other" })).toBe("https://example.com/proof");
    expect(getEvidenceRemoteUrl({ type: "video", link: "https://example.com/other" })).toBeNull();
  });
  it("resolves stored data and preserves original evidence on failed retry", async () => {
    const ev = Object.freeze({ fileName: "proof.mp4", fileData: "idb://local-id" });
    const upload = vi.fn().mockRejectedValue(new Error("offline"));
    const readLocalFile = vi.fn().mockResolvedValue({ data: "data:video/mp4;base64,eA==" });
    await expect(retryEvidenceUpload(ev, { readLocalFile, upload })).rejects.toThrow("offline");
    expect(readLocalFile).toHaveBeenCalledWith("local-id");
    expect(upload).toHaveBeenCalledWith({ fileName: "proof.mp4", mimeType: "video/mp4", base64Data: "eA==" });
    expect(ev.fileData).toBe("idb://local-id");
  });
  it("does not upload if the local source was lost", async () => {
    const upload = vi.fn();
    await expect(retryEvidenceUpload({ fileData: "idb://missing" }, { readLocalFile: vi.fn().mockResolvedValue(undefined), upload })).rejects.toThrow("الملف غير موجود");
    expect(upload).not.toHaveBeenCalled();
  });
  it("returns a usable URL only after confirmed upload response", async () => {
    const ev = { fileName: "proof.png", fileData: "data:image/png;base64,eA==" };
    const readLocalFile = vi.fn();
    await expect(retryEvidenceUpload(ev, { readLocalFile, upload: vi.fn().mockResolvedValue({ url: "https://example.com/proof.png" }) })).resolves.toBe("https://example.com/proof.png");
    expect(readLocalFile).not.toHaveBeenCalled();
    await expect(retryEvidenceUpload(ev, { readLocalFile, upload: vi.fn().mockResolvedValue({ url: "proof.png" }) })).rejects.toThrow("رابطًا صالحًا");
  });
});
