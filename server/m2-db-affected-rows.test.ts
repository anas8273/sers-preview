import { beforeEach, describe, expect, it, vi } from "vitest";
import { TRPCError } from "@trpc/server";

const { mockUpdate, mockDelete, mockDrizzle } = vi.hoisted(() => {
  const affected = { value: 0 };
  const update = vi.fn(() => ({
    set: () => ({
      where: async () => [{ affectedRows: affected.value }],
    }),
  }));
  const del = vi.fn(() => ({
    where: async () => [{ affectedRows: affected.value }],
  }));
  const drizzle = vi.fn(() => ({
    update,
    delete: del,
    select: vi.fn(),
    insert: vi.fn(),
  }));
  return { mockUpdate: update, mockDelete: del, mockDrizzle: drizzle, affectedRef: affected };
});

let currentAffectedRows = 0;
vi.mock("drizzle-orm/mysql2", () => ({
  drizzle: () => ({
    update: () => ({
      set: () => ({
        where: async () => [{ affectedRows: currentAffectedRows }],
      }),
    }),
    delete: () => ({
      where: async () => [{ affectedRows: currentAffectedRows }],
    }),
  }),
}));

describe("server/db affectedRows === 0 NOT_FOUND enforcement", () => {
  beforeEach(() => {
    process.env.DATABASE_URL = "mysql://test:test@127.0.0.1:3306/sers_unit";
    currentAffectedRows = 0;
  });

  it("throws TRPCError NOT_FOUND when affectedRows is 0 across all legacy mutators", async () => {
    const db = await import("./db");
    const calls = [
      () => db.updateUserTheme(999, 1, { name: "x" }),
      () => db.deleteUserTheme(999, 1),
      () => db.deleteEvidenceComment(999, 1, false),
      () => db.deactivateOnlineExam(999, 1),
      () => db.deleteUploadedFile(999, 1),
      () => db.deactivateShareLink(999, 1),
      () => db.reviewPortfolio(999, 1, "approved", "ok"),
      () => db.updatePdfTemplate(999, { name: "x" }),
      () => db.deletePdfTemplate(999),
    ];

    for (const run of calls) {
      await expect(run()).rejects.toMatchObject({
        name: "TRPCError",
        code: "NOT_FOUND",
      });
    }
    expect(mockUpdate).toBeDefined();
    expect(mockDelete).toBeDefined();
    expect(mockDrizzle).toBeDefined();
  });

  it("returns { success: true } when affectedRows is 1", async () => {
    currentAffectedRows = 1;
    const db = await import("./db");
    await expect(db.updateUserTheme(1, 1, { name: "ok" })).resolves.toEqual({ success: true });
    await expect(db.deleteUserTheme(1, 1)).resolves.toEqual({ success: true });
    await expect(db.deleteEvidenceComment(1, 1, false)).resolves.toEqual({ success: true });
    await expect(db.deactivateOnlineExam(1, 1)).resolves.toEqual({ success: true });
    await expect(db.deleteUploadedFile(1, 1)).resolves.toEqual({ success: true });
    await expect(db.deactivateShareLink(1, 1)).resolves.toEqual({ success: true });
    await expect(db.reviewPortfolio(1, 1, "approved", "ok")).resolves.toEqual({ success: true });
    await expect(db.updatePdfTemplate(1, { name: "ok" })).resolves.toEqual({ success: true });
    await expect(db.deletePdfTemplate(1)).resolves.toEqual({ success: true });
    expect(TRPCError).toBeDefined();
  });
});
