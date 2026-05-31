/**
 * لوحة تحكم المدير الشاملة — SERS Admin Dashboard v2
 * 8 أقسام: إحصائيات، مستخدمين، أقسام، قوالب، ملفات إنجاز، سجل عمليات، ذكاء اصطناعي، إعدادات
 */
import { useState, useMemo, useEffect, useRef, lazy, Suspense } from "react";
import { useLocation } from "wouter";
import TemplateRealisticPreview from "@/components/admin/TemplateRealisticPreview";
import A4PreviewFrame, { A4PreviewDialog } from "@/components/admin/A4PreviewFrame";
import { TEMPLATE_SECTIONS, filterBySection, getSectionId, countBySection, isCanvasTemplate } from "@/lib/TemplateRegistry";
import FieldSchemaBuilder, { type SchemaField } from "@/components/admin/FieldSchemaBuilder";
import LegacyEditModal from "@/components/admin/LegacyEditModal";
import { getMoeLogoUrl } from "@/components/MoeLogo";
import { useAuth } from "@/_core/hooks/useAuth";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import {
  ArrowLeft, CheckCircle, XCircle, Clock, Eye, FileText,
  Search, Loader2, MessageSquare, Layout, Save,
  Users, BarChart3, ShieldCheck, ThumbsUp, ThumbsDown,
  Palette, FolderOpen, Settings, ChevronLeft,
  ChevronRight, Menu, X, Plus, Trash2, Edit3, ToggleLeft,
  ToggleRight, Star, AlertTriangle, Brain, Activity,
  Upload, Image as ImageIcon, EyeOff,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter,
  DialogHeader, DialogTitle,
} from "@/components/ui/dialog";

// Lazy-load heavy panels
const StatsPanel = lazy(() => import("@/components/admin/panels/StatsPanel"));
const UsersPanel = lazy(() => import("@/components/admin/panels/UsersPanel"));
const SectionsPanel = lazy(() => import("@/components/admin/panels/SectionsPanel"));
const ActivityPanel = lazy(() => import("@/components/admin/panels/ActivityPanel"));
const AIPanel = lazy(() => import("@/components/admin/panels/AIPanel"));

const STATUS_MAP: Record<string, { label: string; color: string; icon: any; bg: string }> = {
  draft: { label: "مسودة", color: "#6B7280", icon: FileText, bg: "bg-gray-100 text-gray-600" },
  submitted: { label: "مقدّم للمراجعة", color: "#2563EB", icon: Clock, bg: "bg-blue-100 text-blue-700" },
  reviewed: { label: "تمت المراجعة", color: "#CA8A04", icon: Eye, bg: "bg-amber-100 text-amber-700" },
  approved: { label: "معتمد", color: "#16A34A", icon: CheckCircle, bg: "bg-teal-100 text-teal-700" },
  rejected: { label: "مرفوض", color: "#DC2626", icon: XCircle, bg: "bg-red-100 text-red-600" },
};

const JOB_TITLES: Record<string, string> = {
  teacher: "معلم / معلمة", principal: "مدير / مديرة مدرسة", vice_principal: "وكيل / وكيلة مدرسة",
  counselor: "موجه/ة طلابي/ة", health_counselor: "موجه/ة صحي/ة", supervisor: "مشرف/ة تربوي/ة",
  librarian: "أمين/ة مصادر تعلم", kindergarten: "معلمة رياض أطفال",
  special_ed: "معلم/ة تربية خاصة", admin_assistant: "مساعد/ة إداري/ة",
};

type AdminTab = "stats" | "users" | "sections" | "templates" | "portfolios" | "activity" | "ai" | "settings";

// ─── أقسام القوالب (from TemplateRegistry) ────────────────────────────
// TEMPLATE_SECTIONS is now imported from @/lib/TemplateRegistry

