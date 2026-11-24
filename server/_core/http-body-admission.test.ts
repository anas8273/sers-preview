import express, { type Request, type Response } from "express";
import { afterEach, describe, expect, it } from "vitest";
import {
  DOCX_BODY_MAX_BYTES,
  PDF_BODY_MAX_BYTES,
  boundedBodyParser,
  httpBodyAdmission,
  isRouteSpecificBodyPath,
} from "./http-body-admission";

const servers: Array<ReturnType<ReturnType<typeof express>["listen"]>> = [];

afterEach(async () => {
  for (const server of servers.splice(0)) {
    server.closeAllConnections();
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});

async function listen(app: ReturnType<typeof express>) {
  const server = app.listen(0, "127.0.0.1");
  servers.push(server);
  await new Promise<void>((resolve, reject) => { server.once("listening", resolve); server.once("error", reject); });
  const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing test server address");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

async function startHarness() {
  const app = express();
  const globalParser = boundedBodyParser(express.json({ limit: 256_000, inflate: false }));
  app.use((req, res, next) => isRouteSpecificBodyPath(req.path) || ["/api/chunked", "/api/limited"].includes(req.path) ? next() : globalParser(req, res, next));
  let authCalls = 0;
  let handlerCalls = 0;
  const authenticate = (_req: Request, res: Response, next: () => void) => {
    authCalls += 1;
    if (_req.get("authorization") !== "Bearer synthetic") { res.status(401).json({ error: "Authentication required" }); return; }
    next();
  };
  const register = (path: string, maxBytes: number) => app.post(
    path,
    httpBodyAdmission({ maxBytes, contentType: "application/json" }),
    authenticate,
    boundedBodyParser(express.json({ limit: maxBytes, strict: true, inflate: false, type: "application/json" })),
    (_req, res) => { handlerCalls += 1; res.json({ ok: true }); },
  );
  register("/api/export-pdf", PDF_BODY_MAX_BYTES);
  register("/api/export-docx", DOCX_BODY_MAX_BYTES);
  register("/api/chunked", 8);
  register("/api/limited", 8);
  const { base } = await listen(app);
  return {
    base,
    counters: () => ({ authCalls, handlerCalls }),
  };
}

describe("HTTP body admission", () => {
  it("keeps the production PDF/DOCX ceilings explicit", () => {
    expect(PDF_BODY_MAX_BYTES).toBe(3_000_000);
    expect(DOCX_BODY_MAX_BYTES).toBe(16_000_000);
  });

  it("matches Express export aliases but does not bypass unrelated API bodies", () => {
    for (const path of ["/api/export-pdf", "/api/export-pdf/", "/API/EXPORT-DOCX/", "/api/trpc", "/api/trpc/domain.reportDraft.save"]) {
      expect(isRouteSpecificBodyPath(path)).toBe(true);
    }
    for (const path of ["/api/trpcevil", "/api/export-pdf-extra", "/api/image-proxy", "/api/oauth/callback"]) {
      expect(isRouteSpecificBodyPath(path)).toBe(false);
    }
  });

  it("applies the authenticated route ceiling, not the global ceiling, with a trailing slash", async () => {
    const harness = await startHarness();
    const body = JSON.stringify({ html: "ن".repeat(150_000) });
    const denied = await fetch(`${harness.base}/api/export-pdf/`, { method: "POST", headers: { "content-type": "application/json" }, body });
    expect(denied.status).toBe(401);
    const allowed = await fetch(`${harness.base}/API/EXPORT-PDF/`, { method: "POST", headers: { "content-type": "application/json", authorization: "Bearer synthetic" }, body });
    expect(allowed.status).toBe(200);
    expect(harness.counters()).toEqual({ authCalls: 2, handlerCalls: 1 });
  });

  it("rejects an oversized unauthenticated Content-Length before auth", async () => {
    const harness = await startHarness();
    const response = await fetch(`${harness.base}/api/limited`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "123456789",
    });
    expect(response.status).toBe(413);
    expect(harness.counters()).toEqual({ authCalls: 0, handlerCalls: 0 });
  });

  it("bounds a chunked body and closes it before the handler", async () => {
    const harness = await startHarness();
    const chunks = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new TextEncoder().encode("12345"));
        controller.enqueue(new TextEncoder().encode("6789"));
        controller.close();
      },
    });
    let status = 0;
    try {
      status = (await fetch(`${harness.base}/api/chunked`, {
        method: "POST",
        headers: { authorization: "Bearer synthetic", "content-type": "application/json" },
        body: chunks,
        duplex: "half",
      } as RequestInit & { duplex: "half" })).status;
    } catch {
      // Closing a chunked connection at the bounded ceiling is an expected rejection.
    }
    expect(status === 0 || status === 413).toBe(true);
    expect(harness.counters()).toEqual({ authCalls: 1, handlerCalls: 0 });
  });

  it("rejects an unauthenticated malformed body before parsing or the handler", async () => {
    const harness = await startHarness();
    const response = await fetch(`${harness.base}/api/export-pdf`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: "{malformed",
    });
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: "Authentication required" });
    expect(harness.counters()).toEqual({ authCalls: 1, handlerCalls: 0 });
  });

  it("rejects an unsupported content type before authentication", async () => {
    const harness = await startHarness();
    const response = await fetch(`${harness.base}/api/export-pdf`, {
      method: "POST",
      headers: { "content-type": "text/plain" },
      body: "synthetic",
    });
    expect(response.status).toBe(415);
    expect(harness.counters()).toEqual({ authCalls: 0, handlerCalls: 0 });
  });

  it("rejects malformed authenticated JSON without reaching the handler", async () => {
    const harness = await startHarness();
    const response = await fetch(`${harness.base}/api/export-pdf`, {
      method: "POST",
      headers: { authorization: "Bearer synthetic", "content-type": "application/json" },
      body: "{malformed",
    });
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: "Malformed request body" });
    expect(harness.counters()).toEqual({ authCalls: 1, handlerCalls: 0 });
  });

  it("lets a bounded valid authenticated JSON request reach the handler", async () => {
    const harness = await startHarness();
    const response = await fetch(`${harness.base}/api/export-pdf`, {
      method: "POST",
      headers: { authorization: "Bearer synthetic", "content-type": "application/json" },
      body: JSON.stringify({ html: "<p>synthetic</p>" }),
    });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ok: true });
    expect(harness.counters()).toEqual({ authCalls: 1, handlerCalls: 1 });
  });
});
