import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import { invokeLLM } from "./_core/llm";
import { aiClassification, aiPngDataUrl, aiTaxonomy, aiTestContext, configureAiTestEnvironment } from "../tests/fixtures/ai-router";
vi.mock("./_core/llm", () => ({ invokeLLM: vi.fn() }));
vi.mock("./ai-admission-db", async importOriginal => ({
  ...await importOriginal<typeof import("./ai-admission-db")>(),
  reserveAiRequest: vi.fn().mockResolvedValue({ requestId: "11111111-1111-4111-8111-111111111111", expiresAt: new Date(Date.now() + 90_000) }),
  finishAiRequest: vi.fn().mockResolvedValue(true),
}));
const model = vi.mocked(invokeLLM);
beforeEach(() => { vi.clearAllMocks(); configureAiTestEnvironment(); model.mockResolvedValue({ choices: [{ message: { content: JSON.stringify(aiClassification) } }] } as any); });

describe("AI classification admission and output", () => {
  it("returns an exact canonical destination from the supplied taxonomy", async () => {
    const result = await appRouter.createCaller(aiTestContext()).ai.classifyEvidence({ criteriaList: aiTaxonomy, fileName: "مادة.pdf", description: "مادة تعليمية" });
    expect(result.success).toBe(true);
    expect(result.classification).toMatchObject({ standardId: "std-1", subEvidenceId: "std-1-item-2", confidence: 0.85, indicatorText: aiTaxonomy[0].subEvidences[1].title });
  });
  it("rejects a missing taxonomy before model invocation", async () => {
    await expect(appRouter.createCaller(aiTestContext()).ai.classifyEvidence({ fileName: "مادة.pdf" } as any)).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(model).not.toHaveBeenCalled();
  });
  it("fails safely for syntactically valid but structurally invalid provider JSON", async () => {
    model.mockResolvedValueOnce({ choices: [{ message: { content: '{"confidence":-99,"unexpected":"value"}' } }] } as any);
    expect(await appRouter.createCaller(aiTestContext()).ai.classifyEvidence({ criteriaList: aiTaxonomy })).toEqual({ classification: null, success: false });
  });
  it("accepts a bounded inline image but never a remote image URL", async () => {
    const caller = appRouter.createCaller(aiTestContext());
    await expect(caller.ai.classifyEvidence({ criteriaList: aiTaxonomy, fileUrl: "https://example.invalid/private.png" })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(model).not.toHaveBeenCalled();
    expect((await caller.ai.classifyEvidence({ criteriaList: aiTaxonomy, fileUrl: aiPngDataUrl })).success).toBe(true);
    const user = model.mock.calls[0][0].messages.find(message => message.role === "user");
    expect(user?.content).toEqual(expect.arrayContaining([expect.objectContaining({ type: "image_url" })]));
  });
});
