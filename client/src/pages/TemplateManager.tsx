/**
 * لوحة إدارة القوالب والثيمات - SERS
 * CRUD كامل للقوالب مع معاينة حية وتحميل خلفيات وشعارات
 * + رفع صور مباشرة + أنماط الترويسة والحقول + نسخ القالب
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, Plus, Trash2, Save, Edit3, Palette,
  Upload, X, Loader2, Copy, ToggleLeft, ToggleRight,
  Sparkles, FileText, Settings2, ImageIcon, Layout
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TemplateLayoutConfig {
  headerStyle: number;
  fieldStyle: string;
}

interface TemplateData {
  id?: number;
  name: string;
  description: string;
  headerBg: string;
  headerText: string;
  accent: string;
  borderColor: string;
  bodyBg: string;
  fontFamily: string;
  coverImageUrl: string;
  logoUrl: string;
  templateLayout: TemplateLayoutConfig | null;
  isDefault: boolean;
  isActive: boolean;
  sortOrder: number;
}

const EMPTY_TEMPLATE: TemplateData = {
  name: "",
  description: "",
  headerBg: "#047857",
  headerText: "#FFFFFF",
  accent: "#059669",
  borderColor: "#D1FAE5",
  bodyBg: "#FFFFFF",
  fontFamily: "Tajawal",
  coverImageUrl: "",
  logoUrl: "",
  templateLayout: { headerStyle: 1, fieldStyle: "table" },
  isDefault: false,
  isActive: true,
  sortOrder: 0,
};

const FONT_OPTIONS = [
  { value: "Tajawal", label: "تجوال" },
  { value: "Cairo", label: "القاهرة" },
  { value: "Almarai", label: "المراعي" },
  { value: "IBM Plex Sans Arabic", label: "IBM Plex Arabic" },
  { value: "Noto Sans Arabic", label: "Noto Sans Arabic" },
  { value: "Amiri", label: "أميري" },
];

const HEADER_STYLES = [
  { value: 1, label: "نمط 1: يمين - وسط - يسار", desc: "الكتابة يمين، الشعار وسط، الفصل يسار" },
  { value: 2, label: "نمط 2: شعار يسار - كتابة يمين", desc: "الشعار يسار والكتابة يمين" },
  { value: 3, label: "نمط 3: بانر ملون", desc: "بانر ملون مع شعار وسط" },
  { value: 4, label: "نمط 4: أقسام كاملة", desc: "ترويسة بأقسام منفصلة" },
];

const FIELD_STYLES = [
  { value: "table", label: "جدول", desc: "حقول في جدول منظم" },
  { value: "cards", label: "بطاقات", desc: "بطاقات ملونة بالهوية" },
  { value: "fieldset", label: "إطارات", desc: "حقول بإطار وعنوان" },
  { value: "underlined", label: "مسطّر", desc: "حقول بخط سفلي" },
  { value: "minimal", label: "بسيط", desc: "حقول بإطار بسيط" },
];

export default function TemplateManager() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [isCreating, setIsCreating] = useState(false);

  const templatesQuery = trpc.templates.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const createMutation = trpc.templates.create.useMutation();
  const updateMutation = trpc.templates.update.useMutation();
  const deleteMutation = trpc.templates.delete.useMutation();
  const seedMutation = trpc.templates.seed.useMutation();
  const uploadMutation = trpc.templates.uploadImage.useMutation();
  const utils = trpc.useUtils();

  if (!isAuthenticated || user?.role !== "admin") {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Settings2 className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">صلاحيات غير كافية</h2>
            <p className="text-muted-foreground mb-4">هذه الصفحة متاحة للمسؤولين فقط.</p>
            <Button onClick={() => navigate("/performance-evidence")} variant="outline">
              <ArrowLeft className="w-4 h-4 ml-2" />العودة
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const handleSave = async (template: TemplateData) => {
    try {
      if (template.id) {
        await updateMutation.mutateAsync({
          id: template.id,
          name: template.name,
          description: template.description,
          headerBg: template.headerBg,
          headerText: template.headerText,
          accent: template.accent,
          borderColor: template.borderColor,
          bodyBg: template.bodyBg,
          fontFamily: template.fontFamily,
          coverImageUrl: template.coverImageUrl,
          logoUrl: template.logoUrl,
          templateLayout: template.templateLayout,
          isDefault: template.isDefault,
          isActive: template.isActive,
          sortOrder: template.sortOrder,
        });
        toast.success("تم تحديث القالب بنجاح");
      } else {
        await createMutation.mutateAsync({
          name: template.name,
          description: template.description,
          headerBg: template.headerBg,
          headerText: template.headerText,
          accent: template.accent,
          borderColor: template.borderColor,
          bodyBg: template.bodyBg,
          fontFamily: template.fontFamily,
          coverImageUrl: template.coverImageUrl,
          logoUrl: template.logoUrl,
          templateLayout: template.templateLayout,
          isDefault: template.isDefault,
          isActive: template.isActive,
          sortOrder: template.sortOrder,
        });
        toast.success("تم إنشاء القالب بنجاح");
      }
      setEditingTemplate(null);
      setIsCreating(false);
      utils.templates.listAll.invalidate();
      utils.templates.list.invalidate();
    } catch (err) {
      toast.error("فشل حفظ القالب");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("هل أنت متأكد من حذف هذا القالب؟")) return;
    try {
      await deleteMutation.mutateAsync({ id });
      toast.success("تم حذف القالب");
      utils.templates.listAll.invalidate();
      utils.templates.list.invalidate();
    } catch {
      toast.error("فشل حذف القالب");
    }
  };

  const handleSeedDefaults = async () => {
    try {
      await seedMutation.mutateAsync();
      toast.success("تم إضافة القوالب الافتراضية");
      utils.templates.listAll.invalidate();
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
      utils.templates.listAll.invalidate();
      utils.templates.list.invalidate();
      toast.success(template.isActive ? "تم تعطيل القالب" : "تم تفعيل القالب");
    } catch {
      toast.error("فشل تحديث حالة القالب");
    }
  };

  const handleDuplicate = (template: any) => {
    const copy: TemplateData = {
      name: `${template.name} (نسخة)`,
      description: template.description || "",
      headerBg: template.headerBg,
      headerText: template.headerText,
      accent: template.accent,
      borderColor: template.borderColor,
      bodyBg: template.bodyBg || "#FFFFFF",
      fontFamily: template.fontFamily || "Tajawal",
      coverImageUrl: template.coverImageUrl || "",
      logoUrl: template.logoUrl || "",
      templateLayout: template.templateLayout || { headerStyle: 1, fieldStyle: "table" },
      isDefault: false,
      isActive: true,
      sortOrder: (template.sortOrder || 0) + 1,
    };
    setEditingTemplate(copy);
    setIsCreating(true);
  };

  const handleUploadImage = async (file: File, imageType: 'cover' | 'logo' | 'background'): Promise<string> => {
    const reader = new FileReader();
    return new Promise((resolve, reject) => {
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const result = await uploadMutation.mutateAsync({
            fileName: file.name,
            mimeType: file.type,
            base64Data: base64,
            imageType,
          });
          resolve(result.url);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-3 sm:p-4 md:p-8" dir="rtl">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
          <div className="flex items-center gap-3">
            <button type="button" onClick={() => navigate("/performance-evidence")}
              className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors group">
              <ArrowLeft className="w-4 h-4 transition-transform group-hover:-translate-x-1" />
              <span className="text-sm">العودة</span>
            </button>
            <div className="h-6 w-px bg-border" />
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-700 flex items-center justify-center shadow-lg">
                <Palette className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>إدارة القوالب والثيمات</h1>
                <p className="text-xs text-muted-foreground">إنشاء وتعديل وتخصيص قوالب PDF والثيمات</p>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={handleSeedDefaults}
              disabled={seedMutation.isPending}>
              {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Sparkles className="w-4 h-4 ml-1" />}
              قوالب افتراضية
            </Button>
            <Button size="sm" onClick={() => { setEditingTemplate({ ...EMPTY_TEMPLATE }); setIsCreating(true); }}>
              <Plus className="w-4 h-4 ml-1" />قالب جديد
            </Button>
          </div>
        </div>

        {/* Template Editor Modal */}
        <AnimatePresence>
          {(editingTemplate || isCreating) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4"
              onClick={() => { setEditingTemplate(null); setIsCreating(false); }}
            >
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                className="bg-background rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <TemplateEditor
                  template={editingTemplate || EMPTY_TEMPLATE}
                  onSave={handleSave}
                  onCancel={() => { setEditingTemplate(null); setIsCreating(false); }}
                  isSaving={createMutation.isPending || updateMutation.isPending}
                  onUploadImage={handleUploadImage}
                  isUploading={uploadMutation.isPending}
                />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Templates List */}
        {templatesQuery.isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
          </div>
        ) : !templatesQuery.data || templatesQuery.data.length === 0 ? (
          <Card className="border-dashed">
            <CardContent className="p-12 text-center">
              <Palette className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">لا توجد قوالب</h3>
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
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {templatesQuery.data.map((template: any) => {
              const layout = template.templateLayout as TemplateLayoutConfig | null;
              return (
                <motion.div key={template.id} layout>
                  <Card className={`overflow-hidden transition-all hover:shadow-lg ${!template.isActive ? 'opacity-60' : ''}`}>
                    {/* Preview Header */}
                    <div className="h-24 relative" style={{ backgroundColor: template.headerBg }}>
                      {template.coverImageUrl && (
                        <img src={template.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-30" />
                      )}
                      <div className="absolute inset-0 flex items-center justify-center">
                        {template.logoUrl ? (
                          <img src={template.logoUrl} alt="" className="w-12 h-12 rounded-lg object-contain bg-white/20 p-1" />
                        ) : (
                          <FileText className="w-10 h-10" style={{ color: template.headerText }} />
                        )}
                      </div>
                      <div className="absolute top-2 left-2 flex items-center gap-1">
                        {template.isDefault && (
                          <Badge className="text-[9px] bg-yellow-500/90 text-white border-0">افتراضي</Badge>
                        )}
                        <Badge className={`text-[9px] border-0 ${template.isActive ? 'bg-green-500/90 text-white' : 'bg-gray-500/90 text-white'}`}>
                          {template.isActive ? 'مفعّل' : 'معطّل'}
                        </Badge>
                      </div>
                    </div>

                    <CardContent className="p-4">
                      <h3 className="font-bold text-sm mb-1">{template.name}</h3>
                      <p className="text-xs text-muted-foreground mb-2 line-clamp-2">{template.description || "بدون وصف"}</p>

                      {/* Layout Info */}
                      {layout && (
                        <div className="flex items-center gap-2 mb-2 text-[10px] text-muted-foreground">
                          <span className="bg-muted px-1.5 py-0.5 rounded">ترويسة: نمط {layout.headerStyle}</span>
                          <span className="bg-muted px-1.5 py-0.5 rounded">حقول: {FIELD_STYLES.find(f => f.value === layout.fieldStyle)?.label || layout.fieldStyle}</span>
                        </div>
                      )}

                      {/* Color Preview */}
                      <div className="flex items-center gap-1.5 mb-3">
                        <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.headerBg }} title="خلفية الرأس" />
                        <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.accent }} title="اللون المميز" />
                        <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.borderColor }} title="لون الحدود" />
                        <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.bodyBg || '#fff' }} title="خلفية المحتوى" />
                        <span className="text-[10px] text-muted-foreground mr-auto" style={{ fontFamily: template.fontFamily }}>
                          {template.fontFamily}
                        </span>
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-1.5">
                        <Button variant="outline" size="sm" className="flex-1 text-xs h-8"
                          onClick={() => setEditingTemplate({
                            ...template,
                            bodyBg: template.bodyBg || "#FFFFFF",
                            coverImageUrl: template.coverImageUrl || "",
                            logoUrl: template.logoUrl || "",
                            templateLayout: template.templateLayout || { headerStyle: 1, fieldStyle: "table" },
                          })}>
                          <Edit3 className="w-3 h-3 ml-1" />تعديل
                        </Button>
                        <Button variant="outline" size="sm" className="h-8 px-2" title="نسخ القالب"
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
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Image Upload Field =====
function ImageUploadField({
  label,
  value,
  onChange,
  onUpload,
  isUploading,
  imageType,
}: {
  label: string;
  value: string;
  onChange: (url: string) => void;
  onUpload: (file: File, type: 'cover' | 'logo' | 'background') => Promise<string>;
  isUploading: boolean;
  imageType: 'cover' | 'logo' | 'background';
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error("يرجى اختيار ملف صورة");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error("حجم الصورة يجب أن يكون أقل من 5MB");
      return;
    }
    try {
      const url = await onUpload(file, imageType);
      onChange(url);
      toast.success("تم رفع الصورة بنجاح");
    } catch {
      toast.error("فشل رفع الصورة");
    }
    if (fileRef.current) fileRef.current.value = '';
  }, [onUpload, imageType, onChange]);

  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
      <div className="flex items-center gap-2">
        <input
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="https://... أو ارفع صورة"
          dir="ltr"
          className="flex-1 px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background"
        />
        <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <Button
          variant="outline"
          size="sm"
          className="h-9 px-3"
          onClick={() => fileRef.current?.click()}
          disabled={isUploading}
        >
          {isUploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />}
        </Button>
        {value && (
          <div className="w-9 h-9 rounded-lg border border-border overflow-hidden shrink-0">
            <img src={value} alt="" className="w-full h-full object-cover" onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }} />
          </div>
        )}
      </div>
    </div>
  );
}

