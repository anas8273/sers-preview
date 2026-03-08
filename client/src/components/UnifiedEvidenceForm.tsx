/**
 * UnifiedEvidenceForm - نموذج إدخال موحد للشواهد
 * بدلاً من نموذج مكرر لكل شاهد، نموذج واحد فقط مع صفوف ديناميكية
 */
import { useState, useCallback, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import {
  Plus, Trash2, Save, Upload, FileText, Image, Video, LinkIcon,
  Type, ChevronDown, ChevronUp, GripVertical, Loader2, Edit3,
  Eye, Download, Printer, X, Wand2, Sparkles, Copy
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

// ===== أنواع البيانات =====
export type EvidenceType = "text" | "image" | "link" | "file" | "video";
export type EvidencePriority = "essential" | "supporting" | "additional";

export interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select";
  placeholder?: string;
  required?: boolean;
  options?: string[];
}

export interface EvidenceRow {
  id: string;
  type: EvidenceType;
  text: string;
  link: string;
  fileData: string | null;
  fileName: string;
  displayAs: "image" | "qr";
  formData: Record<string, string>;
  comment?: string;
  priority: EvidencePriority;
  keywords?: string[];
  showBarcode?: boolean;
  subEvidenceId: string;
}

export interface SubEvidence {
  id: string;
  title: string;
  description: string;
  type: "report" | "upload" | "both";
  isCustom?: boolean;
  isSubItem?: boolean;
  parentTitle?: string;
  formFields?: FormField[];
}

const PRIORITY_CONFIG: Record<EvidencePriority, { label: string; color: string; icon: string }> = {
  essential: { label: "أساسي", color: "#059669", icon: "★" },
  supporting: { label: "داعم", color: "#2563EB", icon: "◆" },
  additional: { label: "إضافي", color: "#9333EA", icon: "○" },
};

interface UnifiedEvidenceFormProps {
  criterionId: string;
  criterionTitle: string;
  subEvidences: SubEvidence[];
  evidences: EvidenceRow[];
  formFields: FormField[];
  onAddRow: (subEvidenceId: string, type: EvidenceType) => void;
  onRemoveRow: (evidenceId: string) => void;
  onUpdateRow: (evidenceId: string, updates: Partial<EvidenceRow>) => void;
  onUpdateFormField: (evidenceId: string, fieldId: string, value: string) => void;
  onFileUpload: (subEvidenceId: string) => void;
  onDragUpload: (files: FileList, subEvidenceId: string) => void;
  // AI functions - centralized
  onAISuggest: (prompt: string) => Promise<string | null>;
  onAIFillForm: (evidenceId: string, fields: FormField[]) => Promise<void>;
  onAIImproveText: (evidenceId: string, fieldId: string, text: string) => Promise<void>;
  aiLoading: string | null;
  // Preview/Export per report
  onPreviewReport: (criterionId: string) => void;
  onExportReport: (criterionId: string) => void;
  // View mode
  viewMode: "form" | "table" | "interactive";
  onViewModeChange: (mode: "form" | "table" | "interactive") => void;
}

export default function UnifiedEvidenceForm({
  criterionId,
  criterionTitle,
  subEvidences,
  evidences,
  formFields,
  onAddRow,
  onRemoveRow,
  onUpdateRow,
  onUpdateFormField,
  onFileUpload,
  onDragUpload,
  onAISuggest,
  onAIFillForm,
  onAIImproveText,
  aiLoading,
  onPreviewReport,
  onExportReport,
  viewMode,
  onViewModeChange,
}: UnifiedEvidenceFormProps) {
  const [expandedRows, setExpandedRows] = useState<Set<string>>(new Set());
  const [editingRow, setEditingRow] = useState<string | null>(null);
  const [aiPrompt, setAiPrompt] = useState("");
  const [aiMessages, setAiMessages] = useState<string[]>([]);
  const [showAIPanel, setShowAIPanel] = useState(false);
  const [selectedSubEvidence, setSelectedSubEvidence] = useState<string>(subEvidences[0]?.id || "");

  const toggleRow = (id: string) => {
    setExpandedRows(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAISuggest = async () => {
    if (!aiPrompt.trim()) return;
    const result = await onAISuggest(aiPrompt);
    if (result) {
      setAiMessages(prev => [...prev, result]);
    }
    setAiPrompt("");
  };

  const handleUseAsSuggestion = (text: string) => {
    const subId = selectedSubEvidence || subEvidences[0]?.id || "";
    onAddRow(subId, "text");
    // سيتم تحديث النص بعد الإضافة عبر الـ parent
    toast.success("تم إضافة اقتراح AI كشاهد جديد");
  };

  // تجميع الشواهد حسب البند الفرعي
  const groupedEvidences = useMemo(() => {
    const groups: Record<string, EvidenceRow[]> = {};
    subEvidences.forEach(sub => {
      groups[sub.id] = evidences.filter(ev => ev.subEvidenceId === sub.id);
    });
    // شواهد بدون بند فرعي
    const unassigned = evidences.filter(ev => !subEvidences.find(s => s.id === ev.subEvidenceId));
    if (unassigned.length > 0) {
      groups["_unassigned"] = unassigned;
    }
    return groups;
  }, [evidences, subEvidences]);

  // ===== عرض النموذج الموحد =====
  if (viewMode === "form") {
    return (
      <div className="space-y-4">
        {/* شريط الأدوات العلوي */}
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              {criterionTitle}
            </h3>
            <Badge variant="secondary" className="text-[10px]">{evidences.length} شاهد</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            {/* أزرار العرض */}
            <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
            {/* أزرار المعاينة والتصدير لكل تقرير */}
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onPreviewReport(criterionId)}>
              <Eye className="w-3 h-3" />معاينة
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onExportReport(criterionId)}>
              <Download className="w-3 h-3" />تصدير
            </Button>
          </div>
        </div>

        {/* اختيار البند الفرعي */}
        {subEvidences.length > 1 && (
          <div className="flex flex-wrap gap-1.5">
            {subEvidences.map(sub => {
              const count = groupedEvidences[sub.id]?.length || 0;
              return (
                <button
                  key={sub.id}
                  type="button"
                  onClick={() => setSelectedSubEvidence(sub.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all border ${
                    selectedSubEvidence === sub.id
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted/50 text-muted-foreground border-border hover:bg-muted"
                  }`}
                >
                  {sub.isSubItem && <span className="text-[9px] opacity-60 ml-1">↳</span>}
                  {sub.title}
                  {count > 0 && <span className="mr-1 opacity-70">({count})</span>}
                </button>
              );
            })}
          </div>
        )}

        {/* النموذج الموحد - صفوف ديناميكية */}
        <Card className="border-border/50">
          <CardContent className="p-4">
            {/* الصفوف الموجودة */}
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {(groupedEvidences[selectedSubEvidence] || []).map((ev, idx) => (
                  <EvidenceRowItem
                    key={ev.id}
                    evidence={ev}
                    index={idx}
                    formFields={formFields}
                    subEvidence={subEvidences.find(s => s.id === ev.subEvidenceId)}
                    isExpanded={expandedRows.has(ev.id)}
                    isEditing={editingRow === ev.id}
                    onToggle={() => toggleRow(ev.id)}
                    onEdit={() => setEditingRow(editingRow === ev.id ? null : ev.id)}
                    onRemove={() => onRemoveRow(ev.id)}
                    onUpdate={(updates) => onUpdateRow(ev.id, updates)}
                    onUpdateField={(fieldId, value) => onUpdateFormField(ev.id, fieldId, value)}
                    onAIImprove={(fieldId, text) => onAIImproveText(ev.id, fieldId, text)}
                    onAIFill={() => {
                      const sub = subEvidences.find(s => s.id === ev.subEvidenceId);
                      if (sub?.formFields) onAIFillForm(ev.id, sub.formFields);
                    }}
                    aiLoading={aiLoading}
                  />
                ))}
              </AnimatePresence>

              {(groupedEvidences[selectedSubEvidence] || []).length === 0 && (
                <div className="text-center py-8 text-muted-foreground">
                  <FileText className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">لا توجد شواهد بعد</p>
                  <p className="text-xs opacity-60 mt-1">أضف شاهداً جديداً باستخدام الأزرار أدناه</p>
                </div>
              )}
            </div>

            {/* أزرار إضافة صف جديد */}
            <div className="mt-4 pt-4 border-t border-border/50">
              <div className="flex flex-wrap gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-dashed border-primary/40 text-primary text-xs"
                  onClick={() => onAddRow(selectedSubEvidence, "text")}
                >
                  <Plus className="w-3.5 h-3.5" />إضافة حقل بيانات
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-dashed border-blue-400 text-blue-600 text-xs"
                  onClick={() => onFileUpload(selectedSubEvidence)}
                >
                  <Upload className="w-3.5 h-3.5" />رفع ملف/صورة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-1.5 border-dashed border-purple-400 text-purple-600 text-xs"
                  onClick={() => onAddRow(selectedSubEvidence, "link")}
                >
                  <LinkIcon className="w-3.5 h-3.5" />رابط
                </Button>
              </div>

              {/* منطقة السحب والإفلات */}
              <div
                className="mt-3 border-2 border-dashed rounded-xl p-5 text-center transition-all cursor-pointer hover:border-primary/50 hover:bg-primary/5 group/drop"
                onDragOver={(e) => { e.preventDefault(); e.currentTarget.classList.add('border-primary', 'bg-primary/5'); }}
                onDragLeave={(e) => { e.currentTarget.classList.remove('border-primary', 'bg-primary/5'); }}
                onDrop={(e) => {
                  e.preventDefault();
                  e.currentTarget.classList.remove('border-primary', 'bg-primary/5');
                  if (e.dataTransfer.files.length > 0) {
                    onDragUpload(e.dataTransfer.files, selectedSubEvidence);
                  }
                }}
                onClick={() => onFileUpload(selectedSubEvidence)}
              >
                <Upload className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2 group-hover/drop:text-primary/60 transition-colors" />
                <p className="text-xs font-medium text-muted-foreground group-hover/drop:text-primary transition-colors">
                  اسحب الملفات هنا أو اضغط للرفع
                </p>
                <div className="flex items-center justify-center gap-2 mt-2">
                  <span className="text-[9px] text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Image className="w-2.5 h-2.5" />صور
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <FileText className="w-2.5 h-2.5" />PDF
                  </span>
                  <span className="text-[9px] text-muted-foreground/50 bg-muted/50 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Video className="w-2.5 h-2.5" />فيديو
                  </span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* مساعد AI المركزي */}
        <Card className="border-violet-200/50 bg-violet-50/30 dark:bg-violet-950/10">
          <CardContent className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-xs font-bold text-violet-700 dark:text-violet-400 flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5" />مساعد الذكاء الاصطناعي المركزي
              </h4>
              <Button
                variant="ghost"
                size="sm"
                className="text-[10px] h-6 text-violet-600"
                onClick={() => setShowAIPanel(!showAIPanel)}
              >
                {showAIPanel ? "إخفاء" : "عرض"}
                {showAIPanel ? <ChevronUp className="w-3 h-3 mr-1" /> : <ChevronDown className="w-3 h-3 mr-1" />}
              </Button>
            </div>

            <AnimatePresence>
              {showAIPanel && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: "auto" }}
                  exit={{ opacity: 0, height: 0 }}
                >
                  {/* رسائل AI السابقة */}
                  {aiMessages.length > 0 && (
                    <div className="space-y-2 mb-3 max-h-40 overflow-y-auto">
                      {aiMessages.map((msg, i) => (
                        <div key={i} className="bg-white dark:bg-background rounded-lg p-3 text-xs text-foreground leading-relaxed border border-violet-100 dark:border-violet-800">
                          {msg}
                          <button
                            type="button"
                            onClick={() => handleUseAsSuggestion(msg)}
                            className="mt-1.5 text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1"
                          >
                            <Plus className="w-3 h-3" />استخدام كشاهد
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* حقل الإدخال */}
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={aiPrompt}
                      onChange={(e) => setAiPrompt(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") handleAISuggest(); }}
                      placeholder="اسأل الذكاء الاصطناعي عن شواهد أو اقتراحات..."
                      className="flex-1 px-3 py-2 rounded-lg border border-violet-200 dark:border-violet-700 text-sm bg-white dark:bg-background focus:outline-none focus:ring-2 focus:ring-violet-500/20"
                    />
                    <Button
                      size="sm"
                      className="bg-violet-600 hover:bg-violet-700 gap-1.5"
                      onClick={handleAISuggest}
                      disabled={aiLoading === `ai_suggest_${criterionId}`}
                    >
                      {aiLoading === `ai_suggest_${criterionId}` ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Sparkles className="w-3.5 h-3.5" />
                      )}
                      اقتراح
                    </Button>
                  </div>

                  {/* أزرار AI سريعة */}
                  <div className="flex flex-wrap gap-1.5 mt-2">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 text-violet-600 hover:bg-violet-100"
                      onClick={() => {
                        setAiPrompt("اقترح شواهد أداء وظيفي لهذا البند");
                        handleAISuggest();
                      }}
                    >
                      اقتراح شواهد
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-[10px] h-6 text-violet-600 hover:bg-violet-100"
                      onClick={() => {
                        // تعبئة جميع الحقول الفارغة بالذكاء الاصطناعي
                        const emptyEvidences = evidences.filter(ev =>
                          ev.type === "text" && (!ev.formData || Object.values(ev.formData).every(v => !v?.trim()))
                        );
                        if (emptyEvidences.length > 0) {
                          const sub = subEvidences.find(s => s.id === emptyEvidences[0].subEvidenceId);
                          if (sub?.formFields) onAIFillForm(emptyEvidences[0].id, sub.formFields);
                        } else {
                          toast.info("جميع الحقول مملوءة بالفعل");
                        }
                      }}
                    >
                      تعبئة الحقول الفارغة
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>
      </div>
    );
  }

  // ===== عرض جدولي =====
  if (viewMode === "table") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
              {criterionTitle}
            </h3>
            <Badge variant="secondary" className="text-[10px]">{evidences.length} شاهد</Badge>
          </div>
          <div className="flex items-center gap-1.5">
            <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onPreviewReport(criterionId)}>
              <Eye className="w-3 h-3" />معاينة
            </Button>
            <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onExportReport(criterionId)}>
              <Download className="w-3 h-3" />تصدير
            </Button>
          </div>
        </div>

        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted">
                <tr>
                  <th className="text-right text-xs font-bold text-muted-foreground p-3 w-10">م</th>
                  <th className="text-right text-xs font-bold text-muted-foreground p-3">البند الفرعي</th>
                  <th className="text-right text-xs font-bold text-muted-foreground p-3">النوع</th>
                  <th className="text-right text-xs font-bold text-muted-foreground p-3">المحتوى</th>
                  <th className="text-center text-xs font-bold text-muted-foreground p-3 w-20">الأولوية</th>
                  <th className="text-center text-xs font-bold text-muted-foreground p-3 w-24">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {evidences.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-muted-foreground text-xs">
                      لا توجد شواهد بعد - أضف شاهداً جديداً
                    </td>
                  </tr>
                ) : (
                  evidences.map((ev, idx) => {
                    const sub = subEvidences.find(s => s.id === ev.subEvidenceId);
                    const typeLabel = ev.type === "text" ? "نموذج" : ev.type === "image" ? "صورة" : ev.type === "link" ? "رابط" : ev.type === "file" ? "ملف" : "فيديو";
                    const typeColor = ev.type === "text" ? "text-blue-600 bg-blue-50" : ev.type === "image" ? "text-green-600 bg-green-50" : ev.type === "link" ? "text-purple-600 bg-purple-50" : ev.type === "file" ? "text-orange-600 bg-orange-50" : "text-red-600 bg-red-50";
                    const content = ev.type === "text"
                      ? (ev.formData ? Object.values(ev.formData).filter(v => v?.trim()).join(" | ").substring(0, 80) || "فارغ" : ev.text?.substring(0, 80) || "فارغ")
                      : ev.type === "link" ? ev.link?.substring(0, 60) || "—"
                      : ev.fileName || "—";
                    return (
                      <tr key={ev.id} className="border-t border-border hover:bg-muted/30 transition-colors">
                        <td className="p-3 text-muted-foreground">{idx + 1}</td>
                        <td className="p-3 text-xs">{sub?.title || "—"}</td>
                        <td className="p-3">
                          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${typeColor}`}>{typeLabel}</span>
                        </td>
                        <td className="p-3 text-xs text-muted-foreground max-w-[200px] truncate">{content}</td>
                        <td className="p-3 text-center">
                          <span
                            className="text-[10px] font-medium px-2 py-0.5 rounded-full"
                            style={{ backgroundColor: PRIORITY_CONFIG[ev.priority].color + "15", color: PRIORITY_CONFIG[ev.priority].color }}
                          >
                            {PRIORITY_CONFIG[ev.priority].icon} {PRIORITY_CONFIG[ev.priority].label}
                          </span>
                        </td>
                        <td className="p-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <button type="button" onClick={() => setEditingRow(editingRow === ev.id ? null : ev.id)}
                              className="p-1 rounded text-blue-500 hover:bg-blue-50 transition-colors">
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button type="button" onClick={() => onRemoveRow(ev.id)}
                              className="p-1 rounded text-red-500 hover:bg-red-50 transition-colors">
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* أزرار إضافة */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" className="gap-1.5 border-dashed text-xs"
            onClick={() => onAddRow(selectedSubEvidence || subEvidences[0]?.id || "", "text")}>
            <Plus className="w-3.5 h-3.5" />إضافة صف
          </Button>
          <Button variant="outline" size="sm" className="gap-1.5 border-dashed text-xs"
            onClick={() => onFileUpload(selectedSubEvidence || subEvidences[0]?.id || "")}>
            <Upload className="w-3.5 h-3.5" />رفع ملف
          </Button>
        </div>
      </div>
    );
  }

  // ===== عرض تفاعلي (interactive) =====
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-foreground" style={{ fontFamily: "var(--font-heading)" }}>
            {criterionTitle}
          </h3>
          <Badge variant="secondary" className="text-[10px]">{evidences.length} شاهد</Badge>
        </div>
        <div className="flex items-center gap-1.5">
          <ViewModeToggle viewMode={viewMode} onChange={onViewModeChange} />
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onPreviewReport(criterionId)}>
            <Eye className="w-3 h-3" />معاينة
          </Button>
          <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => onExportReport(criterionId)}>
            <Download className="w-3 h-3" />تصدير
          </Button>
        </div>
      </div>

      {/* عرض تفاعلي - كل بند فرعي كبطاقة */}
      <div className="space-y-3">
        {subEvidences.map(sub => {
          const subEvs = groupedEvidences[sub.id] || [];
          return (
            <Card key={sub.id} className="border-border/50 overflow-hidden">
              <CardHeader className="p-3 bg-muted/30 cursor-pointer" onClick={() => toggleRow(sub.id)}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {sub.isSubItem && <span className="text-[10px] text-muted-foreground">↳</span>}
                    <CardTitle className="text-xs font-bold">{sub.title}</CardTitle>
                    <Badge variant="outline" className="text-[9px]">{subEvs.length} شاهد</Badge>
                  </div>
                  {expandedRows.has(sub.id) ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                </div>
                {sub.description && (
                  <p className="text-[10px] text-muted-foreground mt-1 line-clamp-2">{sub.description}</p>
                )}
              </CardHeader>
              <AnimatePresence>
                {expandedRows.has(sub.id) && (
                  <motion.div
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                  >
                    <CardContent className="p-3 space-y-2">
                      {subEvs.map((ev, idx) => (
                        <InteractiveEvidenceCard
                          key={ev.id}
                          evidence={ev}
                          index={idx}
                          onEdit={() => setEditingRow(editingRow === ev.id ? null : ev.id)}
                          onRemove={() => onRemoveRow(ev.id)}
                          isEditing={editingRow === ev.id}
                          formFields={sub.formFields || formFields}
                          onUpdate={(updates) => onUpdateRow(ev.id, updates)}
                          onUpdateField={(fieldId, value) => onUpdateFormField(ev.id, fieldId, value)}
                        />
                      ))}
                      {subEvs.length === 0 && (
                        <p className="text-center text-xs text-muted-foreground py-4">لا توجد شواهد - أضف شاهداً</p>
                      )}
                      <div className="flex gap-1.5 pt-2">
                        <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6"
                          onClick={() => onAddRow(sub.id, "text")}>
                          <Plus className="w-3 h-3" />بيانات
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6"
                          onClick={() => onFileUpload(sub.id)}>
                          <Upload className="w-3 h-3" />ملف
                        </Button>
                        <Button variant="outline" size="sm" className="gap-1 text-[10px] h-6"
                          onClick={() => onAddRow(sub.id, "link")}>
                          <LinkIcon className="w-3 h-3" />رابط
                        </Button>
                      </div>
                    </CardContent>
                  </motion.div>
                )}
              </AnimatePresence>
            </Card>
          );
        })}
      </div>
    </div>
  );
}

// ===== مكون صف الشاهد =====
function EvidenceRowItem({
  evidence: ev,
  index,
  formFields,
  subEvidence,
  isExpanded,
  isEditing,
  onToggle,
  onEdit,
  onRemove,
  onUpdate,
  onUpdateField,
  onAIImprove,
  onAIFill,
  aiLoading,
}: {
  evidence: EvidenceRow;
  index: number;
  formFields: FormField[];
  subEvidence?: SubEvidence;
  isExpanded: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onRemove: () => void;
  onUpdate: (updates: Partial<EvidenceRow>) => void;
  onUpdateField: (fieldId: string, value: string) => void;
  onAIImprove: (fieldId: string, text: string) => void;
  onAIFill: () => void;
  aiLoading: string | null;
}) {
  const typeIcon = ev.type === "text" ? <Type className="w-3.5 h-3.5 text-blue-500" /> :
    ev.type === "image" ? <Image className="w-3.5 h-3.5 text-green-500" /> :
    ev.type === "link" ? <LinkIcon className="w-3.5 h-3.5 text-purple-500" /> :
    ev.type === "file" ? <FileText className="w-3.5 h-3.5 text-orange-500" /> :
    <Video className="w-3.5 h-3.5 text-red-500" />;

  const typeLabel = ev.type === "text" ? "نموذج" : ev.type === "image" ? "صورة" : ev.type === "link" ? "رابط" : ev.type === "file" ? "ملف" : "فيديو";
  const activeFormFields = subEvidence?.formFields || formFields;
  const hasFormData = ev.formData && Object.values(ev.formData).some(v => v?.trim());

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      className="bg-muted/30 rounded-xl border border-border/50 overflow-hidden"
    >
      {/* رأس الصف */}
      <div
        className="flex items-center gap-2 p-3 cursor-pointer hover:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <span className="text-[10px] text-muted-foreground font-mono w-5 text-center">{index + 1}</span>
        {typeIcon}
        <span className="text-xs font-medium text-foreground flex-1 truncate">
          {ev.type === "text" && hasFormData
            ? Object.values(ev.formData!).filter(v => v?.trim()).join(" · ").substring(0, 60) || typeLabel
            : ev.type === "link" ? (ev.link || "رابط فارغ")
            : ev.fileName || typeLabel
          }
        </span>
        <span
          className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
          style={{ backgroundColor: PRIORITY_CONFIG[ev.priority].color + "15", color: PRIORITY_CONFIG[ev.priority].color }}
        >
          {PRIORITY_CONFIG[ev.priority].label}
        </span>
        <div className="flex items-center gap-0.5">
          <button type="button" onClick={(e) => { e.stopPropagation(); onEdit(); }}
            className="p-1 rounded text-blue-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Edit3 className="w-3 h-3" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="p-1 rounded text-red-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            <Trash2 className="w-3 h-3" />
          </button>
          {isExpanded ? <ChevronUp className="w-3.5 h-3.5 text-muted-foreground" /> : <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />}
        </div>
      </div>

      {/* محتوى الصف المفتوح */}
      <AnimatePresence>
        {(isExpanded || isEditing) && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-border/30"
          >
            <div className="p-3 space-y-3">
              {/* حقول النموذج */}
              {ev.type === "text" && activeFormFields.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                  {activeFormFields.map((field) => (
                    <div key={field.id} className={field.type === "textarea" ? "md:col-span-2" : ""}>
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-medium text-foreground">
                          {field.label}
                          {field.required && <span className="text-destructive mr-0.5">*</span>}
                        </label>
                        {field.type === "textarea" && ev.formData?.[field.id]?.trim() && (
                          <button
                            type="button"
                            onClick={() => onAIImprove(field.id, ev.formData?.[field.id] || "")}
                            disabled={aiLoading === `improve_${ev.id}_${field.id}`}
                            className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1"
                          >
                            {aiLoading === `improve_${ev.id}_${field.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Wand2 className="w-3 h-3" />}
                            تحسين
                          </button>
                        )}
                      </div>
                      {field.type === "textarea" ? (
                        <textarea
                          value={ev.formData?.[field.id] || ""}
                          onChange={(e) => onUpdateField(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          rows={3}
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                        />
                      ) : field.type === "select" ? (
                        <select
                          value={ev.formData?.[field.id] || ""}
                          onChange={(e) => onUpdateField(field.id, e.target.value)}
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                        >
                          <option value="">اختر...</option>
                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                        </select>
                      ) : (
                        <input
                          type={field.type === "date" ? "date" : field.type === "number" ? "number" : "text"}
                          value={ev.formData?.[field.id] || ""}
                          onChange={(e) => onUpdateField(field.id, e.target.value)}
                          placeholder={field.placeholder}
                          className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                        />
                      )}
                    </div>
                  ))}
                  {/* زر تعبئة AI */}
                  <div className="md:col-span-2 flex justify-end">
                    <Button
                      variant="secondary"
                      size="sm"
                      className="gap-1.5 text-xs"
                      onClick={onAIFill}
                      disabled={aiLoading === `fill_${ev.id}`}
                    >
                      {aiLoading === `fill_${ev.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 text-violet-500" />}
                      تعبئة بالذكاء الاصطناعي
                    </Button>
                  </div>
                </div>
              )}

              {/* حقل نص عادي */}
              {ev.type === "text" && activeFormFields.length === 0 && (
                <textarea
                  value={ev.text}
                  onChange={(e) => onUpdate({ text: e.target.value })}
                  placeholder="اكتب نص الشاهد هنا..."
                  rows={2}
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                />
              )}

              {/* حقل الرابط */}
              {ev.type === "link" && (
                <input
                  type="url"
                  value={ev.link}
                  onChange={(e) => onUpdate({ link: e.target.value })}
                  placeholder="https://example.com"
                  dir="ltr"
                  className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
                />
              )}

              {/* معاينة الملف */}
              {(ev.type === "image" || ev.type === "file" || ev.type === "video") && ev.fileData && (
                <div className="bg-muted/50 rounded-lg p-3">
                  {ev.type === "image" && !ev.fileData.startsWith("idb://") && (
                    <img src={ev.fileData} alt="" className="max-h-40 rounded-lg border border-border" />
                  )}
                  {ev.type !== "image" && (
                    <div className="flex items-center gap-2">
                      <FileText className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-foreground">{ev.fileName}</span>
                    </div>
                  )}
                </div>
              )}

              {/* خيارات الصف */}
              <div className="flex items-center gap-3 pt-2 border-t border-border/30">
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] text-muted-foreground">الأولوية:</span>
                  <select
                    value={ev.priority}
                    onChange={(e) => onUpdate({ priority: e.target.value as EvidencePriority })}
                    className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-background"
                  >
                    {Object.entries(PRIORITY_CONFIG).map(([k, v]) => (
                      <option key={k} value={k}>{v.icon} {v.label}</option>
                    ))}
                  </select>
                </div>
                {ev.type === "image" && (
                  <div className="flex items-center gap-1.5">
                    <span className="text-[10px] text-muted-foreground">العرض:</span>
                    <select
                      value={ev.displayAs}
                      onChange={(e) => onUpdate({ displayAs: e.target.value as "image" | "qr" })}
                      className="text-[10px] px-2 py-0.5 rounded-full border border-border bg-background"
                    >
                      <option value="image">صورة</option>
                      <option value="qr">QR</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ===== بطاقة شاهد تفاعلية =====
function InteractiveEvidenceCard({
  evidence: ev,
  index,
  onEdit,
  onRemove,
  isEditing,
  formFields,
  onUpdate,
  onUpdateField,
}: {
  evidence: EvidenceRow;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
  isEditing: boolean;
  formFields: FormField[];
  onUpdate: (updates: Partial<EvidenceRow>) => void;
  onUpdateField: (fieldId: string, value: string) => void;
}) {
  const typeIcon = ev.type === "text" ? <Type className="w-3 h-3" /> :
    ev.type === "image" ? <Image className="w-3 h-3" /> :
    ev.type === "link" ? <LinkIcon className="w-3 h-3" /> :
    ev.type === "file" ? <FileText className="w-3 h-3" /> :
    <Video className="w-3 h-3" />;

  return (
    <div className="bg-background rounded-lg border border-border/50 p-3">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[9px] text-muted-foreground bg-muted rounded-full w-4 h-4 flex items-center justify-center">{index + 1}</span>
          {typeIcon}
          <span
            className="text-[9px] font-medium px-1.5 py-0.5 rounded-full"
            style={{ backgroundColor: PRIORITY_CONFIG[ev.priority].color + "15", color: PRIORITY_CONFIG[ev.priority].color }}
          >
            {PRIORITY_CONFIG[ev.priority].label}
          </span>
        </div>
        <div className="flex gap-0.5">
          <button type="button" onClick={onEdit} className="p-1 rounded text-blue-400 hover:text-blue-600">
            <Edit3 className="w-3 h-3" />
          </button>
          <button type="button" onClick={onRemove} className="p-1 rounded text-red-400 hover:text-red-600">
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* عرض المحتوى */}
      {isEditing ? (
        <div className="space-y-2">
          {ev.type === "text" && formFields.length > 0 && formFields.map(field => (
            <div key={field.id}>
              <label className="text-[10px] font-medium text-muted-foreground">{field.label}</label>
              {field.type === "textarea" ? (
                <textarea value={ev.formData?.[field.id] || ""} onChange={(e) => onUpdateField(field.id, e.target.value)}
                  placeholder={field.placeholder} rows={2}
                  className="w-full px-2 py-1.5 rounded-md border border-border text-xs resize-none focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background" />
              ) : (
                <input type={field.type === "date" ? "date" : "text"} value={ev.formData?.[field.id] || ""}
                  onChange={(e) => onUpdateField(field.id, e.target.value)} placeholder={field.placeholder}
                  className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background" />
              )}
            </div>
          ))}
          {ev.type === "link" && (
            <input type="url" value={ev.link} onChange={(e) => onUpdate({ link: e.target.value })}
              placeholder="https://example.com" dir="ltr"
              className="w-full px-2 py-1.5 rounded-md border border-border text-xs focus:outline-none focus:ring-1 focus:ring-primary/20 bg-background" />
          )}
        </div>
      ) : (
        <div className="text-xs text-foreground">
          {ev.type === "text" && ev.formData && Object.entries(ev.formData).filter(([, v]) => v?.trim()).map(([key, val]) => {
            const field = formFields.find(f => f.id === key);
            return (
              <div key={key} className="flex gap-1 mb-0.5">
                <span className="text-muted-foreground font-medium">{field?.label || key}:</span>
                <span className="line-clamp-1">{val}</span>
              </div>
            );
          })}
          {ev.type === "link" && <span className="text-purple-600 underline" dir="ltr">{ev.link || "—"}</span>}
          {ev.type === "image" && ev.fileData && !ev.fileData.startsWith("idb://") && (
            <img src={ev.fileData} alt="" className="max-h-20 rounded-md border border-border mt-1" />
          )}
          {(ev.type === "file" || ev.type === "video") && (
            <span className="text-muted-foreground">{ev.fileName || "ملف مرفق"}</span>
          )}
        </div>
      )}
    </div>
  );
}

// ===== مكون تبديل وضع العرض =====
function ViewModeToggle({ viewMode, onChange }: { viewMode: string; onChange: (mode: "form" | "table" | "interactive") => void }) {
  return (
    <div className="flex items-center bg-muted rounded-lg p-0.5">
      <button
        type="button"
        onClick={() => onChange("form")}
        className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${viewMode === "form" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        نموذج
      </button>
      <button
        type="button"
        onClick={() => onChange("table")}
        className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${viewMode === "table" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        جدول
      </button>
      <button
        type="button"
        onClick={() => onChange("interactive")}
        className={`px-2 py-1 rounded-md text-[10px] font-medium transition-all ${viewMode === "interactive" ? "bg-background shadow-sm text-foreground" : "text-muted-foreground hover:text-foreground"}`}
      >
        تفاعلي
      </button>
    </div>
  );
}
