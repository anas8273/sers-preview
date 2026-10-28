import { createHash } from "node:crypto";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./routers";
import * as db from "./db";
import { notifyOwner } from "./_core/notification";
import { hashProtectedOutputPassword, verifyProtectedOutputPassword } from "./output-password";
import type { TrpcContext } from "./_core/context";

vi.mock("./db", async importOriginal => ({ ...await importOriginal<typeof import("./db")>(), createShareLink: vi.fn(), getShareLinkByToken: vi.fn(), incrementShareLinkViews: vi.fn(), getPortfolioById: vi.fn(), getFilesByPortfolio: vi.fn(), createAuditLog: vi.fn() }));
vi.mock("./_core/notification", () => ({ notifyOwner: vi.fn().mockResolvedValue(true) }));
let sequence = 0;
function caller(owner = false, address?: string) {
  const current = ++sequence;
  return appRouter.createCaller({ user: owner ? { id: 7, role: "user" } : null, req: { socket: { remoteAddress: address ?? `198.51.100.${current}` }, headers: { "x-forwarded-for": `spoof-${current}` } }, res: {} } as unknown as TrpcContext);
}
function grant(overrides: Record<string, unknown> = {}) {
  return { id: 11, portfolioId: 21, userId: 7, token: "legacy-fixture", expiresAt: new Date(Date.now() + 60_000), hasPassword: false, passwordHash: null, viewCount: 0, maxViews: 1, isActive: true, createdAt: new Date(), ...overrides };
}
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(db.getShareLinkByToken).mockResolvedValue(grant() as never);
  vi.mocked(db.incrementShareLinkViews).mockResolvedValue(true);
  vi.mocked(db.getPortfolioById).mockResolvedValue({ id: 21, userId: 7, jobTitle: "بيانات اصطناعية" } as never);
  vi.mocked(db.getFilesByPortfolio).mockResolvedValue([]);
  vi.mocked(db.createShareLink).mockResolvedValue({ id: 11 });
});

describe("legacy share password, attempt and view controls", () => {
  it("writes unique salted scrypt hashes and refuses weak or fractional creation parameters", async () => {
    const owner = caller(true);
    await owner.share.create({ portfolioId: 21, password: "fixture-secret", maxViews: 1, expiresInDays: 2 });
    await owner.share.create({ portfolioId: 21, password: "fixture-secret", maxViews: 1, expiresInDays: 2 });
    const [first, second] = vi.mocked(db.createShareLink).mock.calls.map(call => call[0].passwordHash!);
    expect(first).toMatch(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(first).not.toBe(second); expect(first).not.toContain("fixture-secret");
    expect(verifyProtectedOutputPassword("fixture-secret", first)).toBe(true);
    for (const extra of [{ password: "short" }, { maxViews: 0.2 }, { expiresInDays: 1.5 }, { portfolioId: -1 }]) await expect(owner.share.create({ portfolioId: 21, ...extra })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.createShareLink).toHaveBeenCalledTimes(2);
  });

  it("reads new scrypt and legacy SHA/plaintext passwords while never claiming invalid guesses", async () => {
    for (const stored of [hashProtectedOutputPassword("fixture-secret"), createHash("sha256").update("fixture-secret").digest("hex"), "fixture-secret"]) {
      vi.mocked(db.getShareLinkByToken).mockResolvedValue(grant({ hasPassword: true, passwordHash: stored }) as never);
      const publicCaller = caller();
      expect(await publicCaller.share.view({ token: "legacy-fixture", password: "wrong" })).toMatchObject({ portfolio: null, requiresPassword: true });
      expect((await publicCaller.share.view({ token: "legacy-fixture", password: "fixture-secret" })).error).toBeNull();
      expect(db.incrementShareLinkViews).toHaveBeenLastCalledWith(11, stored);
    }
    expect(db.incrementShareLinkViews).toHaveBeenCalledTimes(3);
  });

  it("charges token attempts before password verification and ignores forwarded-IP spoofing", async () => {
    vi.mocked(db.getShareLinkByToken).mockResolvedValue(grant({ hasPassword: true, passwordHash: "fixture-secret" }) as never);
    const address = `192.0.2.${++sequence}`;
    for (let index = 0; index < 30; index++) {
      const publicCaller = caller(false, address);
      expect(await publicCaller.share.view({ token: "legacy-fixture", password: `wrong-${index}` })).toMatchObject({ requiresPassword: true });
    }
    const blocked = await caller(false, address).share.view({ token: "legacy-fixture", password: "fixture-secret" });
    expect(blocked).toMatchObject({ portfolio: null, error: "محاولات كثيرة؛ حاول لاحقًا" });
    expect(db.getShareLinkByToken).toHaveBeenCalledTimes(30);
    expect(db.incrementShareLinkViews).not.toHaveBeenCalled();
  });

  it("limits rotating invalid tokens by the direct connection address", async () => {
    vi.mocked(db.getShareLinkByToken).mockResolvedValue(undefined);
    const publicCaller = caller();
    for (let index = 0; index < 120; index++) await publicCaller.share.view({ token: `missing-${index}` });
    expect(await publicCaller.share.view({ token: "missing-121" })).toMatchObject({ error: "محاولات كثيرة؛ حاول لاحقًا", portfolio: null });
    expect(db.getShareLinkByToken).toHaveBeenCalledTimes(120);
  });

  it("does not read content or notify when an atomic view claim is denied or unavailable", async () => {
    vi.mocked(db.incrementShareLinkViews).mockResolvedValueOnce(false);
    expect(await caller().share.view({ token: "legacy-fixture" })).toMatchObject({ portfolio: null });
    expect(db.getPortfolioById).not.toHaveBeenCalled(); expect(db.getFilesByPortfolio).not.toHaveBeenCalled(); expect(notifyOwner).not.toHaveBeenCalled();
    vi.mocked(db.incrementShareLinkViews).mockRejectedValueOnce(new Error("Share view admission unavailable"));
    await expect(caller().share.view({ token: "legacy-fixture" })).rejects.toMatchObject({ code: "INTERNAL_SERVER_ERROR" });
    expect(db.getPortfolioById).not.toHaveBeenCalled();
  });

  it("rechecks revocation, expiry and password identity after content reads before disclosure", async () => {
    for (const changed of [undefined, grant({ isActive: false }), grant({ expiresAt: new Date(Date.now() - 1000) }), grant({ passwordHash: "changed", hasPassword: true }), grant({ portfolioId: 999 })]) {
      vi.mocked(db.getShareLinkByToken).mockResolvedValueOnce(grant() as never).mockResolvedValueOnce(changed as never);
      expect(await caller().share.view({ token: "legacy-fixture" })).toMatchObject({ portfolio: null, error: "الرابط لم يعد متاحًا" });
    }
    expect(db.getFilesByPortfolio).toHaveBeenCalledTimes(5);
    expect(notifyOwner).not.toHaveBeenCalled();
  });

  it("bounds public token and password inputs before querying storage", async () => {
    for (const token of ["", "A".repeat(129), "https://example.invalid/token", "token\n"]) await expect(caller().share.view({ token })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    await expect(caller().share.view({ token: "legacy-fixture", password: "A".repeat(65) })).rejects.toMatchObject({ code: "BAD_REQUEST" });
    expect(db.getShareLinkByToken).not.toHaveBeenCalled();
  });
});
