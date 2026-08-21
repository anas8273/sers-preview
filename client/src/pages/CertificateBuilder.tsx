/*
 * شهادات الشكر والتقدير
 * هوية وزارة التعليم السعودية: ألوان مرجعية، مساحة آمنة للشعار، وتخطيط رسمي للطباعة.
 */
import { useMemo, useState } from "react";
import { ArrowLeft, Download, Languages, Palette, Printer, Type } from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";
import { MoeLogo } from "@/components/MoeLogo";

const MOE_COLORS = {
  primary: "#008A76",
  primaryDark: "#006D5E",
  supporting: "#16BECF",
  graphite: "#595C61",
  mist: "#E9F6F3",
  line: "#B7DCD5",
};

/* كلا الخيارين من الهوية نفسها؛ لا تُعرض ألوان احتفالية لا تنتمي للوزارة. */
const CERT_THEMES = [
  {
    id: "moe-primary",
    name: "هوية وزارة التعليم",
    description: "أخضر الوزارة مع اللون المساند",
    bg: "#FFFFFF",
    borderColor: MOE_COLORS.primary,
    headerColor: MOE_COLORS.primaryDark,
    textColor: "#202428",
    accentColor: MOE_COLORS.graphite,
    gradientStart: MOE_COLORS.primaryDark,
    gradientMid: MOE_COLORS.primary,
    gradientEnd: MOE_COLORS.supporting,
  },
  {
    id: "moe-formal",
    name: "هوية رسمية أحادية اللون",
    description: "نسخة هادئة للطباعة الرسمية",
    bg: "#FBFDFC",
    borderColor: MOE_COLORS.primary,
    headerColor: MOE_COLORS.primaryDark,
    textColor: "#202428",
    accentColor: MOE_COLORS.graphite,
    gradientStart: MOE_COLORS.primaryDark,
    gradientMid: MOE_COLORS.primary,
    gradientEnd: MOE_COLORS.primary,
  },
];

const CERT_TYPES = [
  {
    id: "thanks",
    title: "شهادة شكر وتقدير",
    defaultText: "تقديرًا لجهودكم المتميزة وعطائكم المستمر في خدمة العملية التعليمية.",
    defaultTextEn: "In recognition of your distinguished efforts and continued contribution to the educational process.",
  },
  {
    id: "excellence",
    title: "شهادة تميز",
    defaultText: "تقديرًا لتميزكم وإبداعكم في العمل التعليمي.",
    defaultTextEn: "In recognition of your excellence and creativity in educational work.",
  },
  {
    id: "participation",
    title: "شهادة مشاركة",
    defaultText: "نشهد بمشاركتكم الفاعلة في النشاط أو البرنامج التعليمي.",
    defaultTextEn: "This certifies your effective participation in the educational activity or programme.",
  },
  {
    id: "training",
    title: "شهادة حضور دورة",
    defaultText: "نشهد بحضوركم وإتمامكم للدورة التدريبية.",
    defaultTextEn: "This certifies your attendance and completion of the training course.",
  },
  {
    id: "student_excellence",
    title: "شهادة تفوق طالب",
    defaultText: "تقديرًا لتفوقكم الدراسي وتميزكم.",
    defaultTextEn: "In recognition of your academic achievement and distinction.",
  },
];

const englishTitles: Record<string, string> = {
  thanks: "Certificate of Appreciation",
  excellence: "Certificate of Excellence",
  participation: "Certificate of Participation",
  training: "Training Attendance Certificate",
  student_excellence: "Student Excellence Certificate",
};

