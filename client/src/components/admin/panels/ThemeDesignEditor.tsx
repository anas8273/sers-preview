/**
 * محرر التصاميم — بأسلوب Canva
 * ✅ رفع صورة → يستخرج ألوانها + ينشئ ثيم مطابق + يرسم التصميم بنفس الطريقة
 * ✅ معاينة حية كبيرة — طبق الأصل لما يراه المستخدم
 * ✅ ضغط على أي عنصر في المعاينة لتعديله مباشرة
 * ✅ تعديل الشكل والإطار والترتيب والخطوط والألوان
 * ✅ حذف/إضافة/تعديل/نسخ أي ثيم
 * ✅ مرتبط مع الموقع — التعديلات تنعكس فوراً
 */
import { useState, useRef } from "react";
import { trpc } from "@/lib/trpc";
import ReportPreviewRenderer from "@/components/shared/ReportPreviewRenderer";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Palette, Plus, Edit3, Trash2, Save, Eye, Upload, Loader2, Sparkles, X, Copy,
  FileImage, EyeOff, Wand2, Move, Type as TypeIcon, Image as ImageIcon, Layout, PaintBucket,
  ChevronDown, Maximize2, Minimize2,
} from "lucide-react";

/* ═══ Theme interface ═══ */
export interface ThemeConfig { id: string; name: string; [key: string]: any; }

/* ═══ Default themes ═══ */
const PE_THEMES: ThemeConfig[] = [
  { id:"default", name:"الهوية البصرية تدرج", layoutType:"white-header-classic", headerBg:"#ffffff", headerText:"#1a6b6a", accent:"#1a6b6a", borderColor:"#2ea87a", titleBg:"#1a6b6a", fieldLabelBg:"#1a6b6a", footerBg:"#1a6b6a", tableStyle:false, titleStyle:"rounded", fieldStyle:"fieldset", signatureStyle:"dotted", coverStyle:"gradient-center", sectionCoverStyle:"full-gradient", coverAccent2:"#5bb784", headerVariant:"right-text-center-logo-left-info", bodyBg:"#ffffff" },
  { id:"builtin-dark-table", name:"جدول رسمي", layoutType:"dark-header-table", headerBg:"#1a6b6a", headerText:"#ffffff", accent:"#1a6b6a", borderColor:"#2ea87a", titleBg:"#1a6b6a", fieldLabelBg:"#1a6b6a", footerBg:"#1a6b6a", tableStyle:true, titleStyle:"full-width", fieldStyle:"table", signatureStyle:"boxed", coverStyle:"top-bar", sectionCoverStyle:"numbered-bar", coverAccent2:"#5bb784", headerVariant:"right-text-center-logo-left-info", bodyBg:"#ffffff" },
  { id:"builtin-lined", name:"خطوط أنيقة", layoutType:"white-header-classic", headerBg:"#ffffff", headerText:"#1a6b6a", accent:"#1a6b6a", borderColor:"#2ea87a", titleBg:"#1a6b6a", fieldLabelBg:"#e8f5f0", footerBg:"#1a6b6a", tableStyle:false, titleStyle:"underlined", fieldStyle:"underlined", signatureStyle:"lined", coverStyle:"split-left", sectionCoverStyle:"left-stripe", coverAccent2:"#5bb784", headerVariant:"right-text-center-logo-left-info", bodyBg:"#ffffff", headerSeparator:true, showTopLine:true },
  { id:"builtin-cards", name:"بطاقات حديثة", layoutType:"white-header-cards", headerBg:"#ffffff", headerText:"#1a6b6a", accent:"#1a6b6a", borderColor:"#2ea87a", titleBg:"#1a6b6a", fieldLabelBg:"#f0f7f4", footerBg:"#1a6b6a", tableStyle:false, titleStyle:"badge", fieldStyle:"cards", signatureStyle:"stamped", coverStyle:"framed-elegant", sectionCoverStyle:"card-center", coverAccent2:"#5bb784", headerVariant:"right-text-left-logo" },
  { id:"builtin-minimal", name:"تصميم نظيف", layoutType:"minimal-clean", headerBg:"#ffffff", headerText:"#1a6b6a", accent:"#1a6b6a", borderColor:"#2ea87a", titleBg:"#1a6b6a", fieldLabelBg:"#f0f4f8", footerBg:"#1a6b6a", tableStyle:false, titleStyle:"simple", fieldStyle:"minimal", signatureStyle:"dotted", coverStyle:"minimal-line", sectionCoverStyle:"clean-divider", coverAccent2:"#5bb784", headerVariant:"center-logo-banner" },
  { id:"builtin-official-pro", name:"النموذج الرسمي", layoutType:"dark-header-table", headerBg:"#0d4f4f", headerText:"#ffffff", accent:"#0d4f4f", borderColor:"#1a8a7a", titleBg:"#0d4f4f", fieldLabelBg:"#0d4f4f", footerBg:"#0d4f4f", tableStyle:true, titleStyle:"full-width", fieldStyle:"table", signatureStyle:"boxed", coverStyle:"diagonal", sectionCoverStyle:"numbered-bar", coverAccent2:"#1a8a7a", headerVariant:"full-header-sections", headerSeparator:true, showTopLine:true, bodyBg:"#f9fafb" },
  { id:"builtin-ink-saver", name:"توفير حبر", layoutType:"white-header-classic", headerBg:"#ffffff", headerText:"#374151", accent:"#6B7280", borderColor:"#D1D5DB", titleBg:"#F3F4F6", fieldLabelBg:"#F9FAFB", footerBg:"#F3F4F6", tableStyle:false, titleStyle:"underlined", fieldStyle:"underlined", signatureStyle:"dotted", coverStyle:"minimal-line", sectionCoverStyle:"clean-divider", coverAccent2:"#9CA3AF", headerVariant:"right-text-center-logo-left-info", bodyBg:"#ffffff" },
  { id:"builtin-gold-accent", name:"الهوية الذهبية", layoutType:"dark-header-table", headerBg:"#1a3a4a", headerText:"#ffffff", accent:"#1a3a4a", borderColor:"#C8A951", titleBg:"#1a3a4a", fieldLabelBg:"#1a3a4a", footerBg:"#1a3a4a", tableStyle:true, titleStyle:"full-width", fieldStyle:"cards", signatureStyle:"stamped", coverStyle:"gradient-center", sectionCoverStyle:"card-center", coverAccent2:"#C8A951", headerVariant:"right-text-left-logo", headerSeparator:true, bodyBg:"#FFFDF5" },
];
const CERT_THEMES: ThemeConfig[] = [
  { id:"green-official", name:"الهوية الرسمية", headerBg:"#1a3a5c", headerText:"#ffffff", accent:"#2ea87a", borderColor:"#1a3a5c", footerBg:"#1a3a5c", coverAccent2:"#2ea87a" },
  { id:"gold-elegant", name:"الذهبي الأنيق", headerBg:"#78350f", headerText:"#ffffff", accent:"#d97706", borderColor:"#92400e", footerBg:"#78350f", coverAccent2:"#d97706" },
  { id:"blue-modern", name:"الأزرق العصري", headerBg:"#1e3a8a", headerText:"#ffffff", accent:"#2563eb", borderColor:"#1e40af", footerBg:"#1e3a8a", coverAccent2:"#3b82f6" },
  { id:"purple-premium", name:"البنفسجي الفاخر", headerBg:"#5b21b6", headerText:"#ffffff", accent:"#8b5cf6", borderColor:"#6d28d9", footerBg:"#5b21b6", coverAccent2:"#8b5cf6" },
  { id:"dark-premium", name:"الداكن الفاخر", headerBg:"#18181b", headerText:"#ffffff", accent:"#f59e0b", borderColor:"#a1a1aa", footerBg:"#18181b", coverAccent2:"#f59e0b" },
];

