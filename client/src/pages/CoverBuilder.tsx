/*
 * أغلفة وفواصل تفاعلية
 * المستخدم يختار نوع الغلاف → يدخل البيانات → معاينة حية → تصدير PDF
 */
import { useState, useMemo } from "react";
import { motion } from "framer-motion";
import { ArrowLeft, Download, Printer, Palette } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";

const COVER_TYPES = [
  { id: "portfolio", title: "غلاف ملف إنجاز", icon: "📁" },
  { id: "subject", title: "غلاف مادة دراسية", icon: "📚" },
  { id: "plan", title: "غلاف خطة", icon: "📋" },
  { id: "report", title: "غلاف تقرير", icon: "📊" },
  { id: "divider", title: "فاصل ملف", icon: "📑" },
  { id: "index", title: "فهرس", icon: "📇" },
];

const COVER_THEMES = [
  { id: "green", name: "أخضر رسمي", primary: "#166534", secondary: "#dcfce7", accent: "#16a34a", bg: "#f0fdf4" },
  { id: "blue", name: "أزرق كلاسيكي", primary: "#1e3a8a", secondary: "#dbeafe", accent: "#2563eb", bg: "#eff6ff" },
  { id: "purple", name: "بنفسجي أنيق", primary: "#581c87", secondary: "#f3e8ff", accent: "#9333ea", bg: "#faf5ff" },
  { id: "teal", name: "تيل عصري", primary: "#134e4a", secondary: "#ccfbf1", accent: "#0d9488", bg: "#f0fdfa" },
  { id: "amber", name: "ذهبي دافئ", primary: "#78350f", secondary: "#fef3c7", accent: "#d97706", bg: "#fffbeb" },
];

