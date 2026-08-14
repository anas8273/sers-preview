import { useEffect, useRef, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { Loader2, MessageCircle, Send, Sparkles, X } from "lucide-react";
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
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const suggestEvidence = trpc.ai.suggestEvidence.useMutation();

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
      toast.error("تعذر الحصول على اقتراح الآن. حاول مرة أخرى.");
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
          {isLoading && (
            <div className="flex justify-end">
              <div className="flex items-center gap-2 rounded-2xl bg-muted px-3 py-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري إعداد الاقتراح...
              </div>
            </div>
          )}
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
        <div className="flex flex-wrap gap-2">
          {[
            "اقترح شواهد للبنود الناقصة",
            "حسّن صياغة الشاهد",
            "ما الملفات المناسبة للإرفاق؟",
          ].map((question) => (
            <Badge key={question} variant="outline" className="cursor-pointer" onClick={() => void submitQuestion(question)}>
              {question}
            </Badge>
          ))}
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
