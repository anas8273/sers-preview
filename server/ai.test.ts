import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock invokeLLM to avoid real API calls
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

import { invokeLLM } from "./_core/llm";
const mockedInvokeLLM = vi.mocked(invokeLLM);

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("ai.suggest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns AI-generated content for a given prompt", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-1",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "هذا اقتراح شاهد أداء وظيفي مناسب للمعلم",
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.suggest({
      prompt: "اقترح شاهد أداء وظيفي",
      context: "الوظيفة: معلم",
    });

    expect(result.content).toBe("هذا اقتراح شاهد أداء وظيفي مناسب للمعلم");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
    expect(mockedInvokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({ role: "system" }),
          expect.objectContaining({ role: "user" }),
        ]),
      })
    );
  });

  it("handles empty response gracefully", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-2",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: "" },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.suggest({
      prompt: "اقترح شاهد",
    });

    expect(result.content).toBe("");
  });
});

describe("ai.improveText", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns improved text", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-3",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "نص محسّن واحترافي لشاهد الأداء الوظيفي",
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.improveText({
      text: "نص بسيط",
      context: "شاهد أداء وظيفي",
    });

    expect(result.improved).toBe("نص محسّن واحترافي لشاهد الأداء الوظيفي");
    expect(mockedInvokeLLM).toHaveBeenCalledTimes(1);
  });

  it("returns original text if LLM returns non-string", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-4",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: { role: "assistant", content: null as any },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.improveText({
      text: "نص أصلي",
    });

    expect(result.improved).toBe("نص أصلي");
  });
});

describe("ai.suggestEvidence", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns parsed suggestions from bullet-pointed response", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-5",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content:
              "• تقديم تقرير مفصل عن الإذاعة المدرسية\n• توثيق حضور الطلاب المشاركين\n• إرفاق صور من التنفيذ\n• تقييم أداء الطلاب",
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.suggestEvidence({
      jobTitle: "معلم",
      criterionName: "أداء الواجبات الوظيفية",
      subEvidenceName: "تقرير تنفيذ إذاعة مدرسية",
    });

    expect(result.suggestions).toBeInstanceOf(Array);
    expect(result.suggestions.length).toBeGreaterThanOrEqual(3);
    expect(result.rawContent).toContain("تقرير");
  });

  it("handles response with existing content", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-6",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "• إضافة تفاصيل عن الفقرات\n• ذكر أسماء الطلاب المشاركين",
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.suggestEvidence({
      jobTitle: "معلم",
      criterionName: "أداء الواجبات",
      subEvidenceName: "إذاعة مدرسية",
      existingContent: "تم تنفيذ الإذاعة",
    });

    expect(result.suggestions.length).toBeGreaterThanOrEqual(1);
    // Verify the existing content was passed to the LLM
    expect(mockedInvokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        messages: expect.arrayContaining([
          expect.objectContaining({
            role: "user",
            content: expect.stringContaining("تم تنفيذ الإذاعة"),
          }),
        ]),
      })
    );
  });
});

describe("ai.fillFormFields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns filled form data as JSON", async () => {
    const filledData = {
      topic: "اليوم الوطني السعودي",
      date: "1447/02/15",
      students_count: "8",
    };

    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-7",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify(filledData),
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.fillFormFields({
      jobTitle: "معلم",
      criterionName: "أداء الواجبات الوظيفية",
      subEvidenceName: "تقرير تنفيذ إذاعة مدرسية",
      formFields: [
        { id: "topic", label: "موضوع الإذاعة", type: "text" },
        { id: "date", label: "تاريخ التنفيذ", type: "date" },
        { id: "students_count", label: "عدد الطلاب", type: "number" },
      ],
    });

    expect(result.success).toBe(true);
    expect(result.filledData).toEqual(filledData);
  });

  it("returns success=false for invalid JSON response", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-8",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: "هذا ليس JSON صالح",
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.ai.fillFormFields({
      jobTitle: "معلم",
      criterionName: "أداء الواجبات",
      subEvidenceName: "إذاعة مدرسية",
      formFields: [{ id: "topic", label: "الموضوع", type: "text" }],
    });

    expect(result.success).toBe(false);
    expect(result.filledData).toEqual({});
  });

  it("passes response_format with json_schema to LLM", async () => {
    mockedInvokeLLM.mockResolvedValueOnce({
      id: "test-9",
      created: Date.now(),
      model: "test",
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content: JSON.stringify({ topic: "test" }),
          },
          finish_reason: "stop",
        },
      ],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await caller.ai.fillFormFields({
      jobTitle: "معلم",
      criterionName: "بند",
      subEvidenceName: "شاهد",
      formFields: [{ id: "topic", label: "الموضوع", type: "text" }],
    });

    expect(mockedInvokeLLM).toHaveBeenCalledWith(
      expect.objectContaining({
        response_format: expect.objectContaining({
          type: "json_schema",
          json_schema: expect.objectContaining({
            name: "form_fill",
            strict: true,
          }),
        }),
      })
    );
  });
});
