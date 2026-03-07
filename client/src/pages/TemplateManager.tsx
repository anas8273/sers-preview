/**
 * لوحة إدارة القوالب والثيمات - SERS
 * CRUD كامل للقوالب مع معاينة حية وتحميل خلفيات وشعارات
 */
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLocation } from "wouter";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/_core/hooks/useAuth";
import {
  ArrowLeft, Plus, Trash2, Save, Edit3, Eye, Palette,
  Upload, Image, Check, X, Loader2, ChevronDown, ChevronUp,
  Copy, ToggleLeft, ToggleRight, Sparkles, FileText, Download,
  GripVertical, Settings2
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

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

export default function TemplateManager() {
  const [, navigate] = useLocation();
  const { user, isAuthenticated } = useAuth();
  const [editingTemplate, setEditingTemplate] = useState<TemplateData | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // tRPC queries
  const templatesQuery = trpc.templates.listAll.useQuery(undefined, {
    enabled: isAuthenticated && user?.role === "admin",
  });
  const createMutation = trpc.templates.create.useMutation();
  const updateMutation = trpc.templates.update.useMutation();
  const deleteMutation = trpc.templates.delete.useMutation();
  const seedMutation = trpc.templates.seed.useMutation();
  const utils = trpc.useUtils();

  // التحقق من صلاحيات الأدمن
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
          ...template,
        });
        toast.success("تم تحديث القالب بنجاح");
      } else {
        await createMutation.mutateAsync(template);
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

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/30 p-3 sm:p-4 md:p-8" dir="rtl">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
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
                <h1 className="text-xl font-bold" style={{ fontFamily: "var(--font-heading)" }}>إدارة القوالب</h1>
                <p className="text-xs text-muted-foreground">إنشاء وتعديل قوالب PDF والثيمات</p>
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
                className="bg-background rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-y-auto"
                onClick={(e) => e.stopPropagation()}
              >
                <TemplateEditor
                  template={editingTemplate || EMPTY_TEMPLATE}
                  onSave={handleSave}
                  onCancel={() => { setEditingTemplate(null); setIsCreating(false); }}
                  isSaving={createMutation.isPending || updateMutation.isPending}
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
            {templatesQuery.data.map((template: any) => (
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
                    <p className="text-xs text-muted-foreground mb-3 line-clamp-2">{template.description || "بدون وصف"}</p>

                    {/* Color Preview */}
                    <div className="flex items-center gap-1.5 mb-3">
                      <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.headerBg }} title="خلفية الرأس" />
                      <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.accent }} title="اللون المميز" />
                      <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.borderColor }} title="لون الحدود" />
                      <div className="w-5 h-5 rounded-full border-2 border-white shadow-sm" style={{ backgroundColor: template.bodyBg }} title="خلفية المحتوى" />
                      <span className="text-[10px] text-muted-foreground mr-auto" style={{ fontFamily: template.fontFamily }}>
                        {template.fontFamily}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1.5">
                      <Button variant="outline" size="sm" className="flex-1 text-xs h-8"
                        onClick={() => setEditingTemplate(template)}>
                        <Edit3 className="w-3 h-3 ml-1" />تعديل
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
            ))}
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
}: {
  template: TemplateData;
  onSave: (t: TemplateData) => void;
  onCancel: () => void;
  isSaving: boolean;
}) {
  const [form, setForm] = useState<TemplateData>({ ...template });

  const updateField = (field: keyof TemplateData, value: any) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Left: Form */}
        <div className="space-y-4">
          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">اسم القالب *</label>
            <input type="text" value={form.name} onChange={(e) => updateField("name", e.target.value)}
              placeholder="مثال: القالب الأخضر الرسمي"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">الوصف</label>
            <textarea value={form.description} onChange={(e) => updateField("description", e.target.value)}
              placeholder="وصف مختصر للقالب..."
              rows={2}
              className="w-full px-3 py-2 rounded-lg border border-border text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">خلفية الرأس</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.headerBg} onChange={(e) => updateField("headerBg", e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                <input type="text" value={form.headerBg} onChange={(e) => updateField("headerBg", e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono bg-background" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">نص الرأس</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.headerText} onChange={(e) => updateField("headerText", e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                <input type="text" value={form.headerText} onChange={(e) => updateField("headerText", e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono bg-background" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">اللون المميز</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.accent} onChange={(e) => updateField("accent", e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                <input type="text" value={form.accent} onChange={(e) => updateField("accent", e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono bg-background" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">لون الحدود</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.borderColor} onChange={(e) => updateField("borderColor", e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                <input type="text" value={form.borderColor} onChange={(e) => updateField("borderColor", e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono bg-background" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">خلفية المحتوى</label>
              <div className="flex items-center gap-2">
                <input type="color" value={form.bodyBg} onChange={(e) => updateField("bodyBg", e.target.value)}
                  className="w-8 h-8 rounded-lg border border-border cursor-pointer" />
                <input type="text" value={form.bodyBg} onChange={(e) => updateField("bodyBg", e.target.value)}
                  className="flex-1 px-2 py-1.5 rounded-lg border border-border text-xs font-mono bg-background" dir="ltr" />
              </div>
            </div>
            <div>
              <label className="text-xs font-medium text-muted-foreground mb-1 block">الخط</label>
              <select value={form.fontFamily} onChange={(e) => updateField("fontFamily", e.target.value)}
                className="w-full px-2 py-1.5 rounded-lg border border-border text-xs bg-background">
                {FONT_OPTIONS.map((f) => (
                  <option key={f.value} value={f.value}>{f.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">رابط صورة الغلاف (اختياري)</label>
            <input type="url" value={form.coverImageUrl} onChange={(e) => updateField("coverImageUrl", e.target.value)}
              placeholder="https://example.com/cover.jpg" dir="ltr"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
          </div>

          <div>
            <label className="text-xs font-medium text-muted-foreground mb-1 block">رابط الشعار (اختياري)</label>
            <input type="url" value={form.logoUrl} onChange={(e) => updateField("logoUrl", e.target.value)}
              placeholder="https://example.com/logo.png" dir="ltr"
              className="w-full px-3 py-2 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-background" />
          </div>

          <div className="flex items-center gap-4">
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
            {/* Cover Preview */}
            <div className="h-32 relative flex items-center justify-center" style={{ backgroundColor: form.headerBg }}>
              {form.coverImageUrl && (
                <img src={form.coverImageUrl} alt="" className="absolute inset-0 w-full h-full object-cover opacity-20" />
              )}
              <div className="relative text-center z-10">
                {form.logoUrl && <img src={form.logoUrl} alt="" className="w-10 h-10 rounded-lg mx-auto mb-2 object-contain bg-white/20 p-0.5" />}
                <h3 className="text-sm font-bold" style={{ color: form.headerText }}>شواهد الأداء الوظيفي</h3>
                <p className="text-[10px] mt-0.5" style={{ color: form.headerText + 'CC' }}>العام الدراسي 1447هـ</p>
              </div>
            </div>

            {/* Content Preview */}
            <div className="p-4 space-y-3" style={{ backgroundColor: form.bodyBg }}>
              {/* Section Header */}
              <div className="rounded-lg p-2.5" style={{ backgroundColor: form.accent + '15', borderRight: `3px solid ${form.accent}` }}>
                <h4 className="text-xs font-bold" style={{ color: form.accent }}>المعيار الأول: أداء الواجبات</h4>
              </div>

              {/* Evidence Card */}
              <div className="rounded-lg p-3 border" style={{ borderColor: form.borderColor, backgroundColor: form.bodyBg }}>
                <div className="flex items-center gap-2 mb-2">
                  <div className="w-5 h-5 rounded-full flex items-center justify-center text-[8px] font-bold text-white" style={{ backgroundColor: form.accent }}>1</div>
                  <span className="text-xs font-medium">البند 1.1: الالتزام بالحضور</span>
                </div>
                <div className="bg-gray-50 rounded p-2">
                  <p className="text-[10px] text-gray-600">نموذج شاهد - صورة أو نص أو رابط</p>
                </div>
              </div>

              {/* Score Table Preview */}
              <div className="rounded-lg overflow-hidden border" style={{ borderColor: form.borderColor }}>
                <div className="px-3 py-1.5 text-[10px] font-bold" style={{ backgroundColor: form.headerBg, color: form.headerText }}>
                  جدول التقييم
                </div>
                <div className="p-2 space-y-1">
                  <div className="flex justify-between text-[9px]">
                    <span>المعيار الأول</span>
                    <span className="font-bold" style={{ color: form.accent }}>4/5</span>
                  </div>
                  <div className="flex justify-between text-[9px]">
                    <span>المعيار الثاني</span>
                    <span className="font-bold" style={{ color: form.accent }}>5/5</span>
                  </div>
                </div>
              </div>
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
