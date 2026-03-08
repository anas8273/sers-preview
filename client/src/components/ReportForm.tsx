/**
 * ReportForm - نموذج إدخال واحد ديناميكي
 * يعرض الحقول حسب تعريف القالب (ReportTemplate)
 * يدعم: إضافة صفوف، تعديل، حذف، مساعد AI مركزي
 */
import { useState, useCallback, useMemo, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus, Trash2, GripVertical, Sparkles, Send, X, ChevronDown, ChevronUp,
  Image as ImageIcon, Upload, FileText, Calendar, List, Type, AlignLeft,
  Loader2, Wand2, MessageSquare, Bot, Minimize2, Maximize2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import type { ReportField } from "../../../drizzle/schema";

// ─── Types ────────────────────────────────────────────────────
export interface ReportFormData {
  [fieldId: string]: any; // string | string[] | File[] etc.
}

interface ReportFormProps {
  fields: ReportField[];
  data: ReportFormData;
  onChange: (data: ReportFormData) => void;
  templateName?: string;
  context?: { jobTitle?: string; criterionName?: string; subEvidenceName?: string };
  onFileUpload?: (file: File) => Promise<string>; // returns URL
  compact?: boolean;
}

// ─── Field type icons ─────────────────────────────────────────
const FIELD_ICONS: Record<string, React.ComponentType<any>> = {
  text: Type,
  textarea: AlignLeft,
  date: Calendar,
  number: Type,
  select: List,
  image: ImageIcon,
  images: ImageIcon,
  list: List,
  signature: FileText,
};

// ─── Single Field Renderer ────────────────────────────────────
function FieldInput({
  field,
  value,
  onChange,
  onFileUpload,
}: {
  field: ReportField;
  value: any;
  onChange: (val: any) => void;
  onFileUpload?: (file: File) => Promise<string>;
}) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  switch (field.type) {
    case "text":
    case "number":
    case "date":
      return (
        <input
          type={field.type === "number" ? "number" : field.type === "date" ? "date" : "text"}
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `أدخل ${field.label}`}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          dir="rtl"
        />
      );

    case "textarea":
      return (
        <textarea
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `أدخل ${field.label}`}
          rows={4}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all resize-y min-h-[80px]"
          dir="rtl"
        />
      );

    case "select":
      return (
        <select
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          dir="rtl"
        >
          <option value="">اختر {field.label}</option>
          {(field.options || []).map((opt) => (
            <option key={opt} value={opt}>{opt}</option>
          ))}
        </select>
      );

    case "list": {
      const items: string[] = Array.isArray(value) ? value : [];
      return (
        <div className="space-y-2">
          {items.map((item, idx) => (
            <div key={idx} className="flex items-center gap-2">
              <span className="text-xs text-gray-400 w-6 text-center shrink-0">{idx + 1}.</span>
              <input
                type="text"
                value={item}
                onChange={(e) => {
                  const newItems = [...items];
                  newItems[idx] = e.target.value;
                  onChange(newItems);
                }}
                placeholder={`${field.label} ${idx + 1}`}
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
                dir="rtl"
              />
              <button
                onClick={() => {
                  const newItems = items.filter((_, i) => i !== idx);
                  onChange(newItems);
                }}
                className="p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
          {(!field.maxItems || items.length < field.maxItems) && (
            <button
              onClick={() => onChange([...items, ""])}
              className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-1.5 rounded-lg transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              إضافة عنصر
            </button>
          )}
        </div>
      );
    }

    case "image":
    case "images": {
      const urls: string[] = field.type === "images"
        ? (Array.isArray(value) ? value : [])
        : (value ? [value] : []);

      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-2">
            {urls.map((url, idx) => (
              <div key={idx} className="relative group w-20 h-20 rounded-lg overflow-hidden border border-gray-200">
                <img src={url} alt="" className="w-full h-full object-cover" />
                <button
                  onClick={() => {
                    if (field.type === "images") {
                      onChange(urls.filter((_, i) => i !== idx));
                    } else {
                      onChange("");
                    }
                  }}
                  className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
                >
                  <Trash2 className="w-4 h-4 text-white" />
                </button>
              </div>
            ))}
          </div>
          {(field.type === "image" ? !value : (!field.maxItems || urls.length < field.maxItems)) && (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file || !onFileUpload) return;
                  try {
                    const url = await onFileUpload(file);
                    if (field.type === "images") {
                      onChange([...urls, url]);
                    } else {
                      onChange(url);
                    }
                  } catch (err) {
                    console.error("Upload failed:", err);
                  }
                  e.target.value = "";
                }}
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 px-3 py-2 rounded-lg border border-dashed border-emerald-300 transition-colors w-full justify-center"
              >
                <Upload className="w-3.5 h-3.5" />
                رفع صورة
              </button>
            </>
          )}
        </div>
      );
    }

    case "signature":
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || "اسم الموقّع"}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          dir="rtl"
        />
      );

    default:
      return (
        <input
          type="text"
          value={value || ""}
          onChange={(e) => onChange(e.target.value)}
          placeholder={field.placeholder || `أدخل ${field.label}`}
          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400 transition-all"
          dir="rtl"
        />
      );
  }
}

