import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { PNG } from "pngjs";
import jpeg from "jpeg-js";
import { Worker } from "node:worker_threads";
import { invokeLLM } from "./_core/llm";
import { AI_MAX_OUTPUT_TOKENS, AI_MAX_RESPONSE_BYTES, AI_PROVIDER_TIMEOUT_MS, AIProviderError } from "./ai-provider-policy";
import { normalizeAiImageBytes, validateAiImageDataUrl } from "./ai-inline-image";
import { runWithAiExecution } from "./ai-execution-context";

vi.mock("./_core/env", () => ({ ENV: { forgeApiUrl: "http://127.0.0.1:43210", forgeApiKey: "SYNTHETIC_PROVIDER_SECRET", isProduction: false } }));

const input = { messages: [{ role: "user" as const, content: "اكتب اقتراحًا تعليميًا" }] };
const envelope = () => ({ id: "synthetic-1", created: 1793160000, model: "gemini-2.5-flash", choices: [{ index: 0, message: { role: "assistant", content: "اقتراح للمراجعة" }, finish_reason: "stop" }], usage: { prompt_tokens: 30, completion_tokens: 10, total_tokens: 40 } });
function reply(value: unknown = envelope(), init: ResponseInit = {}) { return new Response(JSON.stringify(value), { headers: { "content-type": "application/json" }, ...init }); }
const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => { vi.stubGlobal("fetch", fetchMock); fetchMock.mockReset(); fetchMock.mockImplementation(async () => reply()); });
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });

