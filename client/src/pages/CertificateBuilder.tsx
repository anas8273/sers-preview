/*
 * شهادات الشكر والتقدير - صفحة تفاعلية كاملة
 * المستخدم يختار الثيم → يدخل البيانات → معاينة حية فورية → تصدير PDF / طباعة
 * الهوية البصرية: تدرج أخضر/فيروزي + شريط علوي + فوتر منحني
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Printer, Palette, Type } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";
import { MoeLogo } from "@/components/MoeLogo";

const CERT_THEMES = [
  {
    id: "green-official",
    name: "الهوية الرسمية",
    bg: "#ffffff",
    borderColor: "#0d7377",
    headerColor: "#0d7377",
    textColor: "#1a1a1a",
    accentColor: "#2ea87a",
    gradientStart: "#1a4d5e",
    gradientMid: "#0d7377",
    gradientEnd: "#2ea87a",
  },
  {
    id: "dark-teal",
    name: "التيل الداكن",
    bg: "#f8fffe",
    borderColor: "#1a4d5e",
    headerColor: "#1a4d5e",
    textColor: "#1a1a1a",
    accentColor: "#0d7377",
    gradientStart: "#0a3a4a",
    gradientMid: "#1a4d5e",
    gradientEnd: "#0d7377",
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
    gradientEnd: "#2563eb",
  },
  {
    id: "purple-royal",
    name: "البنفسجي الملكي",
    bg: "linear-gradient(135deg, #faf5ff 0%, #f3e8ff 50%, #faf5ff 100%)",
    borderColor: "#6b21a8",
    headerColor: "#581c87",
    textColor: "#1a1a1a",
    accentColor: "#9333ea",
    gradientStart: "#581c87",
    gradientMid: "#6b21a8",
    gradientEnd: "#9333ea",
  },
];

const CERT_TYPES = [
  { id: "thanks", title: "شهادة شكر وتقدير", defaultText: "تقديراً لجهودكم المتميزة وعطائكم المستمر" },
  { id: "excellence", title: "شهادة تميز", defaultText: "تقديراً لتميزكم وإبداعكم في العمل التعليمي" },
  { id: "participation", title: "شهادة مشاركة", defaultText: "نشهد بمشاركتكم الفاعلة في" },
  { id: "training", title: "شهادة حضور دورة", defaultText: "نشهد بحضوركم وإتمامكم للدورة التدريبية" },
  { id: "student_excellence", title: "شهادة تفوق طالب", defaultText: "تقديراً لتفوقكم الدراسي وتميزكم" },
  { id: "national", title: "شهادة مناسبة وطنية", defaultText: "بمناسبة اليوم الوطني السعودي" },
];

export default function CertificateBuilder() {
  const [, navigate] = useLocation();
  const [selectedTheme, setSelectedTheme] = useState(CERT_THEMES[0]);
  const [selectedType, setSelectedType] = useState(CERT_TYPES[0]);
  const [isExporting, setIsExporting] = useState(false);

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
    await exportToPDF("cert-preview", `${selectedType.title}_${formData.recipientName || "شهادة"}.pdf`);
    setIsExporting(false);
  };

  const t = selectedTheme;
  const gradientId = `certGrad-${t.id}`;
  const footerGradId = `certFooterGrad-${t.id}`;

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* الشريط الجانبي - الإعدادات */}
        <aside className="lg:w-96 bg-white border-l border-gray-200 p-5 overflow-y-auto">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">العودة</span>
          </button>

          <h1 className="text-xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            شهادات الشكر والتقدير
          </h1>
          <p className="text-xs text-gray-500 mb-5">صمم شهادتك → معاينة فورية → تصدير PDF</p>

          {/* نوع الشهادة */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Type className="w-4 h-4 inline ml-1" />
              نوع الشهادة
            </label>
            <div className="grid grid-cols-2 gap-2">
              {CERT_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type);
                    setFormData((prev) => ({ ...prev, reason: type.defaultText }));
                  }}
                  className={`px-3 py-2 rounded-lg text-xs font-medium transition-all border ${
                    selectedType.id === type.id
                      ? "border-teal-500 bg-teal-50 text-teal-700"
                      : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {type.title}
                </button>
              ))}
            </div>
          </div>

          {/* الثيم */}
          <div className="mb-5">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Palette className="w-4 h-4 inline ml-1" />
              ثيم الشهادة
            </label>
            <div className="flex gap-2 flex-wrap">
              {CERT_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium transition-all ${
                    selectedTheme.id === theme.id ? "border-gray-900 shadow-sm" : "border-gray-200 hover:border-gray-300"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full border" style={{ backgroundColor: theme.borderColor }} />
                  {theme.name}
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
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "جاري..." : "تحميل PDF"}
            </button>
            <button
              onClick={() => printElement("cert-preview")}
              className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
          </div>
        </aside>

        {/* المعاينة الحية */}
        <main className="flex-1 p-6 flex items-center justify-center bg-gray-100 overflow-auto">
          <div
            id="cert-preview"
            className="w-full max-w-[800px] aspect-[1.414/1] shadow-2xl overflow-hidden relative"
            style={{
              background: t.bg,
              fontFamily: "'Cairo', 'Tajawal', sans-serif",
            }}
          >
            {/* شريط علوي رفيع بتدرج */}
            <div style={{ height: '5px', background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientMid}, ${t.gradientEnd})`, position: 'absolute', top: 0, left: 0, right: 0, zIndex: 20 }} />

            {/* إطار مزخرف - بلون الهوية */}
            <div
              className="absolute rounded-lg"
              style={{ inset: '16px', border: `3px double ${t.borderColor}` }}
            />
            <div
              className="absolute rounded"
              style={{ inset: '24px', border: `1px solid ${t.borderColor}40` }}
            />

            {/* المحتوى */}
            <div className="relative z-10 h-full flex flex-col items-center justify-between p-12 text-center">
              {/* الشعار والعنوان */}
              <div>
                <div style={{ marginBottom: '8px' }}>
                  <MoeLogo variant="original" height={70} />
                </div>
                <h1
                  className="text-3xl font-black mb-1"
                  style={{ color: t.headerColor, fontFamily: "'Tajawal', sans-serif" }}
                >
                  {selectedType.title}
                </h1>
                {formData.organization && (
                  <p className="text-sm" style={{ color: t.accentColor }}>{formData.organization}</p>
                )}
              </div>

              {/* النص الرئيسي */}
              <div className="flex-1 flex flex-col items-center justify-center max-w-lg">
                <p className="text-sm mb-3" style={{ color: t.textColor + "99" }}>
                  {selectedType.id === "thanks" ? "يسر إدارة المدرسة أن تتقدم بخالص الشكر والتقدير إلى" : "تشهد إدارة المدرسة بأن"}
                </p>

                <div className="mb-4">
                  <h2
                    className="text-2xl font-black mb-1"
                    style={{ color: t.headerColor, fontFamily: "'Tajawal', sans-serif" }}
                  >
                    {formData.recipientName || "اسم المستلم"}
                  </h2>
                  {formData.recipientTitle && (
                    <p className="text-sm font-medium" style={{ color: t.accentColor }}>{formData.recipientTitle}</p>
                  )}
                </div>

                <div
                  className="w-24 h-0.5 rounded-full mb-4"
                  style={{ background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientEnd})` }}
                />

                <p className="text-base leading-relaxed" style={{ color: t.textColor }}>
                  {formData.reason || selectedType.defaultText}
                </p>
              </div>

              {/* التوقيع والتاريخ */}
              <div className="w-full">
                <div className="flex items-end justify-between">
                  {/* QR */}
                  <div>
                    <img src={qrData} alt="QR" className="w-14 h-14 rounded" />
                    {formData.certNumber && (
                      <p className="text-[9px] mt-1" style={{ color: t.textColor + "60" }}>
                        {formData.certNumber}
                      </p>
                    )}
                  </div>

                  {/* التوقيع */}
                  <div className="text-center">
                    <div className="mb-6" />
                    <div className="w-40 pt-2" style={{ borderTop: `2.5px dotted ${t.borderColor}60` }}>
                      <p className="text-sm font-bold" style={{ color: t.headerColor }}>
                        {formData.issuerName || "_______________"}
                      </p>
                      <p className="text-xs" style={{ color: t.textColor + "80" }}>
                        {formData.issuerTitle || "المنصب"}
                      </p>
                    </div>
                  </div>

                  {/* التاريخ */}
                  <div className="text-left">
                    <p className="text-xs" style={{ color: t.textColor + "60" }}>التاريخ</p>
                    <p className="text-sm font-medium" style={{ color: t.headerColor }}>
                      {formData.date || "____/____/____"}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* الفوتر المنحني - مطابق للهوية البصرية */}
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 15 }}>
              <svg viewBox="0 0 800 40" preserveAspectRatio="none" style={{ width: '100%', height: '25px', display: 'block' }}>
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
                padding: '4px 28px 8px',
                fontSize: '10px',
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
        </main>
      </div>
    </div>
  );
}
