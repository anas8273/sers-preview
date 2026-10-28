import { z } from "zod";
import { ENV } from "./env";
import { normalizeAiInlineImage } from "../ai-inline-image";
import { markAiProviderStarted, recordAiProviderResult, remainingAiExecutionTimeMs } from "../ai-execution-context";
import { AI_DEFAULT_OUTPUT_TOKENS, AI_MAX_OUTPUT_TOKENS, AI_MAX_REQUEST_BYTES, AI_MAX_RESPONSE_BYTES, AI_MODEL, AI_PROVIDER_TIMEOUT_MS, AIProviderError } from "../ai-provider-policy";
export { AI_PROVIDER_ID, AI_MODEL, AI_MAX_OUTPUT_TOKENS, AI_PROVIDER_TIMEOUT_MS, AIProviderError } from "../ai-provider-policy";

export type Role = "system" | "user" | "assistant" | "tool" | "function";

export type TextContent = {
  type: "text";
  text: string;
};

export type ImageContent = {
  type: "image_url";
  image_url: {
    url: string;
    detail?: "auto" | "low" | "high";
  };
};

export type FileContent = {
  type: "file_url";
  file_url: {
    url: string;
    mime_type?: "audio/mpeg" | "audio/wav" | "application/pdf" | "audio/mp4" | "video/mp4" ;
  };
};

export type MessageContent = string | TextContent | ImageContent | FileContent;

export type Message = {
  role: Role;
  content: MessageContent | MessageContent[];
  name?: string;
  tool_call_id?: string;
};

export type Tool = {
  type: "function";
  function: {
    name: string;
    description?: string;
    parameters?: Record<string, unknown>;
  };
};

export type ToolChoicePrimitive = "none" | "auto" | "required";
export type ToolChoiceByName = { name: string };
export type ToolChoiceExplicit = {
  type: "function";
  function: {
    name: string;
  };
};

export type ToolChoice =
  | ToolChoicePrimitive
  | ToolChoiceByName
  | ToolChoiceExplicit;

export type InvokeParams = {
  messages: Message[];
  tools?: Tool[];
  toolChoice?: ToolChoice;
  tool_choice?: ToolChoice;
  maxTokens?: number;
  max_tokens?: number;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
};

export type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

export type InvokeResult = {
  id: string;
  created: number;
  model: string;
  choices: Array<{
    index: number;
    message: {
      role: Role;
      content: string | Array<TextContent | ImageContent | FileContent>;
      tool_calls?: ToolCall[];
    };
    finish_reason: string | null;
  }>;
  usage?: {
    prompt_tokens: number;
    completion_tokens: number;
    total_tokens: number;
  };
};

export type JsonSchema = {
  name: string;
  schema: Record<string, unknown>;
  strict?: boolean;
};

export type OutputSchema = JsonSchema;

export type ResponseFormat =
  | { type: "text" }
  | { type: "json_object" }
  | { type: "json_schema"; json_schema: JsonSchema };

const ensureArray = (
  value: MessageContent | MessageContent[]
): MessageContent[] => (Array.isArray(value) ? value : [value]);

async function normalizeMessages(messages: Message[], signal: AbortSignal) {
  if (!Array.isArray(messages) || !messages.length || messages.length > 32) throw new AIProviderError("invalid_request");
  let images = 0, textCharacters = 0;
  const result = [];
  for (const message of messages) {
    if (!message || !["system", "user", "assistant", "tool", "function"].includes(message.role)) throw new AIProviderError("invalid_request");
    for (const value of [message.name, message.tool_call_id]) if (value !== undefined && (typeof value !== "string" || !/^[A-Za-z0-9_.:-]{1,128}$/.test(value))) throw new AIProviderError("invalid_request");
    const parts = ensureArray(message.content);
    if (!parts.length || parts.length > 16) throw new AIProviderError("invalid_request");
    const contentParts: Array<TextContent | ImageContent> = [];
    for (const part of parts) {
      if (typeof part === "string" || part?.type === "text") {
        const text = typeof part === "string" ? part : part.text;
        if (typeof text !== "string" || text.length > 65_536 || (textCharacters += text.length) > 131_072) throw new AIProviderError("invalid_request");
        contentParts.push({ type: "text", text });
      } else if (part?.type === "image_url" && message.role === "user") {
        if (++images > 2 || !part.image_url || ![undefined, "auto", "low", "high"].includes(part.image_url.detail)) throw new AIProviderError("invalid_request");
        const url = await normalizeAiInlineImage(part.image_url.url, signal);
        contentParts.push({ type: "image_url", image_url: { url, ...(part.image_url.detail ? { detail: part.image_url.detail } : {}) } });
      } else {
        // Remote files/images are never delegated to the provider for fetching.
        throw new AIProviderError("invalid_request");
      }
    }
    const textOnly = contentParts.every(part => part.type === "text");
    result.push({ role: message.role, ...(message.name ? { name: message.name } : {}), ...(message.tool_call_id ? { tool_call_id: message.tool_call_id } : {}), content: textOnly ? contentParts.map(part => (part as TextContent).text).join("\n") : contentParts });
  }
  return result;
}

