import { useState, useMemo } from "react";
// Editor moved to admin/templates — SectionsPanel is render-only
import { trpc } from "@/lib/trpc";
import { sections } from "@/lib/data";
import { STANDARDS as TEACHER_STANDARDS, getTotalItems, getTotalSubItems, type Standard } from "@/lib/standards-data";
import { PRINCIPAL_STANDARDS, VICE_PRINCIPAL_STANDARDS, COUNSELOR_STANDARDS, HEALTH_COUNSELOR_STANDARDS, ACTIVITY_LEADER_STANDARDS, KINDERGARTEN_STANDARDS, SUPERVISOR_STANDARDS, SPECIAL_ED_STANDARDS } from "@/lib/all-jobs-standards";
import { toast } from "sonner";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  Award, FolderOpen, FileText, TrendingUp, HeartPulse, ClipboardCheck, Medal, BookOpen, Radio, Wrench, ShoppingBag,
  Plus, Edit3, Trash2, Save, Eye, Search, Palette, Type, Layers, Loader2, Sparkles, ChevronLeft,
  UserCircle, CalendarDays, Settings2, Zap, GraduationCap, Building2, Users, Heart, Baby, Accessibility, Briefcase,
  ChevronDown, ChevronRight, ListChecks, Upload, FileType, Maximize, Image as ImageIcon, BarChart3,
} from "lucide-react";

const ICON_MAP: Record<string, any> = { Award, FolderOpen, FileText, TrendingUp, HeartPulse, ClipboardCheck, Medal, BookOpen, Radio, Wrench, ShoppingBag, UserCircle, CalendarDays };

/* ═══ Types ═══ */
interface BuiltinType { id: string; title: string; icon?: any; color?: string; desc?: string; standards?: Standard[] }
interface BuiltinField { id: string; label: string; type: string; placeholder?: string; required?: boolean }

/* ═══ Job types with their standards ═══ */
const PE_JOBS: BuiltinType[] = [
  { id:"teacher", title:"معلم / معلمة", icon: GraduationCap, color:"#0097A7", desc:TEACHER_STANDARDS.length+" معيار · "+getTotalItems(TEACHER_STANDARDS)+" بند · "+getTotalSubItems(TEACHER_STANDARDS)+" فرعي", standards: TEACHER_STANDARDS },
  { id:"principal", title:"مدير / مديرة مدرسة", icon: Building2, color:"#2563EB", desc:PRINCIPAL_STANDARDS.length+" معيار · "+getTotalItems(PRINCIPAL_STANDARDS)+" بند · "+getTotalSubItems(PRINCIPAL_STANDARDS)+" فرعي", standards: PRINCIPAL_STANDARDS },
  { id:"vice_principal", title:"وكيل / وكيلة مدرسة", icon: ClipboardCheck, color:"#7C3AED", desc:VICE_PRINCIPAL_STANDARDS.length+" معيار · "+getTotalItems(VICE_PRINCIPAL_STANDARDS)+" بند · "+getTotalSubItems(VICE_PRINCIPAL_STANDARDS)+" فرعي", standards: VICE_PRINCIPAL_STANDARDS },
  { id:"counselor", title:"موجه/ة طلابي/ة", icon: Users, color:"#0891B2", desc:COUNSELOR_STANDARDS.length+" معيار · "+getTotalItems(COUNSELOR_STANDARDS)+" بند · "+getTotalSubItems(COUNSELOR_STANDARDS)+" فرعي", standards: COUNSELOR_STANDARDS },
  { id:"health_counselor", title:"موجه/ة صحي/ة", icon: Heart, color:"#DC2626", desc:HEALTH_COUNSELOR_STANDARDS.length+" معيار · "+getTotalItems(HEALTH_COUNSELOR_STANDARDS)+" بند · "+getTotalSubItems(HEALTH_COUNSELOR_STANDARDS)+" فرعي", standards: HEALTH_COUNSELOR_STANDARDS },
  { id:"activity_leader", title:"رائد/ة نشاط", icon: Award, color:"#F59E0B", desc:ACTIVITY_LEADER_STANDARDS.length+" معيار · "+getTotalItems(ACTIVITY_LEADER_STANDARDS)+" بند · "+getTotalSubItems(ACTIVITY_LEADER_STANDARDS)+" فرعي", standards: ACTIVITY_LEADER_STANDARDS },
  { id:"kindergarten", title:"رياض أطفال", icon: Baby, color:"#EC4899", desc:KINDERGARTEN_STANDARDS.length+" معيار · "+getTotalItems(KINDERGARTEN_STANDARDS)+" بند · "+getTotalSubItems(KINDERGARTEN_STANDARDS)+" فرعي", standards: KINDERGARTEN_STANDARDS },
  { id:"librarian", title:"أمين/ة مصادر", icon: BookOpen, color:"#9333EA", desc:SUPERVISOR_STANDARDS.length+" معيار · "+getTotalItems(SUPERVISOR_STANDARDS)+" بند · "+getTotalSubItems(SUPERVISOR_STANDARDS)+" فرعي", standards: SUPERVISOR_STANDARDS },
  { id:"special_ed", title:"تربية خاصة", icon: Accessibility, color:"#F97316", desc:SPECIAL_ED_STANDARDS.length+" معيار · "+getTotalItems(SPECIAL_ED_STANDARDS)+" بند · "+getTotalSubItems(SPECIAL_ED_STANDARDS)+" فرعي", standards: SPECIAL_ED_STANDARDS },
  { id:"admin_assistant", title:"مساعد/ة إداري/ة", icon: Briefcase, color:"#6B7280", desc:SUPERVISOR_STANDARDS.length+" معيار · "+getTotalItems(SUPERVISOR_STANDARDS)+" بند · "+getTotalSubItems(SUPERVISOR_STANDARDS)+" فرعي", standards: SUPERVISOR_STANDARDS },
];
const PE_FIELDS: BuiltinField[] = [
  { id:"name", label:"الاسم الكامل", type:"text", placeholder:"أدخل الاسم الرباعي", required: true },
  { id:"school", label:"المدرسة", type:"text", placeholder:"اسم المدرسة", required: true },
  { id:"year", label:"العام الدراسي", type:"text", placeholder:"مثال: ١٤٤٧هـ" },
  { id:"semester", label:"الفصل الدراسي", type:"text", placeholder:"مثال: الفصل الدراسي الثاني" },
  { id:"evaluator", label:"اسم مدير المدرسة", type:"text", placeholder:"اسم مدير/ة المدرسة" },
  { id:"evaluatorRole", label:"الصفة الوظيفية", type:"text", placeholder:"مثال: مدير المدرسة" },
  { id:"date", label:"تاريخ التقييم", type:"text", placeholder:"مثال: ١٤٤٧/٠٦/١٥" },
  { id:"reportTitle", label:"الموضوع", type:"text", placeholder:"شواهد الأداء الوظيفي" },
  { id:"department", label:"الجهة / الإدارة", type:"textarea", placeholder:"المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة" },
  { id:"extraLogo", label:"شعار إضافي (اختياري)", type:"text", placeholder:"رابط الشعار (URL)" },
];

