import { describe, expect, it } from "vitest";
import { calculateATSReadiness } from "../client/src/pages/SmartCV";

const emptyCV = {
  name: "", title: "", phone: "", email: "", city: "", summary: "",
  experience: [], education: [], skills: [], courses: [], achievements: [],
};

describe("ATS readiness for Smart CV", () => {
  it("identifies all core ATS gaps in an empty CV", () => {
    const readiness = calculateATSReadiness(emptyCV);
    expect(readiness.score).toBe(0);
    expect(readiness.completed).toBe(0);
    expect(readiness.checks).toHaveLength(6);
    expect(readiness.checks.every((check) => !check.complete)).toBe(true);
  });

  it("awards complete readiness to a structured CV with contact, keywords, and detailed experience", () => {
    const readiness = calculateATSReadiness({
      name: "معلم متمكن", title: "معلم رياضيات", phone: "0500000000", email: "teacher@example.com", city: "الرياض",
      summary: "معلم رياضيات يمتلك خبرة مهنية واسعة في تصميم الدروس وتحليل البيانات التعليمية وتطوير ممارسات التقويم التي تدعم تحسن نواتج التعلم.",
      experience: [{ id: "1", title: "معلم", organization: "مدرسة نموذجية", period: "2020 - 2025", description: "قدت مبادرات علاجية قائمة على تحليل نتائج الطلاب وطورت خطط تعلم متنوعة رفعت مستوى إتقان المهارات الأساسية." }],
      education: [{ id: "2", title: "بكالوريوس رياضيات", organization: "جامعة", period: "2018", description: "" }],
      skills: ["تحليل البيانات", "التقويم", "التخطيط", "التعلم النشط", "التواصل"], courses: [], achievements: [],
    });
    expect(readiness.score).toBe(100);
    expect(readiness.checks.every((check) => check.complete)).toBe(true);
  });
});
