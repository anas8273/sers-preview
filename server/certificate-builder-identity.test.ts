import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CertificateBuilder.tsx", import.meta.url), "utf8");

describe("CertificateBuilder ministry identity", () => {
  it("keeps the ministry mark separate from surrounding decoration and preserves a print-safe frame", () => {
    expect(source).toContain('<MoeLogo variant="original" height={54} />');
    expect(source).toContain('inset: "34px"');
    expect(source).toContain('وزارة التعليم | المملكة العربية السعودية');
  });

  it("preserves a legible, print-proportioned preview on narrow screens", () => {
    expect(source).toContain('w-[720px] max-w-none shrink-0');
    expect(source).toContain('overflow-auto bg-[#EEF3F1]');
    expect(source).toContain("اسحب أفقيًا لمعاينة الشهادة كاملة");
  });

  it("keeps export state recoverable even if PDF generation fails", () => {
    expect(source).toContain("try {");
    expect(source).toContain("} finally {");
    expect(source).toContain("setIsExporting(false)");
  });
});
