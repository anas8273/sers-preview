import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/PerformanceEvidence.tsx", import.meta.url), "utf8");

describe("evidence copy actions", () => {
  it("provides a copy action for free-text evidence", () => {
    expect(source).toContain("تم نسخ نص الشاهد");
    expect(source).toContain("navigator.clipboard.writeText(ev.text)");
    expect(source).toContain("نسخ النص");
  });

  it("provides a copy action for an existing evidence comment", () => {
    expect(source).toContain("تم نسخ التعليق");
    expect(source).toContain("navigator.clipboard.writeText(ev.comment || '')");
  });
});
