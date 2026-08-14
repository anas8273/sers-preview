import { describe, expect, it } from "vitest";
import { calculatePortfolioReadiness } from "../client/src/pages/PortfolioBuilder";

const emptyPortfolio = {
  personalInfo: { fullName: "", jobTitle: "", school: "", department: "", qualification: "", experience: "", email: "", phone: "" },
  certificates: [], achievements: [], activities: [], goals: [""], notes: "",
};

describe("portfolio readiness", () => {
  it("identifies every missing content group in an empty portfolio", () => {
    const readiness = calculatePortfolioReadiness(emptyPortfolio);
    expect(readiness.score).toBe(0);
    expect(readiness.completed).toBe(0);
    expect(readiness.checks).toHaveLength(6);
  });

  it("awards full readiness for a complete professional portfolio", () => {
    const readiness = calculatePortfolioReadiness({
      personalInfo: { fullName: "أحمد المعلم", jobTitle: "معلم رياضيات", school: "مدرسة نموذجية", department: "الرياضيات", qualification: "بكالوريوس", experience: "10", email: "teacher@example.com", phone: "0500000000" },
      certificates: [{ id: "c1", title: "التعلم النشط", issuer: "وزارة التعليم", date: "1446", hours: "20", type: "training" }],
      achievements: [{ id: "a1", title: "مبادرة علاجية", description: "صممت ونفذت مبادرة علاجية قائمة على تحليل نتائج المتعلمين وحققت تحسناً ملموساً في الإتقان.", date: "1446", category: "initiative" }],
      activities: [{ id: "x1", title: "نشاط مدرسي", description: "شاركت في تخطيط وتنفيذ نشاط مدرسي يرفع دافعية الطلاب ويعزز مهارات التعاون لديهم بصورة منظمة.", date: "1446", type: "school" }],
      goals: ["تطوير مهارات تحليل نتائج المتعلمين", "الحصول على شهادة مهنية متقدمة"],
      notes: "أراجع أثر ممارساتي التعليمية بصورة دورية، وأستخدم نتائج التقويم لتحسين التخطيط وتقديم دعم مخصص للمتعلمين وفق احتياجاتهم المختلفة.",
    });
    expect(readiness.score).toBe(100);
    expect(readiness.checks.every((check) => check.complete)).toBe(true);
  });
});
