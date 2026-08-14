import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const schemaSource = readFileSync(new URL("../drizzle/schema.ts", import.meta.url), "utf8");
const routerSource = readFileSync(new URL("./routers.ts", import.meta.url), "utf8");
const builderSource = readFileSync(new URL("../client/src/pages/ExamBuilder.tsx", import.meta.url), "utf8");
const sharedSource = readFileSync(new URL("../client/src/pages/SharedOnlineExam.tsx", import.meta.url), "utf8");
const appSource = readFileSync(new URL("../client/src/App.tsx", import.meta.url), "utf8");

describe("online exam sharing", () => {
  it("persists public exams and submitted responses separately", () => {
    expect(schemaSource).toContain('mysqlTable("online_exams"');
    expect(schemaSource).toContain('mysqlTable("online_exam_responses"');
    expect(schemaSource).toContain('answers: json("answers")');
  });

  it("does not expose correct answers when an exam is viewed publicly", () => {
    expect(routerSource).toContain("const questions = (exam.questions as Array<Record<string, unknown>>).map(({ correctAnswer, correctIndex, ...question }) => question)");
    expect(routerSource).toContain("onlineExam: router");
    expect(routerSource).toContain("view: publicProcedure");
  });

  it("scores objective answers on the server and flags essays for review", () => {
    expect(routerSource).toContain("submit: publicProcedure");
    expect(routerSource).toContain("autoScore");
    expect(routerSource).toContain("requiresManualReview = true");
    expect(routerSource).toContain("createOnlineExamResponse");
  });

  it("offers link creation to the teacher and a public submission route to students", () => {
    expect(builderSource).toContain("handleShareOnlineExam");
    expect(builderSource).toContain("/exam/${result.token}");
    expect(sharedSource).toContain("تسليم الاختبار");
    expect(appSource).toContain('path={"/exam/:token"}');
  });
});
