import { COOKIE_NAME } from "@shared/const";
import { parse as parseCookieHeader } from "cookie";
import type { Express, Request, Response } from "express";
import * as db from "../db";
import { AuthRateLimitError, authCredential, consumeOAuthAttempt, createOAuthAttempt, validAuthCredential } from "../auth-session-db";
import { getOAuthAttemptCookieOptions, getSessionCookieOptions, OAUTH_ATTEMPT_COOKIE } from "./cookies";
import { AUTH_SESSION_TTL_MS, getAuthConfig, OAUTH_ATTEMPT_TTL_MS } from "./env";
import { sdk } from "./sdk";
import { safeAuthReturnPath } from "../../shared/auth-return-path";

function cookie(req: Request, name: string) {
  try { return parseCookieHeader(req.headers.cookie ?? "")[name]; } catch { return undefined; }
}
function noStore(res: Response) { res.setHeader("Cache-Control", "no-store"); res.setHeader("Referrer-Policy", "no-referrer"); }

export function registerOAuthRoutes(app: Express) {
  app.get("/api/oauth/start", async (req: Request, res: Response) => {
    noStore(res);
    try {
      const config = getAuthConfig();
      const previous = cookie(req, OAUTH_ATTEMPT_COOKIE);
      const browser = validAuthCredential(previous) ? previous : authCredential();
      const state = authCredential();
      await createOAuthAttempt({ state, browser, address: req.ip ?? req.socket.remoteAddress ?? "unknown", appId: config.appId, redirectUri: config.redirectUri, secret: config.secret, returnTo: safeAuthReturnPath(req.query.returnTo) });
      const authorize = new URL(`${config.portalUrl.replace(/\/$/, "")}/app-auth`);
      authorize.searchParams.set("appId", config.appId);
      authorize.searchParams.set("redirectUri", config.redirectUri);
      authorize.searchParams.set("state", state);
      authorize.searchParams.set("type", "signIn");
      res.cookie(OAUTH_ATTEMPT_COOKIE, browser, { ...getOAuthAttemptCookieOptions(), maxAge: OAUTH_ATTEMPT_TTL_MS });
      res.redirect(302, authorize.toString());
    } catch (error) {
      if (error instanceof AuthRateLimitError) { res.setHeader("Retry-After", "600"); res.status(429).json({ error: "Sign-in temporarily rate limited" }); return; }
      console.warn("[Auth] Sign-in start unavailable");
      res.status(503).json({ error: "Sign-in temporarily unavailable" });
    }
  });

  app.get("/api/oauth/callback", async (req: Request, res: Response) => {
    noStore(res);
    const code = typeof req.query.code === "string" ? req.query.code : undefined;
    const state = typeof req.query.state === "string" ? req.query.state : undefined;
    const browser = cookie(req, OAUTH_ATTEMPT_COOKIE);
    if (!code || code.length > 4096 || !validAuthCredential(state) || !validAuthCredential(browser)) {
      res.status(400).json({ error: "Invalid or expired sign-in attempt" }); return;
    }
    try {
      const config = getAuthConfig();
      const attempt = await consumeOAuthAttempt({ state, browser, appId: config.appId, redirectUri: config.redirectUri });
      if (!attempt) {
        res.status(400).json({ error: "Invalid or expired sign-in attempt" }); return;
      }
      res.clearCookie(OAUTH_ATTEMPT_COOKIE, getOAuthAttemptCookieOptions());
      const token = await sdk.exchangeCodeForToken(code, config.redirectUri);
      const user = await sdk.getUserInfo(token.accessToken);
      await db.upsertUser({ openId: user.openId, name: user.name || null, email: user.email ?? null, loginMethod: user.loginMethod ?? user.platform ?? null, lastSignedIn: new Date() });
      const session = await sdk.createSessionToken(user.openId, { name: user.name || "" });
      res.cookie(COOKIE_NAME, session, { ...getSessionCookieOptions(), maxAge: AUTH_SESSION_TTL_MS });
      res.redirect(302, attempt.returnTo);
    } catch {
      // Provider exceptions can contain codes, access tokens and request headers.
      console.warn("[Auth] Sign-in callback unavailable");
      res.status(503).json({ error: "Sign-in temporarily unavailable; start again" });
    }
  });
}
