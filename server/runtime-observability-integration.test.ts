import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import express from "express";
import { registerRuntimeObservability } from "./runtime-observability";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
suite("runtime health HTTP privacy and loss/recovery", () => {
  let server: ReturnType<ReturnType<typeof express>["listen"]>, base: string;
  let databaseDown = false;
  const logs: Record<string, unknown>[] = [], secret = "64cb8e205f1da397".repeat(4);
  beforeAll(async () => {
    if (process.env.GITHUB_ACTIONS !== "true" || process.env.DATABASE_URL !== "mysql://root:root@127.0.0.1:3306/sers_test") throw new Error("Disposable CI only");
    vi.stubEnv("SERS_HEALTHCHECK_TOKEN", secret);
    const app = express();
    registerRuntimeObservability(app, { log: value => logs.push(value), checks: { database: async () => { if (databaseDown) throw new Error("PRIVATE_DATABASE_USER:PRIVATE_PASSWORD"); } } });
    app.get("/api/oauth/callback", (_req, res) => res.status(503).json({ error: "Unavailable" }));
    app.post("/api/trpc/private-user", (_req, res) => res.status(500).json({ error: "Unavailable" }));
    server = app.listen(0, "127.0.0.1");
    await new Promise<void>(resolve => server.once("listening", resolve));
    const address = server.address(); if (!address || typeof address === "string") throw new Error("Invalid harness");
    base = `http://127.0.0.1:${address.port}`;
  });
  afterAll(async () => { vi.unstubAllEnvs(); if (server) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });

  it("keeps diagnostics protected and readiness generic while reporting real check loss and recovery", async () => {
    for (const route of ["health", "metrics"]) {
      expect((await fetch(`${base}/api/operations/${route}?token=${secret}`)).status).toBe(401);
      expect((await fetch(`${base}/api/operations/${route}`, { headers: { Authorization: "Bearer wrong" } })).status).toBe(401);
    }
    expect(await (await fetch(`${base}/readyz`)).json()).toEqual({ status: "ready" });
    const healthy = await fetch(`${base}/api/operations/health`, { headers: { Authorization: `Bearer ${secret}` } });
    expect(healthy.status).toBe(200); expect(healthy.headers.get("cache-control")).toBe("private, no-store");
    expect(await healthy.json()).toMatchObject({ dependencies: { database: "ok" } });
    databaseDown = true; await new Promise(resolve => setTimeout(resolve, 1100));
    const unavailable = await fetch(`${base}/readyz`);
    expect(unavailable.status).toBe(503); expect(await unavailable.json()).toEqual({ status: "unavailable" });
    expect((await fetch(`${base}/healthz`)).status).toBe(200);
    databaseDown = false; await new Promise(resolve => setTimeout(resolve, 1100));
    expect((await fetch(`${base}/readyz`)).status).toBe(200);
    expect(JSON.stringify(logs)).not.toMatch(/PRIVATE_DATABASE_USER|PRIVATE_PASSWORD/);
  });

  it("records bounded aggregate metrics and correlation IDs without URL credentials or identities", async () => {
    for (const [url, method] of [["/api/oauth/callback?code=PRIVATE_CODE&state=PRIVATE_STATE", "GET"], ["/api/trpc/private-user?email=PRIVATE_EMAIL&token=PRIVATE_TOKEN", "POST"]]) {
      const response = await fetch(base + url, { method, headers: { "X-Request-ID": "PRIVATE_CALLER_ID", Cookie: "session=PRIVATE_COOKIE" } });
      expect(response.status).toBeGreaterThanOrEqual(500);
      expect(response.headers.get("x-request-id")).toMatch(/^[a-f0-9-]{36}$/);
      expect(response.headers.get("x-request-id")).not.toBe("PRIVATE_CALLER_ID");
    }
    const metrics = await (await fetch(`${base}/api/operations/metrics`, { headers: { Authorization: `Bearer ${secret}` } })).json();
    expect(metrics.requests.auth).toMatchObject({ requests: 1, serverErrors: 1 });
    expect(metrics.requests.rpc).toMatchObject({ requests: 1, serverErrors: 1 });
    expect(Object.keys(metrics.requests)).toHaveLength(7);
    expect(JSON.stringify({ logs, metrics })).not.toMatch(/PRIVATE_/);
  });
});
