/*
 * شهادات الشكر والتقدير - إعادة بناء كاملة
 * الهوية البصرية: إطار مزخرف + شعار وزارة التعليم + فوتر منحني
 * 7 ثيمات مختلفة تماماً
 * كل نوع شهادة له تنسيق مختلف
 * متوافق مع جميع الأجهزة
 */
import { useState, useMemo, useRef, useEffect } from "react";
import { ArrowLeft, Download, Printer, Palette, Type, Check, Eye, ChevronDown, ChevronUp, Sparkles } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";
import { MoeLogo } from "@/components/MoeLogo";
import { toast } from "sonner";
import { trpc } from "@/lib/trpc";

/* ═══ 7 ثيمات مختلفة تماماً ═══ */
const CERT_THEMES = [
  {
    id: "green-official",
    name: "الهوية الرسمية",
    bg: "#ffffff",
    borderColor: "#1a3a5c",
    headerColor: "#1a3a5c",
    textColor: "#1a1a1a",
    accentColor: "#2ea87a",
    gradientStart: "#1a3a5c",
    gradientMid: "#1a5f3f",
    gradientEnd: "#2ea87a",
    borderStyle: "double" as const,
  },
  {
    id: "gold-elegant",
    name: "الذهبي الأنيق",
    bg: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 50%, #fffbeb 100%)",
    borderColor: "#92400e",
    headerColor: "#78350f",
    textColor: "#1a1a1a",
    accentColor: "#d97706",
    gradientStart: "#78350f",
    gradientMid: "#92400e",
    gradientEnd: "#d97706",
    borderStyle: "double" as const,
  },
  {
    id: "blue-modern",
    name: "الأزرق العصري",
    bg: "linear-gradient(135deg, #eff6ff 0%, #dbeafe 50%, #eff6ff 100%)",
    borderColor: "#1e40af",
    headerColor: "#1e3a8a",
    textColor: "#1a1a1a",
    accentColor: "#2563eb",
    gradientStart: "#1e3a8a",
    gradientMid: "#1e40af",
    gradientEnd: "#3b82f6",
    borderStyle: "solid" as const,
  },
  {
    id: "purple-premium",
    name: "البنفسجي الفاخر",
    bg: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #faf5ff 100%)",
    borderColor: "#6d28d9",
    headerColor: "#5b21b6",
    textColor: "#1a1a1a",
    accentColor: "#8b5cf6",
    gradientStart: "#5b21b6",
    gradientMid: "#6d28d9",
    gradientEnd: "#8b5cf6",
    borderStyle: "double" as const,
  },
  {
    id: "red-patriotic",
    name: "الأحمر الوطني",
    bg: "#ffffff",
    borderColor: "#991b1b",
    headerColor: "#7f1d1d",
    textColor: "#1a1a1a",
    accentColor: "#dc2626",
    gradientStart: "#7f1d1d",
    gradientMid: "#991b1b",
    gradientEnd: "#dc2626",
    borderStyle: "solid" as const,
  },
  {
    id: "teal-fresh",
    name: "أخضر مائي",
    bg: "linear-gradient(135deg, #f0fdfa 0%, #ccfbf1 50%, #f0fdfa 100%)",
    borderColor: "#0d7377",
    headerColor: "#115e59",
    textColor: "#1a1a1a",
    accentColor: "#14b8a6",
    gradientStart: "#115e59",
    gradientMid: "#0d7377",
    gradientEnd: "#14b8a6",
    borderStyle: "double" as const,
  },
  {
    id: "dark-premium",
    name: "الداكن الفاخر",
    bg: "linear-gradient(135deg, #18181b 0%, #27272a 50%, #18181b 100%)",
    borderColor: "#a1a1aa",
    headerColor: "#fafafa",
    textColor: "#e4e4e7",
    accentColor: "#f59e0b",
    gradientStart: "#52525b",
    gradientMid: "#71717a",
    gradientEnd: "#f59e0b",
    borderStyle: "solid" as const,
  },
];

