export const AI_OPERATIONS = ["classifyEvidence", "suggestEvidence", "fillFormFields", "improveText", "suggest", "analyzeGaps", "fillReport", "generateRadio", "generateCV", "generateExamQuestions", "extractGradesFromImage", "generatePortfolioContent"] as const;
export type AiOperation = typeof AI_OPERATIONS[number];
export const AI_PROVIDER = "manus-forge";
export const AI_CONFIGURED_MODEL = "gemini-2.5-flash";
export const AI_PROMPT_VERSION = "educational-proposals-v1";
export const AI_LEASE_MS = 90_000;
export const AI_CIRCUIT_FAILURES = 3;
export const AI_CIRCUIT_OPEN_MS = 60_000;
export type AiLimits = { userDaily: number; globalDaily: number; userMinute: number; userConcurrency: number; globalConcurrency: number };
export function getAiLimits(env: NodeJS.ProcessEnv = process.env): AiLimits {
  const read = (name: string, fallback: number, max: number) => {
    const raw = env[name];
    if (raw === undefined || raw === "") return fallback;
    if (!/^[1-9][0-9]*$/.test(raw) || !Number.isSafeInteger(Number(raw)) || Number(raw) > max) throw new Error("Invalid AI budget configuration");
    return Number(raw);
  };
  return {
    userDaily: read("SERS_AI_USER_DAILY_LIMIT", 30, 1000),
    globalDaily: read("SERS_AI_GLOBAL_DAILY_LIMIT", 300, 10000),
    userMinute: read("SERS_AI_USER_MINUTE_LIMIT", 5, 60),
    userConcurrency: read("SERS_AI_USER_CONCURRENCY", 2, 4),
    globalConcurrency: read("SERS_AI_GLOBAL_CONCURRENCY", 8, 32),
  };
}
export function aiAvailability(authenticated: boolean) {
  const enabled = process.env.SERS_AI_ENABLED === "1";
  const configured = Boolean(process.env.BUILT_IN_FORGE_API_URL && process.env.BUILT_IN_FORGE_API_KEY && process.env.APP_PUBLIC_ORIGIN);
  let limits: AiLimits;
  try { limits = getAiLimits(); } catch { return { enabled, authenticated, available: false, requiresSignIn: !authenticated, reason: "not_configured" as const, limits: { dailyRequests: 0, minuteRequests: 0 } }; }
  return { enabled, authenticated, available: enabled && configured && authenticated, requiresSignIn: !authenticated,
    reason: !authenticated ? "sign_in" as const : !enabled ? "disabled" as const : !configured ? "not_configured" as const : undefined,
    limits: { dailyRequests: limits.userDaily, minuteRequests: limits.userMinute } };
}
