import { useMemo, useState } from "react";
import { ArrowLeft, Eye, QrCode, ShieldCheck, Sparkles } from "lucide-react";
import ministryLogoUrl from "@shared/report-assets/ministry-logo.png";
import { REPORT_MINISTRY_LOGO_ALT } from "@shared/report-appearance";
import { projectReportDocument, REPORT_TEMPLATE_DEFINITIONS } from "@shared/report-projection";

type DemoTemplateKey = "program-report" | "initiative-report" | "visit-report";

const demoPresets: Record<DemoTemplateKey, {
  label: string;
  title: string;
  summary: string;
  objectives: string;
}> = {
  "program-report": {
    label: "تقرير برنامج",
    title: "تقرير برنامج تعزيز الانضباط المدرسي",
    summary: "نُفّذ البرنامج على مدى أسبوع كامل بمشاركة المعلمين والمرشد الطلابي لرفع نسبة الحضور والانضباط الصباحي.",
    objectives: "رفع معدل الانضباط الصباحي إلى ٩٨٪ وتعزيز الشراكة مع أولياء الأمور.",
  },
  "initiative-report": {
    label: "تقرير مبادرة",
    title: "تقرير مبادرة القراءة الإثرائية الصباحية",
    summary: "مبادرة يومية لمدة ١٥ دقيقة قبل الطابور الصباحي لتنمية مهارات الفهم القرائي وتلخيص القصص.",
    objectives: "تمكين المتعلمين من قراءة وتلخيص ١٠ نصوص إثرائية خلال الفصل الدراسي.",
  },
  "visit-report": {
    label: "تقرير زيارة",
    title: "تقرير زيارة تبادلية صفية في استراتيجيات التعلم النشط",
    summary: "زيارة صفية تشاركية بحضور معلمي التخصص لتطبيق استراتيجية التعلم التعاوني والتقويم التكويني السريع.",
    objectives: "تبادل الخبرات التدريسية وتوثيق شواهد التفاعل مع المجتمع المهني.",
  },
};

