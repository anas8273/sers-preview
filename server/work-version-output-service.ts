import { createHash } from "node:crypto";
import { and, eq, isNotNull } from "drizzle-orm";
import { outputs } from "../drizzle/domain-core";
import { getDb } from "./db";
import { renderHtmlToPdf } from "./pdf-renderer";
import { createOutputForUser, getOutputForUser, getWorkVersionForUser } from "./review-output-db";
import { storageGet, storagePut } from "./output-artifact-storage";
import { renderReportWorkVersionHtml } from "./work-version-report-renderer";
import { renderReportWorkVersionDocx } from "./work-version-docx-renderer";
import { getConfiguredPrivateStorage } from "./upload-runtime";
import { withDocumentRenderBudget, RENDER_LIMITS } from "./render-limits";
import { requireActive } from "./bounded-work";

export const REPORT_PDF_RENDERER_VERSION = 2;
export const REPORT_DOCX_RENDERER_VERSION = 1;
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
type ArtifactType = "pdf" | "docx";
type StorageDependencies = { putStorage: typeof storagePut; getStorage: typeof storageGet };
export type PdfOutputDependencies = StorageDependencies & { renderPdf: (html: string) => Promise<Buffer> };
export type DocxOutputDependencies = StorageDependencies & { renderDocx: typeof renderReportWorkVersionDocx };

export class PrivateDocxStorageUnavailableError extends Error {
  constructor() { super("تصدير Word غير متاح حاليًا؛ يلزم تفعيل التخزين الخاص للمستندات"); this.name = "PrivateDocxStorageUnavailableError"; }
}
async function requirePrivateDocxStorage(dependencies: Pick<StorageDependencies, "getStorage"> & Partial<Pick<StorageDependencies, "putStorage">>) {
  if (dependencies.getStorage !== storageGet && dependencies.putStorage !== storagePut) return;
  if (!process.env.SERS_PRIVATE_STORAGE_DIR) throw new PrivateDocxStorageUnavailableError();
  try { await getConfiguredPrivateStorage(); } catch { throw new PrivateDocxStorageUnavailableError(); }
}
export class OutputArtifactUnavailableError extends Error {
  constructor(message: string) { super(message); this.name = "OutputArtifactUnavailableError"; }
}
const defaultStorage = { putStorage: storagePut, getStorage: storageGet };
const defaultPdf: PdfOutputDependencies = {
  ...defaultStorage,
  renderPdf: html => renderHtmlToPdf(html, { format: "A4", printBackground: true, margin: { top: "0", right: "0", bottom: "0", left: "0" } }),
};
const defaultDocx: DocxOutputDependencies = { ...defaultStorage, renderDocx: (snapshot, version) => withDocumentRenderBudget(async signal => {
  requireActive(signal);
  const bytes = await renderReportWorkVersionDocx(snapshot, version);
  requireActive(signal);
  return bytes;
}, RENDER_LIMITS.docxTimeoutMs) };
const rendererVersion = (type: ArtifactType) => type === "pdf" ? REPORT_PDF_RENDERER_VERSION : REPORT_DOCX_RENDERER_VERSION;
const artifactToken = (versionId: number, type: ArtifactType) => `artifact:v${versionId}:${type}:r${rendererVersion(type)}`;
export function recognizedRenderer(token: string | null, versionId: number, type: ArtifactType) {
  const match = token?.match(new RegExp(`^artifact:v${versionId}:${type}:r([1-9][0-9]*)$`));
  const revision = match ? Number(match[1]) : 0;
  return revision >= 1 && revision <= rendererVersion(type) ? revision : undefined;
}
export async function hasRevokedRendererArtifact(workVersionId: number, type: ArtifactType, workId: number) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const revoked = await db.select({ token: outputs.token, storageKey: outputs.storageKey }).from(outputs).where(and(
    eq(outputs.workVersionId, workVersionId), eq(outputs.type, type), eq(outputs.visibility, "private"), isNotNull(outputs.revokedAt),
  ));
  const identity = new RegExp(`^outputs/work-${workId}/version-${workVersionId}/[a-f0-9]{64}[.]${type}$`);
  return revoked.some(output => recognizedRenderer(output.token, workVersionId, type) && output.storageKey && identity.test(output.storageKey));
}
async function assertNoRevokedRendererArtifact(workVersionId: number, type: ArtifactType, workId: number) {
  if (await hasRevokedRendererArtifact(workVersionId, type, workId)) throw new OutputArtifactUnavailableError("This WorkVersion output was revoked; create a new WorkVersion before generating another artifact");
}

