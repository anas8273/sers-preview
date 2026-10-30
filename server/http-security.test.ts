import express from "express";
import { afterEach, describe, expect, it } from "vitest";
import { registerHttpSecurity, trustedProxyAddresses } from "./_core/http-security";
const servers: ReturnType<ReturnType<typeof express>["listen"]>[] = [];
afterEach(async () => { for (const server of servers.splice(0)) { server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); } });
async function start(proxies = "") {
  const app = express(); registerHttpSecurity(app, { proxies, secure: true, origin: "https://sers.example" });
  app.all("/api/probe", (req, res) => res.json({ ip: req.ip, protocol: req.protocol }));
  const server = app.listen(0, "127.0.0.1"); servers.push(server);
  await new Promise<void>(resolve => server.once("listening", resolve)); const address = server.address();
  if (!address || typeof address === "string") throw new Error("Missing address");
  return `http://127.0.0.1:${address.port}/api/probe`;
}
describe("explicit reverse proxy boundary", () => {
  it.each(["true", "1", "loopback", "0.0.0.0/0", "127.0.0.1,", "example.com"])("rejects implicit or broad trust %s", input => expect(() => trustedProxyAddresses(input)).toThrow());
  it("ignores spoofed forwarding headers when the socket peer is untrusted", async () => {
    const response = await fetch(await start(), { headers: { "X-Forwarded-For": "198.51.100.1", "X-Forwarded-Proto": "https" } });
    expect(await response.json()).toEqual({ ip: "127.0.0.1", protocol: "http" });
    expect(response.headers.get("cache-control")).toContain("no-store"); expect(response.headers.get("vary")).toContain("Cookie");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff"); expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("strict-transport-security")).toBe("max-age=31536000"); expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  });
  it("uses the nearest untrusted address and differentiates clients behind the configured proxy", async () => {
    const url = await start("127.0.0.1");
    for (const address of ["198.51.100.10", "198.51.100.11"]) {
      const response = await fetch(url, { headers: { "X-Forwarded-For": `203.0.113.99, ${address}`, "X-Forwarded-Proto": "https" } });
      expect(await response.json()).toEqual({ ip: address, protocol: "https" });
    }
  });
  it("rejects cross-origin browser mutations and permits the configured origin", async () => {
    const url = await start();
    expect((await fetch(url, { method: "POST", headers: { Origin: "https://evil.invalid" } })).status).toBe(403);
    expect((await fetch(url, { method: "POST", headers: { Origin: "https://sers.example" } })).status).toBe(200);
  });
});
