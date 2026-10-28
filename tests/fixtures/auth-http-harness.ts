/** Real application auth routes + MySQL, with a separate synthetic Manus issuer.
 * This fixture is never imported by application code and supplies no ctx.user. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";
import express from "express";
import mysql from "mysql2/promise";
import { createExpressMiddleware } from "@trpc/server/adapters/express";

type IssuerMode = "success" | "token_failure" | "profile_failure" | "wrong_project" | "oversized_profile";
export type Authorization = { state: string; code: string; callback: string; openId: string; mode: IssuerMode };

export async function startAuthHarness() {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "Auth proof requires disposable GitHub CI");
  assert.equal(process.env.SERS_INTEGRATION, "1");
  assert.equal(process.env.DATABASE_URL, "mysql://root:root@127.0.0.1:3306/sers_test");
  const guard = await mysql.createConnection(process.env.DATABASE_URL);
  try {
    const [rows] = await guard.query("SELECT DATABASE() AS name, VERSION() AS version");
    const identity = (rows as Array<{ name: string; version: string }>)[0];
    assert.equal(identity.name, "sers_test"); assert.match(identity.version, /^8\.4\./);
  } finally { await guard.end(); }

  const prefix = `auth-proof-${randomBytes(8).toString("hex")}`;
  const appId = `sers-auth-${randomBytes(8).toString("hex")}`;
  const issuer = express(); issuer.use(express.json({ limit: "8kb" }));
  const app = express(); app.disable("x-powered-by"); app.use(express.json({ limit: "1mb" }));
  const listen = async (application: ReturnType<typeof express>) => {
    const server = application.listen(0, "127.0.0.1");
    await new Promise<void>((done, reject) => { server.once("listening", done); server.once("error", reject); });
    const address = server.address(); assert(address && typeof address !== "string");
    return { server, base: `http://127.0.0.1:${address.port}` };
  };
  const issuerListening = await listen(issuer), appListening = await listen(app);
  const base = appListening.base, issuerBase = issuerListening.base;
  const envKeys = ["NODE_ENV", "APP_PUBLIC_ORIGIN", "OAUTH_PORTAL_URL", "VITE_OAUTH_PORTAL_URL", "OAUTH_SERVER_URL", "VITE_APP_ID", "JWT_SECRET", "OWNER_OPEN_ID"] as const;
  const previous = new Map(envKeys.map(key => [key, process.env[key]]));
  Object.assign(process.env, { NODE_ENV: "test", APP_PUBLIC_ORIGIN: base, OAUTH_PORTAL_URL: issuerBase,
    VITE_OAUTH_PORTAL_URL: issuerBase, OAUTH_SERVER_URL: issuerBase, VITE_APP_ID: appId,
    JWT_SECRET: randomBytes(48).toString("base64url"), OWNER_OPEN_ID: "" });
  const authorizations: Authorization[] = [];
  const exchanged: Array<{ clientId: string; grantType: string; code: string; redirectUri: string }> = [];
  const profileTokens: string[] = [];
  const codes = new Map<string, Authorization>(), tokens = new Map<string, Authorization>();
  let nextMode: IssuerMode = "success";
  let db: Awaited<ReturnType<typeof import("../../server/db")["getDb"]>> | undefined;
  const close = async () => {
    for (const { server } of [appListening, issuerListening]) {
      server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()));
    }
    if (db) await (db as unknown as { $client: { promise(): { end(): Promise<void> } } }).$client.promise().end();
    for (const key of envKeys) {
      const old = previous.get(key); if (old === undefined) delete process.env[key]; else process.env[key] = old;
    }
  };
  try {
    issuer.get("/app-auth", (req, res) => {
      if (req.query.appId !== appId || req.query.redirectUri !== `${base}/api/oauth/callback` || req.query.type !== "signIn"
        || typeof req.query.state !== "string" || !/^[A-Za-z0-9_-]{32,256}$/.test(req.query.state)) {
        res.status(400).send("Invalid synthetic authorization request"); return;
      }
      const code = randomBytes(32).toString("base64url"), state = req.query.state;
      const callback = new URL(`${base}/api/oauth/callback`); callback.searchParams.set("code", code); callback.searchParams.set("state", state);
      const authorization = { code, state, callback: callback.href, openId: `${prefix}-${authorizations.length}`, mode: nextMode };
      nextMode = "success"; authorizations.push(authorization); codes.set(code, authorization);
      res.set({ "Cache-Control": "no-store", "Referrer-Policy": "no-referrer" }).type("html").send(`<!doctype html><html><head><title>Synthetic identity provider</title></head><body><h1>Synthetic identity provider</h1><form action="${base}/api/oauth/callback" method="get"><input type="hidden" name="code" value="${code}"><input type="hidden" name="state" value="${state}"><button id="issuer-sign-in">Continue as synthetic test account</button></form></body></html>`);
    });
    issuer.post("/webdev.v1.WebDevAuthPublicService/ExchangeToken", (req, res) => {
      const { code, clientId, grantType, redirectUri } = req.body ?? {};
      exchanged.push({ code, clientId, grantType, redirectUri });
      const authorization = codes.get(code);
      if (!authorization || clientId !== appId || grantType !== "authorization_code" || redirectUri !== `${base}/api/oauth/callback`) {
        res.status(400).json({ error: "invalid_grant" }); return;
      }
      codes.delete(code);
      if (authorization.mode === "token_failure") { res.status(503).json({ error: "synthetic_provider_unavailable" }); return; }
      const token = randomBytes(32).toString("base64url"); tokens.set(token, authorization);
      res.json({ accessToken: token, tokenType: "Bearer", expiresIn: 300, idToken: "synthetic-contract-only" });
    });
    issuer.post("/webdev.v1.WebDevAuthPublicService/GetUserInfo", (req, res) => {
      const token = req.body?.accessToken; profileTokens.push(token);
      const authorization = tokens.get(token);
      if (!authorization) { res.status(401).json({ error: "invalid_token" }); return; }
      if (authorization.mode === "profile_failure") { res.status(503).json({ error: "synthetic_profile_unavailable" }); return; }
      res.json({ openId: authorization.openId, projectId: authorization.mode === "wrong_project" ? "unrelated-application" : appId,
        name: authorization.mode === "oversized_profile" ? "x".repeat(70 * 1024) : "حساب مصادقة تجريبي", email: `${prefix}@example.invalid`, platform: "email" });
    });
    // Import only after the actual disposable database and explicit origins are
    // verified. Both callback persistence and context resolution are production.
    const [{ registerOAuthRoutes }, { appRouter }, { createContext }, database] = await Promise.all([
      import("../../server/_core/oauth"), import("../../server/root-router"), import("../../server/_core/context"), import("../../server/db"),
    ]);
    db = await database.getDb(); assert(db);
    registerOAuthRoutes(app);
    app.use("/api/trpc", createExpressMiddleware({ router: appRouter, createContext }));
    app.use(express.static(resolve("dist/public"))); app.get("*", (_req, res) => res.sendFile(resolve("dist/public/index.html")));
    return { base, issuerBase, appId, prefix, db, authorizations, exchanged, profileTokens, close,
      nextMode: (mode: IssuerMode) => { nextMode = mode; },
      begin: async (headers: Record<string, string> = {}) => {
        const response = await fetch(`${base}/api/oauth/start`, { redirect: "manual", headers });
        assert.equal(response.status, 302);
        const location = response.headers.get("location"); assert(location);
        assert.equal(new URL(location).origin, issuerBase);
        const cookies = response.headers.getSetCookie();
        const cookie = cookies.find(value => value.startsWith("oauth_attempt="))?.split(";", 1)[0]; assert(cookie);
        const provider = await fetch(location); assert.equal(provider.status, 200); await provider.text();
        const authorization = authorizations.at(-1); assert(authorization);
        return { ...authorization, cookie, startResponse: response };
      },
    };
  } catch (error) { await close(); throw error; }
}

export function sessionCookie(response: Response) {
  return response.headers.getSetCookie().find(value => value.startsWith("app_session_id="))?.split(";", 1)[0];
}

export async function authRpc(base: string, procedure: string, cookie?: string, input?: unknown, method: "GET" | "POST" = "GET") {
  const url = new URL(`/api/trpc/${procedure}`, base);
  const headers: Record<string, string> = {}; if (cookie) headers.cookie = cookie;
  if (method === "GET" && input !== undefined) url.searchParams.set("input", JSON.stringify({ json: input }));
  if (method === "POST") { headers["content-type"] = "application/json"; headers.origin = base; }
  const response = await fetch(url, { method, headers, ...(method === "POST" ? { body: JSON.stringify({ json: input ?? null }) } : {}) });
  const body = await response.json();
  return { response, body, data: body.result?.data?.json };
}
