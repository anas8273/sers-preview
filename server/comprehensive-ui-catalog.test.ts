import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { getSectionEntryRoute, getServiceAvailability, sections } from "../client/src/lib/data";

const source = (relativePath: string) => readFileSync(resolve(relativePath), "utf8");

describe("comprehensive-ui catalog and capability visibility", () => {
  it("exposes the catalog through the authenticated product navigation and route manifest", () => {
    const navigation = source("client/src/config/productNavigation.ts");
    const app = source("client/src/App.tsx");
    const manifest = JSON.parse(source("client/public/manus-routes.json")) as { routes: Array<{ path: string }> };

    expect(navigation).toContain('path: "/catalog"');
    expect(app).toContain('<Route path={"/catalog"} component={CatalogPage} />');
    expect(manifest.routes.map((route) => route.path)).toContain("/catalog");
  });

  it("keeps every catalog entry sourced from the existing sections and classifies its capability", () => {
    const entries = sections.flatMap((section) => section.services.map((service) => ({ section, service })));
    expect(entries.length).toBeGreaterThan(80);
    expect(entries.every(({ section, service }) => Boolean(getServiceAvailability(section, service)))).toBe(true);
    expect(entries.some(({ section }) => getSectionEntryRoute(section) === "/reports")).toBe(true);
    expect(entries.some(({ section }) => getServiceAvailability(section, section.services[0]) === "planned")).toBe(true);
  });

  it("does not present the store as an actionable checkout surface", () => {
    const store = source("client/src/pages/Store.tsx");
    const section = source("client/src/pages/SectionPage.tsx");
    expect(store).toContain("كتالوج للعرض فقط حالياً");
    expect(store).not.toContain('toast.info("المتجر قيد التجهيز"');
    expect(section).toContain("غير منشور للشراء");
    expect(section).toContain("disabled={!canOpen}");
  });
});