const normalizeToolChoice = (
  toolChoice: ToolChoice | undefined,
  tools: Tool[] | undefined
): "none" | "auto" | ToolChoiceExplicit | undefined => {
  if (!toolChoice) return undefined;

  if (toolChoice === "none" || toolChoice === "auto") {
    return toolChoice;
  }

  if (toolChoice === "required") {
    if (!tools || tools.length === 0) {
      throw new Error(
        "tool_choice 'required' was provided but no tools were configured"
      );
    }

    if (tools.length > 1) {
      throw new Error(
        "tool_choice 'required' needs a single tool or specify the tool name explicitly"
      );
    }

    return {
      type: "function",
      function: { name: tools[0].function.name },
    };
  }

  if ("name" in toolChoice) {
    return {
      type: "function",
      function: { name: toolChoice.name },
    };
  }

  return toolChoice;
};

function providerConfiguration() {
  if (!ENV.forgeApiKey || ENV.forgeApiKey.length > 8192 || /[\r\n\0]/.test(ENV.forgeApiKey)) throw new AIProviderError("unavailable");
  try {
    const base = ENV.forgeApiUrl.trim() || "https://forge.manus.im";
    const url = new URL(`${base.replace(/\/$/, "")}/v1/chat/completions`);
    const local = !ENV.isProduction && url.protocol === "http:" && ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
    if ((!local && url.protocol !== "https:") || url.username || url.password || url.search || url.hash) throw new Error();
    return { url: url.toString(), key: ENV.forgeApiKey };
  } catch { throw new AIProviderError("unavailable"); }
}

const normalizeResponseFormat = ({
  responseFormat,
  response_format,
  outputSchema,
  output_schema,
}: {
  responseFormat?: ResponseFormat;
  response_format?: ResponseFormat;
  outputSchema?: OutputSchema;
  output_schema?: OutputSchema;
}):
  | { type: "json_schema"; json_schema: JsonSchema }
  | { type: "text" }
  | { type: "json_object" }
  | undefined => {
  const explicitFormat = responseFormat || response_format;
  if (explicitFormat) {
    if (
      explicitFormat.type === "json_schema" &&
      !explicitFormat.json_schema?.schema
    ) {
      throw new Error(
        "responseFormat json_schema requires a defined schema object"
      );
    }
    return explicitFormat;
  }

  const schema = outputSchema || output_schema;
  if (!schema) return undefined;

  if (!schema.name || !schema.schema) {
    throw new Error("outputSchema requires both name and schema");
  }

  return {
    type: "json_schema",
    json_schema: {
      name: schema.name,
      schema: schema.schema,
      ...(typeof schema.strict === "boolean" ? { strict: schema.strict } : {}),
    },
  };
};

const toolCallSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/), type: z.literal("function"),
  function: z.object({ name: z.string().regex(/^[A-Za-z0-9_.-]{1,64}$/), arguments: z.string().max(65_536) }),
});
const envelopeSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9_.:-]{1,128}$/), created: z.number().int().min(0).max(10_000_000_000),
  model: z.string().regex(/^[A-Za-z0-9_.:/-]{1,128}$/),
  choices: z.array(z.object({
    index: z.number().int().min(0).max(3),
    message: z.object({ role: z.literal("assistant"), content: z.union([z.string().max(262_144), z.array(z.object({ type: z.literal("text"), text: z.string().max(262_144) })).min(1).max(16)]), tool_calls: z.array(toolCallSchema).max(8).optional() }),
    finish_reason: z.enum(["stop", "length", "tool_calls", "content_filter", "function_call"]).nullable(),
  })).min(1).max(4),
  usage: z.object({ prompt_tokens: z.number().int().min(0).max(10_000_000), completion_tokens: z.number().int().min(0).max(10_000_000), total_tokens: z.number().int().min(0).max(20_000_000) }).optional(),
});

function abortable<T>(promise: Promise<T>, signal: AbortSignal): Promise<T> {
  return new Promise((resolve, reject) => {
    const abort = () => { signal.removeEventListener("abort", abort); reject(new AIProviderError("timeout")); };
    signal.addEventListener("abort", abort, { once: true });
    promise.then(value => { signal.removeEventListener("abort", abort); signal.aborted ? reject(new AIProviderError("timeout")) : resolve(value); }, error => { signal.removeEventListener("abort", abort); reject(error); });
    if (signal.aborted) abort();
  });
}

