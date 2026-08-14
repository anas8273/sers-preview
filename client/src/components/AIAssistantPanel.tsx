import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { buildAssistantQuickQuestions } from "@/lib/ai-assistant-prompts";
import { trpc } from "@/lib/trpc";
import { AlertCircle, Lightbulb, Loader2, MessageCircle, RefreshCw, Send, Sparkles, X } from "lucide-react";
import { toast } from "sonner";

interface AIAssistantPanelProps {
  title?: string;
  placeholder?: string;
  onSuggestion?: (suggestion: string) => void;
  context?: {
    jobTitle?: string;
    criterionName?: string;
    subEvidenceName?: string;
    existingContent?: string;
  };
}

interface AssistantMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}

export function AIAssistantPanel({
  title = "المساعد الذكي",
  placeholder = "اكتب طلبك هنا، مثل: اقترح شاهداً مناسباً لهذا البند...",
  onSuggestion,
  context,
}: AIAssistantPanelProps) {
  const [messages, setMessages] = useState<AssistantMessage[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [failedQuestion, setFailedQuestion] = useState<string | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestEvidence = trpc.ai.suggestEvidence.useMutation();
  const quickQuestions = buildAssistantQuickQuestions(context?.criterionName);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isLoading]);

  const submitQuestion = async (question: string) => {
    const trimmedQuestion = question.trim();
    if (!trimmedQuestion || isLoading) return;

    setMessages((current) => [
      ...current,
      { id: `${Date.now()}-user`, role: "user", content: trimmedQuestion },
    ]);
    setInput("");
    setErrorMessage(null);
    setFailedQuestion(null);
    setIsLoading(true);

    try {
      const result = await suggestEvidence.mutateAsync({
        jobTitle: context?.jobTitle || "معلم",
        criterionName: context?.criterionName || "البند العام",
        subEvidenceName: context?.subEvidenceName || "شاهد أداء وظيفي",
        existingContent: context?.existingContent
          ? `${context.existingContent}\n\nطلب المستخدم: ${trimmedQuestion}`
          : trimmedQuestion,
      });
      const response = result.suggestions.join("\n");
      setMessages((current) => [
        ...current,
        { id: `${Date.now()}-assistant`, role: "assistant", content: response },
      ]);
      onSuggestion?.(response);
    } catch (error) {
      console.error("AI assistant request failed", error);
      setFailedQuestion(trimmedQuestion);
      setErrorMessage("تعذر الحصول على اقتراح الآن. تأكد من الاتصال ثم أعد المحاولة.");
      toast.error("تعذر الحصول على اقتراح الآن.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Card className="border-teal-200 bg-gradient-to-br from-teal-50 to-cyan-50 dark:border-teal-800 dark:from-teal-950/30 dark:to-cyan-950/30">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Sparkles className="h-5 w-5 text-teal-600" />
          {title}
          <Badge variant="secondary" className="mr-auto text-[10px]">اقتراحات ذكية</Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="h-64 space-y-3 overflow-y-auto rounded-xl border border-teal-100 bg-background/80 p-3 dark:border-teal-900">
          {messages.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <MessageCircle className="mb-2 h-8 w-8 opacity-30" />
              <p className="text-sm">اسألني عن صياغة الشاهد أو استكمال البنود الناقصة.</p>
            </div>
          ) : (
            messages.map((message) => (
              <div key={message.id} className={`flex ${message.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[90%] whitespace-pre-wrap rounded-2xl px-3 py-2 text-sm ${message.role === "user" ? "bg-teal-600 text-white" : "bg-muted text-foreground"}`}>
                  {message.content}
                </div>
              </div>
            ))
          )}
          {isLoading && <div className="flex justify-end"><div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /><span>جارٍ إعداد اقتراح عملي</span><span className="flex gap-1"><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.3s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500 [animation-delay:-0.15s]" /><i className="h-1.5 w-1.5 animate-bounce rounded-full bg-teal-500" /></span></div></div>}
          <div ref={messagesEndRef} />
        </div>
        <div className="flex items-end gap-2">
          <Textarea
            value={input}
            onChange={(event) => setInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submitQuestion(input);
              }
            }}
            placeholder={placeholder}
            disabled={isLoading}
            className="min-h-11 resize-none"
          />
          <Button type="button" size="icon" onClick={() => void submitQuestion(input)} disabled={isLoading || !input.trim()} aria-label="إرسال السؤال">
            <Send className="h-4 w-4" />
          </Button>
        </div>
        {errorMessage && (
          <div role="alert" className="flex flex-col gap-2 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900/60 dark:bg-red-950/30 dark:text-red-300 sm:flex-row sm:items-center sm:justify-between">
            <span className="flex items-center gap-2"><AlertCircle className="h-4 w-4 shrink-0" />{errorMessage}</span>
            {failedQuestion && <Button type="button" size="sm" variant="outline" disabled={isLoading} className="border-red-300 bg-background text-red-700 hover:bg-red-100" onClick={() => void submitQuestion(failedQuestion)}><RefreshCw className="ml-1 h-3.5 w-3.5" />إعادة المحاولة</Button>}
          </div>
        )}
        <div className="rounded-xl border border-teal-100 bg-white/60 p-3 dark:border-teal-900 dark:bg-black/10">
          <div className="mb-2 flex items-center gap-1.5 text-xs font-semibold text-teal-800 dark:text-teal-200"><Lightbulb className="h-3.5 w-3.5" />أسئلة سريعة</div>
          <div className="flex flex-wrap gap-2">
            {quickQuestions.map((question) => <Button key={question} type="button" variant="outline" size="sm" disabled={isLoading} className="h-auto whitespace-normal border-teal-200 px-2.5 py-1.5 text-right text-xs text-teal-800 hover:bg-teal-50 dark:border-teal-800 dark:text-teal-200 dark:hover:bg-teal-950/50" onClick={() => void submitQuestion(question)}>{question}</Button>)}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export function AIAssistantButton({ onClick, isOpen }: { onClick: () => void; isOpen?: boolean }) {
  return (
    <Button type="button" variant={isOpen ? "default" : "outline"} size="sm" onClick={onClick} className="gap-2">
      {isOpen ? <X className="h-4 w-4" /> : <Sparkles className="h-4 w-4" />}
      {isOpen ? "إغلاق المساعد" : "المساعد الذكي"}
    </Button>
  );
}
