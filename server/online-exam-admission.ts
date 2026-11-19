import { TRPCError } from "@trpc/server";
import { z } from "zod";

export const ONLINE_EXAM_QUESTION_TYPES = ["multiple-choice", "true-false", "essay", "fill-blank"] as const;
export type OnlineExamQuestionType = (typeof ONLINE_EXAM_QUESTION_TYPES)[number];

export const MAX_ONLINE_EXAM_QUESTIONS = 100;
export const MAX_ONLINE_EXAM_QUESTIONS_BYTES = 256 * 1024;
export const MAX_ONLINE_EXAM_ANSWER_CHARS = 4_000;
export const MAX_ONLINE_EXAM_ANSWERS_BYTES = 64 * 1024;
export const MAX_ONLINE_EXAM_STUDENT_NAME_BYTES = 255;
export const MAX_ONLINE_EXAM_STUDENT_ID_BYTES = 128;
export const MAX_ONLINE_EXAM_ATTEMPT_ID_BYTES = 128;

const questionSchema = z.object({
  id: z.string().trim().min(1).max(128),
  type: z.enum(ONLINE_EXAM_QUESTION_TYPES),
  text: z.string().trim().min(1).max(6_000),
  points: z.number().finite().int().min(0).max(1_000),
  options: z.array(z.string().trim().min(1).max(2_000)).min(2).max(4).optional(),
  correctAnswer: z.string().trim().max(6_000).optional(),
  correctIndex: z.number().finite().int().min(0).max(3).optional(),
});

export type CanonicalOnlineExamQuestion = {
  id: string;
  type: OnlineExamQuestionType;
  text: string;
  points: number;
  options?: string[];
  correctAnswer?: string;
  correctIndex?: number;
};

const unsafeKey = (key: string) =>
  key === "__proto__" || key === "prototype" || key === "constructor" || /^(?:0|[1-9]\d*)$/.test(key);

const badRequest = (message: string): never => {
  throw new TRPCError({ code: "BAD_REQUEST", message });
};

const byteLength = (value: string) => Buffer.byteLength(value, "utf8");

function validateQuestionSemantics(question: z.infer<typeof questionSchema>, index: number) {
  if (unsafeKey(question.id)) badRequest(`معرف السؤال رقم ${index + 1} غير صالح`);
  if (question.type === "multiple-choice") {
    const options = question.options;
    if (!options) return badRequest(`خيارات السؤال رقم ${index + 1} غير صالحة`);
    if (options.length < 2 || new Set(options).size !== options.length) return badRequest(`خيارات السؤال رقم ${index + 1} غير صالحة`);
    if (question.correctIndex === undefined || question.correctIndex >= options.length) {
      badRequest(`إجابة السؤال رقم ${index + 1} غير صالحة`);
    }
    return;
  }
  if (question.type === "true-false" && question.correctAnswer !== undefined && !["صح", "خطأ"].includes(question.correctAnswer)) {
    badRequest(`إجابة السؤال رقم ${index + 1} غير صالحة`);
  }
}

/** Validate and strip legacy/unknown question properties before persistence. */
export function canonicalizeOnlineExamQuestions(input: unknown): CanonicalOnlineExamQuestion[] {
  const parsed = z.array(questionSchema).min(1).max(MAX_ONLINE_EXAM_QUESTIONS).safeParse(input);
  if (parsed.success === false) badRequest("أسئلة الاختبار غير صالحة أو تتجاوز الحدود المسموحة");

  const ids = new Set<string>();
  const canonical = parsed.data!.map((question, index) => {
    validateQuestionSemantics(question, index);
    if (ids.has(question.id)) badRequest("لا يمكن تكرار معرف السؤال");
    ids.add(question.id);
    const result: CanonicalOnlineExamQuestion = {
      id: question.id,
      type: question.type,
      text: question.text,
      points: question.points,
    };
    if (question.type === "multiple-choice") {
      result.options = [...question.options!];
      result.correctIndex = question.correctIndex;
    } else if (question.correctAnswer !== undefined) {
      result.correctAnswer = question.correctAnswer;
    }
    return result;
  });

  const bytes = byteLength(JSON.stringify(canonical));
  if (bytes > MAX_ONLINE_EXAM_QUESTIONS_BYTES) badRequest("بيانات أسئلة الاختبار تتجاوز الحجم المسموح");
  return canonical;
}

export type CanonicalOnlineExamAnswers = Record<string, string | number>;