export default function CertificateBuilder() {
  const [, navigate] = useLocation();
  const [selectedTheme, setSelectedTheme] = useState(CERT_THEMES[0]);
  const [selectedType, setSelectedType] = useState(CERT_TYPES[0]);
  const [language, setLanguage] = useState<"ar" | "en">("ar");
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
    () =>
      generateQRDataURL(
        `SERS-CERT|${formData.recipientName}|${selectedType.title}|${formData.date}|${formData.certNumber}`
      ),
    [formData.recipientName, selectedType.title, formData.date, formData.certNumber]
  );

  const certificateCopy =
    language === "en"
      ? {
          intro:
            selectedType.id === "thanks"
              ? "The school administration proudly extends its appreciation to"
              : "The school administration hereby certifies that",
          recipient: "Recipient Name",
          position: "Position",
          date: "Date",
          footer: "Ministry of Education | Kingdom of Saudi Arabia",
        }
      : {
          intro:
            selectedType.id === "thanks"
              ? "يسر إدارة المدرسة أن تتقدم بخالص الشكر والتقدير إلى"
              : "تشهد إدارة المدرسة بأن",
          recipient: "اسم المستلم",
          position: "صفة المستلم",
          date: "التاريخ",
          footer: "وزارة التعليم | المملكة العربية السعودية",
        };

  const certificateTitle = language === "en" ? englishTitles[selectedType.id] : selectedType.title;
  const certificateReason =
    formData.reason || (language === "en" ? selectedType.defaultTextEn : selectedType.defaultText);

  const handleExportPDF = async () => {
    setIsExporting(true);
    try {
      await exportToPDF("cert-preview", `${selectedType.title}_${formData.recipientName || "شهادة"}.pdf`);
    } finally {
      setIsExporting(false);
    }
  };

  const updateLanguage = (nextLanguage: "ar" | "en") => {
    if (nextLanguage === language) return;
    setLanguage(nextLanguage);
    const previousDefault = language === "ar" ? selectedType.defaultText : selectedType.defaultTextEn;
    if (!formData.reason || formData.reason === previousDefault) {
      setFormData((previous) => ({
        ...previous,
        reason: nextLanguage === "ar" ? selectedType.defaultText : selectedType.defaultTextEn,
      }));
    }
  };

  const t = selectedTheme;
  const footerGradId = `certFooterGrad-${t.id}`;

  return (
    <div className="min-h-screen bg-[#F5F8F7] pb-20 lg:pb-0" dir="rtl">
      <div className="flex min-h-screen flex-col lg:flex-row">
        <aside className="lg:sticky lg:top-0 lg:h-screen lg:w-[380px] lg:shrink-0 lg:overflow-y-auto border-l border-[#DCE8E5] bg-white p-5 sm:p-6">
          <button
            type="button"
            onClick={() => navigate("/")}
            className="mb-6 flex items-center gap-2 text-sm text-[#595C61] transition-colors hover:text-[#006D5E] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-2"
          >
            <ArrowLeft className="h-4 w-4" />
            <span>العودة للرئيسية</span>
          </button>

          <div className="mb-6 border-b border-[#E4EFEC] pb-5">
            <p className="mb-2 text-xs font-bold tracking-wide text-[#008A76]">وزارة التعليم · المملكة العربية السعودية</p>
            <h1 className="mb-1 text-xl font-black text-[#1E2C2A]" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              شهادات الشكر والتقدير
            </h1>
            <p className="text-xs leading-5 text-[#66736F]">نموذج رسمي قابل للطباعة والتصدير وفق هوية وزارة التعليم.</p>
          </div>

          <section className="mb-6" aria-labelledby="certificate-type-heading">
            <h2 id="certificate-type-heading" className="mb-2 flex items-center gap-1 text-sm font-bold text-[#34403D]">
              <Type className="h-4 w-4 text-[#008A76]" /> نوع الشهادة
            </h2>
            <div className="grid grid-cols-2 gap-2">
              {CERT_TYPES.map((type) => (
                <button
                  type="button"
                  key={type.id}
                  onClick={() => {
                    setSelectedType(type);
                    setFormData((previous) => ({
                      ...previous,
                      reason: language === "ar" ? type.defaultText : type.defaultTextEn,
                    }));
                  }}
                  aria-pressed={selectedType.id === type.id}
                  className="rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-1"
                  style={
                    selectedType.id === type.id
                      ? { borderColor: MOE_COLORS.primary, backgroundColor: MOE_COLORS.mist, color: MOE_COLORS.primaryDark }
                      : { borderColor: "#DCE8E5", color: "#52605C" }
                  }
                >
                  {type.title}
                </button>
              ))}
            </div>
          </section>

          <section className="mb-6" aria-labelledby="certificate-theme-heading">
            <h2 id="certificate-theme-heading" className="mb-2 flex items-center gap-1 text-sm font-bold text-[#34403D]">
              <Palette className="h-4 w-4 text-[#008A76]" /> مظهر الهوية
            </h2>
            <div className="space-y-2">
              {CERT_THEMES.map((theme) => (
                <button
                  type="button"
                  key={theme.id}
                  onClick={() => setSelectedTheme(theme)}
                  aria-pressed={selectedTheme.id === theme.id}
                  className="flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-right transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-1"
                  style={
                    selectedTheme.id === theme.id
                      ? { borderColor: MOE_COLORS.primary, backgroundColor: MOE_COLORS.mist }
                      : { borderColor: "#DCE8E5" }
                  }
                >
                  <span className="h-5 w-5 shrink-0 rounded-full border border-white shadow-sm" style={{ background: `linear-gradient(135deg, ${theme.gradientStart}, ${theme.gradientEnd})` }} />
                  <span>
                    <span className="block text-xs font-bold text-[#34403D]">{theme.name}</span>
                    <span className="block pt-0.5 text-[10px] text-[#73807C]">{theme.description}</span>
                  </span>
                </button>
              ))}
            </div>
          </section>

          <section className="mb-6" aria-labelledby="certificate-language-heading">
            <h2 id="certificate-language-heading" className="mb-2 flex items-center gap-1 text-sm font-bold text-[#34403D]">
              <Languages className="h-4 w-4 text-[#008A76]" /> لغة الشهادة
            </h2>
            <div className="grid grid-cols-2 gap-2">
              <button type="button" onClick={() => updateLanguage("ar")} aria-pressed={language === "ar"} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-1 ${language === "ar" ? "border-[#008A76] bg-[#E9F6F3] text-[#006D5E]" : "border-[#DCE8E5] text-[#52605C]"}`}>العربية</button>
              <button type="button" onClick={() => updateLanguage("en")} aria-pressed={language === "en"} className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-1 ${language === "en" ? "border-[#008A76] bg-[#E9F6F3] text-[#006D5E]" : "border-[#DCE8E5] text-[#52605C]"}`}>English</button>
            </div>
          </section>

          <section className="space-y-3" aria-labelledby="certificate-details-heading">
            <h2 id="certificate-details-heading" className="text-sm font-bold text-[#34403D]">بيانات الشهادة</h2>
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
                <label className="mb-1 block text-xs font-medium text-[#52605C]">{field.label}</label>
                {field.multiline ? (
                  <textarea
                    value={(formData as Record<string, string>)[field.key]}
                    onChange={(event) => setFormData((previous) => ({ ...previous, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    rows={3}
                    className="w-full resize-none rounded-lg border border-[#DCE8E5] px-3 py-2 text-sm text-[#28322F] placeholder:text-[#A2AEAA] focus:border-[#008A76] focus:outline-none focus:ring-2 focus:ring-[#008A76]/15"
                  />
                ) : (
                  <input
                    type="text"
                    value={(formData as Record<string, string>)[field.key]}
                    onChange={(event) => setFormData((previous) => ({ ...previous, [field.key]: event.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full rounded-lg border border-[#DCE8E5] px-3 py-2 text-sm text-[#28322F] placeholder:text-[#A2AEAA] focus:border-[#008A76] focus:outline-none focus:ring-2 focus:ring-[#008A76]/15"
                  />
                )}
              </div>
            ))}
          </section>

          <div className="mt-6 flex gap-3 border-t border-[#E4EFEC] pt-5">
            <button
              type="button"
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-[#006D5E] px-4 py-2.5 text-sm font-bold text-white transition-colors hover:bg-[#00594D] disabled:cursor-wait disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-2"
            >
              <Download className="h-4 w-4" />
              {isExporting ? "جاري التصدير..." : "تحميل PDF"}
            </button>
            <button type="button" onClick={() => printElement("cert-preview")} className="flex items-center justify-center gap-2 rounded-lg border border-[#DCE8E5] bg-white px-4 py-2.5 text-sm font-bold text-[#45534F] transition-colors hover:bg-[#F5F8F7] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#008A76] focus-visible:ring-offset-2">
              <Printer className="h-4 w-4" /> طباعة
            </button>
          </div>
        </aside>

        <main className="relative flex min-w-0 flex-1 items-center justify-start overflow-auto bg-[#EEF3F1] p-5 pt-11 sm:justify-center sm:p-8 lg:p-12">
          <p className="absolute right-5 top-3 z-30 rounded-full bg-white px-3 py-1 text-[11px] font-medium text-[#52605C] shadow-sm sm:hidden">
            اسحب أفقيًا لمعاينة الشهادة كاملة
          </p>
          <div
            id="cert-preview"
            className="relative aspect-[1.414/1] w-[720px] max-w-none shrink-0 overflow-hidden bg-white shadow-[0_18px_50px_rgba(40,63,58,0.18)] sm:w-full sm:max-w-[920px]"
            style={{ background: t.bg, fontFamily: "'Cairo', 'Tajawal', sans-serif" }}
            dir={language === "ar" ? "rtl" : "ltr"}
          >
            <div className="absolute inset-x-0 top-0 z-20 h-1.5" style={{ background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientMid}, ${t.gradientEnd})` }} />
            <div className="absolute rounded-[2px]" style={{ inset: "34px", border: `2px solid ${t.borderColor}` }} />
            <div className="absolute rounded-[2px]" style={{ inset: "43px", border: `1px solid ${MOE_COLORS.line}` }} />

            {["top-right", "top-left", "bottom-right", "bottom-left"].map((corner) => {
              const isTop = corner.includes("top");
              const isRight = corner.includes("right");
              return (
                <span
                  key={corner}
                  aria-hidden="true"
                  className="absolute z-10 h-7 w-7"
                  style={{
                    [isTop ? "top" : "bottom"]: "50px",
                    [isRight ? "right" : "left"]: "50px",
                    borderTop: isTop ? `3px solid ${t.borderColor}` : "none",
                    borderBottom: !isTop ? `3px solid ${t.borderColor}` : "none",
                    borderRight: isRight ? `3px solid ${t.borderColor}` : "none",
                    borderLeft: !isRight ? `3px solid ${t.borderColor}` : "none",
                  }}
                />
              );
            })}

            <div className="relative z-10 grid h-full grid-rows-[auto_1fr_auto] px-[9%] pb-[7%] pt-[7%] text-center">
              <header className="flex flex-col items-center">
                <div className="mb-3 flex min-h-[58px] items-center justify-center" aria-label="شعار وزارة التعليم">
                  <MoeLogo variant="original" height={54} />
                </div>
                <h2 className="text-[clamp(1.45rem,2.65vw,2.3rem)] font-black tracking-tight" style={{ color: t.headerColor, fontFamily: "'Tajawal', sans-serif" }}>
                  {certificateTitle}
                </h2>
                <div className="mt-2 h-px w-20" style={{ backgroundColor: MOE_COLORS.primary }} />
                {formData.organization && <p className="mt-2 text-[clamp(0.65rem,1.1vw,0.85rem)] font-medium" style={{ color: t.accentColor }}>{formData.organization}</p>}
              </header>

              <section className="flex flex-col items-center justify-center px-[8%]" aria-label="نص الشهادة">
                <p className="mb-3 text-[clamp(0.72rem,1.25vw,1rem)] leading-relaxed" style={{ color: `${t.textColor}B3` }}>{certificateCopy.intro}</p>
                <h3 className="mb-2 text-[clamp(1.25rem,2.35vw,2rem)] font-black" style={{ color: t.headerColor, fontFamily: "'Tajawal', sans-serif" }}>
                  {formData.recipientName || certificateCopy.recipient}
                </h3>
                {formData.recipientTitle && <p className="mb-4 text-[clamp(0.66rem,1.1vw,0.85rem)] font-bold" style={{ color: t.accentColor }}>{formData.recipientTitle}</p>}
                <span className="mb-4 h-0.5 w-16 rounded-full" style={{ background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientEnd})` }} />
                <p className="max-w-xl text-[clamp(0.8rem,1.35vw,1.05rem)] leading-[1.9]" style={{ color: t.textColor }}>{certificateReason}</p>
              </section>

              <footer className="grid grid-cols-[1fr_auto_1fr] items-end gap-4 text-[clamp(0.55rem,0.95vw,0.75rem)]" aria-label="بيانات الاعتماد">
                <div className="flex flex-col items-start gap-1 text-right">
                  <div className="rounded bg-white p-1" style={{ outline: `1px solid ${MOE_COLORS.line}` }}>
                    <img src={qrData} alt="رمز تحقق الشهادة" className="h-[clamp(2.7rem,5.5vw,4rem)] w-[clamp(2.7rem,5.5vw,4rem)]" />
                  </div>
                  {formData.certNumber && <span className="font-medium" style={{ color: `${t.textColor}A6` }}>{formData.certNumber}</span>}
                </div>
                <div className="min-w-[clamp(8rem,18vw,11rem)] text-center">
                  <div className="mb-1.5 border-t border-dashed pt-1.5" style={{ borderColor: `${t.borderColor}B3` }}>
                    <p className="font-bold" style={{ color: t.headerColor }}>{formData.issuerName || "اسم المانح"}</p>
                    <p className="mt-0.5" style={{ color: `${t.textColor}A6` }}>{formData.issuerTitle || certificateCopy.position}</p>
                  </div>
                </div>
                <div className="text-left">
                  <p style={{ color: `${t.textColor}8C` }}>{certificateCopy.date}</p>
                  <p className="mt-1 font-bold" style={{ color: t.headerColor }}>{formData.date || "____/____/____"}</p>
                </div>
              </footer>
            </div>

            <div className="absolute inset-x-0 bottom-0 z-20" aria-hidden="true">
              <svg viewBox="0 0 920 32" preserveAspectRatio="none" className="block h-5 w-full">
                <defs>
                  <linearGradient id={footerGradId} x1="0" y1="0" x2="1" y2="0">
                    <stop offset="0%" stopColor={t.gradientEnd} />
                    <stop offset="50%" stopColor={t.gradientMid} />
                    <stop offset="100%" stopColor={t.gradientStart} />
                  </linearGradient>
                </defs>
                <path d="M0,32 L0,20 C220,2 550,1 920,14 L920,32 Z" fill={`url(#${footerGradId})`} />
              </svg>
              <div className="h-3" style={{ background: `linear-gradient(to left, ${t.gradientStart}, ${t.gradientMid}, ${t.gradientEnd})` }} />
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
