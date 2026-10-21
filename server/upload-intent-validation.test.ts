import { beforeEach, describe, expect, it, vi } from "vitest";
vi.mock("./db", () => ({ getDb: vi.fn() }));
import { getDb } from "./db";
import { beginUploadIntentForUser, cancelUploadIntentForUser } from "./upload-intent-db";

const good = { idempotencyKey: "request-key-123456", fileName: "شاهد.pdf", mimeType: "application/pdf", expectedBytes: 1024 };
describe("upload intent admission before persistence", () => {
  beforeEach(() => vi.clearAllMocks());
  it.each([
    { idempotencyKey: "short" }, { idempotencyKey: "x".repeat(129) },
    { fileName: "../proof.pdf" }, { fileName: "   " },
    { mimeType: "application/pdf\r\nInjected: value" },
    { expectedBytes: 0 }, { expectedBytes: -1 }, { expectedBytes: 1.5 },
    { expectedBytes: 16 * 1024 * 1024 + 1 },
  ])("rejects invalid intent without database access: %j", async patch => {
    await expect(beginUploadIntentForUser(1, { ...good, ...patch })).rejects.toThrow();
    expect(getDb).not.toHaveBeenCalled();
  });
  it.each([0, -1, 1.5, NaN])("rejects invalid actor %s", async actor => {
    await expect(beginUploadIntentForUser(actor, good)).rejects.toThrow();
    expect(getDb).not.toHaveBeenCalled();
  });
  it("rejects invalid cancellation revision before persistence", async () => {
    await expect(cancelUploadIntentForUser(1, "test-id", -1)).rejects.toThrow();
    expect(getDb).not.toHaveBeenCalled();
  });
});
