import type { ReportDraftData } from "../../server/work-report-draft-db";

/** Build a save payload from the frozen contract returned by the draft read. */
export function reportDraftSaveInput(
  draft: ReportDraftData,
  overrides: {
    workItemId: number;
    expectedRevision: number;
    fields: ReportDraftData["fields"];
    reportIdentity?: ReportDraftData["reportIdentity"];
    evidenceAssetIds?: number[];
    themeId?: string;
    fontFamily?: string;
  },
) {
  const reportIdentity = overrides.reportIdentity !== undefined ? overrides.reportIdentity : draft.reportIdentity;
  return {
    workItemId: overrides.workItemId,
    expectedRevision: overrides.expectedRevision,
    schemaVersion: draft.schemaVersion,
    templateId: draft.templateId,
    templateVersionId: draft.templateVersionId,
    themeId: overrides.themeId ?? draft.themeId,
    fontFamily: overrides.fontFamily ?? draft.fontFamily,
    fields: overrides.fields,
    ...(reportIdentity !== undefined ? { reportIdentity } : {}),
    evidenceAssetIds: overrides.evidenceAssetIds ?? draft.evidenceAssetIds,
    fieldDefinitions: draft.fieldDefinitions,
  };
}
