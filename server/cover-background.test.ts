import { describe, expect, it } from "vitest";
import { MAX_COVER_BACKGROUND_SIZE, validateCoverBackgroundFile } from "../client/src/lib/cover-background";

describe("cover background validation", () => {
  it("accepts a supported image within the permitted size", () => {
    expect(validateCoverBackgroundFile({ type: "image/png", size: 1024 })).toBeNull();
  });

  it("rejects a file that is not an image", () => {
    expect(validateCoverBackgroundFile({ type: "application/pdf", size: 1024 })).toContain("صورة");
  });

  it("rejects an image larger than five megabytes", () => {
    expect(validateCoverBackgroundFile({ type: "image/jpeg", size: MAX_COVER_BACKGROUND_SIZE + 1 })).toContain("5 ميجابايت");
  });
});
