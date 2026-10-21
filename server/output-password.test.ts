import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  hashProtectedOutputPassword,
  verifyProtectedOutputPassword,
} from "./output-password";

describe("protected output passwords", () => {
  it("creates salted scrypt hashes and verifies only the original password", () => {
    const first = hashProtectedOutputPassword("secret-123");
    const second = hashProtectedOutputPassword("secret-123");

    expect(first).toMatch(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(second).toMatch(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    expect(verifyProtectedOutputPassword("secret-123", first)).toBe(true);
    expect(verifyProtectedOutputPassword("wrong-password", first)).toBe(false);
  });

  it("keeps transitional compatibility with legacy SHA-256 links", () => {
    const legacy = createHash("sha256").update("legacy-secret", "utf8").digest("hex");
    expect(verifyProtectedOutputPassword("legacy-secret", legacy)).toBe(true);
    expect(verifyProtectedOutputPassword("wrong", legacy)).toBe(false);
  });

  it("rejects malformed hashes and invalid password lengths", () => {
    expect(verifyProtectedOutputPassword("secret", "not-a-supported-hash")).toBe(false);
    expect(() => hashProtectedOutputPassword("123")).toThrow(/length/i);
  });
});
