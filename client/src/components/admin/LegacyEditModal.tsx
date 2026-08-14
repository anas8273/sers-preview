/**
 * LegacyEditModal — Full-Screen Split-Screen Workspace
 * ═══════════════════════════════════════════════════════
 * نافذة تعديل القوالب الجاهزة بتصميم احترافي:
 *   • القسم الأيمن  (35%): لوحة تحكم مع 3 تبويبات (shadcn/ui Tabs) — قابل للتمرير
 *   • القسم الأيسر (65%): معاينة A4 كاملة 100% بدون قص — fixedScale محسوب من الحاوية الأم
 *
 * ملاحظة تقنية: A4PreviewFrame يحسب الـ scale من containerRef الداخلي فقط
 * (ارتفاعه = A4_HEIGHT * scale → circular dependency).
 * الحل: نحسب الـ scale هنا من previewPanelRef (الحاوية الأم الحقيقية)
 * ونمرره كـ fixedScale لـ A4PreviewFrame.
 */
import { useState, useEffect, useRef, useCallback } from 'react';

// A4 dimensions at 96 dpi
const A4W = 793.7;
const A4H = 1122.5;

/** يحسب scale ليناسب A4 داخل الحاوية الأم بالكامل — بدون قص */
function useParentScale(ref: React.RefObject<HTMLDivElement | null>) {
  const [scale, setScale] = useState(0.5);
  const recalc = useCallback(() => {
    const el = ref.current;
    if (!el) return;
    const pw = el.clientWidth  - 40; // padding 20px each side
    const ph = el.clientHeight - 40;
    if (pw <= 0 || ph <= 0) return;
    const sx = pw / A4W;
    const sy = ph / A4H;
    setScale(Math.max(0.15, Math.min(sx, sy)));
  }, [ref]);

  useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (ref.current) ro.observe(ref.current);
    return () => ro.disconnect();
  }, [recalc, ref]);

  return scale;
}
import {
  Palette, Layout, Save, Loader2, Upload,
  X, Image as ImageIcon, FileText, Edit3, PlusCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { toast } from 'sonner';
import A4PreviewFrame from '@/components/admin/A4PreviewFrame';
import TemplateRealisticPreview from '@/components/admin/TemplateRealisticPreview';
import FieldSchemaBuilder, { type SchemaField } from '@/components/admin/FieldSchemaBuilder';
import { getMoeLogoUrl } from '@/components/MoeLogo';

// ─── Types ────────────────────────────────
interface LegacyEditModalProps {
  template: any | null;
  onClose: () => void;
  onSave: (data: {
    id: number;
    colorFields: Record<string, any>;
    layoutFields: Record<string, any>;
    fieldsSchema: SchemaField[];
  }) => void;
  isSaving?: boolean;
}

// ─── Form State Init ──────────────────────
function initForm(t: any) {
  const layout = t?.templateLayout || {};
  return {
    name:            t?.name           || '',
    headerBg:        t?.headerBg       || '#1a6b6a',
    headerText:      t?.headerText     || '#ffffff',
    accent:          t?.accent         || '#059669',
    borderColor:     t?.borderColor    || '#e5e7eb',
    bodyBg:          t?.bodyBg         || '#ffffff',
    fieldStyle:      layout.fieldStyle    || 'fieldset',
    titleStyle:      layout.titleStyle    || 'rounded',
    signatureStyle:  layout.signatureStyle|| 'dotted',
    footerStyle:     layout.footerStyle   || 'gradient',
    logoUrl:         t?.logoUrl         || '',
    showLogo:        layout.showMoeLogo !== false,
    coverImageUrl:   t?.coverImageUrl   || '',
  };
}

function loadFields(t: any): SchemaField[] {
  const formSchema = t?.formSchema;
  if (formSchema?.sections?.[0]?.fields?.length > 0) {
    return formSchema.sections[0].fields.map((f: any) => ({
      id:          f.id,
      label:       f.label,
      type:        f.type        || 'text',
      required:    !!f.required,
      placeholder: f.placeholder || '',
      options:     f.options     || [],
      fontSize:    f.fontSize,
      color:       f.color,
      textAlign:   f.textAlign,
      fontWeight:  f.fontWeight,
      x: f.x,
      y: f.y,
    }));
  }
  return [];
}

// ═════════════════════════════════════════════════
// COMPONENT
// ═════════════════════════════════════════════════
export default function LegacyEditModal({ template, onClose, onSave, isSaving }: LegacyEditModalProps) {
  const [form, setForm]     = useState(initForm(template));
  const [fields, setFields] = useState<SchemaField[]>([]);

  const bgUploadRef   = { current: null as HTMLInputElement | null };
  const logoUploadRef = { current: null as HTMLInputElement | null };

  // Re-init form & fields whenever template changes
  useEffect(() => {
    if (template) {
      setForm(initForm(template));
      setFields(loadFields(template));
    }
  }, [template]);

  // ─── Image Upload Helpers ───────────────
  const handleImageUpload = (
    e: React.ChangeEvent<HTMLInputElement>,
    field: 'coverImageUrl' | 'logoUrl',
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error('الحجم الأقصى 10MB'); return; }
    const reader = new FileReader();
    reader.onload = () => {
      setForm(p => ({ ...p, [field]: reader.result as string }));
      toast.success(field === 'coverImageUrl' ? 'تم رفع صورة الخلفية' : 'تم رفع الشعار الجديد');
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  // ─── Save ──────────────────────────────
  const handleSave = () => {
    if (!template) return;
    const { fieldStyle, titleStyle, signatureStyle, footerStyle, logoUrl, showLogo, coverImageUrl, ...colorFields } = form;
    onSave({
      id: template.id,
      colorFields: { ...colorFields, logoUrl, coverImageUrl },
      layoutFields: { fieldStyle, titleStyle, signatureStyle, footerStyle, showMoeLogo: showLogo },
      fieldsSchema: fields,
    });
  };

  // ─── Live preview object ───────────────
  const liveTemplate = template ? {
    ...template,
    ...form,
    logoUrl:         form.logoUrl,
    coverImageUrl:   form.coverImageUrl,
    templateLayout: {
      ...(template.templateLayout || {}),
      fieldStyle:      form.fieldStyle,
      titleStyle:      form.titleStyle,
      signatureStyle:  form.signatureStyle,
      footerStyle:     form.footerStyle,
      showMoeLogo:     form.showLogo,
    },
  } : null;

  if (!template) return null;

  return (
    <Dialog open={!!template} onOpenChange={() => onClose()}>
      <DialogContent
        className="!max-w-[95vw] w-full !p-0 overflow-hidden border-0 shadow-2xl !rounded-xl"
        style={{ height: '95vh', maxHeight: '95vh' }}
        dir="rtl"
      >
        {/* Accessible labels */}
        <DialogTitle className="sr-only">تعديل القالب: {template?.name}</DialogTitle>
        <DialogDescription className="sr-only">نافذة تعديل القالب الجاهز مع معاينة مباشرة</DialogDescription>

        {/* ═══ Split Screen ═══ */}
        <div className="flex h-full overflow-hidden">

          {/* ══════════════════════════════════════════════════════════
               القسم الأيمن — لوحة التحكم (35%)
             ══════════════════════════════════════════════════════════ */}
          <div className="w-[35%] shrink-0 border-l border-gray-200 flex flex-col bg-white overflow-hidden">

            {/* Header Bar */}
            <div className="px-5 py-3.5 border-b border-gray-100 bg-gradient-to-l from-gray-50 to-white shrink-0">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-teal-600 shrink-0" />
                <h2 className="text-sm font-bold text-gray-900 truncate">{form.name || template?.name}</h2>
              </div>
              <p className="text-[10px] text-gray-400 mt-0.5">التغييرات تنعكس فوراً على المعاينة</p>
            </div>

            {/* ══ Tabs ══ */}
            <Tabs defaultValue="fields" className="flex-1 flex flex-col min-h-0">

              <TabsList className="w-full rounded-none border-b bg-gray-50 h-10 p-0 shrink-0">
                <TabsTrigger
                  value="fields"
                  className="flex-1 rounded-none text-[11px] font-bold h-full
                    data-[state=active]:bg-white data-[state=active]:text-blue-700
                    data-[state=active]:shadow-none data-[state=active]:border-b-2
                    data-[state=active]:border-blue-600"
                >
                  📋 إدارة الحقول
                  {fields.length > 0 && (
                    <span className="text-[8px] bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded-full mr-1.5">
                      {fields.length}
                    </span>
                  )}
                </TabsTrigger>
                <TabsTrigger
                  value="theme"
                  className="flex-1 rounded-none text-[11px] font-bold h-full
                    data-[state=active]:bg-white data-[state=active]:text-teal-700
                    data-[state=active]:shadow-none data-[state=active]:border-b-2
                    data-[state=active]:border-teal-600"
                >
                  🎨 الألوان والتخطيط
                </TabsTrigger>
                <TabsTrigger
                  value="media"
                  className="flex-1 rounded-none text-[11px] font-bold h-full
                    data-[state=active]:bg-white data-[state=active]:text-emerald-700
                    data-[state=active]:shadow-none data-[state=active]:border-b-2
                    data-[state=active]:border-emerald-600"
                >
                  🖼️ الشعار
                </TabsTrigger>
              </TabsList>

              {/* ══════════ TAB 1: إدارة الحقول ══════════ */}
              <TabsContent value="fields" className="flex-1 overflow-y-auto p-4 m-0">
                {/* Info banner */}
                <div className="mb-3 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg flex items-start gap-2">
                  <PlusCircle className="w-3.5 h-3.5 text-blue-500 mt-0.5 shrink-0" />
                  <div>
                    <p className="text-[10px] font-bold text-blue-700">إدارة حقول القالب الديناميكية</p>
                    <p className="text-[9px] text-blue-500 mt-0.5">
                      أضف، احذف، أو رتّب الحقول — يمكنك تعديل الاسم والنوع والإلزامية.
                      التغييرات تنعكس فوراً على المعاينة.
                    </p>
                  </div>
                </div>
                <FieldSchemaBuilder
                  fields={fields}
                  onChange={setFields}
                  isSaving={isSaving}
                  showPositioning={!!form.coverImageUrl}
                />
              </TabsContent>

              {/* ══════════ TAB 2: الألوان والتخطيط ══════════ */}
              <TabsContent value="theme" className="flex-1 overflow-y-auto p-4 m-0 space-y-4">

                {/* Template Name */}
                <div>
                  <label className="text-[11px] font-bold text-gray-600 block mb-1">اسم القالب</label>
                  <input
                    value={form.name}
                    onChange={e => setForm(p => ({ ...p, name: e.target.value }))}
                    className="w-full px-3 py-2 border rounded-lg text-sm focus:ring-2 focus:ring-teal-200 focus:outline-none"
                  />
                </div>

                {/* ── Color Section ── */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                    <Palette className="w-3.5 h-3.5 text-teal-500" />
                    ثيم الألوان
                  </p>

                  {/* Header Background — supports gradient */}
                  <div>
                    <label className="text-[10px] text-gray-500 block mb-0.5">خلفية الرأس (لون أو تدرج)</label>
                    <div className="flex items-center gap-2">
                      {!form.headerBg.startsWith('linear-gradient') && (
                        <input
                          type="color" value={form.headerBg}
                          onChange={e => setForm(p => ({ ...p, headerBg: e.target.value }))}
                          className="w-8 h-8 rounded border cursor-pointer p-0.5 shrink-0"
                        />
                      )}
                      <input
                        type="text" value={form.headerBg}
                        onChange={e => setForm(p => ({ ...p, headerBg: e.target.value }))}
                        placeholder="#1a6b6a أو linear-gradient(to left, #1a6b6a, #2ea87a)"
                        className="flex-1 px-2 py-1.5 bg-gray-50 rounded-lg border text-[10px] font-mono min-w-0"
                        dir="ltr"
                      />
                    </div>
                    {form.headerBg.startsWith('linear-gradient') && (
                      <div className="mt-1.5 h-5 rounded-md" style={{ background: form.headerBg }} />
                    )}
                  </div>

                  {/* Other 4 colors */}
                  {([
                    { label: 'نص الرأس',      key: 'headerText' },
                    { label: 'اللون الرئيسي', key: 'accent' },
                    { label: 'لون الحدود',    key: 'borderColor' },
                    { label: 'خلفية المحتوى', key: 'bodyBg' },
                  ] as const).map(({ label, key }) => (
                    <div key={key}>
                      <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
                      <div className="flex items-center gap-2">
                        <input
                          type="color" value={(form as any)[key]}
                          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                          className="w-8 h-8 rounded border cursor-pointer p-0.5 shrink-0"
                        />
                        <input
                          type="text" value={(form as any)[key]}
                          onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                          className="flex-1 px-2 py-1.5 bg-gray-50 rounded-lg border text-[10px] font-mono min-w-0"
                        />
                      </div>
                    </div>
                  ))}
                </div>

                {/* ── Layout Section ── */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                    <Layout className="w-3.5 h-3.5 text-blue-500" />
                    أنماط التخطيط
                  </p>
                  {([
                    { label: 'نمط الحقول',  key: 'fieldStyle',     options: [['fieldset','مؤطرة'],['table','جدول'],['cards','بطاقات'],['underlined','مسطرة'],['minimal','مبسطة']] },
                    { label: 'نمط العنوان', key: 'titleStyle',     options: [['rounded','مستدير'],['full-width','شريط كامل'],['bordered','محاط بإطار'],['underlined','خط سفلي'],['badge','شارة'],['simple','بسيط']] },
                    { label: 'نمط التوقيع', key: 'signatureStyle', options: [['dotted','منقط'],['solid','خط مستقيم'],['lined','خطوط'],['boxed','مربع'],['stamped','ختم'],['simple','بسيط']] },
                    { label: 'نمط التذييل', key: 'footerStyle',    options: [['gradient','تدرج'],['solid','صلب'],['line','خط'],['none','بدون']] },
                  ] as const).map(({ label, key, options }) => (
                    <div key={key}>
                      <label className="text-[10px] text-gray-500 block mb-0.5">{label}</label>
                      <select
                        value={(form as any)[key]}
                        onChange={e => setForm(p => ({ ...p, [key]: e.target.value }))}
                        className="w-full px-2 py-1.5 border rounded-lg text-xs bg-white focus:ring-2 focus:ring-blue-200 focus:outline-none"
                      >
                        {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </TabsContent>

              {/* ══════════ TAB 3: الشعار والخلفية ══════════ */}
              <TabsContent value="media" className="flex-1 overflow-y-auto p-4 m-0 space-y-5">

                {/* ── Logo Section ── */}
                <div className="space-y-3">
                  <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                    <FileText className="w-3.5 h-3.5 text-emerald-500" />
                    الشعار
                  </p>

                  {/* Show / Hide toggle */}
                  <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                    <label className="text-xs text-gray-600 font-medium">إظهار الشعار في القالب</label>
                    <button
                      onClick={() => setForm(p => ({ ...p, showLogo: !p.showLogo }))}
                      className={`w-10 h-6 rounded-full transition-all relative ${form.showLogo ? 'bg-teal-500' : 'bg-gray-300'}`}
                    >
                      <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${form.showLogo ? 'right-0.5' : 'right-[18px]'}`} />
                    </button>
                  </div>

                  {/* Logo preview card */}
                  {form.showLogo && (
                    <div className="flex items-center gap-3 p-3 bg-white rounded-xl border shadow-sm">
                      {/* Thumbnail */}
                      <div className="w-16 h-16 rounded-xl border-2 border-dashed border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                        <img
                          src={form.logoUrl || getMoeLogoUrl()}
                          alt="شعار"
                          className="w-full h-full object-contain p-1.5"
                        />
                      </div>

                      {/* Info + actions */}
                      <div className="flex-1 space-y-1.5">
                        <p className="text-[10px] text-gray-400 font-medium">
                          {form.logoUrl ? 'شعار مخصص' : 'شعار وزارة التعليم (افتراضي)'}
                        </p>
                        <div className="flex gap-1.5 flex-wrap">
                          <button
                            onClick={() => {
                              const input = document.createElement('input');
                              input.type = 'file'; input.accept = 'image/*';
                              input.onchange = (e) => handleImageUpload(e as any, 'logoUrl');
                              input.click();
                            }}
                            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-teal-50 text-teal-600 hover:bg-teal-100 border border-teal-200 transition-colors"
                          >
                            <Upload className="w-3 h-3" />
                            استبدال الشعار
                          </button>
                          {form.logoUrl && (
                            <button
                              onClick={() => setForm(p => ({ ...p, logoUrl: '' }))}
                              className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-500 hover:bg-red-100 border border-red-200 transition-colors"
                            >
                              <X className="w-3 h-3" />
                              إعادة الافتراضي
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                {/* ── Background Image Section ── */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
                    <ImageIcon className="w-3.5 h-3.5 text-blue-500" />
                    صورة خلفية القالب
                  </p>
                  <p className="text-[9px] text-gray-400 -mt-1">
                    ارفع صورة تصميم كخلفية — يمكنك وضع الحقول فوقها من تبويب "إدارة الحقول"
                  </p>

                  {form.coverImageUrl ? (
                    <div className="space-y-2">
                      <div className="rounded-xl border overflow-hidden" style={{ height: 120 }}>
                        <img src={form.coverImageUrl} alt="خلفية" className="w-full h-full object-cover" />
                      </div>
                      <div className="flex gap-1.5">
                        <button
                          onClick={() => {
                            const input = document.createElement('input');
                            input.type = 'file'; input.accept = 'image/*';
                            input.onchange = (e) => handleImageUpload(e as any, 'coverImageUrl');
                            input.click();
                          }}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 border border-blue-200 hover:bg-blue-100 transition-colors"
                        >
                          <Upload className="w-3 h-3" />تغيير الصورة
                        </button>
                        <button
                          onClick={() => setForm(p => ({ ...p, coverImageUrl: '' }))}
                          className="flex-1 flex items-center justify-center gap-1 px-2 py-1.5 rounded-lg text-[10px] font-bold bg-red-50 text-red-500 border border-red-200 hover:bg-red-100 transition-colors"
                        >
                          <X className="w-3 h-3" />إزالة
                        </button>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => {
                        const input = document.createElement('input');
                        input.type = 'file'; input.accept = 'image/*';
                        input.onchange = (e) => handleImageUpload(e as any, 'coverImageUrl');
                        input.click();
                      }}
                      className="w-full h-24 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 text-gray-400 hover:border-teal-400 hover:text-teal-500 hover:bg-teal-50/30 transition-all cursor-pointer"
                    >
                      <Upload className="w-5 h-5" />
                      <span className="text-[10px] font-medium">رفع صورة تصميم (PNG / JPG / WebP)</span>
                      <span className="text-[8px] text-gray-300">الحجم الأقصى 10MB</span>
                    </button>
                  )}
                </div>
              </TabsContent>
            </Tabs>

            {/* ══ Save Button (always visible at bottom) ══ */}
            <div className="px-4 py-3 border-t bg-gray-50 shrink-0">
              <Button
                className="w-full bg-teal-600 hover:bg-teal-700 gap-1.5 h-10"
                onClick={handleSave}
                disabled={isSaving}
              >
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ جميع التعديلات
              </Button>
            </div>
          </div>

          {/* ══════════════════════════════════════════════════════
               القسم الأيسر — منطقة المعاينة A4 (65%)
               A4PreviewFrame يحسب التحجيم تلقائياً بناءً على حجم الحاوية
             ══════════════════════════════════════════════════════ */}
          <div className="flex-1 bg-[#e8eaed] flex items-center justify-center overflow-hidden p-5">
            {liveTemplate && (
              /*
               * A4PreviewFrame بدون fixedScale → يحسب الـ scale تلقائياً
               * بحيث يتناسب مع عرض وارتفاع الحاوية الأب بالكامل
               */
              <A4PreviewFrame showShadow>
                <TemplateRealisticPreview
                  template={liveTemplate}
                  scale={1}
                  dynamicFields={
                    fields.length > 0
                      ? fields.map(f => ({ id: f.id, label: f.label, type: f.type }))
                      : undefined
                  }
                />
              </A4PreviewFrame>
            )}
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
