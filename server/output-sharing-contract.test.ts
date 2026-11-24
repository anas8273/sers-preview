import { describe, expect, it } from "vitest";
import { OutputValidationError, validateOutputContract } from "./review-output-db";

function rejects(input: Parameters<typeof validateOutputContract>[0], message: RegExp) {
  expect(() => validateOutputContract(input)).toThrow(message);
}

describe("shareable output contract", () => {
  it.each([
    ["pdf", "public"],
    ["pdf", "protected"],
    ["docx", "public"],
    ["docx", "protected"],
  ] as const)("rejects unresolved %s/%s delivery before persistence", (type, visibility) => {
    expect(() => validateOutputContract({ type, visibility, token: "synthetic-token" })).toThrow(/private|Only link and QR/);
  });

  it.each([
    [{ type: "link", visibility: "public" }, /require a token/],
    [{ type: "link", visibility: "public", token: "   " }, /require a token/],
    [{ type: "qr", visibility: "protected", token: "synthetic-token" }, /password hash/],
    [{ type: "link", visibility: "public", token: "synthetic-token", passwordHash: "not-allowed" }, /only valid/],
    [{ type: "link", visibility: "public", token: "synthetic-token", storageKey: "private/raw-key" }, /private storage/],
  ] as const)("rejects malformed shared request %#", (input, message) => {
    expect(() => validateOutputContract(input)).toThrow(message);
  });

  it("rejects runtime enum values even when a caller bypasses TypeScript", () => {
    expect(() => validateOutputContract({ type: "html", visibility: "public", token: "synthetic-token" })).toThrow(OutputValidationError);
    expect(() => validateOutputContract({ type: "link", visibility: "organization", token: "synthetic-token" })).toThrow(OutputValidationError);
  });

  it("keeps private PDF/DOCX compatibility while allowing only resolvable shared types", () => {
    expect(() => validateOutputContract({ type: "pdf", visibility: "private", storageKey: "private/report.pdf" })).not.toThrow();
    expect(() => validateOutputContract({ type: "docx", visibility: "private", storageKey: "private/report.docx" })).not.toThrow();
    expect(() => validateOutputContract({ type: "link", visibility: "public", token: "synthetic-token" })).not.toThrow();
    expect(() => validateOutputContract({ type: "qr", visibility: "protected", token: "synthetic-token", passwordHash: "scrypt-v1$synthetic" })).not.toThrow();
  });

  it("rejects expired values before a database transaction can be opened", () => {
    rejects({ type: "link", visibility: "public", token: "synthetic-token", expiresAt: new Date(Date.now() - 1) }, /future/);
  });
});
