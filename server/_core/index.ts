import { withDocumentRenderBudget, RENDER_LIMITS } from "../render-limits";
import { ResourceLimitError, requireActive } from "../bounded-work";
import "dotenv/config";
import express, { type NextFunction, type Request, type Response } from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import type { User } from "../../drizzle/schema";
import { registerOAuthRoutes } from "./oauth";
import { ENV, getAuthConfig } from "./env";
import { appRouter } from "../root-router";
import { createContext } from "./context";
import { serveStatic, setupVite } from "./vite";
import { sdk } from "./sdk";
import { seedDefaultTemplates } from "../db";
import { registerRuntimeObservability } from "../runtime-observability";
import { registerEvidenceHttpRoutes } from "../evidence-http-routes";
import { registerPrivateOutputRoutes } from "../output-artifact-storage";
import { renderHtmlToPdf } from "../pdf-renderer";
import { fetchRemoteImage, RemoteImageError } from "../safe-remote-image";

type AuthenticatedRequest = Request & { authUser?: User };

type RateBucket = { count: number; resetAt: number };
const rateBuckets = new Map<string, RateBucket>();

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise(resolve => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) return port;
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function requireAuthenticatedUser(req: AuthenticatedRequest, res: Response, next: NextFunction) {
  try {
    const user = await sdk.authenticateRequest(req);
    if (!user) {
      res.status(401).json({ error: "Authentication required" });
      return;
    }
    req.authUser = user;
    next();
  } catch {
    res.status(401).json({ error: "Authentication required" });
  }
}

function rateLimit(name: string, maxRequests: number, windowMs: number) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    const identity = req.authUser?.id ? `user:${req.authUser.id}` : `ip:${req.ip}`;
    const key = `${name}:${identity}`;
    const now = Date.now();
    const current = rateBuckets.get(key);
    const bucket = !current || current.resetAt <= now ? { count: 0, resetAt: now + windowMs } : current;
    bucket.count += 1;
    rateBuckets.set(key, bucket);

    res.setHeader("RateLimit-Limit", String(maxRequests));
    res.setHeader("RateLimit-Remaining", String(Math.max(0, maxRequests - bucket.count)));
    res.setHeader("RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));
    if (bucket.count > maxRequests) {
      res.setHeader("Retry-After", String(Math.max(1, Math.ceil((bucket.resetAt - now) / 1000))));
      res.status(429).json({ error: "Too many requests" });
      return;
    }
    next();
  };
}

function serializedSize(value: unknown) {
  try {
    return Buffer.byteLength(JSON.stringify(value), "utf8");
  } catch {
    return Number.POSITIVE_INFINITY;
  }
}

function assertPayloadSize(value: unknown, maxBytes: number, label: string) {
  if (serializedSize(value) > maxBytes) throw new RemoteImageError(`${label} exceeds the size limit`, 413);
}

function assertSafeHtml(value: unknown) {
  if (typeof value !== "string" || value.trim().length === 0) throw new RemoteImageError("Missing html content", 400);
  if (Buffer.byteLength(value, "utf8") > 2_500_000) throw new RemoteImageError("HTML exceeds the size limit", 413);
  const activeContent = /<\s*(script|iframe|object|embed|applet|base)\b|javascript\s*:|on[a-z]+\s*=|<\s*meta\b[^>]*http-equiv\s*=|<\s*link\b/i;
  if (activeContent.test(value)) throw new RemoteImageError("Active or externally linked HTML is not allowed", 400);
  return value;
}

function safeDownloadName(value: unknown, fallback: string, extension: string) {
  const raw = typeof value === "string" ? value.normalize("NFKC") : fallback;
  const withoutPaths = raw.replace(/[\\/]+/g, "-").replace(/[\u0000-\u001f\u007f]/g, "");
  const clean = withoutPaths
    .replace(/[^A-Za-z0-9\u0600-\u06FF\u0750-\u077F._ -]+/g, "")
    .trim()
    .slice(0, 120) || fallback;
  return clean.toLowerCase().endsWith(extension) ? clean : `${clean}${extension}`;
}

function sendRouteError(res: Response, error: unknown, context: string) {
  if (error instanceof RemoteImageError || error instanceof ResourceLimitError) {
    res.status(error.statusCode).json({ error: error.message });
    return;
  }
  console.error(JSON.stringify({ event: "route_failed", operation: context, requestId: res.getHeader("X-Request-ID") }));
  res.status(500).json({ error: `${context} failed` });
}

