import { and, eq } from "drizzle-orm";
import { outputs, reviews, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { verifyProtectedOutputPassword } from "./output-password";

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

type ReportAssetSnapshot = {
  id?: number;
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
    evidenceAssetIds?: unknown[];
    updatedAt?: string;
  };
  assets?: ReportAssetSnapshot[];
  capturedAt?: string;
};

const FIELD_DEFINITIONS = [
  ["summary", "ملخص التقرير"],
  ["objectives", "الأهداف"],
  ["audience", "الفئة المستهدفة"],
  ["implementation", "آلية التنفيذ"],
  ["results", "النتائج والمخرجات"],
  ["impact", "قياس الأثر"],
  ["recommendations", "التوصيات والخطوات التالية"],
] as const;

const TEMPLATE_LABELS: Record<string, string> = {
  custom: "تقرير عام",
  "program-report": "تقرير برنامج",
  "initiative-report": "تقرير مبادرة",
  "workshop-report": "تقرير ورشة",
  "meeting-report": "محضر/تقرير اجتماع",
  "visit-report": "تقرير زيارة",
};

function normalizeReportSnapshot(value: unknown) {
  if (!value || typeof value !== "object") throw new PublicOutputNotFoundError();
  const snapshot = value as ReportSnapshot;
  if (snapshot.kind !== "report" || !snapshot.work || !snapshot.reportDraft) {
    throw new PublicOutputNotFoundError();
  }

  const rawFields = snapshot.reportDraft.fields && typeof snapshot.reportDraft.fields === "object"
    ? snapshot.reportDraft.fields
    : {};
  const fields = FIELD_DEFINITIONS.flatMap(([key, label]) => {
    const rawValue = rawFields[key];
    if (typeof rawValue !== "string" || !rawValue.trim()) return [];
    return [{ key, label, value: rawValue.trim() }];
  });

  const selectedIds = new Set(
    Array.isArray(snapshot.reportDraft.evidenceAssetIds)
      ? snapshot.reportDraft.evidenceAssetIds.filter((id): id is number => Number.isInteger(id) && Number(id) > 0)
      : [],
  );
  const evidence = (Array.isArray(snapshot.assets) ? snapshot.assets : [])
    .filter(asset => typeof asset.id === "number" && selectedIds.has(asset.id))
    .map(asset => ({
      title: typeof asset.title === "string" && asset.title.trim() ? asset.title.trim() : "شاهد",
      kind: typeof asset.kind === "string" ? asset.kind : "asset",
      role: typeof asset.role === "string" ? asset.role : "evidence",
      caption: typeof asset.caption === "string" && asset.caption.trim() ? asset.caption.trim() : undefined,
    }));

  const templateId = typeof snapshot.reportDraft.templateId === "string"
    ? snapshot.reportDraft.templateId
    : "custom";
  return {
    title: typeof snapshot.work.title === "string" && snapshot.work.title.trim()
      ? snapshot.work.title.trim()
      : "تقرير",
    templateLabel: TEMPLATE_LABELS[templateId] || "تقرير",
    capturedAt: typeof snapshot.capturedAt === "string"
      ? snapshot.capturedAt
      : typeof snapshot.reportDraft.updatedAt === "string"
        ? snapshot.reportDraft.updatedAt
        : undefined,
    fields,
    evidence,
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
    .where(and(eq(outputs.token, token), eq(workItems.deletedAt, null as never)))
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

  const report = normalizeReportSnapshot(row.version.snapshot);
  return {
    type: row.output.type,
    visibility: row.output.visibility,
    expiresAt: row.output.expiresAt,
    versionNumber: row.version.versionNumber,
    report,
  };
}
