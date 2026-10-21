import { beforeEach, describe, expect, it, vi } from "vitest";
import type { TrpcContext } from "./_core/context";

vi.mock("./review-output-db", async importOriginal => ({
  ...await importOriginal<typeof import("./review-output-db")>(),
  createOutputForUser: vi.fn(async (_userId, data) => ({ id: 1, ...data })),
}));
import { createOutputForUser } from "./review-output-db";
import { domainRouter } from "./domain-router";
import { shareOutputRouter } from "./share-output-router";
import { verifyProtectedOutputPassword } from "./output-password";

const ctx = { user: { id: 7, role: "user" }, req: {}, res: {} } as TrpcContext;
const creators = [
  ["domain", domainRouter.createCaller(ctx).output.create],
  ["share", shareOutputRouter.createCaller(ctx).create],
] as const;

beforeEach(() => vi.clearAllMocks());
describe.each(creators)("%s output password creation", (_name, create) => {
  it("stores salted scrypt hashes through the authenticated router", async () => {
    for (let attempt = 0; attempt < 2; attempt++) {
      await create({ workVersionId: 1, type: "link", visibility: "protected", password: "secret-123" });
    }
    const hashes = vi.mocked(createOutputForUser).mock.calls.map(call => call[1].passwordHash!);
    expect(hashes[0]).toMatch(/^scrypt-v1\$[a-f0-9]{32}\$[a-f0-9]{64}$/);
    expect(hashes[0]).not.toBe(hashes[1]);
    expect(verifyProtectedOutputPassword("secret-123", hashes[0])).toBe(true);
    expect(verifyProtectedOutputPassword("wrong", hashes[0])).toBe(false);
  });
  it("does not persist an irrelevant password on a public output", async () => {
    await create({ workVersionId: 1, type: "link", visibility: "public", password: "secret-123" });
    expect(vi.mocked(createOutputForUser).mock.calls[0][1].passwordHash).toBeUndefined();
  });
});
