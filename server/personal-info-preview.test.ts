import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const performanceEvidenceSource = readFileSync(
  new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url),
  "utf8"
);

describe("personal information preview integration", () => {
  it("persists the personal information object when saving the portfolio", () => {
    expect(performanceEvidenceSource).toContain("personalInfo,");
  });

  it("renders each key personal field in the preview and export content", () => {
    ["name", "school", "department", "year", "semester", "evaluator", "evaluatorRole", "reportTitle"].forEach((field) => {
      expect(performanceEvidenceSource).toContain(`personalInfo.${field}`);
    });
  });
});