const CERT_TYPES = [
  { id: "thanks", title: "شهادة شكر وتقدير", defaultText: "تقديراً لجهودكم المتميزة وعطائكم المستمر" },
  { id: "excellence", title: "شهادة تميز", defaultText: "تقديراً لتميزكم وإبداعكم في العمل التعليمي" },
  { id: "participation", title: "شهادة مشاركة", defaultText: "نشهد بمشاركتكم الفاعلة في" },
  { id: "training", title: "شهادة حضور دورة", defaultText: "نشهد بحضوركم وإتمامكم للدورة التدريبية" },
  { id: "student_excellence", title: "شهادة تفوق طالب", defaultText: "تقديراً لتفوقكم الدراسي وتميزكم" },
];

export default function CertificateBuilder() {
  const [, navigate] = useLocation();
  const [isExporting, setIsExporting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Load custom configs from DB
  const { data: customConfigs } = trpc.sectionConfigs.getActive.useQuery({ sectionId: "certificates" });

  const allThemes = useMemo(() => {
    const base = [...CERT_THEMES];
    if (customConfigs) {
      for (const cfg of customConfigs) {
        if (cfg.configType === "theme" && cfg.data) {
          const d = cfg.data as Record<string, any>;
          base.push({
            id: `custom-${cfg.id}`, name: cfg.name,
            bg: d.bg || d.bodyBg || "#ffffff",
            borderColor: d.borderColor || "#1a3a5c",
            headerColor: d.headerColor || d.headerBg || "#1a3a5c",
            textColor: d.textColor || "#1a1a1a",
            accentColor: d.accentColor || "#2ea87a",
            gradientStart: d.gradientStart || d.primaryColor || "#1a3a5c",
            gradientMid: d.gradientMid || d.secondaryColor || "#1a5f3f",
            gradientEnd: d.gradientEnd || d.accentColor || "#2ea87a",
            borderStyle: (["solid", "double"].includes(d.borderStyle) ? d.borderStyle : "solid") as "solid" | "double",
          });
        }
      }
    }
    return base;
  }, [customConfigs]);

  const allTypes = useMemo(() => {
    const base = [...CERT_TYPES];
    if (customConfigs) {
      for (const cfg of customConfigs) {
        if (cfg.configType === "type" && cfg.data) {
          const d = cfg.data as Record<string, any>;
          base.push({ id: `custom-${cfg.id}`, title: cfg.name, defaultText: d.defaultText || "" });
        }
      }
    }
    return base;
  }, [customConfigs]);

  const [selectedTheme, setSelectedTheme] = useState(CERT_THEMES[0]);
  const [selectedType, setSelectedType] = useState(CERT_TYPES[0]);
  const previewRef = useRef<HTMLDivElement>(null);


  const [formData, setFormData] = useState({
    recipientName: "",
    recipientTitle: "",
    reason: "",
    issuerName: "",
    issuerTitle: "",
    organization: "",
    date: "",
    certNumber: "",
  });

  const qrData = useMemo(
    () => generateQRDataURL(`SERS-CERT|${formData.recipientName}|${selectedType.title}|${formData.date}|${formData.certNumber}`),
    [formData.recipientName, selectedType.title, formData.date, formData.certNumber]
  );

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF("cert-preview", `${selectedType.title}_${formData.recipientName || "شهادة"}.pdf`);
      toast.success("تم تصدير الشهادة بنجاح");
    } catch {
      toast.error("فشل التصدير - حاول مرة أخرى");
    }
    setIsExporting(false);
  };

  // Auto-scroll to preview on mobile
  useEffect(() => {
    if (showPreview && previewRef.current && window.innerWidth < 1024) {
      previewRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [showPreview]);

  const t = selectedTheme;
  const footerGradId = `certFooterGrad-${t.id}`;

  return (
    <div className="min-h-screen pb-20 lg:pb-0 bg-[#F8FAFC]" dir="rtl">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* ═══ الشريط الجانبي - الإعدادات ═══ */}
        <aside className="lg:w-96 w-full bg-white border-l border-gray-200 p-4 sm:p-5 overflow-y-auto lg:max-h-screen">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-4 sm:mb-5">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">العودة للرئيسية</span>
          </button>

          <h1 className="text-lg sm:text-xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            شهادات الشكر والتقدير
          </h1>
          <p className="text-xs text-gray-500 mb-4 sm:mb-5">صمم شهادتك → معاينة فورية → تصدير PDF</p>

          {/* نوع الشهادة */}
          <div className="mb-4 sm:mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Type className="w-4 h-4 inline ml-1" />
              نوع الشهادة
            </label>
            <div className="grid grid-cols-2 gap-2">
              {allTypes.map((type) => (
                <button
                  key={type.id}
                  type="button"
                  onClick={() => {
                    setSelectedType(type);
                    setFormData((prev) => ({ ...prev, reason: type.defaultText }));
                  }}
                  style={{
                    touchAction: 'manipulation',
                    ...(selectedType.id === type.id ? { borderColor: t.borderColor, backgroundColor: t.borderColor + "10", color: t.borderColor } : {}),
                  }}
                  className={`px-3 py-2.5 sm:py-2 rounded-lg text-xs font-medium transition-all border active:scale-95 ${selectedType.id === type.id
                      ? "shadow-sm"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    }`}
                >
                  {type.title}
                </button>
              ))}
            </div>
          </div>

          {/* الثيم */}
          <div className="mb-4 sm:mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Palette className="w-4 h-4 inline ml-1" />
              ثيم الشهادة
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {allThemes.map((theme) => (
                <button
                  key={theme.id}
                  type="button"
                  onClick={() => {
                    setSelectedTheme(theme);
                    toast.success(`تم اختيار: ${theme.name}`, { duration: 1500 });
                  }}
                  style={{ touchAction: 'manipulation' }}
                  className={`flex items-center gap-2 px-3 py-2.5 sm:py-2 rounded-lg border text-[11px] sm:text-xs font-medium transition-all active:scale-95 ${selectedTheme.id === theme.id ? "border-gray-900 shadow-sm bg-gray-50" : "border-gray-200 hover:border-gray-300"
                    }`}
                >
                  <div
                    className="w-5 h-5 sm:w-4 sm:h-4 rounded-full border shrink-0 relative"
                    style={{ backgroundColor: theme.borderColor }}
                  >
                    {selectedTheme.id === theme.id && (
                      <Check className="w-3 h-3 text-white absolute top-0.5 right-0.5 sm:top-0 sm:right-0" />
                    )}
                  </div>
                  <span className="truncate">{theme.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* البيانات */}
          <div className="space-y-3">
            <h3 className="text-sm font-bold text-gray-700">بيانات الشهادة</h3>
            {[
              { key: "recipientName", label: "اسم المستلم", placeholder: "الاسم الكامل" },
              { key: "recipientTitle", label: "صفة المستلم", placeholder: "معلم / طالب / مدير..." },
              { key: "reason", label: "نص الشهادة", placeholder: "سبب التكريم...", multiline: true },
              { key: "issuerName", label: "اسم المانح", placeholder: "اسم مدير المدرسة" },
              { key: "issuerTitle", label: "صفة المانح", placeholder: "مدير المدرسة / المشرف" },
              { key: "organization", label: "الجهة", placeholder: "اسم المدرسة / الإدارة" },
              { key: "date", label: "التاريخ", placeholder: "1446/06/15" },
              { key: "certNumber", label: "رقم الشهادة (اختياري)", placeholder: "CERT-001" },
            ].map((field) => (
              <div key={field.key}>
                <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                {(field as any).multiline ? (
                  <textarea
                    value={(formData as any)[field.key]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400 resize-none"
                  />
                ) : (
                  <input
                    type="text"
                    value={(formData as any)[field.key]}
                    onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20 focus:border-teal-400"
                  />
                )}
              </div>
            ))}
          </div>

          {/* أزرار التصدير */}
          <div className="mt-5 flex gap-3">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 text-white px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium transition-colors disabled:opacity-50 active:scale-95"
              style={{ backgroundColor: t.headerColor, touchAction: 'manipulation' }}
            >
              <Download className="w-4 h-4" />
              {isExporting ? "جاري التصدير..." : "تحميل PDF"}
            </button>
            <button
              type="button"
              onClick={() => printElement("cert-preview")}
              className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-3 sm:py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors active:scale-95"
              style={{ touchAction: 'manipulation' }}
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
          </div>

          {/* زر المعاينة على الموبايل */}
          <button
            type="button"
            onClick={() => setShowPreview(!showPreview)}
            className="w-full mt-3 lg:hidden flex items-center justify-center gap-2 bg-gray-900 text-white px-4 py-3 rounded-lg text-sm font-medium transition-colors active:scale-95"
            style={{ touchAction: 'manipulation' }}
          >
            <Eye className="w-4 h-4" />
            {showPreview ? "إخفاء المعاينة" : "معاينة الشهادة"}
            {showPreview ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </aside>

        {/* ═══ المعاينة الحية ═══ */}
        <main
          ref={previewRef}
          className={`flex-1 p-3 sm:p-6 flex items-start lg:items-center justify-center bg-gray-100 overflow-auto ${!showPreview ? 'hidden lg:flex' : 'flex'
            }`}
        >
          <div className="w-full max-w-[800px] mx-auto">
            {/* حاوية المعاينة مع تصغير تلقائي */}
            <div className="preview-scale-container">
              <div
                id="cert-preview"
                className="w-full shadow-2xl overflow-hidden relative mx-auto"
                style={{
                  background: t.bg,
                  fontFamily: "'Cairo', 'Tajawal', sans-serif",
                  aspectRatio: '210 / 297',
                  maxWidth: '800px',
                }}
              >
                {/* شريط علوي رفيع بتدرج */}
                <div style={{ height: '5px', background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientMid}, ${t.gradientEnd})`, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }} />

                {/* إطار مزخرف - بلون الهوية */}
                <div
                  className="absolute rounded-lg"
                  style={{ inset: '3%', border: `3px ${t.borderStyle} ${t.borderColor}` }}
                />
                <div
                  className="absolute rounded"
                  style={{ inset: '4.5%', border: `1px solid ${t.borderColor}40` }}
                />

                {/* زخرفة الزوايا */}
                {['top-right', 'top-left', 'bottom-right', 'bottom-left'].map((corner) => {
                  const isTop = corner.includes('top');
                  const isRight = corner.includes('right');
                  return (
                    <div
                      key={corner}
                      style={{
                        position: 'absolute',
                        [isTop ? 'top' : 'bottom']: '5%',
                        [isRight ? 'right' : 'left']: '5%',
                        width: '20px',
                        height: '20px',
                        borderTop: isTop ? `3px solid ${t.borderColor}` : 'none',
                        borderBottom: !isTop ? `3px solid ${t.borderColor}` : 'none',
                        borderRight: isRight ? `3px solid ${t.borderColor}` : 'none',
                        borderLeft: !isRight ? `3px solid ${t.borderColor}` : 'none',
                        zIndex: 5,
                      }}
                    />
                  );
                })}

                {/* المحتوى */}
                <div className="relative z-10 h-full flex flex-col items-center justify-between p-[8%] sm:p-[6%] text-center">
                  {/* الشعار والعنوان */}
                  <div className="w-full">
                    <div style={{ marginBottom: '4%' }}>
                      <MoeLogo variant="original" height={60} />
                    </div>
                    <h1
                      className="text-xl sm:text-2xl md:text-3xl font-black mb-1"
                      style={{ color: t.headerColor, fontFamily: "'Tajawal', sans-serif" }}
                    >
                      {selectedType.title}
                    </h1>
                    {formData.organization && (
                      <p className="text-xs sm:text-sm" style={{ color: t.accentColor }}>{formData.organization}</p>
                    )}
                  </div>

                  {/* النص الرئيسي */}
                  <div className="flex-1 flex flex-col items-center justify-center w-full max-w-lg" style={{ padding: '3% 0' }}>
                    <p className="text-xs sm:text-sm mb-2 sm:mb-3" style={{ color: t.textColor + "99" }}>
                      {selectedType.id === "thanks" ? "يسر إدارة المدرسة أن تتقدم بخالص الشكر والتقدير إلى" : "تشهد إدارة المدرسة بأن"}
                    </p>

                    <div className="mb-3 sm:mb-4">
                      <h2
                        className="text-lg sm:text-xl md:text-2xl font-black mb-1"
                        style={{ color: t.headerColor, fontFamily: "'Tajawal', sans-serif" }}
                      >
                        {formData.recipientName || "اسم المستلم"}
                      </h2>
                      {formData.recipientTitle && (
                        <p className="text-xs sm:text-sm font-medium" style={{ color: t.accentColor }}>{formData.recipientTitle}</p>
                      )}
                    </div>

                    <div
                      className="w-16 sm:w-24 h-0.5 rounded-full mb-3 sm:mb-4"
                      style={{ background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientEnd})` }}
                    />

                    <p className="text-sm sm:text-base leading-relaxed" style={{ color: t.textColor }}>
                      {formData.reason || selectedType.defaultText}
                    </p>
                  </div>

                  {/* التوقيع والتاريخ */}
                  <div className="w-full">
                    <div className="flex items-end justify-between gap-2">
                      {/* QR */}
                      <div className="shrink-0">
                        <img src={qrData} alt="QR" className="w-10 h-10 sm:w-14 sm:h-14 rounded" />
                        {formData.certNumber && (
                          <p className="text-[8px] sm:text-[9px] mt-0.5 sm:mt-1" style={{ color: t.textColor + "60" }}>
                            {formData.certNumber}
                          </p>
                        )}
                      </div>

                      {/* التوقيع */}
                      <div className="text-center flex-1">
                        <div className="mb-4 sm:mb-6" />
                        <div className="w-28 sm:w-40 mx-auto pt-2" style={{ borderTop: `2.5px dotted ${t.borderColor}60` }}>
                          <p className="text-xs sm:text-sm font-bold" style={{ color: t.headerColor }}>
                            {formData.issuerName || "_______________"}
                          </p>
                          <p className="text-[10px] sm:text-xs" style={{ color: t.textColor + "80" }}>
                            {formData.issuerTitle || "المنصب"}
                          </p>
                        </div>
                      </div>

                      {/* التاريخ */}
                      <div className="text-left shrink-0">
                        <p className="text-[10px] sm:text-xs" style={{ color: t.textColor + "60" }}>التاريخ</p>
                        <p className="text-xs sm:text-sm font-medium" style={{ color: t.headerColor }}>
                          {formData.date || "____/____/____"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* الفوتر المنحني */}
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15 }}>
                  <svg viewBox="0 0 800 40" preserveAspectRatio="none" style={{ width: '100%', height: '20px', display: 'block' }}>
                    <defs>
                      <linearGradient id={footerGradId} x1="0" y1="0" x2="1" y2="0">
                        <stop offset="0%" stopColor={t.gradientEnd} />
                        <stop offset="50%" stopColor={t.gradientMid} />
                        <stop offset="100%" stopColor={t.gradientStart} />
                      </linearGradient>
                    </defs>
                    <path d="M0,40 L0,28 C150,6 400,0 800,14 L800,40 Z" fill={`url(#${footerGradId})`} />
                  </svg>
                  <div style={{
                    background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientMid}, ${t.gradientEnd})`,
                    padding: '3px 5% 6px',
                    fontSize: '9px',
                    color: '#fff',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    marginTop: '-1px',
                  }}>
                    <span style={{ fontWeight: 700, letterSpacing: '0.3px' }}>SERS - نظام السجلات التعليمية الذكي</span>
                    <span style={{ opacity: 0.85 }}>{formData.organization || ''}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
