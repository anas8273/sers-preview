import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CertificateBuilder.tsx", import.meta.url), "utf8");

describe("certificate language support", () => {
  it("offers Arabic and English choices for certificate content", () => {
    expect(source).toContain('const [language, setLanguage] = useState<"ar" | "en">("ar")');
    expect(source).toContain('setLanguage("ar")');
    expect(source).toContain('setLanguage("en")');
  });

  it("localizes the certificate title, metadata, and content direction", () => {
    expect(source).toContain("Certificate of Appreciation");
    expect(source).toContain('dir={language === "ar" ? "rtl" : "ltr"}');
    expect(source).toContain("certificateCopy.intro");
    expect(source).toContain("certificateCopy.footer");
  });
});
