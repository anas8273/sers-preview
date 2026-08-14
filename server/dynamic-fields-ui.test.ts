import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");

describe("dynamic evidence fields", () => {
  it("offers an explicit control for adding a field and a dialog to name it", () => {
    expect(source).toContain("إضافة حقل");
    expect(source).toContain("إضافة حقل مخصص");
    expect(source).toContain("confirmAddDynamicRow");
  });

  it("keeps dynamic fields editable and removable", () => {
    expect(source).toContain("removeDynamicRow(currentCriterion.id, formEv.id, fieldId)");
    expect(source).toContain("سيظهر الحقل الجديد في النموذج والمعاينة وملف PDF.");
  });
});
