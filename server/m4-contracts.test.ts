import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { sanitizeAiTextInput } from "./ai-data-policy";
import { isCommerceSandboxEnabled } from "./commerce-sandbox";
import { commerceRouter } from "./commerce-router";

const standardsDbSource = readFileSync(resolve(import.meta.dirname, "standards-db.ts"), "utf8");
const commerceDbSource = readFileSync(resolve(import.meta.dirname, "commerce-sandbox.ts"), "utf8");

describe("M4 AI privacy stripping of reportIdentity (R20)", () => {
  it("strips reportIdentity object and top-level/nested identity keys before AI provider I/O", () => {
    const sanitized = sanitizeAiTextInput({
      summary: "تقرير برنامج تدريبي للتواصل test@example.com",
      reportIdentity: {
        version: "1",
        schoolName: "مدرسة سرية",
        reportPreparer: "أ. محمد",
        schoolPrincipal: "أ. خالد",
        ministryLogo: true,
        schoolLogoPng: "iVBORw0KGgo=",
      },
      schoolName: "مدرسة مهربة",
      schoolLogoPng: "AAAA",
      privacyConfirmation: { policyVersion: "ai-data-minimization-v1", purpose: "test", acknowledged: true },
    }) as Record<string, unknown>;

    expect(sanitized.reportIdentity).toBeUndefined();
    expect(sanitized.schoolName).toBeUndefined();
    expect(sanitized.schoolLogoPng).toBeUndefined();
    expect(sanitized.privacyConfirmation).toBeUndefined();
    expect(String(sanitized.summary)).toContain("[بيانات حساسة محجوبة]");
    expect(String(sanitized.summary)).not.toContain("test@example.com");
  });
});

describe("M4 Sandbox-gated commerce & idempotency (R13 / F15 / F16)", () => {
  it("keeps commerce sandbox strictly disabled in production and by default", () => {
    expect(isCommerceSandboxEnabled({ NODE_ENV: "production", SERS_COMMERCE_SANDBOX: "1" })).toBe(false);
    expect(isCommerceSandboxEnabled({ NODE_ENV: "development" })).toBe(false);
    expect(isCommerceSandboxEnabled({ NODE_ENV: "test", SERS_COMMERCE_SANDBOX: "1" })).toBe(true);
  });

  it("rejects sandboxPurchase when SERS_COMMERCE_SANDBOX is not enabled", async () => {
    const caller = commerceRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "user" } as never,
      req: {} as never,
      res: {} as never,
    });

    await expect(
      caller.sandboxPurchase({ productId: 1, idempotencyKey: "idem-key-123456" }),
    ).rejects.toThrow("المتجر في وضع العرض فقط");
  });

  it("executes sandbox purchase and entitlement grant atomically with idempotency lock", () => {
    expect(commerceDbSource).toContain("db.transaction");
    expect(commerceDbSource).toContain("eq(purchases.idempotencyKey, input.idempotencyKey)");
    expect(commerceDbSource).toContain('.for("update")');
    expect(commerceDbSource).toContain("tx\n      .insert(entitlements)");
  });
});

describe("M4 Official Standards Registry contracts (R14 / F17)", () => {
  it("enforces asset read/write authorization with transactional locking and links to versioned standardVersions", () => {
    expect(standardsDbSource).toContain('assertAssetAccess(userId, assetId, "read")');
    expect(standardsDbSource).toContain("lockAssetForWriteInTransaction(tx, userId, input.assetId)");
    expect(standardsDbSource).toContain('.for("update")');
    expect(standardsDbSource).toContain("eq(standardVersions.isActive, true)");
    expect(standardsDbSource).toContain("assetStandardLinks");
  });
});
