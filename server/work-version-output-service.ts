import { createHash } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { outputs, workItems, workVersions } from "../drizzle/domain-core";
import { getDb } from "./db";
import { renderHtmlToPdf } from "./pdf-renderer";
import {
  createOutputForUser,
  getOutputForUser,
  getWorkVersionForUser,
} from "./review-output-db";
import { storageGet, storagePut } from "./storage";
import { renderReportWorkVersionHtml } from "./work-version-report-renderer";

const REPORT_PDF_RENDERER_VERSION = 1;

export class OutputArtifactUnavailableError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutputArtifactUnavailableError";
  }
}

type OutputServiceDependencies = {
  renderPdf: (html: string) => Promise<Buffer>;
  putStorage: typeof storagePut;
  getStorage: typeof storageGet;
};

const defaultDependencies: OutputServiceDependencies = {
  renderPdf: html => renderHtmlToPdf(html, {
    format: "A4",
    printBackground: true,
    margin: { top: "0", right: "0", bottom: "0", left: "0" },
  }),
  putStorage: storagePut,
  getStorage: storageGet,
};

function artifactToken(versionId: number) {
  return `artifact:v${versionId}:pdf:r${REPORT_PDF_RENDERER_VERSION}`;
}

function artifactStorageKey(workItemId: number, versionId: number, contentHash: string) {
  return `outputs/work-${workItemId}/version-${versionId}/${contentHash}.pdf`;
}

function contentHashFromStorageKey(storageKey: string) {
  const match = storageKey.match(/\/([a-f0-9]{64})\.pdf$/i);
  return match?.[1]?.toLowerCase();
}

function safeFileName(title: string, versionNumber: number) {
  const normalized = title.normalize("NFKC")
    .replace(/[\\/]+/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/[^A-Za-z0-9\u0600-\u06FF\u0750-\u077F._ -]+/g, "")
    .trim()
    .slice(0, 90) || "report";
  return `${normalized}-v${versionNumber}.pdf`;
}

async function findRendererPrivatePdf(userId: number, workVersionId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [candidate] = await db
    .select({ output: outputs, version: workVersions, work: workItems })
    .from(outputs)
    .innerJoin(workVersions, eq(outputs.workVersionId, workVersions.id))
    .innerJoin(workItems, eq(workVersions.workItemId, workItems.id))
    .where(and(
      eq(outputs.workVersionId, workVersionId),
      eq(outputs.type, "pdf"),
      eq(outputs.visibility, "private"),
      eq(outputs.token, artifactToken(workVersionId)),
    ))
    .limit(1);
  if (!candidate) return undefined;
  return getOutputForUser(userId, candidate.output.id);
}

async function buildDownloadResult(
  userId: number,
  outputId: number,
  dependencies: OutputServiceDependencies,
  reused: boolean,
  knownFileSize?: number,
) {
  const output = await getOutputForUser(userId, outputId);
  if (!output) return undefined;
  if (output.revokedAt) throw new OutputArtifactUnavailableError("Output has been revoked; create a new WorkVersion to generate a new artifact");
  if (output.expiresAt && output.expiresAt.getTime() <= Date.now()) {
    throw new OutputArtifactUnavailableError("Output has expired");
  }
  if (output.type !== "pdf" || !output.storageKey) {
    throw new OutputArtifactUnavailableError("PDF artifact is not available yet");
  }

  const stored = await dependencies.getStorage(output.storageKey);
  return {
    outputId: output.id,
    workId: output.workId,
    workVersionId: output.workVersionId,
    versionNumber: output.versionNumber,
    rendererVersion: REPORT_PDF_RENDERER_VERSION,
    storageKey: output.storageKey,
    contentHash: contentHashFromStorageKey(output.storageKey),
    fileSize: knownFileSize,
    filename: safeFileName(output.workTitle, output.versionNumber),
    downloadUrl: stored.url,
    reused,
  };
}

export async function generatePrivatePdfForWorkVersion(
  userId: number,
  workVersionId: number,
  dependencies: OutputServiceDependencies = defaultDependencies,
) {
  const version = await getWorkVersionForUser(userId, workVersionId, "write");
  if (!version) return undefined;

  const existing = await findRendererPrivatePdf(userId, workVersionId);
  if (existing) {
    if (existing.revokedAt) {
      throw new OutputArtifactUnavailableError("This WorkVersion PDF was revoked; create a new WorkVersion before generating another artifact");
    }
    if (!existing.storageKey) {
      throw new OutputArtifactUnavailableError("PDF generation is already in progress or requires reconciliation");
    }
    return buildDownloadResult(userId, existing.id, dependencies, true);
  }

  const html = renderReportWorkVersionHtml(version.snapshot, version.versionNumber);
  const pdfBuffer = await dependencies.renderPdf(html);
  if (!Buffer.isBuffer(pdfBuffer) || pdfBuffer.length === 0) {
    throw new OutputArtifactUnavailableError("PDF renderer returned an empty artifact");
  }

  const contentHash = createHash("sha256").update(pdfBuffer).digest("hex");
  const storageKey = artifactStorageKey(version.work.id, workVersionId, contentHash);
  await dependencies.putStorage(storageKey, pdfBuffer, "application/pdf");

  let created;
  try {
    created = await createOutputForUser(userId, {
      workVersionId,
      type: "pdf",
      visibility: "private",
      token: artifactToken(workVersionId),
      storageKey,
    });
  } catch (error) {
    const raced = await findRendererPrivatePdf(userId, workVersionId);
    if (raced?.storageKey && !raced.revokedAt) {
      return buildDownloadResult(userId, raced.id, dependencies, true);
    }
    console.error("[output-reconciliation-required]", {
      workVersionId,
      storageKey,
      contentHash,
      rendererVersion: REPORT_PDF_RENDERER_VERSION,
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  }

  if (!created) {
    console.error("[output-reconciliation-required]", {
      workVersionId,
      storageKey,
      contentHash,
      rendererVersion: REPORT_PDF_RENDERER_VERSION,
      error: "output row was not created",
    });
    return undefined;
  }
  return buildDownloadResult(userId, created.id, dependencies, false, pdfBuffer.length);
}

export async function getPrivatePdfDownloadForUser(
  userId: number,
  outputId: number,
  dependencies: Pick<OutputServiceDependencies, "getStorage"> = defaultDependencies,
) {
  return buildDownloadResult(userId, outputId, { ...defaultDependencies, ...dependencies }, true);
}
