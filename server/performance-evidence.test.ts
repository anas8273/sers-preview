import { describe, expect, it, vi, beforeEach } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAuthContext(role: "user" | "admin" = "user"): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user-001",
    email: "teacher@example.com",
    name: "أحمد المعلم",
    loginMethod: "manus",
    role,
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

function createPublicContext(): TrpcContext {
  return {
    user: null,
    req: { protocol: "https", headers: {} } as TrpcContext["req"],
    res: {
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("Portfolio CRUD", () => {
  it("portfolio.list returns empty array for new user", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.portfolio.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("portfolio.create creates a new portfolio and returns it", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.portfolio.create({
      jobId: "teacher",
      jobTitle: "معلم",
      personalInfo: { name: "أحمد", school: "مدرسة النور" },
      criteriaData: {},
      customCriteria: [],
      themeId: "official",
      completionPercentage: 0,
    });
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
    expect(typeof result.id).toBe("number");
  });

  it("portfolio.get returns created portfolio", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.portfolio.create({
      jobId: "teacher",
      jobTitle: "معلم",
      personalInfo: { name: "أحمد", school: "مدرسة النور" },
      criteriaData: { "std-1": { score: 4, notes: "", evidences: [] } },
      themeId: "official",
      completionPercentage: 25,
    });
    const fetched = await caller.portfolio.get({ id: created.id });
    expect(fetched).not.toBeNull();
    expect(fetched!.jobId).toBe("teacher");
    expect(fetched!.jobTitle).toBe("معلم");
  });

  it("portfolio.update modifies existing portfolio", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.portfolio.create({
      jobId: "teacher",
      jobTitle: "معلم",
      personalInfo: { name: "أحمد" },
      criteriaData: {},
      themeId: "official",
      completionPercentage: 0,
    });
    const updated = await caller.portfolio.update({
      id: created.id,
      themeId: "blue",
      completionPercentage: 50,
    });
    expect(updated).toBeDefined();
  });

  it("portfolio.delete removes portfolio", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const created = await caller.portfolio.create({
      jobId: "teacher",
      jobTitle: "معلم",
      personalInfo: { name: "أحمد" },
      criteriaData: {},
      themeId: "official",
      completionPercentage: 0,
    });
    await caller.portfolio.delete({ id: created.id });
    const fetched = await caller.portfolio.get({ id: created.id });
    expect(fetched).toBeNull();
  });

  it("portfolio.get returns null for non-existent id", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const fetched = await caller.portfolio.get({ id: 999999 });
    expect(fetched).toBeNull();
  });
});

describe("PDF Templates", () => {
  it("templates.list returns array of templates", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list();
    expect(Array.isArray(result)).toBe(true);
  });

  it("admin can create a template", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.create({
      name: "قالب اختبار",
      headerBg: "#1B5E20",
      headerText: "#ffffff",
      accent: "#2E7D32",
      borderColor: "#1B5E20",
      bodyBg: "#ffffff",
      description: "قالب للاختبار",
    });
    expect(result).toBeDefined();
    expect(result.id).toBeDefined();
  });

  it("admin can seed default templates", async () => {
    const ctx = createAuthContext("admin");
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.seed();
    expect(result).toEqual({ success: true });
  });
});

describe("Share Links", () => {
  it("create share link and view it", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);

    // Create a portfolio first
    const portfolio = await caller.portfolio.create({
      jobId: "teacher",
      jobTitle: "معلم",
      personalInfo: { name: "أحمد" },
      criteriaData: {},
      themeId: "official",
      completionPercentage: 0,
    });

    // Create share link
    const link = await caller.share.create({
      portfolioId: portfolio.id,
      expiresInDays: 7,
      maxViews: 100,
    });
    expect(link.token).toBeDefined();
    expect(typeof link.token).toBe("string");
    expect(link.token.length).toBeGreaterThan(10);

    // View share link (public)
    const publicCtx = createPublicContext();
    const publicCaller = appRouter.createCaller(publicCtx);
    const viewed = await publicCaller.share.view({ token: link.token });
    expect(viewed.error).toBeNull();
    expect(viewed.portfolio).not.toBeNull();
  });

  it("invalid share token returns error", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.share.view({ token: "invalid-token-xyz" });
    expect(result.error).toBeTruthy();
    expect(result.portfolio).toBeNull();
  });
});

describe("Auth", () => {
  it("auth.me returns user for authenticated context", async () => {
    const ctx = createAuthContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).not.toBeNull();
    expect(user!.name).toBe("أحمد المعلم");
  });

  it("auth.me returns null for public context", async () => {
    const ctx = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const user = await caller.auth.me();
    expect(user).toBeNull();
  });
});
