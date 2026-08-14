import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const performanceSource = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");
const rendererSource = readFileSync(new URL("../client/src/components/TemplateRenderer.tsx", import.meta.url), "utf8");

describe("large QR evidence rendering", () => {
  it("uses high-resolution 128px QR codes in printable evidence layouts", () => {
    expect(performanceSource).toContain("width: '128px', height: '128px'");
    expect(performanceSource).toContain("generateQRDataURL(ev.link, 6)");
    expect(rendererSource).toContain("width: '128px', height: '128px'");
  });
});
