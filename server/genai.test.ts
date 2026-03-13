import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// Mock invokeLLM to avoid real API calls
vi.mock("./_core/llm", () => ({
  invokeLLM: vi.fn(),
}));

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

describe("genAI.fillReport", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns filled data from AI response", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            schoolName: "مدرسة الأمل الابتدائية",
            teacherName: "أحمد محمد",
          }),
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.fillReport({
      templateName: "تقرير أداء معلم",
      fields: [
        { id: "schoolName", label: "اسم المدرسة", type: "text" },
        { id: "teacherName", label: "اسم المعلم", type: "text" },
      ],
      context: "تقرير فصلي",
    });

    expect(result.success).toBe(true);
    expect(result.filledData).toBeDefined();
    expect(result.filledData.schoolName).toBe("مدرسة الأمل الابتدائية");
    expect(result.filledData.teacherName).toBe("أحمد محمد");
  });

  it("handles invalid JSON response gracefully", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: "not valid json",
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.fillReport({
      templateName: "تقرير",
      fields: [{ id: "name", label: "الاسم", type: "text" }],
    });

    expect(result.success).toBe(false);
    expect(result.filledData).toEqual({});
  });
});

describe("genAI.generateRadio", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns radio segments from AI response", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            segments: [
              { title: "مقدمة", content: "بسم الله الرحمن الرحيم..." },
              { title: "القرآن الكريم", content: "قال تعالى..." },
            ],
          }),
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generateRadio({
      theme: "يوم المعلم",
      segments: ["مقدمة", "القرآن الكريم"],
    });

    expect(result.success).toBe(true);
    expect(result.segments).toHaveLength(2);
    expect(result.segments[0].title).toBe("مقدمة");
    expect(result.segments[1].title).toBe("القرآن الكريم");
  });

  it("handles invalid JSON response gracefully", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: "invalid",
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generateRadio({
      theme: "test",
      segments: ["test"],
    });

    expect(result.success).toBe(false);
    expect(result.segments).toEqual([]);
  });
});

describe("genAI.generateCV", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns CV data from AI response", async () => {
    const { invokeLLM } = await import("./_core/llm");
    const mockCvData = {
      summary: "معلم رياضيات ذو خبرة 10 سنوات",
      experience: [{ title: "معلم رياضيات", organization: "مدرسة الأمل", period: "2015-2025", description: "تدريس الرياضيات" }],
      education: [{ title: "بكالوريوس رياضيات", organization: "جامعة الملك سعود", period: "2011-2015", description: "تخصص رياضيات" }],
      skills: ["التدريس", "التخطيط"],
      courses: [{ title: "دورة تطوير", organization: "وزارة التعليم", period: "2023", description: "تطوير مهني" }],
      achievements: ["معلم متميز 2023"],
    };
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify(mockCvData),
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generateCV({
      name: "أحمد محمد",
      jobTitle: "معلم رياضيات",
    });

    expect(result.success).toBe(true);
    expect(result.cvData).toBeDefined();
    expect(result.cvData?.summary).toBe("معلم رياضيات ذو خبرة 10 سنوات");
    expect(result.cvData?.skills).toContain("التدريس");
  });

  it("handles invalid JSON response gracefully", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: "not json",
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generateCV({
      name: "test",
      jobTitle: "test",
    });

    expect(result.success).toBe(false);
    expect(result.cvData).toBeNull();
  });
});

describe("genAI.generateExamQuestions", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns exam questions from AI response", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: JSON.stringify({
            questions: [
              {
                type: "multiple-choice",
                text: "ما هو ناتج 2 + 2؟",
                options: ["3", "4", "5", "6"],
                correctAnswer: "4",
                points: 1,
                explanation: "الجمع البسيط",
              },
              {
                type: "true-false",
                text: "الأرض مسطحة",
                options: ["صح", "خطأ"],
                correctAnswer: "خطأ",
                points: 1,
                explanation: "الأرض كروية",
              },
            ],
          }),
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generateExamQuestions({
      subject: "رياضيات",
      grade: "الصف الرابع",
      questionTypes: ["multiple-choice", "true-false"],
      count: 2,
    });

    expect(result.success).toBe(true);
    expect(result.questions).toHaveLength(2);
    expect(result.questions[0].type).toBe("multiple-choice");
    expect(result.questions[0].correctAnswer).toBe("4");
    expect(result.questions[1].type).toBe("true-false");
  });

  it("validates count range", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.genAI.generateExamQuestions({
        subject: "رياضيات",
        grade: "الصف الرابع",
        questionTypes: ["multiple-choice"],
        count: 0, // below minimum
      })
    ).rejects.toThrow();

    await expect(
      caller.genAI.generateExamQuestions({
        subject: "رياضيات",
        grade: "الصف الرابع",
        questionTypes: ["multiple-choice"],
        count: 31, // above maximum
      })
    ).rejects.toThrow();
  });
});

describe("genAI.generatePortfolioContent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns portfolio content from AI response", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: "محتوى ملف الإنجاز الاحترافي: يتضمن هذا القسم...",
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generatePortfolioContent({
      section: "الإنجازات المهنية",
      jobTitle: "معلم",
    });

    expect(result.content).toBeDefined();
    expect(result.content.length).toBeGreaterThan(0);
    expect(result.content).toContain("ملف الإنجاز");
  });

  it("handles empty AI response", async () => {
    const { invokeLLM } = await import("./_core/llm");
    (invokeLLM as any).mockResolvedValue({
      choices: [{
        message: {
          content: null,
        },
      }],
    });

    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.genAI.generatePortfolioContent({
      section: "test",
      jobTitle: "test",
    });

    expect(result.content).toBe("");
  });
});