// ===== Template Editor Component =====
function TemplateEditor({
  template,
  onSave,
  onCancel,
  isSaving,
  onUploadImage,
  isUploading,
}: {
  template: TemplateData;
  onSave: (t: TemplateData) => void;
  onCancel: () => void;
  isSaving: boolean;
  onUploadImage: (file: File, type: 'cover' | 'logo' | 'background') => Promise<string>;
  isUploading: boolean;
}) {
  const [form, setForm] = useState<TemplateData>({
    ...template,
    templateLayout: template.templateLayout || { headerStyle: 1, fieldStyle: "table" },
  });
  const [activeTab, setActiveTab] = useState<'colors' | 'layout' | 'images'>('colors');

  const updateField = (field: keyof TemplateData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const updateLayout = (field: keyof TemplateLayoutConfig, value: any) => {
    setForm((prev) => ({
      ...prev,
      templateLayout: { ...(prev.templateLayout || { headerStyle: 1, fieldStyle: "table" }), [field]: value },
    }));
  };

  const layout = form.templateLayout || { headerStyle: 1, fieldStyle: "table" };

  return (
    <div className="p-6" dir="rtl">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Palette className="w-5 h-5 text-violet-500" />
          {template.id ? "تعديل القالب" : "إنشاء قالب جديد"}
        </h2>
        <button type="button" onClick={onCancel} className="text-muted-foreground hover:text-foreground">
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Basic Info */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم القالب *</label>
          <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)}
            placeholder="مثال: القالب الأخضر الرسمي"
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
        </div>
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-1 block">الوصف</label>
          <input type="text" value={form.description} onChange={(e) => updateField("description", e.target.value)}
            placeholder="وصف مختصر للقالب..."
            className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 mb-4 bg-muted/50 rounded-lg p-1">
        {[
          { id: 'colors' as const, label: 'الألوان والخطوط', icon: Palette },
          { id: 'layout' as const, label: 'التخطيط والأنماط', icon: Layout },
          { id: 'images' as const, label: 'الصور والشعارات', icon: ImageIcon },
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-md text-xs font-medium transition-all ${
              activeTab === tab.id ? 'bg-background shadow-sm text-foreground' : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            <tab.icon className="w-3.5 h-3.5" />
            {tab.label}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          {activeTab === 'colors' && (
            <>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { field: "headerBg" as const, label: "خلفية الرأس" },
                  { field: "headerText" as const, label: "نص الرأس" },
                  { field: "accent" as const, label: "اللون المميز" },
                  { field: "borderColor" as const, label: "لون الحدود" },
                  { field: "bodyBg" as const, label: "خلفية المحتوى" },
                ].map(({ field, label }) => (
                  <div key={field}>
                    <label className="text-xs font-medium text-muted-foreground mb-1 block">{label}</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={form[field] as string} onChange={(e) => updateField(field, e.target.value)}
                        className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                      <input type="text" value={form[field] as string} onChange={(e) => updateField(field, e.target.value)}
                        className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono bg-background" dir="ltr" />
                    </div>
                  </div>
                ))}
                <div>
                  <label className="text-xs font-medium text-muted-foreground mb-1 block">الخط</label>
                  <select value={form.fontFamily} onChange={(e) => updateField("fontFamily", e.target.value)}
                    className="w-full px-2 py-2 rounded-lg border border-border text-xs bg-background">
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>{f.label}</option>
                    ))}
                  </select>
                </div>
              </div>
            </>
          )}

          {activeTab === 'layout' && (
            <>
              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">نمط الترويسة</label>
                <div className="space-y-2">
                  {HEADER_STYLES.map(hs => (
                    <button
                      key={hs.value}
                      onClick={() => updateLayout("headerStyle", hs.value)}
                      className={`w-full text-right px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        layout.headerStyle === hs.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border hover:border-primary/30 text-muted-foreground'
                      }`}
                    >
                      <div className="font-medium text-xs">{hs.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">{hs.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="text-xs font-medium text-muted-foreground mb-2 block">نمط الحقول</label>
                <div className="grid grid-cols-2 gap-2">
                  {FIELD_STYLES.map(fs => (
                    <button
                      key={fs.value}
                      onClick={() => updateLayout("fieldStyle", fs.value)}
                      className={`text-right px-3 py-2.5 rounded-lg border text-sm transition-all ${
                        layout.fieldStyle === fs.value
                          ? 'border-primary bg-primary/5 text-foreground'
                          : 'border-border hover:border-primary/30 text-muted-foreground'
                      }`}
                    >
                      <div className="font-medium text-xs">{fs.label}</div>
                      <div className="text-[10px] mt-0.5 opacity-70">{fs.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {activeTab === 'images' && (
            <>
              <ImageUploadField
                label="صورة الغلاف / الخلفية (اختياري)"
                value={form.coverImageUrl}
                onChange={(url) => updateField("coverImageUrl", url)}
                onUpload={onUploadImage}
                isUploading={isUploading}
                imageType="cover"
              />
              <ImageUploadField
                label="شعار وزارة التعليم / المدرسة (اختياري)"
                value={form.logoUrl}
                onChange={(url) => updateField("logoUrl", url)}
                onUpload={onUploadImage}
                isUploading={isUploading}
                imageType="logo"
              />
            </>
          )}

          {/* Options */}
          <div className="flex items-center gap-4 pt-2 border-t border-border">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isDefault} onChange={(e) => updateField("isDefault", e.target.checked)}
                className="rounded border-border" />
              <span className="text-xs">قالب افتراضي</span>
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.isActive} onChange={(e) => updateField("isActive", e.target.checked)}
                className="rounded border-border" />
              <span className="text-xs">مفعّل</span>
            </label>
            <div className="flex items-center gap-1 mr-auto">
              <label className="text-xs text-muted-foreground">الترتيب:</label>
              <input type="number" value={form.sortOrder} onChange={(e) => updateField("sortOrder", Number(e.target.value))}
                className="w-16 px-2 py-1 rounded border border-border text-xs text-center bg-background" />
            </div>
          </div>
        </div>

        {/* Right: Live Preview */}
        <div>
          <label className="text-xs font-medium text-muted-foreground mb-2 block">معاينة حية</label>
          <div className="border border-border rounded-xl overflow-hidden shadow-lg" style={{ fontFamily: form.fontFamily }}>
            {/* Header Preview based on headerStyle */}
            <div className="relative" style={{ backgroundColor: form.headerBg }}>
              {form.coverImageUrl && (
                <img src={form.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
              )}
              {layout.headerStyle === 1 && (
                <div className="relative z-10 flex items-center justify-between px-4 py-3">
                  <div className="text-right">
                    <p className="text-[9px] font-bold" style={{ color: form.headerText }}>المملكة العربية السعودية</p>
                    <p className="text-[8px]" style={{ color: form.headerText + 'CC' }}>وزارة التعليم</p>
                    <p className="text-[8px]" style={{ color: form.headerText + 'CC' }}>الإدارة العامة للتعليم</p>
                  </div>
                  <div className="text-center">
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="" className="w-10 h-10 rounded-lg mx-auto object-contain bg-white/20 p-0.5" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mx-auto">
                        <FileText className="w-5 h-5" style={{ color: form.headerText }} />
                      </div>
                    )}
                  </div>
                  <div className="text-left">
                    <p className="text-[9px] font-bold" style={{ color: form.headerText }}>الفصل الدراسي: ...</p>
                    <p className="text-[8px]" style={{ color: form.headerText + 'CC' }}>العام الدراسي: ...</p>
                  </div>
                </div>
              )}
              {layout.headerStyle === 2 && (
                <div className="relative z-10 flex items-center justify-between px-4 py-3">
                  <div className="text-right flex-1">
                    <p className="text-[9px] font-bold" style={{ color: form.headerText }}>المملكة العربية السعودية</p>
                    <p className="text-[8px]" style={{ color: form.headerText + 'CC' }}>وزارة التعليم</p>
                  </div>
                  <div>
                    {form.logoUrl ? (
                      <img src={form.logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain bg-white/20 p-0.5" />
                    ) : (
                      <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center">
                        <FileText className="w-5 h-5" style={{ color: form.headerText }} />
                      </div>
                    )}
                  </div>
                </div>
              )}
              {layout.headerStyle === 3 && (
                <div className="relative z-10 text-center py-4">
                  {form.logoUrl ? (
                    <img src={form.logoUrl} alt="" className="w-10 h-10 rounded-lg mx-auto object-contain bg-white/20 p-0.5 mb-1" />
                  ) : (
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center mx-auto mb-1">
                      <FileText className="w-5 h-5" style={{ color: form.headerText }} />
                    </div>
                  )}
                  <p className="text-[10px] font-bold" style={{ color: form.headerText }}>شواهد الأداء الوظيفي</p>
                  <p className="text-[8px]" style={{ color: form.headerText + 'CC' }}>العام الدراسي 1447هـ</p>
                </div>
              )}
              {layout.headerStyle === 4 && (
                <div className="relative z-10 px-4 py-3">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-[9px] font-bold" style={{ color: form.headerText }}>المملكة العربية السعودية</p>
                    <p className="text-[9px] font-bold" style={{ color: form.headerText }}>الفصل الدراسي: ...</p>
                  </div>
                  <div className="text-center">
                    {form.logoUrl && <img src={form.logoUrl} alt="" className="w-8 h-8 rounded mx-auto object-contain bg-white/20 p-0.5" />}
                    <p className="text-[8px] mt-1" style={{ color: form.headerText + 'CC' }}>وزارة التعليم</p>
                  </div>
                </div>
              )}
            </div>

            {/* Content Preview */}
            <div className="p-4 space-y-3" style={{ backgroundColor: form.bodyBg }}>
              <div className="rounded-lg p-2.5" style={{ backgroundColor: form.accent + '15', borderRight: `3px solid ${form.accent}` }}>
                <h4 className="text-xs font-bold" style={{ color: form.accent }}>المعيار الأول: أداء الواجبات</h4>
              </div>

              {/* Field Style Preview */}
              {layout.fieldStyle === 'table' && (
                <div className="rounded-lg overflow-hidden border" style={{ borderColor: form.borderColor }}>
                  <table className="w-full text-[9px]">
                    <tbody>
                      <tr>
                        <td className="px-2 py-1.5 font-bold" style={{ backgroundColor: form.accent + '15', color: form.accent, width: '35%' }}>اسم المعلم</td>
                        <td className="px-2 py-1.5 bg-white">أحمد محمد</td>
                      </tr>
                      <tr>
                        <td className="px-2 py-1.5 font-bold border-t" style={{ backgroundColor: form.accent + '15', color: form.accent, borderColor: form.borderColor }}>المادة</td>
                        <td className="px-2 py-1.5 bg-white border-t" style={{ borderColor: form.borderColor }}>الرياضيات</td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              )}
              {layout.fieldStyle === 'cards' && (
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-lg p-2 border" style={{ borderColor: form.borderColor, background: `linear-gradient(135deg, ${form.accent}08, ${form.accent}15)` }}>
                    <div className="text-[8px] font-bold mb-0.5" style={{ color: form.accent }}>اسم المعلم</div>
                    <div className="text-[9px]">أحمد محمد</div>
                  </div>
                  <div className="rounded-lg p-2 border" style={{ borderColor: form.borderColor, background: `linear-gradient(135deg, ${form.accent}08, ${form.accent}15)` }}>
                    <div className="text-[8px] font-bold mb-0.5" style={{ color: form.accent }}>المادة</div>
                    <div className="text-[9px]">الرياضيات</div>
                  </div>
                </div>
              )}
              {(layout.fieldStyle === 'fieldset' || layout.fieldStyle === 'underlined' || layout.fieldStyle === 'minimal') && (
                <div className="grid grid-cols-2 gap-2">
                  <div className={`p-2 ${layout.fieldStyle === 'underlined' ? 'border-b-2' : 'border rounded-lg'}`} style={{ borderColor: form.accent + '50' }}>
                    <div className="text-[8px] font-bold mb-0.5" style={{ color: form.accent }}>اسم المعلم</div>
                    <div className="text-[9px]">أحمد محمد</div>
                  </div>
                  <div className={`p-2 ${layout.fieldStyle === 'underlined' ? 'border-b-2' : 'border rounded-lg'}`} style={{ borderColor: form.accent + '50' }}>
                    <div className="text-[8px] font-bold mb-0.5" style={{ color: form.accent }}>المادة</div>
                    <div className="text-[9px]">الرياضيات</div>
                  </div>
                </div>
              )}
            </div>

            {/* Footer Preview */}
            <div className="px-4 py-2 text-center text-[8px]" style={{ backgroundColor: form.headerBg + '15', color: form.accent }}>
              SERS - نظام السجلات التعليمية الذكي
            </div>
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-2 mt-6 pt-4 border-t border-border">
        <Button variant="outline" onClick={onCancel}>إلغاء</Button>
        <Button onClick={() => onSave(form)} disabled={isSaving || !form.name.trim()}>
          {isSaving ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Save className="w-4 h-4 ml-1" />}
          {template.id ? "تحديث" : "إنشاء"}
        </Button>
      </div>
    </div>
  );
}
