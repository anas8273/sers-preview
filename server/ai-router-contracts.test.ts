import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";
import { reserveAiRequest, finishAiRequest } from "./ai-admission-db";
import { aiPngDataUrl, aiTaxonomy, aiTestContext, configureAiTestEnvironment } from "../tests/fixtures/ai-router";
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./ai-admission-db", async importOriginal => ({
  ...await importOriginal<typeof import("./ai-admission-db")>(),
  reserveAiRequest: vi.fn().mockResolvedValue({ requestId: "11111111-1111-4111-8111-111111111111", expiresAt: new Date(Date.now() + 90_000) }),
  finishAiRequest: vi.fn().mockResolvedValue(true),
}));
const model = vi.mocked(invokeLLM);
const operationInputs = [
  ["ai", "classifyEvidence", { criteriaList: aiTaxonomy }],
  ["ai", "suggestEvidence", { jobTitle: "معلم", criterionName: "تعليم", subEvidenceName: "مادة" }],
  ["ai", "fillFormFields", { jobTitle: "معلم", criterionName: "تعليم", subEvidenceName: "مادة", formFields: [{ id: "topic", label: "الموضوع", type: "text" }] }],
  ["ai", "improveText", { text: "نص تعليمي" }], ["ai", "suggest", { prompt: "فكرة تعليمية" }],
  ["ai", "analyzeGaps", { coveredIndicators: [], totalIndicators: 2 }],
  ["genAI", "fillReport", { templateName: "تقرير", fields: [{ id: "topic", label: "الموضوع", type: "text" }] }],
  ["genAI", "generateRadio", { theme: "العلم", segments: ["مقدمة"] }],
  ["genAI", "generateCV", { name: "اسم اصطناعي", jobTitle: "معلم" }],
  ["genAI", "generateExamQuestions", { subject: "رياضيات", grade: "رابع", questionTypes: ["multiple-choice"], count: 1 }],
  ["genAI", "extractGradesFromImage", { imageData: aiPngDataUrl, maxScore: 100 }],
  ["genAI", "generatePortfolioContent", { section: "أهداف", jobTitle: "معلم" }],
] as const;
beforeEach(() => { vi.clearAllMocks(); configureAiTestEnvironment(); });
function respond(value: unknown) { model.mockResolvedValueOnce({ choices: [{ message: { content: JSON.stringify(value) } }] } as any); }