const CERT_TYPES: BuiltinType[] = [
  { id:"thanks", title:"شهادة شكر وتقدير", desc:"تقديراً لجهودكم المتميزة" },
  { id:"excellence", title:"شهادة تميز", desc:"تقديراً لتميزكم وإبداعكم" },
  { id:"participation", title:"شهادة مشاركة", desc:"نشهد بمشاركتكم الفاعلة" },
  { id:"training", title:"شهادة حضور دورة", desc:"نشهد بحضوركم وإتمامكم" },
  { id:"student_excellence", title:"شهادة تفوق طالب", desc:"تقديراً لتفوقكم الدراسي" },
];
const CERT_FIELDS: BuiltinField[] = [
  { id:"recipientName", label:"اسم المكرّم", type:"text", required: true }, { id:"certText", label:"نص الشهادة", type:"textarea" },
  { id:"giverName", label:"المانح", type:"text" }, { id:"giverTitle", label:"المسمى", type:"text" }, { id:"date", label:"التاريخ", type:"date" },
];
const REPORT_TYPES: BuiltinType[] = [
  { id:"documentation", title:"توثيق نشاط" }, { id:"educational", title:"تقرير تعليمي" }, { id:"strategy", title:"استراتيجية تدريس" },
  { id:"plc", title:"مجتمعات تعلم" }, { id:"peer-visits", title:"تبادل زيارات" }, { id:"workshop", title:"ورشة عمل" },
  { id:"action-research", title:"بحث إجرائي" }, { id:"lesson-study", title:"بحث الدرس" },
];
const COVER_TYPES: BuiltinType[] = [
  { id:"portfolio", title:"غلاف ملف إنجاز" }, { id:"subject", title:"غلاف مادة" }, { id:"plan", title:"غلاف خطة" },
  { id:"report", title:"غلاف تقرير" }, { id:"divider", title:"فاصل ملف" }, { id:"index", title:"فهرس" },
];
const EXAM_TYPES: BuiltinType[] = [
  { id:"multiple-choice", title:"اختيار من متعدد" }, { id:"true-false", title:"صح / خطأ" },
  { id:"essay", title:"مقالي" }, { id:"fill-blank", title:"أكمل الفراغ" },
];

// Upload settings per section (what users can upload)
const UPLOAD_SETTINGS: Record<string, { allowedTypes: string[]; maxSizeMB: number; evidenceTypes: string[] }> = {
  "evidence": { allowedTypes: ["image/png","image/jpeg","application/pdf"], maxSizeMB: 10, evidenceTypes: ["صورة","رابط","فيديو","ملف","نص"] },
  "portfolio": { allowedTypes: ["image/png","image/jpeg","application/pdf"], maxSizeMB: 5, evidenceTypes: ["صورة","ملف"] },
  "certificates": { allowedTypes: ["image/png","image/jpeg"], maxSizeMB: 5, evidenceTypes: ["صورة"] },
  "cv": { allowedTypes: ["image/png","image/jpeg"], maxSizeMB: 3, evidenceTypes: ["صورة"] },
  "covers": { allowedTypes: ["image/png","image/jpeg","image/svg+xml"], maxSizeMB: 5, evidenceTypes: ["صورة"] },
};

// حقول الشاهد الفرعي (ما يعبئه المستخدم عند إضافة شاهد)
interface SubEvidenceField { id: string; label: string; type: string; placeholder?: string }
const SUB_EVIDENCE_FIELDS: Record<string, SubEvidenceField[]> = {
  "evidence": [
    { id: "report_title", label: "الموضوع", type: "text", placeholder: "أدخل موضوع الشاهد..." },
    { id: "evidence_desc", label: "وصف الشاهد", type: "textarea", placeholder: "اكتب وصفاً للشاهد المقدم..." },
    { id: "date", label: "التاريخ", type: "date" },
    { id: "notes", label: "ملاحظات", type: "textarea", placeholder: "ملاحظات إضافية..." },
  ],
  "reports": [
    { id: "report_title", label: "عنوان التقرير", type: "text" },
    { id: "date", label: "التاريخ", type: "date" },
    { id: "description", label: "الوصف", type: "textarea" },
    { id: "goals", label: "الأهداف", type: "textarea" },
    { id: "results", label: "النتائج", type: "textarea" },
    { id: "recommendations", label: "التوصيات", type: "textarea" },
  ],
};

// إعدادات عرض الشواهد
interface DisplaySetting { id: string; label: string; desc: string; enabled: boolean }
const DISPLAY_SETTINGS: Record<string, DisplaySetting[]> = {
  "evidence": [
    { id: "show_image", label: "عرض كصورة", desc: "عرض الملف المرفق كصورة مباشرة", enabled: true },
    { id: "show_qr", label: "عرض كـ QR", desc: "عرض رمز QR للرابط المرفق", enabled: true },
    { id: "show_barcode", label: "باركود التحقق", desc: "إضافة باركود للتحقق من صحة الشاهد", enabled: true },
    { id: "priority_system", label: "نظام الأولويات", desc: "تصنيف الشواهد (أساسي / داعم / إضافي)", enabled: true },
    { id: "drag_drop", label: "السحب والإفلات", desc: "نقل الشواهد بين البنود بالسحب", enabled: true },
    { id: "auto_save", label: "حفظ تلقائي", desc: "حفظ الشواهد تلقائياً أثناء الكتابة", enabled: true },
  ],
};

interface SectionContent { types?: BuiltinType[]; fields?: BuiltinField[]; dbKey: string }
const CONTENT: Record<string, SectionContent> = {
  "1":  { types: PE_JOBS, fields: PE_FIELDS, dbKey: "evidence" },
  "2":  { fields: [{ id:"name",label:"الاسم",type:"text" },{ id:"job",label:"المسمى",type:"text" },{ id:"school",label:"المدرسة",type:"text" }], dbKey: "portfolio" },
  "3":  { types: REPORT_TYPES, fields: [{ id:"title",label:"العنوان",type:"text" },{ id:"name",label:"الاسم",type:"text" },{ id:"school",label:"المدرسة",type:"text" },{ id:"date",label:"التاريخ",type:"date" },{ id:"desc",label:"الوصف",type:"textarea" }], dbKey: "reports" },
  "4":  { types: CERT_TYPES, fields: CERT_FIELDS, dbKey: "certificates" },
  "5":  { fields: [{ id:"name",label:"الاسم",type:"text" },{ id:"title",label:"المسمى",type:"text" },{ id:"email",label:"البريد",type:"text" },{ id:"phone",label:"الهاتف",type:"text" },{ id:"summary",label:"الملخص",type:"textarea" }], dbKey: "cv" },
  "6":  { fields: [{ id:"studentName",label:"الطالب",type:"text" },{ id:"grade",label:"الصف",type:"text" },{ id:"subject",label:"المادة",type:"text" },{ id:"plan",label:"الخطة",type:"textarea" }], dbKey: "treatment" },
  "7":  { types: EXAM_TYPES, fields: [{ id:"title",label:"عنوان الاختبار",type:"text" },{ id:"subject",label:"المادة",type:"text" },{ id:"grade",label:"الصف",type:"text" },{ id:"duration",label:"المدة",type:"text" }], dbKey: "exams" },
  "8":  { fields: [{ id:"subject",label:"المادة",type:"text" },{ id:"grade",label:"الصف",type:"text" }], dbKey: "grades" },
  "9":  { fields: [{ id:"topic",label:"الموضوع",type:"text" },{ id:"intro",label:"مقدمة",type:"textarea" },{ id:"quran",label:"آية",type:"textarea" },{ id:"hadith",label:"حديث",type:"textarea" },{ id:"word",label:"كلمة",type:"textarea" }], dbKey: "radio" },
  "13": { types: COVER_TYPES, fields: [{ id:"title",label:"العنوان",type:"text" },{ id:"subtitle",label:"فرعي",type:"text" },{ id:"name",label:"الاسم",type:"text" },{ id:"school",label:"المدرسة",type:"text" }], dbKey: "covers" },
};