// ─── مكون إدارة القوالب (Dual-Template Architecture: Legacy + Canvas) ────
function TemplatesPanel() {
  const [, navigate] = useLocation();
  const { data: templates, isLoading, refetch } = trpc.templates.listAll.useQuery();
  const { data: sectionThemes, refetch: refetchSections } = trpc.sectionConfigs.list.useQuery({ sectionId: undefined });
  const createMutation = trpc.templates.create.useMutation({
    onSuccess: (newTemplate: any) => {
      refetch();
      toast.success("تم إنشاء القالب — جاري فتح المحرر المرئي...");
      if (newTemplate?.id) {
        navigate(`/admin/templates/${newTemplate.id}`);
      }
    },
  });
  const updateMutation = trpc.templates.update.useMutation({
    onSuccess: () => { refetch(); toast.success("تم تحديث القالب"); setEditingLegacy(null); },
  });
  const deleteMutation = trpc.templates.delete.useMutation({ onSuccess: () => { refetch(); toast.success("تم حذف القالب"); } });
  const seedMutation = trpc.templates.seed.useMutation({ onSuccess: () => { refetch(); toast.success("تم إضافة القوالب الافتراضية"); } });
  const createSectionConfig = trpc.sectionConfigs.create.useMutation({ onSuccess: () => { refetchSections(); toast.success("تم إنشاء الثيم"); } });
  const deleteSectionConfig = trpc.sectionConfigs.delete.useMutation({ onSuccess: () => { refetchSections(); toast.success("تم حذف الثيم"); } });

  const [activeSection, setActiveSection] = useState("all");
  const [previewTemplate, setPreviewTemplate] = useState<any | null>(null);

  // ─── Legacy Edit Modal State ─────────────────────────────────
  const [editingLegacy, setEditingLegacy] = useState<any | null>(null);
  const updateFormSchema = trpc.templates.updateFormSchema.useMutation({
    onSuccess: () => toast.success("تم حفظ هيكل الحقول"),
  });

  const openLegacyEdit = (t: any) => {
    setEditingLegacy(t);
  };

  const handleLegacyModalSave = (data: {
    id: number;
    colorFields: Record<string, any>;
    layoutFields: Record<string, any>;
    fieldsSchema: SchemaField[];
  }) => {
    const existingLayout = editingLegacy?.templateLayout || {};
    updateMutation.mutate({
      id: data.id,
      ...data.colorFields,
      templateLayout: {
        ...existingLayout,
        ...data.layoutFields,
      },
    });
    updateFormSchema.mutate({
      id: data.id,
      formSchema: {
        version: 1,
        sections: [{ id: 'main', title: 'الحقول الرئيسية', fields: data.fieldsSchema }],
      },
    });
  };

  // ─── إنشاء قالب Canvas جديد → فتح المحرر المرئي فوراً ─────
  const handleAddNewCanvasTemplate = () => {
    createMutation.mutate({
      name: "قالب جديد (مرئي)",
      description: "قالب تم إنشاؤه عبر المحرر المرئي",
      headerBg: "#1a6b6a",
      headerText: "#ffffff",
      accent: "#1a6b6a",
      borderColor: "#2ea87a",
      bodyBg: "#ffffff",
      templateLayout: {
        version: 1,
        pageSize: 'A4' as const,
        direction: 'rtl' as const,
        layoutType: 'white-header-classic',
        fieldStyle: 'fieldset',
        titleStyle: 'rounded',
        signatureStyle: 'dotted',
        footerStyle: 'gradient',
        showMoeLogo: true,
        showSchoolLogo: true,
        showEvidenceSection: true,
        evidenceDisplay: 'mixed',
        sections: [],
        footerText: 'SERS - نظام السجلات التعليمية الذكي',
        signatureLabels: { right: 'المعلم / اسم المعلم', left: 'مدير المدرسة / اسم المدير' },
      },
    });
  };

  if (isLoading) return <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto mb-3" /><p className="text-sm text-gray-500">جاري تحميل القوالب...</p></div>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>إدارة القوالب والتصاميم</h2>
          <p className="text-sm text-gray-500 mt-1">القوالب الجاهزة تُعدَّل بالألوان — القوالب المرئية تُعدَّل بالمحرر</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>
            {seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Star className="w-4 h-4" />}
            <span className="mr-1">قوالب افتراضية</span>
          </Button>
          <Button size="sm" onClick={handleAddNewCanvasTemplate} disabled={createMutation.isPending} className="bg-teal-600 hover:bg-teal-700 gap-1.5">
            {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
            إضافة قالب جديد (مرئي)
          </Button>
        </div>
      </div>

      {/* ═══ Section Tabs ═══ */}
      <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-hide">
        {TEMPLATE_SECTIONS.map(sec => {
          const isActive = activeSection === sec.id;
          const sectionCounts = countBySection(templates || []);
          const count = sec.id === "all"
            ? (templates?.length || 0)
            : (sectionCounts.get(sec.id) || 0)
              + (sectionThemes?.filter((c: any) => c.sectionId === sec.id && c.configType === 'theme').length || 0);
          return (
            <button key={sec.id} onClick={() => setActiveSection(sec.id)}
              className={`flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium whitespace-nowrap transition-all border
                ${isActive ? 'border-gray-300 bg-white shadow-sm text-gray-900' : 'border-transparent bg-gray-50 text-gray-500 hover:bg-gray-100'}`}>
              <span>{sec.icon}</span>
              <span>{sec.label}</span>
              {count > 0 && <span className="text-[9px] px-1.5 py-0.5 rounded-full" style={{ background: isActive ? `${sec.color}15` : '#f3f4f6', color: isActive ? sec.color : '#9CA3AF' }}>{count}</span>}
            </button>
          );
        })}
      </div>

      {/* ═══ Template Cards — Dual Architecture ═══ */}
      {(() => {
        const allTemplates = templates || [];
        const filtered = filterBySection(allTemplates, activeSection);
        if (filtered.length === 0) return (
          <div className="text-center py-16"><Palette className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500 mb-4">لا توجد قوالب — اضغط لإضافة القوالب الافتراضية</p>
            <Button variant="outline" onClick={() => seedMutation.mutate()} disabled={seedMutation.isPending}>{seedMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-1" /> : <Star className="w-4 h-4 ml-1" />}إضافة القوالب الافتراضية (10 قوالب)</Button></div>
        );
        return (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((t: any) => {
            const layout = t.templateLayout || {};
            const fieldStyle = layout.fieldStyle || 'fieldset';
            const lType = layout.layoutType || t.layoutType || 'white-header-classic';
            const isCanvas = isCanvasTemplate(t);
            return (
            <Card key={t.id} className={`border-0 shadow-sm hover:shadow-md transition-all ${!t.isActive ? 'opacity-60' : ''}`}>
              {/* A4 Mini Preview via iframe */}
              <div className="rounded-t-xl overflow-hidden border-b cursor-pointer" style={{ height: '200px' }} onClick={() => setPreviewTemplate(t)}>
                <A4PreviewFrame fixedScale={0.17} showShadow={false}>
                  <TemplateRealisticPreview template={t} scale={1} />
                </A4PreviewFrame>
              </div>
              <CardContent className="p-3">
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {t.isDefault && <Badge className="bg-amber-100 text-amber-700 text-[9px]">افتراضي</Badge>}
                    <Badge className={t.isActive ? 'bg-teal-100 text-teal-700 text-[9px]' : 'bg-gray-100 text-gray-500 text-[9px]'}>{t.isActive ? 'نشط' : 'معطل'}</Badge>
                    {/* Template type badge */}
                    <Badge className={isCanvas ? 'bg-violet-100 text-violet-700 text-[9px]' : 'bg-blue-100 text-blue-700 text-[9px]'}>
                      {isCanvas ? '🎨 مرئي' : '⚙️ جاهز'}
                    </Badge>
                  </div>
                  <div className="flex gap-1 flex-wrap">
                    {lType && <span className="px-1 py-0.5 rounded text-[7px] bg-blue-50 text-blue-600 border border-blue-100">{lType}</span>}
                    {fieldStyle && <span className="px-1 py-0.5 rounded text-[7px] bg-purple-50 text-purple-600 border border-purple-100">{fieldStyle}</span>}
                  </div>
                </div>
                <p className="text-xs font-bold text-gray-800 mb-1 line-clamp-1">{t.name}</p>
                {t.description && <p className="text-[10px] text-gray-500 mb-2 line-clamp-1">{t.description}</p>}

                {/* ═══ Dual-Action Buttons ═══ */}
                <div className="flex items-center gap-1.5">
                  {isCanvas ? (
                    /* Canvas template → navigate to Builder */
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-8 border-violet-200 text-violet-700 hover:bg-violet-50"
                      onClick={() => navigate(`/admin/templates/${t.id}`)}>
                      <Layout className="w-3 h-3 ml-1" />تعديل بالمحرر
                    </Button>
                  ) : (
                    /* Legacy template → open edit modal with colors + preview */
                    <Button variant="outline" size="sm" className="flex-1 text-xs h-8 border-teal-200 text-teal-700 hover:bg-teal-50"
                      onClick={() => openLegacyEdit(t)}>
                      <Edit3 className="w-3 h-3 ml-1" />تعديل
                    </Button>
                  )}
                  <Button variant="outline" size="sm" className="text-xs h-8 border-blue-200 text-blue-600 hover:bg-blue-50" onClick={() => setPreviewTemplate(t)}>
                    <Eye className="w-3 h-3 ml-1" />معاينة
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8" onClick={() => updateMutation.mutate({ id: t.id, isActive: !t.isActive })}>
                    {t.isActive ? <ToggleRight className="w-4 h-4 text-teal-600" /> : <ToggleLeft className="w-4 h-4 text-gray-400" />}
                  </Button>
                  <Button variant="outline" size="sm" className="text-xs h-8 text-red-500 hover:text-red-700"
                    onClick={() => { if (confirm('حذف هذا القالب؟')) deleteMutation.mutate({ id: t.id }); }}>
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );})}
        </div>
        );
      })()}

      {/* ═══ Full-Size Preview Dialog ═══ */}
      <A4PreviewDialog
        isOpen={!!previewTemplate}
        onClose={() => setPreviewTemplate(null)}
        templateName={previewTemplate?.name}
        onEdit={() => {
          if (previewTemplate) {
            if (isCanvasTemplate(previewTemplate)) {
              navigate(`/admin/templates/${previewTemplate.id}`);
            } else {
              openLegacyEdit(previewTemplate);
            }
            setPreviewTemplate(null);
          }
        }}
      >
        {previewTemplate && <TemplateRealisticPreview template={previewTemplate} scale={1} />}
      </A4PreviewDialog>

      {/* ═══ Legacy Edit Modal — Full-Screen Split-Screen Workspace ═══ */}
      <LegacyEditModal
        template={editingLegacy}
        onClose={() => setEditingLegacy(null)}
        onSave={handleLegacyModalSave}
        isSaving={updateMutation.isPending || updateFormSchema.isPending}
      />

      {/* ═══ Section Color Themes ═══ */}
      {activeSection !== "all" && (
        <Card className="border-0 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">{TEMPLATE_SECTIONS.find(s => s.id === activeSection)?.icon} ثيمات الألوان — {TEMPLATE_SECTIONS.find(s => s.id === activeSection)?.label}</span>
              <Button size="sm" variant="outline" className="text-xs gap-1 h-7" onClick={() => {
                const sec = TEMPLATE_SECTIONS.find(s => s.id === activeSection);
                createSectionConfig.mutate({
                  sectionId: activeSection,
                  configType: 'theme',
                  name: `ثيم جديد — ${sec?.label || activeSection}`,
                  data: { primaryColor: sec?.color || '#059669', secondaryColor: '#14b8a6', accentColor: '#5eead4', headerBg: sec?.color || '#059669', headerText: '#ffffff', bodyBg: '#ffffff', borderColor: '#99f6e4', fontFamily: 'Cairo' },
                });
              }}><Plus className="w-3 h-3" />إضافة ثيم</Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {(() => {
              const themes = sectionThemes?.filter((c: any) => c.sectionId === activeSection && c.configType === 'theme') || [];
              if (themes.length === 0) return <p className="text-xs text-gray-400 text-center py-4">لا توجد ثيمات مخصصة — اضغط "إضافة ثيم" لإنشاء واحد</p>;
              return (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                  {themes.map((cfg: any) => {
                    const d = cfg.data || {};
                    return (
                      <div key={cfg.id} className="bg-gray-50 rounded-xl p-3 border border-gray-100 hover:border-gray-200 transition-all group">
                        <div className="flex gap-1 mb-2">
                          <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: d.primaryColor || '#059669' }} />
                          <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: d.secondaryColor || '#14b8a6' }} />
                          <div className="w-6 h-6 rounded-full border-2 border-white shadow" style={{ backgroundColor: d.accentColor || '#5eead4' }} />
                        </div>
                        <p className="text-[10px] font-bold text-gray-700 truncate">{cfg.name}</p>
                        <div className="flex gap-1 mt-2">
                          <Button variant="ghost" size="sm" className="h-5 w-5 p-0 opacity-0 group-hover:opacity-100 text-red-400" onClick={() => { if(confirm('حذف؟')) deleteSectionConfig.mutate({ id: cfg.id }); }}><Trash2 className="w-3 h-3" /></Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ─── ملفات الإنجاز ────────────────────────────
function PortfoliosPanel() {
  const { user } = useAuth();
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState("");
  const [reviewDialog, setReviewDialog] = useState<{ id: number; action: string } | null>(null);
  const [reviewNotes, setReviewNotes] = useState("");
  const [selectedPortfolioId, setSelectedPortfolioId] = useState<number | null>(null);

  const { data: portfoliosData, isLoading, refetch } = trpc.admin.portfolios.useQuery(
    { page, limit: 20, status: statusFilter }, { enabled: user?.role === "admin" }
  );
  const reviewMutation = trpc.admin.review.useMutation({
    onSuccess: () => { refetch(); setReviewDialog(null); setReviewNotes(""); toast.success("تم تحديث حالة الملف"); },
  });
  const { data: portfolioDetail } = trpc.admin.portfolioDetail.useQuery(
    { id: selectedPortfolioId! }, { enabled: !!selectedPortfolioId }
  );

  const items = portfoliosData?.items || [];
  const total = portfoliosData?.total || 0;

  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return items;
    const q = searchQuery.toLowerCase();
    return items.filter((item: any) => (item.userName || "").toLowerCase().includes(q) || (item.userEmail || "").toLowerCase().includes(q));
  }, [items, searchQuery]);

  if (selectedPortfolioId && portfolioDetail) {
    const p = portfolioDetail;
    const personalInfo = (p.personalInfo || {}) as Record<string, string>;
    return (
      <div>
        <Button variant="outline" size="sm" onClick={() => setSelectedPortfolioId(null)} className="mb-4 gap-1.5"><ArrowLeft className="w-4 h-4" />العودة</Button>
        <Card className="border-0 shadow-sm mb-4">
          <CardHeader><CardTitle className="text-sm">بيانات المعلم</CardTitle></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Object.entries(personalInfo).map(([key, val]) => (
                <div key={key} className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500 mb-0.5">{key}</p><p className="text-sm font-medium text-gray-900">{val || "—"}</p></div>
              ))}
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500 mb-0.5">الوظيفة</p><p className="text-sm font-medium text-gray-900">{JOB_TITLES[p.jobId] || p.jobTitle}</p></div>
              <div className="bg-gray-50 rounded-lg p-3"><p className="text-[10px] text-gray-500 mb-0.5">نسبة الإكمال</p><p className="text-sm font-medium text-gray-900">{p.completionPercentage || 0}%</p></div>
            </div>
          </CardContent>
        </Card>
        {(p as any).files && (p as any).files.length > 0 && (
          <Card className="border-0 shadow-sm">
            <CardHeader><CardTitle className="text-sm">الملفات المرفوعة ({(p as any).files.length})</CardTitle></CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {(p as any).files.map((file: any) => (
                  <a key={file.id} href={file.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 p-3 rounded-lg border hover:bg-gray-50">
                    <FileText className="w-4 h-4 text-gray-400" /><span className="text-sm truncate">{file.originalName}</span>
                  </a>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>مراجعة ملفات الإنجاز</h2><p className="text-sm text-gray-500 mt-1">اعتماد ورفض ملفات الإنجاز المقدمة</p></div>
      {/* بحث وفلترة */}
      <Card className="border-0 shadow-sm">
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} placeholder="بحث بالاسم..."
                className="w-full pr-10 pl-4 py-2.5 rounded-xl bg-gray-50 border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button variant={!statusFilter ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(undefined)}>الكل</Button>
              {Object.entries(STATUS_MAP).map(([key, val]) => (
                <Button key={key} variant={statusFilter === key ? "default" : "outline"} size="sm" onClick={() => setStatusFilter(key)}>{val.label}</Button>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>
      {isLoading ? (
        <div className="text-center py-16"><Loader2 className="w-8 h-8 animate-spin text-teal-600 mx-auto" /></div>
      ) : filteredItems.length === 0 ? (
        <div className="text-center py-16"><FileText className="w-12 h-12 text-gray-300 mx-auto mb-4" /><p className="text-gray-500">لا توجد ملفات إنجاز</p></div>
      ) : (
        <div className="space-y-3">
          {filteredItems.map((item: any) => {
            const statusInfo = STATUS_MAP[item.status] || STATUS_MAP.draft;
            return (
              <Card key={item.id} className="border-0 shadow-sm hover:shadow-md transition-shadow cursor-pointer" onClick={() => setSelectedPortfolioId(item.id)}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-gray-100 flex items-center justify-center"><FileText className="w-5 h-5 text-gray-500" /></div>
                      <div>
                        <h3 className="font-bold text-gray-900 text-sm">{item.userName || "بدون اسم"}</h3>
                        <div className="flex items-center gap-3 text-xs text-gray-500 mt-0.5">
                          <span>{JOB_TITLES[item.jobId] || item.jobTitle}</span><span>·</span><span>{item.userEmail || "—"}</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-center hidden sm:block"><p className="text-sm font-bold text-gray-900">{item.completionPercentage || 0}%</p><p className="text-[10px] text-gray-500">اكتمال</p></div>
                      <Badge className={statusInfo.bg}>{statusInfo.label}</Badge>
                      {item.status === "submitted" && (
                        <div className="flex gap-1">
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-teal-600" onClick={(e) => { e.stopPropagation(); setReviewDialog({ id: item.id, action: "approved" }); }}><ThumbsUp className="w-4 h-4" /></Button>
                          <Button variant="ghost" size="icon" className="h-8 w-8 text-red-500" onClick={(e) => { e.stopPropagation(); setReviewDialog({ id: item.id, action: "rejected" }); }}><ThumbsDown className="w-4 h-4" /></Button>
                        </div>
                      )}
                    </div>
                  </div>
                  {item.reviewNotes && (<div className="mt-3 mr-15 p-2 bg-gray-50 rounded-lg"><p className="text-xs text-gray-600"><MessageSquare className="w-3 h-3 inline ml-1" />{item.reviewNotes}</p></div>)}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
      {total > 20 && (
        <div className="flex items-center justify-center gap-2 mt-6">
          <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>السابق</Button>
          <span className="text-sm text-gray-500">صفحة {page} من {Math.ceil(total / 20)}</span>
          <Button variant="outline" size="sm" disabled={page >= Math.ceil(total / 20)} onClick={() => setPage(p => p + 1)}>التالي</Button>
        </div>
      )}
      <Dialog open={!!reviewDialog} onOpenChange={() => setReviewDialog(null)}>
        <DialogContent dir="rtl">
          <DialogHeader><DialogTitle>{reviewDialog?.action === "approved" ? "اعتماد ملف الإنجاز" : "رفض ملف الإنجاز"}</DialogTitle>
            <DialogDescription>{reviewDialog?.action === "approved" ? "هل أنت متأكد من اعتماد هذا الملف؟" : "هل أنت متأكد من رفض هذا الملف؟"}</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">ملاحظات المراجعة</label>
            <textarea value={reviewNotes} onChange={(e) => setReviewNotes(e.target.value)} placeholder="أضف ملاحظاتك..." rows={3}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-teal-500/20" />
          </div>
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setReviewDialog(null)}>إلغاء</Button>
            <Button onClick={() => reviewMutation.mutate({ portfolioId: reviewDialog!.id, status: reviewDialog!.action as any, notes: reviewNotes })}
              disabled={reviewMutation.isPending} className={reviewDialog?.action === "approved" ? "bg-teal-600 hover:bg-teal-700" : "bg-red-600 hover:bg-red-700"}>
              {reviewMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin ml-2" /> : null}
              {reviewDialog?.action === "approved" ? "اعتماد" : "رفض"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── إعدادات ────────────────────────────
function SettingsPanel() {
  return (
    <div className="space-y-6">
      <div><h2 className="text-xl font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>إعدادات النظام</h2><p className="text-sm text-gray-500 mt-1">إعدادات ومعلومات النظام العامة</p></div>
      <Card className="border-0 shadow-sm">
        <CardHeader><CardTitle className="text-sm flex items-center gap-2"><Settings className="w-4 h-4 text-gray-500" />معلومات النظام</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-100">
            <div className="flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-blue-500 mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-blue-800">نظام SERS — نظام السجلات التعليمية الذكي</p>
                <p className="text-xs text-blue-600 mt-1">النظام يدعم تعدد المستخدمين مع فصل كامل للبيانات. كل مستخدم يرى بياناته فقط. المدير يمكنه مراجعة جميع الملفات واعتمادها أو رفضها.</p>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-2">صلاحيات المستخدمين</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                {["رفع وإدارة الشواهد", "تصدير PDF بقوالب متعددة", "مشاركة الملف برابط", "التصنيف الذكي بالذكاء الاصطناعي", "بناء السيرة الذاتية والاختبارات", "الإذاعة المدرسية وملف الإنجاز"].map(p => (
                  <li key={p} className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-teal-500" />{p}</li>
                ))}
              </ul>
            </div>
            <div className="bg-gray-50 rounded-xl p-4">
              <h4 className="text-sm font-bold text-gray-900 mb-2">صلاحيات المدير</h4>
              <ul className="space-y-2 text-xs text-gray-600">
                {["مراجعة واعتماد جميع الملفات", "إدارة القوالب والثيمات بالكامل", "إدارة المستخدمين والصلاحيات", "عرض الإحصائيات المتقدمة", "سجل العمليات الكامل", "توصيات الذكاء الاصطناعي"].map(p => (
                  <li key={p} className="flex items-center gap-2"><CheckCircle className="w-3 h-3 text-teal-500" />{p}</li>
                ))}
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── المكون الرئيسي ────────────────────────────
export default function AdminDashboard() {
  const [, navigate] = useLocation();
  const { user, loading: authLoading } = useAuth();
  const [activeTab, setActiveTab] = useState<AdminTab>("stats");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  if (authLoading) return <div className="min-h-screen flex items-center justify-center bg-slate-50" dir="rtl"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>;

  if (!user || user.role !== "admin") {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4" dir="rtl">
        <Card className="w-full max-w-md shadow-xl border-0">
          <CardContent className="p-8 text-center">
            <ShieldCheck className="w-16 h-16 text-red-400 mx-auto mb-4" />
            <h1 className="text-xl font-bold text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>صلاحية غير كافية</h1>
            <p className="text-sm text-gray-500 mb-6">هذه الصفحة متاحة للمديرين فقط</p>
            <Button onClick={() => navigate("/")} className="bg-teal-600 hover:bg-teal-700">العودة للرئيسية</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const TABS: { id: AdminTab; label: string; icon: any; description: string }[] = [
    { id: "stats", label: "الإحصائيات", icon: BarChart3, description: "نظرة شاملة على المنصة" },
    { id: "users", label: "المستخدمين", icon: Users, description: "إدارة المستخدمين والصلاحيات" },
    { id: "sections", label: "الأقسام", icon: FolderOpen, description: "إدارة أقسام وخدمات المنصة" },
    { id: "templates", label: "القوالب", icon: Palette, description: "إدارة قوالب PDF والمحرر" },
    { id: "portfolios", label: "المراجعات", icon: FileText, description: "مراجعة المحتوى والملفات" },
    { id: "activity", label: "سجل العمليات", icon: Activity, description: "متابعة جميع العمليات" },
    { id: "ai", label: "الذكاء الاصطناعي", icon: Brain, description: "توصيات وتحليل ذكي" },
    { id: "settings", label: "الإعدادات", icon: Settings, description: "إعدادات النظام العامة" },
  ];

  return (
    <div className="min-h-screen bg-slate-50 flex" dir="rtl">
      {mobileSidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 lg:hidden" onClick={() => setMobileSidebarOpen(false)} />}

      {/* Sidebar */}
      <aside className={`fixed top-0 right-0 h-full bg-white border-l border-gray-200 z-50 transition-all duration-300 flex flex-col
        ${mobileSidebarOpen ? "translate-x-0" : "translate-x-full lg:translate-x-0"}
        ${sidebarCollapsed ? "w-16" : "w-64"}`}>
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          {!sidebarCollapsed && (
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-teal-600 to-emerald-600 flex items-center justify-center shadow-lg shadow-teal-600/20">
                <ShieldCheck className="w-5 h-5 text-white" />
              </div>
              <div>
                <h1 className="text-sm font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>لوحة الإدارة</h1>
                <p className="text-[10px] text-gray-500">SERS Admin Panel</p>
              </div>
            </div>
          )}
          <button onClick={() => setSidebarCollapsed(!sidebarCollapsed)} className="hidden lg:flex w-8 h-8 rounded-lg hover:bg-gray-100 items-center justify-center text-gray-400">
            {sidebarCollapsed ? <ChevronLeft className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          <button onClick={() => setMobileSidebarOpen(false)} className="lg:hidden text-gray-400"><X className="w-5 h-5" /></button>
        </div>

        <nav className="flex-1 p-2 space-y-1 overflow-y-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button key={tab.id} onClick={() => { setActiveTab(tab.id); setMobileSidebarOpen(false); }}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all
                  ${isActive ? "bg-teal-50 text-teal-700 font-semibold" : "text-gray-600 hover:bg-gray-50"}
                  ${sidebarCollapsed ? "justify-center" : ""}`}
                title={sidebarCollapsed ? tab.label : undefined}>
                <Icon className={`w-5 h-5 shrink-0 ${isActive ? "text-teal-600" : "text-gray-400"}`} />
                {!sidebarCollapsed && (
                  <div className="text-right flex-1">
                    <span className="block">{tab.label}</span>
                    <span className="block text-[10px] text-gray-400 font-normal">{tab.description}</span>
                  </div>
                )}
              </button>
            );
          })}
        </nav>

        <div className="p-3 border-t border-gray-100">
          <button onClick={() => navigate("/")} className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-gray-500 hover:bg-gray-50 transition-all ${sidebarCollapsed ? "justify-center" : ""}`}>
            <ArrowLeft className="w-4 h-4" />
            {!sidebarCollapsed && <span>العودة للموقع</span>}
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex-1 min-h-screen transition-all duration-300 ${sidebarCollapsed ? "lg:mr-16" : "lg:mr-64"}`}>
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-gray-100">
          <div className="flex items-center justify-between px-6 py-3">
            <div className="flex items-center gap-3">
              <button onClick={() => setMobileSidebarOpen(true)} className="lg:hidden text-gray-600"><Menu className="w-5 h-5" /></button>
              <h2 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>{TABS.find(t => t.id === activeTab)?.label}</h2>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1.5"><ShieldCheck className="w-3.5 h-3.5" />{user.name || "مدير"}</Badge>
            </div>
          </div>
        </header>

        <div className="p-6">
          <Suspense fallback={<div className="flex items-center justify-center py-20"><Loader2 className="w-8 h-8 animate-spin text-teal-600" /></div>}>
            {activeTab === "stats" && <StatsPanel />}
            {activeTab === "users" && <UsersPanel />}
            {activeTab === "sections" && <SectionsPanel />}
            {activeTab === "templates" && <TemplatesPanel />}
            {activeTab === "portfolios" && <PortfoliosPanel />}
            {activeTab === "activity" && <ActivityPanel />}
            {activeTab === "ai" && <AIPanel />}
            {activeTab === "settings" && <SettingsPanel />}
          </Suspense>
        </div>
      </main>
    </div>
  );
}
