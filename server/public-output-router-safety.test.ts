import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rootRouterSource = readFileSync(resolve(process.cwd(), "server/root-router.ts"), "utf8");
const publicRouterSource = readFileSync(resolve(process.cwd(), "server/public-output-router.ts"), "utf8");
const shareRouterSource = readFileSync(resolve(process.cwd(), "server/share-output-router.ts"), "utf8");
const serviceSource = readFileSync(resolve(process.cwd(), "server/public-output-service.ts"), "utf8");
const passwordSource = readFileSync(resolve(process.cwd(), "server/output-password.ts"), "utf8");

describe("public output router safety", () => {
  it("mounts separate public-resolution and authenticated-share routers", () => {
    expect(rootRouterSource).toContain("publicOutput: publicOutputRouter");
    expect(rootRouterSource).toContain("shareOutput: shareOutputRouter");
    expect(publicRouterSource).toContain("publicProcedure");
    expect(shareRouterSource).toContain("protectedProcedure");
  });

  it("rate-limits public resolution without storing raw tokens in bucket keys", () => {
    expect(publicRouterSource).toContain('createHash("sha256").update(token');
    expect(publicRouterSource).toContain("MAX_ATTEMPTS = 30");
    expect(publicRouterSource).toContain('code: "TOO_MANY_REQUESTS"');
  });

  it("keeps unavailable, revoked, expired, private, and unapproved outputs behind a generic not-found boundary", () => {
    expect(serviceSource).toContain("row.output.visibility !== \"public\"");
    expect(serviceSource).toContain("row.output.revokedAt");
    expect(serviceSource).toContain("row.output.expiresAt.getTime() <= Date.now()");
    expect(serviceSource).toContain('eq(reviews.status, "approved")');
    expect(publicRouterSource).toContain("المخرج غير متاح أو انتهت صلاحيته");
  });

  it("creates protected links with salted scrypt hashes and supports legacy verification only during transition", () => {
    expect(shareRouterSource).toContain("hashProtectedOutputPassword");
    expect(passwordSource).toContain('const SCRYPT_PREFIX = "scrypt-v1"');
    expect(passwordSource).toContain("randomBytes(16)");
    expect(passwordSource).toContain("scryptSync");
    expect(passwordSource).toContain("timingSafeEqual");
    expect(passwordSource).toContain("LEGACY_SHA256");
  });

  it("requires exact-version approval through the existing output creation contract", () => {
    expect(shareRouterSource).toContain("createOutputForUser");
    expect(shareRouterSource).toContain("workVersionId: input.workVersionId");
    expect(shareRouterSource).toContain('visibility: input.visibility');
    expect(shareRouterSource).toContain("expiresAt: input.expiresAt");
  });

  it("returns an allowlisted public projection rather than raw snapshots", () => {
    expect(serviceSource).toContain("FIELD_DEFINITIONS");
    expect(serviceSource).toContain("templateLabel");
    expect(serviceSource).toContain("fields,");
    expect(serviceSource).toContain("evidence,");
    expect(serviceSource).not.toContain("return row.version.snapshot");
  });
});
