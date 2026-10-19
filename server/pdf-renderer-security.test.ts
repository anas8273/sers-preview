import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const rendererSource = readFileSync(resolve(process.cwd(), "server/pdf-renderer.ts"), "utf8");
const serverSource = readFileSync(resolve(process.cwd(), "server/_core/index.ts"), "utf8");

describe("PDF and DOCX renderer isolation", () => {
  it("disables JavaScript and intercepts every Chromium request", () => {
    expect(rendererSource).toContain("page.setJavaScriptEnabled(false)");
    expect(rendererSource).toContain("page.setRequestInterception(true)");
    expect(rendererSource).toContain('request.abort("blockedbyclient")');
  });

  it("allows only local data/blob content and the fixed font allowlist", () => {
    expect(rendererSource).toContain('requestUrl.startsWith("data:")');
    expect(rendererSource).toContain('requestUrl.startsWith("blob:")');
    expect(rendererSource).toContain('"fonts.googleapis.com"');
    expect(rendererSource).toContain('"fonts.gstatic.com"');
    expect(rendererSource).toContain("ALLOWED_RENDER_HOSTS.has(url.hostname)");
  });

  it("uses the same isolated PDF pipeline when creating visual DOCX files", () => {
    expect(rendererSource).toContain("const pdfBuffer = await renderHtmlToPdf(htmlContent");
  });
});

describe("legacy export route hardening", () => {
  it("requires authentication and per-user rate limits for PDF and DOCX exports", () => {
    expect(serverSource).toContain('app.post("/api/export-pdf", requireAuthenticatedUser, exportRateLimit');
    expect(serverSource).toContain('app.post("/api/export-docx", requireAuthenticatedUser, exportRateLimit');
    expect(serverSource).toContain('rateLimit("export", 10, 60_000)');
  });

  it("rejects active HTML and external link/meta execution primitives", () => {
    expect(serverSource).toContain("function assertSafeHtml");
    expect(serverSource).toContain("script|iframe|object|embed|applet|base");
    expect(serverSource).toContain("javascript\\s*:");
    expect(serverSource).toContain("on[a-z]+\\s*=");
    expect(serverSource).toContain("Active or externally linked HTML is not allowed");
  });

  it("limits request sizes and disables shared caching of generated documents", () => {
    expect(serverSource).toContain('assertPayloadSize(req.body, 3_000_000, "PDF request")');
    expect(serverSource).toContain('assertPayloadSize(req.body, 16_000_000, "DOCX request")');
    expect(serverSource).toContain('res.setHeader("Cache-Control", "no-store")');
    expect(serverSource).toContain('res.setHeader("X-Content-Type-Options", "nosniff")');
  });
});
