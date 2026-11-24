export type SchoolCalendarTrigger = {
  id: string;
  seasonBadge: string;
  label: string;
  suggestedTitle: string;
  description: string;
};

export const HIJRI_SCHOOL_CALENDAR_TRIGGERS: readonly SchoolCalendarTrigger[] = [
  {
    id: "welcome-week",
    seasonBadge: "بداية العام / الفصل",
    label: "الأسبوع التمهيدي والتهيئة",
    suggestedTitle: "تقرير برنامج الأسبوع التمهيدي وتهيئة المتعلمين",
    description: "توثيق استقبال الطلاب والتهيئة النفسية والتربوية لبداية الفصل.",
  },
  {
    id: "national-day",
    seasonBadge: "مناسبة وطنية",
    label: "اليوم الوطني السعودي",
    suggestedTitle: "تقرير تفعيل برنامج اليوم الوطني السعودي بالمدرسة",
    description: "توثيق الفعاليات الإذاعية والأنشطة الطلابية والشواهد المرفقة.",
  },
  {
    id: "founding-day",
    seasonBadge: "مناسبة وطنية",
    label: "يوم التأسيس",
    suggestedTitle: "تقرير تفعيل فعالية يوم التأسيس السعودي",
    description: "توثيق الأنشطة الثقافية والمعارض المدرسية المرتبطة بيوم التأسيس.",
  },
  {
    id: "peer-visit",
    seasonBadge: "تطوير مهني",
    label: "زيارة تبادلية / صفية",
    suggestedTitle: "تقرير زيارة تبادلية صفية وتبادل الخبرات التدريسية",
    description: "يدعم عنصر التفاعل مع المجتمع المهني وتنويع استراتيجيات التدريس.",
  },
  {
    id: "plc-workshop",
    seasonBadge: "مجتمع مهني",
    label: "لقاء مجتمع تعلم مهني (PLC)",
    suggestedTitle: "تقرير ورشة عمل مجتمع التعلم المهني وتحليل نواتج التعلم",
    description: "يدعم عنصري المجتمع المهني وتحسين نتائج المتعلمين.",
  },
  {
    id: "term-closing",
    seasonBadge: "ختام الفصل",
    label: "التقرير الختامي للفصل",
    suggestedTitle: "التقرير الختامي لمنجزات وبرامج الفصل الدراسي",
    description: "ملخص شامل للبرامج المنفذة والشواهد والتوصيات للفصل القادم.",
  },
];
