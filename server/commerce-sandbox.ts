import { createHmac, timingSafeEqual } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import { entitlements, products, purchases } from "../drizzle/domain-core";
import { getDb } from "./db";

export type SupportedPaymentCurrency = "SAR";

export type PaymentCheckoutSessionInput = {
  purchaseId: number;
  userId: number;
  productId: number;
  amountMinor: number;
  currency: SupportedPaymentCurrency;
  vatRatePercent: number;
  idempotencyKey: string;
  returnUrl: string;
};

export type VerifiedPaymentWebhookEvent = {
  eventId: string;
  idempotencyKey: string;
  providerPaymentRef: string;
  state: "paid" | "failed" | "refunded";
  amountMinor: number;
  currency: SupportedPaymentCurrency;
};

/**
 * Pluggable payment gateway contract (`O001` — e.g. Moyasar / HyperPay / Tap SAR).
 * Live payment adapters remain disabled by default (`SERS_ENABLE_LIVE_PAYMENTS !== "1"`)
 * until merchant credentials, VAT registration, and commercial sign-off are provided.
 */
export interface PaymentProviderAdapter {
  readonly providerId: string;
  readonly isLive: boolean;
  createCheckoutSession(
    input: PaymentCheckoutSessionInput,
  ): Promise<{ checkoutUrl: string; providerPaymentRef: string }>;
  verifyWebhookEvent(rawBody: Buffer, signatureHeader: string): VerifiedPaymentWebhookEvent;
}

/**
 * Constant-time HMAC-SHA256 webhook signature verifier for payment provider callbacks (`F15`).
 */
export function verifyWebhookHmacSha256(
  rawBody: Buffer | string,
  webhookSecret: string,
  providedHexSignature: string,
): boolean {
  if (!webhookSecret || !providedHexSignature) return false;
  const normalizedSig = providedHexSignature.trim().replace(/^sha256=/i, "");
  if (!/^[0-9a-f]{64}$/i.test(normalizedSig)) return false;
  const expected = createHmac("sha256", webhookSecret).update(rawBody).digest("hex");
  const expectedBuf = Buffer.from(expected, "hex");
  const providedBuf = Buffer.from(normalizedSig, "hex");
  if (expectedBuf.length !== providedBuf.length) return false;
  return timingSafeEqual(expectedBuf, providedBuf);
}

export function getCommerceProviderStatus(env: NodeJS.ProcessEnv = process.env): {
  mode: "disabled" | "sandbox";
  currency: SupportedPaymentCurrency;
  vatRatePercent: number;
  livePaymentsAllowed: false;
} {
  return {
    mode: isCommerceSandboxEnabled(env) ? "sandbox" : "disabled",
    currency: "SAR",
    vatRatePercent: 15,
    livePaymentsAllowed: false,
  };
}

/**
 * Commerce sandbox is strictly disabled in production and off by default.
 * Real payments require explicit operator approval and provider integration (O001).
 */
export function isCommerceSandboxEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.NODE_ENV !== "production" && env.SERS_COMMERCE_SANDBOX === "1";
}

export async function listActiveProducts() {
  const db = await getDb();
  if (!db) return [];
  return db
    .select()
    .from(products)
    .where(eq(products.isActive, true))
    .orderBy(desc(products.id));
}

export async function listUserEntitlements(userId: number) {
  const db = await getDb();
  if (!db) return [];
  return db
    .select({
      id: entitlements.id,
      productId: entitlements.productId,
      purchaseId: entitlements.purchaseId,
      status: entitlements.status,
      grantedAt: entitlements.grantedAt,
      expiresAt: entitlements.expiresAt,
      productName: products.name,
      productType: products.productType,
    })
    .from(entitlements)
    .innerJoin(products, eq(entitlements.productId, products.id))
    .where(and(eq(entitlements.userId, userId), eq(entitlements.status, "active")))
    .orderBy(desc(entitlements.grantedAt));
}

/**
 * Idempotent sandbox purchase + atomic entitlement grant (covers F15 & F16).
 * Only callable when `isCommerceSandboxEnabled()` is true.
 */
export async function executeSandboxPurchaseForUser(
  userId: number,
  input: { productId: number; idempotencyKey: string },
) {
  if (!isCommerceSandboxEnabled()) {
    throw new Error("COMMERCE_SANDBOX_DISABLED");
  }
  const db = await getDb();
  if (!db) throw new Error("Database not available");

  return db.transaction(async tx => {
    const [existing] = await tx
      .select()
      .from(purchases)
      .where(eq(purchases.idempotencyKey, input.idempotencyKey))
      .limit(1)
      .for("update");
    if (existing) {
      if (existing.userId !== userId || existing.productId !== input.productId) {
        throw new Error("IDEMPOTENCY_KEY_CONFLICT");
      }
      return {
        purchaseId: existing.id,
        productId: existing.productId,
        state: existing.state,
        deduplicated: true as const,
      };
    }

    const [product] = await tx
      .select()
      .from(products)
      .where(and(eq(products.id, input.productId), eq(products.isActive, true)))
      .limit(1)
      .for("update");
    if (!product) return undefined;

    const [inserted] = await tx.insert(purchases).values({
      userId,
      productId: product.id,
      idempotencyKey: input.idempotencyKey,
      state: "paid",
      amountMinor: product.priceMinor,
      currency: product.currency,
      provider: "sandbox",
      providerPaymentRef: `sandbox:${input.idempotencyKey}`,
    });
    const purchaseId = Number(inserted.insertId);

    await tx
      .insert(entitlements)
      .values({
        userId,
        organizationId: null,
        productId: product.id,
        purchaseId,
        status: "active",
      })
      .onDuplicateKeyUpdate({
        set: { purchaseId, status: "active" },
      });

    return {
      purchaseId,
      productId: product.id,
      state: "paid" as const,
      deduplicated: false as const,
    };
  });
}