describe("AI procedure admission", () => {
  it.each(operationInputs)("denies anonymous %s.%s without database reservation or upstream work", async (group, operation, input) => {
    const caller = appRouter.createCaller(aiTestContext(false)) as any;
    await expect(caller[group][operation](input)).rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(reserveAiRequest).not.toHaveBeenCalled(); expect(model).not.toHaveBeenCalled(); expect(finishAiRequest).not.toHaveBeenCalled();
  });
  it.each([
    ["ai", "suggest", { prompt: "x".repeat(16_001) }],
    ["ai", "classifyEvidence", { criteriaList: aiTaxonomy, fileUrl: "http://127.0.0.1/private.png" }],
    ["ai", "classifyEvidence", { criteriaList: [aiTaxonomy[0], aiTaxonomy[0]] }],
    ["genAI", "fillReport", { templateName: "تقرير", fields: [{ id: "constructor", label: "حقل", type: "text" }] }],
    ["genAI", "fillReport", { templateName: "تقرير", fields: [{ id: "a", label: "حقل", type: "text" }, { id: "a", label: "مكرر", type: "text" }] }],
    ["genAI", "generateExamQuestions", { subject: "علوم", grade: "رابع", questionTypes: ["essay"], count: 1.5 }],
    ["genAI", "extractGradesFromImage", { imageData: "data:image/svg+xml;base64,PHN2Zy8+", maxScore: 100 }],
  ])("rejects bounded/semantic input violation in %s.%s before reservation", async (group, operation, input) => {
    const caller = appRouter.createCaller(aiTestContext()) as any;
    await expect(caller[group as string][operation as string](input)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(reserveAiRequest).not.toHaveBeenCalled(); expect(model).not.toHaveBeenCalled();
  });
  it("rejects cross-origin use before paid admission", async () => {
    const ctx = aiTestContext(); ctx.req.headers.origin = "https://other.invalid";
    await expect(appRouter.createCaller(ctx).ai.suggest({ prompt: "فكرة" })).rejects.toMatchObject({ code: "FORBIDDEN" });
    expect(reserveAiRequest).not.toHaveBeenCalled(); expect(model).not.toHaveBeenCalled();
  });
  it("keeps AI disabled by default without blocking manual application data", async () => {
    vi.stubEnv("SERS_AI_ENABLED", "0");
    await expect(appRouter.createCaller(aiTestContext()).ai.suggest({ prompt: "فكرة" })).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    expect(reserveAiRequest).not.toHaveBeenCalled(); expect(model).not.toHaveBeenCalled();
  });
});

describe("AI structured output validation", () => {
  it("marks empty, overlong and truncated plaintext as unsuccessful and preserves the original edit", async () => {
    model.mockResolvedValueOnce({ choices: [{ message: { content: { unexpected: true } } }] } as any);
    const caller = appRouter.createCaller(aiTestContext());
    expect(await caller.ai.improveText({ text: "النص الأصلي" })).toEqual({ improved: "النص الأصلي", success: false });
    model.mockResolvedValueOnce({ choices: [{ message: { content: "x".repeat(24_001) } }] } as any);
    expect(await caller.ai.suggest({ prompt: "فكرة" })).toEqual({ content: "", success: false });
    model.mockResolvedValueOnce({ choices: [{ finish_reason: "length", message: { content: "نص غير مكتمل" } }] } as any);
    expect(await caller.genAI.generatePortfolioContent({ section: "أهداف", jobTitle: "معلم" })).toEqual({ content: "", success: false });
    expect(finishAiRequest).toHaveBeenLastCalledWith(expect.objectContaining({ outcome: "failed", errorCode: "invalid_output" }));
  });
  it.each([{ topic: "نص", foreign: "لا يُطلب" }, { topic: 10 }, { other: "المفتاح المطلوب مفقود" }, ["ليست حقولًا"]])("rejects unsupplied/mistyped fields %j", async value => {
    respond(value);
    const result = await appRouter.createCaller(aiTestContext()).genAI.fillReport({ templateName: "تقرير", fields: [{ id: "topic", label: "الموضوع", type: "text" }] });
    expect(result).toEqual({ filledData: {}, success: false });
    expect(finishAiRequest).toHaveBeenCalledWith(expect.objectContaining({ outcome: "failed", errorCode: "invalid_output" }));
  });
  it.each([105, -1, "98", null])("does not coerce or clamp an uncertain provider grade %j", async score => {
    respond({ students: [{ name: "طالب اصطناعي", score }], unreadableNote: "" });
    const result = await appRouter.createCaller(aiTestContext()).genAI.extractGradesFromImage({ imageData: aiPngDataUrl, maxScore: 100 });
    expect(result.success).toBe(false); expect(result.students).toEqual([]);
  });
  it("returns the actual multiple-choice answer index, never a default first answer", async () => {
    respond({ questions: [{ type: "multiple-choice", text: "2 + 2", options: ["3", "4", "5", "6"], correctAnswer: "4", points: 1, explanation: "الجمع" }] });
    const result = await appRouter.createCaller(aiTestContext()).genAI.generateExamQuestions({ subject: "رياضيات", grade: "رابع", questionTypes: ["multiple-choice"], count: 1 });
    expect(result.success).toBe(true); expect(result.questions[0]).toMatchObject({ correctAnswer: "4", correctIndex: 1 });
  });
  it("rejects invented answer options and unrequested radio sections", async () => {
    respond({ questions: [{ type: "multiple-choice", text: "2 + 2", options: ["1", "2", "3", "5"], correctAnswer: "4", points: 1, explanation: "الجمع" }] });
    const caller = appRouter.createCaller(aiTestContext());
    expect((await caller.genAI.generateExamQuestions({ subject: "رياضيات", grade: "رابع", questionTypes: ["multiple-choice"], count: 1 })).success).toBe(false);
    respond({ segments: [{ title: "عنوان غير مطلوب", content: "نص" }] });
    expect((await caller.genAI.generateRadio({ theme: "العلم", segments: ["مقدمة"] })).success).toBe(false);
  });
});
