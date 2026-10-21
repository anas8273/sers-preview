import { describe, expect, it, vi } from "vitest";
const route = vi.hoisted(() => ({ matches: true, params: {} as Record<string, string> }));
vi.mock("wouter", () => ({ useRoute: () => [route.matches, route.params] }));
import PublicOutput from "../client/src/pages/PublicOutput";
import ReportShareActions from "../client/src/components/ReportShareActions";

describe("output route session boundaries", () => {
  it("uses a distinct React session key for each public token", () => {
    route.params = { token: "a".repeat(32) };
    const first = PublicOutput();
    route.params = { token: "b".repeat(32) };
    const second = PublicOutput();
    expect(first.key).toBe("a".repeat(32));
    expect(second.key).toBe("b".repeat(32));
    expect(first.key).not.toBe(second.key);
  });
  it("remounts share state when switching work and removes it off-route", () => {
    route.params = { id: "1" };
    const first = ReportShareActions();
    route.params = { id: "2" };
    const second = ReportShareActions();
    expect(first?.key).toBe("1");
    expect(second?.key).toBe("2");
    route.matches = false;
    expect(ReportShareActions()).toBeNull();
    route.matches = true;
  });
});