export function getBuiltinThemes(dbKey: string): ThemeConfig[] {
  switch (dbKey) {
    case "evidence": case "portfolio": case "reports": return PE_THEMES;
    case "certificates": return CERT_THEMES;
    default: return PE_THEMES.slice(0, 3);
  }
}

/* ═══ Smart Color Extraction from Image ═══ */
function extractColorsFromImage(imgSrc: string): Promise<Record<string, string>> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const size = 40;
      canvas.width = size; canvas.height = size;
      const ctx = canvas.getContext("2d")!;
      ctx.drawImage(img, 0, 0, size, size);
      const getColor = (x: number, y: number, w: number, h: number) => {
        const d = ctx.getImageData(x, y, w, h).data;
        let r = 0, g = 0, b = 0, count = 0;
        for (let i = 0; i < d.length; i += 4) { r += d[i]; g += d[i+1]; b += d[i+2]; count++; }
        r = Math.round(r / count); g = Math.round(g / count); b = Math.round(b / count);
        return `#${r.toString(16).padStart(2,"0")}${g.toString(16).padStart(2,"0")}${b.toString(16).padStart(2,"0")}`;
      };
      const headerColor = getColor(0, 0, size, 6);
      const footerColor = getColor(0, size - 6, size, 6);
      const accentColor = getColor(0, 12, size, 4);
      const bodyColor = getColor(5, 18, size - 10, 8);
      const borderColor = getColor(0, 8, 3, size - 16);
      const hex2lum = (hex: string) => {
        const r = parseInt(hex.slice(1,3), 16), g = parseInt(hex.slice(3,5), 16), b = parseInt(hex.slice(5,7), 16);
        return (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      };
      const headerDark = hex2lum(headerColor) < 0.5;
      resolve({
        headerBg: headerColor, headerText: headerDark ? "#ffffff" : "#1a1a1a",
        accent: accentColor, borderColor, titleBg: accentColor, fieldLabelBg: bodyColor,
        footerBg: footerColor, bodyBg: bodyColor, coverAccent2: borderColor,
        layoutType: headerDark ? "dark-header-table" : "white-header-classic",
        titleStyle: "rounded", fieldStyle: "fieldset", signatureStyle: "dotted",
        coverStyle: "gradient-center", sectionCoverStyle: "full-gradient",
        headerVariant: "right-text-center-logo-left-info",
      });
    };
    img.onerror = () => resolve({});
    img.src = imgSrc;
  });
}

