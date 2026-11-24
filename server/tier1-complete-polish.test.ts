import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  buildSmartEvidenceCoverage,
  OFFICIAL_SAUDI_STANDARD_SEEDS,
} from "../shared/saudi-standards-packs";
import { HIJRI_SCHOOL_CALENDAR_TRIGGERS } from "../shared/hijri-school-triggers";
import { evaluateReportPreflight } from "../shared/report-preflight";
import { REPORT_TEMPLATE_DEFINITIONS } from "../shared/report-projection";

const instantLabSource = readFileSync(
  resolve(import.meta.dirname, "../client/src/components/InstantReportLab.tsx"),
  "utf8",
);

describe("Tier-1 SmartEvidence 2D Coverage Matrix & Official 7+11 Packs (R14)", () => {
  it("defines 7 Saudi teacher evaluation elements summing to 100% weight and 11 professional standards", () => {
    const eval7 = OFFICIAL_SAUDI_STANDARD_SEEDS.filter(s => s.packId === "saudi-teacher-eval-7");
    const std11 = OFFICIAL_SAUDI_STANDARD_SEEDS.filter(s => s.packId === "saudi-teacher-standards-11");

    expect(eval7).toHaveLength(7);
    expect(std11).toHaveLength(11);
    const weightSum = eval7.reduce((sum, item) => sum + (item.weightPercent ?? 0), 0);
    expect(weightSum).toBe(100);
  });

  it("computes verified, supporting, missing statuses and weighted score accurately", () => {
    const eval7 = OFFICIAL_SAUDI_STANDARD_SEEDS
      .filter(s => s.packId === "saudi-teacher-eval-7")
      .map((seed, index) => ({
        id: index + 1,
        standardKey: seed.standardKey,
        version: seed.version,
        title: seed.title,
        data: { packId: seed.packId, weightPercent: seed.weightPercent, domainLabel: seed.domainLabel },
      }));

    const matrix = buildSmartEvidenceCoverage({
      standards: eval7,
      assets: [
        { id: 10, title: "ملف شهادة حضور", kind: "file" },
        { id: 20, title: "رابط مجتمع مهني", kind: "link" },
      ],
      links: [
        { assetId: 10, standardVersionId: 4, note: null }, // 20% weight, file -> verified
        { assetId: 20, standardVersionId: 2, note: "لقاء" }, // 10% weight, link -> supporting
      ],
    });

    expect(matrix.totalStandards).toBe(7);
    expect(matrix.coveredStandards).toBe(2);
    expect(matrix.verifiedStandards).toBe(1);
    expect(matrix.weightedScorePercent).toBe(30);
    expect(matrix.rows.find(r => r.standardVersionId === 4)?.status).toBe("verified");
    expect(matrix.rows.find(r => r.standardVersionId === 2)?.status).toBe("supporting");
    expect(matrix.rows.find(r => r.standardVersionId === 1)?.status).toBe("missing");
  });
});

describe("Tier-1 Hijri School Calendar Triggers", () => {
  it("provides non-empty unique triggers with suggested report titles", () => {
    expect(HIJRI_SCHOOL_CALENDAR_TRIGGERS.length).toBeGreaterThanOrEqual(5);
    const ids = new Set(HIJRI_SCHOOL_CALENDAR_TRIGGERS.map(t => t.id));
    expect(ids.size).toBe(HIJRI_SCHOOL_CALENDAR_TRIGGERS.length);
    for (const trigger of HIJRI_SCHOOL_CALENDAR_TRIGGERS) {
      expect(trigger.suggestedTitle.trim().length).toBeGreaterThan(5);
    }
  });
});

describe("CONV-05 Document Preflight before version freeze", () => {
  const customFields = REPORT_TEMPLATE_DEFINITIONS.custom.fields;

  it("flags empty draft and unselected linked evidence, and passes when core fields & evidence are set", () => {
    const attention = evaluateReportPreflight({
      title: "تقرير تجريبي",
      fieldDefinitions: customFields,
      fields: {},
      linkedAssetCount: 2,
      selectedEvidenceCount: 0,
    });
    expect(attention.status).toBe("attention");
    expect(attention.filledFieldCount).toBe(0);
    expect(attention.checks.some(c => c.id === "evidence-selection" && !c.passed)).toBe(true);

    const ready = evaluateReportPreflight({
      title: "تقرير مكتمل",
      fieldDefinitions: customFields,
      fields: { summary: "ملخص واضح", objectives: "أهداف محددة" },
      linkedAssetCount: 1,
      selectedEvidenceCount: 1,
    });
    expect(ready.status).toBe("ready");
    expect(ready.checks.every(c => c.passed)).toBe(true);
  });
});

describe("Tier-1 Instant 30-second Report Lab privacy & isolation", () => {
  it("keeps InstantReportLab strictly in-memory without localStorage, fetch, or trpc mutations", () => {
    expect(instantLabSource).not.toContain("localStorage");
    expect(instantLabSource).not.toContain("sessionStorage");
    expect(instantLabSource).not.toContain("fetch(");
    expect(instantLabSource).not.toContain("trpc.");
  });
});
