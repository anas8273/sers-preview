import { describe, expect, it } from "vitest";
import { dataUrlUploadPayload } from "../client/src/lib/upload-data-url";

describe("browser upload payload after compression", () => {
  it("preserves the actual JPEG MIME when a source PNG has been compressed", () => {
    const payload = { fileName: "شاهد.png", ...dataUrlUploadPayload("data:image/jpeg;base64,/9j/") };
    expect(payload).toEqual({ fileName: "شاهد.png", mimeType: "image/jpeg", base64Data: "/9j/" });
  });

  it("uses WebM for compressed MP4 and removes codec parameters", () => {
    expect(dataUrlUploadPayload("data:video/webm;codecs=vp8;base64,GkXfow=="))
      .toEqual({ mimeType: "video/webm", base64Data: "GkXfow==" });
  });

  it("preserves the MIME when compression falls back to the original file", () => {
    expect(dataUrlUploadPayload("data:video/mp4;base64,YQ==").mimeType).toBe("video/mp4");
  });

  it("leaves unknown MIME detection to the server", () => {
    expect(dataUrlUploadPayload("data:;base64,YQ=="))
      .toEqual({ mimeType: "application/octet-stream", base64Data: "YQ==" });
  });

  it.each(["YQ==", "idb://evidence", "https://example.com/file.png", "data:image/png,abc", "data:image/png;base64,"])("rejects missing or unsupported data URL %s", (value) => {
    expect(() => dataUrlUploadPayload(value)).toThrow("تعذر تجهيز بيانات الملف للرفع");
  });
});
