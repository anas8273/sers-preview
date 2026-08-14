import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/GradeAnalysis.tsx", import.meta.url), "utf8");

describe("GradeAnalysis mobile layout", () => {
  it("reflows report metadata, statistics, and signatures on narrow screens", () => {
    expect(source).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-4"');
    expect(source).toContain('className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5"');
    expect(source).toContain('className="grid grid-cols-1 gap-6 pt-5 mt-4 border-t sm:grid-cols-2"');
  });

  it("keeps the chart and detailed grades table scrollable on mobile", () => {
    expect(source).toContain('aria-label="رسم توزيع التقديرات"');
    expect(source).toContain('className="min-w-[420px]"');
    expect(source).toContain('aria-label="جدول تفاصيل درجات الطلاب"');
    expect(source).toContain('className="min-w-[650px]"');
  });
});
