import { afterEach, describe, expect, it, vi } from "vitest";
import { aiAvailability, getAiLimits } from "./ai-policy";
import { isAiRequestOrigin } from "./ai-admission";
afterEach(() => vi.unstubAllEnvs());
describe("AI deployment and origin policy", () => {
  it("defaults to disabled while retaining bounded manual-safe configuration", () => {
    vi.stubEnv("SERS_AI_ENABLED", "0");
    expect(aiAvailability(true)).toMatchObject({ enabled: false, available: false, reason: "disabled" });
    expect(getAiLimits({})).toEqual({ userDaily: 30, globalDaily: 300, userMinute: 5, userConcurrency: 2, globalConcurrency: 8 });
  });
  it("fails closed on malformed or unbounded request budgets", () => {
    for (const value of ["0", "-1", "1.5", "Infinity", "10001"]) expect(() => getAiLimits({ SERS_AI_GLOBAL_DAILY_LIMIT: value })).toThrow();
    vi.stubEnv("SERS_AI_ENABLED", "1"); vi.stubEnv("SERS_AI_USER_CONCURRENCY", "999");
    expect(aiAvailability(true)).toMatchObject({ available: false, reason: "not_configured" });
  });
  it("uses the same canonical origin with or without an optional root slash", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const configured of ["https://school.example", "https://school.example/"]) {
      vi.stubEnv("APP_PUBLIC_ORIGIN", configured);
      expect(isAiRequestOrigin("https://school.example")).toBe(true);
      for (const origin of [undefined, "null", "https://foreign.example", "https://school.example.attacker.invalid", "http://school.example"]) expect(isAiRequestOrigin(origin)).toBe(false);
    }
  });
  it("rejects credentialed, non-origin and insecure production settings", () => {
    vi.stubEnv("NODE_ENV", "production");
    for (const configured of ["https://user:password@school.example", "https://school.example/path", "https://school.example?key=secret", "https://school.example#fragment", "http://127.0.0.1:3000"]) {
      vi.stubEnv("APP_PUBLIC_ORIGIN", configured);
      expect(isAiRequestOrigin(new URL(configured).origin)).toBe(false);
    }
    vi.stubEnv("NODE_ENV", "test"); vi.stubEnv("APP_PUBLIC_ORIGIN", "http://127.0.0.1:3000/");
    expect(isAiRequestOrigin("http://127.0.0.1:3000")).toBe(true);
  });
});