describe("bounded AI provider transport", () => {
  it("preserves the provider contract, honors bounded token limits, and supplies cancellation and redirect refusal", async () => {
    const result = await invokeLLM({ ...input, maxTokens: 512 });
    expect(result.choices[0].message.content).toBe("اقتراح للمراجعة");
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:43210/v1/chat/completions");
    expect(options).toMatchObject({ method: "POST", redirect: "error", signal: expect.any(AbortSignal) });
    expect(JSON.parse(options!.body as string)).toMatchObject({ model: "gemini-2.5-flash", max_tokens: 512, thinking: { budget_tokens: 128 } });
    await invokeLLM(input);
    expect(JSON.parse(fetchMock.mock.calls[1][1]!.body as string).max_tokens).toBe(2048);
  });

  it("rejects invalid token budgets and excessive input before provider I/O", async () => {
    for (const maxTokens of [0, 1.5, AI_MAX_OUTPUT_TOKENS + 1, Infinity]) await expect(invokeLLM({ ...input, maxTokens })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(invokeLLM({ ...input, maxTokens: 50, max_tokens: 51 })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(invokeLLM({ messages: [{ role: "user", content: "A".repeat(65_537) }] })).rejects.toMatchObject({ kind: "invalid_request" });
    await expect(invokeLLM({ messages: Array.from({ length: 33 }, () => input.messages[0]) })).rejects.toMatchObject({ kind: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("never forwards remote images or files to the provider", async () => {
    for (const url of ["https://example.invalid/secret.png", "http://127.0.0.1/private", "file:///etc/passwd", "data:image/svg+xml;base64,PHN2Zz4="]) {
      await expect(invokeLLM({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url } }] }] })).rejects.toMatchObject({ kind: "invalid_request" });
    }
    await expect(invokeLLM({ messages: [{ role: "user", content: [{ type: "file_url", file_url: { url: "https://example.invalid/private.pdf" } }] }] })).rejects.toMatchObject({ kind: "invalid_request" });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not expose raw upstream error bodies or credentials", async () => {
    fetchMock.mockResolvedValue(reply({ error: "PRIVATE_STUDENT_AND_SCHOOL_PROVIDER_SECRET" }, { status: 500 }));
    const error = await invokeLLM(input).catch(value => value);
    expect(error).toBeInstanceOf(AIProviderError);
    expect(error.kind).toBe("unavailable");
    expect(error.message).toBe("AI provider is temporarily unavailable");
    expect(JSON.stringify(error)).not.toMatch(/PRIVATE_STUDENT|SYNTHETIC_PROVIDER_SECRET/);
    expect(error.cause).toBeUndefined();
  });

  it("rejects oversized streams even without a Content-Length and cancels them", async () => {
    let cancelled = false;
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(AI_MAX_RESPONSE_BYTES)); controller.enqueue(new Uint8Array(1)); }, cancel() { cancelled = true; } }), { headers: { "content-type": "application/json" } }));
    await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "response_too_large" });
    expect(cancelled).toBe(true);
    fetchMock.mockResolvedValue(new Response("{}", { headers: { "content-type": "application/json", "content-length": String(AI_MAX_RESPONSE_BYTES + 1) } }));
    await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "response_too_large" });
  });

  it("bounds header latency by the absolute deadline even if a transport ignores abort", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const result = invokeLLM(input).catch(error => error);
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_TIMEOUT_MS);
    expect(await result).toMatchObject({ kind: "timeout" });
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });

  it("uses the same deadline for a provider body that stalls after headers", async () => {
    vi.useFakeTimers();
    let cancelled = false;
    fetchMock.mockResolvedValue(new Response(new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode('{"id":')); }, cancel() { cancelled = true; } }), { headers: { "content-type": "application/json" } }));
    const result = invokeLLM(input).catch(error => error);
    await vi.advanceTimersByTimeAsync(AI_PROVIDER_TIMEOUT_MS);
    expect(await result).toMatchObject({ kind: "timeout" });
    expect(cancelled).toBe(true);
  });

  it("never starts a provider call under an expired execution lease", async () => {
    const execution = { requestId: "expired-fixture", providerInvoked: false, expiresAt: new Date(Date.now() - 1000), deadlineMonotonic: performance.now() + 80_000 };
    await expect(runWithAiExecution(execution, () => invokeLLM(input))).rejects.toMatchObject({ kind: "timeout" });
    expect(fetchMock).not.toHaveBeenCalled();
    expect(execution.providerInvoked).toBe(false);
  });

  it("caps the provider deadline at the earlier durable lease margin", async () => {
    vi.useFakeTimers();
    fetchMock.mockImplementation(() => new Promise(() => {}));
    const execution = { requestId: "short-fixture", providerInvoked: false, expiresAt: new Date(Date.now() + 5500), deadlineMonotonic: performance.now() + 80_000 };
    const result = runWithAiExecution(execution, () => invokeLLM(input)).catch(error => error);
    await vi.advanceTimersByTimeAsync(501);
    expect(await result).toMatchObject({ kind: "timeout" });
    expect(execution.providerInvoked).toBe(true);
    expect(fetchMock.mock.calls[0][1]!.signal!.aborted).toBe(true);
  });

  it("rejects invalid JSON, content types, malformed envelopes and impossible usage", async () => {
    const badEnvelopes = [
      {}, { ...envelope(), choices: [] }, { ...envelope(), model: "private\nprovider" },
      { ...envelope(), choices: [{ ...envelope().choices[0], message: { role: "user", content: "not assistant output" } }] },
      { ...envelope(), choices: [envelope().choices[0], envelope().choices[0]] },
      { ...envelope(), usage: { prompt_tokens: -1, completion_tokens: 10, total_tokens: 9 } },
      { ...envelope(), usage: { prompt_tokens: 50, completion_tokens: 10, total_tokens: 9 } },
    ];
    for (const value of badEnvelopes) { fetchMock.mockResolvedValueOnce(reply(value)); await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "invalid_response" }); }
    fetchMock.mockResolvedValueOnce(new Response("PRIVATE INVALID JSON", { headers: { "content-type": "application/json" } }));
    await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "invalid_response" });
    fetchMock.mockResolvedValueOnce(new Response("<html>PRIVATE</html>", { headers: { "content-type": "text/html" } }));
    await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "invalid_response" });
  });

  it("never returns truncated or filtered completion text as a usable draft", async () => {
    for (const finish_reason of ["length", "content_filter", null]) {
      fetchMock.mockResolvedValueOnce(reply({ ...envelope(), choices: [{ ...envelope().choices[0], finish_reason }] }));
      await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "invalid_response" });
    }
    fetchMock.mockResolvedValueOnce(reply({ ...envelope(), choices: [{ ...envelope().choices[0], message: { role: "assistant", content: "  " } }] }));
    await expect(invokeLLM(input)).rejects.toMatchObject({ kind: "invalid_response" });
  });
});

