import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { safeExternalHttpUrl, safeImageSrc } from "../client/src/lib/safe-url";
import { sanitizeCriteriaDataForShareView } from "./legacy-input-validation";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => {
  const actual = await importOriginal<typeof import("./db")>();
  return {
    ...actual,
    createPortfolio: vi.fn().mockResolvedValue({ id: 10 }),
    updatePortfolio: vi.fn().mockResolvedValue({ success: true }),
    createPdfTemplate: vi.fn().mockResolvedValue({ id: 20 }),
    updatePdfTemplate: vi.fn().mockResolvedValue({ success: true }),
    createUserTheme: vi.fn().mockResolvedValue({ id: 30 }),
    updateUserTheme: vi.fn().mockResolvedValue({ success: true }),
    getAllPdfTemplates: vi.fn(),
    getSharedPdfTemplateByToken: vi.fn(),
    getShareLinkByToken: vi.fn(),
    incrementShareLinkViews: vi.fn().mockResolvedValue(true),
    getPortfolioById: vi.fn(),
    getFilesByPortfolio: vi.fn().mockResolvedValue([]),
    createAuditLog: vi.fn().mockResolvedValue({ id: 1 }),
  };
});

vi.mock("./_core/notification", () => ({
  notifyOwner: vi.fn().mockResolvedValue(true),
}));

import { appRouter } from "./routers";
import * as db from "./db";

function makeCtx(options: { user?: { id: number; role: "user" | "admin" } | null; ip?: string } = {}): TrpcContext {
  return {
    user: options.user
      ? ({
          id: options.user.id,
          openId: `u-${options.user.id}`,
          email: `u${options.user.id}@example.com`,
          name: `User ${options.user.id}`,
          loginMethod: "manus",
          role: options.user.role,
          createdAt: new Date(),
          updatedAt: new Date(),
          lastSignedIn: new Date(),
        } as NonNullable<TrpcContext["user"]>)
      : null,
    req: {
      ip: options.ip ?? "198.51.100.44",
      socket: { remoteAddress: "127.0.0.1" },
      headers: {},
    } as unknown as TrpcContext["req"],
    res: {
      setHeader: vi.fn(),
      clearCookie: vi.fn(),
    } as unknown as TrpcContext["res"],
  };
}

describe("M2 client safe-url helpers", () => {
  it("allows only http and https external URLs", () => {
    expect(safeExternalHttpUrl("https://example.com/path?q=1")).toBe("https://example.com/path?q=1");
    expect(safeExternalHttpUrl("  http://schools.sa/file.pdf  ")).toBe("http://schools.sa/file.pdf");
    expect(safeExternalHttpUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalHttpUrl("JAVASCRIPT:alert(1)")).toBeNull();
    expect(safeExternalHttpUrl("vbscript:msgbox(1)")).toBeNull();
    expect(safeExternalHttpUrl("data:text/html,<script>alert(1)</script>")).toBeNull();
    expect(safeExternalHttpUrl("file:///etc/passwd")).toBeNull();
    expect(safeExternalHttpUrl("https://example.com/\nbad")).toBeNull();
    expect(safeExternalHttpUrl("")).toBeNull();
    expect(safeExternalHttpUrl(null)).toBeNull();
  });

  it("allows http/https and png/jpeg/webp base64 data images while rejecting svg/html/javascript", () => {
    expect(safeImageSrc("https://cdn.example.com/logo.png")).toBe("https://cdn.example.com/logo.png");
    expect(safeImageSrc("data:image/png;base64,iVBORw0KGgo=")).toBe("data:image/png;base64,iVBORw0KGgo=");
    expect(safeImageSrc("data:image/jpeg;base64,/9j/4AAQ")).toBe("data:image/jpeg;base64,/9j/4AAQ");
    expect(safeImageSrc("data:image/webp;base64,UklGRg==")).toBe("data:image/webp;base64,UklGRg==");
    expect(safeImageSrc("data:image/svg+xml;base64,PHN2Zz4=")).toBeNull();
    expect(safeImageSrc("data:text/html;base64,PGh0bWw+")).toBeNull();
    expect(safeImageSrc("javascript:alert(1)")).toBeNull();
  });
});

