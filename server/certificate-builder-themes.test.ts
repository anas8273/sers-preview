import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("../client/src/pages/CertificateBuilder.tsx", import.meta.url), "utf8");

describe("CertificateBuilder themes", () => {
  it("offers six visually distinct certificate themes", () => {
    expect(source).toContain('id: "green-official"');
    expect(source).toContain('id: "gold-elegant"');
    expect(source).toContain('id: "blue-modern"');
    expect(source).toContain('id: "plum-formal"');
    expect(source).toContain('id: "rose-celebration"');
    expect(source).toContain('id: "slate-professional"');
  });

  it("retains the five certificate purposes in the interactive chooser", () => {
    expect(source).toContain('id: "thanks"');
    expect(source).toContain('id: "excellence"');
    expect(source).toContain('id: "participation"');
    expect(source).toContain('id: "training"');
    expect(source).toContain('id: "student_excellence"');
  });
});
