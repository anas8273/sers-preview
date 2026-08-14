import { describe, expect, it } from "vitest";
import { buildAssistantQuickQuestions } from "../client/src/lib/ai-assistant-prompts";
import { buildProgressExportFileName } from "../client/src/lib/progress-export";

describe("progress export and assistant helpers", () => {
  it("builds contextual quick questions for the active criterion", () => {
    const questions = buildAssistantQuickQuestions("تحسين نتائج المتعلمين");
    expect(questions).toHaveLength(4);
    expect(questions[0]).toContain("تحسين نتائج المتعلمين");
    expect(new Set(questions).size).toBe(questions.length);
  });

  it("uses a safe default question when no criterion is selected", () => {
    expect(buildAssistantQuickQuestions()[0]).toContain("هذا البند");
  });

  it("creates shareable export file names with a requested extension", () => {
    expect(buildProgressExportFileName("تقرير: التقدم / أغسطس", "png")).toBe("تقرير-_التقدم_-_أغسطس.png");
    expect(buildProgressExportFileName("", "pdf")).toBe("تقرير_التقدم_المتقدم.pdf");
  });
});
