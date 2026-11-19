import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const router = readFileSync(new URL("./domain-router.ts", import.meta.url), "utf8");
const detail = readFileSync(new URL("../client/src/pages/WorkDetail.tsx", import.meta.url), "utf8");

describe("portfolio version boundary", () => {
  it("rejects portfolio version creation before calling the generic version service", () => {
    const block = router.split("createVersion: protectedProcedure")[1]?.split("remove: protectedProcedure")[0] ?? "";
    expect(block).toContain('work.type === "portfolio"');
    expect(block).toContain("لا يمكن إنشاء نسخة ملف إنجاز");
    expect(block.indexOf('work.type === "portfolio"')).toBeLessThan(block.indexOf("createWorkVersionForUser"));
  });

  it("keeps the local builder and explicit opt-in import boundary visible", () => {
    expect(detail).toContain('setLocation("/portfolio")');
    expect(detail).toContain("لن ننشئ نسخة ناقصة");
    expect(detail).toContain("الاستيراد إلى Work سيكون اختياريًا لاحقًا");
  });
});