/* ═══════════════════════
   MAIN COMPONENT
   ═══════════════════════ */
export default function SectionsPanel() {
  // Navigation
  const [selSectionId, setSelSectionId] = useState<string | null>(null);
  const [selTypeId, setSelTypeId] = useState<string | null>(null);
  const [selStandardId, setSelStandardId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Editable personal info state — synced with DB
  const [personalInfoValues, setPersonalInfoValues] = useState<Record<string, string>>({
    name: "", school: "", year: "", semester: "", evaluator: "", evaluatorRole: "مدير المدرسة",
    date: "", reportTitle: "شواهد الأداء الوظيفي",
    department: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة",
    extraLogo: "",
  });
  const [editingLabel, setEditingLabel] = useState<string | null>(null);
  const [editedLabels, setEditedLabels] = useState<Record<string, string>>({});

  // Editable evaluation grades
  const [evalGrades, setEvalGrades] = useState([
    { label: "ممتاز", min: 90, max: 100, color: "#059669", emoji: "🌟" },
    { label: "جيد جداً", min: 80, max: 89, color: "#2563eb", emoji: "✨" },
    { label: "جيد", min: 70, max: 79, color: "#d97706", emoji: "👍" },
    { label: "مقبول", min: 60, max: 69, color: "#ea580c", emoji: "📊" },
    { label: "ضعيف", min: 0, max: 59, color: "#dc2626", emoji: "⚠️" },
  ]);


  // Edit dialog (shared across ALL levels)
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"type"|"field"|"standard"|"item"|"subitem"|"upload">("type");
  const [dialogEditId, setDialogEditId] = useState<number | null>(null);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formFieldType, setFormFieldType] = useState("text");
  const [formRequired, setFormRequired] = useState(false);
  const [formUploadTypes, setFormUploadTypes] = useState("");
  const [formMaxSize, setFormMaxSize] = useState("10");
  const [formEvidenceTypes, setFormEvidenceTypes] = useState("");

  const sel = sections.find(s => s.id === selSectionId);
  const content = sel ? CONTENT[sel.id] : undefined;
  const dbKey = content?.dbKey || "";

  // DB queries
  const { data: dbConfigs, refetch } = trpc.sectionConfigs.list.useQuery({ sectionId: dbKey }, { enabled: !!dbKey });
  const createMut = trpc.sectionConfigs.create.useMutation({ onSuccess: () => { refetch(); toast.success("تمت الإضافة ✨"); closeDialog(); } });
  const updateMut = trpc.sectionConfigs.update.useMutation({ onSuccess: () => { refetch(); toast.success("تم التحديث ✅"); closeDialog(); } });
  const deleteMut = trpc.sectionConfigs.delete.useMutation({ onSuccess: () => { refetch(); toast.success("تم الحذف 🗑️"); } });

  const openDialog = (mode: typeof dialogMode, name = "", desc = "", editId: number | null = null) => {
    setDialogMode(mode); setFormName(name); setFormDesc(desc); setDialogEditId(editId);
    setFormFieldType("text"); setFormRequired(false);
    if (mode === "upload") {
      const ups = UPLOAD_SETTINGS[dbKey];
      if (ups) { setFormUploadTypes(ups.allowedTypes.join(", ")); setFormMaxSize(String(ups.maxSizeMB)); setFormEvidenceTypes(ups.evidenceTypes.join(", ")); }
    }
    setDialogOpen(true);
  };
  const openFieldDialog = (name: string, desc: string, ftype: string, req: boolean, editId: number | null = null) => {
    setDialogMode("field"); setFormName(name); setFormDesc(desc); setFormFieldType(ftype); setFormRequired(req); setDialogEditId(editId); setDialogOpen(true);
  };
  const closeDialog = () => { setDialogOpen(false); setDialogEditId(null); setFormName(""); setFormDesc(""); };
  const toggleItem = (id: string) => setExpandedItems(p => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const filtered = useMemo(() => { const q = search.toLowerCase(); return q ? sections.filter(s => s.title.includes(q) || s.description.includes(q)) : sections; }, [search]);

  const selType = content?.types?.find(t => t.id === selTypeId);
  const selStandard = selType?.standards?.find(s => s.id === selStandardId);
  const customTypes = dbConfigs?.filter((c: any) => c.configType === "type") || [];
  const customFields = dbConfigs?.filter((c: any) => c.configType === "field") || [];
  const uploadCfg = UPLOAD_SETTINGS[dbKey];

  const handleSave = () => {
    if (!formName.trim()) return;
    if (dialogMode === "upload") {
      // Save upload settings
      const data = { allowedTypes: formUploadTypes.split(",").map(s => s.trim()), maxSizeMB: Number(formMaxSize), evidenceTypes: formEvidenceTypes.split(",").map(s => s.trim()) };
      if (dialogEditId) updateMut.mutate({ id: dialogEditId, name: formName, data });
      else createMut.mutate({ sectionId: dbKey, configType: "upload-settings", name: formName, data });
      return;
    }
    if (dialogMode === "field") {
      const data = { fieldType: formFieldType, placeholder: formDesc, required: formRequired };
      if (dialogEditId) updateMut.mutate({ id: dialogEditId, name: formName, data });
      else createMut.mutate({ sectionId: dbKey, configType: "field", name: formName, data });
    } else if (dialogMode === "type") {
      if (dialogEditId) updateMut.mutate({ id: dialogEditId, name: formName, description: formDesc });
      else createMut.mutate({ sectionId: dbKey, configType: "type", name: formName, description: formDesc, data: { defaultText: formDesc } });
    } else {
      // item, subitem, standard
      const data = { suggestedEvidence: formDesc.split("\n").filter(Boolean) };
      if (dialogEditId) updateMut.mutate({ id: dialogEditId, name: formName, data });
      else createMut.mutate({ sectionId: dbKey, configType: dialogMode, name: formName, data });
    }
  };

  /* ═══ Render content based on level ═══ */
  const renderContent = () => {
    // ── Level 3: Standard detail ──
    if (sel && selStandard && selType) {
      return (
        <div className="space-y-4">
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setSelStandardId(null)} className="gap-1"><ChevronLeft className="w-4 h-4" />رجوع</Button>
            <div className="w-8 h-8 rounded-lg flex items-center justify-center" style={{ backgroundColor: (selStandard.color||sel.color)+"15" }}>
              <ListChecks className="w-4 h-4" style={{ color: selStandard.color||sel.color }} /></div>
            <div className="flex-1 min-w-0"><h2 className="text-base font-bold text-gray-900">المعيار {selStandard.number}: {selStandard.title}</h2>
              <p className="text-[10px] text-gray-500">الوزن: {selStandard.weight}% · {selStandard.items.length} بند · {selStandard.items.reduce((t,i)=>t+i.subItems.length,0)} بند فرعي</p></div>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openDialog("item")}><Plus className="w-3 h-3" />إضافة بند</Button>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openDialog("standard", selStandard.title, `الوزن: ${selStandard.weight}%`)}><Edit3 className="w-3 h-3" />تعديل المعيار</Button>
          </div>
          {selStandard.items.map((item, idx) => {
            const isOpen = expandedItems.has(item.id);
            return (
              <div key={item.id} className="bg-white rounded-xl border border-gray-100 overflow-hidden shadow-sm">
                <div className="flex items-center gap-3 p-4 hover:bg-gray-50/50 transition-colors">
                  <button onClick={() => toggleItem(item.id)} className="flex items-center gap-3 flex-1 min-w-0 text-right">
                    <div className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0" style={{ backgroundColor: (selStandard.color||"#0d9488")+"12" }}>
                      <span className="text-xs font-bold" style={{ color: selStandard.color||"#0d9488" }}>{idx+1}</span></div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-bold text-gray-800 text-right">{item.text}</h4>
                      <p className="text-[10px] text-gray-500">{item.subItems.length} بند فرعي · {item.suggestedEvidence.length} شاهد مقترح</p></div>
                    {isOpen ? <ChevronDown className="w-4 h-4 text-gray-400 shrink-0" /> : <ChevronRight className="w-4 h-4 text-gray-400 shrink-0" />}
                  </button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 shrink-0" onClick={() => openDialog("item", item.text, item.suggestedEvidence.join("\n"))}><Edit3 className="w-3 h-3" />تعديل</Button>
                  <Button variant="outline" size="sm" className="h-7 px-2 text-xs gap-1 text-red-500 shrink-0" onClick={() => toast.info("حذف البند المدمج غير متاح — أضف بنود مخصصة")}><Trash2 className="w-3 h-3" /></Button>
                </div>
                {isOpen && (
                  <div className="border-t border-gray-100">
                    {item.subItems.map((sub, si) => (
                      <div key={sub.id} className="flex items-start gap-3 px-4 py-3 border-b border-gray-50 last:border-0 hover:bg-gray-50/30 group">
                        <span className="text-[10px] font-bold text-gray-400 mt-1 shrink-0 w-8 text-center">{idx+1}.{si+1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-gray-700">{sub.title}</p>
                          <div className="flex gap-1 flex-wrap mt-1">{sub.suggestedEvidence.map((e,i) => <span key={i} className="px-1.5 py-0.5 rounded text-[8px] bg-teal-50 text-teal-700 border border-teal-100">{e}</span>)}</div>
                        </div>
                        <div className="flex gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                          <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] gap-0.5" onClick={() => openDialog("subitem", sub.title, sub.suggestedEvidence.join("\n"))}><Edit3 className="w-2.5 h-2.5" />تعديل</Button>
                          <Button variant="outline" size="sm" className="h-6 px-1.5 text-[10px] text-red-500" onClick={() => toast.info("حذف البند المدمج غير متاح")}><Trash2 className="w-2.5 h-2.5" /></Button>
                        </div>
                      </div>
                    ))}
                    <div className="px-4 py-3 bg-gray-50/50">
                      <p className="text-[10px] font-bold text-gray-500 mb-1.5">📎 الشواهد المقترحة للبند:</p>
                      <div className="flex gap-1.5 flex-wrap">{item.suggestedEvidence.map((e,i) => <span key={i} className="px-2 py-0.5 rounded-full text-[9px] bg-blue-50 text-blue-600 border border-blue-100">{e}</span>)}</div>
                    </div>
                    <div className="px-4 py-2 bg-gray-50 border-t flex gap-2">
                      <Button size="sm" variant="ghost" className="text-xs gap-1 text-teal-600" onClick={() => openDialog("subitem")}><Plus className="w-3 h-3" />إضافة بند فرعي</Button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          {/* Custom added items from DB */}
          {dbConfigs?.filter((c:any) => c.configType === "item").map((c: any) => (
            <div key={c.id} className="bg-white rounded-xl border-2 border-amber-200 overflow-hidden shadow-sm p-4">
              <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-amber-500" /><span className="text-sm font-bold text-gray-800">{c.name}</span><Badge className="text-[8px] bg-amber-50 text-amber-600">مخصص</Badge></div>
              {c.data?.suggestedEvidence && <div className="flex gap-1 flex-wrap mb-2">{c.data.suggestedEvidence.map((e:string,i:number) => <span key={i} className="px-1.5 py-0.5 rounded text-[8px] bg-amber-50 text-amber-700">{e}</span>)}</div>}
              <div className="flex gap-1.5">
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1" onClick={() => openDialog("item", c.name, (c.data?.suggestedEvidence||[]).join("\n"), c.id)}><Edit3 className="w-3 h-3" />تعديل</Button>
                <Button variant="outline" size="sm" className="text-xs h-7 gap-1 text-red-500" onClick={() => { if(confirm("حذف؟")) deleteMut.mutate({ id: c.id }); }}><Trash2 className="w-3 h-3" />حذف</Button>
              </div>
            </div>
          ))}
        </div>
      );
    }

    // ── Level 2: Type detail ──
    if (sel && selType) {
      const standards = selType.standards || [];
      const TypeIcon = selType.icon || Type;
      const subFields = SUB_EVIDENCE_FIELDS[dbKey] || [];
      const dispSettings = DISPLAY_SETTINGS[dbKey] || [];
      return (
        <div className="space-y-5">
          <div className="flex items-center gap-3 flex-wrap">
            <Button variant="ghost" size="sm" onClick={() => setSelTypeId(null)} className="gap-1"><ChevronLeft className="w-4 h-4" />رجوع</Button>
            <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: (selType.color||sel.color)+"12" }}><TypeIcon className="w-5 h-5" style={{ color: selType.color||sel.color }} /></div>
            <div className="flex-1 min-w-0"><h2 className="text-lg font-bold text-gray-900">{selType.title}</h2><p className="text-xs text-gray-500">{selType.desc}</p></div>
            <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openDialog("type", selType.title, selType.desc||"")}><Edit3 className="w-3 h-3" />تعديل</Button>
            <Button size="sm" variant="outline" className="text-xs gap-1 text-red-500" onClick={() => toast.info("حذف نوع مدمج غير متاح — أضف أنواع مخصصة")}><Trash2 className="w-3 h-3" />حذف</Button>
          </div>

          {/* Standards */}
          {standards.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><ListChecks className="w-4 h-4" style={{ color: selType.color }} />المعايير ({standards.length})</h3>
                <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => openDialog("standard")}><Plus className="w-3 h-3" />إضافة معيار</Button>
              </div>
              <div className="space-y-2">
                {standards.map(std => (
                  <button key={std.id} onClick={() => setSelStandardId(std.id)} className="w-full bg-white rounded-xl border border-gray-100 p-4 text-right hover:shadow-md hover:border-gray-200 transition-all flex items-center gap-3">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0" style={{ backgroundColor: (std.color||"#0d9488")+"12" }}>
                      <span className="text-sm font-black" style={{ color: std.color||"#0d9488" }}>{std.number}</span></div>
                    <div className="flex-1 min-w-0"><h4 className="text-sm font-bold text-gray-800">{std.title}</h4>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[10px] text-gray-500">الوزن: {std.weight}%</span><span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[10px] text-gray-500">{std.items.length} بند</span><span className="text-[10px] text-gray-400">·</span>
                        <span className="text-[10px] text-gray-500">{std.items.reduce((t,i)=>t+i.subItems.length,0)} فرعي</span></div></div>
                    <div className="w-12 h-1.5 rounded-full bg-gray-100 shrink-0"><div className="h-full rounded-full" style={{ width: `${std.weight}%`, backgroundColor: std.color||"#0d9488" }} /></div>
                    <ChevronLeft className="w-4 h-4 text-gray-400 shrink-0" /></button>
                ))}
              </div>
            </div>
          )}
          {standards.length === 0 && (
            <div className="bg-white rounded-xl border border-gray-100 p-6 text-center">
              <h3 className="text-sm font-bold text-gray-700 mb-2">تفاصيل: {selType.title}</h3>
              <p className="text-sm text-gray-600 mb-3">{selType.desc || "لا توجد تفاصيل إضافية"}</p>
              <p className="text-xs text-gray-400">يمكن تعديل العنوان والوصف من زر "تعديل" أعلاه</p>
            </div>
          )}

          {/* البيانات الشخصية نُقلت لمستوى القسم (مشتركة بين كل الوظائف) — انظر Level 1 */}

          {/* ═══ محرر التصاميم — نُقل لقسم القوالب في لوحة الإدارة ═══ */}
        </div>
      );
    }

    // ── Level 1: Section detail ──
    if (sel && content) {
      const SIcon = ICON_MAP[sel.icon] || FolderOpen;
      return (
        <div className="space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="sm" onClick={() => setSelSectionId(null)} className="gap-1.5"><ChevronLeft className="w-4 h-4" />رجوع</Button>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center" style={{ backgroundColor: sel.color+"12" }}><SIcon className="w-6 h-6" style={{ color: sel.color }} /></div>
              <div><h2 className="text-lg font-bold text-gray-900">{sel.title}</h2><p className="text-xs text-gray-500">{sel.description}</p></div>
            </div>
          </div>

          {/* Types */}
          {content.types && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Type className="w-4 h-4" style={{ color: sel.color }} />{sel.id === "1" ? "الوظائف" : "الأنواع"} ({content.types.length + customTypes.length})</h3>
                <Button size="sm" variant="outline" onClick={() => openDialog("type")} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />إضافة</Button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-3">
                {content.types.map(t => {
                  const TIcon = t.icon || Type; const hasStds = t.standards && t.standards.length > 0;
                  return (
                    <button key={t.id} onClick={() => setSelTypeId(t.id)} className="bg-white rounded-xl border border-gray-100 p-4 text-right hover:shadow-lg hover:border-gray-200 transition-all group">
                      <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ backgroundColor: (t.color||sel.color)+"12" }}><TIcon className="w-5 h-5" style={{ color: t.color||sel.color }} /></div>
                        <div className="flex-1 min-w-0"><h4 className="text-sm font-bold text-gray-800">{t.title}</h4>{t.desc && <p className="text-[10px] text-gray-500 mt-0.5">{t.desc}</p>}</div>
                        <ChevronLeft className="w-4 h-4 text-gray-300 group-hover:text-gray-500 shrink-0" /></div>
                      {hasStds && <div className="flex gap-1.5 flex-wrap"><Badge className="text-[8px] bg-teal-50 text-teal-700">{t.standards!.length} معيار</Badge><Badge className="text-[8px] bg-blue-50 text-blue-600">{getTotalItems(t.standards!)} بند</Badge><Badge className="text-[8px] bg-purple-50 text-purple-600">{getTotalSubItems(t.standards!)} فرعي</Badge></div>}
                    </button>);
                })}
                {customTypes.map((c: any) => (
                  <div key={c.id} className="bg-white rounded-xl border-2 border-amber-200 p-4">
                    <div className="flex items-center gap-2 mb-2"><Sparkles className="w-4 h-4 text-amber-500" /><span className="text-sm font-bold text-gray-800">{c.name}</span></div>
                    {c.description && <p className="text-[10px] text-gray-500 mb-2">{c.description}</p>}
                    <div className="flex gap-1.5">
                      <Button variant="outline" size="sm" className="flex-1 text-xs h-7 gap-1" onClick={() => openDialog("type", c.name, c.description||"", c.id)}><Edit3 className="w-3 h-3" />تعديل</Button>
                      <Button variant="outline" size="sm" className="text-xs h-7 text-red-500" onClick={() => { if(confirm("حذف؟")) deleteMut.mutate({ id: c.id }); }}><Trash2 className="w-3 h-3" /></Button>
                    </div></div>
                ))}
              </div>
            </div>
          )}

          {/* Fields — skip for evidence section since personal info already covers it */}
          {content.fields && sel.id !== "1" && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Layers className="w-4 h-4" style={{ color: sel.color }} />حقول النموذج ({content.fields.length + customFields.length})</h3>
                <Button size="sm" variant="outline" onClick={() => openFieldDialog("", "", "text", false)} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />حقل جديد</Button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-2 text-right font-bold text-gray-600">الحقل</th><th className="px-4 py-2 text-right font-bold text-gray-600">النوع</th><th className="px-4 py-2 text-right font-bold text-gray-600">التوضيح</th><th className="px-4 py-2 text-right font-bold text-gray-600">مطلوب</th><th className="w-20"></th></tr></thead>
                  <tbody>
                    {content.fields.map(f => (
                      <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                        <td className="px-4 py-2.5 font-medium text-gray-800">{f.label}</td>
                        <td className="px-4 py-2.5"><Badge className="text-[8px] bg-blue-50 text-blue-600">{f.type}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-500">{f.placeholder || "—"}</td>
                        <td className="px-4 py-2.5">{f.required ? <Badge className="text-[8px] bg-red-50 text-red-600">مطلوب</Badge> : <span className="text-gray-300">—</span>}</td>
                        <td className="px-4 py-2.5"><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openFieldDialog(f.label, f.placeholder||"", f.type, !!f.required)}><Edit3 className="w-3 h-3" /></Button></td>
                      </tr>
                    ))}
                    {customFields.map((c: any) => (
                      <tr key={c.id} className="border-b border-gray-50 bg-amber-50/30">
                        <td className="px-4 py-2.5 font-medium text-gray-800"><Sparkles className="w-3 h-3 text-amber-500 inline ml-1" />{c.name}</td>
                        <td className="px-4 py-2.5"><Badge className="text-[8px] bg-amber-50 text-amber-600">{c.data?.fieldType||"text"}</Badge></td>
                        <td className="px-4 py-2.5 text-gray-500">{c.data?.placeholder||"—"}</td>
                        <td className="px-4 py-2.5">{c.data?.required ? <Badge className="text-[8px] bg-red-50 text-red-600">مطلوب</Badge> : "—"}</td>
                        <td className="px-4 py-2.5"><div className="flex gap-1">
                          <Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openFieldDialog(c.name, c.data?.placeholder||"", c.data?.fieldType||"text", !!c.data?.required, c.id)}><Edit3 className="w-3 h-3" /></Button>
                          <Button variant="ghost" size="sm" className="h-6 text-xs text-red-500" onClick={() => { if(confirm("حذف؟")) deleteMut.mutate({ id: c.id }); }}><Trash2 className="w-3 h-3" /></Button>
                        </div></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ البيانات الأساسية — كل شيء قابل للتعديل ═══ */}
          {sel.id === "1" && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FileText className="w-4 h-4" style={{ color: sel.color }} />البيانات الأساسية</h3>
              <p className="text-[9px] text-gray-500 mb-2">اضغط على أي حقل لتعديل القيمة — اضغط على اسم الحقل لتغيير التسمية — كل تعديل ينعكس على الموقع</p>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <div className="p-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {[
                      { key: "name", label: "الاسم الكامل", placeholder: "أدخل الاسم الرباعي", required: true },
                      { key: "school", label: "المدرسة", placeholder: "اسم المدرسة", required: true },
                      { key: "year", label: "العام الدراسي", placeholder: "مثال: ١٤٤٧هـ", required: false },
                      { key: "semester", label: "الفصل الدراسي", placeholder: "مثال: الفصل الدراسي الثاني", required: false },
                      { key: "evaluator", label: "اسم مدير المدرسة", placeholder: "اسم مدير/ة المدرسة", required: false },
                      { key: "evaluatorRole", label: "الصفة الوظيفية", placeholder: "مثال: مدير المدرسة", required: false },
                      { key: "date", label: "تاريخ التقييم", placeholder: "مثال: ١٤٤٧/٠٦/١٥", required: false },
                    ].map(f => (
                      <div key={f.key} className="space-y-1 group">
                        <div className="flex items-center gap-1">
                          {editingLabel === f.key ? (
                            <input autoFocus type="text" value={editedLabels[f.key] || f.label} onChange={e => setEditedLabels(p => ({...p, [f.key]: e.target.value}))} onBlur={() => setEditingLabel(null)} onKeyDown={e => { if(e.key==='Enter') setEditingLabel(null); }} className="text-xs font-medium text-gray-700 bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 outline-none w-full" />
                          ) : (
                            <label className="text-xs font-medium text-gray-700 cursor-pointer hover:text-teal-600 hover:underline" onClick={() => setEditingLabel(f.key)}>
                              {editedLabels[f.key] || f.label}
                              {f.required && <span className="text-red-500 mr-0.5">*</span>}
                            </label>
                          )}
                          <Edit3 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setEditingLabel(f.key)} />
                          <Button variant="ghost" size="sm" className="h-4 w-4 p-0 mr-auto opacity-0 group-hover:opacity-100" onClick={() => { if(confirm(`حذف حقل "${editedLabels[f.key]||f.label}"؟`)) { setPersonalInfoValues(p => { const n={...p}; delete n[f.key]; return n; }); toast.success('تم حذف الحقل'); }}}><Trash2 className="w-2.5 h-2.5 text-red-300" /></Button>
                        </div>
                        <input type="text" value={personalInfoValues[f.key] || ''} onChange={e => setPersonalInfoValues(p => ({...p, [f.key]: e.target.value}))} placeholder={f.placeholder} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none transition-all" />
                      </div>
                    ))}
                  </div>

                  {/* الموضوع */}
                  <div className="mt-4 space-y-1 group">
                    <div className="flex items-center gap-1">
                      {editingLabel === 'reportTitle' ? (
                        <input autoFocus type="text" value={editedLabels['reportTitle'] || 'الموضوع'} onChange={e => setEditedLabels(p => ({...p, reportTitle: e.target.value}))} onBlur={() => setEditingLabel(null)} className="text-xs font-medium text-gray-700 bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 outline-none" />
                      ) : (
                        <label className="text-xs font-medium text-gray-700 cursor-pointer hover:text-teal-600 hover:underline" onClick={() => setEditingLabel('reportTitle')}>{editedLabels['reportTitle'] || 'الموضوع'}</label>
                      )}
                      <Edit3 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setEditingLabel('reportTitle')} />
                    </div>
                    <input type="text" value={personalInfoValues.reportTitle || ''} onChange={e => setPersonalInfoValues(p => ({...p, reportTitle: e.target.value}))} placeholder="شواهد الأداء الوظيفي" className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none" />
                    <p className="text-[8px] text-gray-400">يظهر في الغلاف ورأس الصفحات</p>
                  </div>

                  {/* الجهة / الإدارة */}
                  <div className="mt-4 space-y-1 group">
                    <div className="flex items-center gap-1">
                      {editingLabel === 'department' ? (
                        <input autoFocus type="text" value={editedLabels['department'] || 'الجهة / الإدارة'} onChange={e => setEditedLabels(p => ({...p, department: e.target.value}))} onBlur={() => setEditingLabel(null)} className="text-xs font-medium text-gray-700 bg-yellow-50 border border-yellow-300 rounded px-1 py-0.5 outline-none" />
                      ) : (
                        <label className="text-xs font-medium text-gray-700 cursor-pointer hover:text-teal-600 hover:underline" onClick={() => setEditingLabel('department')}>{editedLabels['department'] || 'الجهة / الإدارة'}</label>
                      )}
                      <Edit3 className="w-2.5 h-2.5 text-gray-300 opacity-0 group-hover:opacity-100 cursor-pointer" onClick={() => setEditingLabel('department')} />
                    </div>
                    <textarea rows={3} value={personalInfoValues.department || ''} onChange={e => setPersonalInfoValues(p => ({...p, department: e.target.value}))} placeholder={"المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة"} className="w-full px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none resize-none" />
                    <p className="text-[8px] text-gray-400">يظهر في رأس التقرير والغلاف (سطر لكل مستوى)</p>
                  </div>

                  {/* شعار وزارة التعليم الافتراضي */}
                  <div className="mt-4 space-y-1">
                    <label className="text-xs font-medium text-gray-700">شعار وزارة التعليم (افتراضي)</label>
                    <p className="text-[8px] text-gray-400">يظهر تلقائياً في كل التقارير — غيّره إذا كنت تريد شعاراً مختلفاً</p>
                    <div className="flex items-center gap-2">
                      <input type="text" value={personalInfoValues.defaultLogo || 'https://upload.wikimedia.org/wikipedia/ar/f/f1/%D8%B4%D8%B9%D8%A7%D8%B1_%D9%88%D8%B2%D8%A7%D8%B1%D8%A9_%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85_%28%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9%29.svg'} onChange={e => setPersonalInfoValues(p => ({...p, defaultLogo: e.target.value}))} placeholder="رابط شعار الوزارة (URL)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none" />
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1 shrink-0"><Upload className="w-3 h-3" />رفع صورة</Button>
                    </div>
                    <img src={personalInfoValues.defaultLogo || 'https://upload.wikimedia.org/wikipedia/ar/f/f1/%D8%B4%D8%B9%D8%A7%D8%B1_%D9%88%D8%B2%D8%A7%D8%B1%D8%A9_%D8%A7%D9%84%D8%AA%D8%B9%D9%84%D9%8A%D9%85_%28%D8%A7%D9%84%D8%B3%D8%B9%D9%88%D8%AF%D9%8A%D8%A9%29.svg'} alt="شعار الوزارة" className="w-16 h-16 object-contain rounded border mt-1 bg-white p-1" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />
                  </div>

                  {/* شعار إضافي */}
                  <div className="mt-4 space-y-1">
                    <label className="text-xs font-medium text-gray-700">شعار إضافي (اختياري)</label>
                    <p className="text-[8px] text-gray-400">شعار إضافي يظهر بجانب شعار وزارة التعليم في التقارير</p>
                    <div className="flex items-center gap-2">
                      <input type="text" value={personalInfoValues.extraLogo || ''} onChange={e => setPersonalInfoValues(p => ({...p, extraLogo: e.target.value}))} placeholder="رابط الشعار (URL)" className="flex-1 px-3 py-2 rounded-lg border border-gray-200 text-xs bg-white focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 outline-none" />
                      <Button size="sm" variant="outline" className="text-xs h-8 gap-1 shrink-0"><Upload className="w-3 h-3" />رفع صورة</Button>
                    </div>
                    {personalInfoValues.extraLogo && <img src={personalInfoValues.extraLogo} alt="شعار" className="w-12 h-12 object-contain rounded border mt-1" onError={e => { (e.target as HTMLImageElement).style.display='none'; }} />}
                  </div>
                </div>

                {/* حقول مخصصة من DB */}
                {(dbConfigs?.filter((c: any) => c.configType === 'personal-field')?.length ?? 0) > 0 && (
                  <div className="p-4 border-t">
                    <h4 className="text-xs font-bold text-gray-600 mb-2 flex items-center gap-1"><Sparkles className="w-3 h-3 text-amber-500" />حقول مخصصة مضافة</h4>
                    <div className="space-y-2">
                      {dbConfigs?.filter((c: any) => c.configType === 'personal-field').map((cf: any) => (
                        <div key={cf.id} className="flex items-center gap-2 bg-amber-50/50 rounded-lg px-3 py-2 border border-amber-200 group">
                          <div className="flex-1 min-w-0">
                            <span className="text-xs font-bold text-gray-800">{cf.name}</span>
                            <Badge className="text-[6px] h-3 bg-amber-100 text-amber-600 mr-1">{cf.data?.fieldType || 'نص'}</Badge>
                          </div>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => openFieldDialog(cf.name, cf.data?.placeholder||"", cf.data?.fieldType||"text", true, cf.id)}><Edit3 className="w-3 h-3 text-gray-400" /></Button>
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0" onClick={() => { if(confirm('حذف؟')) deleteMut.mutate({ id: cf.id }); }}><Trash2 className="w-3 h-3 text-red-400" /></Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="px-4 pb-3 pt-2 border-t flex gap-2 flex-wrap">
                  <Button size="sm" variant="outline" className="text-xs gap-1" onClick={() => {
                    createMut.mutate({ sectionId: dbKey, configType: 'personal-field', name: 'حقل جديد', data: { fieldType: 'text', placeholder: '', required: false } });
                  }}><Plus className="w-3 h-3" />إضافة حقل شخصي</Button>
                  <Button size="sm" className="text-xs gap-1 bg-teal-600 hover:bg-teal-700" onClick={() => {
                    createMut.mutate({ sectionId: dbKey, configType: 'personal-info-defaults', name: 'القيم الافتراضية', data: { values: personalInfoValues, labels: editedLabels } });
                  }}><Save className="w-3 h-3" />حفظ القيم الافتراضية</Button>
                </div>
              </div>
            </div>
          )}

          {/* Upload settings */}
          {uploadCfg && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Upload className="w-4 h-4" style={{ color: sel.color }} />إعدادات رفع الملفات</h3>
                <Button size="sm" variant="outline" className="gap-1.5 text-xs" onClick={() => openDialog("upload", "إعدادات الرفع")}><Edit3 className="w-3 h-3" />تعديل</Button>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 p-4 grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div><p className="text-[10px] font-bold text-gray-500 mb-1"><FileType className="w-3 h-3 inline ml-1" />أنواع الملفات المسموحة</p>
                  <div className="flex flex-wrap gap-1">{uploadCfg.allowedTypes.map(t => <Badge key={t} className="text-[8px] bg-blue-50 text-blue-600">{t.split("/")[1]}</Badge>)}</div></div>
                <div><p className="text-[10px] font-bold text-gray-500 mb-1"><Maximize className="w-3 h-3 inline ml-1" />الحد الأقصى</p>
                  <span className="text-sm font-bold text-gray-800">{uploadCfg.maxSizeMB} MB</span></div>
                <div><p className="text-[10px] font-bold text-gray-500 mb-1"><ImageIcon className="w-3 h-3 inline ml-1" />أنواع الشواهد</p>
                  <div className="flex flex-wrap gap-1">{uploadCfg.evidenceTypes.map(t => <Badge key={t} className="text-[8px] bg-purple-50 text-purple-600">{t}</Badge>)}</div></div>
              </div>
            </div>
          )}

          {/* Services */}
          <div>
            <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Zap className="w-4 h-4" style={{ color: sel.color }} />الخدمات ({sel.services.length})</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {sel.services.map(svc => (
                <Card key={svc.id} className="border-0 shadow-sm"><CardContent className="p-4">
                  <h4 className="text-xs font-bold text-gray-900 mb-0.5">{svc.title}</h4>
                  <p className="text-[9px] text-gray-500 mb-2 line-clamp-2">{svc.description}</p>
                  <div className="flex gap-1.5 flex-wrap">
                    <Badge className={`text-[8px] ${svc.mode==="interactive"||svc.mode==="both"?"bg-teal-50 text-teal-700":"bg-purple-50 text-purple-700"}`}>{svc.mode==="interactive"||svc.mode==="both"?"تفاعلي":"متجر"}</Badge>
                    {svc.price===0 ? <Badge className="text-[8px] bg-green-50 text-green-700">مجاني</Badge> : <Badge className="text-[8px] bg-amber-50 text-amber-700">{svc.price} ر.س</Badge>}
                  </div>
                </CardContent></Card>
              ))}
            </div>
          </div>



          {/* ═══ SUB-EVIDENCE FIELDS ═══ */}
          {SUB_EVIDENCE_FIELDS[dbKey] && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-bold text-gray-700 flex items-center gap-2"><Layers className="w-4 h-4" style={{ color: sel.color }} />حقول إضافة الشاهد ({SUB_EVIDENCE_FIELDS[dbKey].length})</h3>
                <Button size="sm" variant="outline" onClick={() => openFieldDialog("", "", "text", false)} className="gap-1.5 text-xs"><Plus className="w-3.5 h-3.5" />حقل جديد</Button>
              </div>
              <p className="text-[10px] text-gray-500 mb-2">هذه الحقول يعبئها المستخدم عند إضافة شاهد لأي بند — تظهر في نموذج التقرير</p>
              <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                <table className="w-full text-xs">
                  <thead><tr className="bg-gray-50 border-b"><th className="px-4 py-2 text-right font-bold text-gray-600">الحقل</th><th className="px-4 py-2 text-right font-bold text-gray-600">النوع</th><th className="px-4 py-2 text-right font-bold text-gray-600">التوضيح</th><th className="w-16"></th></tr></thead>
                  <tbody>{SUB_EVIDENCE_FIELDS[dbKey].map(f => (
                    <tr key={f.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50/50">
                      <td className="px-4 py-2.5 font-medium text-gray-800">{f.label}</td>
                      <td className="px-4 py-2.5"><Badge className="text-[8px] bg-teal-50 text-teal-600">{f.type}</Badge></td>
                      <td className="px-4 py-2.5 text-gray-500">{f.placeholder || "—"}</td>
                      <td className="px-4 py-2.5"><Button variant="ghost" size="sm" className="h-6 text-xs" onClick={() => openFieldDialog(f.label, f.placeholder||"", f.type, false)}><Edit3 className="w-3 h-3" /></Button></td>
                    </tr>
                  ))}</tbody>
                </table>
              </div>
            </div>
          )}

          {/* ═══ DISPLAY SETTINGS ═══ */}
          {DISPLAY_SETTINGS[dbKey] && (
            <div>
              <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Eye className="w-4 h-4" style={{ color: sel.color }} />إعدادات العرض والتفاعل</h3>
              <div className="bg-white rounded-xl border border-gray-100 p-4 space-y-3">
                {DISPLAY_SETTINGS[dbKey].map(ds => (
                  <div key={ds.id} className="flex items-center justify-between">
                    <div><p className="text-xs font-medium text-gray-800">{ds.label}</p><p className="text-[10px] text-gray-500">{ds.desc}</p></div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input type="checkbox" defaultChecked={ds.enabled} className="sr-only peer" onChange={() => toast.info("سيتم حفظ الإعدادات عند الضغط على حفظ")} />
                      <div className="w-9 h-5 bg-gray-200 peer-focus:ring-2 peer-focus:ring-teal-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-teal-600" />
                    </label>
                  </div>
                ))}
              </div>
            </div>
          )}

          {sel.route && <div className="bg-gray-50 rounded-xl p-3 border flex items-center gap-2"><Settings2 className="w-4 h-4 text-gray-400" /><span className="text-xs text-gray-500">رابط:</span><code className="text-xs bg-white px-2 py-0.5 rounded border">{sel.route}</code></div>}
        </div>
      );
    }

    // ── Level 0: Section list ──
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div><h2 className="text-xl font-bold text-gray-900" style={{ fontFamily:"'Tajawal'" }}>إدارة أقسام الموقع</h2><p className="text-sm text-gray-500 mt-1">{sections.length} قسم — اضغط للدخول</p></div>
          <div className="relative"><Search className="w-4 h-4 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="بحث..." className="pr-9 pl-4 py-2 rounded-xl border text-sm w-56 focus:outline-none focus:ring-2 focus:ring-teal-500/20" /></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map(s => {
            const I = ICON_MAP[s.icon] || FolderOpen; const c = CONTENT[s.id];
            return (
              <button key={s.id} onClick={() => { setSelSectionId(s.id); setSelTypeId(null); setSelStandardId(null); }} className="bg-white rounded-2xl border border-gray-100 p-5 text-right hover:shadow-lg transition-all relative overflow-hidden">
                <div className="absolute top-0 right-0 left-0 h-1 rounded-t-2xl" style={{ backgroundColor: s.color }} />
                <div className="flex items-start gap-3 mb-3">
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ backgroundColor: s.color+"12" }}><I className="w-6 h-6" style={{ color: s.color }} /></div>
                  <div className="flex-1 min-w-0"><h3 className="font-bold text-gray-900 text-sm">{s.title}</h3><p className="text-[10px] text-gray-500 line-clamp-2">{s.description}</p></div>
                </div>
                <div className="flex gap-1.5 flex-wrap">
                  <span className="px-2 py-0.5 rounded-full text-[9px] bg-blue-50 text-blue-600">{s.services.length} خدمة</span>
                  {c?.types && <span className="px-2 py-0.5 rounded-full text-[9px] bg-purple-50 text-purple-600">{c.types.length} نوع</span>}
                  {c?.fields && <span className="px-2 py-0.5 rounded-full text-[9px] bg-amber-50 text-amber-600">{c.fields.length} حقل</span>}
                </div>
              </button>
            );
          })}
        </div>
      </div>
    );
  };

  /* ═══ RENDER ═══ */
  return (
    <>
      {renderContent()}

      {/* ══════ SHARED DIALOG (always rendered) ══════ */}
      <Dialog open={dialogOpen} onOpenChange={v => { if (!v) closeDialog(); }}>
        <DialogContent dir="rtl" className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle className="flex items-center gap-2">
            {dialogEditId ? "✏️ تعديل" : "➕ إضافة"} {dialogMode === "type" ? "نوع" : dialogMode === "field" ? "حقل" : dialogMode === "standard" ? "معيار" : dialogMode === "item" ? "بند" : dialogMode === "subitem" ? "بند فرعي" : "إعدادات الرفع"}
          </DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div><label className="block text-xs font-medium text-gray-600 mb-1">الاسم / العنوان *</label>
              <input value={formName} onChange={e => setFormName(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm focus:ring-2 focus:ring-teal-500/20 focus:outline-none" placeholder="أدخل الاسم..." /></div>

            {dialogMode !== "upload" && (
              <div><label className="block text-xs font-medium text-gray-600 mb-1">
                {dialogMode === "field" ? "النص التوضيحي" : dialogMode === "item" || dialogMode === "subitem" ? "الشواهد المقترحة (سطر لكل شاهد)" : "الوصف"}</label>
                <textarea value={formDesc} onChange={e => setFormDesc(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border text-sm resize-none focus:ring-2 focus:ring-teal-500/20 focus:outline-none" placeholder="أدخل التفاصيل..." /></div>
            )}

            {dialogMode === "field" && (
              <>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">نوع الحقل</label>
                  <select value={formFieldType} onChange={e => setFormFieldType(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm bg-white">
                    {[["text","نص"],["textarea","نص طويل"],["date","تاريخ"],["number","رقم"],["select","قائمة منسدلة"],["file","ملف"]].map(([v,l]) => <option key={v} value={v}>{l} ({v})</option>)}
                  </select></div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={formRequired} onChange={e => setFormRequired(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-teal-600" />
                  <span className="text-xs text-gray-700">حقل مطلوب</span>
                </label>
              </>
            )}

            {dialogMode === "upload" && (
              <>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">أنواع الملفات (مفصولة بفواصل)</label>
                  <input value={formUploadTypes} onChange={e => setFormUploadTypes(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="image/png, image/jpeg, application/pdf" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">الحد الأقصى للحجم (MB)</label>
                  <input type="number" value={formMaxSize} onChange={e => setFormMaxSize(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" /></div>
                <div><label className="block text-xs font-medium text-gray-600 mb-1">أنواع الشواهد المسموحة (مفصولة بفواصل)</label>
                  <input value={formEvidenceTypes} onChange={e => setFormEvidenceTypes(e.target.value)} className="w-full px-3 py-2 rounded-lg border text-sm" placeholder="صورة, رابط, فيديو, ملف, نص" /></div>
              </>
            )}
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={closeDialog}>إلغاء</Button>
            <Button disabled={!formName.trim() || createMut.isPending || updateMut.isPending} className="gap-1.5 bg-teal-600 hover:bg-teal-700" onClick={handleSave}>
              {(createMut.isPending||updateMut.isPending) ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              حفظ
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
