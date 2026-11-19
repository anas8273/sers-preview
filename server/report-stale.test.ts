import { describe, expect, it } from "vitest";
import { compareReportDraftToVersion, reportRevisionOfVersion } from "../shared/report-stale";

describe("report stale guard", () => {
  it("compares the current draft revision with the immutable version revision", () => {
    expect(compareReportDraftToVersion(5, { reportRevision: 4 })).toBe("stale");
    expect(compareReportDraftToVersion(4, { snapshot: { reportDraft: { revision: 4 } } })).toBe("fresh");
  });

  it("does not substitute timestamps or malformed values for a revision", () => {
    expect(reportRevisionOfVersion({ createdAt: "2099-01-01T00:00:00.000Z" })).toBeUndefined();
    expect(compareReportDraftToVersion(5, { createdAt: "2000-01-01T00:00:00.000Z" })).toBe("unknown");
    expect(compareReportDraftToVersion(5, { reportRevision: -1 })).toBe("unknown");
  });
});