async function readResponse(response: Response, signal: AbortSignal): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (!/^application\/(?:[a-z0-9!#$&^_.+-]+\+)?json(?:;|$)/i.test(contentType) || !response.body) throw new AIProviderError("invalid_response");
  const length = response.headers.get("content-length");
  if (length !== null && (!/^[0-9]+$/.test(length) || Number(length) > AI_MAX_RESPONSE_BYTES)) throw new AIProviderError("response_too_large");
  const reader = response.body.getReader(), chunks: Uint8Array[] = [];
  let bytes = 0;
  try {
    while (true) {
      const part = await abortable(reader.read(), signal);
      if (part.done) break;
      bytes += part.value.byteLength;
      if (bytes > AI_MAX_RESPONSE_BYTES) throw new AIProviderError("response_too_large");
      chunks.push(part.value);
    }
    if (signal.aborted) throw new AIProviderError("timeout");
    try { return JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks, bytes))); }
    catch { throw new AIProviderError("invalid_response"); }
  } finally { void reader.cancel().catch(() => {}); reader.releaseLock(); }
}

export async function invokeLLM(params: InvokeParams): Promise<InvokeResult> {
  const remainingMs = Math.min(AI_PROVIDER_TIMEOUT_MS, remainingAiExecutionTimeMs());
  if (remainingMs <= 0) throw new AIProviderError("timeout");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), remainingMs);
  let response: Response | undefined;
  try {
    const config = providerConfiguration();
    const maxTokens = params.maxTokens ?? params.max_tokens ?? AI_DEFAULT_OUTPUT_TOKENS;
    if (!Number.isInteger(maxTokens) || maxTokens < 1 || maxTokens > AI_MAX_OUTPUT_TOKENS || (params.maxTokens !== undefined && params.max_tokens !== undefined && params.maxTokens !== params.max_tokens)) throw new AIProviderError("invalid_request");
    const payload: Record<string, unknown> = {
      model: AI_MODEL, messages: await normalizeMessages(params.messages, controller.signal), max_tokens: maxTokens, thinking: { budget_tokens: 128 },
    };
    if (params.tools?.length) {
      if (params.tools.length > 8) throw new AIProviderError("invalid_request");
      payload.tools = params.tools;
    }
    try {
      const choice = normalizeToolChoice(params.toolChoice || params.tool_choice, params.tools);
      if (choice) payload.tool_choice = choice;
      const format = normalizeResponseFormat(params);
      if (format) payload.response_format = format;
    } catch { throw new AIProviderError("invalid_request"); }
    let body: string;
    try { body = JSON.stringify(payload); } catch { throw new AIProviderError("invalid_request"); }
    if (Buffer.byteLength(body, "utf8") > AI_MAX_REQUEST_BYTES) throw new AIProviderError("invalid_request");
    markAiProviderStarted();
    const request = fetch(config.url, { method: "POST", headers: { "content-type": "application/json", authorization: `Bearer ${config.key}` }, body, redirect: "error", signal: controller.signal });
    // Native fetch aborts its socket. Cancel a late response as well so custom
    // transports cannot leave a response body open after the absolute deadline.
    void request.then(value => { if (controller.signal.aborted) void value.body?.cancel().catch(() => {}); }, () => {});
    response = await abortable(request, controller.signal);
    if (!response.ok) throw new AIProviderError("unavailable");
    const parsed = envelopeSchema.safeParse(await readResponse(response, controller.signal));
    if (!parsed.success || new Set(parsed.data.choices.map(choice => choice.index)).size !== parsed.data.choices.length) throw new AIProviderError("invalid_response");
    const result = parsed.data;
    // Partial or filtered completions are not usable drafts. Returning them as
    // success can overwrite a user's complete text with a truncated response.
    for (const choice of result.choices) {
      const text = typeof choice.message.content === "string" ? choice.message.content : choice.message.content.map(part => part.text).join("\n");
      if (!params.tools?.length && (choice.finish_reason !== "stop" || !text.trim() || choice.message.tool_calls?.length)) throw new AIProviderError("invalid_response");
    }
    if (result.usage && (result.usage.total_tokens < result.usage.prompt_tokens || result.usage.total_tokens < result.usage.completion_tokens)) throw new AIProviderError("invalid_response");
    recordAiProviderResult({ model: result.model, usage: result.usage });
    return result;
  } catch (error) {
    if (controller.signal.aborted) throw new AIProviderError("timeout");
    if (error instanceof AIProviderError) throw error;
    throw new AIProviderError("unavailable");
  } finally {
    clearTimeout(timer);
    if (response?.body && !response.body.locked) void response.body.cancel().catch(() => {});
    controller.abort();
  }
}
