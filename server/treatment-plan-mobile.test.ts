import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/TreatmentPlan.tsx", import.meta.url), "utf8");

describe("TreatmentPlan mobile layout", () => {
  it("reflows preview metadata and signatures for narrow screens", () => {
    expect(source).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-4"');
    expect(source).toContain('className="grid grid-cols-1 gap-2 mt-2 sm:grid-cols-2"');
    expect(source).toContain('className="grid grid-cols-1 gap-6 pt-5 mt-4 border-t sm:grid-cols-2"');
  });

  it("keeps the multi-column student table usable through horizontal scrolling", () => {
    expect(source).toContain('className="overflow-x-auto rounded-lg border border-transparent"');
    expect(source).toContain('aria-label="جدول بيانات الطلاب"');
    expect(source).toContain('className="min-w-[720px]"');
  });
});
