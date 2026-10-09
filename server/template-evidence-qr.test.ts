import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import TemplateRenderer from "../client/src/components/TemplateRenderer";
import { generateQRDataURL } from "../client/src/lib/qr-utils";
vi.mock("../client/src/lib/qr-utils", () => ({ generateQRDataURL: vi.fn(() => "data:image/png;base64,eA==") }));
const props = {
  layout: { version: 1, sections: [], showEvidenceSection: true },
  theme: { headerBg: "#fff", headerText: "#000", accent: "#123456", borderColor: "#ddd", bodyBg: "#fff" },
  personalInfo: {}, fieldValues: {},
};
describe("printed evidence QR truthfulness", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each(["file", "video", "image"] as const)("does not encode local-only %s attachments", type => {
    const html = renderToStaticMarkup(createElement(TemplateRenderer, { ...props, evidences: [{ id: "1", type, fileName: "local.pdf", fileData: "idb://local", displayAs: "qr" }] }));
    expect(generateQRDataURL).not.toHaveBeenCalled();
    expect(html).toContain("لم يُنشأ رمز QR");
  });
  it("encodes the complete uploaded URL without truncating signed query strings", () => {
    const url = "https://example.com/attachment?token=" + "x".repeat(250);
    renderToStaticMarkup(createElement(TemplateRenderer, { ...props, evidences: [{ id: "1", type: "video", fileName: "video.mp4", uploadedUrl: url }] }));
    expect(generateQRDataURL).toHaveBeenCalledWith(url, 6);
  });
});