// ─── AI Central Assistant ─────────────────────────────────────
function AICentralAssistant({
  fields,
  data,
  onChange,
  context,
}: {
  fields: ReportField[];
  data: ReportFormData;
  onChange: (data: ReportFormData) => void;
  context?: { jobTitle?: string; criterionName?: string; subEvidenceName?: string };
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [chatMessages, setChatMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [inputText, setInputText] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const fillFormMutation = trpc.ai.fillFormFields.useMutation();
  const improveTextMutation = trpc.ai.improveText.useMutation();
  const suggestMutation = trpc.ai.suggest.useMutation();

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleFillAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const textFields = fields.filter(f => ["text", "textarea", "list"].includes(f.type));
      const result = await fillFormMutation.mutateAsync({
        jobTitle: context?.jobTitle || "معلم",
        criterionName: context?.criterionName || "",
        subEvidenceName: context?.subEvidenceName || "",
        formFields: textFields.map(f => ({ id: f.id, label: f.label, type: f.type })),
      });
      if (result.success && result.filledData) {
        const newData = { ...data };
        for (const [key, val] of Object.entries(result.filledData)) {
          if (val) {
            const field = fields.find(f => f.id === key);
            if (field?.type === "list") {
              newData[key] = String(val).split(/\n|[•\-\d]+\.\s*/).map(s => s.trim()).filter(Boolean);
            } else {
              newData[key] = val;
            }
          }
        }
        onChange(newData);
        setChatMessages(prev => [...prev, { role: "assistant", content: "تم تعبئة جميع الحقول بنجاح. يمكنك مراجعة البيانات وتعديلها حسب الحاجة." }]);
      }
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "حدث خطأ أثناء التعبئة. حاول مرة أخرى." }]);
    }
    setIsLoading(false);
  }, [fields, data, onChange, context, fillFormMutation]);

  const handleImproveAll = useCallback(async () => {
    setIsLoading(true);
    try {
      const newData = { ...data };
      for (const field of fields) {
        if ((field.type === "textarea" || field.type === "text") && data[field.id]) {
          const result = await improveTextMutation.mutateAsync({
            text: String(data[field.id]),
            context: `حقل: ${field.label}`,
          });
          if (result.improved) {
            newData[field.id] = result.improved;
          }
        }
      }
      onChange(newData);
      setChatMessages(prev => [...prev, { role: "assistant", content: "تم تحسين جميع النصوص بنجاح." }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: "assistant", content: "حدث خطأ أثناء التحسين." }]);
    }
    setIsLoading(false);
  }, [fields, data, onChange, improveTextMutation]);

  const handleChat = useCallback(async () => {
    if (!inputText.trim()) return;
    const userMsg = inputText.trim();
    setInputText("");
    setChatMessages(prev => [...prev, { role: "user", content: userMsg }]);
    setIsLoading(true);

    try {
      const currentDataSummary = fields
        .filter(f => data[f.id])
        .map(f => `${f.label}: ${Array.isArray(data[f.id]) ? (data[f.id] as string[]).join("، ") : data[f.id]}`)
        .join("\n");

      const result = await suggestMutation.mutateAsync({
        prompt: userMsg,
        context: `نموذج تقرير: ${context?.criterionName || ""}\nالبيانات الحالية:\n${currentDataSummary}`,
      });

      setChatMessages(prev => [...prev, { role: "assistant", content: result.content || "لم أتمكن من الإجابة." }]);
    } catch {
      setChatMessages(prev => [...prev, { role: "assistant", content: "حدث خطأ. حاول مرة أخرى." }]);
    }
    setIsLoading(false);
  }, [inputText, fields, data, context, suggestMutation]);

  if (!isOpen) {
    return (
      <motion.button
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 left-6 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-emerald-500 to-teal-600 text-white shadow-lg hover:shadow-xl flex items-center justify-center transition-all hover:scale-105"
      >
        <Bot className="w-6 h-6" />
      </motion.button>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 20, scale: 0.95 }}
      className={`fixed z-50 bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden ${
        isMinimized
          ? "bottom-6 left-6 w-72 h-14"
          : "bottom-6 left-6 w-96 h-[500px] max-h-[80vh]"
      }`}
      dir="rtl"
    >
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-gradient-to-l from-emerald-500 to-teal-600 text-white shrink-0">
        <div className="flex items-center gap-2">
          <Bot className="w-5 h-5" />
          <span className="font-bold text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>مساعد الذكاء الاصطناعي</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setIsMinimized(!isMinimized)} className="p-1 hover:bg-white/20 rounded transition-colors">
            {isMinimized ? <Maximize2 className="w-4 h-4" /> : <Minimize2 className="w-4 h-4" />}
          </button>
          <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/20 rounded transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Quick Actions */}
          <div className="flex gap-2 p-3 border-b border-gray-100 shrink-0">
            <button
              onClick={handleFillAll}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-medium hover:bg-emerald-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
              تعبئة تلقائية
            </button>
            <button
              onClick={handleImproveAll}
              disabled={isLoading}
              className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg bg-blue-50 text-blue-700 text-xs font-medium hover:bg-blue-100 transition-colors disabled:opacity-50"
            >
              {isLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
              تحسين النصوص
            </button>
          </div>

          {/* Chat Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3">
            {chatMessages.length === 0 && (
              <div className="text-center py-8">
                <Bot className="w-10 h-10 text-gray-300 mx-auto mb-3" />
                <p className="text-sm text-gray-500">مرحباً! أنا مساعدك الذكي</p>
                <p className="text-xs text-gray-400 mt-1">يمكنني مساعدتك في تعبئة النموذج أو تحسين النصوص</p>
              </div>
            )}
            {chatMessages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === "user" ? "justify-start" : "justify-end"}`}>
                <div className={`max-w-[85%] px-3 py-2 rounded-xl text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-emerald-50 text-emerald-900"
                    : "bg-gray-100 text-gray-800"
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex justify-end">
                <div className="bg-gray-100 px-3 py-2 rounded-xl">
                  <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-gray-100 shrink-0">
            <div className="flex items-center gap-2">
              <input
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleChat()}
                placeholder="اكتب سؤالك أو طلبك..."
                className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30 focus:border-emerald-400"
                dir="rtl"
              />
              <button
                onClick={handleChat}
                disabled={isLoading || !inputText.trim()}
                className="p-2 rounded-lg bg-emerald-500 text-white hover:bg-emerald-600 transition-colors disabled:opacity-50"
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </>
      )}
    </motion.div>
  );
}

// ─── Main ReportForm Component ────────────────────────────────
export default function ReportForm({
  fields,
  data,
  onChange,
  templateName,
  context,
  onFileUpload,
  compact = false,
}: ReportFormProps) {
  // Group fields by section
  const sections = useMemo(() => {
    const sectionMap = new Map<string, ReportField[]>();
    const noSection: ReportField[] = [];

    for (const field of fields) {
      if (field.section) {
        if (!sectionMap.has(field.section)) {
          sectionMap.set(field.section, []);
        }
        sectionMap.get(field.section)!.push(field);
      } else {
        noSection.push(field);
      }
    }

    const result: { title: string; fields: ReportField[] }[] = [];
    if (noSection.length > 0) {
      result.push({ title: "", fields: noSection });
    }
    for (const entry of Array.from(sectionMap.entries())) {
      result.push({ title: entry[0], fields: entry[1] });
    }
    return result;
  }, [fields]);

  const updateField = useCallback((fieldId: string, value: any) => {
    onChange({ ...data, [fieldId]: value });
  }, [data, onChange]);

  const [collapsedSections, setCollapsedSections] = useState<Set<string>>(new Set());

  const toggleSection = (title: string) => {
    setCollapsedSections(prev => {
      const next = new Set(prev);
      if (next.has(title)) next.delete(title);
      else next.add(title);
      return next;
    });
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Form Header */}
      {templateName && !compact && (
        <div className="flex items-center gap-3 mb-2">
          <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
            <FileText className="w-4 h-4 text-emerald-600" />
          </div>
          <div>
            <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>{templateName}</h3>
            <p className="text-xs text-gray-500">أدخل البيانات في الحقول أدناه</p>
          </div>
        </div>
      )}

      {/* Sections */}
      {sections.map((section, sIdx) => (
        <div key={sIdx} className="space-y-3">
          {section.title && (
            <button
              onClick={() => toggleSection(section.title)}
              className="flex items-center justify-between w-full px-3 py-2 rounded-lg bg-emerald-50 hover:bg-emerald-100 transition-colors"
            >
              <span className="font-bold text-emerald-700 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>{section.title}</span>
              {collapsedSections.has(section.title) ? <ChevronDown className="w-4 h-4 text-emerald-600" /> : <ChevronUp className="w-4 h-4 text-emerald-600" />}
            </button>
          )}

          <AnimatePresence>
            {(!section.title || !collapsedSections.has(section.title)) && (
              <motion.div
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: "auto", opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                transition={{ duration: 0.2 }}
                className="overflow-hidden"
              >
                {/* Grid layout for fields */}
                <div className={`grid gap-3 ${compact ? "grid-cols-1" : "grid-cols-1 md:grid-cols-2"}`}>
                  {section.fields.map((field) => {
                    const isFullWidth = ["textarea", "list", "images", "image"].includes(field.type);
                    const Icon = FIELD_ICONS[field.type] || Type;

                    return (
                      <div
                        key={field.id}
                        className={isFullWidth ? "col-span-full" : ""}
                      >
                        <label className="flex items-center gap-1.5 text-sm font-medium text-gray-700 mb-1.5">
                          <Icon className="w-3.5 h-3.5 text-gray-400" />
                          {field.label}
                          {field.required && <span className="text-red-400 text-xs">*</span>}
                        </label>
                        {field.helpText && (
                          <p className="text-xs text-gray-400 mb-1">{field.helpText}</p>
                        )}
                        <FieldInput
                          field={field}
                          value={data[field.id]}
                          onChange={(val) => updateField(field.id, val)}
                          onFileUpload={onFileUpload}
                        />
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      ))}

      {/* AI Central Assistant */}
      <AICentralAssistant
        fields={fields}
        data={data}
        onChange={onChange}
        context={context}
      />
    </div>
  );
}
