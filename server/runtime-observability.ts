import { randomUUID } from "node:crypto";
import type { Express } from "express";
import { createHealthService, runtimeHealthChecks, validHealthBearer, type HealthChecks } from "./runtime-health";

const groups = ["auth", "rpc", "evidence", "output", "export", "proxy", "page"] as const;
type Group = typeof groups[number];
const durationBounds = [50, 100, 500, 1000, 5000];
function groupFor(pathname: string): Group {
  if (pathname.startsWith("/api/oauth/")) return "auth";
  if (pathname.startsWith("/api/trpc/")) return "rpc";
  if (pathname.startsWith("/api/evidence/")) return "evidence";
  if (pathname.startsWith("/api/work-outputs/") || pathname.startsWith("/output/")) return "output";
  if (pathname.startsWith("/api/export-")) return "export";
  if (pathname === "/api/image-proxy") return "proxy";
  return "page";
}

export function registerRuntimeObservability(app: Express, options: { checks?: HealthChecks; log?: (value: Record<string, unknown>) => void } = {}) {
  const log = options.log ?? (value => console.log(JSON.stringify(value)));
  const health = createHealthService(options.checks ?? runtimeHealthChecks(), { onTransition: snapshot => log({ event: "runtime_health_changed", ...snapshot }) });
  const startedAt = new Date().toISOString();
  const counters = Object.fromEntries(groups.map(group => [group, { requests: 0, clientErrors: 0, serverErrors: 0, durationBuckets: Array(6).fill(0) as number[] }])) as Record<Group, { requests: number; clientErrors: number; serverErrors: number; durationBuckets: number[] }>;
  app.use((req, res, next) => {
    const requestId = randomUUID(), started = performance.now();
    res.setHeader("X-Request-ID", requestId);
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
    if (!["/healthz", "/readyz"].includes(req.path) && !req.path.startsWith("/api/operations/")) {
      const group = groupFor(req.path);
      res.once("finish", () => {
        const ms = Math.max(0, Math.round(performance.now() - started)), counter = counters[group];
        counter.requests++; if (res.statusCode >= 500) counter.serverErrors++; else if (res.statusCode >= 400) counter.clientErrors++;
        const bucket = durationBounds.findIndex(bound => ms <= bound); counter.durationBuckets[bucket < 0 ? 5 : bucket]++;
        // Never emit URL/query/body/cookies/headers/user IDs or exception messages.
        if (res.statusCode >= 500) log({ event: "http_server_error", requestId, group, status: res.statusCode, durationMs: ms });
      });
    }
    next();
  });
  app.get("/healthz", (_req, res) => { res.setHeader("Cache-Control", "no-store"); res.json({ status: "ok" }); });
  app.get("/readyz", async (_req, res) => {
    const snapshot = await health.snapshot(); res.setHeader("Cache-Control", "no-store");
    res.status(snapshot.status === "ready" ? 200 : 503).json({ status: snapshot.status });
  });
  app.use("/api/operations", (req, res, next) => {
    res.setHeader("Cache-Control", "private, no-store");
    if (!validHealthBearer(req.headers.authorization, process.env.SERS_HEALTHCHECK_TOKEN)) { res.status(401).json({ error: "Unauthorized" }); return; }
    next();
  });
  app.get("/api/operations/health", async (_req, res) => {
    const snapshot = await health.snapshot(); res.status(snapshot.status === "ready" ? 200 : 503).json(snapshot);
  });
  app.get("/api/operations/metrics", (_req, res) => res.json({ startedAt, observedAt: new Date().toISOString(), durationBoundsMs: durationBounds, requests: counters }));
}