function safeFileName(title: string, versionNumber: number, type: ArtifactType) {
  const normalized = title.normalize("NFKC").replace(/[\\/]+/g, "-")
    .replace(/[\u0000-\u001f\u007f]/g, "").replace(/[^A-Za-z0-9\u0600-\u06FF\u0750-\u077F._ -]+/g, "").trim().slice(0, 90) || "report";
  return `${normalized}-v${versionNumber}.${type}`;
}
async function findRendererArtifact(userId: number, workVersionId: number, type: ArtifactType) {
  const db = await getDb();
  if (!db) throw new Error("Database not available");
  const [candidate] = await db.select({ id: outputs.id }).from(outputs).where(and(
    eq(outputs.workVersionId, workVersionId), eq(outputs.type, type), eq(outputs.visibility, "private"), eq(outputs.token, artifactToken(workVersionId, type)),
  )).limit(1);
  return candidate ? getOutputForUser(userId, candidate.id) : undefined;
}
async function buildDownloadResult(userId: number, outputId: number, type: ArtifactType, dependencies: Pick<StorageDependencies, "getStorage">, reused: boolean, fileSize?: number) {
  const output = await getOutputForUser(userId, outputId);
  if (!output) return undefined;
  if (output.revokedAt) throw new OutputArtifactUnavailableError("Output has been revoked; create a new WorkVersion to generate a new artifact");
  if (output.expiresAt && output.expiresAt.getTime() <= Date.now()) throw new OutputArtifactUnavailableError("Output has expired");
  const actualRendererVersion = recognizedRenderer(output.token, output.workVersionId, type);
  const identity = output.storageKey?.match(new RegExp(`^outputs/work-${output.workId}/version-${output.workVersionId}/([a-f0-9]{64})[.]${type}$`));
  if (output.type !== type || output.visibility !== "private" || !output.storageKey || !actualRendererVersion || !identity) throw new OutputArtifactUnavailableError("Private artifact is not available");
  // A renderer upgrade must not restore access to a revoked version artifact.
  await assertNoRevokedRendererArtifact(output.workVersionId, type, output.workId);
  const version = await getWorkVersionForUser(userId, output.workVersionId);
  if (!version) return undefined;
  const snapshotTitle = (version.snapshot as { work?: { title?: unknown } }).work?.title;
  const title = typeof snapshotTitle === "string" ? snapshotTitle : output.workTitle;
  const stored = await dependencies.getStorage(output.storageKey);
  // getStorage may return an authenticated application route in a self-host setup.
  return { outputId: output.id, workId: output.workId, workVersionId: output.workVersionId,
    versionNumber: output.versionNumber, rendererVersion: actualRendererVersion, type,
    storageKey: output.storageKey, contentHash: identity[1],
    fileSize, filename: safeFileName(title, output.versionNumber, type), downloadUrl: dependencies.getStorage === storageGet && process.env.SERS_PRIVATE_STORAGE_DIR
      ? `/api/work-outputs/${output.id}/download` : stored.url, reused,
  };
}
async function generateArtifact(userId: number, workVersionId: number, type: ArtifactType, dependencies: StorageDependencies,
  render: (snapshot: unknown, versionNumber: number) => Promise<Buffer>) {
  const version = await getWorkVersionForUser(userId, workVersionId, "write");
  if (!version) return undefined;
  await assertNoRevokedRendererArtifact(workVersionId, type, version.work.id);
  const existing = await findRendererArtifact(userId, workVersionId, type);
  if (existing) {
    if (existing.revokedAt) throw new OutputArtifactUnavailableError("This WorkVersion output was revoked; create a new WorkVersion before generating another artifact");
    if (!existing.storageKey) throw new OutputArtifactUnavailableError("Output generation is in progress or requires reconciliation");
    return buildDownloadResult(userId, existing.id, type, dependencies, true);
  }
  const buffer = await render(version.snapshot, version.versionNumber);
  if (!Buffer.isBuffer(buffer) || !buffer.length || buffer.length > 16 * 1024 * 1024) throw new OutputArtifactUnavailableError("Renderer returned an invalid artifact or exceeded the 16 MiB export limit");
  const contentHash = createHash("sha256").update(buffer).digest("hex");
  const storageKey = `outputs/work-${version.work.id}/version-${workVersionId}/${contentHash}.${type}`;
  await dependencies.putStorage(storageKey, buffer, type === "pdf" ? "application/pdf" : DOCX_MIME);
  let created;
  try {
    await assertNoRevokedRendererArtifact(workVersionId, type, version.work.id);
    created = await createOutputForUser(userId, { workVersionId, type, visibility: "private", token: artifactToken(workVersionId, type), storageKey });
  } catch (error) {
    const raced = await findRendererArtifact(userId, workVersionId, type);
    if (raced?.storageKey && !raced.revokedAt) return buildDownloadResult(userId, raced.id, type, dependencies, true);
    console.error("[output-reconciliation-required]", { workVersionId, type, contentHash, rendererVersion: rendererVersion(type) });
    throw error;
  }
  if (!created) {
    console.error("[output-reconciliation-required]", { workVersionId, type, contentHash, rendererVersion: rendererVersion(type) });
    return undefined;
  }
  return buildDownloadResult(userId, created.id, type, dependencies, false, buffer.length);
}
export async function generatePrivatePdfForWorkVersion(userId: number, workVersionId: number, dependencies: PdfOutputDependencies = defaultPdf) {
  return generateArtifact(userId, workVersionId, "pdf", dependencies, (snapshot, version) => dependencies.renderPdf(renderReportWorkVersionHtml(snapshot, version)));
}
export async function getPrivatePdfDownloadForUser(userId: number, outputId: number, dependencies: Pick<StorageDependencies, "getStorage"> = defaultStorage) {
  return buildDownloadResult(userId, outputId, "pdf", dependencies, true);
}
export async function generatePrivateDocxForWorkVersion(userId: number, workVersionId: number, dependencies: DocxOutputDependencies = defaultDocx) {
  await requirePrivateDocxStorage(dependencies);
  return generateArtifact(userId, workVersionId, "docx", dependencies, dependencies.renderDocx);
}
export async function getPrivateDocxDownloadForUser(userId: number, outputId: number, dependencies: Pick<StorageDependencies, "getStorage"> = defaultStorage) {
  await requirePrivateDocxStorage(dependencies);
  return buildDownloadResult(userId, outputId, "docx", dependencies, true);
}
