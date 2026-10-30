import { isIP } from "node:net";
import type { Express } from "express";

/** Trust explicit proxy addresses only; never accept a hop count or wildcard.
 * Docker/NAT deployments must set the observed gateway address themselves. */
export function trustedProxyAddresses(value = process.env.SERS_TRUSTED_PROXY_IPS ?? "") {
  if (!value.trim()) return [];
  const addresses = value.split(",").map(value => value.trim());
  if (addresses.length > 16 || addresses.some(address => !isIP(address))) throw new Error("SERS_TRUSTED_PROXY_IPS must contain at most 16 literal IP addresses");
  return addresses;
}
export function registerHttpSecurity(app: Express, options: { proxies?: string; secure?: boolean; origin?: string } = {}) {
  const addresses = trustedProxyAddresses(options.proxies);
  const canonicalOrigin = options.origin ? new URL(options.origin).origin : undefined;
  app.set("trust proxy", addresses.length ? addresses : false);
  app.disable("x-powered-by");
  app.use((req, res, next) => {
    res.setHeader("X-Content-Type-Options", "nosniff");
    res.setHeader("Referrer-Policy", "no-referrer");
    res.setHeader("X-Frame-Options", "DENY");
    res.setHeader("Content-Security-Policy", "frame-ancestors 'none'; base-uri 'self'; object-src 'none'");
    res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
    if (options.secure) res.setHeader("Strict-Transport-Security", "max-age=31536000");
    // Cache neither API responses nor navigations containing private UI. Static
    // hashed assets can retain the existing asset caching policy.
    if (!req.path.startsWith("/assets/")) {
      res.setHeader("Cache-Control", "private, no-store"); res.vary("Cookie");
    }
    // Browser mutation requests with a foreign origin are rejected before body
    // parsing. CLI clients without Origin still require normal authorization.
    if (canonicalOrigin && !["GET", "HEAD", "OPTIONS"].includes(req.method) && req.headers.origin && req.headers.origin !== canonicalOrigin) {
      res.status(403).json({ error: "Foreign origin is not permitted" }); return;
    }
    next();
  });
}
