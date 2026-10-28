/** Fixed provider resource limits; deployment admission is enforced separately. */
export const AI_PROVIDER_ID = "manus-forge";
export const AI_MODEL = "gemini-2.5-flash";
export const AI_DEFAULT_OUTPUT_TOKENS = 2048;
export const AI_MAX_OUTPUT_TOKENS = 4096;
export const AI_PROVIDER_TIMEOUT_MS = 45_000;
export const AI_MAX_RESPONSE_BYTES = 512 * 1024;
export const AI_MAX_REQUEST_BYTES = 12 * 1024 * 1024;

export type AIProviderFailure = "invalid_request" | "unavailable" | "timeout" | "response_too_large" | "invalid_response";
const messages: Record<AIProviderFailure, string> = {
  invalid_request: "AI request is invalid or exceeds its limits",
  unavailable: "AI provider is temporarily unavailable",
  timeout: "AI provider timed out",
  response_too_large: "AI provider response exceeds its limit",
  invalid_response: "AI provider returned an invalid response",
};

/** Contains no upstream message, URL, request content, credential or raw cause. */
export class AIProviderError extends Error {
  constructor(readonly kind: AIProviderFailure) { super(messages[kind]); this.name = "AIProviderError"; }
}
