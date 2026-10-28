import { vi } from "vitest";
import type { TrpcContext } from "../../server/_core/context";

export const aiPngDataUrl = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR4AWPgEpH7DwABpAE8YfuNRQAAAABJRU5ErkJggg==";
export const aiTaxonomy = [
  { id: "std-1", title: "أداء الواجبات الوظيفية", subEvidences: [{ id: "std-1-item-1", title: "الالتزام بالأنظمة" }, { id: "std-1-item-2", title: "الالتزام بالحضور والانصراف" }] },
  { id: "std-2", title: "التفاعل مع المجتمع المهني", subEvidences: [{ id: "std-2-item-1", title: "المشاركة في المجتمع المهني" }] },
];
export const aiClassification = {
  standardId: "std-1", standardNumber: 1, standardName: aiTaxonomy[0].title, indicatorIndex: 2, indicatorText: aiTaxonomy[0].subEvidences[1].title,
  subIndicatorIndex: 0, subIndicatorText: "", confidence: 0.85, reasoning: "اقتراح تصنيف يحتاج مراجعة", contentDescription: "وصف مادة مقدمة للمراجعة",
  suggestedPriority: "supporting", suggestedKeywords: ["مراجعة", "تعليم"],
};
export function configureAiTestEnvironment() {
  vi.stubEnv("SERS_AI_ENABLED", "1");
  vi.stubEnv("APP_PUBLIC_ORIGIN", "http://127.0.0.1:3000");
  vi.stubEnv("BUILT_IN_FORGE_API_URL", "https://provider.invalid");
  vi.stubEnv("BUILT_IN_FORGE_API_KEY", "synthetic-ai-test-key");
}
export function aiTestContext(authenticated = true): TrpcContext {
  return { user: authenticated ? { id: 1, openId: "synthetic-ai-user", email: null, name: "مستخدم اصطناعي", loginMethod: "test", role: "user", createdAt: new Date(), updatedAt: new Date(), lastSignedIn: new Date() } : null,
    req: { protocol: "http", headers: { origin: "http://127.0.0.1:3000" } } as TrpcContext["req"],
    res: { clearCookie: vi.fn() } as unknown as TrpcContext["res"] };
}