function isPlainObject(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeAnswerValue(value: unknown, question: CanonicalOnlineExamQuestion): string | number {
  if (typeof value === "string") {
    if (value.length > MAX_ONLINE_EXAM_ANSWER_CHARS || byteLength(value) > MAX_ONLINE_EXAM_ANSWER_CHARS * 4) {
      badRequest("إحدى الإجابات تتجاوز الحجم المسموح");
    }
    const normalized = value.trim();
    if (question.type === "multiple-choice" && /^(?:0|[1-9]\d*)$/.test(normalized)) {
      const numeric = Number(normalized);
      if (!Number.isSafeInteger(numeric) || numeric >= (question.options?.length ?? 0)) return badRequest("إجابة الاختيار من متعدد غير صالحة");
      return numeric;
    }
    return normalized;
  }
  if (typeof value === "number" && Number.isFinite(value) && Number.isSafeInteger(value) && Math.abs(value) <= Number.MAX_SAFE_INTEGER) {
    if (question.type === "multiple-choice" && (value < 0 || value >= (question.options?.length ?? 0))) {
      badRequest("إجابة الاختيار من متعدد غير صالحة");
    }
    return value;
  }
  return badRequest("صيغة إحدى الإجابات غير صالحة");
}

/** Keep only known question IDs and produce a bounded, null-prototype-safe answer map. */
export function canonicalizeOnlineExamAnswers(input: unknown, questions: readonly CanonicalOnlineExamQuestion[]): CanonicalOnlineExamAnswers {
  if (!isPlainObject(input)) badRequest("صيغة الإجابات غير صالحة");
  const answerRecord = input as Record<string, unknown>;
  const keys = Object.keys(answerRecord);
  if (keys.length > questions.length || keys.some(unsafeKey)) badRequest("تتضمن الإجابات مفاتيح غير صالحة");

  const byId = new Map(questions.map(question => [question.id, question]));
  const canonical = Object.create(null) as CanonicalOnlineExamAnswers;
  for (const key of keys) {
    const question = byId.get(key);
    if (!question) return badRequest("تتضمن الإجابات سؤالاً غير موجود في الاختبار");
  }
  // Iterate in canonical question order so the same nonce cannot appear
  // different merely because a client serialized object keys differently.
  for (const question of questions) {
    if (Object.prototype.hasOwnProperty.call(answerRecord, question.id)) {
      canonical[question.id] = normalizeAnswerValue(answerRecord[question.id], question);
    }
  }
  const bytes = byteLength(JSON.stringify(canonical));
  if (bytes > MAX_ONLINE_EXAM_ANSWERS_BYTES) badRequest("إجابات الاختبار تتجاوز الحجم المسموح");
  return canonical;
}

export function validateOnlineExamStudentIdentity(studentName: string, studentId?: string) {
  if (byteLength(studentName) > MAX_ONLINE_EXAM_STUDENT_NAME_BYTES) badRequest("اسم الطالب يتجاوز الحجم المسموح");
  if (studentId !== undefined && byteLength(studentId) > MAX_ONLINE_EXAM_STUDENT_ID_BYTES) badRequest("معرف الطالب يتجاوز الحجم المسموح");
}

export function validateOnlineExamAttemptId(attemptId?: string) {
  if (attemptId === undefined) return;
  if (byteLength(attemptId) > MAX_ONLINE_EXAM_ATTEMPT_ID_BYTES || !/^[A-Za-z0-9_-]+$/.test(attemptId)) {
    badRequest("معرف المحاولة غير صالح");
  }
}

type RateLimitBucket = { count: number; windowStartedAt: number; lastSeenAt: number };

export type OnlineExamSubmissionRateLimiter = {
  allow: (ip: string | undefined, examToken: string, now?: number) => boolean;
  reset: () => void;
  size: () => number;
};

/** Process-local, bounded composite limiter. `ip` must be Express's trusted req.ip. */
export function createOnlineExamSubmissionRateLimiter(options: {
  maxRequests?: number;
  windowMs?: number;
  maxEntries?: number;
} = {}): OnlineExamSubmissionRateLimiter {
  const maxRequests = options.maxRequests ?? 20;
  const windowMs = options.windowMs ?? 60_000;
  const maxEntries = options.maxEntries ?? 10_000;
  const buckets = new Map<string, RateLimitBucket>();

  const purge = (now: number, protectedKey?: string) => {
    buckets.forEach((bucket, key) => {
      if (now - bucket.windowStartedAt >= windowMs) buckets.delete(key);
    });
    while (buckets.size >= maxEntries && (!protectedKey || !buckets.has(protectedKey))) {
      const oldestKey = buckets.keys().next().value as string | undefined;
      if (oldestKey === undefined) break;
      buckets.delete(oldestKey);
    }
  };

  return {
    allow(ip, examToken, now = Date.now()) {
      if (!ip || !examToken) return false;
      const key = `${ip.length}:${ip}\0${examToken}`;
      purge(now, key);
      const current = buckets.get(key);
      if (!current || now - current.windowStartedAt >= windowMs) {
        buckets.set(key, { count: 1, windowStartedAt: now, lastSeenAt: now });
        return true;
      }
      current.lastSeenAt = now;
      if (current.count >= maxRequests) return false;
      current.count += 1;
      return true;
    },
    reset() { buckets.clear(); },
    size() { return buckets.size; },
  };
}

export const onlineExamSubmissionRateLimiter = createOnlineExamSubmissionRateLimiter();
