/**
 * لوحة إدارة قوالب التقارير (Report Templates)
 * CRUD كامل للقوالب مع إدارة الحقول والتخطيط ومعاينة حية
 */
import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import {
  Plus, Trash2, Save, Edit3, Eye, Palette,
  Check, X, Loader2, ChevronDown, ChevronUp,
  Copy, ToggleLeft, ToggleRight, Sparkles, FileText,
  GripVertical, Settings2, Type, List, Image, Calendar,
  Hash, AlignLeft, Signature, LayoutGrid, Columns2, Columns3,
  ArrowUp, ArrowDown, PanelTop, PanelBottom
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ─── Types ────────────────────────────
interface ReportField {
  id: string;
  label: string;
  type: "text" | "textarea" | "date" | "number" | "select" | "image" | "images" | "list" | "signature";
  placeholder?: string;
  required?: boolean;
  section?: string;
  gridCol?: number;
  gridRow?: number;
  options?: string[];
  defaultValue?: string;
  maxItems?: number;
  helpText?: string;
}

interface ReportLayoutSection {
  id: string;
  title: string;
  type: "header" | "fields" | "content" | "images" | "signatures" | "footer";
  columns?: number;
  fieldIds?: string[];
  style?: Record<string, string>;
}

interface ReportLayout {
  pageSize?: "A4" | "letter";
  direction?: "rtl" | "ltr";
  columns?: number;
  backgroundUrl?: string;
  headerStyle?: "ministry" | "simple" | "custom";
  showSchoolName?: boolean;
  showMinistryLogo?: boolean;
  showSignatures?: boolean;
  showFooter?: boolean;
  sections: ReportLayoutSection[];
}

interface TemplateFormData {
  id?: number;
  name: string;
  description: string;
  category: string;
  fields: ReportField[];
  layout: ReportLayout;
  defaultThemeId?: number;
  thumbnailUrl?: string;
  isActive: boolean;
  isDefault: boolean;
  sortOrder: number;
}

const FIELD_TYPES: { value: ReportField["type"]; label: string; icon: any }[] = [
  { value: "text", label: "نص قصير", icon: Type },
  { value: "textarea", label: "نص طويل", icon: AlignLeft },
  { value: "date", label: "تاريخ", icon: Calendar },
  { value: "number", label: "رقم", icon: Hash },
  { value: "select", label: "قائمة اختيار", icon: List },
  { value: "image", label: "صورة واحدة", icon: Image },
  { value: "images", label: "صور متعددة", icon: Image },
  { value: "list", label: "قائمة عناصر", icon: List },
  { value: "signature", label: "توقيع", icon: Signature },
];

const SECTION_TYPES: { value: ReportLayoutSection["type"]; label: string }[] = [
  { value: "header", label: "ترويسة" },
  { value: "fields", label: "حقول بيانات" },
  { value: "content", label: "محتوى" },
  { value: "images", label: "صور" },
  { value: "signatures", label: "توقيعات" },
  { value: "footer", label: "تذييل" },
];

const CATEGORIES = [
  { value: "general", label: "عام" },
  { value: "programs", label: "برامج وأنشطة" },
  { value: "initiatives", label: "مبادرات" },
  { value: "lessons", label: "دروس" },
  { value: "reports", label: "تقارير" },
  { value: "certificates", label: "شهادات" },
];

const EMPTY_TEMPLATE: TemplateFormData = {
  name: "",
  description: "",
  category: "general",
  fields: [],
  layout: {
    pageSize: "A4",
    direction: "rtl",
    columns: 2,
    headerStyle: "ministry",
    showSchoolName: true,
    showMinistryLogo: true,
    showSignatures: true,
    showFooter: true,
    sections: [
      { id: "header", title: "الترويسة", type: "header" },
      { id: "info", title: "معلومات أساسية", type: "fields", columns: 2, fieldIds: [] },
      { id: "content", title: "المحتوى", type: "content", columns: 2, fieldIds: [] },
      { id: "signatures", title: "التوقيعات", type: "signatures", columns: 2, fieldIds: [] },
      { id: "footer", title: "التذييل", type: "footer" },
    ],
  },
  isActive: true,
  isDefault: false,
  sortOrder: 0,
};

// ─── Main Component ────────────────────────────
export default function ReportTemplatesPanel() {
  const [editingTemplate, setEditingTemplate] = useState<TemplateFormData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const templatesQuery = trpc.reportTemplates.listAll.useQuery();
  const createMutation = trpc.reportTemplates.create.useMutation();
  const updateMutation = trpc.reportTemplates.update.useMutation();
  const deleteMutation = trpc.reportTemplates.delete.useMutation();
  const seedMutation = trpc.reportTemplates.seed.useMutation();
  const utils = trpc.useUtils();

  const handleSave = async (template: TemplateFormData) => {
    try {
      if (template.id) {
        await updateMutation.mutateAsync({
          id: template.id,
          name: template.name,
          description: template.description,
          category: template.category,
          fields: template.fields,
          layout: template.layout,
          defaultThemeId: template.defaultThemeId,
          isActive: template.isActive,
          isDefault: template.isDefault,
          sortOrder: template.sortOrder,
        });
        toast.success("تم تحديث قالب التقرير بنجاح");
      } else {
        await createMutation.mutateAsync({
          name: template.name,
          description: template.description,
          category: template.category,
          fields: template.fields,
          layout: template.layout,
          defaultThemeId: template.defaultThemeId,
          isDefault: template.isDefault,
          sortOrder: template.sortOrder,
        });
        toast.success("تم إنشاء قالب التقرير بنجاح");
      }
      setEditingTemplate(null);
      setIsCreating(false);
      utils.reportTemplates.listAll.invalidate();
      utils.reportTemplates.list.invalidate();
    } catch (err) {
      toast.error("فشل حفظ قالب التقرير");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا القالب؟")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("تم حذف القالب");
      utils.reportTemplates.listAll.invalidate();
      utils.reportTemplates.list.invalidate();
    } catch {
      toast.error("فشل حذف القالب");
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedMutation.mutateAsync();
      toast.success("تم إضافة القوالب الافتراضية");
      utils.reportTemplates.listAll.invalidate();
    } catch {
      toast.error("فشل إضافة القوالب الافتراضية");
    }
  };

  const handleToggleActive = async (template: any) => {
    try {
      await updateMutation.mutateAsync({
        id: template.id,
        isActive: !template.isActive,
      });
      utils.reportTemplates.listAll.invalidate();
      toast.success(template.isActive ? "تم تعطيل القالب" : "تم تفعيل القالب");
    } catch {
      toast.error("فشل تحديث حالة القالب");
    }
  };

  const handleDuplicate = async (template: any) => {
    try {
      await createMutation.mutateAsync({
        name: template.name + " (نسخة)",
        description: template.description,
        category: template.category,
        fields: template.fields,
        layout: template.layout,
        defaultThemeId: template.defaultThemeId,
        sortOrder: (template.sortOrder || 0) + 1,
      });
      toast.success("تم نسخ القالب");
      utils.reportTemplates.listAll.invalidate();
    } catch {
      toast.error("فشل نسخ القالب");
    }
  };

  if (templatesQuery.isLoading) {
    return (
      <div className="text-center py-16">
        <Loader2 className="w-8 h-8 animate-spin text-emerald-600 mx-auto mb-3" />
        <p className="text-sm text-gray-500">جاري تحميل قوالب التقارير...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            إدارة قوالب التقارير
          </h2>
          <p className="text-sm text-gray-500 mt-1">
            إنشاء وتعديل قوالب التقارير مع التحكم الكامل بالحقول والتخطيط
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={handleSeedDefaults}
            disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
            <span className="mr-1">قوالب افتراضية</span>
          </Button>
          <Button size="sm" onClick={() => { setEditingTemplate({ ...EMPTY_TEMPLATE }); setIsCreating(true); }}
            className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
            <Plus className="w-4 h-4" />قالب جديد
          </Button>
        </div>
      </div>

      {/* Editor Modal */}
      <AnimatePresence>
        {(editingTemplate || isCreating) && editingTemplate && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-2 sm:p-4"
            onClick={() => { setEditingTemplate(null); setIsCreating(false); }}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              className="bg-background rounded-2xl shadow-2xl w-full max-w-5xl max-h-[95vh] overflow-y-auto"
              onClick={(e) => e.stopPropagation()}
            >
              <ReportTemplateEditor
                template={editingTemplate}
                onSave={handleSave}
                onCancel={() => { setEditingTemplate(null); setIsCreating(false); }}
                isSaving={createMutation.isPending || updateMutation.isPending}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Templates Grid */}
      {!templatesQuery.data || templatesQuery.data.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-12 text-center">
            <FileText className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">لا توجد قوالب تقارير</h3>
            <p className="text-muted-foreground mb-4">ابدأ بإنشاء قالب جديد أو أضف القوالب الافتراضية</p>
            <div className="flex items-center gap-2 justify-center">
              <Button variant="outline" onClick={handleSeedDefaults}>
                <Sparkles className="w-4 h-4 ml-1" />إضافة قوالب افتراضية
              </Button>
              <Button onClick={() => { setEditingTemplate({ ...EMPTY_TEMPLATE }); setIsCreating(true); }}>
                <Plus className="w-4 h-4 ml-1" />إنشاء قالب
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templatesQuery.data.map((template: any) => (
            <Card key={template.id} className={`overflow-hidden transition-all hover:shadow-lg ${!template.isActive ? 'opacity-60' : ''}`}>
              {/* Preview Header */}
              <div className="h-20 bg-gradient-to-l from-emerald-600 to-emerald-800 relative flex items-center justify-center">
                <div className="text-center">
                  <FileText className="w-8 h-8 text-white/80 mx-auto mb-1" />
                  <p className="text-[10px] text-white/70">{template.fields?.length || 0} حقل</p>
                </div>
                <div className="absolute top-2 left-2 flex items-center gap-1">
                  {template.isDefault && (
                    <Badge className="text-[9px] bg-yellow-500/90 text-white border-0">افتراضي</Badge>
                  )}
                  <Badge className={`text-[9px] border-0 ${template.isActive ? 'bg-green-500/90 text-white' : 'bg-gray-500/90 text-white'}`}>
                    {template.isActive ? 'مفعّل' : 'معطّل'}
                  </Badge>
                </div>
                <div className="absolute top-2 right-2">
                  <Badge variant="secondary" className="text-[9px]">
                    {CATEGORIES.find(c => c.value === template.category)?.label || template.category}
                  </Badge>
                </div>
              </div>

              <CardContent className="p-4">
                <h3 className="font-bold text-sm mb-1">{template.name}</h3>
                <p className="text-xs text-muted-foreground mb-3 line-clamp-2">
                  {template.description || "بدون وصف"}
                </p>

                {/* Fields Summary */}
                <div className="flex flex-wrap gap-1 mb-3">
                  {(template.fields || []).slice(0, 4).map((f: any) => (
                    <span key={f.id} className="text-[9px] bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
                      {f.label}
                    </span>
                  ))}
                  {(template.fields || []).length > 4 && (
                    <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">
                      +{(template.fields || []).length - 4}
                    </span>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 text-xs h-8"
                    onClick={() => setEditingTemplate({
                      id: template.id,
                      name: template.name,
                      description: template.description || "",
                      category: template.category || "general",
                      fields: template.fields || [],
                      layout: template.layout || EMPTY_TEMPLATE.layout,
                      defaultThemeId: template.defaultThemeId,
                      isActive: template.isActive ?? true,
                      isDefault: template.isDefault ?? false,
                      sortOrder: template.sortOrder || 0,
                    })}>
                    <Edit3 className="w-3 h-3 ml-1" />تعديل
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2"
                    onClick={() => handleDuplicate(template)}>
                    <Copy className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2"
                    onClick={() => handleToggleActive(template)}>
                    {template.isActive ? <ToggleRight className="w-4 h-4 text-green-500" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                  </Button>
                  <Button variant="outline" size="sm" className="h-8 px-2 text-red-500 hover:text-red-700 hover:bg-red-50"
                    onClick={() => handleDelete(template.id)}
                    disabled={deleteMutation.isPending}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Report Template Editor ────────────────────────────
function ReportTemplateEditor({
  template,
  onSave,
  onCancel,
  isSaving,
}: {
  template: TemplateFormData;
  onSave: (t: TemplateFormData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TemplateFormData>({ ...template });
  const [activeTab, setActiveTab] = useState<"info" | "fields" | "layout" | "preview">("info");
  const [editingFieldIndex, setEditingFieldIndex] = useState<number | null>(null);

  const updateField = (key: keyof TemplateFormData, value: any) => {
    setForm(prev => ({ ...prev, [key]: value }));
  };

  // ─── Field Management ────────────────────────────
  const addField = () => {
    const newField: ReportField = {
      id: `field_${Date.now()}`,
      label: "حقل جديد",
      type: "text",
      section: "info",
      required: false,
      gridCol: 1,
      gridRow: (form.fields.length || 0) + 1,
    };
    setForm(prev => ({ ...prev, fields: [...prev.fields, newField] }));
    setEditingFieldIndex(form.fields.length);
  };

  const updateFieldAt = (index: number, updates: Partial<ReportField>) => {
    setForm(prev => ({
      ...prev,
      fields: prev.fields.map((f, i) => i === index ? { ...f, ...updates } : f),
    }));
  };

  const removeField = (index: number) => {
    const field = form.fields[index];
    setForm(prev => ({
      ...prev,
      fields: prev.fields.filter((_, i) => i !== index),
      layout: {
        ...prev.layout,
        sections: prev.layout.sections.map(s => ({
          ...s,
          fieldIds: s.fieldIds?.filter(id => id !== field.id),
        })),
      },
    }));
    setEditingFieldIndex(null);
  };

  const moveField = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= form.fields.length) return;
    const newFields = [...form.fields];
    [newFields[index], newFields[newIndex]] = [newFields[newIndex], newFields[index]];
    setForm(prev => ({ ...prev, fields: newFields }));
    setEditingFieldIndex(newIndex);
  };

  const duplicateField = (index: number) => {
    const field = form.fields[index];
    const newField = { ...field, id: `${field.id}_copy_${Date.now()}`, label: field.label + " (نسخة)" };
    const newFields = [...form.fields];
    newFields.splice(index + 1, 0, newField);
    setForm(prev => ({ ...prev, fields: newFields }));
  };

  // ─── Section Management ────────────────────────────
  const addSection = () => {
    const newSection: ReportLayoutSection = {
      id: `section_${Date.now()}`,
      title: "قسم جديد",
      type: "fields",
      columns: 2,
      fieldIds: [],
    };
    setForm(prev => ({
      ...prev,
      layout: { ...prev.layout, sections: [...prev.layout.sections, newSection] },
    }));
  };

  const updateSection = (index: number, updates: Partial<ReportLayoutSection>) => {
    setForm(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        sections: prev.layout.sections.map((s, i) => i === index ? { ...s, ...updates } : s),
      },
    }));
  };

  const removeSection = (index: number) => {
    setForm(prev => ({
      ...prev,
      layout: {
        ...prev.layout,
        sections: prev.layout.sections.filter((_, i) => i !== index),
      },
    }));
  };

  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= form.layout.sections.length) return;
    const newSections = [...form.layout.sections];
    [newSections[index], newSections[newIndex]] = [newSections[newIndex], newSections[index]];
    setForm(prev => ({ ...prev, layout: { ...prev.layout, sections: newSections } }));
  };

  const toggleFieldInSection = (sectionIndex: number, fieldId: string) => {
    const section = form.layout.sections[sectionIndex];
    const fieldIds = section.fieldIds || [];
    const newFieldIds = fieldIds.includes(fieldId)
      ? fieldIds.filter(id => id !== fieldId)
      : [...fieldIds, fieldId];
    updateSection(sectionIndex, { fieldIds: newFieldIds });
  };

  // ─── Sections by field ────────────────────────────
  const fieldSections = useMemo(() => {
    const sections = new Set<string>();
    form.fields.forEach(f => { if (f.section) sections.add(f.section); });
    return Array.from(sections);
  }, [form.fields]);

  const TABS = [
    { id: "info" as const, label: "معلومات القالب", icon: FileText },
    { id: "fields" as const, label: "الحقول", icon: LayoutGrid },
    { id: "layout" as const, label: "التخطيط", icon: Columns2 },
    { id: "preview" as const, label: "معاينة", icon: Eye },
  ];

  return (
    <div className="p-4 sm:p-6" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <FileText className="w-5 h-5 text-emerald-500" />
          {template.id ? "تعديل قالب التقرير" : "إنشاء قالب تقرير جديد"}
        </h2>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-6 bg-gray-100 rounded-lg p-1">
        {TABS.map(tab => {
          const Icon = tab.icon;
          return (
            <button key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all
                ${activeTab === tab.id ? "bg-white text-emerald-700 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {tab.id === "fields" && <Badge variant="secondary" className="text-[9px] px-1">{form.fields.length}</Badge>}
            </button>
          );
        })}
      </div>

      {/* Tab Content */}
      {activeTab === "info" && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم القالب *</label>
              <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)}
                placeholder="مثال: تقرير برنامج / نشاط"
                className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-background" />
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">التصنيف</label>
              <select value={form.category} onChange={(e) => updateField("category", e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background">
                {CATEGORIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">الوصف</label>
            <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)}
              placeholder="وصف مختصر للقالب..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20 bg-background" />
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">الترتيب</label>
              <input type="number" value={form.sortOrder} onChange={(e) => updateField("sortOrder", Number(e.target.value))}
                className="w-full px-3 py-2 rounded-lg border border-border text-sm bg-background text-center" />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => updateField("isDefault", e.target.checked)}
                className="rounded border-border" />
              <span className="text-xs">افتراضي</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-5">
              <input type="checkbox" checked={form.isActive} onChange={(e) => updateField("isActive", e.target.checked)}
                className="rounded border-border" />
              <span className="text-xs">مفعّل</span>
            </label>
          </div>
        </div>
      )}

      {activeTab === "fields" && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              أضف الحقول التي سيقوم المستخدم بتعبئتها. يمكنك تحديد النوع والقسم والترتيب.
            </p>
            <Button size="sm" onClick={addField} className="gap-1.5 bg-emerald-600 hover:bg-emerald-700">
              <Plus className="w-3.5 h-3.5" />إضافة حقل
            </Button>
          </div>

          {form.fields.length === 0 ? (
            <div className="text-center py-12 border-2 border-dashed border-gray-200 rounded-xl">
              <LayoutGrid className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-sm text-gray-500 mb-2">لا توجد حقول بعد</p>
              <Button size="sm" variant="outline" onClick={addField}>
                <Plus className="w-3.5 h-3.5 ml-1" />إضافة أول حقل
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              {form.fields.map((field, index) => (
                <div key={field.id}
                  className={`border rounded-xl transition-all ${editingFieldIndex === index ? 'border-emerald-300 bg-emerald-50/30 shadow-sm' : 'border-gray-200 hover:border-gray-300'}`}>
                  {/* Field Header */}
                  <div className="flex items-center gap-2 px-3 py-2 cursor-pointer"
                    onClick={() => setEditingFieldIndex(editingFieldIndex === index ? null : index)}>
                    <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Badge variant="secondary" className="text-[9px] shrink-0">
                        {FIELD_TYPES.find(t => t.value === field.type)?.label || field.type}
                      </Badge>
                      <span className="text-sm font-medium truncate">{field.label}</span>
                      {field.required && <span className="text-red-500 text-xs">*</span>}
                      {field.section && (
                        <span className="text-[9px] text-gray-400 bg-gray-100 px-1.5 py-0.5 rounded">{field.section}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button onClick={(e) => { e.stopPropagation(); moveField(index, "up"); }}
                        disabled={index === 0} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                        <ArrowUp className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); moveField(index, "down"); }}
                        disabled={index === form.fields.length - 1} className="p-1 hover:bg-gray-100 rounded disabled:opacity-30">
                        <ArrowDown className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); duplicateField(index); }}
                        className="p-1 hover:bg-gray-100 rounded text-gray-400">
                        <Copy className="w-3 h-3" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); removeField(index); }}
                        className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                        <Trash2 className="w-3 h-3" />
                      </button>
                      {editingFieldIndex === index ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </div>

                  {/* Field Editor */}
                  <AnimatePresence>
                    {editingFieldIndex === index && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="overflow-hidden"
                      >
                        <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-3">
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">معرّف الحقل</label>
                              <input type="text" value={field.id}
                                onChange={(e) => updateFieldAt(index, { id: e.target.value })}
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs font-mono bg-gray-50" dir="ltr" />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">العنوان *</label>
                              <input type="text" value={field.label}
                                onChange={(e) => updateFieldAt(index, { label: e.target.value })}
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background" />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">النوع</label>
                              <select value={field.type}
                                onChange={(e) => updateFieldAt(index, { type: e.target.value as any })}
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background">
                                {FIELD_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">القسم</label>
                              <input type="text" value={field.section || ""}
                                onChange={(e) => updateFieldAt(index, { section: e.target.value })}
                                placeholder="info, content, evidence..."
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background" />
                            </div>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">نص توضيحي</label>
                              <input type="text" value={field.placeholder || ""}
                                onChange={(e) => updateFieldAt(index, { placeholder: e.target.value })}
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background" />
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">العمود</label>
                              <select value={field.gridCol || 1}
                                onChange={(e) => updateFieldAt(index, { gridCol: Number(e.target.value) })}
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background">
                                <option value={1}>1</option>
                                <option value={2}>2</option>
                                <option value={3}>3</option>
                              </select>
                            </div>
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">الصف</label>
                              <input type="number" value={field.gridRow || ""}
                                onChange={(e) => updateFieldAt(index, { gridRow: Number(e.target.value) || undefined })}
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background" />
                            </div>
                            {(field.type === "list" || field.type === "images") && (
                              <div>
                                <label className="text-[10px] font-medium text-gray-500 mb-1 block">أقصى عدد</label>
                                <input type="number" value={field.maxItems || ""}
                                  onChange={(e) => updateFieldAt(index, { maxItems: Number(e.target.value) || undefined })}
                                  className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background" />
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-4">
                            <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                              <input type="checkbox" checked={field.required || false}
                                onChange={(e) => updateFieldAt(index, { required: e.target.checked })}
                                className="rounded border-gray-300" />
                              مطلوب
                            </label>
                          </div>
                          {field.type === "select" && (
                            <div>
                              <label className="text-[10px] font-medium text-gray-500 mb-1 block">الخيارات (فاصل: فاصلة)</label>
                              <input type="text" value={(field.options || []).join(", ")}
                                onChange={(e) => updateFieldAt(index, { options: e.target.value.split(",").map(s => s.trim()).filter(Boolean) })}
                                placeholder="خيار1, خيار2, خيار3"
                                className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background" />
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "layout" && (
        <div className="space-y-4">
          {/* Layout Settings */}
          <Card>
            <CardHeader className="py-3 px-4">
              <CardTitle className="text-sm">إعدادات التخطيط</CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 space-y-3">
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">حجم الصفحة</label>
                  <select value={form.layout.pageSize || "A4"}
                    onChange={(e) => updateField("layout", { ...form.layout, pageSize: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background">
                    <option value="A4">A4</option>
                    <option value="letter">Letter</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">الاتجاه</label>
                  <select value={form.layout.direction || "rtl"}
                    onChange={(e) => updateField("layout", { ...form.layout, direction: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background">
                    <option value="rtl">من اليمين لليسار</option>
                    <option value="ltr">من اليسار لليمين</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">نمط الترويسة</label>
                  <select value={form.layout.headerStyle || "ministry"}
                    onChange={(e) => updateField("layout", { ...form.layout, headerStyle: e.target.value })}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background">
                    <option value="ministry">هوية وزارة التعليم</option>
                    <option value="simple">بسيط</option>
                    <option value="custom">مخصص</option>
                  </select>
                </div>
                <div>
                  <label className="text-[10px] font-medium text-gray-500 mb-1 block">الأعمدة</label>
                  <select value={form.layout.columns || 2}
                    onChange={(e) => updateField("layout", { ...form.layout, columns: Number(e.target.value) })}
                    className="w-full px-2 py-1.5 rounded border border-gray-200 text-xs bg-background">
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                </div>
              </div>
              <div className="flex items-center gap-4 flex-wrap">
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.layout.showSchoolName ?? true}
                    onChange={(e) => updateField("layout", { ...form.layout, showSchoolName: e.target.checked })}
                    className="rounded border-gray-300" />
                  اسم المدرسة
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.layout.showMinistryLogo ?? true}
                    onChange={(e) => updateField("layout", { ...form.layout, showMinistryLogo: e.target.checked })}
                    className="rounded border-gray-300" />
                  شعار الوزارة
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.layout.showSignatures ?? true}
                    onChange={(e) => updateField("layout", { ...form.layout, showSignatures: e.target.checked })}
                    className="rounded border-gray-300" />
                  التوقيعات
                </label>
                <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                  <input type="checkbox" checked={form.layout.showFooter ?? true}
                    onChange={(e) => updateField("layout", { ...form.layout, showFooter: e.target.checked })}
                    className="rounded border-gray-300" />
                  التذييل
                </label>
              </div>
            </CardContent>
          </Card>

          {/* Sections */}
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold">أقسام التقرير</h3>
            <Button size="sm" variant="outline" onClick={addSection} className="gap-1.5">
              <Plus className="w-3.5 h-3.5" />إضافة قسم
            </Button>
          </div>

          <div className="space-y-2">
            {form.layout.sections.map((section, sIndex) => (
              <Card key={section.id} className="overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b">
                  <GripVertical className="w-4 h-4 text-gray-300 shrink-0" />
                  <Badge variant="secondary" className="text-[9px]">
                    {SECTION_TYPES.find(t => t.value === section.type)?.label || section.type}
                  </Badge>
                  <input type="text" value={section.title}
                    onChange={(e) => updateSection(sIndex, { title: e.target.value })}
                    className="flex-1 px-2 py-1 rounded border border-gray-200 text-xs bg-white" />
                  <select value={section.type}
                    onChange={(e) => updateSection(sIndex, { type: e.target.value as any })}
                    className="px-2 py-1 rounded border border-gray-200 text-[10px] bg-white">
                    {SECTION_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
                  </select>
                  <select value={section.columns || 1}
                    onChange={(e) => updateSection(sIndex, { columns: Number(e.target.value) })}
                    className="w-14 px-1 py-1 rounded border border-gray-200 text-[10px] bg-white text-center">
                    <option value={1}>1</option>
                    <option value={2}>2</option>
                    <option value={3}>3</option>
                  </select>
                  <div className="flex items-center gap-0.5">
                    <button onClick={() => moveSection(sIndex, "up")} disabled={sIndex === 0}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    <button onClick={() => moveSection(sIndex, "down")} disabled={sIndex === form.layout.sections.length - 1}
                      className="p-1 hover:bg-gray-200 rounded disabled:opacity-30">
                      <ArrowDown className="w-3 h-3" />
                    </button>
                    <button onClick={() => removeSection(sIndex)}
                      className="p-1 hover:bg-red-50 rounded text-red-400 hover:text-red-600">
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Field Assignment */}
                {(section.type === "fields" || section.type === "content" || section.type === "images" || section.type === "signatures") && (
                  <div className="px-3 py-2">
                    <p className="text-[10px] text-gray-400 mb-1.5">الحقول المرتبطة:</p>
                    <div className="flex flex-wrap gap-1">
                      {form.fields.map(field => {
                        const isAssigned = (section.fieldIds || []).includes(field.id);
                        return (
                          <button key={field.id}
                            onClick={() => toggleFieldInSection(sIndex, field.id)}
                            className={`text-[10px] px-2 py-0.5 rounded-full border transition-all ${
                              isAssigned
                                ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
                                : 'bg-gray-50 text-gray-400 border-gray-200 hover:border-gray-300'
                            }`}>
                            {isAssigned && <Check className="w-2.5 h-2.5 inline ml-0.5" />}
                            {field.label}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            ))}
          </div>
        </div>
      )}

      {activeTab === "preview" && (
        <div className="space-y-4">
          <p className="text-xs text-muted-foreground">معاينة تقريبية لشكل القالب عند التعبئة</p>
          <div className="border rounded-xl overflow-hidden shadow-lg max-w-2xl mx-auto" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
            {/* Header Preview */}
            {form.layout.headerStyle === "ministry" && (
              <div className="bg-gradient-to-l from-emerald-700 to-emerald-900 text-white p-4 text-center">
                <p className="text-[10px] opacity-70">المملكة العربية السعودية</p>
                <p className="text-[10px] opacity-70">وزارة التعليم</p>
                <h3 className="text-sm font-bold mt-2">{form.name || "عنوان التقرير"}</h3>
              </div>
            )}

            {/* Sections Preview */}
            <div className="p-4 space-y-3 bg-white">
              {form.layout.sections.filter(s => s.type !== "header" && s.type !== "footer").map(section => {
                const sectionFields = form.fields.filter(f => (section.fieldIds || []).includes(f.id));
                if (sectionFields.length === 0 && section.type !== "signatures") return null;

                return (
                  <div key={section.id}>
                    <div className="rounded-lg p-2 mb-2" style={{ backgroundColor: "#05966915", borderRight: "3px solid #059669" }}>
                      <h4 className="text-xs font-bold text-emerald-700">{section.title}</h4>
                    </div>
                    <div className={`grid gap-2 ${section.columns === 3 ? 'grid-cols-3' : section.columns === 2 ? 'grid-cols-2' : 'grid-cols-1'}`}>
                      {sectionFields.map(field => (
                        <div key={field.id} className="border border-gray-200 rounded-lg p-2">
                          <p className="text-[10px] text-gray-500 mb-1">
                            {field.label} {field.required && <span className="text-red-500">*</span>}
                          </p>
                          <div className="bg-gray-50 rounded p-1.5 text-[10px] text-gray-400">
                            {field.type === "list" ? "• عنصر 1\n• عنصر 2" :
                             field.type === "images" ? "[صور]" :
                             field.type === "textarea" ? "نص طويل..." :
                             field.placeholder || "..."}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer Preview */}
            {form.layout.showFooter && (
              <div className="px-4 py-2 text-center text-[8px] bg-gray-50 text-gray-400 border-t">
                SERS - نظام السجلات التعليمية الذكي
              </div>
            )}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
        <Button onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}
          className="bg-emerald-600 hover:bg-emerald-700 gap-1.5">
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          {template.id ? "تحديث القالب" : "إنشاء القالب"}
        </Button>
      </div>
    </div>
  );
}
