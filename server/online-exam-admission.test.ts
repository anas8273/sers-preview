import { describe, expect, it } from "vitest";
import {
  canonicalizeOnlineExamAnswers,
  canonicalizeOnlineExamQuestions,
  createOnlineExamSubmissionRateLimiter,
  MAX_ONLINE_EXAM_ANSWERS_BYTES,
} from "./online-exam-admission";

const questions = [
  { id: "q-one", type: "multiple-choice", text: "واحد", points: 2, options: ["أ", "ب", "ج"], correctIndex: 1 },
  { id: "q-two", type: "essay", text: "اشرح", points: 3, correctAnswer: "نموذج" },
] as const;

describe("online exam admission hardening", () => {
  it("canonicalizes questions without losing correct answers or persisting unknown properties", () => {
    const result = canonicalizeOnlineExamQuestions([
      { ...questions[0], explanation: "معلومة لا يحتاجها التسليم", nested: { unsafe: true } },
      questions[1],
    ]);
    expect(result).toEqual([
      { id: "q-one", type: "multiple-choice", text: "واحد", points: 2, options: ["أ", "ب", "ج"], correctIndex: 1 },
      { id: "q-two", type: "essay", text: "اشرح", points: 3, correctAnswer: "نموذج" },
    ]);
  });

  it.each([
    { answers: { "unknown-question": "x" }, reason: "unknown key" },
    { answers: JSON.parse('{"__proto__":"x"}'), reason: "prototype key" },
    { answers: { "0": "x" }, reason: "numeric key" },
    { answers: { "q-one": "x", "q-two": "y", extra: "z" }, reason: "too many keys" },
  ])("rejects $reason without returning a partial map", ({ answers }) => {
    expect(() => canonicalizeOnlineExamAnswers(answers, questions)).toThrow(/الإجابات/);
  });

  it("preserves valid answers and canonicalizes the legacy numeric choice representation", () => {
    const result = canonicalizeOnlineExamAnswers({ "q-two": "  إجابة طويلة  ", "q-one": "1" }, questions);
    expect(result).toEqual({ "q-one": 1, "q-two": "إجابة طويلة" });
    expect(Object.getPrototypeOf(result)).toBeNull();
  });

  it("rejects answer payloads beyond the byte budget", () => {
    const oversized = "س".repeat(Math.ceil(MAX_ONLINE_EXAM_ANSWERS_BYTES / 2));
    expect(() => canonicalizeOnlineExamAnswers({ "q-two": oversized }, questions)).toThrow(/الحجم المسموح/);
  });

  it("keeps the composite limiter bounded and independent per IP and exam", () => {
    const limiter = createOnlineExamSubmissionRateLimiter({ maxRequests: 2, windowMs: 1_000, maxEntries: 2 });
    expect(limiter.allow("198.51.100.10", "exam-a", 0)).toBe(true);
    expect(limiter.allow("198.51.100.10", "exam-a", 1)).toBe(true);
    expect(limiter.allow("198.51.100.10", "exam-a", 2)).toBe(false);
    expect(limiter.allow("198.51.100.10", "exam-b", 2)).toBe(true);
    expect(limiter.allow("198.51.100.11", "exam-c", 2)).toBe(true);
    expect(limiter.size()).toBeLessThanOrEqual(2);
    expect(limiter.allow("198.51.100.10", "exam-a", 1_001)).toBe(true);
    expect(limiter.allow(undefined, "exam-a", 1_002)).toBe(false);
  });
});
