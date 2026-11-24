import { describe, expect, it } from "vitest";
import {
  applyTemplateSwitch,
  normalizeReportDraft,
  previewTemplateSwitch,
  REPORT_TEMPLATE_DEFINITIONS,
  ReportDocumentValidationError,
  type NormalizedReportDraft,
} from "../shared/report-projection";
import { reportDraftRouter } from "./report-draft-router";

function makeDraft(
  templateId: string,
  fields: NormalizedReportDraft["fields"],
  overrides: Partial<NormalizedReportDraft> = {},
): NormalizedReportDraft {
  const template = REPORT_TEMPLATE_DEFINITIONS[templateId];
  return normalizeReportDraft({
    schemaVersion: 2,
    templateId: template.id,
    templateVersionId: `${template.id}@${template.version}`,
    themeId: "formal",
    fontFamily: "Tajawal",
    fields,
    evidenceAssetIds: [11, 22],
    reportIdentity: {
      version: "1",
      schoolName: "مدرسة المستقبل",
      reportPreparer: "أ. سارة",
      schoolPrincipal: "أ. نورة",
      ministryLogo: true,
    },
    fieldDefinitions: template.fields,
    ...overrides,
  }, { allowLegacy: false });
}

describe("R12 non-destructive template switching", () => {
  it("maps exact, alias, and unmapped fields cleanly between program-report and initiative-report", () => {
    const draft = makeDraft("program-report", {
      summary: "ملخص البرنامج التدريبي",
      goals: ["هدف أول", "هدف ثاني"],
      steps: ["خطوة ١", "خطوة ٢"],
      subject: "برنامج المهارات الرقمية",
      duration: "أسبوعان",
    });

    const preview = previewTemplateSwitch(draft, "initiative-report");
    expect(preview.fromTemplateId).toBe("program-report");
    expect(preview.toTemplateId).toBe("initiative-report");
    expect(preview.toTemplateLabel).toBe("تقرير مبادرة");
    expect(preview.toTemplateVersionId).toBe("initiative-report@1");

    const bySource = new Map(preview.mappings.map(m => [m.sourceKey, m]));
    expect(bySource.get("summary")?.compatibility).toBe("exact");
    expect(bySource.get("goals")).toMatchObject({ targetKey: "objectives", compatibility: "alias" });
    expect(bySource.get("steps")).toMatchObject({ targetKey: "implementation", compatibility: "alias" });
    expect(bySource.get("subject")).toMatchObject({ targetKey: null, compatibility: "unmapped" });
    expect(bySource.get("duration")).toMatchObject({ targetKey: null, compatibility: "unmapped" });
    expect(preview.unmappedFields.map(f => f.key)).toEqual(["subject", "duration"]);
    expect(preview.appendToSummaryFits).toBe(true);
    expect(preview.newEmptyFields.some(f => f.key === "initiativeName")).toBe(true);
  });

  it("coerces same-key list/number/date fields when target is text/textarea", () => {
    const customV2 = normalizeReportDraft({
      schemaVersion: 2,
      templateId: "legacy-custom",
      templateVersionId: "legacy-custom@1",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: {
        summary: ["سطر أول", "سطر ثاني"],
        objectives: 42,
      },
      evidenceAssetIds: [],
      fieldDefinitions: [
        { key: "summary", label: "ملخص كقائمة", type: "list", maxLength: 2000 },
        { key: "objectives", label: "عدد الأهداف", type: "number", maxLength: 20 },
      ],
    }, { allowLegacy: false });

    const preview = previewTemplateSwitch(customV2, "custom");
    expect(preview.mappings).toEqual([
      {
        sourceKey: "summary",
        sourceLabel: "ملخص كقائمة",
        targetKey: "summary",
        targetLabel: "ملخص التقرير",
        compatibility: "coerced_to_text",
      },
      {
        sourceKey: "objectives",
        sourceLabel: "عدد الأهداف",
        targetKey: "objectives",
        targetLabel: "الأهداف",
        compatibility: "coerced_to_text",
      },
    ]);

    const applied = applyTemplateSwitch(customV2, "custom", "discard");
    expect(applied.fields.summary).toBe("سطر أول\nسطر ثاني");
    expect(applied.fields.objectives).toBe("42");
  });

  it("only maps select fields when value is in target options", () => {
    const validDraft = normalizeReportDraft({
      schemaVersion: 2,
      templateId: "custom-visit",
      templateVersionId: "custom-visit@1",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: { visitType: "صفية" },
      evidenceAssetIds: [],
      fieldDefinitions: [
        { key: "visitType", label: "نوع الزيارة", type: "select", options: ["صفية", "خاصة"] },
      ],
    }, { allowLegacy: false });

    const invalidDraft = normalizeReportDraft({
      schemaVersion: 2,
      templateId: "custom-visit",
      templateVersionId: "custom-visit@1",
      themeId: "classic",
      fontFamily: "Cairo",
      fields: { visitType: "خاصة" },
      evidenceAssetIds: [],
      fieldDefinitions: [
        { key: "visitType", label: "نوع الزيارة", type: "select", options: ["صفية", "خاصة"] },
      ],
    }, { allowLegacy: false });

    expect(previewTemplateSwitch(validDraft, "visit-report").mappings[0]?.compatibility).toBe("exact");
    expect(previewTemplateSwitch(invalidDraft, "visit-report").mappings[0]?.compatibility).toBe("unmapped");
  });

  it("appends unmapped fields to summary and throws on summary overflow", () => {
    const draft = makeDraft("workshop-report", {
      summary: "ملخص الورشة",
      workshopTitle: "ورشة التخطيط",
      participantsCount: 25,
    });

    const appended = applyTemplateSwitch(draft, "custom", "append_to_summary");
    expect(appended.templateId).toBe("custom");
    expect(appended.templateVersionId).toBe("custom@1");
    expect(appended.schemaVersion).toBe(2);
    expect(String(appended.fields.summary)).toContain("ملخص الورشة\n\n— حقول من القالب السابق —\n");
    expect(String(appended.fields.summary)).toContain("عنوان الورشة: ورشة التخطيط");
    expect(String(appended.fields.summary)).toContain("عدد المشاركين: 25");

    // Preserve identity, evidence, theme, font
    expect(appended.reportIdentity?.schoolName).toBe("مدرسة المستقبل");
    expect(appended.evidenceAssetIds).toEqual([11, 22]);
    expect(appended.themeId).toBe("formal");
    expect(appended.fontFamily).toBe("Tajawal");

    // Overflow test
    const hugeDraft = makeDraft("workshop-report", {
      summary: "أ".repeat(19_990),
      workshopTitle: "عنوان طويل يتجاوز الحد المتبقي في الملخص",
    });
    const hugePreview = previewTemplateSwitch(hugeDraft, "custom");
    expect(hugePreview.appendToSummaryFits).toBe(false);
    expect(() => applyTemplateSwitch(hugeDraft, "custom", "append_to_summary")).toThrow(ReportDocumentValidationError);

    // Discard strategy still works even when append doesn't fit
    const discarded = applyTemplateSwitch(hugeDraft, "custom", "discard");
    expect(discarded.templateId).toBe("custom");
    expect(discarded.fields.workshopTitle).toBeUndefined();
    expect(discarded.fields.summary).toBe("أ".repeat(19_990));
  });

  it("throws on unknown target template", () => {
    const draft = makeDraft("custom", { summary: "نص" });
    expect(() => previewTemplateSwitch(draft, "non-existent-template")).toThrow(ReportDocumentValidationError);
    expect(() => applyTemplateSwitch(draft, "non-existent-template", "discard")).toThrow(ReportDocumentValidationError);
  });

  it("rejects client-supplied fieldDefinitions on router switch/preview inputs", async () => {
    const caller = reportDraftRouter.createCaller({
      user: { id: 1, openId: "test", name: "Test", role: "user" } as never,
      req: {} as never,
      res: {} as never,
    });

    await expect(
      caller.previewTemplateSwitch({
        workItemId: 1,
        targetTemplateId: "custom",
        fieldDefinitions: [{ key: "hack", label: "hack", type: "text" }],
      } as never),
    ).rejects.toThrow();

    await expect(
      caller.switchTemplate({
        workItemId: 1,
        expectedRevision: 1,
        targetTemplateId: "custom",
        unmappedStrategy: "discard",
        fieldDefinitions: [{ key: "hack", label: "hack", type: "text" }],
      } as never),
    ).rejects.toThrow();
  });
});
