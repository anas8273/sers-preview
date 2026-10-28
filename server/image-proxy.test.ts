import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const serverSource = readFileSync(
  resolve(process.cwd(), "server/_core/index.ts"),
  "utf8"
);

describe("Image proxy security contract", () => {
  it("requires authentication and applies a dedicated rate limiter", () => {
    expect(serverSource).toContain(
      'app.get("/api/image-proxy", requireAuthenticatedUser, proxyRateLimit'
    );
    expect(serverSource).toContain('rateLimit("image-proxy", 60, 60_000)');
  });

  it("delegates remote retrieval to the SSRF-resistant fetcher", () => {
    expect(serverSource).toContain("fetchRemoteImage(rawUrl)");
    const proxySection =
      serverSource
        .split('app.get("/api/image-proxy"')[1]
        ?.split('app.use(\n    "/api/trpc"')[0] ?? "";
    expect(proxySection).not.toContain("fetch(rawUrl");
    expect(proxySection).not.toContain('Access-Control-Allow-Origin", "*"');
  });

  it("returns private, nosniff responses rather than a public cross-origin cache", () => {
    expect(serverSource).toContain(
      'res.setHeader("Cache-Control", "private, max-age=3600")'
    );
    expect(serverSource).toContain(
      'res.setHeader("X-Content-Type-Options", "nosniff")'
    );
    expect(serverSource).toContain('res.setHeader("Vary", "Cookie")');
  });
});
