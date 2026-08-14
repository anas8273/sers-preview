import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/GradeAnalysis.tsx", import.meta.url), "utf8");

describe("GradeAnalysis automatic grading", () => {
  it("keeps unentered scores distinct from zero and accepts a recorded zero", () => {
    expect(source).toContain("score: number | null");
    expect(source).toContain('score: null');
    expect(source).toContain('student.score !== null');
    expect(source).toContain('e.target.value === "" ? null : Number(e.target.value)');
  });

  it("clamps grades to the configured maximum and exposes students needing support", () => {
    expect(source).toContain("Math.min(Math.max(Number(value) || 0, 0), Math.max(subjectInfo.maxScore || 100, 1))");
    expect(source).toContain("needsSupport: fail");
    expect(source).toContain("بحاجة دعم");
  });

  it("offers safeguarded image import while preserving manually entered rows", () => {
    expect(source).toContain("extractGradesFromImage.useMutation");
    expect(source).toContain("file.size > 5 * 1024 * 1024");
    expect(source).toContain('accept="image/png,image/jpeg,image/webp"');
    expect(source).toContain("previous.filter((student) => student.name.trim() || student.score !== null)");
    expect(source).toContain("راجع النتائج قبل الاعتماد");
  });
});
