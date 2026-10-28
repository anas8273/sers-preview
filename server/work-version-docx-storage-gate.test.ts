import { afterEach, describe, expect, it, vi } from "vitest";
import { generatePrivateDocxForWorkVersion, getPrivateDocxDownloadForUser, PrivateDocxStorageUnavailableError } from "./work-version-output-service";

describe("DOCX verified private storage gate", () => {
  afterEach(() => vi.unstubAllEnvs());
  it("never falls back to legacy storage for Word generation or downloads", async () => {
    vi.stubEnv("SERS_PRIVATE_STORAGE_DIR", "");
    await expect(generatePrivateDocxForWorkVersion(1, 1)).rejects.toBeInstanceOf(PrivateDocxStorageUnavailableError);
    await expect(getPrivateDocxDownloadForUser(1, 1)).rejects.toBeInstanceOf(PrivateDocxStorageUnavailableError);
  });
});
