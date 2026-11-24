import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  PRODUCT_NAV_ITEMS,
  isProductRouteActive,
} from "../client/src/config/productNavigation";

const source = (relativePath: string) =>
  readFileSync(new URL(`../${relativePath}`, import.meta.url), "utf8");
const appSource = source("client/src/App.tsx");
const homeSource = source("client/src/pages/Home.tsx");
const notFoundSource = source("client/src/pages/NotFound.tsx");
const sharedSource = source("client/src/pages/SharedPortfolio.tsx");
const sidebarSource = source("client/src/components/AppSidebar.tsx");
const bottomNavSource = source("client/src/components/BottomNav.tsx");
const workSource = source("client/src/pages/WorkHub.tsx");
const reportSource = source("client/src/pages/ReportCenter.tsx");
const portfolioSource = source("client/src/pages/PortfolioBuilder.tsx");

describe("Arabic UX phase one regression", () => {
  it("keeps four primary Arabic destinations and marks /reports as server work", () => {
    expect(
      PRODUCT_NAV_ITEMS.filter(item =>
        ["/", "/work", "/evidence", "/reviews"].includes(item.path)
      )
    ).toHaveLength(4);
    expect(
      PRODUCT_NAV_ITEMS.every(item => /[\u0600-\u06ff]/.test(item.label))
    ).toBe(true);
    expect(isProductRouteActive("/reports", "/work", ["/reports"])).toBe(true);
    expect(isProductRouteActive("/reports/legacy", "/work", ["/reports"])).toBe(
      true
    );
  });

  it("provides Arabic 404, a truthful public work entry, and route coverage", () => {
    expect(appSource).toContain(
      '<Route path={"/reports"}><WorkHub reportsOnly /></Route>'
    );
    expect(notFoundSource).toContain('dir="rtl"');
    expect(notFoundSource).toContain("الصفحة غير موجودة");
    expect(notFoundSource).toContain("العودة للرئيسية");
    expect(notFoundSource).not.toContain("Page Not Found");
    expect(homeSource).toContain("أعمالك المحفوظة");
    expect(homeSource).toContain("فتح أعمالي");
    expect(homeSource).not.toContain("لا توجد أعمال بعد");
    expect(homeSource).not.toContain("النواة الجديدة");
    expect(homeSource).toContain("إضافة شاهد");
    expect(homeSource).not.toContain("واجهة Work الجديدة");
  });

  it("has bounded neutral share failures with retry and no ownership disclosure", () => {
    expect(sharedSource).toContain("SHARED_PORTFOLIO_LOAD_TIMEOUT_MS = 5000");
    expect(sharedSource).toContain("setTimedOut(true)");
    expect(sharedSource).toContain("void refetch()");
    expect(sharedSource).toContain("!data?.portfolio");
    expect(sharedSource).toContain("لن نعرض بيانات صاحب الملف أو تفاصيله");
    expect(sharedSource).not.toContain("{data.error}");
  });

  it("announces active navigation and implements drawer focus controls", () => {
    expect(sidebarSource).toContain(
      'aria-current={active ? "page" : undefined}'
    );
    expect(sidebarSource).toContain("aria-expanded={sidebarOpen}");
    expect(sidebarSource).toContain('aria-controls="sers-sidebar"');
    expect(sidebarSource).toContain('event.key === "Escape"');
    expect(bottomNavSource).toContain(
      'aria-current={active ? "page" : undefined}'
    );
    expect(bottomNavSource).toContain("aria-expanded={showMore}");
    expect(bottomNavSource).toContain('aria-controls="sers-more-menu"');
    expect(bottomNavSource).toContain('event.key === "Escape"');
  });

  it("keeps legacy/local report surfaces explicit and removes stopped upload controls", () => {
    expect(workSource).toContain('href="/reports/legacy"');
    expect(workSource).toContain("مسار انتقالي");
    expect(reportSource).toContain("رفع مرفق متوقف");
    expect(portfolioSource).toContain("رفع شاهد متوقف");
    expect(reportSource).not.toContain("onChange={handleAttachmentUpload}");
    expect(portfolioSource).not.toContain(
      "onChange={handleEvidenceFileUpload}"
    );
    expect(reportSource).not.toContain("uploadAttachmentMutation.mutateAsync");
    expect(portfolioSource).not.toContain("uploadEvidenceMutation.mutateAsync");
  });
});
