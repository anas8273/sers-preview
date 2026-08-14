import { readFileSync } from "node:fs";
import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const performanceEvidenceSource = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");
const sharedPortfolioSource = readFileSync(new URL("../client/src/pages/SharedPortfolio.tsx", import.meta.url), "utf8");
const routersSource = readFileSync(new URL("../server/routers.ts", import.meta.url), "utf8");

describe("shared portfolio route", () => {
  it("builds portfolio links with the public /share route registered by the application", () => {
    expect(performanceEvidenceSource).toContain("${window.location.origin}/share/${result.token}");
    expect(performanceEvidenceSource).not.toContain("${window.location.origin}/shared/${result.token}");
  });

  it("accepts an optional access code and stores only its hash", () => {
    expect(performanceEvidenceSource).toContain("shareAccessCode");
    expect(performanceEvidenceSource).toContain("password: shareAccessCode.trim() || undefined");
    expect(routersSource).toContain("hashShareAccessCode(input.password)");
    expect(routersSource).toContain("timingSafeEqual");
    expect(routersSource).toContain("رمز الوصول غير صحيح");
  });

  it("explains the access-code flow on the public shared page", () => {
    expect(sharedPortfolioSource).toContain("رمز الوصول");
  });
});
