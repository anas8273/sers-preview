import { describe, expect, it } from "vitest";
import { getOrCreateOnlineExamAttempt } from "../shared/online-exam-attempt";

describe("student exam retry nonce", () => {
  it("reuses the nonce after remount and isolates a different exam", () => {
    const values = new Map<string, string>();
    const storage = { getItem: (key: string) => values.get(key) ?? null, setItem: (key: string, value: string) => { values.set(key, value); } };
    expect(getOrCreateOnlineExamAttempt("exam-a", storage, () => "synthetic-attempt-a0001")).toBe("synthetic-attempt-a0001");
    expect(getOrCreateOnlineExamAttempt("exam-a", storage, () => "synthetic-attempt-replaced")).toBe("synthetic-attempt-a0001");
    expect(getOrCreateOnlineExamAttempt("exam-b", storage, () => "synthetic-attempt-b0001")).toBe("synthetic-attempt-b0001");
    expect([...values.values()]).toEqual(["synthetic-attempt-a0001", "synthetic-attempt-b0001"]);
  });
  it("handles denied storage without persisting any identity or answer", () => {
    const storage = { getItem: () => { throw new Error("denied"); }, setItem: () => { throw new Error("denied"); } };
    expect(getOrCreateOnlineExamAttempt("exam-a", storage, () => "synthetic-memory-only-001")).toBe("synthetic-memory-only-001");
  });
  it("rejects malformed nonces rather than falling back to a predictable identifier", () => {
    expect(() => getOrCreateOnlineExamAttempt("exam-a", undefined, () => "bad")).toThrow("secure exam attempt");
  });
});
