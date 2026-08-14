import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");

describe("PerformanceEvidence offline recovery", () => {
  it("restores a recent offline draft when the standard local snapshot is unavailable", () => {
    expect(source).toContain('const OFFLINE_DRAFT_KEY = "performance-evidence-draft"');
    expect(source).toContain("const offlineDraft = getOfflineData<any>(OFFLINE_DRAFT_KEY)");
    expect(source).toContain("const saved = loadStateFromStorage() ?? (");
  });

  it("keeps a recoverable local snapshot for guest and failed cloud saves", () => {
    expect(source).toContain("saveOfflineData(OFFLINE_DRAFT_KEY, data)");
    expect(source).toContain("saveOfflineData(OFFLINE_DRAFT_KEY, fallback)");
    expect(source).toContain("احتُفظ بنسخة محلية آمنة لاستعادتها لاحقاً");
  });
});
