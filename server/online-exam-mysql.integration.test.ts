import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { onlineExamResponses, onlineExams } from "../drizzle/schema";
import {
  createOnlineExamResponse,
  getDb,
  getOnlineExamResponses,
} from "./db";

const suite = process.env.SERS_INTEGRATION === "1" ? describe : describe.skip;

suite("online exam submission hardening on disposable MySQL", () => {
  let examId = 0;
  const token = `exam-integration-${randomUUID()}`;

  beforeAll(async () => {
    const ci = process.env.GITHUB_ACTIONS === "true" && process.env.DATABASE_URL === "mysql://root:root@127.0.0.1:3306/sers_test";
    const local = process.env.SERS_DISPOSABLE_LOCAL_MYSQL === "1" && process.env.DATABASE_URL === "mysql://root:sers-loopback-test-only@127.0.0.1:3307/sers_test";
    if (!ci && !local) {
      throw new Error("Online exam integration requires disposable CI MySQL");
    }
    const db = (await getDb())!;
    const [inserted] = await db.insert(onlineExams).values({
      userId: 900001,
      token,
      title: "اختبار اصطناعي",
      subject: "علوم",
      grade: "رابع",
      semester: "الأول",
      duration: "30",
      themeId: "classic",
      fontFamily: "Cairo",
      questions: [{ id: "q1", type: "multiple-choice", text: "1+1؟", points: 1, options: ["1", "2"], correctIndex: 1 }],
      isActive: true,
    });
    examId = Number(inserted.insertId);
  });

  afterAll(async () => {
    if (!examId) return;
    const db = (await getDb())!;
    await db.delete(onlineExamResponses).where(eq(onlineExamResponses.onlineExamId, examId));
    await db.delete(onlineExams).where(eq(onlineExams.id, examId));
  });

  const response = (attemptId: string | null, studentName = "طالب اصطناعي", answer: number = 1) => ({
    onlineExamId: examId,
    attemptId,
    studentName,
    studentId: "synthetic-student",
    answers: { q1: answer },
    autoScore: answer === 1 ? 1 : 0,
    autoMaxScore: 1,
  });

  it("creates one row for concurrent retries of the same nonce", async () => {
    const payload = response("attempt-concurrent-0001");
    const results = await Promise.all(Array.from({ length: 20 }, () => createOnlineExamResponse(payload)));
    expect(results.filter(result => !result.deduplicated)).toHaveLength(1);
    expect(results.filter(result => result.deduplicated)).toHaveLength(19);

    const rows = await (await getDb())!.select().from(onlineExamResponses).where(and(
      eq(onlineExamResponses.onlineExamId, examId),
      eq(onlineExamResponses.attemptId, payload.attemptId!),
    ));
    expect(rows).toHaveLength(1);
  });

  it("does not merge a different student into an existing nonce", async () => {
    const attemptId = "attempt-owner-bound-0001";
    await createOnlineExamResponse(response(attemptId));
    await expect(createOnlineExamResponse(response(attemptId, "طالب مختلف"))).rejects.toMatchObject({ code: "CONFLICT" });
    const rows = await (await getDb())!.select().from(onlineExamResponses).where(eq(onlineExamResponses.attemptId, attemptId));
    expect(rows).toHaveLength(1);
    expect(rows[0].studentName).toBe("طالب اصطناعي");
  });

  it("keeps legacy no-nonce submissions compatible and pages summaries", async () => {
    await createOnlineExamResponse(response(null, "قديم 1"));
    await createOnlineExamResponse(response(null, "قديم 2"));
    const legacy = await getOnlineExamResponses(examId);
    expect(Array.isArray(legacy)).toBe(true);
    const page = await getOnlineExamResponses(examId, { limit: 2 });
    if (Array.isArray(page)) throw new Error("Expected paginated response envelope");
    expect(page).toMatchObject({ items: expect.any(Array) });
    expect(page.items).toHaveLength(2);
    expect(page.items[0]).not.toHaveProperty("answers");
  });

  it("never silently truncates a legacy list and exposes every paginated submission", async () => {
    for (let index = 0; index < 55; index += 1) {
      await createOnlineExamResponse(response(`attempt-page-${String(index).padStart(6, "0")}`, `طالب الصفحات ${index}`));
    }
    await expect(getOnlineExamResponses(examId)).rejects.toMatchObject({ code: "PRECONDITION_FAILED" });
    const ids = new Set<number>();
    let cursor: string | undefined;
    do {
      const page = await getOnlineExamResponses(examId, { limit: 10, cursor });
      if (Array.isArray(page)) throw new Error("Expected a pagination envelope");
      for (const item of page.items) {
        expect(ids.has(item.id)).toBe(false);
        ids.add(item.id);
        expect(item).not.toHaveProperty("answers");
      }
      cursor = page.nextCursor ?? undefined;
    } while (cursor);
    const rows = await (await getDb())!.select({ id: onlineExamResponses.id }).from(onlineExamResponses).where(eq(onlineExamResponses.onlineExamId, examId));
    expect(ids.size).toBe(rows.length);
    expect(ids.size).toBeGreaterThan(50);
  });
});
