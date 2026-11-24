export type ReportVersionRevisionSource = {
  reportRevision?: unknown;
  snapshot?: { reportDraft?: { revision?: unknown } };
};

export type ReportVersionFreshness = "fresh" | "stale" | "unknown";

export function reportRevisionOfVersion(value: unknown): number | undefined {
  if (!value || typeof value !== "object") return undefined;
  const candidate = value as ReportVersionRevisionSource;
  const revision = candidate.reportRevision ?? candidate.snapshot?.reportDraft?.revision;
  return Number.isSafeInteger(revision) && Number(revision) >= 0 ? Number(revision) : undefined;
}

export function compareReportDraftToVersion(currentDraftRevision: unknown, version: unknown): ReportVersionFreshness {
  const current = Number.isSafeInteger(currentDraftRevision) && Number(currentDraftRevision) >= 0
    ? Number(currentDraftRevision)
    : undefined;
  const frozen = reportRevisionOfVersion(version);
  if (current === undefined || frozen === undefined) return "unknown";
  return current > frozen ? "stale" : "fresh";
}