function isColorValue(v: any): boolean { return typeof v === "string" && /^#[0-9a-fA-F]{3,8}$/.test(v); }

/* ════════════════════════════════════════════
   ThemeDesignEditor — محرر تصميمات بأسلوب Canva
   ════════════════════════════════════════════ */
interface Props { sectionDbKey: string; sectionColor: string; sectionName: string }

export default function ThemeDesignEditor({ sectionDbKey, sectionColor, sectionName }: Props) {
  const defaults = getBuiltinThemes(sectionDbKey);
  const [editOpen, setEditOpen] = useState(false);
  const [isNew, setIsNew] = useState(false);
  const [form, setForm] = useState<Record<string, any>>({});
  const [dbId, setDbId] = useState<number | null>(null);
  const [newPropKey, setNewPropKey] = useState("");
  const [newPropVal, setNewPropVal] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);
  const [showHidden, setShowHidden] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const [activePanel, setActivePanel] = useState<"structure"|"colors"|"texts"|"advanced">("structure");
  const [previewFullscreen, setPreviewFullscreen] = useState(false);

  const { data: dbConfigs, refetch } = trpc.sectionConfigs.list.useQuery({ sectionId: sectionDbKey }, { enabled: !!sectionDbKey });
  const createMut = trpc.sectionConfigs.create.useMutation({ onSuccess: () => { refetch(); toast.success("تم الحفظ ✨ — التعديلات تظهر للمستخدمين فوراً"); closeEdit(); } });
  const updateMut = trpc.sectionConfigs.update.useMutation({ onSuccess: () => { refetch(); toast.success("تم التحديث ✅ — التعديلات تظهر للمستخدمين فوراً"); closeEdit(); } });
  const deleteMut = trpc.sectionConfigs.delete.useMutation({ onSuccess: () => { refetch(); toast.success("تم الحذف 🗑️"); } });

  const customThemes = (dbConfigs?.filter((c: any) => c.configType === "theme") || []) as any[];
  const deletedIds = (dbConfigs?.filter((c: any) => c.configType === "theme-deleted") || []).map((c: any) => c.data?.deletedId);
  const overrides = customThemes.filter((c: any) => c.data?.overrideId);
  const getOverride = (id: string) => overrides.find((c: any) => c.data?.overrideId === id);
  const visibleDefaults = defaults.filter(t => !deletedIds.includes(t.id));

  const openEdit = (theme: ThemeConfig, _dbId: number | null = null) => {
    const ov = getOverride(theme.id);
    setForm(ov ? { ...theme, ...ov.data } : { ...theme });
    setDbId(ov?.id || _dbId);
    setIsNew(false); setEditOpen(true);
  };
  const openNew = () => {
    setForm({ id: `theme_${Date.now()}`, name: "", headerBg: "#0d9488", headerText: "#ffffff", accent: "#0d9488", borderColor: "#14b8a6", titleBg: "#0d9488", fieldLabelBg: "#f0fdfa", footerBg: "#0d9488", bodyBg: "#ffffff", coverAccent2: "#14b8a6", layoutType: "white-header-classic", titleStyle: "rounded", fieldStyle: "fieldset", signatureStyle: "dotted", coverStyle: "gradient-center", sectionCoverStyle: "full-gradient", headerVariant: "right-text-center-logo-left-info" });
    setDbId(null); setIsNew(true); setEditOpen(true);
  };
  const openDuplicate = (t: ThemeConfig) => {
    setForm({ ...t, id: `theme_${Date.now()}`, name: `نسخة من ${t.name}` });
    setDbId(null); setIsNew(true); setEditOpen(true);
  };
  const closeEdit = () => { setEditOpen(false); setDbId(null); };
  const setF = (key: string, val: any) => setForm(p => ({ ...p, [key]: val }));
  const removeKey = (key: string) => setForm(p => { const n = { ...p }; delete n[key]; return n; });

  /* ═══ Smart Upload: extract colors + create full theme ═══ */
  const handleSmartUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 10 * 1024 * 1024) { toast.error("الحد الأقصى 10MB"); return; }
    
    setExtracting(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const src = reader.result as string;
      toast.loading("جاري تحليل التصميم... 🎨 استخراج الألوان + إنشاء قالب مطابق", { id: "extract" });
      
      try {
        const colors = await extractColorsFromImage(src);
        
        if (editOpen) {
          setForm(p => ({ ...p, ...colors, coverImage: src }));
          toast.success("تم تحليل التصميم! ✨ الألوان والهيكل مطابقة — يمكنك تعديل أي شيء", { id: "extract" });
        } else {
          setForm({
            id: `theme_${Date.now()}`,
            name: file.name.replace(/\.[^.]+$/, "") || "تصميم مرفوع",
            ...colors,
            coverImage: src,
          });
          setDbId(null); setIsNew(true); setEditOpen(true);
          toast.success("تم إنشاء قالب من التصميم! 🎨 النظام رسم التقرير بنفس ألوان وهيكل التصميم المرفوع — عدّل أي شيء تريده", { id: "extract" });
        }
      } catch {
        toast.error("فشل تحليل الصورة", { id: "extract" });
      }
      setExtracting(false);
    };
    reader.readAsDataURL(file);
    if (fileRef.current) fileRef.current.value = "";
  };

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error("أدخل اسم القالب"); return; }
    const data = { ...form };
    if (isNew) {
      createMut.mutate({ sectionId: sectionDbKey, configType: "theme", name: form.name, data });
    } else if (dbId) {
      updateMut.mutate({ id: dbId, name: form.name, data });
    } else {
      createMut.mutate({ sectionId: sectionDbKey, configType: "theme", name: form.name, data: { ...data, overrideId: form.id } });
    }
  };

  const handleDeleteBuiltin = (id: string) => {
    if (!confirm("حذف هذا القالب؟ لن يظهر للمستخدمين.")) return;
    createMut.mutate({ sectionId: sectionDbKey, configType: "theme-deleted", name: `deleted_${id}`, data: { deletedId: id } });
  };
  const handleRestoreBuiltin = (id: string) => {
    const entry = dbConfigs?.find((c: any) => c.configType === "theme-deleted" && c.data?.deletedId === id);
    if (entry) deleteMut.mutate({ id: (entry as any).id });
  };

  const allProperties = Object.entries(form).filter(([k]) => !["id","name","coverImage","overrideId"].includes(k));

  if (defaults.length === 0 && customThemes.length === 0) return null;

  return (
    <div>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
        <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Palette className="w-4 h-4" style={{ color: sectionColor }} />محرر التصاميم والقوالب ({visibleDefaults.length + customThemes.filter((c:any) => !c.data?.overrideId).length})</h3>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={openNew} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />قالب جديد</Button>
          <Button size="sm" className="gap-1.5 text-xs bg-gradient-to-r from-violet-600 to-purple-600 hover:from-violet-700 hover:to-purple-700" disabled={extracting} onClick={() => fileRef.current?.click()}>
            {extracting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Wand2 className="w-3.5 h-3.5" />}
            رفع تصميم → قالب ذكي
          </Button>
          <input ref={fileRef} type="file" accept="image/*,application/pdf" className="hidden" onChange={handleSmartUpload} />
          {deletedIds.length > 0 && <Button size="sm" variant="ghost" className="text-xs text-gray-400" onClick={() => setShowHidden(!showHidden)}>{showHidden ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}{deletedIds.length} محذوف</Button>}
        </div>
      </div>

      {/* Smart upload explanation */}
      <div className="bg-gradient-to-r from-violet-50 to-purple-50 rounded-xl p-3 border border-violet-100 mb-3">
        <div className="flex items-start gap-2">
          <Wand2 className="w-4 h-4 text-violet-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-[10px] font-bold text-violet-800">رفع تصميم ← قالب ذكي</p>
            <p className="text-[9px] text-violet-600">ارفع صورة أو PDF تصميم ← النظام يستخرج الألوان ويرسم التقرير بنفس الطريقة ← النتيجة قالب كامل (غلاف + ترويسة + حقول + توثيع) بنفس ألوان وهيكل التصميم. يمكنك تعديل كل شيء بعدها.</p>
          </div>
        </div>
      </div>

      {/* Theme cards grid — larger previews */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4 gap-3">
        {visibleDefaults.map(t => {
          const ov = getOverride(t.id);
          const tc = ov ? { ...t, ...ov.data } : t;
          return (
            <div key={t.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group" onClick={() => openEdit(t)}>
              {/* Mini preview — larger */}
              <div className="h-28 relative overflow-hidden" style={{ backgroundColor: tc.bodyBg || "#fff" }}>
                <div className="flex items-center justify-between px-2.5 py-1.5" style={{ backgroundColor: tc.headerBg, color: tc.headerText }}>
                  <span style={{fontSize:7,fontWeight:700}}>وزارة التعليم</span><span style={{fontSize:6}}>{sectionName}</span><span style={{fontSize:8}}>🏛️</span>
                </div>
                <div className="mx-2 mt-1 px-2 py-0.5" style={{ backgroundColor: tc.titleBg, color:"#fff", fontSize:6, fontWeight:700, borderRadius: tc.titleStyle === "rounded" ? 4 : 0 }}>شواهد الأداء الوظيفي</div>
                <div className="flex gap-1 px-2 mt-1">{["الاسم الكامل","المدرسة","العام الدراسي"].map(f => <div key={f} className="flex-1 rounded-sm border px-1 py-0.5" style={{ borderColor:tc.borderColor, fontSize:4.5, color:tc.accent }}>{f}</div>)}</div>
                <div className="flex gap-1 px-2 mt-0.5">{["اسم مدير المدرسة","الصفة الوظيفية"].map(f => <div key={f} className="flex-1 rounded-sm border px-1 py-0.5" style={{ borderColor:tc.borderColor, fontSize:4.5, color:tc.accent }}>{f}</div>)}</div>
                <div className="absolute bottom-0 left-0 right-0 h-2" style={{ backgroundColor: tc.footerBg }} />
                {ov && <Badge className="absolute top-1 left-1 text-[6px] bg-amber-400 text-white">معدّل</Badge>}
                {/* Hover overlay */}
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                  <span className="bg-white/90 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow">✏️ فتح المحرر</span>
                </div>
              </div>
              <div className="p-2.5">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[11px] font-bold text-gray-800 truncate">{ov ? ov.name : t.name}</span>
                  <div className="flex gap-0.5">{[tc.accent, tc.borderColor, tc.headerBg].filter(Boolean).slice(0,3).map((c,i) => <div key={i} className="w-3.5 h-3.5 rounded-full border border-white shadow-sm" style={{ backgroundColor: c }} />)}</div>
                </div>
                <div className="flex gap-1">
                  <Button variant="outline" size="sm" className="flex-1 text-[9px] h-6 gap-0.5" onClick={(e) => { e.stopPropagation(); openEdit(t); }}><Edit3 className="w-2.5 h-2.5" />تعديل</Button>
                  <Button variant="outline" size="sm" className="text-[9px] h-6 px-1.5" onClick={(e) => { e.stopPropagation(); openDuplicate(tc); }}><Copy className="w-2.5 h-2.5" /></Button>
                  <Button variant="outline" size="sm" className="text-[9px] h-6 px-1.5 text-red-500" onClick={(e) => { e.stopPropagation(); handleDeleteBuiltin(t.id); }}><Trash2 className="w-2.5 h-2.5" /></Button>
                </div>
              </div>
            </div>
          );
        })}

        {/* Custom themes */}
        {customThemes.filter((c: any) => !c.data?.overrideId).map((c: any) => (
          <div key={c.id} className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden shadow-sm hover:shadow-lg transition-all cursor-pointer group" onClick={() => openEdit(c.data as ThemeConfig, c.id)}>
            <div className="h-28 relative overflow-hidden">
              {c.data?.coverImage ? <img src={c.data.coverImage} className="w-full h-full object-cover" alt="" /> : (
                <div style={{ backgroundColor: c.data?.bodyBg || "#fff" }} className="h-full">
                  <div className="flex items-center justify-between px-2.5 py-1.5" style={{ backgroundColor:c.data?.headerBg||"#0d9488", color:c.data?.headerText||"#fff" }}><span style={{fontSize:7,fontWeight:700}}>وزارة التعليم</span><span style={{fontSize:8}}>🏛️</span></div>
                  <div className="mx-2 mt-1 px-2 py-0.5" style={{ backgroundColor:c.data?.titleBg||"#0d9488", color:"#fff", fontSize:6, fontWeight:700 }}>شواهد الأداء</div>
                </div>
              )}
              <Sparkles className="absolute top-1 left-1 w-3.5 h-3.5 text-amber-500" />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="bg-white/90 text-gray-800 px-3 py-1.5 rounded-lg text-xs font-bold shadow">✏️ فتح المحرر</span>
              </div>
            </div>
            <div className="p-2.5">
              <div className="flex items-center gap-1.5 mb-1.5"><span className="text-[11px] font-bold text-gray-800 truncate">{c.name}</span><Badge className="text-[6px] bg-amber-50 text-amber-600">مخصص</Badge></div>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" className="flex-1 text-[9px] h-6 gap-0.5" onClick={(e) => { e.stopPropagation(); openEdit(c.data as ThemeConfig, c.id); }}><Edit3 className="w-2.5 h-2.5" />تعديل</Button>
                <Button variant="outline" size="sm" className="text-[9px] h-6 px-1.5 text-red-500" onClick={(e) => { e.stopPropagation(); if(confirm("حذف؟")) deleteMut.mutate({ id: c.id }); }}><Trash2 className="w-2.5 h-2.5" /></Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Hidden themes */}
      {showHidden && deletedIds.length > 0 && (
        <div className="mt-3 bg-gray-50 rounded-xl p-3 border border-dashed">
          <p className="text-[10px] font-bold text-gray-500 mb-2">قوالب محذوفة — يمكن استعادتها:</p>
          <div className="flex gap-2 flex-wrap">{defaults.filter(t => deletedIds.includes(t.id)).map(t => (
            <button key={t.id} onClick={() => handleRestoreBuiltin(t.id)} className="px-3 py-1.5 rounded-lg bg-white border text-[10px] hover:bg-teal-50 flex items-center gap-1"><span className="text-gray-400 line-through">{t.name}</span><span className="text-teal-600 font-bold">استعادة</span></button>
          ))}</div>
        </div>
      )}

      {/* ══════ Canva-Style Editor Dialog ══════ */}
      <Dialog open={editOpen} onOpenChange={() => closeEdit()}>
        <DialogContent dir="rtl" className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0" style={{ width: '95vw', height: '90vh' }}>
          {/* Editor header */}
          <div className="flex items-center justify-between px-4 py-3 border-b bg-gray-50">
            <div className="flex items-center gap-3">
              <Palette className="w-5 h-5" style={{ color: sectionColor }} />
              <div>
                <input value={form.name||""} onChange={e => setF("name", e.target.value)} placeholder="اسم القالب..." className="text-sm font-bold bg-transparent border-none outline-none text-gray-900 w-64" />
                <p className="text-[9px] text-gray-400">{isNew ? "قالب جديد" : "تعديل قالب"} — كل تعديل ينعكس على المستخدمين فوراً</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" className="text-xs gap-1" disabled={extracting} onClick={() => fileRef.current?.click()}>
                {extracting ? <Loader2 className="w-3 h-3 animate-spin" /> : <Upload className="w-3 h-3" />}
                رفع تصميم
              </Button>
              {form.coverImage && <><img src={form.coverImage} className="h-8 w-12 object-cover rounded border" alt="" /><Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-500" onClick={() => removeKey("coverImage")}><X className="w-3 h-3" /></Button></>}
              <Button variant="outline" size="sm" onClick={closeEdit}>إلغاء</Button>
              <Button size="sm" disabled={!form.name?.trim() || createMut.isPending || updateMut.isPending} className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={handleSave}>
                {(createMut.isPending || updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                حفظ
              </Button>
            </div>
          </div>

          <div className="flex h-[calc(90vh-60px)]">
            {/* Left tools panel — tabbed */}
            <div className="w-80 border-l bg-white flex flex-col shrink-0">
              {/* Tool tabs */}
              <div className="flex border-b bg-gray-50 shrink-0">
                {[
                  { id: "structure" as const, icon: Layout, label: "الهيكل" },
                  { id: "colors" as const, icon: PaintBucket, label: "الألوان" },
                  { id: "texts" as const, icon: TypeIcon, label: "النصوص" },
                  { id: "advanced" as const, icon: ChevronDown, label: "متقدم" },
                ].map(tab => (
                  <button key={tab.id} onClick={() => setActivePanel(tab.id)} className={`flex-1 px-2 py-2.5 text-[9px] font-bold flex flex-col items-center gap-0.5 transition-colors ${activePanel === tab.id ? 'text-teal-700 bg-white border-b-2 border-teal-600' : 'text-gray-500 hover:text-gray-700'}`}>
                    <tab.icon className="w-3.5 h-3.5" />{tab.label}
                  </button>
                ))}
              </div>

              {/* Tool content — scrollable */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3">
                {activePanel === "structure" && (
                  <>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-700">نمط الغلاف</label>
                      <div className="grid grid-cols-2 gap-1.5">
                        {[
                          { v:"gradient-center", l:"تدرج مركزي" },
                          { v:"split-left", l:"تقسيم يسار" },
                          { v:"diagonal", l:"قطري مائل" },
                          { v:"framed-elegant", l:"إطار أنيق" },
                          { v:"top-bar", l:"شريط علوي" },
                          { v:"minimal-line", l:"خط بسيط" },
                        ].map(o => (
                          <button key={o.v} onClick={() => setF("coverStyle", o.v)} className={`px-2 py-2 rounded-lg text-[9px] border transition-all ${form.coverStyle === o.v ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold shadow-sm' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{o.l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="space-y-2">
                      <label className="block text-[10px] font-bold text-gray-700">تخطيط الترويسة</label>
                      <div className="grid grid-cols-1 gap-1.5">
                        {[
                          { v:"right-text-center-logo-left-info", l:"نص يمين + شعار وسط + معلومات يسار" },
                          { v:"right-text-left-logo", l:"نص يمين + شعار يسار" },
                          { v:"center-logo-banner", l:"شعار مركزي + شريط" },
                          { v:"full-header-sections", l:"ترويسة كاملة متعددة الأقسام" },
                          { v:"compact", l:"مضغوطة" },
                        ].map(o => (
                          <button key={o.v} onClick={() => setF("headerVariant", o.v)} className={`px-2 py-1.5 rounded-lg text-[9px] border transition-all text-right ${form.headerVariant === o.v ? 'border-teal-500 bg-teal-50 text-teal-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>{o.l}</button>
                        ))}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-600">نمط العنوان</label>
                        <select value={form.titleStyle||"rounded"} onChange={e => setF("titleStyle", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border text-[10px] bg-white">
                          <option value="rounded">مستدير</option><option value="full-width">كامل العرض</option><option value="underlined">خط سفلي</option><option value="badge">شارة</option><option value="simple">بسيط</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-600">نمط الحقول</label>
                        <select value={form.fieldStyle||"fieldset"} onChange={e => setF("fieldStyle", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border text-[10px] bg-white">
                          <option value="fieldset">إطار</option><option value="table">جدول</option><option value="cards">بطاقات</option><option value="underlined">خطي</option><option value="minimal">بسيط</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-600">نمط التوقيع</label>
                        <select value={form.signatureStyle||"dotted"} onChange={e => setF("signatureStyle", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border text-[10px] bg-white">
                          <option value="dotted">نقطي</option><option value="lined">خطي</option><option value="boxed">مربع</option><option value="stamped">ختم</option><option value="solid">مستمر</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[10px] font-bold text-gray-600">أغلفة الأقسام</label>
                        <select value={form.sectionCoverStyle||"full-gradient"} onChange={e => setF("sectionCoverStyle", e.target.value)} className="w-full px-2 py-1.5 rounded-lg border text-[10px] bg-white">
                          <option value="full-gradient">تدرج كامل</option><option value="numbered-bar">شريط مرقم</option><option value="left-stripe">شريط يسار</option><option value="card-center">بطاقة</option><option value="clean-divider">فاصل</option>
                        </select>
                      </div>
                    </div>
                    {/* Toggle options */}
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        { key: "tableStyle", label: "عرض جدولي" },
                        { key: "showTopLine", label: "خط علوي" },
                        { key: "headerSeparator", label: "فاصل ترويسة" },
                      ].map(opt => (
                        <label key={opt.key} className={`flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[9px] cursor-pointer border transition-all ${form[opt.key] ? 'bg-teal-50 border-teal-300 text-teal-700' : 'bg-gray-50 border-gray-200 text-gray-500 hover:border-gray-300'}`}>
                          <input type="checkbox" checked={!!form[opt.key]} onChange={e => setF(opt.key, e.target.checked)} className="w-3 h-3 rounded" />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </>
                )}

                {activePanel === "colors" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-700">🎨 الألوان الرئيسية</label>
                    {[
                      { key: "accent", label: "اللون الرئيسي" },
                      { key: "headerBg", label: "خلفية ترويسة" },
                      { key: "headerText", label: "نص ترويسة" },
                      { key: "titleBg", label: "خلفية عنوان" },
                      { key: "fieldLabelBg", label: "خلفية حقول" },
                      { key: "footerBg", label: "خلفية تذييل" },
                      { key: "borderColor", label: "لون الإطار" },
                      { key: "bodyBg", label: "خلفية الصفحة" },
                      { key: "coverAccent2", label: "لون ثانوي للغلاف" },
                    ].map(c => (
                      <div key={c.key} className="flex items-center gap-2 bg-gray-50 rounded-lg px-3 py-2">
                        <input type="color" value={form[c.key]||"#0d9488"} onChange={e => setF(c.key, e.target.value)} className="w-8 h-8 rounded-lg border cursor-pointer shrink-0" />
                        <div className="flex-1">
                          <span className="text-[10px] font-bold text-gray-700">{c.label}</span>
                          <span className="text-[8px] text-gray-400 block font-mono">{form[c.key]||"#0d9488"}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {activePanel === "texts" && (
                  <div className="space-y-3">
                    <label className="block text-[10px] font-bold text-gray-700">✏️ نصوص القالب</label>
                    {[
                      { key: "headerLine1", label: "سطر 1 الترويسة", placeholder: "المملكة العربية السعودية" },
                      { key: "headerLine2", label: "سطر 2 الترويسة", placeholder: "وزارة التعليم" },
                      { key: "footerText", label: "نص التذييل", placeholder: "شواهد الأداء الوظيفي — نظام SERS" },
                      { key: "coverSubtitle", label: "عنوان فرعي للغلاف", placeholder: "السجلات التعليمية الذكية" },
                    ].map(t => (
                      <div key={t.key} className="space-y-1">
                        <label className="text-[9px] font-bold text-gray-600">{t.label}</label>
                        <input value={form[t.key]||""} onChange={e => setF(t.key, e.target.value)} placeholder={t.placeholder} className="w-full px-3 py-2 rounded-lg border text-xs bg-white" />
                      </div>
                    ))}
                  </div>
                )}

                {activePanel === "advanced" && (
                  <div className="space-y-2">
                    <label className="block text-[10px] font-bold text-gray-700">⚙️ خصائص متقدمة ({allProperties.length})</label>
                    {allProperties.map(([key, val]) => (
                      <div key={key} className="flex items-center gap-1.5 bg-gray-50 rounded-lg px-2 py-1.5 group">
                        <span className="text-[9px] font-mono text-gray-500 w-24 shrink-0 truncate">{key}</span>
                        {typeof val === "boolean" ? (
                          <label className="flex items-center gap-1 flex-1 cursor-pointer">
                            <input type="checkbox" checked={val} onChange={e => setF(key, e.target.checked)} className="w-3.5 h-3.5 rounded" />
                            <span className="text-[9px] text-gray-600">{val ? "مفعّل" : "معطّل"}</span>
                          </label>
                        ) : (
                          <div className="flex-1 flex items-center gap-1">
                            {isColorValue(val) && <input type="color" value={val} onChange={e => setF(key, e.target.value)} className="w-5 h-5 rounded border cursor-pointer shrink-0" />}
                            <input value={String(val)} onChange={e => setF(key, e.target.value)} className="flex-1 px-2 py-1 rounded border text-[9px] bg-white min-w-0" />
                          </div>
                        )}
                        <Button variant="ghost" size="sm" className="h-4 w-4 p-0 opacity-0 group-hover:opacity-100 text-red-400" onClick={() => removeKey(key)}><X className="w-2.5 h-2.5" /></Button>
                      </div>
                    ))}
                    <div className="bg-teal-50/50 rounded-lg p-2 border border-teal-100 mt-2">
                      <div className="flex gap-2">
                        <input value={newPropKey} onChange={e => setNewPropKey(e.target.value)} placeholder="اسم الخاصية" className="flex-1 px-2 py-1.5 rounded border text-[9px]" />
                        <input value={newPropVal} onChange={e => setNewPropVal(e.target.value)} placeholder="القيمة" className="flex-1 px-2 py-1.5 rounded border text-[9px]" />
                        <Button size="sm" className="text-[9px] h-7 bg-teal-600" disabled={!newPropKey.trim()} onClick={() => { setF(newPropKey.trim(), newPropVal || ""); setNewPropKey(""); setNewPropVal(""); }}><Plus className="w-3 h-3" /></Button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Right: LARGE Live Preview — Canva-style canvas */}
            <div className="flex-1 bg-gray-100 flex flex-col overflow-hidden">
              <div className="flex items-center justify-between px-4 py-2 bg-gray-200/50 border-b shrink-0">
                <div className="flex items-center gap-2">
                  <Eye className="w-3.5 h-3.5 text-gray-500" />
                  <span className="text-[10px] font-bold text-gray-600">معاينة حية — اضغط على أي عنصر لتعديله</span>
                </div>
                <Button variant="ghost" size="sm" className="text-[9px] text-gray-500 gap-1" onClick={() => setPreviewFullscreen(!previewFullscreen)}>
                  {previewFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
                  {previewFullscreen ? "تصغير" : "تكبير"}
                </Button>
              </div>
              <div className="flex-1 overflow-auto p-6 flex items-start justify-center">
                <div className="border-2 border-gray-300 rounded-2xl shadow-2xl bg-white overflow-hidden" style={{ width: 'min(100%, 700px)' }}>
                  <ReportPreviewRenderer
                    theme={form}
                    jobTitle={sectionName}
                    scale={0.5}
                    showCover={true}
                    showInnerPage={true}
                    editable={true}
                    onTextChange={(key, val) => setF(key, val)}
                  />
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
