import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/components/TemplateRenderer.tsx", import.meta.url), "utf8");

describe("TemplateRenderer pagination", () => {
  it("honors an explicit page break before a configured section", () => {
    expect(source).toContain("pageBreakBefore?: boolean");
    expect(source).toContain("breakBefore: section.pageBreakBefore ? 'page' : undefined");
    expect(source).toContain("pageBreakBefore: section.pageBreakBefore ? 'always' : undefined");
  });
});