async function startServer() {
  if (ENV.isProduction) getAuthConfig();
  const app = express();
  const server = createServer(app);
  app.disable("x-powered-by");
  registerRuntimeObservability(app);
  registerEvidenceHttpRoutes(app, { authenticate: req => sdk.authenticateRequest(req) });
  registerPrivateOutputRoutes(app, req => sdk.authenticateRequest(req));
  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));
  registerOAuthRoutes(app);

  const exportRateLimit = rateLimit("export", 10, 60_000);
  const proxyRateLimit = rateLimit("image-proxy", 60, 60_000);

  app.post("/api/export-pdf", requireAuthenticatedUser, exportRateLimit, async (req: AuthenticatedRequest, res) => {
    try {
      assertPayloadSize(req.body, 3_000_000, "PDF request");
      const html = assertSafeHtml(req.body?.html);
      const filename = safeDownloadName(req.body?.filename, "document", ".pdf");
      const pdfBuffer = await renderHtmlToPdf(html, {
        format: "A4",
        printBackground: true,
        margin: { top: "0", right: "0", bottom: "0", left: "0" },
      });
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Content-Length", pdfBuffer.length.toString());
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(pdfBuffer);
    } catch (error) {
      sendRouteError(res, error, "PDF generation");
    }
  });

  app.post("/api/export-docx", requireAuthenticatedUser, exportRateLimit, async (req: AuthenticatedRequest, res) => {
    try {
      assertPayloadSize(req.body, 16_000_000, "DOCX request");
      const { data, html: rawHtml, imageBase64, width, height } = req.body ?? {};
      const filename = safeDownloadName(req.body?.filename, "document", ".docx");
      let docxBuffer: Buffer;

      if (rawHtml) {
        const html = assertSafeHtml(rawHtml);
        const { renderHtmlToDocxPuppeteer } = await import("../pdf-renderer");
        docxBuffer = await renderHtmlToDocxPuppeteer(html);
      } else if (imageBase64) {
        if (typeof imageBase64 !== "string" || imageBase64.length > 15_000_000) {
          throw new RemoteImageError("Image payload exceeds the size limit", 413);
        }
        const { renderImageToDocx } = await import("../docx-renderer");
        docxBuffer = await withDocumentRenderBudget(async signal => {
          requireActive(signal);
          const bytes = await renderImageToDocx(imageBase64, width, height);
          requireActive(signal);
          return bytes;
        }, RENDER_LIMITS.docxTimeoutMs);
      } else if (data) {
        assertPayloadSize(data, 5_000_000, "Structured DOCX data");
        const { renderStructuredDocx } = await import("../docx-renderer");
        docxBuffer = await withDocumentRenderBudget(async signal => {
          requireActive(signal);
          const bytes = await renderStructuredDocx(data);
          requireActive(signal);
          return bytes;
        }, RENDER_LIMITS.docxTimeoutMs);
      } else {
        throw new RemoteImageError("Missing data, imageBase64, or html content", 400);
      }

      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.wordprocessingml.document");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`);
      res.setHeader("Content-Length", docxBuffer.length.toString());
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.send(docxBuffer);
    } catch (error) {
      sendRouteError(res, error, "DOCX generation");
    }
  });

  app.get("/api/image-proxy", requireAuthenticatedUser, proxyRateLimit, async (req: AuthenticatedRequest, res) => {
    const rawUrl = typeof req.query.url === "string" ? req.query.url : "";
    if (!rawUrl || rawUrl.length > 2048) {
      res.status(400).json({ error: "Missing or invalid url parameter" });
      return;
    }
    try {
      const image = await fetchRemoteImage(rawUrl);
      res.setHeader("Content-Type", image.contentType);
      res.setHeader("Content-Length", image.buffer.length.toString());
      res.setHeader("Cache-Control", "private, max-age=3600");
      res.setHeader("X-Content-Type-Options", "nosniff");
      res.setHeader("Vary", "Cookie");
      res.send(image.buffer);
    } catch (error) {
      sendRouteError(res, error, "Image proxy");
    }
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  if (process.env.NODE_ENV === "development") await setupVite(app, server);
  else serveStatic(app);

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);
  if (port !== preferredPort) console.log(`Port ${preferredPort} is busy, using port ${port} instead`);

  server.listen(port, async () => {
    console.log(`Server running on http://localhost:${port}/`);
    try {
      await seedDefaultTemplates();
    } catch (error) {
      console.error("[seed] Failed to seed default templates:", error);
    }
  });
}

startServer().catch(console.error);
