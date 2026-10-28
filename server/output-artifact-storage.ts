import { createHash } from "node:crypto";
import type { Express, Request } from "express";
import type { User } from "../drizzle/schema";
import { getOutputForUser, getWorkVersionForUser } from "./review-output-db";
import { getConfiguredPrivateStorage } from "./upload-runtime";
import { storageGet as legacyGet, storagePut as legacyPut } from "./storage";
import { MAX_EVIDENCE_BYTES } from "./upload-validation";

const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
function artifactIdentity(key: string) {
  const match = /^outputs\/work-([1-9][0-9]*)\/version-([1-9][0-9]*)\/([a-f0-9]{64})\.(pdf|docx)$/.exec(key);
  if (!match) throw new Error("Invalid artifact key");
  return { key: `artifacts/${digest(key)}`, workId: Number(match[1]), versionId: Number(match[2]), sha256: match[3], type: match[4] as "pdf" | "docx" };
}
/** Server-generated artifacts use private storage in self-host deployments.
 * Existing Forge-backed deployments retain their configured storage contract. */
export async function storagePut(key: string, data: Buffer | Uint8Array | string, contentType = "application/octet-stream"): Promise<{ key: string; url: string }> {
  if (!process.env.SERS_PRIVATE_STORAGE_DIR) return legacyPut(key, data, contentType);
  const identity = artifactIdentity(key);
  const bytes = typeof data === "string" ? Buffer.from(data) : data;
  if (!bytes.byteLength || bytes.byteLength > MAX_EVIDENCE_BYTES || digest(bytes) !== identity.sha256) throw new Error("Invalid artifact content");
  const storage = await getConfiguredPrivateStorage();
  const put = await storage.putPrivateIfAbsent({ key: identity.key, bytes, sha256: identity.sha256 });
  if (put.status !== "created" && put.status !== "exists") throw new Error("Artifact storage unconfirmed");
  const head = await storage.headPrivate(identity.key, put.status === "created" ? put.version : undefined);
  if (head.status !== "found" || !head.private || head.sha256 !== identity.sha256 || head.bytes !== bytes.byteLength) throw new Error("Artifact storage unconfirmed");
  return { key, url: "" }; // Output service supplies the authenticated output-id URL.
}
export async function storageGet(key: string): Promise<{ key: string; url: string }> {
  if (!process.env.SERS_PRIVATE_STORAGE_DIR) return legacyGet(key);
  const identity = artifactIdentity(key);
  const storage = await getConfiguredPrivateStorage();
  const head = await storage.headPrivate(identity.key);
  if (head.status !== "found" || !head.private || head.sha256 !== identity.sha256) throw new Error("Artifact unavailable");
  return { key, url: "" };
}
export async function readPrivateOutputForUser(userId: number, id: number) {
  const output = await getOutputForUser(userId, id);
  if (!output || output.visibility !== "private" || !["pdf", "docx"].includes(output.type) || !output.storageKey || output.revokedAt || (output.expiresAt && output.expiresAt.getTime() <= Date.now())) return undefined;
  const identity = artifactIdentity(output.storageKey);
  if (identity.type !== output.type || identity.workId !== output.workId || identity.versionId !== output.workVersionId || !output.token?.startsWith(`artifact:v${output.workVersionId}:${output.type}:r`)) return undefined;
  const { hasRevokedRendererArtifact, recognizedRenderer } = await import("./work-version-output-service");
  if (!recognizedRenderer(output.token, output.workVersionId, identity.type) || await hasRevokedRendererArtifact(output.workVersionId, identity.type, output.workId)) return undefined;
  const storage = await getConfiguredPrivateStorage();
  const head = await storage.headPrivate(identity.key);
  if (head.status !== "found" || !head.private || head.sha256 !== identity.sha256 || head.bytes > MAX_EVIDENCE_BYTES) return undefined;
  const read = await storage.readPrivate(identity.key, head.version, MAX_EVIDENCE_BYTES);
  if (read.status !== "found" || read.bytes.byteLength !== head.bytes || digest(read.bytes) !== identity.sha256) return undefined;
  // Membership and revocation can change while reading from storage.
  const current = await getOutputForUser(userId, id);
  if (!current || current.storageKey !== output.storageKey || current.visibility !== "private" || current.revokedAt || (current.expiresAt && current.expiresAt.getTime() <= Date.now())) return undefined;
  if (await hasRevokedRendererArtifact(output.workVersionId, identity.type, output.workId)) return undefined;
  const version = await getWorkVersionForUser(userId, output.workVersionId);
  if (!version) return undefined;
  const rawTitle = (version.snapshot as { work?: { title?: unknown } }).work?.title;
  const title = (typeof rawTitle === "string" ? rawTitle : "report").replace(/[\r\n\\/\x00-\x1f\x7f]/g, "-").slice(0, 100);
  return { bytes: read.bytes, fileName: `${title}-v${output.versionNumber}.${output.type}`, mimeType: output.type === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document" };
}
export function registerPrivateOutputRoutes(app: Express, authenticate: (request: Request) => Promise<User | null>) {
  app.get("/api/work-outputs/:id/download", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Vary", "Cookie");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    let user: User | null;
    try { user = await authenticate(req); } catch { user = null; }
    if (!user) { res.status(401).end(); return; }
    if (!/^[1-9][0-9]*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) { res.status(404).end(); return; }
    try {
      const result = await readPrivateOutputForUser(user.id, Number(req.params.id));
      if (!result) { res.status(404).end(); return; }
      res.setHeader("Content-Type", result.mimeType);
      res.setHeader("Content-Length", result.bytes.byteLength);
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(result.fileName)}`);
      res.send(Buffer.from(result.bytes));
    } catch { res.status(503).json({ error: "تعذر تنزيل الملف حاليًا" }); }
  });
}
