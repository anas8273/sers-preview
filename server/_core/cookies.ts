import type { CookieOptions, Request } from "express";
import { ENV } from "./env";

export const OAUTH_ATTEMPT_COOKIE = "oauth_attempt";

/** Cookie security comes from deployment configuration, never forwarded headers. */
export function getSessionCookieOptions(_req?: Request): Pick<CookieOptions, "httpOnly" | "path" | "sameSite" | "secure"> {
  let explicitLocalHttp = false;
  try {
    const origin = new URL(ENV.appPublicOrigin);
    explicitLocalHttp = !ENV.isProduction && origin.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(origin.hostname);
  } catch { /* Missing configuration defaults to the stronger cookie flags. */ }
  return { httpOnly: true, path: "/", sameSite: "lax", secure: !explicitLocalHttp };
}

export function getOAuthAttemptCookieOptions() {
  return { ...getSessionCookieOptions(), path: "/api/oauth" };
}
