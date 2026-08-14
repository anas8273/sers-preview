import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/TemplateManager.tsx", import.meta.url), "utf8");

describe("admin template field schema", () => {
  it("stores editable fields under templateLayout sections", () => {
    expect(source).toContain("sections: currentSections.map");
    expect(source).toContain("updateTemplateFields");
    expect(source).toContain("createDefaultLayout");
  });

  it("provides add, reorder, delete, and required controls for template fields", () => {
    expect(source).toContain("addTemplateField");
    expect(source).toContain("moveTemplateField");
    expect(source).toContain("removeTemplateField");
    expect(source).toContain("إلزامي");
  });

  it("uses the managed fields in each live field-style preview", () => {
    expect(source).toContain("templateFields.map((field, index)");
    expect(source).toContain("templateFields.map((field) =>");
  });

  it("expands long descriptive fields across the available preview columns", () => {
    expect(source).toContain("isLongTemplateField");
    expect(source).toContain("gridColumn: isLongTemplateField(field) ? '1 / -1' : undefined");
  });

  it("manages independent template sections as editable pages", () => {
    expect(source).toContain("addTemplateSection");
    expect(source).toContain("removeTemplateSection");
    expect(source).toContain("pageBreakBefore");
    expect(source).toContain("صفحة جديدة");
    expect(source).toContain("صفحة جديدة قبل القسم");
  });
});
