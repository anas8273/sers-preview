import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { PNG } from "pngjs";
import { startAiHarness } from "../tests/fixtures/ai-http-harness";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;
const png = new PNG({ width: 1, height: 1 }); png.data.set([25, 150, 160, 255]);
const image = `data:image/png;base64,${PNG.sync.write(png).toString("base64")}`;
const fields = [{ id: "summary", label: "الملخص", type: "text" }];
const taxonomy = [{ id: "std-1", title: "تطوير التدريس", subEvidences: [{ id: "std-1-item-1", title: "خطة تعليمية" }] }];
const operations: Array<[string, unknown]> = [
  ["ai.classifyEvidence", { description: "مسودة خطة تعليمية", criteriaList: taxonomy }],
  ["ai.suggestEvidence", { jobTitle: "معلم", criterionName: "تطوير التدريس", subEvidenceName: "خطة تعليمية" }],
  ["ai.fillFormFields", { jobTitle: "معلم", criterionName: "تطوير التدريس", subEvidenceName: "خطة تعليمية", formFields: fields }],
  ["ai.improveText", { text: "هذه مسودة تعليمية اصطناعية" }],
  ["ai.suggest", { prompt: "اقترح نشاط قراءة دون اختلاق تنفيذه" }],
  ["ai.analyzeGaps", { coveredIndicators: ["التخطيط"], totalIndicators: 2 }],
  ["genAI.fillReport", { templateName: "تقرير اصطناعي", fields }],
  ["genAI.generateRadio", { theme: "القراءة", segments: ["المقدمة"] }],
  ["genAI.generateCV", { name: "حساب اصطناعي", jobTitle: "معلم" }],
  ["genAI.generateExamQuestions", { subject: "لغتي", grade: "الثالث", questionTypes: ["multiple-choice"], count: 1 }],
  ["genAI.extractGradesFromImage", { imageData: image, maxScore: 100 }],
  ["genAI.generatePortfolioContent", { section: "الرؤية", jobTitle: "معلم" }],
];

