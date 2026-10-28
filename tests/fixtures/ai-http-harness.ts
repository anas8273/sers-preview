/** Production auth and AI routes, real disposable MySQL, separate synthetic
 * identity/provider servers. No production credentials or ctx.user injection. */
import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import express, { type Response } from "express";
import { authRpc, sessionCookie, startAuthHarness } from "./auth-http-harness";

export type SyntheticAiMode = "success" | "failure" | "oversized" | "redirect" | "malformed" | "incomplete" | "hold" | "disconnect";
export type SyntheticAiCall = { model: unknown; maxTokens: unknown; messages: unknown; authorizationMatched: boolean };
const privateFailure = "SYNTHETIC_PRIVATE_PROVIDER_SECRET_DO_NOT_DISCLOSE";

export async function startAiHarness(options: { env?: Record<string, string> } = {}) {
  assert.equal(process.env.GITHUB_ACTIONS, "true", "AI proof requires disposable GitHub CI");
  assert.equal(process.env.SERS_INTEGRATION, "1");
  assert.equal(process.env.DATABASE_URL, "mysql://root:root@127.0.0.1:3306/sers_test");
  const provider = express(); provider.use(express.json({ limit: "12mb" }));
  const server = provider.listen(0, "127.0.0.1");
  await new Promise<void>((done, reject) => { server.once("listening", done); server.once("error", reject); });
  const address = server.address(); assert(address && typeof address !== "string");
  const providerBase = `http://127.0.0.1:${address.port}`, apiKey = randomBytes(32).toString("hex");
  const environment = { BUILT_IN_FORGE_API_URL: providerBase, BUILT_IN_FORGE_API_KEY: apiKey,
    SERS_AI_ENABLED: "1", ...options.env };
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
  Object.assign(process.env, environment);
  const calls: SyntheticAiCall[] = [], held: Array<{ response: Response; content: string }> = [];
  const queue: Array<{ mode: SyntheticAiMode; content?: string }> = [];
  let defaultMode: SyntheticAiMode = "success", defaultContent = "اقتراح تعليمي اصطناعي يحتاج مراجعة المستخدم.";
  let active = 0, maxActive = 0, redirects = 0;
  const respond = (res: Response, content: string, finishReason = "stop") => res.json({ id: `synthetic-ai-${calls.length}`, created: 1_798_000_000,
    model: "gemini-2.5-flash", choices: [{ index: 0, message: { role: "assistant", content }, finish_reason: finishReason }],
    usage: { prompt_tokens: 24, completion_tokens: 16, total_tokens: 40 } });
  provider.post("/v1/chat/completions", (req, res) => {
    calls.push({ model: req.body?.model, maxTokens: req.body?.max_tokens, messages: req.body?.messages,
      authorizationMatched: req.headers.authorization === `Bearer ${apiKey}` });
    active++; maxActive = Math.max(maxActive, active); res.once("close", () => { active--; });
    const next = queue.shift() ?? { mode: defaultMode, content: defaultContent }, content = next.content ?? defaultContent;
    if (next.mode === "failure") { res.status(503).type("text").send(privateFailure); return; }
    if (next.mode === "oversized") { respond(res, "x".repeat(600 * 1024)); return; }
    if (next.mode === "redirect") { res.redirect(307, `${providerBase}/forbidden-redirect`); return; }
    if (next.mode === "malformed") { res.type("json").send('{"invalid":'); return; }
    if (next.mode === "incomplete") { respond(res, content, "length"); return; }
    if (next.mode === "disconnect") { req.socket.destroy(); return; }
    if (next.mode === "hold") { held.push({ response: res, content }); return; }
    respond(res, content);
  });
  provider.all("/forbidden-redirect", (_req, res) => { redirects++; res.status(500).send(privateFailure); });
  let auth: Awaited<ReturnType<typeof startAuthHarness>> | undefined;
  const close = async () => {
    for (const item of held.splice(0)) item.response.destroy();
    if (auth) await auth.close();
    server.closeAllConnections(); await new Promise<void>(done => server.close(() => done()));
    for (const [key, value] of Array.from(previous)) { if (value === undefined) delete process.env[key]; else process.env[key] = value; }
  };
  try {
    auth = await startAuthHarness();
    const application = auth;
    return { ...application, providerBase, calls, privateFailure, close,
      stats: () => ({ active, maxActive, redirects, held: held.filter(item => !item.response.destroyed).length }),
      setDefault: (mode: SyntheticAiMode, content = defaultContent) => { defaultMode = mode; defaultContent = content; },
      next: (mode: SyntheticAiMode, content?: string) => { queue.push({ mode, content }); },
      release: () => { for (const item of held.splice(0)) if (!item.response.destroyed) respond(item.response, item.content); },
      waitForCalls: async (count: number, timeoutMs = 10_000) => {
        const deadline = Date.now() + timeoutMs;
        while (calls.length < count && Date.now() < deadline) await delay(20);
        assert(calls.length >= count, "Synthetic provider did not receive the expected bounded request count");
      },
      waitForIdle: async () => {
        const deadline = Date.now() + 3000;
        while (active && Date.now() < deadline) await delay(20);
        assert.equal(active, 0, "Timed-out provider connections must be closed");
      },
      signIn: async () => {
        const attempt = await application.begin();
        const response = await fetch(attempt.callback, { redirect: "manual", headers: { cookie: attempt.cookie } });
        assert.equal(response.status, 302); const cookie = sessionCookie(response); assert(cookie);
        const identity = await authRpc(application.base, "auth.me", cookie); assert.equal(identity.response.status, 200);
        assert(Number.isSafeInteger(identity.data?.id));
        return { cookie, userId: identity.data.id as number, openId: attempt.openId };
      },
      rpc: (procedure: string, cookie: string | undefined, input: unknown) => authRpc(application.base, procedure, cookie, input, "POST"),
    };
  } catch (error) { await close(); throw error; }
}
