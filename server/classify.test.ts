import { describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock invokeLLM to avoid actual API calls
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn().mockResolvedValue({
    choices: [
      {
        message: {
          content: JSON.stringify({
            standardId: "std-1",
            standardNumber: 1,
            standardName: "أداء الواجبات الوظيفية",
            indicatorIndex: 2,
            indicatorText: "الالتزام بالحضور والانصراف",
            subIndicatorIndex: 1,
            subIndicatorText: "سجل الحضور",
            confidence: 0.85,
            reasoning: "الصورة تحتوي على سجل حضور",
            contentDescription: "سجل حضور المعلم",
            suggestedPriority: "essential",
            suggestedKeywords: ["حضور", "انصراف", "سجل"],
          }),
        },
      },
    ],
  }),
}));

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

describe("ai.classifyEvidence", () => {
  it("classifies evidence based on file name and returns classification", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.classifyEvidence({
      fileName: "سجل_الحضور.jpg",
      fileType: "image/jpeg",
      description: "سجل حضور المعلم",
      jobTitle: "معلم",
      criteriaList: [
        {
          id: "std-1",
          title: "أداء الواجبات الوظيفية",
          subEvidences: [
            { id: "std-1-item-1", title: "الالتزام بالأنظمة" },
            { id: "std-1-item-2", title: "الالتزام بالحضور والانصراف" },
          ],
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.classification).toBeDefined();
    expect(result.classification.standardId).toBe("std-1");
    expect(result.classification.standardNumber).toBe(1);
    expect(result.classification.confidence).toBeGreaterThan(0);
    expect(result.classification.contentDescription).toBeTruthy();
  });

  it("returns success false when LLM returns invalid JSON", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: "invalid json",
          },
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.classifyEvidence({
      fileName: "test.pdf",
      fileType: "application/pdf",
    });

    expect(result.success).toBe(false);
    expect(result.classification).toBeNull();
  });

  it("works without criteriaList (uses default standards)", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValueOnce({
      choices: [
        {
          message: {
            content: JSON.stringify({
              standardId: "std-2",
              standardNumber: 2,
              standardName: "التفاعل مع المجتمع المهني",
              indicatorIndex: 1,
              indicatorText: "المشاركة في المجتمعات المهنية",
              subIndicatorIndex: 0,
              subIndicatorText: "",
              confidence: 0.7,
              reasoning: "شهادة مشاركة في ورشة",
              contentDescription: "شهادة حضور ورشة عمل",
              suggestedPriority: "supporting",
              suggestedKeywords: ["ورشة", "تدريب", "شهادة"],
            }),
          },
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.classifyEvidence({
      fileName: "شهادة_ورشة.pdf",
      fileType: "application/pdf",
      description: "شهادة حضور ورشة عمل",
    });

    expect(result.success).toBe(true);
    expect(result.classification.standardId).toBe("std-2");
  });

  it("includes learning context in classification", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.classifyEvidence({
      fileName: "خطة_درس.pdf",
      fileType: "application/pdf",
      jobTitle: "معلم",
      learningContext: [
        {
          fileName: "خطة_سابقة.pdf",
          criterionId: "std-6",
          criterionTitle: "إعداد وتنفيذ خطة التعلم",
          subEvidenceId: "std-6-item-1",
          subEvidenceTitle: "إعداد خطة الدرس",
        },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.classification).toBeDefined();
  });
});