export default function InstantReportLab({
  onStartRealWork,
}: {
  onStartRealWork: (draft?: { title: string }) => void;
}) {
  const [templateId, setTemplateId] = useState<DemoTemplateKey>("program-report");
  const [title, setTitle] = useState(demoPresets["program-report"].title);
  const [schoolName, setSchoolName] = useState("مدرسة النموذج التعليمية");
  const [preparer, setPreparer] = useState("أ. محمد العتيبي");
  const [summary, setSummary] = useState(demoPresets["program-report"].summary);
  const [objectives, setObjectives] = useState(demoPresets["program-report"].objectives);
  const [showMinistryLogo, setShowMinistryLogo] = useState(true);

  const selectPreset = (nextKey: DemoTemplateKey) => {
    setTemplateId(nextKey);
    setTitle(demoPresets[nextKey].title);
    setSummary(demoPresets[nextKey].summary);
    setObjectives(demoPresets[nextKey].objectives);
  };

  const previewModel = useMemo(() => {
    const template = REPORT_TEMPLATE_DEFINITIONS[templateId];
    try {
      return projectReportDocument({
        reportDraft: {
          schemaVersion: 2,
          templateId: template.id,
          templateVersionId: `${template.id}@${template.version}`,
          themeId: "formal",
          fontFamily: "Cairo",
          fieldDefinitions: template.fields,
          fields: {
            ...(summary.trim() ? { summary: summary.trim() } : {}),
            ...(objectives.trim() ? { objectives: objectives.trim() } : {}),
          },
          evidenceAssetIds: [],
          reportIdentity: {
            version: "1",
            ...(schoolName.trim() ? { schoolName: schoolName.trim() } : {}),
            ...(preparer.trim() ? { reportPreparer: preparer.trim() } : {}),
            ...(showMinistryLogo ? { ministryLogo: true } : {}),
          },
        },
        assets: [],
      });
    } catch {
      return undefined;
    }
  }, [templateId, summary, objectives, schoolName, preparer, showMinistryLogo]);

  return (
    <section className="mt-8 rounded-3xl border border-teal-200 bg-white p-6 shadow-sm sm:p-8" aria-label="جرّب سيرس في 30 ثانية">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-teal-200 bg-teal-50 px-3 py-1 text-xs font-bold text-teal-800">
            <Sparkles className="h-3.5 w-3.5" /> جرّب سيرس في ٣٠ ثانية — بدون تسجيل دخول
          </span>
          <h2 className="mt-2 text-xl font-black text-slate-950 sm:text-2xl" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            عاين شكل تقريرك الرسمي (A4 + رمز تحقق QR) مباشرة في متصفحك
          </h2>
          <p className="mt-1 max-w-2xl text-xs leading-6 text-slate-600">
            هذه معاينة فورية في ذاكرة المتصفح فقط (لا تُرسل أي حرف إلى الخادم ولا تحفظ شيئًا على جهازك). عدّل النصوص وشاهد النتيجة الحقيقية فورًا.
          </p>
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="نماذج معاينة سريعة">
          {(Object.keys(demoPresets) as DemoTemplateKey[]).map(key => (
            <button
              key={key}
              type="button"
              aria-pressed={templateId === key}
              onClick={() => selectPreset(key)}
              className={`min-h-10 rounded-xl px-3 py-1.5 text-xs font-bold transition ${templateId === key ? "bg-teal-700 text-white shadow-sm" : "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100"}`}
            >
              {demoPresets[key].label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.05fr]">
        <div className="space-y-4 rounded-2xl border border-slate-200 bg-slate-50/70 p-4 sm:p-5">
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-xs font-bold text-slate-700">
              عنوان التقرير
              <input
                type="text"
                value={title}
                maxLength={160}
                onChange={event => setTitle(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-teal-500"
              />
            </label>
            <label className="text-xs font-bold text-slate-700">
              المدرسة (اختياري)
              <input
                type="text"
                value={schoolName}
                maxLength={120}
                onChange={event => setSchoolName(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-teal-500"
              />
            </label>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <label className="flex-1 text-xs font-bold text-slate-700">
              معد التقرير (اختياري)
              <input
                type="text"
                value={preparer}
                maxLength={120}
                onChange={event => setPreparer(event.target.value)}
                className="mt-1.5 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal outline-none focus:border-teal-500"
              />
            </label>
            <label className="mt-5 inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-800">
              <input
                type="checkbox"
                checked={showMinistryLogo}
                onChange={event => setShowMinistryLogo(event.target.checked)}
                className="h-4 w-4 accent-teal-700"
              />
              شعار وزارة التعليم
            </label>
          </div>

          <label className="block text-xs font-bold text-slate-700">
            ملخص التقرير
            <textarea
              rows={3}
              maxLength={1000}
              value={summary}
              onChange={event => setSummary(event.target.value)}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-6 outline-none focus:border-teal-500"
            />
          </label>

          <label className="block text-xs font-bold text-slate-700">
            الأهداف
            <textarea
              rows={2}
              maxLength={1000}
              value={objectives}
              onChange={event => setObjectives(event.target.value)}
              className="mt-1.5 w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-6 outline-none focus:border-teal-500"
            />
          </label>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 pt-3">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-600">
              <ShieldCheck className="h-4 w-4 text-teal-700" /> يدعم التصدير الفعلي بصيغتَي PDF وWord قابل للتعديل بعد الحفظ
            </span>
            <button
              type="button"
              onClick={() => onStartRealWork({ title: title.trim() })}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-teal-700 px-4 py-2.5 text-xs font-bold text-white shadow-sm hover:bg-teal-800"
            >
              ابدأ تقريرك الحقيقي وحفظ الشواهد
              <ArrowLeft className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 sm:p-5">
          <div className="mb-3 flex items-center justify-between text-xs text-slate-600">
            <span className="inline-flex items-center gap-1.5 font-bold text-teal-800">
              <Eye className="h-4 w-4" /> معاينة ورقة A4 الرسمية
            </span>
            <span className="rounded-full bg-white px-2.5 py-0.5 text-[11px] font-bold text-slate-700">
              {previewModel?.template.label ?? demoPresets[templateId].label}
            </span>
          </div>

          <article className="mx-auto rounded-xl border-t-8 border-teal-700 bg-white p-5 shadow-sm [overflow-wrap:anywhere] sm:p-7">
            <div className="border-b border-slate-200 pb-4 text-center">
              {previewModel?.identity.ministryLogo && (
                <img src={ministryLogoUrl} alt={REPORT_MINISTRY_LOGO_ALT} className="mx-auto mb-3 h-12 object-contain" />
              )}
              {previewModel?.identity.schoolName && (
                <p className="text-xs font-bold text-slate-700">{previewModel.identity.schoolName}</p>
              )}
              <h3 className="mt-1 text-base font-black text-slate-950 sm:text-lg">
                {title.trim() || "تقرير بدون عنوان"}
              </h3>
            </div>

            <div className="mt-4 space-y-4">
              {(previewModel?.fields ?? []).map(field => (
                <section key={field.key}>
                  <h4 className="text-xs font-black text-slate-900">{field.label}</h4>
                  <p className="mt-1 whitespace-pre-wrap text-xs leading-6 text-slate-700">{String(field.value)}</p>
                </section>
              ))}
            </div>

            <div className="mt-6 flex flex-wrap items-end justify-between gap-4 border-t border-slate-200 pt-4">
              <div className="text-xs">
                {previewModel?.identity.signers[0]?.name && (
                  <>
                    <p className="font-bold text-slate-800">{previewModel.identity.signers[0].label}</p>
                    <p className="mt-1 text-slate-700">{previewModel.identity.signers[0].name}</p>
                  </>
                )}
              </div>
              <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-700">
                <QrCode className="h-7 w-7 shrink-0 text-teal-800" />
                <div>
                  <p className="font-bold text-slate-900">رمز تحقق النسخة (QR)</p>
                  <p className="text-[10px] text-slate-500">يرتبط بالنسخة الثابتة عند التصدير</p>
                </div>
              </div>
            </div>
          </article>
        </div>
      </div>
    </section>
  );
}
