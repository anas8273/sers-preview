import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("shared portfolio route", () => {
  it("builds portfolio links with the public /share route registered by the application", () => {
    const source = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");
    expect(source).toContain("${window.location.origin}/share/${result.token}");
    expect(source).not.toContain("${window.location.origin}/shared/${result.token}");
  });
});