export default function CoverBuilder() {
  const [, navigate] = useLocation();
  const [selectedType, setSelectedType] = useState(COVER_TYPES[0]);
  const [selectedTheme, setSelectedTheme] = useState(COVER_THEMES[0]);
  const [isExporting, setIsExporting] = useState(false);

  const [formData, setFormData] = useState({
    title: "",
    subtitle: "",
    name: "",
    role: "",
    school: "",
    department: "",
    year: "1446-1447",
    semester: "الأول",
    dividerTitle: "",
  });

  const qrData = useMemo(
    () => generateQRDataURL(`SERS-COVER|${formData.title}|${formData.name}|${formData.year}`),
    [formData.title, formData.name, formData.year]
  );

  const handleExportPDF = async () => {
    setIsExporting(true);
    await exportToPDF("cover-preview", `${selectedType.title}_${formData.name || "غلاف"}.pdf`);
    setIsExporting(false);
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]" dir="rtl">
      <div className="flex flex-col lg:flex-row min-h-screen">
        {/* الإعدادات */}
        <aside className="lg:w-96 bg-white border-l border-gray-200 p-5 overflow-y-auto">
          <button type="button" onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-5">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">العودة</span>
          </button>

          <h1 className="text-xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            أغلفة وفواصل
          </h1>
          <p className="text-xs text-gray-500 mb-5">صمم غلافك أو فاصلك → معاينة فورية → تصدير PDF</p>

          {/* نوع الغلاف */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">النوع</label>
            <div className="grid grid-cols-3 gap-2">
              {COVER_TYPES.map((type) => (
                <button
                  key={type.id}
                  onClick={() => setSelectedType(type)}
                  className={`px-2 py-3 rounded-lg text-center text-xs font-medium transition-all border ${
                    selectedType.id === type.id ? "border-teal-500 bg-teal-50 text-teal-700" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  <div className="text-xl mb-1">{type.icon}</div>
                  {type.title}
                </button>
              ))}
            </div>
          </div>

          {/* الثيم */}
          <div className="mb-4">
            <label className="block text-sm font-bold text-gray-700 mb-2">
              <Palette className="w-4 h-4 inline ml-1" />
              الثيم
            </label>
            <div className="flex gap-2 flex-wrap">
              {COVER_THEMES.map((theme) => (
                <button
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    selectedTheme.id === theme.id ? "border-gray-900 shadow-sm" : "border-gray-200"
                  }`}
                >
                  <div className="w-4 h-4 rounded-full" style={{ backgroundColor: theme.primary }} />
                  {theme.name}
                </button>
              ))}
            </div>
          </div>

          {/* البيانات */}
          <div className="space-y-3">
            {selectedType.id === "divider" ? (
              <div>
                <label className="block text-xs font-medium text-gray-600 mb-1">عنوان الفاصل</label>
                <input
                  type="text"
                  value={formData.dividerTitle}
                  onChange={(e) => setFormData((prev) => ({ ...prev, dividerTitle: e.target.value }))}
                  placeholder="مثال: الفصل الأول / الشواهد / التقارير"
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                />
              </div>
            ) : (
              <>
                {[
                  { key: "title", label: "العنوان الرئيسي", placeholder: "ملف إنجاز / خطة المادة..." },
                  { key: "subtitle", label: "العنوان الفرعي", placeholder: "الفصل الدراسي الأول..." },
                  { key: "name", label: "الاسم", placeholder: "اسم المعلم / الطالب" },
                  { key: "role", label: "الوظيفة", placeholder: "معلم رياضيات / طالب..." },
                  { key: "school", label: "المدرسة", placeholder: "اسم المدرسة" },
                  { key: "department", label: "إدارة التعليم", placeholder: "إدارة تعليم الرياض" },
                  { key: "year", label: "العام الدراسي", placeholder: "1446-1447" },
                  { key: "semester", label: "الفصل", placeholder: "الأول" },
                ].map((field) => (
                  <div key={field.key}>
                    <label className="block text-xs font-medium text-gray-600 mb-1">{field.label}</label>
                    <input
                      type="text"
                      value={(formData as any)[field.key]}
                      onChange={(e) => setFormData((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500/20"
                    />
                  </div>
                ))}
              </>
            )}
          </div>

          <div className="mt-5 flex gap-3">
            <button type="button" onClick={handleExportPDF} disabled={isExporting} className="flex-1 flex items-center justify-center gap-2 bg-teal-600 text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-teal-700 disabled:opacity-50">
              <Download className="w-4 h-4" />
              {isExporting ? "جاري..." : "تحميل PDF"}
            </button>
            <button type="button" onClick={() => printElement("cover-preview")} className="flex items-center justify-center gap-2 bg-gray-100 text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-200">
              <Printer className="w-4 h-4" />
              طباعة
            </button>
          </div>
        </aside>

        {/* المعاينة */}
        <main className="flex-1 p-6 flex items-center justify-center bg-gray-100 overflow-auto">
          <div
            id="cover-preview"
            className="w-full max-w-[595px] shadow-2xl rounded-lg overflow-hidden"
            style={{
              aspectRatio: "1/1.414",
              background: selectedTheme.bg,
              fontFamily: "'Cairo', 'Tajawal', sans-serif",
            }}
          >
            {selectedType.id === "divider" ? (
              /* فاصل */
              <div className="h-full flex items-center justify-center relative">
                <div className="absolute inset-6 rounded-lg" style={{ border: `3px solid ${selectedTheme.primary}` }} />
                <div className="absolute inset-8 rounded" style={{ border: `1px solid ${selectedTheme.accent}40` }} />
                <div className="text-center z-10">
                  <div className="w-20 h-1 rounded-full mx-auto mb-4" style={{ backgroundColor: selectedTheme.accent }} />
                  <h1 className="text-4xl font-black mb-2" style={{ color: selectedTheme.primary, fontFamily: "'Tajawal', sans-serif" }}>
                    {formData.dividerTitle || "عنوان الفاصل"}
                  </h1>
                  <div className="w-20 h-1 rounded-full mx-auto mt-4" style={{ backgroundColor: selectedTheme.accent }} />
                </div>
              </div>
            ) : (
              /* غلاف */
              <div className="h-full flex flex-col relative">
                {/* شريط علوي */}
                <div className="h-2" style={{ backgroundColor: selectedTheme.primary }} />

                {/* الهيدر */}
                <div className="p-6 text-center" style={{ backgroundColor: selectedTheme.secondary }}>
                  <p className="text-xs mb-1" style={{ color: selectedTheme.accent }}>{formData.department || "وزارة التعليم"}</p>
                  <p className="text-sm font-bold" style={{ color: selectedTheme.primary }}>{formData.school || "اسم المدرسة"}</p>
                </div>

                {/* المحتوى الرئيسي */}
                <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
                  <div className="text-5xl mb-4">{selectedType.icon}</div>
                  <h1 className="text-3xl font-black mb-2" style={{ color: selectedTheme.primary, fontFamily: "'Tajawal', sans-serif" }}>
                    {formData.title || selectedType.title}
                  </h1>
                  {formData.subtitle && (
                    <p className="text-lg mb-6" style={{ color: selectedTheme.accent }}>{formData.subtitle}</p>
                  )}

                  <div className="w-24 h-0.5 rounded-full mb-6" style={{ backgroundColor: selectedTheme.accent }} />

                  <div className="space-y-2">
                    <p className="text-xs" style={{ color: selectedTheme.primary + "80" }}>إعداد</p>
                    <p className="text-xl font-bold" style={{ color: selectedTheme.primary }}>{formData.name || "الاسم"}</p>
                    {formData.role && <p className="text-sm" style={{ color: selectedTheme.accent }}>{formData.role}</p>}
                  </div>
                </div>

                {/* الفوتر */}
                <div className="p-6 flex items-end justify-between" style={{ backgroundColor: selectedTheme.secondary }}>
                  <img src={qrData} alt="QR" className="w-12 h-12 rounded" />
                  <div className="text-center">
                    <p className="text-xs" style={{ color: selectedTheme.primary }}>العام الدراسي {formData.year}</p>
                    <p className="text-xs" style={{ color: selectedTheme.accent }}>الفصل {formData.semester}</p>
                  </div>
                  <div className="text-[9px]" style={{ color: selectedTheme.primary + "60" }}>SERS</div>
                </div>

                <div className="h-2" style={{ backgroundColor: selectedTheme.primary }} />
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
