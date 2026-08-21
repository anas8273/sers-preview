import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CertificateBuilder.tsx", import.meta.url), "utf8");

describe("CertificateBuilder themes", () => {
  it("limits certificate looks to ministry-aligned variants", () => {
    expect(source).toContain('id: "moe-primary"');
    expect(source).toContain('id: "moe-formal"');
    expect(source).toContain('primary: "#008A76"');
    expect(source).not.toContain('id: "gold-elegant"');
    expect(source).not.toContain('id: "rose-celebration"');
  });

  it("retains the five certificate purposes in the interactive chooser", () => {
    expect(source).toContain('id: "thanks"');
    expect(source).toContain('id: "excellence"');
    expect(source).toContain('id: "participation"');
    expect(source).toContain('id: "training"');
    expect(source).toContain('id: "student_excellence"');
  });
});
