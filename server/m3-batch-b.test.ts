import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  computePortfolioReadiness,
  normalizePortfolioDraft,
  PortfolioValidationError,
} from "../shared/portfolio-projection";
import { mapLegacyReportToFields } from "../shared/legacy-report-import";

const portfolioDbSource = readFileSync(resolve(import.meta.dirname, "portfolio-draft-db.ts"), "utf8");
const reportDraftDbSource = readFileSync(resolve(import.meta.dirname, "work-report-draft-db.ts"), "utf8");

describe("R08 reference-based portfolio projection and guards", () => {
  it("normalizes entries, rejects duplicate references, and computes readiness traffic light", () => {
    const empty = normalizePortfolioDraft(undefined);
    expect(computePortfolioReadiness(empty).status).toBe("incomplete");

    const needsAttention = normalizePortfolioDraft({
      introduction: "",
      entries: [{ id: "e1", sectionTitle: "التقارير", kind: "work", refId: 5 }],
    });
    expect(computePortfolioReadiness(needsAttention).status).toBe("needs_attention");

    const ready = normalizePortfolioDraft({
      introduction: "ملف إنجاز الفصل الدراسي الأول",
      entries: [
        { id: "e1", sectionTitle: "التقارير", kind: "work", refId: 5 },
        { id: "e2", sectionTitle: "الشواهد", kind: "asset", refId: 12 },
      ],
    });
    const readiness = computePortfolioReadiness(ready);
    expect(readiness.status).toBe("ready");
    expect(readiness.workCount).toBe(1);
    expect(readiness.assetCount).toBe(1);

    expect(() => normalizePortfolioDraft({
      introduction: "مكرر",
      entries: [
        { id: "e1", sectionTitle: "أ", kind: "work", refId: 5 },
        { id: "e2", sectionTitle: "ب", kind: "work", refId: 5 },
      ],
    })).toThrow(PortfolioValidationError);
  });

  it("enforces circular-reference prevention, ownership scope, and CAS in portfolio-draft-db", () => {
    expect(portfolioDbSource).toContain('target.type === "portfolio"');
    expect(portfolioDbSource).toContain("entry.refId === portfolioWork.id");
    expect(portfolioDbSource).toContain("sameScope(portfolioWork, target)");
    expect(portfolioDbSource).toContain('.for("update")');
    expect(portfolioDbSource).toContain("if (current.revision !== input.expectedRevision) throw new PortfolioConflictError()");
  });
});

describe("R21 version restore as new editable head", () => {
  it("restores immutable work_versions snapshot into report_document without mutating work_versions", () => {
    const fnStart = reportDraftDbSource.indexOf("export async function restoreReportVersionAsDraftForUser");
    expect(fnStart).toBeGreaterThan(0);
    const body = reportDraftDbSource.slice(fnStart);
    expect(body).toContain("if (current.revision !== input.expectedRevision) throw new ReportDraftConflictError()");
    expect(body).toContain("REPORT_TEMPLATE_HISTORY_BLOCK");
    expect(body).toContain("revision: current.revision + 1");
    expect(body).not.toContain("tx.update(workVersions)");
    expect(body).not.toContain("tx.delete(workVersions)");
  });
});

describe("J08 legacy browser draft importer", () => {
  it("maps legacy ReportCenter fields into v2 allowed fields and preserves extra fields in summary", () => {
    const preview = mapLegacyReportToFields(
      {
        id: "leg-1",
        templateId: "teacher-activity",
        title: "تقرير نشاط قديم",
        data: {
          teacherName: "أ. عبدالله",
          goals: "رفع مستوى التحصيل",
          activities: "تنفيذ ورش تدريبية",
          innovations: "بطاقات تعلم ذكية",
        },
      },
      ["summary", "objectives", "implementation", "results", "recommendations"],
    );

    expect(preview.sourceTitle).toBe("تقرير نشاط قديم");
    expect(preview.mappedFieldCount).toBe(4);
    expect(preview.fields.objectives).toBe("رفع مستوى التحصيل");
    expect(preview.fields.implementation).toBe("تنفيذ ورش تدريبية");
    expect(preview.fields.summary).toContain("— مستورد من المسودة القديمة —");
    expect(preview.fields.summary).toContain("اسم المعلم: أ. عبدالله");
    expect(preview.fields.summary).toContain("المبادرات والابتكارات: بطاقات تعلم ذكية");
  });
});
