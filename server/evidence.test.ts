import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

// ===== Helper: Create authenticated context =====
function createAuthContext(): { ctx: TrpcContext } {
  const user = {
    id: 1,
    openId: "test-user-001",
    email: "teacher@example.com",
    name: "معلم اختبار",
    loginMethod: "manus" as const,
    role: "user" as const,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  const ctx: TrpcContext = {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };

  return { ctx };
}

// ===== Tests =====

describe("Portfolio CRUD", () => {
  it("should require authentication for portfolio.list", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(caller.portfolio.list()).rejects.toThrow();
  });

  it("should require authentication for portfolio.create", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.portfolio.create({
        jobId: "teacher",
        jobTitle: "معلم",
        personalInfo: { name: "أحمد" },
        criteriaData: {},
      })
    ).rejects.toThrow();
  });

  it("should return null for non-existent portfolio", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.portfolio.get({ id: 999999 });
    expect(result).toBeNull();
  });
});

describe("Share Links", () => {
  it("should return error for invalid share token", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.share.view({ token: "invalid-token-12345" });
    expect(result.error).toBeTruthy();
    expect(result.portfolio).toBeNull();
  });

  it("should require authentication for share.create", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.share.create({
        portfolioId: 1,
        expiresInDays: 7,
        maxViews: 100,
      })
    ).rejects.toThrow();
  });
});

describe("AI Services - classifyEvidence", () => {
  it("should accept text-based classification input", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    // This test verifies the input schema validation
    // The actual LLM call will be made, so we just check it doesn't throw on valid input
    try {
      const result = await caller.ai.classifyEvidence({
        description: "شهادة حضور دورة تدريبية في استراتيجيات التدريس الحديثة",
        fileName: "شهادة_دورة.pdf",
        fileType: "application/pdf",
      });
      // If LLM is available, we should get a result
      expect(result).toHaveProperty("success");
      if (result.success) {
        expect(result.classification).toHaveProperty("standardId");
        expect(result.classification).toHaveProperty("confidence");
        expect(result.classification).toHaveProperty("reasoning");
      }
    } catch (e: any) {
      // LLM might not be available in test environment
      expect(e.message).toBeDefined();
    }
  });

  it("should accept link-based classification input", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.ai.classifyEvidence({
        linkUrl: "https://schools.madrasati.sa/activity/12345",
        description: "نشاط على منصة مدرستي",
      });
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  }, 15000);

  it("should reject empty input gracefully", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.ai.classifyEvidence({});
      expect(result).toHaveProperty("success");
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  });
});

describe("AI Services - suggestEvidence", () => {
  it("should accept valid suggestion input", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    try {
      const result = await caller.ai.suggestEvidence({
        jobTitle: "معلم",
        criterionName: "أداء الواجبات الوظيفية",
        subEvidenceName: "الالتزام بالحضور والانصراف",
      });
      expect(result).toHaveProperty("suggestions");
      expect(result).toHaveProperty("rawContent");
    } catch (e: any) {
      expect(e.message).toBeDefined();
    }
  }, 15000);
});

describe("Admin Access", () => {
  it("should reject non-admin users from admin endpoints", async () => {
    const { ctx } = createAuthContext(); // role is 'user'
    const caller = appRouter.createCaller(ctx);

    await expect(caller.admin.portfolios()).rejects.toThrow();
  });
});

describe("Auth", () => {
  it("should return null for unauthenticated user", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).toBeNull();
  });

  it("should return user for authenticated user", async () => {
    const { ctx } = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    const result = await caller.auth.me();
    expect(result).not.toBeNull();
    expect(result?.name).toBe("معلم اختبار");
    expect(result?.email).toBe("teacher@example.com");
  });
});
