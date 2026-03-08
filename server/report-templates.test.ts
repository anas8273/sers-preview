import { describe, expect, it, beforeAll } from "vitest";
import { appRouter } from "./routers";
import type { TrpcContext } from "./_core/context";

type AuthenticatedUser = NonNullable<TrpcContext["user"]>;

function createAdminContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 1,
    openId: "admin-user",
    email: "admin@example.com",
    name: "Admin User",
    loginMethod: "manus",
    role: "admin",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

function createUserContext(): TrpcContext {
  const user: AuthenticatedUser = {
    id: 2,
    openId: "regular-user",
    email: "user@example.com",
    name: "Regular User",
    loginMethod: "manus",
    role: "user",
    createdAt: new Date(),
    updatedAt: new Date(),
    lastSignedIn: new Date(),
  };

  return {
    user,
    req: {
      protocol: "https",
      headers: {},
    } as TrpcContext["req"],
    res: {
      clearCookie: () => {},
    } as TrpcContext["res"],
  };
}

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

describe("reportTemplates", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());
  const publicCaller = appRouter.createCaller(createPublicContext());

  let createdTemplateId: number;

  describe("seed", () => {
    it("seeds default report templates successfully", async () => {
      const result = await adminCaller.reportTemplates.seed();
      expect(result).toEqual({ success: true });
    });
  });

  describe("list (public)", () => {
    it("returns active report templates for public users", async () => {
      const templates = await publicCaller.reportTemplates.list();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
      // All returned templates should be active
      for (const t of templates) {
        expect(t.isActive).toBe(true);
      }
    });
  });

  describe("listAll (admin only)", () => {
    it("returns all report templates for admin", async () => {
      const templates = await adminCaller.reportTemplates.listAll();
      expect(Array.isArray(templates)).toBe(true);
      expect(templates.length).toBeGreaterThan(0);
    });

    it("rejects non-admin users", async () => {
      await expect(userCaller.reportTemplates.listAll()).rejects.toThrow();
    });
  });

  describe("create (admin only)", () => {
    it("creates a new report template", async () => {
      const template = await adminCaller.reportTemplates.create({
        name: "قالب اختبار",
        description: "قالب للاختبار",
        category: "تقارير",
        fields: [
          { key: "title", label: "العنوان", type: "text", required: true, section: "info", sortOrder: 1 },
          { key: "description", label: "الوصف", type: "textarea", required: false, section: "content", sortOrder: 2 },
        ],
        layout: { columns: 1, direction: "rtl" },
        isDefault: false,
        sortOrder: 10,
      });

      expect(template).toBeDefined();
      expect(template.id).toBeDefined();
      expect(typeof template.id).toBe("number");
      createdTemplateId = template.id;
    });

    it("rejects non-admin users", async () => {
      await expect(
        userCaller.reportTemplates.create({
          name: "unauthorized",
          fields: [],
        })
      ).rejects.toThrow();
    });
  });

  describe("get (public)", () => {
    it("returns a specific report template by id", async () => {
      const template = await publicCaller.reportTemplates.get({ id: createdTemplateId });
      expect(template).toBeDefined();
      expect(template?.name).toBe("قالب اختبار");
      expect(template?.description).toBe("قالب للاختبار");
      expect(template?.category).toBe("تقارير");
      expect(Array.isArray(template?.fields)).toBe(true);
      expect(template?.fields.length).toBe(2);
    });

    it("returns null for non-existent template", async () => {
      const template = await publicCaller.reportTemplates.get({ id: 999999 });
      expect(template).toBeUndefined();
    });
  });

  describe("update (admin only)", () => {
    it("updates an existing report template", async () => {
      const updated = await adminCaller.reportTemplates.update({
        id: createdTemplateId,
        name: "قالب اختبار محدث",
        description: "تم تحديث الوصف",
        fields: [
          { key: "title", label: "العنوان", type: "text", required: true, section: "info", sortOrder: 1 },
          { key: "description", label: "الوصف", type: "textarea", required: false, section: "content", sortOrder: 2 },
          { key: "images", label: "الصور", type: "images", required: false, section: "evidence", sortOrder: 3 },
        ],
      });

      expect(updated).toBeDefined();

      // Verify the update
      const template = await publicCaller.reportTemplates.get({ id: createdTemplateId });
      expect(template?.name).toBe("قالب اختبار محدث");
      expect(template?.description).toBe("تم تحديث الوصف");
      expect(template?.fields.length).toBe(3);
    });

    it("rejects non-admin users", async () => {
      await expect(
        userCaller.reportTemplates.update({
          id: createdTemplateId,
          name: "unauthorized update",
        })
      ).rejects.toThrow();
    });
  });

  describe("delete (admin only)", () => {
    it("deletes a report template", async () => {
      const result = await adminCaller.reportTemplates.delete({ id: createdTemplateId });
      expect(result).toBeDefined();

      // Verify deletion
      const template = await publicCaller.reportTemplates.get({ id: createdTemplateId });
      expect(template).toBeUndefined();
    });

    it("rejects non-admin users", async () => {
      await expect(
        userCaller.reportTemplates.delete({ id: 1 })
      ).rejects.toThrow();
    });
  });
});

describe("userReport", () => {
  const adminCaller = appRouter.createCaller(createAdminContext());
  const userCaller = appRouter.createCaller(createUserContext());

  let templateId: number;
  let reportId: number;

  beforeAll(async () => {
    // Create a template for reports
    const template = await adminCaller.reportTemplates.create({
      name: "قالب لاختبار التقارير",
      fields: [
        { key: "title", label: "العنوان", type: "text", required: true, section: "info", sortOrder: 1 },
      ],
      layout: { columns: 1, direction: "rtl" },
    });
    templateId = template.id;
  });

  describe("create", () => {
    it("creates a new user report", async () => {
      const report = await userCaller.userReport.create({
        reportTemplateId: templateId,
        title: "تقرير اختبار",
        data: { title: "عنوان التقرير" },
        status: "draft",
      });

      expect(report).toBeDefined();
      expect(report.id).toBeDefined();
      reportId = report.id;
    });
  });

  describe("list", () => {
    it("returns user reports", async () => {
      const reports = await userCaller.userReport.list();
      expect(Array.isArray(reports)).toBe(true);
      expect(reports.length).toBeGreaterThan(0);
    });
  });

  describe("get", () => {
    it("returns a specific user report", async () => {
      const report = await userCaller.userReport.get({ id: reportId });
      expect(report).toBeDefined();
      expect(report?.title).toBe("تقرير اختبار");
    });

    it("returns null for other user's report", async () => {
      const report = await adminCaller.userReport.get({ id: reportId });
      expect(report).toBeNull();
    });
  });

  describe("update", () => {
    it("updates an existing user report", async () => {
      const updated = await userCaller.userReport.update({
        id: reportId,
        title: "تقرير محدث",
        data: { title: "عنوان محدث" },
        status: "completed",
      });

      expect(updated).toBeDefined();

      const report = await userCaller.userReport.get({ id: reportId });
      expect(report?.title).toBe("تقرير محدث");
      expect(report?.status).toBe("completed");
    });
  });

  describe("delete", () => {
    it("deletes a user report", async () => {
      const result = await userCaller.userReport.delete({ id: reportId });
      expect(result).toBeDefined();

      const report = await userCaller.userReport.get({ id: reportId });
      expect(report).toBeNull();
    });
  });
});
