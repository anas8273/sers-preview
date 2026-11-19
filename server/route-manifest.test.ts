import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const app = readFileSync(resolve("client/src/App.tsx"), "utf8");
const manifest = JSON.parse(readFileSync(resolve("client/public/manus-routes.json"), "utf8"));

describe("canonical application route manifest", () => {
  it("matches every explicit application route, excluding only the 404-only route", () => {
    const sourceRoutes = [...app.matchAll(/<Route\s+path=\{\s*["']([^"']+)["']\s*\}/g)].map(match => match[1]).filter(path => path !== "/404");
    expect(manifest.routes.map((route: { path: string }) => route.path)).toEqual(sourceRoutes);
    expect(new Set(sourceRoutes).size).toBe(sourceRoutes.length);
    expect(manifest.routes.every((route: { path: string }) => route.path.startsWith("/") && !route.path.startsWith("/api/"))).toBe(true);
  });
  it("makes reports the server-backed hub and retains a separate legacy editor", () => {
    expect(app).toMatch(/path=\{"\/reports"\}>\s*<WorkHub reportsOnly/);
    expect(app).toMatch(/path=\{"\/reports\/legacy"\}\s+component=\{ReportCenter\}/);
    expect(manifest.routes.find((route: { path: string }) => route.path === "/reports/legacy")?.title).toBe("التقارير المحلية القديمة");
  });
});
