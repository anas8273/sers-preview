import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");

describe("performance insights integration", () => {
  it("renders the advanced progress statistics with an overview, radar chart, and per-criterion bars", () => {
    expect(source).toContain("StatsOverviewCard");
    expect(source).toContain("ProgressRadarChart");
    expect(source).toContain("ProgressBarItem");
  });

  it("opens the contextual AI assistant with the selected job and criterion context", () => {
    expect(source).toContain("AIAssistantPanel");
    expect(source).toContain("jobTitle: selectedJob?.title");
    expect(source).toContain("criterionName: currentCriterion?.title");
  });
});