describe("AI raster privacy and decoding", () => {
  it("decodes JPEG pixels and forwards fresh PNG without source comments or metadata", async () => {
    const pixels = new PNG({ width: 2, height: 2 }); pixels.data.fill(255);
    const original = jpeg.encode({ width: 2, height: 2, data: pixels.data }, 80).data;
    const comment = Buffer.from("PRIVATE_STUDENT_LOCATION_METADATA"), header = Buffer.alloc(4); header.writeUInt16BE(0xfffe, 0); header.writeUInt16BE(comment.length + 2, 2);
    const withMetadata = Buffer.concat([original.subarray(0, 2), header, comment, original.subarray(2)]);
    const dataUrl = `data:image/jpeg;base64,${withMetadata.toString("base64")}`;
    expect(validateAiImageDataUrl(dataUrl)).toBe(true);
    await invokeLLM({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: dataUrl } }] }] });
    const payload = JSON.parse(fetchMock.mock.calls[0][1]!.body as string);
    const forwarded = payload.messages[0].content[0].image_url.url;
    expect(forwarded.startsWith("data:image/png;base64,")).toBe(true);
    const decodedBytes = Buffer.from(forwarded.split(",")[1], "base64");
    expect(decodedBytes.includes(comment)).toBe(false);
    expect(PNG.sync.read(decodedBytes)).toMatchObject({ width: 2, height: 2 });
  });

  it("rejects corrupt, interlaced or oversized pixel headers before any provider request", async () => {
    const png = new PNG({ width: 2, height: 2 }); png.data.fill(255);
    const bytes = PNG.sync.write(png), tooLarge = Buffer.from(bytes), interlaced = Buffer.from(bytes);
    tooLarge.writeUInt32BE(16000, 16); tooLarge.writeUInt32BE(16000, 20); interlaced[28] = 1;
    for (const invalid of [bytes.subarray(0, 8), tooLarge, interlaced, bytes.subarray(0, 40)]) {
      await expect(invokeLLM({ messages: [{ role: "user", content: [{ type: "image_url", image_url: { url: `data:image/png;base64,${invalid.toString("base64")}` } }] }] })).rejects.toMatchObject({ kind: "invalid_request" });
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("rejects animated PNG rather than silently choosing its first frame", async () => {
    const png = new PNG({ width: 2, height: 2 }); png.data.fill(255);
    const bytes = PNG.sync.write(png), animation = Buffer.alloc(20);
    animation.writeUInt32BE(8, 0); animation.write("acTL", 4, "ascii"); animation.writeUInt32BE(2, 8);
    let crc = 0xffffffff;
    for (const byte of animation.subarray(4, 16)) { crc ^= byte; for (let bit = 0; bit < 8; bit++) crc = (crc >>> 1) ^ ((crc & 1) ? 0xedb88320 : 0); }
    animation.writeUInt32BE((crc ^ 0xffffffff) >>> 0, 16);
    const animated = Buffer.concat([bytes.subarray(0, 33), animation, bytes.subarray(33)]);
    await expect(normalizeAiImageBytes(animated, "image/png", new AbortController().signal)).rejects.toMatchObject({ kind: "invalid_request" });
  });

  it("retains the caller's resource slot until aborted pixel work has actually terminated", async () => {
    const original = Worker.prototype.terminate;
    let release!: () => void, terminated = false, settled = false;
    const confirmation = new Promise<number>(resolve => { release = () => resolve(1); });
    vi.spyOn(Worker.prototype, "terminate").mockImplementation(function (this: Worker) {
      return original.call(this).then(() => { terminated = true; return confirmation; });
    });
    const png = new PNG({ width: 2, height: 2 }); png.data.fill(255);
    const controller = new AbortController();
    const result = normalizeAiImageBytes(PNG.sync.write(png), "image/png", controller.signal).catch(error => { settled = true; return error; });
    controller.abort();
    try {
      await vi.waitFor(() => expect(terminated).toBe(true));
      expect(settled).toBe(false);
    } finally { release(); }
    expect(await result).toMatchObject({ kind: "timeout" });
  });

  it("refuses noncanonical image encodings and an already-aborted decoder", async () => {
    expect(validateAiImageDataUrl("data:image/png;base64,AA==\n")).toBe(false);
    expect(validateAiImageDataUrl("data:image/png;base64,A")).toBe(false);
    expect(validateAiImageDataUrl("https://private.invalid/a.png")).toBe(false);
    const png = new PNG({ width: 1, height: 1 }); png.data.fill(255);
    const controller = new AbortController(); controller.abort();
    await expect(normalizeAiImageBytes(PNG.sync.write(png), "image/png", controller.signal)).rejects.toMatchObject({ kind: "timeout" });
  });
});
