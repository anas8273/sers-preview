import { describe, expect, it } from "vitest";
import { calculateRadioReadiness } from "../client/src/pages/SchoolRadio";

describe("school radio readiness", () => {
  it("identifies all gaps in a draft without metadata or content", () => {
    const readiness = calculateRadioReadiness("", "", []);
    expect(readiness.score).toBe(0);
    expect(readiness.completed).toBe(0);
    expect(readiness.checks).toHaveLength(6);
  });

  it("approves a varied, documented, and fully prepared radio program", () => {
    const readiness = calculateRadioReadiness("إذاعة يوم المعلم", "الأحد 1446/5/15", [
      { id: "1", type: "quran", title: "القرآن الكريم", content: "نتلو عليكم آيات مباركات من كتاب الله الكريم لتكون بداية برنامجنا الصباحي.", presenter: "أحمد" },
      { id: "2", type: "hadith", title: "الحديث الشريف", content: "نقدم حديثاً نبوياً شريفاً يوضح أهمية العلم والعمل والتعاون بين أفراد المجتمع المدرسي.", presenter: "سارة" },
      { id: "3", type: "wisdom", title: "حكمة اليوم", content: "العلم نور، ومن جد في طلبه وصل إلى أهدافه وترك أثراً إيجابياً في من حوله.", presenter: "خالد" },
    ]);
    expect(readiness.score).toBe(100);
    expect(readiness.checks.every((check) => check.complete)).toBe(true);
  });
});