describe("M2 legacy router Zod validation & URL hardening", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects javascript: links and SVG data URIs in portfolio.create and portfolio.update", async () => {
    const caller = appRouter.createCaller(makeCtx({ user: { id: 1, role: "user" } }));
    await expect(
      caller.portfolio.create({
        jobId: "teacher",
        jobTitle: "معلم",
        personalInfo: { name: "أحمد" },
        criteriaData: {
          c1: {
            score: 4,
            evidences: [{ id: "e1", type: "link", link: "javascript:alert(1)" }],
          },
        },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.portfolio.update({
        id: 1,
        criteriaData: {
          c1: {
            score: 4,
            evidences: [{ id: "e1", type: "image", fileData: "data:image/svg+xml;base64,PHN2Zz4=" }],
          },
        },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      caller.portfolio.create({
        jobId: "teacher",
        jobTitle: "معلم",
        personalInfo: { name: "أحمد" },
        criteriaData: {
          c1: {
            score: 4,
            evidences: [{ id: "e1", type: "link", link: "https://example.com/proof", fileData: "data:image/png;base64,iVBORw0KGgo=" }],
          },
        },
      }),
    ).resolves.toEqual({ id: 10 });
  });

  it("rejects unsafe coverImageUrl/logoUrl in templates.create/update and themeData in userThemes.create/update", async () => {
    const admin = appRouter.createCaller(makeCtx({ user: { id: 1, role: "admin" } }));
    await expect(
      admin.templates.create({
        name: "قالب",
        headerBg: "#fff",
        headerText: "#000",
        accent: "#000",
        borderColor: "#000",
        bodyBg: "#fff",
        coverImageUrl: "javascript:alert(1)",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      admin.templates.update({
        id: 1,
        logoUrl: "data:image/svg+xml;base64,PHN2Zz4=",
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    const user = appRouter.createCaller(makeCtx({ user: { id: 2, role: "user" } }));
    await expect(
      user.userThemes.create({
        name: "ثيم",
        themeData: { coverBackgroundUrl: "javascript:alert(1)" },
      }),
    ).rejects.toMatchObject({ code: "BAD_REQUEST" });

    await expect(
      user.userThemes.create({
        name: "ثيم سليم",
        themeData: {
          headerBg: "#ffffff",
          coverBackgroundUrl: "data:image/png;base64,iVBORw0KGgo=",
        },
      }),
    ).resolves.toEqual({ id: 30 });
  });

  it("queries indexed getSharedPdfTemplateByToken, projects safe fields, and rate-limits getByShareToken", async () => {
    vi.mocked(db.getSharedPdfTemplateByToken).mockResolvedValue({
      id: 77,
      name: "قالب رسمي",
      description: "وصف",
      headerBg: "#047857",
      headerText: "#ffffff",
      accent: "#059669",
      borderColor: "#d1fae5",
      bodyBg: "#ffffff",
      fontFamily: "Cairo",
      coverImageUrl: "https://example.com/cover.png",
      logoUrl: "",
      templateLayout: { headerStyle: 1, fieldStyle: "table" } as never,
      isDefault: true,
      isActive: true,
      sortOrder: 1,
      shareToken: "share_token_123456",
      isShared: true,
      createdBy: 999,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const publicCaller = appRouter.createCaller(makeCtx({ ip: "198.51.100.77" }));
    const projected = await publicCaller.templates.getByShareToken({ token: "share_token_123456" });
    expect(db.getAllPdfTemplates).not.toHaveBeenCalled();
    expect(db.getSharedPdfTemplateByToken).toHaveBeenCalledWith("share_token_123456");
    expect(projected).toEqual({
      name: "قالب رسمي",
      description: "وصف",
      headerBg: "#047857",
      headerText: "#ffffff",
      accent: "#059669",
      borderColor: "#d1fae5",
      bodyBg: "#ffffff",
      fontFamily: "Cairo",
      coverImageUrl: "https://example.com/cover.png",
      logoUrl: "",
      templateLayout: { headerStyle: 1, fieldStyle: "table" },
    });
    expect(projected).not.toHaveProperty("createdBy");
    expect(projected).not.toHaveProperty("id");
    expect(projected).not.toHaveProperty("shareToken");

    await expect(publicCaller.templates.getByShareToken({ token: "bad" })).rejects.toMatchObject({ code: "BAD_REQUEST" });

    for (let i = 1; i < 30; i++) {
      await publicCaller.templates.getByShareToken({ token: "share_token_123456" });
    }
    await expect(publicCaller.templates.getByShareToken({ token: "share_token_123456" })).rejects.toMatchObject({
      code: "TOO_MANY_REQUESTS",
    });
  });

  it("unifies share.view error messages, keys rate limiter by ctx.req.ip, and projects portfolio safely", async () => {
    vi.mocked(db.getShareLinkByToken).mockResolvedValueOnce(undefined);
    const missing = await appRouter.createCaller(makeCtx({ ip: "203.0.113.10" })).share.view({ token: "valid_token_1" });
    vi.mocked(db.getShareLinkByToken).mockResolvedValueOnce({
      id: 1, portfolioId: 5, userId: 9, token: "valid_token_2",
      expiresAt: new Date(Date.now() - 10_000), hasPassword: false, passwordHash: null,
      viewCount: 0, maxViews: 10, isActive: true, createdAt: new Date(),
    });
    const expired = await appRouter.createCaller(makeCtx({ ip: "203.0.113.11" })).share.view({ token: "valid_token_2" });
    vi.mocked(db.getShareLinkByToken).mockResolvedValueOnce({
      id: 2, portfolioId: 5, userId: 9, token: "valid_token_3",
      expiresAt: new Date(Date.now() + 60_000), hasPassword: false, passwordHash: null,
      viewCount: 5, maxViews: 5, isActive: true, createdAt: new Date(),
    });
    const maxViews = await appRouter.createCaller(makeCtx({ ip: "203.0.113.12" })).share.view({ token: "valid_token_3" });
    expect(missing.error).toBe("الرابط غير صالح أو منتهي الصلاحية");
    expect(expired.error).toBe(missing.error);
    expect(maxViews.error).toBe(missing.error);

    const activeGrant = {
      id: 3, portfolioId: 5, userId: 9, token: "valid_token_4",
      expiresAt: new Date(Date.now() + 60_000), hasPassword: false, passwordHash: null,
      viewCount: 0, maxViews: 10, isActive: true, createdAt: new Date(),
    };
    vi.mocked(db.getShareLinkByToken).mockResolvedValue(activeGrant);
    vi.mocked(db.getPortfolioById).mockResolvedValue({
      id: 5,
      userId: 99,
      jobId: "teacher",
      jobTitle: "معلم",
      personalInfo: { name: "خالد" },
      criteriaData: {
        c1: {
          score: 5,
          evidences: [
            { id: "e1", type: "link", link: "javascript:alert(1)" },
            { id: "e2", type: "link", link: "https://example.com/safe" },
            { id: "e3", type: "image", fileData: "data:image/svg+xml;base64,PHN2Zz4=" },
          ],
        },
      },
      customCriteria: [],
      themeId: "classic",
      completionPercentage: 80,
      status: "submitted",
      reviewNotes: "ملاحظة داخلية سرية",
      reviewedBy: 88,
      reviewedAt: new Date(),
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    const viewed = await appRouter.createCaller(makeCtx({ ip: "203.0.113.13" })).share.view({ token: "valid_token_4" });
    expect(viewed.error).toBeNull();
    expect(viewed.portfolio).not.toHaveProperty("userId");
    expect(viewed.portfolio).not.toHaveProperty("reviewNotes");
    expect(viewed.portfolio).not.toHaveProperty("reviewedBy");
    const c1 = (viewed.portfolio?.criteriaData as Record<string, any>).c1;
    expect(c1.evidences[0].link).toBe("");
    expect(c1.evidences[1].link).toBe("https://example.com/safe");
    expect(c1.evidences[2].fileData).toBeNull();
  });
});

describe("M2 client remediation & tsconfig checks", () => {
  it("fixes SharedTemplate ESM require crash and applies safe-url across legacy pages", () => {
    const sharedTemplate = readFileSync(resolve("client/src/pages/SharedTemplate.tsx"), "utf8");
    const sharedPortfolio = readFileSync(resolve("client/src/pages/SharedPortfolio.tsx"), "utf8");
    const portfolioBuilder = readFileSync(resolve("client/src/pages/PortfolioBuilder.tsx"), "utf8");
    const adminDashboard = readFileSync(resolve("client/src/pages/AdminDashboard.tsx"), "utf8");
    const templateManager = readFileSync(resolve("client/src/pages/TemplateManager.tsx"), "utf8");
    const publicOutput = readFileSync(resolve("client/src/pages/PublicOutput.tsx"), "utf8");
    const workDetail = readFileSync(resolve("client/src/pages/WorkDetail.tsx"), "utf8");
    const reportEditor = readFileSync(resolve("client/src/pages/WorkReportEditor.tsx"), "utf8");
    const evidenceLibrary = readFileSync(resolve("client/src/pages/EvidenceLibrary.tsx"), "utf8");
    const store = readFileSync(resolve("client/src/pages/Store.tsx"), "utf8");
    const tsconfig = JSON.parse(readFileSync(resolve("tsconfig.json"), "utf8")) as { exclude: string[] };

    expect(sharedTemplate).toContain('import { getLoginUrl } from "@/const";');
    expect(sharedTemplate).not.toContain('require("@/const")');
    expect(sharedTemplate).toContain("safeImageSrc");
    expect(sharedPortfolio).toContain("safeExternalHttpUrl");
    expect(sharedPortfolio).toContain("safeImageSrc");
    expect(portfolioBuilder).toContain("safeExternalHttpUrl");
    expect(adminDashboard).toContain("safeExternalHttpUrl");
    expect(adminDashboard).toContain("safeImageSrc(formData.coverImageUrl)");
    expect(adminDashboard).toContain("safeImageSrc(formData.logoUrl)");
    expect(templateManager).toContain("safeImageSrc");

    expect(publicOutput).toContain("data?.report.institution");
    expect(publicOutput).toContain("institution?.visible");
    expect(publicOutput).toContain("institution.schoolName");
    expect(publicOutput).toContain("institution.ministryLogo");
    expect(publicOutput).toContain("institution.signers");
    expect(publicOutput).toContain("safeImageSrc");
    expect(workDetail).toContain("trpc.domain.work.update.useMutation");
    expect(reportEditor).toContain("useUserStore");
    expect(reportEditor).toContain("تعبئة من بيانات الحساب/المدرسة");
    expect(evidenceLibrary).toContain("safeExternalHttpUrl");
    expect(evidenceLibrary).toContain("trpc.domain.standards.list");
    expect(evidenceLibrary).toContain("trpc.domain.standards.linkAsset");
    expect(store).toContain("trpc.domain.commerce.status");
    expect(store).toContain("O001");

    expect(tsconfig.exclude).not.toContain("client/src/stores/**/*");
  });

  it("blocks __proto__, constructor, and prototype pollution in sanitizeCriteriaDataForShareView", () => {
    const parsed = JSON.parse(
      '{"__proto__":{"polluted":true},"constructor":{"prototype":{"polluted2":true}},"prototype":{"polluted3":true},"c1":{"score":5,"evidences":[{"id":"e1","type":"link","link":"javascript:alert(1)"}]}}',
    ) as unknown;

    const sanitized = sanitizeCriteriaDataForShareView(parsed) as Record<string, any>;

    expect(Object.getPrototypeOf(sanitized)).toBe(Object.prototype);
    expect(Object.prototype.hasOwnProperty.call(sanitized, "__proto__")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, "constructor")).toBe(false);
    expect(Object.prototype.hasOwnProperty.call(sanitized, "prototype")).toBe(false);
    expect(sanitized.polluted).toBeUndefined();
    expect(sanitized.polluted2).toBeUndefined();
    expect(sanitized.polluted3).toBeUndefined();
    expect(({} as Record<string, unknown>).polluted).toBeUndefined();
    expect(sanitized.c1.score).toBe(5);
    expect(sanitized.c1.evidences[0].link).toBe("");
  });
});
