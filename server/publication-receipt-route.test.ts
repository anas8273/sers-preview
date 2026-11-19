import { beforeEach, describe, expect, it, vi } from "vitest";
import { appRouter } from "./root-router";
import { getPublicationReceiptForUser } from "./review-output-db";
import { aiTestContext } from "../tests/fixtures/ai-router";

vi.mock("./review-output-db", async importOriginal => ({
  ...await importOriginal<typeof import("./review-output-db")>(),
  getPublicationReceiptForUser: vi.fn(),
}));
const receipt = vi.mocked(getPublicationReceiptForUser);
beforeEach(() => vi.clearAllMocks());

describe("purpose-separated publication management receipt", () => {
  it("requires authenticated access before requesting a bearer", async () => {
    await expect(appRouter.createCaller(aiTestContext(false)).domain.output.publicationReceipt({ id: 1 }))
      .rejects.toMatchObject({ code: "UNAUTHORIZED" });
    expect(receipt).not.toHaveBeenCalled();
  });
  it("does not turn denied ownership/write access into a receipt", async () => {
    receipt.mockResolvedValue(undefined);
    await expect(appRouter.createCaller(aiTestContext()).domain.output.publicationReceipt({ id: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
  it("returns only whitelisted active publication fields for authorized management", async () => {
    receipt.mockResolvedValue({ id: 1, workVersionId: 8, versionNumber: 2, type: "link", visibility: "public",
      token: "synthetic-publication-receipt-only", expiresAt: null, revokedAt: null,
      storageKey: "PRIVATE_COORDINATE", contentHash: "PRIVATE_HASH", passwordHash: "PRIVATE_PASSWORD", metadata: { secret: "PRIVATE_METADATA" } } as any);
    const result = await appRouter.createCaller(aiTestContext()).domain.output.publicationReceipt({ id: 1 });
    expect(result).toEqual({ outputId: 1, workVersionId: 8, versionNumber: 2, type: "link", visibility: "public",
      token: "synthetic-publication-receipt-only", expiresAt: null });
    expect(JSON.stringify(result)).not.toContain("PRIVATE_");
  });
  it.each([{ revokedAt: new Date() }, { expiresAt: new Date(0) }, { token: null }])("does not return an inactive or absent bearer %j", async state => {
    receipt.mockResolvedValue({ id: 1, token: "synthetic", expiresAt: null, revokedAt: null, ...state } as any);
    await expect(appRouter.createCaller(aiTestContext()).domain.output.publicationReceipt({ id: 1 }))
      .rejects.toMatchObject({ code: "FORBIDDEN" });
  });
});
