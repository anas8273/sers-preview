import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ASSET_USAGE_VERSION_SCAN_LIMIT, AssetDeleteConflictError } from "./domain-db";

const domainDbSource = readFileSync(resolve(import.meta.dirname, "domain-db.ts"), "utf8");
const domainRouterSource = readFileSync(resolve(import.meta.dirname, "domain-router.ts"), "utf8");

describe("R04 asset usage tracking and safe delete contracts", () => {
  it("documents a bounded scan limit for historical work versions", () => {
    expect(ASSET_USAGE_VERSION_SCAN_LIMIT).toBeGreaterThan(0);
    expect(ASSET_USAGE_VERSION_SCAN_LIMIT).toBeLessThanOrEqual(500);
    expect(domainDbSource).toContain(".limit(ASSET_USAGE_VERSION_SCAN_LIMIT)");
  });

  it("enforces read-scope filtering in getAssetUsageForUser", () => {
    const fnStart = domainDbSource.indexOf("export async function getAssetUsageForUser");
    const fnEnd = domainDbSource.indexOf("export async function deleteAssetForUser");
    expect(fnStart).toBeGreaterThan(0);
    expect(fnEnd).toBeGreaterThan(fnStart);
    const body = domainDbSource.slice(fnStart, fnEnd);

    expect(body).toContain('assertAssetAccess(userId, assetId, "read")');
    expect(body).toContain("readableWorkScope");
    expect(body).toContain("isNull(workItems.deletedAt)");
  });

  it("enforces CONFLICT when active links exist without unlinkActive and protects approved/archived works", () => {
    const fnStart = domainDbSource.indexOf("export async function deleteAssetForUser");
    expect(fnStart).toBeGreaterThan(0);
    const body = domainDbSource.slice(fnStart);

    expect(body).toContain("db.transaction");
    expect(body).toContain("lockWriteScope(tx, userId");
    expect(body).toContain('.for("update")');
    expect(body).toContain("الشاهد مستخدم في أعمال أخرى. أكد فك الربط ثم الحذف.");
    expect(body).toContain('link.workStatus === "approved" || link.workStatus === "archived"');
    expect(body).toContain("مرتبط بعمل معتمد أو مؤرشف");
    // Must only soft-delete assets and NEVER mutate work_versions
    expect(body).toContain("tx.update(assets).set({ deletedAt: new Date() })");
    expect(body).not.toContain("tx.update(workVersions)");
    expect(body).not.toContain("tx.delete(workVersions)");
  });

  it("maps AssetDeleteConflictError to TRPC CONFLICT in domainRouter", () => {
    expect(new AssetDeleteConflictError("test")).toBeInstanceOf(Error);
    expect(domainRouterSource).toContain("usage: protectedProcedure");
    expect(domainRouterSource).toContain("delete: protectedProcedure");
    expect(domainRouterSource).toContain("if (error instanceof AssetDeleteConflictError) throw conflict(error.message)");
  });
});
