import type { Express, Request, Response } from "express";
import type { User } from "../drizzle/schema";
import { downloadReadyAssetForUser } from "./upload-lifecycle-service";
import { receiveUploadIntentForUser } from "./upload-reception-service";
import { uploadError } from "./evidence-upload-router";
import { getUploadRuntime, withUploadSlot, type UploadRuntime } from "./upload-runtime";

const statusCodes: Record<string, number> = { NOT_FOUND: 404, CONFLICT: 409, TOO_MANY_REQUESTS: 429, PRECONDITION_FAILED: 503 };
function sendError(res: Response, error: unknown) {
  const mapped = uploadError(error);
  if (!res.destroyed && !res.headersSent) res.status(statusCodes[mapped.code] ?? 500).json({ error: mapped.message });
}
export function sameOriginUploadRequest(req: Request) {
  if (req.get("sec-fetch-site") === "cross-site") return false;
  const origin = req.get("origin");
  if (!origin) return true; // Non-browser clients must still carry a valid session.
  try { const url = new URL(origin); return ["http:", "https:"].includes(url.protocol) && url.host === req.get("host"); }
  catch { return false; }
}
/** The production entry point supplies sdk.authenticateRequest. Test/demo
 * harnesses can inject their own identity without changing production auth. */
export function registerEvidenceHttpRoutes(app: Express, options: {
  authenticate: (req: Request) => Promise<User | null>;
  runtime?: () => Promise<UploadRuntime>;
}) {
  const runtime = options.runtime ?? getUploadRuntime;
  app.put("/api/evidence/uploads/:id", async (req, res) => {
    res.setHeader("Cache-Control", "no-store");
    if (!sameOriginUploadRequest(req)) { res.status(403).json({ error: "طلب غير مسموح" }); return; }
    if (req.get("content-type")?.split(";")[0].trim() !== "application/octet-stream" || req.get("content-encoding")) { res.status(415).json({ error: "أرسل الملف بصيغته الأصلية" }); return; }
    if (!/^[a-f0-9-]{36}$/i.test(req.params.id) || typeof req.query.revision !== "string" || !/^(0|[1-9][0-9]*)$/.test(req.query.revision) || !Number.isSafeInteger(Number(req.query.revision))) { res.status(400).json({ error: "طلب رفع غير صالح" }); return; }
    let user: User | null;
    try { user = await options.authenticate(req); } catch { user = null; }
    if (!user) { res.status(401).json({ error: "يلزم تسجيل الدخول" }); return; }
    const controller = new AbortController();
    req.once("aborted", () => controller.abort());
    res.once("close", () => { if (!res.writableEnded) controller.abort(); });
    try {
      const result = await withUploadSlot(user.id, async () => {
        const configured = await runtime();
        return receiveUploadIntentForUser(user.id, { id: req.params.id, expectedRevision: Number(req.query.revision), source: req, signal: controller.signal }, configured.storage);
      });
      if (!result) { res.status(404).json({ error: "طلب الرفع غير متاح" }); return; }
      if (!res.destroyed) res.json(result);
    } catch (error) { sendError(res, error); }
  });
  app.get("/api/evidence/assets/:id/download", async (req, res) => {
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Content-Security-Policy", "sandbox; default-src 'none'");
    res.setHeader("Vary", "Cookie");
    let user: User | null;
    try { user = await options.authenticate(req); } catch { user = null; }
    if (!user) { res.status(401).json({ error: "يلزم تسجيل الدخول" }); return; }
    if (!/^[1-9][0-9]*$/.test(req.params.id) || !Number.isSafeInteger(Number(req.params.id))) { res.status(404).end(); return; }
    try {
      const configured = await runtime();
      const result = await downloadReadyAssetForUser(user.id, Number(req.params.id), configured.storage);
      if (!result) { res.status(404).json({ error: "الشاهد غير متاح" }); return; }
      res.setHeader("Content-Type", result.mimeType);
      const filename = result.fileName.replace(/[\r\n\\/\x00-\x1f\x7f]/g, "-").slice(0, 180) || "evidence";
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Content-Length", result.bytes.byteLength);
      res.send(Buffer.from(result.bytes));
    } catch (error) { sendError(res, error); }
  });
}