suite.sequential("production AI HTTP admission against disposable MySQL and a synthetic provider", () => {
  let harness: Awaited<ReturnType<typeof startAiHarness>>;
  let identity: { cookie: string; userId: number; openId: string };
  const resetAiTables = async () => {
    // This suite runs alone. Guard the exact disposable database before touching
    // global circuit/budget rows; application code has no such reset endpoint.
    const [rows] = await harness.db.execute(sql`SELECT DATABASE() AS name, VERSION() AS version`);
    expect(process.env.GITHUB_ACTIONS).toBe("true");
    expect(process.env.DATABASE_URL).toBe("mysql://root:root@127.0.0.1:3306/sers_test");
    expect((rows as unknown as Array<{ name: string; version: string }>)[0]).toMatchObject({ name: "sers_test", version: expect.stringMatching(/^8\.4\./) });
    for (const table of ["ai_requests", "ai_request_budgets", "ai_provider_state"]) await harness.db.execute(sql`DELETE FROM ${sql.identifier(table)}`);
  };
  const records = async () => {
    const [rows] = await harness.db.execute(sql`SELECT * FROM ai_requests ORDER BY startedAt,id`);
    return rows as unknown as Array<Record<string, unknown>>;
  };
  const request = (input: unknown = { prompt: "اقتراح تعليمي اصطناعي" }) => harness.rpc("ai.suggest", identity.cookie, input);
  const expectSafeFailure = (result: Awaited<ReturnType<typeof request>>) => {
    expect(result.response.status).toBeGreaterThanOrEqual(400);
    const serialized = JSON.stringify(result.body);
    expect(serialized).not.toContain(harness.privateFailure);
    expect(serialized).not.toContain(harness.providerBase);
    expect(serialized).not.toContain("Bearer ");
    expect(result.data).toBeUndefined();
  };
  beforeAll(async () => {
    harness = await startAiHarness({ env: { SERS_AI_USER_MINUTE_LIMIT: "5", SERS_AI_USER_DAILY_LIMIT: "5",
      SERS_AI_GLOBAL_DAILY_LIMIT: "300", SERS_AI_USER_CONCURRENCY: "2", SERS_AI_GLOBAL_CONCURRENCY: "8" } });
    identity = await harness.signIn();
  }, 30_000);
  beforeEach(async () => { harness.release(); harness.setDefault("success"); await resetAiTables(); });
  afterAll(async () => { if (harness) { harness.release(); await resetAiTables(); await harness.close(); } });

  it("disables provider spending explicitly while leaving authenticated manual account access available", async () => {
    const previous = process.env.SERS_AI_ENABLED, before = harness.calls.length;
    try {
      process.env.SERS_AI_ENABLED = "0";
      expect((await request()).response.status).toBe(412);
      const manual = await fetch(`${harness.base}/api/trpc/account.overview`, { headers: { cookie: identity.cookie } });
      expect(manual.status).toBe(200); await manual.text();
      expect(harness.calls).toHaveLength(before); expect(await records()).toEqual([]);
    } finally { if (previous === undefined) delete process.env.SERS_AI_ENABLED; else process.env.SERS_AI_ENABLED = previous; }
  });

  it("denies all twelve anonymous AI mutations before provider I/O or durable reservation", async () => {
    const before = harness.calls.length;
    for (const [procedure, input] of operations) {
      const result = await harness.rpc(procedure, undefined, input);
      expect(result.response.status, procedure).toBe(401);
      expect(result.body.error?.json?.data?.code, procedure).toBe("UNAUTHORIZED");
    }
    expect(harness.calls).toHaveLength(before); expect(await records()).toEqual([]);
  });

  it("rejects missing and foreign request origins without spending authenticated provider capacity", async () => {
    const before = harness.calls.length;
    for (const origin of [undefined, "https://attacker.invalid", "null"]) {
      const response = await fetch(`${harness.base}/api/trpc/ai.suggest`, { method: "POST",
        headers: { cookie: identity.cookie, "content-type": "application/json", ...(origin ? { origin } : {}) },
        body: JSON.stringify({ json: { prompt: "اقتراح تعليمي" } }) });
      expect(response.status).toBe(403); await response.text();
    }
    expect(harness.calls).toHaveLength(before); expect(await records()).toEqual([]);
  });

  it("rejects oversized text, duplicate field IDs and remote image references before provider I/O", async () => {
    const before = harness.calls.length;
    const cases: Array<[string, unknown]> = [
      ["ai.suggest", { prompt: "x".repeat(16_001) }],
      ["ai.fillFormFields", { jobTitle: "معلم", criterionName: "التدريس", subEvidenceName: "خطة", formFields: [fields[0], fields[0]] }],
      ["ai.classifyEvidence", { fileUrl: "http://127.0.0.1/private", fileType: "image/png", criteriaList: taxonomy }],
      ["genAI.extractGradesFromImage", { imageData: "data:image/svg+xml;base64,PHN2Zy8+", maxScore: 100 }],
    ];
    for (const [procedure, input] of cases) expect((await harness.rpc(procedure, identity.cookie, input)).response.status).toBe(400);
    expect(harness.calls).toHaveLength(before); expect(await records()).toEqual([]);
  });

  it("bounds per-user request budgets while retaining successful content and sanitized provenance", async () => {
    const before = harness.calls.length, marker = "PRIVATE_PROMPT_STUDENT_NAME_8273";
    for (let index = 0; index < 5; index++) {
      const result = await request({ prompt: `${marker} ${index}` });
      expect(result.response.status).toBe(200); expect(result.data.content).toContain("اقتراح تعليمي");
    }
    const blocked = await request(); expect(blocked.response.status).toBe(429);
    expect(harness.calls).toHaveLength(before + 5);
    const rows = await records(); expect(rows).toHaveLength(5);
    expect(rows.every(row => row.userId === identity.userId && row.status === "succeeded")).toBe(true);
    expect(rows.every(row => row.provider === "manus-forge" && row.configuredModel === "gemini-2.5-flash")).toBe(true);
    expect(rows.every(row => typeof row.promptVersion === "string" && String(row.promptVersion).length > 0)).toBe(true);
    expect(JSON.stringify(rows)).not.toContain(marker);
    expect(JSON.stringify(rows)).not.toContain("اقتراح تعليمي اصطناعي");
    expect(harness.calls.slice(before).every(call => call.authorizationMatched && Number(call.maxTokens) >= 1 && Number(call.maxTokens) <= 4096)).toBe(true);
  });

  it("holds no more than two provider calls for one user and releases admission after completion", async () => {
    const before = harness.calls.length; harness.setDefault("hold");
    const first = request(), second = request();
    try {
      await harness.waitForCalls(before + 2);
      const denied = await Promise.all(Array.from({ length: 5 }, () => request()));
      expect(denied.every(result => result.response.status === 429)).toBe(true);
      expect(harness.calls).toHaveLength(before + 2); expect(harness.stats().active).toBe(2);
    } finally { harness.setDefault("success"); harness.release(); }
    expect((await first).response.status).toBe(200); expect((await second).response.status).toBe(200);
    expect((await request()).response.status).toBe(200);
    expect(harness.calls).toHaveLength(before + 3);
  });

  for (const mode of ["failure", "oversized", "redirect", "malformed", "incomplete"] as const) it(`sanitizes ${mode} and refuses unusable provider data`, async () => {
    harness.next(mode); const before = harness.calls.length, result = await request();
    expectSafeFailure(result); expect(harness.calls).toHaveLength(before + 1);
    expect(harness.stats().redirects).toBe(0);
    const rows = await records(); expect(rows).toHaveLength(1); expect(rows[0].status).toBe("failed");
    expect(JSON.stringify(rows)).not.toContain(harness.privateFailure);
    expect((await request()).response.status).toBe(200);
  });

  it("requests the bounded full-report token allowance and retains every valid returned field", async () => {
    const reportFields = ["summary", "evidence", "recommendations"].map(id => ({ id, label: `حقل ${id}`, type: "textarea" }));
    const filledData = Object.fromEntries(reportFields.map((field, index) => [field.id, `${index}: ${"تفاصيل تعليمية اصطناعية قابلة للمراجعة. ".repeat(150)}`]));
    harness.next("success", JSON.stringify(filledData)); const before = harness.calls.length;
    const result = await harness.rpc("genAI.fillReport", identity.cookie, { templateName: "تقرير اصطناعي كامل", fields: reportFields, context: "مسودة فقط دون إثبات تنفيذ" });
    expect(result.response.status).toBe(200); expect(result.data).toMatchObject({ success: true, filledData });
    expect(harness.calls).toHaveLength(before + 1); expect(harness.calls[before].maxTokens).toBe(4096);
  });

  it("opens the durable provider circuit after repeated failures and sends no request while open", async () => {
    harness.setDefault("failure"); const before = harness.calls.length;
    for (let index = 0; index < 3; index++) expectSafeFailure(await request());
    harness.setDefault("success"); expectSafeFailure(await request());
    expect(harness.calls).toHaveLength(before + 3);
    const [rows] = await harness.db.execute(sql`SELECT * FROM ai_provider_state WHERE provider='manus-forge'`);
    const state = (rows as unknown as Array<{ failureCount: number; openUntil: Date }>)[0];
    expect(state.failureCount).toBeGreaterThanOrEqual(3); expect(new Date(state.openUntil).getTime()).toBeGreaterThan(Date.now());
  });

  it("refuses provider I/O when durable admission storage is actually unavailable", async () => {
    const before = harness.calls.length, unavailable = sql.identifier(`ai_requests_http_unavailable_${identity.userId}`); let renamed = false;
    try {
      await harness.db.execute(sql`RENAME TABLE ai_requests TO ${unavailable}`); renamed = true;
      const result = await request(); expect(result.response.status).toBe(503); expectSafeFailure(result);
      expect(harness.calls).toHaveLength(before);
    } finally { if (renamed) await harness.db.execute(sql`RENAME TABLE ${unavailable} TO ai_requests`); }
    expect(await records()).toEqual([]); expect((await request()).response.status).toBe(200);
  });

  it("rejects malformed classification destinations and out-of-range grades without fabricating valid data", async () => {
    harness.next("success", JSON.stringify({ unexpected: "unvalidated", confidence: -99 }));
    const classification = await harness.rpc("ai.classifyEvidence", identity.cookie, { description: "مسودة", criteriaList: taxonomy });
    expect(classification.response.status).toBe(200); expect(classification.data).toMatchObject({ success: false, classification: null });
    harness.next("success", JSON.stringify({ students: [{ name: "طالب اصطناعي", score: 101 }], unreadableNote: "" }));
    const grades = await harness.rpc("genAI.extractGradesFromImage", identity.cookie, { imageData: image, maxScore: 100 });
    expect(grades.response.status).toBe(200); expect(grades.data).toMatchObject({ success: false, students: [] });
  });

  it("aborts a real stalled HTTP provider within the deadline and admits a subsequent manual retry", async () => {
    harness.next("hold"); const before = harness.calls.length, startedAt = performance.now();
    const pending = request(); await harness.waitForCalls(before + 1);
    const result = await pending; const elapsed = performance.now() - startedAt;
    expectSafeFailure(result); expect(elapsed).toBeGreaterThan(35_000); expect(elapsed).toBeLessThan(55_000);
    await harness.waitForIdle();
    expect((await records())[0].status).toBe("failed");
    harness.release(); expect((await request()).response.status).toBe(200);
  }, 65_000);
});
