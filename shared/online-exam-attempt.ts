type AttemptStorage = Pick<Storage, "getItem" | "setItem">;
const VALID_ATTEMPT = /^[A-Za-z0-9_-]{16,128}$/;

/** Persist only a random retry nonce, never identity or answers. */
export function getOrCreateOnlineExamAttempt(
  examToken: string,
  storage: AttemptStorage | undefined,
  generate: () => string = () => globalThis.crypto.randomUUID(),
): string {
  const key = `sers-online-exam-attempt:${examToken}`;
  try {
    const existing = storage?.getItem(key);
    if (existing && VALID_ATTEMPT.test(existing)) return existing;
  } catch {
    // A blocked sessionStorage still permits a stable nonce for this mounted page.
  }
  const attemptId = generate();
  if (!VALID_ATTEMPT.test(attemptId)) throw new Error("Unable to create a secure exam attempt");
  try { storage?.setItem(key, attemptId); } catch { /* Do not store personal data elsewhere. */ }
  return attemptId;
}

export function browserExamAttemptStorage(): AttemptStorage | undefined {
  try { return typeof window === "undefined" ? undefined : window.sessionStorage; }
  catch { return undefined; }
}
