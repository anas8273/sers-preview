/**
 * اختبارات التحقق من:
 * 1. القالب الافتراضي المخزن في قاعدة البيانات
 * 2. تصدير Word endpoint
 * 3. رفع الملفات endpoint
 *
 * ملاحظة: القوالب الثلاثة الأساسية مدمجة في الواجهة، بينما seedDefaultTemplates
 * ينشئ قالب DB إضافيًا واحدًا باسم «بطاقات - شريط جانبي».
 */
import { describe, expect, it } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createPublicContext(): { ctx: TrpcContext } {
  const ctx: TrpcContext = {
    user: null,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

function createAuthContext(role: "user" | "admin" = "user"): { ctx: TrpcContext } {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "test-user",
    email: "test@example.com",
    name: "Test User",
    loginMethod: "manus",
    role,
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
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
  return { ctx };
}

// ─── القالب الافتراضي في قاعدة البيانات ─────────────────────
describe("Canonical database template", () => {
  it("should expose the seeded sidebar-card template", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const result = await caller.templates.list();

    expect(Array.isArray(result)).toBe(true);
    expect(result.length).toBeGreaterThanOrEqual(1);

    const names = result.map((template: any) => template.name);
    expect(names).toContain("بطاقات - شريط جانبي");
  });
});

// ─── تصدير Word endpoint ────────────────────────────────────
describe("DOCX Export", () => {
  it("should have renderHtmlToDocx function available", async () => {
    const { renderHtmlToDocx } = await import("./docx-renderer");
    expect(typeof renderHtmlToDocx).toBe("function");
  });
});

// ─── رفع الملفات ────────────────────────────────────────────
describe("File Upload", () => {
  it("file.upload procedure should exist and require auth", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);

    await expect(
      caller.file.upload({
        filename: "test.png",
        contentType: "image/png",
        data: "base64data",
      })
    ).rejects.toThrow();
  });

  it("file.upload should accept authenticated users", async () => {
    const { ctx } = createAuthContext("user");
    const caller = appRouter.createCaller(ctx);

    try {
      await caller.file.upload({
        filename: "test.png",
        contentType: "image/png",
        data: "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
      });
    } catch (error: any) {
      // قد يفشل التخزين الخارجي في بيئة الاختبار، لكن لا ينبغي أن يكون رفض مصادقة.
      expect(error.message).not.toContain("login");
      expect(error.message).not.toContain("10001");
    }
  });
});

// ─── التحقق من بنية القوالب ─────────────────────────────────
describe("Template structure", () => {
  it("DB templates should have required fields", async () => {
    const { ctx } = createPublicContext();
    const caller = appRouter.createCaller(ctx);
    const templates = await caller.templates.list();

    for (const template of templates) {
      expect(template).toHaveProperty("id");
      expect(template).toHaveProperty("name");
      expect(typeof template.name).toBe("string");
      expect(template.name.length).toBeGreaterThan(0);
    }
  });
});
