import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq, sql } from "drizzle-orm";
import { portfolios, shareLinks, users } from "../drizzle/schema";
import { createShareLink, deactivateShareLink, getDb, incrementShareLinkViews } from "./db";
import { hashProtectedOutputPassword } from "./output-password";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("legacy share atomic view admission on real MySQL", () => {
  let owner = 0, portfolioId = 0;
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Requires disposable CI database");
    const db = (await getDb())!;
    const [raw] = await db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    const row = (raw as unknown as { name: string; version: string }[])[0];
    expect(row.name).toBe("sers_test"); expect(row.version).toMatch(/^8\.4\./);
    const [inserted] = await db.insert(users).values({ openId: `legacy-share-${randomUUID()}` }); owner = Number(inserted.insertId);
    const [portfolio] = await db.insert(portfolios).values({ userId: owner, jobId: "synthetic", jobTitle: "ملف اصطناعي", personalInfo: {}, criteriaData: {} }); portfolioId = Number(portfolio.insertId);
  });
  afterAll(async () => {
    if (!owner) return;
    const db = (await getDb())!;
    if (portfolioId) { await db.delete(shareLinks).where(eq(shareLinks.portfolioId, portfolioId)); await db.delete(portfolios).where(eq(portfolios.id, portfolioId)); }
    await db.delete(users).where(eq(users.id, owner));
  });
  async function fixture(options: { maxViews?: number; passwordHash?: string | null; expiresAt?: Date } = {}) {
    return createShareLink({ userId: owner, portfolioId, token: randomUUID(), isActive: true, expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000), maxViews: options.maxViews ?? 1, viewCount: 0, passwordHash: options.passwordHash ?? null, hasPassword: !!options.passwordHash });
  }
  async function views(id: number) { const [row] = await (await getDb())!.select().from(shareLinks).where(eq(shareLinks.id, id)); return row.viewCount; }

  it("admits exactly one of twenty concurrent requests when maxViews is one", async () => {
    const link = await fixture();
    const claims = await Promise.all(Array.from({ length: 20 }, () => incrementShareLinkViews(link.id, null)));
    expect(claims.filter(Boolean)).toHaveLength(1); expect(await views(link.id)).toBe(1);
    expect(await incrementShareLinkViews(link.id, null)).toBe(false);
  });

  it("counts unlimited grants atomically without losing concurrent increments", async () => {
    const link = await fixture({ maxViews: 0 });
    expect(await Promise.all(Array.from({ length: 20 }, () => incrementShareLinkViews(link.id, null)))).toEqual(Array(20).fill(true));
    expect(await views(link.id)).toBe(20);
  });

  it("refuses expired or deactivated grants without incrementing views", async () => {
    const expired = await fixture({ expiresAt: new Date(Date.now() - 10_000) });
    expect(await incrementShareLinkViews(expired.id, null)).toBe(false); expect(await views(expired.id)).toBe(0);
    const deactivated = await fixture(); await deactivateShareLink(deactivated.id, owner);
    expect(await incrementShareLinkViews(deactivated.id, null)).toBe(false); expect(await views(deactivated.id)).toBe(0);
  });

  it("uses exact current password bytes including case and NULL transitions", async () => {
    const before = hashProtectedOutputPassword("old-fixture-secret"), after = hashProtectedOutputPassword("new-fixture-secret");
    const link = await fixture({ passwordHash: before });
    await (await getDb())!.update(shareLinks).set({ passwordHash: after }).where(eq(shareLinks.id, link.id));
    expect(await incrementShareLinkViews(link.id, before)).toBe(false); expect(await views(link.id)).toBe(0);
    expect(await incrementShareLinkViews(link.id, after)).toBe(true);
    const legacy = await fixture({ passwordHash: "lowercase" });
    await (await getDb())!.update(shareLinks).set({ passwordHash: "LOWERCASE" }).where(eq(shareLinks.id, legacy.id));
    expect(await incrementShareLinkViews(legacy.id, "lowercase")).toBe(false); expect(await views(legacy.id)).toBe(0);
    const unprotected = await fixture();
    await (await getDb())!.update(shareLinks).set({ hasPassword: true, passwordHash: after }).where(eq(shareLinks.id, unprotected.id));
    expect(await incrementShareLinkViews(unprotected.id, null)).toBe(false); expect(await views(unprotected.id)).toBe(0);
  });
});
