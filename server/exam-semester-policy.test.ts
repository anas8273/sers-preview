import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/ExamBuilder.tsx", import.meta.url), "utf8");

describe("exam semester policy", () => {
  it("limits the authoring form to the two approved academic semesters", () => {
    expect(source).toContain('<option value="الأول">الأول</option><option value="الثاني">الثاني</option>');
    expect(source).not.toContain('<option value="الثالث">الثالث</option>');
  });

  it("accepts a bounded textual source file before AI question generation", () => {
    expect(source).toContain("const acceptedExtensions = [\"txt\", \"md\", \"csv\", \"json\"]");
    expect(source).toContain("file.size > 750 * 1024");
    expect(source).toContain("topic: sourceContent || title || undefined");
    expect(source).toContain("إنشاء اختبار من ملف");
  });
});
