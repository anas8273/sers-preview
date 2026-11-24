import { and, eq, isNull } from "drizzle-orm";
import { outputs, reviews, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { verifyProtectedOutputPassword } from "./output-password";
import { projectReportDocument, type ReportProjectionAsset } from "../shared/report-projection";
import { sanitizeReportSchoolLogo } from "./work-version-report-assets";

export class PublicOutputNotFoundError extends Error {
  constructor() {
    super("Public output is unavailable");
    this.name = "PublicOutputNotFoundError";
  }
}

export class PublicOutputPasswordRequiredError extends Error {
  constructor() {
    super("Protected output password is required");
    this.name = "PublicOutputPasswordRequiredError";
  }
}

export class PublicOutputPasswordInvalidError extends Error {
  constructor() {
    super("Protected output password is invalid");
    this.name = "PublicOutputPasswordInvalidError";
  }
}

type ReportAssetSnapshot = ReportProjectionAsset & {
  title?: string;
  kind?: string;
  role?: string;
  caption?: string | null;
};

type ReportSnapshot = {
  kind?: string;
  work?: { title?: string };
  reportDraft?: {
    templateId?: string;
    fields?: Record<string, unknown>;
    reportIdentity?: unknown;
    evidenceAssetIds?: unknown[];
    updatedAt?: string;
  };
  assets?: ReportAssetSnapshot[];
  capturedAt?: string;
};

export function projectReportSnapshot(value: unknown) {
  if (!value || typeof value !== "object") return undefined;
  const snapshot = value as ReportSnapshot;
  if (snapshot.kind !== "report" || !snapshot.work || !snapshot.reportDraft) {
    return undefined;
  }

  let model;
  try {
    model = projectReportDocument({ reportDraft: snapshot.reportDraft, assets: snapshot.assets });
  } catch {
    // A malformed historical snapshot is not exposed through a public token.
    return undefined;
  }

  const selectedIds = new Set(
    Array.isArray(snapshot.reportDraft.evidenceAssetIds)
      ? snapshot.reportDraft.evidenceAssetIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
      : [],
  );
  const evidence = (Array.isArray(snapshot.assets) ? snapshot.assets : [])
    .filter(asset => asset && typeof asset.id === "number" && selectedIds.has(asset.id))
    .map(asset => ({
      title: typeof asset.title === "string" && asset.title.trim() ? asset.title.trim() : "شاهد",
      kind: typeof asset.kind === "string" ? asset.kind : "asset",
      role: typeof asset.role === "string" ? asset.role : "evidence",
      caption: typeof asset.caption === "string" && asset.caption.trim() ? asset.caption.trim() : undefined,
    }));

  const rawInstitution = model.identity;
  let sanitizedSchoolLogo = "";
  if (rawInstitution.schoolLogo) {
    try {
      sanitizedSchoolLogo = sanitizeReportSchoolLogo(rawInstitution.schoolLogo).bytes.toString("base64");
    } catch {
      sanitizedSchoolLogo = "";
    }
  }
  const institutionVisible = Boolean(
    rawInstitution.schoolName
    || rawInstitution.ministryLogo
    || sanitizedSchoolLogo
    || rawInstitution.signers.length > 0,
  );
  const institution = institutionVisible
    ? {
        schoolName: rawInstitution.schoolName,
        ministryLogo: rawInstitution.ministryLogo,
        ...(sanitizedSchoolLogo ? { schoolLogo: sanitizedSchoolLogo } : {}),
        signers: rawInstitution.signers,
        visible: true as const,
      }
    : undefined;

  return {
    title: typeof snapshot.work.title === "string" && snapshot.work.title.trim()
      ? snapshot.work.title.trim()
      : "تقرير",
    schemaVersion: model.schemaVersion,
    templateLabel: model.template.label,
    capturedAt: typeof snapshot.capturedAt === "string"
      ? snapshot.capturedAt
      : typeof snapshot.reportDraft.updatedAt === "string"
        ? snapshot.reportDraft.updatedAt
        : undefined,
    fields: model.fields.map(field => ({ key: field.key, label: field.label, type: field.type, value: field.value })),
    evidence,
    ...(institution ? { institution } : {}),
  };
}

export async function resolvePublicOutput(token: string, password?: string) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [row] = await db
    .select({ output: outputs, version: workVersions, work: workItems })
    .from(outputs)
    .innerJoin(workVersions, eq(outputs.workVersionId, workVersions.id))
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(and(eq(outputs.token, token), isNull(workItems.deletedAt)))
    .limit(1);

  if (!row) throw new PublicOutputNotFoundError();
  if (row.output.type !== "link" && row.output.type !== "qr") throw new PublicOutputNotFoundError();
  if (row.output.visibility !== "public" && row.output.visibility !== "protected") {
    throw new PublicOutputNotFoundError();
  }
  if (row.output.revokedAt) throw new PublicOutputNotFoundError();
  if (row.output.expiresAt && row.output.expiresAt.getTime() <= Date.now()) {
    throw new PublicOutputNotFoundError();
  }

  const [approvedReview] = await db
    .select({ id: reviews.id })
    .from(reviews)
    .where(and(eq(reviews.workVersionId, row.version.id), eq(reviews.status, "approved")))
    .limit(1);
  if (!approvedReview) throw new PublicOutputNotFoundError();

  if (row.output.visibility === "protected") {
    if (!password) throw new PublicOutputPasswordRequiredError();
    if (!row.output.passwordHash || !verifyProtectedOutputPassword(password, row.output.passwordHash)) {
      throw new PublicOutputPasswordInvalidError();
    }
  }

  const report = projectReportSnapshot(row.version.snapshot);
  if (!report) throw new PublicOutputNotFoundError();
  return {
    type: row.output.type,
    visibility: row.output.visibility,
    expiresAt: row.output.expiresAt,
    versionNumber: row.version.versionNumber,
    report,
  };
}
