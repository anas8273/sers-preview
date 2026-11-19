import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const reviewDb = readFileSync(resolve(process.cwd(), "server/review-output-db.ts"), "utf8");
const outputService = readFileSync(resolve(process.cwd(), "server/work-version-output-service.ts"), "utf8");
const pdfUi = readFileSync(resolve(process.cwd(), "client/src/components/ReportPdfActions.tsx"), "utf8");
const sharedPortfolio = readFileSync(resolve(process.cwd(), "client/src/pages/SharedPortfolio.tsx"), "utf8");

describe("output wire boundary", () => {
  it("keeps reader/list projections free of bearer and private coordinates", () => {
    expect(reviewDb).toContain("const { passwordHash: _passwordHash, storageKey: _storageKey, token: _token, ...safe } = row");
    expect(reviewDb).toContain("return safe;");
    expect(reviewDb).toContain("getPublicationReceiptForUser");
    expect(reviewDb).toContain('assertWorkAccess(userId, row.workId, "write")');
  });

  it("returns only application download tickets to PDF/DOCX clients", () => {
    expect(outputService).toContain('downloadUrl: `/api/work-outputs/${output.id}/download`');
    expect(outputService).not.toContain("storageKey: output.storageKey");
    expect(outputService).not.toContain("contentHash: identity[1]");
    expect(outputService).not.toContain("stored.url");
    expect(pdfUi).not.toContain("SHA-256:");
    expect(pdfUi).not.toContain("storageKey");
    expect(pdfUi).not.toContain("contentHash");
  });

  it("keeps public legacy files metadata-only without a nullable href fallback", () => {
    expect(sharedPortfolio).toContain("التنزيل غير متاح من الرابط العام");
    expect(sharedPortfolio).not.toContain("href={file.url}");
    expect(sharedPortfolio).not.toContain("file.url ?");
  });
});
