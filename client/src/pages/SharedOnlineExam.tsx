import { useState } from "react";
import { Link, useRoute } from "wouter";
import { CheckCircle2, ClipboardCheck, Loader2, Send, XCircle } from "lucide-react";
import { trpc } from "@/lib/trpc";
import { Button } from "@/components/ui/button";

type OnlineQuestion = {
  id: string;
  type: "multiple-choice" | "true-false" | "essay" | "fill-blank";
  text: string;
  points: number;
  options?: string[];
};

export default function SharedOnlineExam() {
  const [, params] = useRoute("/exam/:token");
  const token = params?.token || "";
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [answers, setAnswers] = useState<Record<string, string | number>>({});
  const [result, setResult] = useState<{ autoScore: number; autoMaxScore: number; requiresManualReview: boolean } | null>(null);

  const examQuery = (trpc as any).onlineExam.view.useQuery({ token }, { enabled: !!token, retry: false });
  const submitMutation = (trpc as any).onlineExam.submit.useMutation();
  const exam = examQuery.data as {
    title: string; subject: string; grade: string; semester: string; duration: string;
    themeId: string; fontFamily: string; questions: OnlineQuestion[];
  } | null | undefined;

  const setAnswer = (questionId: string, value: string | number) => {
    setAnswers((previous) => ({ ...previous, [questionId]: value }));
  };

  const handleSubmit = async () => {
    if (!exam || !studentName.trim()) return;
    const response = await submitMutation.mutateAsync({
      token,
      studentName: studentName.trim(),
      studentId: studentId.trim() || undefined,
      answers,
    });
    setResult(response);
  };

  if (examQuery.isLoading) {
    return <div className="min-h-screen grid place-items-center bg-slate-50" dir="rtl"><Loader2 className="h-7 w-7 animate-spin text-teal-600" /></div>;
  }

  if (!exam) {
    return (
      <div className="min-h-screen grid place-items-center bg-slate-50 p-4" dir="rtl">
        <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm">
          <XCircle className="mx-auto mb-3 h-10 w-10 text-rose-500" />
          <h1 className="text-lg font-bold text-slate-900">الاختبار غير متاح</h1>
          <p className="mt-2 text-sm leading-6 text-slate-500">قد يكون الرابط غير صحيح أو أوقفه منشئ الاختبار.</p>
          <Link href="/exams" className="mt-5 inline-flex rounded-lg bg-teal-600 px-4 py-2 text-sm font-semibold text-white">العودة لمنصة الاختبارات</Link>
        </div>
      </div>
    );
  }

  if (result) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-10" dir="rtl">
        <div className="mx-auto max-w-xl rounded-2xl border border-emerald-200 bg-white p-7 text-center shadow-sm">
          <CheckCircle2 className="mx-auto mb-3 h-12 w-12 text-emerald-500" />
          <h1 className="text-xl font-bold text-slate-900">تم تسليم إجاباتك بنجاح</h1>
          <p className="mt-2 text-sm text-slate-600">النتيجة الآلية للأسئلة القابلة للتصحيح:</p>
          <p className="my-3 text-3xl font-black text-emerald-600">{result.autoScore} / {result.autoMaxScore}</p>
          {result.requiresManualReview && <p className="rounded-lg bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800">توجد أسئلة مقالية تحتاج مراجعة المعلم قبل اعتماد النتيجة النهائية.</p>}
        </div>
      </div>
    );
  }

  return (
    <main className="min-h-screen bg-slate-50 pb-12" dir="rtl" style={{ fontFamily: `'${exam.fontFamily}', Cairo, sans-serif` }}>
      <header className="bg-gradient-to-bl from-teal-700 to-cyan-600 px-4 py-8 text-white shadow-sm">
        <div className="mx-auto max-w-3xl">
          <div className="mb-2 flex items-center gap-2 text-white/80"><ClipboardCheck className="h-5 w-5" /><span className="text-sm">اختبار إلكتروني عبر SERS</span></div>
          <h1 className="text-2xl font-black">{exam.title}</h1>
          <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
            <span className="rounded-lg bg-white/15 px-3 py-2">المادة: {exam.subject}</span>
            <span className="rounded-lg bg-white/15 px-3 py-2">الصف: {exam.grade}</span>
            <span className="rounded-lg bg-white/15 px-3 py-2">الفصل: {exam.semester}</span>
            <span className="rounded-lg bg-white/15 px-3 py-2">المدة: {exam.duration || "غير محددة"}</span>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-3xl px-4 pt-6">
        <div className="mb-5 grid grid-cols-1 gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-sm sm:grid-cols-2">
          <label className="text-xs font-semibold text-slate-700">اسم الطالب *<input value={studentName} onChange={(event) => setStudentName(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-teal-500" placeholder="اكتب الاسم الثلاثي" /></label>
          <label className="text-xs font-semibold text-slate-700">رقم الهوية أو الجلوس <input value={studentId} onChange={(event) => setStudentId(event.target.value)} className="mt-1.5 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm font-normal outline-none focus:border-teal-500" placeholder="اختياري" /></label>
        </div>

        <div className="space-y-4">
          {exam.questions.map((question, index) => (
            <article key={question.id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="mb-3 flex items-start gap-3"><span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-teal-600 text-xs font-bold text-white">{index + 1}</span><p className="pt-1 text-sm font-semibold leading-6 text-slate-800">{question.text || "سؤال بدون نص"}</p><span className="mr-auto shrink-0 text-xs text-slate-400">{question.points} درجات</span></div>
              {question.type === "multiple-choice" && <div className="grid gap-2 sm:grid-cols-2">{(question.options || []).map((option, optionIndex) => <label key={optionIndex} className={`cursor-pointer rounded-lg border p-3 text-sm transition-colors ${answers[question.id] === optionIndex ? "border-teal-500 bg-teal-50" : "border-slate-200 hover:border-teal-300"}`}><input className="ml-2" type="radio" name={question.id} checked={answers[question.id] === optionIndex} onChange={() => setAnswer(question.id, optionIndex)} />{option || "خيار فارغ"}</label>)}</div>}
              {question.type === "true-false" && <div className="flex gap-2">{["صح", "خطأ"].map((option) => <label key={option} className={`cursor-pointer rounded-lg border px-5 py-2 text-sm ${answers[question.id] === option ? "border-teal-500 bg-teal-50" : "border-slate-200"}`}><input className="ml-2" type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswer(question.id, option)} />{option}</label>)}</div>}
              {question.type === "fill-blank" && <input value={String(answers[question.id] || "")} onChange={(event) => setAnswer(question.id, event.target.value)} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="اكتب إجابتك" />}
              {question.type === "essay" && <textarea value={String(answers[question.id] || "")} onChange={(event) => setAnswer(question.id, event.target.value)} rows={5} className="w-full resize-y rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-teal-500" placeholder="اكتب إجابتك بالتفصيل" />}
            </article>
          ))}
        </div>

        {submitMutation.error && <p className="mt-4 rounded-lg bg-rose-50 p-3 text-xs text-rose-700">{submitMutation.error.message}</p>}
        <Button onClick={handleSubmit} disabled={!studentName.trim() || submitMutation.isPending} className="mt-6 w-full gap-2 bg-teal-600 py-5 hover:bg-teal-700">
          {submitMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} تسليم الاختبار
        </Button>
      </section>
    </main>
  );
}
