/**
 * بيانات المعايير الرسمية لجميع الوظائف التعليمية
 * مستخرجة من ملف PDF وزارة التعليم - نماذج تقييم أداء شاغلي الوظائف التعليمية
 * هيكل ثلاثي المستويات: معيار → بند → بند فرعي
 */

import type { Standard } from "./standards-data";

// ===== 1. مدير المدرسة (20 عنصر) =====
export const PRINCIPAL_STANDARDS: Standard[] = [
  {
    id: "p-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 5, color: "#2563EB", icon: "📋",
    items: [
      {
        id: "p-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية وأخلاقيات بيئة التعلم",
        subItems: [
          { id: "p-1-1-1", title: "الالتزام بالأنظمة واللوائح الإدارية", suggestedEvidence: ["صورة من الخطابات الرسمية", "محاضر الاجتماعات"] },
          { id: "p-1-1-2", title: "تعزيز الانتماء والولاء للوطن والقيم الوطنية", suggestedEvidence: ["صور الفعاليات الوطنية", "خطة البرامج الوطنية"] },
        ],
        suggestedEvidence: ["تقرير الالتزام بالأنظمة", "شهادات التقدير"],
      },
    ],
  },
  {
    id: "p-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 5, color: "#059669", icon: "🤝",
    items: [
      {
        id: "p-2-1", text: "المشاركة الفعالة في مجتمعات وشبكات التعليم",
        subItems: [
          { id: "p-2-1-1", title: "المشاركة في الدورات والمؤتمرات التعليمية", suggestedEvidence: ["شهادات حضور", "تقارير المشاركة"] },
          { id: "p-2-1-2", title: "تبادل المعرفة وتطوير المهارات المهنية", suggestedEvidence: ["محاضر اجتماعات مجتمعات التعلم", "ملخصات ورش العمل"] },
        ],
        suggestedEvidence: ["شهادات الدورات", "تقارير المشاركة في المجتمعات المهنية"],
      },
    ],
  },
  {
    id: "p-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 5, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      {
        id: "p-3-1", text: "المساهمة في دعم وتحقيق بيئة تعليمية فعالة لتحسين التحصيل الدراسي",
        subItems: [
          { id: "p-3-1-1", title: "تفعيل قنوات اتصال فعالة مع أولياء الأمور", suggestedEvidence: ["سجل التواصل", "رسائل أولياء الأمور"] },
          { id: "p-3-1-2", title: "تشجيع أولياء الأمور على المشاركة في العملية التعليمية", suggestedEvidence: ["محاضر مجالس الآباء", "صور الفعاليات"] },
        ],
        suggestedEvidence: ["سجل التواصل مع أولياء الأمور", "محاضر اجتماعات مجلس الآباء"],
      },
    ],
  },
  {
    id: "p-std-4", number: 4, title: "المرونة والقدرة على التنفيذ في ظروف العمل المختلفة", weight: 5, color: "#7C3AED", icon: "🔄",
    items: [
      {
        id: "p-4-1", text: "مرن وقادر على تنفيذ أعماله في ظل ظروف العمل المختلفة",
        subItems: [
          { id: "p-4-1-1", title: "التكيف مع المتغيرات والتحديات المدرسية", suggestedEvidence: ["خطط الطوارئ", "تقارير إدارة الأزمات"] },
          { id: "p-4-1-2", title: "إيجاد حلول إبداعية للمشكلات", suggestedEvidence: ["تقارير حل المشكلات", "مبادرات التطوير"] },
        ],
        suggestedEvidence: ["تقارير إدارة الأزمات", "خطط الطوارئ المعتمدة"],
      },
    ],
  },
  {
    id: "p-std-5", number: 5, title: "دعم المبادرات النوعية", weight: 5, color: "#CA8A04", icon: "💡",
    items: [
      {
        id: "p-5-1", text: "يدعم ويشارك في المبادرات النوعية",
        subItems: [
          { id: "p-5-1-1", title: "تبني مبادرات تطويرية للمدرسة", suggestedEvidence: ["وثائق المبادرات", "تقارير التنفيذ"] },
          { id: "p-5-1-2", title: "دعم المبادرات الوزارية والمحلية", suggestedEvidence: ["خطابات المشاركة", "تقارير الإنجاز"] },
        ],
        suggestedEvidence: ["وثائق المبادرات النوعية", "تقارير الإنجاز"],
      },
    ],
  },
  {
    id: "p-std-6", number: 6, title: "الانضباط المدرسي", weight: 5, color: "#DC2626", icon: "⚖️",
    items: [
      {
        id: "p-6-1", text: "يتخذ إجراءات تربوية تحقق الانضباط المدرسي",
        subItems: [
          { id: "p-6-1-1", title: "تطبيق لائحة السلوك والمواظبة", suggestedEvidence: ["سجل المخالفات", "تقارير الانضباط"] },
          { id: "p-6-1-2", title: "تعزيز السلوك الإيجابي للطلاب", suggestedEvidence: ["برامج التحفيز", "شهادات التقدير"] },
        ],
        suggestedEvidence: ["سجل الانضباط المدرسي", "خطة تعزيز السلوك الإيجابي"],
      },
    ],
  },
  {
    id: "p-std-7", number: 7, title: "إدارة الموارد", weight: 5, color: "#059669", icon: "📊",
    items: [
      {
        id: "p-7-1", text: "يدير الموارد في المدرسة بكفاءة",
        subItems: [
          { id: "p-7-1-1", title: "إدارة الموارد المالية والمادية", suggestedEvidence: ["التقرير المالي", "جرد العهد"] },
          { id: "p-7-1-2", title: "توزيع المهام والمسؤوليات بعدالة", suggestedEvidence: ["خطة توزيع المهام", "محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["التقرير المالي السنوي", "خطة توزيع الموارد"],
      },
    ],
  },
  {
    id: "p-std-8", number: 8, title: "التطوير المهني", weight: 5, color: "#7C3AED", icon: "📈",
    items: [
      {
        id: "p-8-1", text: "يعد خطة للتطوير المهني",
        subItems: [
          { id: "p-8-1-1", title: "إعداد خطة التطوير المهني للمنسوبين", suggestedEvidence: ["خطة التطوير المهني", "سجل الدورات"] },
          { id: "p-8-1-2", title: "تحديد الاحتياجات التدريبية", suggestedEvidence: ["استبانات الاحتياجات", "تقارير التحليل"] },
        ],
        suggestedEvidence: ["خطة التطوير المهني المعتمدة", "تقارير تنفيذ الخطة"],
      },
    ],
  },
  {
    id: "p-std-9", number: 9, title: "التغذية الراجعة ومتابعة مؤشرات الأداء", weight: 5, color: "#0891B2", icon: "🎯",
    items: [
      {
        id: "p-9-1", text: "يقدم التغذية الراجعة ويتابع تحقق مؤشرات الأداء الوظيفي",
        subItems: [
          { id: "p-9-1-1", title: "تقديم تغذية راجعة بناءة للمنسوبين", suggestedEvidence: ["نماذج التغذية الراجعة", "تقارير الزيارات"] },
          { id: "p-9-1-2", title: "متابعة مؤشرات الأداء المدرسي", suggestedEvidence: ["لوحة المؤشرات", "تقارير الأداء"] },
        ],
        suggestedEvidence: ["تقارير التغذية الراجعة", "لوحة مؤشرات الأداء"],
      },
    ],
  },
  {
    id: "p-std-10", number: 10, title: "دعم برامج التطوير المهني", weight: 5, color: "#CA8A04", icon: "🏋️",
    items: [
      {
        id: "p-10-1", text: "يدعم تنفيذ برامج التطوير المهني",
        subItems: [
          { id: "p-10-1-1", title: "تسهيل حضور المنسوبين للدورات التدريبية", suggestedEvidence: ["خطابات الترشيح", "شهادات الحضور"] },
          { id: "p-10-1-2", title: "تنفيذ برامج تدريبية داخل المدرسة", suggestedEvidence: ["خطة التدريب الداخلي", "تقارير التنفيذ"] },
        ],
        suggestedEvidence: ["سجل برامج التطوير المهني", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "p-std-11", number: 11, title: "تقييم أداء المنسوبين", weight: 5, color: "#DC2626", icon: "📝",
    items: [
      {
        id: "p-11-1", text: "يقيم أداء منسوبي المدرسة",
        subItems: [
          { id: "p-11-1-1", title: "إجراء تقييم دوري للمنسوبين", suggestedEvidence: ["نماذج التقييم", "تقارير الأداء"] },
          { id: "p-11-1-2", title: "توثيق نتائج التقييم ومتابعتها", suggestedEvidence: ["سجل التقييمات", "خطط التحسين"] },
        ],
        suggestedEvidence: ["نماذج تقييم الأداء", "تقارير نتائج التقييم"],
      },
    ],
  },
  {
    id: "p-std-12", number: 12, title: "تحسين نتائج التعلم", weight: 5, color: "#059669", icon: "📊",
    items: [
      {
        id: "p-12-1", text: "ينفذ إجراءات علمية لتحسين نتائج التعلم",
        subItems: [
          { id: "p-12-1-1", title: "تحليل نتائج الطلاب واتخاذ إجراءات تصحيحية", suggestedEvidence: ["تقارير تحليل النتائج", "خطط التحسين"] },
          { id: "p-12-1-2", title: "متابعة تنفيذ خطط تحسين التحصيل", suggestedEvidence: ["تقارير المتابعة", "مقارنات النتائج"] },
        ],
        suggestedEvidence: ["تقارير تحليل النتائج", "خطط تحسين التحصيل"],
      },
    ],
  },
  {
    id: "p-std-13", number: 13, title: "تحسين مستوى أداء المدرسة", weight: 10, color: "#7C3AED", icon: "🏫",
    items: [
      {
        id: "p-13-1", text: "يسهم في تحسين مستوى أداء المدرسة",
        subItems: [
          { id: "p-13-1-1", title: "تطبيق معايير الجودة في الأداء المدرسي", suggestedEvidence: ["تقارير الجودة", "خطط التحسين"] },
          { id: "p-13-1-2", title: "رفع مستوى الأداء في مؤشرات التقييم", suggestedEvidence: ["نتائج التقييم الذاتي", "تقارير الإنجاز"] },
        ],
        suggestedEvidence: ["تقرير التقييم الذاتي للمدرسة", "خطة تحسين الأداء"],
      },
    ],
  },
  {
    id: "p-std-14", number: 14, title: "إعداد الخطط المدرسية", weight: 5, color: "#0891B2", icon: "📋",
    items: [
      {
        id: "p-14-1", text: "يعد الخطط المدرسية اللازمة",
        subItems: [
          { id: "p-14-1-1", title: "إعداد الخطة التشغيلية السنوية", suggestedEvidence: ["الخطة التشغيلية المعتمدة", "مصفوفة الأهداف"] },
          { id: "p-14-1-2", title: "إعداد خطط الطوارئ والأمن والسلامة", suggestedEvidence: ["خطة الطوارئ", "خطة الإخلاء"] },
        ],
        suggestedEvidence: ["الخطة التشغيلية السنوية", "خطط الطوارئ المعتمدة"],
      },
    ],
  },
  {
    id: "p-std-15", number: 15, title: "متابعة تنفيذ الخطط المدرسية", weight: 5, color: "#CA8A04", icon: "✅",
    items: [
      {
        id: "p-15-1", text: "يتابع تنفيذ الخطط المدرسية بمختلف أنواعها",
        subItems: [
          { id: "p-15-1-1", title: "متابعة تنفيذ الخطة التشغيلية", suggestedEvidence: ["تقارير المتابعة الدورية", "نسب الإنجاز"] },
          { id: "p-15-1-2", title: "تقييم مخرجات الخطط وتطويرها", suggestedEvidence: ["تقارير التقييم", "محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["تقارير متابعة تنفيذ الخطط", "نسب الإنجاز"],
      },
    ],
  },
  {
    id: "p-std-16", number: 16, title: "دعم الأنشطة الصفية وغير الصفية", weight: 5, color: "#DC2626", icon: "🎨",
    items: [
      {
        id: "p-16-1", text: "يهيئ الفرص والإمكانات الداعمة لمشاركة الطلاب في الأنشطة الصفية وغير الصفية",
        subItems: [
          { id: "p-16-1-1", title: "توفير الإمكانات اللازمة للأنشطة", suggestedEvidence: ["ميزانية الأنشطة", "قائمة المستلزمات"] },
          { id: "p-16-1-2", title: "دعم مشاركة الطلاب في المسابقات والفعاليات", suggestedEvidence: ["خطابات المشاركة", "شهادات الطلاب"] },
        ],
        suggestedEvidence: ["خطة الأنشطة المدرسية", "تقارير تنفيذ الأنشطة"],
      },
    ],
  },
  {
    id: "p-std-17", number: 17, title: "توظيف المنصات الرقمية", weight: 5, color: "#059669", icon: "💻",
    items: [
      {
        id: "p-17-1", text: "يوظف المنصات الرقمية وتطبيقاتها المعتمدة في دعم عمليات التعليم والتعلم",
        subItems: [
          { id: "p-17-1-1", title: "تفعيل المنصات التعليمية الرقمية", suggestedEvidence: ["تقارير تفعيل المنصات", "إحصائيات الاستخدام"] },
          { id: "p-17-1-2", title: "متابعة استخدام المنسوبين للمنصات", suggestedEvidence: ["تقارير المتابعة", "نسب التفعيل"] },
        ],
        suggestedEvidence: ["تقارير تفعيل المنصات الرقمية", "إحصائيات الاستخدام"],
      },
    ],
  },
  {
    id: "p-std-18", number: 18, title: "تعزيز السلوك الإيجابي", weight: 5, color: "#7C3AED", icon: "⭐",
    items: [
      {
        id: "p-18-1", text: "يتابع تعزيز السلوك الإيجابي للطلاب",
        subItems: [
          { id: "p-18-1-1", title: "تنفيذ برامج تعزيز السلوك الإيجابي", suggestedEvidence: ["خطة البرامج", "صور الفعاليات"] },
          { id: "p-18-1-2", title: "متابعة تطبيق قواعد السلوك والمواظبة", suggestedEvidence: ["تقارير المتابعة", "سجل المخالفات"] },
        ],
        suggestedEvidence: ["خطة تعزيز السلوك الإيجابي", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "p-std-19", number: 19, title: "البيئة المدرسية الآمنة والمحفزة", weight: 5, color: "#0891B2", icon: "🏠",
    items: [
      {
        id: "p-19-1", text: "يهيئ بيئة مدرسية آمنة ومحفزة على التعلم",
        subItems: [
          { id: "p-19-1-1", title: "توفير بيئة مدرسية آمنة وصحية", suggestedEvidence: ["تقارير السلامة", "صور البيئة المدرسية"] },
          { id: "p-19-1-2", title: "تحفيز الطلاب والمنسوبين على التميز", suggestedEvidence: ["برامج التحفيز", "شهادات التقدير"] },
        ],
        suggestedEvidence: ["تقارير البيئة المدرسية", "صور التحسينات"],
      },
    ],
  },
];

// ===== 2. وكيل المدرسة (19 عنصر - نفس مدير المدرسة تقريباً مع اختلافات) =====
export const VICE_PRINCIPAL_STANDARDS: Standard[] = [
  {
    id: "v-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 5, color: "#7C3AED", icon: "📋",
    items: [
      {
        id: "v-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية",
        subItems: [
          { id: "v-1-1-1", title: "الالتزام بالأنظمة واللوائح", suggestedEvidence: ["صورة من الخطابات الرسمية"] },
          { id: "v-1-1-2", title: "تعزيز القيم الوطنية", suggestedEvidence: ["صور الفعاليات الوطنية"] },
        ],
        suggestedEvidence: ["تقرير الالتزام", "شهادات التقدير"],
      },
    ],
  },
  {
    id: "v-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 5, color: "#059669", icon: "🤝",
    items: [
      {
        id: "v-2-1", text: "المشاركة الفعالة في مجتمعات التعليم",
        subItems: [
          { id: "v-2-1-1", title: "المشاركة في الدورات والمؤتمرات", suggestedEvidence: ["شهادات حضور"] },
          { id: "v-2-1-2", title: "تبادل المعرفة المهنية", suggestedEvidence: ["محاضر مجتمعات التعلم"] },
        ],
        suggestedEvidence: ["شهادات الدورات", "تقارير المشاركة"],
      },
    ],
  },
  {
    id: "v-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 5, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      {
        id: "v-3-1", text: "المساهمة في دعم بيئة تعليمية فعالة",
        subItems: [
          { id: "v-3-1-1", title: "تفعيل قنوات التواصل مع أولياء الأمور", suggestedEvidence: ["سجل التواصل"] },
          { id: "v-3-1-2", title: "تشجيع مشاركة أولياء الأمور", suggestedEvidence: ["محاضر مجالس الآباء"] },
        ],
        suggestedEvidence: ["سجل التواصل", "محاضر الاجتماعات"],
      },
    ],
  },
  {
    id: "v-std-4", number: 4, title: "المرونة والقدرة على التنفيذ", weight: 5, color: "#CA8A04", icon: "🔄",
    items: [
      {
        id: "v-4-1", text: "مرن وقادر على تنفيذ أعماله في ظل ظروف العمل المختلفة",
        subItems: [
          { id: "v-4-1-1", title: "التكيف مع المتغيرات", suggestedEvidence: ["تقارير إدارة الأزمات"] },
          { id: "v-4-1-2", title: "إيجاد حلول إبداعية", suggestedEvidence: ["مبادرات التطوير"] },
        ],
        suggestedEvidence: ["تقارير إدارة الأزمات", "خطط الطوارئ"],
      },
    ],
  },
  {
    id: "v-std-5", number: 5, title: "دعم المبادرات النوعية", weight: 10, color: "#DC2626", icon: "💡",
    items: [
      {
        id: "v-5-1", text: "يدعم ويشارك في المبادرات النوعية",
        subItems: [
          { id: "v-5-1-1", title: "المشاركة في المبادرات التطويرية", suggestedEvidence: ["وثائق المبادرات"] },
          { id: "v-5-1-2", title: "دعم المبادرات الوزارية", suggestedEvidence: ["تقارير الإنجاز"] },
        ],
        suggestedEvidence: ["وثائق المبادرات", "تقارير الإنجاز"],
      },
    ],
  },
  {
    id: "v-std-6", number: 6, title: "الانضباط المدرسي", weight: 5, color: "#059669", icon: "⚖️",
    items: [
      {
        id: "v-6-1", text: "يتخذ إجراءات تربوية تحقق الانضباط المدرسي",
        subItems: [
          { id: "v-6-1-1", title: "تطبيق لائحة السلوك والمواظبة", suggestedEvidence: ["سجل المخالفات"] },
          { id: "v-6-1-2", title: "تعزيز السلوك الإيجابي", suggestedEvidence: ["برامج التحفيز"] },
        ],
        suggestedEvidence: ["سجل الانضباط", "خطة تعزيز السلوك"],
      },
    ],
  },
  {
    id: "v-std-7", number: 7, title: "إدارة الموارد", weight: 5, color: "#7C3AED", icon: "📊",
    items: [
      {
        id: "v-7-1", text: "يدير الموارد في المدرسة بكفاءة",
        subItems: [
          { id: "v-7-1-1", title: "إدارة الموارد المتاحة", suggestedEvidence: ["التقرير المالي"] },
          { id: "v-7-1-2", title: "توزيع المهام بعدالة", suggestedEvidence: ["خطة توزيع المهام"] },
        ],
        suggestedEvidence: ["التقرير المالي", "خطة توزيع الموارد"],
      },
    ],
  },
  {
    id: "v-std-8", number: 8, title: "المشاركة في التطوير المهني", weight: 5, color: "#0891B2", icon: "📈",
    items: [
      {
        id: "v-8-1", text: "يشارك في إعداد خطة للتطوير المهني",
        subItems: [
          { id: "v-8-1-1", title: "المشاركة في إعداد خطة التطوير", suggestedEvidence: ["خطة التطوير المهني"] },
          { id: "v-8-1-2", title: "تحديد الاحتياجات التدريبية", suggestedEvidence: ["استبانات الاحتياجات"] },
        ],
        suggestedEvidence: ["خطة التطوير المهني", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "v-std-9", number: 9, title: "التغذية الراجعة ومؤشرات الأداء", weight: 5, color: "#CA8A04", icon: "🎯",
    items: [
      {
        id: "v-9-1", text: "يقدم التغذية الراجعة ويتابع مؤشرات الأداء الوظيفي",
        subItems: [
          { id: "v-9-1-1", title: "تقديم تغذية راجعة بناءة", suggestedEvidence: ["نماذج التغذية الراجعة"] },
          { id: "v-9-1-2", title: "متابعة مؤشرات الأداء", suggestedEvidence: ["لوحة المؤشرات"] },
        ],
        suggestedEvidence: ["تقارير التغذية الراجعة", "لوحة المؤشرات"],
      },
    ],
  },
  {
    id: "v-std-10", number: 10, title: "دعم برامج التطوير المهني", weight: 5, color: "#DC2626", icon: "🏋️",
    items: [
      {
        id: "v-10-1", text: "يدعم تنفيذ برامج التطوير المهني",
        subItems: [
          { id: "v-10-1-1", title: "تسهيل حضور الدورات التدريبية", suggestedEvidence: ["خطابات الترشيح"] },
          { id: "v-10-1-2", title: "تنفيذ برامج تدريبية داخلية", suggestedEvidence: ["خطة التدريب الداخلي"] },
        ],
        suggestedEvidence: ["سجل البرامج", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "v-std-11", number: 11, title: "تقييم أداء المنسوبين", weight: 5, color: "#059669", icon: "📝",
    items: [
      {
        id: "v-11-1", text: "يقيم أداء منسوبي المدرسة",
        subItems: [
          { id: "v-11-1-1", title: "إجراء تقييم دوري", suggestedEvidence: ["نماذج التقييم"] },
          { id: "v-11-1-2", title: "توثيق نتائج التقييم", suggestedEvidence: ["سجل التقييمات"] },
        ],
        suggestedEvidence: ["نماذج التقييم", "تقارير النتائج"],
      },
    ],
  },
  {
    id: "v-std-12", number: 12, title: "تحسين نتائج التعلم", weight: 5, color: "#7C3AED", icon: "📊",
    items: [
      {
        id: "v-12-1", text: "ينفذ إجراءات علمية لتحسين نتائج التعلم",
        subItems: [
          { id: "v-12-1-1", title: "تحليل نتائج الطلاب", suggestedEvidence: ["تقارير التحليل"] },
          { id: "v-12-1-2", title: "متابعة خطط التحسين", suggestedEvidence: ["تقارير المتابعة"] },
        ],
        suggestedEvidence: ["تقارير تحليل النتائج", "خطط التحسين"],
      },
    ],
  },
  {
    id: "v-std-13", number: 13, title: "تحسين مستوى أداء المدرسة", weight: 5, color: "#0891B2", icon: "🏫",
    items: [
      {
        id: "v-13-1", text: "يسهم في تحسين مستوى أداء المدرسة",
        subItems: [
          { id: "v-13-1-1", title: "تطبيق معايير الجودة", suggestedEvidence: ["تقارير الجودة"] },
          { id: "v-13-1-2", title: "رفع مستوى الأداء", suggestedEvidence: ["نتائج التقييم الذاتي"] },
        ],
        suggestedEvidence: ["تقرير التقييم الذاتي", "خطة التحسين"],
      },
    ],
  },
  {
    id: "v-std-14", number: 14, title: "المشاركة في إعداد الخطط المدرسية", weight: 5, color: "#CA8A04", icon: "📋",
    items: [
      {
        id: "v-14-1", text: "يشارك في إعداد الخطط المدرسية اللازمة",
        subItems: [
          { id: "v-14-1-1", title: "المشاركة في إعداد الخطة التشغيلية", suggestedEvidence: ["الخطة التشغيلية"] },
          { id: "v-14-1-2", title: "المشاركة في خطط الطوارئ", suggestedEvidence: ["خطة الطوارئ"] },
        ],
        suggestedEvidence: ["الخطة التشغيلية", "خطط الطوارئ"],
      },
    ],
  },
  {
    id: "v-std-15", number: 15, title: "متابعة تنفيذ الخطط", weight: 5, color: "#DC2626", icon: "✅",
    items: [
      {
        id: "v-15-1", text: "يتابع تنفيذ الخطط المدرسية بمختلف أنواعها",
        subItems: [
          { id: "v-15-1-1", title: "متابعة تنفيذ الخطة التشغيلية", suggestedEvidence: ["تقارير المتابعة"] },
          { id: "v-15-1-2", title: "تقييم مخرجات الخطط", suggestedEvidence: ["تقارير التقييم"] },
        ],
        suggestedEvidence: ["تقارير المتابعة", "نسب الإنجاز"],
      },
    ],
  },
  {
    id: "v-std-16", number: 16, title: "دعم الأنشطة الصفية وغير الصفية", weight: 5, color: "#059669", icon: "🎨",
    items: [
      {
        id: "v-16-1", text: "يهيئ الفرص والإمكانات الداعمة لمشاركة الطلاب في الأنشطة",
        subItems: [
          { id: "v-16-1-1", title: "توفير الإمكانات للأنشطة", suggestedEvidence: ["ميزانية الأنشطة"] },
          { id: "v-16-1-2", title: "دعم مشاركة الطلاب في المسابقات", suggestedEvidence: ["خطابات المشاركة"] },
        ],
        suggestedEvidence: ["خطة الأنشطة", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "v-std-17", number: 17, title: "توظيف المنصات الرقمية", weight: 5, color: "#7C3AED", icon: "💻",
    items: [
      {
        id: "v-17-1", text: "يوظف المنصات الرقمية في دعم التعليم والتعلم",
        subItems: [
          { id: "v-17-1-1", title: "تفعيل المنصات التعليمية", suggestedEvidence: ["تقارير التفعيل"] },
          { id: "v-17-1-2", title: "متابعة استخدام المنصات", suggestedEvidence: ["إحصائيات الاستخدام"] },
        ],
        suggestedEvidence: ["تقارير التفعيل", "إحصائيات الاستخدام"],
      },
    ],
  },
  {
    id: "v-std-18", number: 18, title: "تعزيز السلوك الإيجابي", weight: 5, color: "#0891B2", icon: "⭐",
    items: [
      {
        id: "v-18-1", text: "يتابع تعزيز السلوك الإيجابي للطلاب",
        subItems: [
          { id: "v-18-1-1", title: "تنفيذ برامج تعزيز السلوك", suggestedEvidence: ["خطة البرامج"] },
          { id: "v-18-1-2", title: "متابعة تطبيق قواعد السلوك", suggestedEvidence: ["تقارير المتابعة"] },
        ],
        suggestedEvidence: ["خطة تعزيز السلوك", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "v-std-19", number: 19, title: "البيئة المدرسية الآمنة والمحفزة", weight: 5, color: "#CA8A04", icon: "🏠",
    items: [
      {
        id: "v-19-1", text: "يهيئ بيئة مدرسية آمنة ومحفزة على التعلم",
        subItems: [
          { id: "v-19-1-1", title: "توفير بيئة آمنة وصحية", suggestedEvidence: ["تقارير السلامة"] },
          { id: "v-19-1-2", title: "تحفيز الطلاب والمنسوبين", suggestedEvidence: ["برامج التحفيز"] },
        ],
        suggestedEvidence: ["تقارير البيئة المدرسية", "صور التحسينات"],
      },
    ],
  },
];

// ===== 3. الموجه الطلابي (13 عنصر) =====
export const COUNSELOR_STANDARDS: Standard[] = [
  {
    id: "co-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 20, color: "#0891B2", icon: "📋",
    items: [
      {
        id: "co-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية",
        subItems: [
          { id: "co-1-1-1", title: "الالتزام بالأنظمة واللوائح", suggestedEvidence: ["تقرير الالتزام"] },
          { id: "co-1-1-2", title: "تعزيز القيم الوطنية والمهنية", suggestedEvidence: ["صور الفعاليات"] },
        ],
        suggestedEvidence: ["تقرير الالتزام بالأنظمة"],
      },
    ],
  },
  {
    id: "co-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 5, color: "#059669", icon: "🤝",
    items: [
      {
        id: "co-2-1", text: "المشاركة الفعالة في مجتمعات التعليم",
        subItems: [
          { id: "co-2-1-1", title: "المشاركة في الدورات والورش", suggestedEvidence: ["شهادات حضور"] },
          { id: "co-2-1-2", title: "تبادل الخبرات المهنية", suggestedEvidence: ["محاضر مجتمعات التعلم"] },
        ],
        suggestedEvidence: ["شهادات الدورات"],
      },
    ],
  },
  {
    id: "co-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 5, color: "#7C3AED", icon: "👨‍👩‍👧",
    items: [
      {
        id: "co-3-1", text: "التواصل المستمر مع أولياء الأمور",
        subItems: [
          { id: "co-3-1-1", title: "تفعيل قنوات التواصل", suggestedEvidence: ["سجل التواصل"] },
          { id: "co-3-1-2", title: "إشراك أولياء الأمور في خطط الدعم", suggestedEvidence: ["محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["سجل التواصل مع أولياء الأمور"],
      },
    ],
  },
  {
    id: "co-std-4", number: 4, title: "تعزيز الانضباط", weight: 5, color: "#DC2626", icon: "⚖️",
    items: [
      {
        id: "co-4-1", text: "يقدم التدخلات المناسبة لتعزيز الانضباط",
        subItems: [
          { id: "co-4-1-1", title: "تطبيق إجراءات الانضباط السلوكي", suggestedEvidence: ["سجل الحالات السلوكية"] },
          { id: "co-4-1-2", title: "تقديم برامج وقائية للانضباط", suggestedEvidence: ["خطة البرامج الوقائية"] },
        ],
        suggestedEvidence: ["سجل الحالات السلوكية", "خطة البرامج الوقائية"],
      },
    ],
  },
  {
    id: "co-std-5", number: 5, title: "تعزيز دافعية الطلبة للتعلم", weight: 5, color: "#CA8A04", icon: "🎯",
    items: [
      {
        id: "co-5-1", text: "تقديم برامج تربوية لتعزيز دافعية الطلبة للتعلم",
        subItems: [
          { id: "co-5-1-1", title: "تنفيذ برامج تحفيزية للطلاب", suggestedEvidence: ["خطة البرامج التحفيزية"] },
          { id: "co-5-1-2", title: "دعم الطلاب المتأخرين دراسياً", suggestedEvidence: ["خطط الدعم الفردية"] },
        ],
        suggestedEvidence: ["خطة البرامج التحفيزية", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "co-std-6", number: 6, title: "إعداد خطة التوجيه الطلابي", weight: 10, color: "#059669", icon: "📋",
    items: [
      {
        id: "co-6-1", text: "إعداد خطة لبرامج التوجيه الطلابي",
        subItems: [
          { id: "co-6-1-1", title: "إعداد الخطة السنوية للتوجيه الطلابي", suggestedEvidence: ["الخطة السنوية المعتمدة"] },
          { id: "co-6-1-2", title: "تضمين البرامج الوقائية والعلاجية", suggestedEvidence: ["مصفوفة البرامج"] },
        ],
        suggestedEvidence: ["الخطة السنوية للتوجيه الطلابي", "مصفوفة البرامج"],
      },
    ],
  },
  {
    id: "co-std-7", number: 7, title: "تصنيف الحالات وبرامج الدعم", weight: 10, color: "#7C3AED", icon: "📂",
    items: [
      {
        id: "co-7-1", text: "يصنف الحالات ويقدم برامج الدعم المناسبة",
        subItems: [
          { id: "co-7-1-1", title: "تصنيف الحالات حسب نوعها وشدتها", suggestedEvidence: ["سجل تصنيف الحالات"] },
          { id: "co-7-1-2", title: "تقديم برامج دعم فردية وجماعية", suggestedEvidence: ["خطط الدعم", "تقارير المتابعة"] },
        ],
        suggestedEvidence: ["سجل تصنيف الحالات", "خطط الدعم الفردية"],
      },
    ],
  },
  {
    id: "co-std-8", number: 8, title: "تعزيز القيم والسلوكيات", weight: 10, color: "#0891B2", icon: "⭐",
    items: [
      {
        id: "co-8-1", text: "يعزز القيم والسلوكيات للمتعلمين",
        subItems: [
          { id: "co-8-1-1", title: "تنفيذ برامج تعزيز القيم", suggestedEvidence: ["خطة البرامج", "صور الفعاليات"] },
          { id: "co-8-1-2", title: "توعية الطلاب بالسلوكيات الإيجابية", suggestedEvidence: ["نشرات توعوية", "محاضرات"] },
        ],
        suggestedEvidence: ["خطة برامج تعزيز القيم", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "co-std-9", number: 9, title: "التدخلات النفسية والاجتماعية", weight: 10, color: "#DC2626", icon: "🧠",
    items: [
      {
        id: "co-9-1", text: "يقدم التدخلات النفسية والاجتماعية",
        subItems: [
          { id: "co-9-1-1", title: "تقديم جلسات إرشاد فردي وجماعي", suggestedEvidence: ["سجل الجلسات الإرشادية"] },
          { id: "co-9-1-2", title: "التعامل مع الحالات النفسية والاجتماعية", suggestedEvidence: ["ملفات الحالات", "تقارير المتابعة"] },
        ],
        suggestedEvidence: ["سجل الجلسات الإرشادية", "ملفات الحالات"],
      },
    ],
  },
  {
    id: "co-std-10", number: 10, title: "التخطيط المهني والتعليمي", weight: 5, color: "#CA8A04", icon: "🎓",
    items: [
      {
        id: "co-10-1", text: "يساعد المتعلمين على التخطيط المهني والتعليمي",
        subItems: [
          { id: "co-10-1-1", title: "تقديم برامج الإرشاد المهني", suggestedEvidence: ["خطة الإرشاد المهني"] },
          { id: "co-10-1-2", title: "مساعدة الطلاب في اختيار التخصصات", suggestedEvidence: ["سجل الاستشارات"] },
        ],
        suggestedEvidence: ["خطة الإرشاد المهني", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "co-std-11", number: 11, title: "تعزيز التفوق الدراسي", weight: 5, color: "#059669", icon: "🏆",
    items: [
      {
        id: "co-11-1", text: "يعزز التفوق الدراسي",
        subItems: [
          { id: "co-11-1-1", title: "تكريم المتفوقين دراسياً", suggestedEvidence: ["صور التكريم", "شهادات التقدير"] },
          { id: "co-11-1-2", title: "تنفيذ برامج رعاية المتفوقين", suggestedEvidence: ["خطة رعاية المتفوقين"] },
        ],
        suggestedEvidence: ["خطة رعاية المتفوقين", "صور التكريم"],
      },
    ],
  },
  {
    id: "co-std-12", number: 12, title: "تدخلات للمتأخرين دراسياً", weight: 5, color: "#7C3AED", icon: "📖",
    items: [
      {
        id: "co-12-1", text: "يقدم تدخلات تربوية للمتأخرين دراسياً والمعيدين",
        subItems: [
          { id: "co-12-1-1", title: "حصر الطلاب المتأخرين دراسياً", suggestedEvidence: ["كشوف الطلاب المتأخرين"] },
          { id: "co-12-1-2", title: "تنفيذ خطط علاجية فردية", suggestedEvidence: ["خطط العلاج الفردية", "تقارير المتابعة"] },
        ],
        suggestedEvidence: ["كشوف المتأخرين دراسياً", "خطط العلاج"],
      },
    ],
  },
  {
    id: "co-std-13", number: 13, title: "توعية بقواعد السلوك والمواظبة", weight: 5, color: "#0891B2", icon: "📢",
    items: [
      {
        id: "co-13-1", text: "توعية المتعلمين وأولياء أمورهم بقواعد السلوك والمواظبة",
        subItems: [
          { id: "co-13-1-1", title: "تنفيذ برامج توعوية بقواعد السلوك", suggestedEvidence: ["نشرات توعوية", "صور الفعاليات"] },
          { id: "co-13-1-2", title: "إشراك أولياء الأمور في التوعية", suggestedEvidence: ["رسائل أولياء الأمور", "محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["نشرات التوعية", "تقارير التنفيذ"],
      },
    ],
  },
];

// ===== 4. الموجه الصحي (14 عنصر = 11 مشترك + 3 خاص) =====
export const HEALTH_COUNSELOR_STANDARDS: Standard[] = [
  {
    id: "hc-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 10, color: "#DC2626", icon: "📋",
    items: [
      {
        id: "hc-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية",
        subItems: [
          { id: "hc-1-1-1", title: "الالتزام بالأنظمة واللوائح", suggestedEvidence: ["تقرير الالتزام"] },
          { id: "hc-1-1-2", title: "تعزيز القيم المهنية والصحية", suggestedEvidence: ["صور الفعاليات الصحية"] },
        ],
        suggestedEvidence: ["تقرير الالتزام بالأنظمة"],
      },
    ],
  },
  {
    id: "hc-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 10, color: "#059669", icon: "🤝",
    items: [
      { id: "hc-2-1", text: "المشاركة الفعالة في مجتمعات التعليم", subItems: [
        { id: "hc-2-1-1", title: "المشاركة في الدورات الصحية والتعليمية", suggestedEvidence: ["شهادات حضور"] },
      ], suggestedEvidence: ["شهادات الدورات"] },
    ],
  },
  {
    id: "hc-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 5, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      { id: "hc-3-1", text: "التواصل مع أولياء الأمور بشأن الحالات الصحية", subItems: [
        { id: "hc-3-1-1", title: "إبلاغ أولياء الأمور بالحالات الصحية", suggestedEvidence: ["سجل التواصل"] },
        { id: "hc-3-1-2", title: "التوعية الصحية لأولياء الأمور", suggestedEvidence: ["نشرات صحية"] },
      ], suggestedEvidence: ["سجل التواصل", "نشرات التوعية"] },
    ],
  },
  {
    id: "hc-std-4", number: 4, title: "التنويع في استراتيجيات التدريس", weight: 5, color: "#7C3AED", icon: "📚",
    items: [
      { id: "hc-4-1", text: "استخدام أساليب تدريس مناسبة", subItems: [
        { id: "hc-4-1-1", title: "استخدام استراتيجيات تدريس متنوعة", suggestedEvidence: ["نماذج من الدروس"] },
      ], suggestedEvidence: ["نماذج التحضير"] },
    ],
  },
  {
    id: "hc-std-5", number: 5, title: "تحسين نتائج المتعلمين", weight: 5, color: "#CA8A04", icon: "📈",
    items: [
      { id: "hc-5-1", text: "تحسين التحصيل الدراسي للمتعلمين", subItems: [
        { id: "hc-5-1-1", title: "معالجة نقاط الضعف وتطوير نقاط القوة", suggestedEvidence: ["خطط التحسين"] },
      ], suggestedEvidence: ["تقارير النتائج"] },
    ],
  },
  {
    id: "hc-std-6", number: 6, title: "إعداد وتنفيذ خطة التعلم", weight: 5, color: "#059669", icon: "📝",
    items: [
      { id: "hc-6-1", text: "إعداد خطة منظمة للتعلم", subItems: [
        { id: "hc-6-1-1", title: "إعداد خطة التعلم وفق السياسات المنظمة", suggestedEvidence: ["خطة التعلم"] },
      ], suggestedEvidence: ["خطة التعلم المعتمدة"] },
    ],
  },
  {
    id: "hc-std-7", number: 7, title: "توظيف تقنيات ووسائل التعلم", weight: 5, color: "#DC2626", icon: "💻",
    items: [
      { id: "hc-7-1", text: "استخدام الوسائل التعليمية المناسبة", subItems: [
        { id: "hc-7-1-1", title: "توظيف التقنيات التعليمية", suggestedEvidence: ["صور استخدام التقنيات"] },
      ], suggestedEvidence: ["تقارير استخدام التقنيات"] },
    ],
  },
  {
    id: "hc-std-8", number: 8, title: "تهيئة بيئة تعليمية", weight: 5, color: "#7C3AED", icon: "🏫",
    items: [
      { id: "hc-8-1", text: "تهيئة بيئة تعليمية آمنة ومحفزة", subItems: [
        { id: "hc-8-1-1", title: "توفير بيئة تعليمية صحية وآمنة", suggestedEvidence: ["صور البيئة الصفية"] },
      ], suggestedEvidence: ["تقارير البيئة التعليمية"] },
    ],
  },
  {
    id: "hc-std-9", number: 9, title: "الإدارة الصفية", weight: 5, color: "#0891B2", icon: "🎓",
    items: [
      { id: "hc-9-1", text: "إدارة الصف بفاعلية", subItems: [
        { id: "hc-9-1-1", title: "مراعاة الفروق الفردية وتنظيم الصف", suggestedEvidence: ["خطة الإدارة الصفية"] },
      ], suggestedEvidence: ["تقارير الإدارة الصفية"] },
    ],
  },
  {
    id: "hc-std-10", number: 10, title: "تحليل نتائج المتعلمين", weight: 10, color: "#CA8A04", icon: "📊",
    items: [
      { id: "hc-10-1", text: "تحليل نتائج المتعلمين وتشخيص مستوياتهم", subItems: [
        { id: "hc-10-1-1", title: "تحليل البيانات وتقديم تغذية راجعة", suggestedEvidence: ["تقارير التحليل"] },
      ], suggestedEvidence: ["تقارير تحليل النتائج"] },
    ],
  },
  {
    id: "hc-std-11", number: 11, title: "تنوع أساليب التقويم", weight: 5, color: "#059669", icon: "📝",
    items: [
      { id: "hc-11-1", text: "استخدام أساليب تقويم متنوعة", subItems: [
        { id: "hc-11-1-1", title: "توظيف أدوات تقويم متعددة", suggestedEvidence: ["نماذج التقويم"] },
      ], suggestedEvidence: ["أدوات التقويم المتنوعة"] },
    ],
  },
  // === العناصر الخاصة بالموجه الصحي ===
  {
    id: "hc-std-12", number: 12, title: "تنفيذ الخطة المشتركة للبرامج الصحية المدرسية", weight: 15, color: "#DC2626", icon: "🏥",
    items: [
      {
        id: "hc-12-1", text: "تنفيذ الخطة المشتركة للبرامج الصحية المدرسية",
        subItems: [
          { id: "hc-12-1-1", title: "إعداد وتنفيذ خطة البرامج الصحية السنوية", suggestedEvidence: ["الخطة الصحية المعتمدة", "تقارير التنفيذ"] },
          { id: "hc-12-1-2", title: "تنفيذ برامج التوعية الصحية للطلاب", suggestedEvidence: ["صور الفعاليات", "نشرات صحية"] },
          { id: "hc-12-1-3", title: "التنسيق مع الجهات الصحية المعنية", suggestedEvidence: ["خطابات التنسيق", "محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["الخطة الصحية السنوية", "تقارير تنفيذ البرامج الصحية"],
      },
    ],
  },
  {
    id: "hc-std-13", number: 13, title: "حصر الحالات الصحية للمتعلمين", weight: 5, color: "#F97316", icon: "📋",
    items: [
      {
        id: "hc-13-1", text: "حصر الحالات الصحية للمتعلمين",
        subItems: [
          { id: "hc-13-1-1", title: "حصر وتوثيق الحالات الصحية المزمنة", suggestedEvidence: ["سجل الحالات الصحية", "كشوف الحصر"] },
          { id: "hc-13-1-2", title: "متابعة الحالات الصحية بشكل دوري", suggestedEvidence: ["تقارير المتابعة", "سجل الزيارات"] },
        ],
        suggestedEvidence: ["سجل الحالات الصحية", "تقارير المتابعة الدورية"],
      },
    ],
  },
  {
    id: "hc-std-14", number: 14, title: "تهيئة البيئة الصحية المدرسية", weight: 10, color: "#10B981", icon: "🌿",
    items: [
      {
        id: "hc-14-1", text: "تهيئة البيئة الصحية المدرسية",
        subItems: [
          { id: "hc-14-1-1", title: "متابعة نظافة المرافق المدرسية", suggestedEvidence: ["تقارير النظافة", "صور المرافق"] },
          { id: "hc-14-1-2", title: "التأكد من توفر مستلزمات الإسعافات الأولية", suggestedEvidence: ["قائمة المستلزمات", "صور الغرفة الصحية"] },
          { id: "hc-14-1-3", title: "متابعة سلامة المقصف المدرسي", suggestedEvidence: ["تقارير المتابعة", "نماذج الفحص"] },
        ],
        suggestedEvidence: ["تقارير البيئة الصحية", "صور المرافق الصحية"],
      },
    ],
  },
];

// ===== 5. رائد النشاط / معلم مسند له نشاط طلابي (15 عنصر) =====
export const ACTIVITY_LEADER_STANDARDS: Standard[] = [
  {
    id: "al-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 10, color: "#F97316", icon: "📋",
    items: [
      { id: "al-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية", subItems: [
        { id: "al-1-1-1", title: "الالتزام بالأنظمة واللوائح", suggestedEvidence: ["تقرير الالتزام"] },
        { id: "al-1-1-2", title: "تعزيز القيم الوطنية", suggestedEvidence: ["صور الفعاليات الوطنية"] },
      ], suggestedEvidence: ["تقرير الالتزام بالأنظمة"] },
    ],
  },
  {
    id: "al-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 10, color: "#059669", icon: "🤝",
    items: [
      { id: "al-2-1", text: "المشاركة الفعالة في مجتمعات التعليم", subItems: [
        { id: "al-2-1-1", title: "المشاركة في الدورات والورش", suggestedEvidence: ["شهادات حضور"] },
      ], suggestedEvidence: ["شهادات الدورات"] },
    ],
  },
  {
    id: "al-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 10, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      { id: "al-3-1", text: "التواصل مع أولياء الأمور", subItems: [
        { id: "al-3-1-1", title: "تفعيل قنوات التواصل", suggestedEvidence: ["سجل التواصل"] },
      ], suggestedEvidence: ["سجل التواصل"] },
    ],
  },
  {
    id: "al-std-4", number: 4, title: "التنويع في استراتيجيات التدريس", weight: 5, color: "#7C3AED", icon: "📚",
    items: [
      { id: "al-4-1", text: "استخدام أساليب تدريس متنوعة", subItems: [
        { id: "al-4-1-1", title: "استخدام استراتيجيات تدريس مناسبة", suggestedEvidence: ["نماذج التحضير"] },
      ], suggestedEvidence: ["نماذج الدروس"] },
    ],
  },
  {
    id: "al-std-5", number: 5, title: "تحسين نتائج المتعلمين", weight: 5, color: "#CA8A04", icon: "📈",
    items: [
      { id: "al-5-1", text: "تحسين التحصيل الدراسي", subItems: [
        { id: "al-5-1-1", title: "معالجة نقاط الضعف", suggestedEvidence: ["خطط التحسين"] },
      ], suggestedEvidence: ["تقارير النتائج"] },
    ],
  },
  {
    id: "al-std-6", number: 6, title: "إعداد وتنفيذ خطة التعلم", weight: 5, color: "#059669", icon: "📝",
    items: [
      { id: "al-6-1", text: "إعداد خطة منظمة للتعلم", subItems: [
        { id: "al-6-1-1", title: "إعداد خطة التعلم", suggestedEvidence: ["خطة التعلم"] },
      ], suggestedEvidence: ["خطة التعلم المعتمدة"] },
    ],
  },
  {
    id: "al-std-7", number: 7, title: "توظيف تقنيات ووسائل التعلم", weight: 5, color: "#DC2626", icon: "💻",
    items: [
      { id: "al-7-1", text: "استخدام الوسائل التعليمية المناسبة", subItems: [
        { id: "al-7-1-1", title: "توظيف التقنيات التعليمية", suggestedEvidence: ["صور استخدام التقنيات"] },
      ], suggestedEvidence: ["تقارير استخدام التقنيات"] },
    ],
  },
  {
    id: "al-std-8", number: 8, title: "تهيئة بيئة تعليمية", weight: 5, color: "#7C3AED", icon: "🏫",
    items: [
      { id: "al-8-1", text: "تهيئة بيئة تعليمية آمنة", subItems: [
        { id: "al-8-1-1", title: "توفير بيئة تعليمية محفزة", suggestedEvidence: ["صور البيئة الصفية"] },
      ], suggestedEvidence: ["تقارير البيئة التعليمية"] },
    ],
  },
  {
    id: "al-std-9", number: 9, title: "الإدارة الصفية", weight: 5, color: "#0891B2", icon: "🎓",
    items: [
      { id: "al-9-1", text: "إدارة الصف بفاعلية", subItems: [
        { id: "al-9-1-1", title: "مراعاة الفروق الفردية", suggestedEvidence: ["خطة الإدارة الصفية"] },
      ], suggestedEvidence: ["تقارير الإدارة الصفية"] },
    ],
  },
  {
    id: "al-std-10", number: 10, title: "تحليل نتائج المتعلمين", weight: 5, color: "#CA8A04", icon: "📊",
    items: [
      { id: "al-10-1", text: "تحليل نتائج المتعلمين وتشخيص مستوياتهم", subItems: [
        { id: "al-10-1-1", title: "تحليل البيانات", suggestedEvidence: ["تقارير التحليل"] },
      ], suggestedEvidence: ["تقارير تحليل النتائج"] },
    ],
  },
  {
    id: "al-std-11", number: 11, title: "تنوع أساليب التقويم", weight: 5, color: "#059669", icon: "📝",
    items: [
      { id: "al-11-1", text: "استخدام أساليب تقويم متنوعة", subItems: [
        { id: "al-11-1-1", title: "توظيف أدوات تقويم متعددة", suggestedEvidence: ["نماذج التقويم"] },
      ], suggestedEvidence: ["أدوات التقويم المتنوعة"] },
    ],
  },
  // === العناصر الخاصة بالنشاط الطلابي ===
  {
    id: "al-std-12", number: 12, title: "إعداد خطة النشاط الطلابي", weight: 10, color: "#F97316", icon: "📋",
    items: [
      {
        id: "al-12-1", text: "إعداد خطة مزمنة ومعتمدة لبرامج وفعاليات النشاط الطلابي",
        subItems: [
          { id: "al-12-1-1", title: "إعداد الخطة السنوية للنشاط الطلابي", suggestedEvidence: ["الخطة السنوية المعتمدة", "الجدول الزمني"] },
          { id: "al-12-1-2", title: "تحديد البرامج والفعاليات المناسبة", suggestedEvidence: ["مصفوفة البرامج", "ميزانية الأنشطة"] },
          { id: "al-12-1-3", title: "التنسيق مع الجهات المعنية لتنفيذ الخطة", suggestedEvidence: ["خطابات التنسيق", "محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["الخطة السنوية للنشاط الطلابي", "الجدول الزمني المعتمد"],
      },
    ],
  },
  {
    id: "al-std-13", number: 13, title: "تهيئة البيئة المدرسية للأنشطة", weight: 5, color: "#10B981", icon: "🎨",
    items: [
      {
        id: "al-13-1", text: "تهيئة البيئة المدرسية للبرامج والأنشطة الطلابية",
        subItems: [
          { id: "al-13-1-1", title: "توفير المستلزمات والأدوات اللازمة للأنشطة", suggestedEvidence: ["قائمة المستلزمات", "صور التجهيزات"] },
          { id: "al-13-1-2", title: "تهيئة الأماكن المناسبة لتنفيذ الأنشطة", suggestedEvidence: ["صور الأماكن المهيأة", "تقارير التجهيز"] },
        ],
        suggestedEvidence: ["صور تهيئة البيئة المدرسية", "تقارير التجهيز"],
      },
    ],
  },
  {
    id: "al-std-14", number: 14, title: "دعم المتعلمين وفق احتياجاتهم", weight: 5, color: "#8B5CF6", icon: "🎯",
    items: [
      {
        id: "al-14-1", text: "يدعم المتعلمين وفق احتياجاتهم وميولهم للأنشطة",
        subItems: [
          { id: "al-14-1-1", title: "استطلاع ميول واحتياجات الطلاب", suggestedEvidence: ["استبانات الميول", "نتائج الاستطلاع"] },
          { id: "al-14-1-2", title: "توجيه الطلاب للأنشطة المناسبة لميولهم", suggestedEvidence: ["سجل توزيع الطلاب", "تقارير المتابعة"] },
        ],
        suggestedEvidence: ["استبانات ميول الطلاب", "سجل توزيع الطلاب على الأنشطة"],
      },
    ],
  },
  {
    id: "al-std-15", number: 15, title: "تحفيز المتعلمين على المشاركة", weight: 10, color: "#EF4444", icon: "🏆",
    items: [
      {
        id: "al-15-1", text: "يحفز المتعلمين على المشاركة في الأنشطة المدرسية",
        subItems: [
          { id: "al-15-1-1", title: "تنفيذ برامج تحفيزية للمشاركة في الأنشطة", suggestedEvidence: ["خطة التحفيز", "صور التكريم"] },
          { id: "al-15-1-2", title: "تكريم الطلاب المتميزين في الأنشطة", suggestedEvidence: ["شهادات التقدير", "صور التكريم"] },
          { id: "al-15-1-3", title: "نشر ثقافة المشاركة في الأنشطة", suggestedEvidence: ["نشرات توعوية", "إعلانات الأنشطة"] },
        ],
        suggestedEvidence: ["خطة التحفيز", "صور التكريم", "إحصائيات المشاركة"],
      },
    ],
  },
];

// ===== 6. محضر المختبر (13 عنصر) =====
export const LAB_TECHNICIAN_STANDARDS: Standard[] = [
  {
    id: "lt-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 10, color: "#6366F1", icon: "📋",
    items: [
      { id: "lt-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية", subItems: [
        { id: "lt-1-1-1", title: "الالتزام بالأنظمة واللوائح", suggestedEvidence: ["تقرير الالتزام"] },
      ], suggestedEvidence: ["تقرير الالتزام بالأنظمة"] },
    ],
  },
  {
    id: "lt-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 10, color: "#059669", icon: "🤝",
    items: [
      { id: "lt-2-1", text: "المشاركة الفعالة في مجتمعات التعليم", subItems: [
        { id: "lt-2-1-1", title: "المشاركة في الدورات والورش", suggestedEvidence: ["شهادات حضور"] },
      ], suggestedEvidence: ["شهادات الدورات"] },
    ],
  },
  {
    id: "lt-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 10, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      { id: "lt-3-1", text: "التواصل مع أولياء الأمور", subItems: [
        { id: "lt-3-1-1", title: "تفعيل قنوات التواصل", suggestedEvidence: ["سجل التواصل"] },
      ], suggestedEvidence: ["سجل التواصل"] },
    ],
  },
  {
    id: "lt-std-4", number: 4, title: "التنويع في استراتيجيات التدريس", weight: 10, color: "#7C3AED", icon: "📚",
    items: [
      { id: "lt-4-1", text: "دعم المعلمين في استراتيجيات التدريس العملية", subItems: [
        { id: "lt-4-1-1", title: "تجهيز التجارب العملية المناسبة", suggestedEvidence: ["سجل التجارب"] },
      ], suggestedEvidence: ["سجل التجارب العملية"] },
    ],
  },
  {
    id: "lt-std-5", number: 5, title: "تحسين نتائج المتعلمين", weight: 10, color: "#CA8A04", icon: "📈",
    items: [
      { id: "lt-5-1", text: "المساهمة في تحسين نتائج المتعلمين", subItems: [
        { id: "lt-5-1-1", title: "توفير بيئة عملية تدعم التعلم", suggestedEvidence: ["صور المختبر"] },
      ], suggestedEvidence: ["تقارير الأنشطة العملية"] },
    ],
  },
  // === العناصر الخاصة بمحضر المختبر ===
  {
    id: "lt-std-6", number: 6, title: "إعداد خطة يومية لأنشطة المختبر", weight: 5, color: "#6366F1", icon: "📋",
    items: [
      {
        id: "lt-6-1", text: "يعد خطة يومية لأنشطة المختبر",
        subItems: [
          { id: "lt-6-1-1", title: "إعداد الجدول اليومي للتجارب والأنشطة", suggestedEvidence: ["الجدول اليومي", "خطة الأنشطة"] },
          { id: "lt-6-1-2", title: "التنسيق مع المعلمين حول التجارب المطلوبة", suggestedEvidence: ["سجل التنسيق", "محاضر الاجتماعات"] },
        ],
        suggestedEvidence: ["الخطة اليومية للمختبر", "سجل التنسيق مع المعلمين"],
      },
    ],
  },
  {
    id: "lt-std-7", number: 7, title: "المعرفة بالأسس والمفاهيم الفنية", weight: 5, color: "#059669", icon: "🔬",
    items: [
      {
        id: "lt-7-1", text: "المعرفة بالأسس والمفاهيم الفنية",
        subItems: [
          { id: "lt-7-1-1", title: "الإلمام بأساسيات التجارب العلمية", suggestedEvidence: ["شهادات التدريب", "سجل التجارب"] },
          { id: "lt-7-1-2", title: "معرفة خصائص المواد الكيميائية والأجهزة", suggestedEvidence: ["دليل المواد", "سجل الأجهزة"] },
        ],
        suggestedEvidence: ["شهادات التدريب الفني", "سجل المعرفة الفنية"],
      },
    ],
  },
  {
    id: "lt-std-8", number: 8, title: "توفير مستلزمات التجارب العلمية", weight: 5, color: "#DC2626", icon: "🧪",
    items: [
      {
        id: "lt-8-1", text: "يوفر المستلزمات اللازمة لأداء التجارب العلمية",
        subItems: [
          { id: "lt-8-1-1", title: "جرد المواد والأدوات المتوفرة", suggestedEvidence: ["كشف الجرد", "قائمة المواد"] },
          { id: "lt-8-1-2", title: "طلب المواد والأدوات الناقصة", suggestedEvidence: ["طلبات الشراء", "محاضر الاستلام"] },
        ],
        suggestedEvidence: ["كشف جرد المواد", "طلبات الشراء"],
      },
    ],
  },
  {
    id: "lt-std-9", number: 9, title: "السلامة المهنية", weight: 5, color: "#F97316", icon: "⚠️",
    items: [
      {
        id: "lt-9-1", text: "يلتزم بسياسات وإجراءات السلامة المهنية",
        subItems: [
          { id: "lt-9-1-1", title: "تطبيق إجراءات السلامة في المختبر", suggestedEvidence: ["لوحات السلامة", "سجل الحوادث"] },
          { id: "lt-9-1-2", title: "توفير أدوات السلامة والحماية", suggestedEvidence: ["قائمة أدوات السلامة", "صور التجهيزات"] },
          { id: "lt-9-1-3", title: "تدريب الطلاب على إجراءات السلامة", suggestedEvidence: ["خطة التدريب", "صور التدريب"] },
        ],
        suggestedEvidence: ["سجل السلامة المهنية", "صور أدوات السلامة"],
      },
    ],
  },
  {
    id: "lt-std-10", number: 10, title: "تحضير وتجهيز المختبر", weight: 5, color: "#7C3AED", icon: "🔧",
    items: [
      {
        id: "lt-10-1", text: "يحضر ويجهز المختبر",
        subItems: [
          { id: "lt-10-1-1", title: "تجهيز المختبر قبل الحصص العملية", suggestedEvidence: ["صور التجهيز", "سجل التحضير"] },
          { id: "lt-10-1-2", title: "ترتيب وتنظيف المختبر بعد الاستخدام", suggestedEvidence: ["صور النظافة", "سجل الصيانة"] },
        ],
        suggestedEvidence: ["سجل تحضير المختبر", "صور التجهيز"],
      },
    ],
  },
  {
    id: "lt-std-11", number: 11, title: "تهيئة وتسليم الأجهزة", weight: 5, color: "#0891B2", icon: "📦",
    items: [
      {
        id: "lt-11-1", text: "تهيئة وتسليم الأجهزة المطلوبة للمعلمين وتخزينها بطريقة سليمة",
        subItems: [
          { id: "lt-11-1-1", title: "تسليم الأجهزة والمواد للمعلمين", suggestedEvidence: ["سجل التسليم", "نماذج الاستلام"] },
          { id: "lt-11-1-2", title: "تخزين الأجهزة والمواد بطريقة سليمة", suggestedEvidence: ["صور التخزين", "سجل المستودع"] },
        ],
        suggestedEvidence: ["سجل تسليم الأجهزة", "صور التخزين"],
      },
    ],
  },
  {
    id: "lt-std-12", number: 12, title: "تقرير أنشطة ومهام المختبر الأسبوعية", weight: 10, color: "#CA8A04", icon: "📊",
    items: [
      {
        id: "lt-12-1", text: "يعد تقرير أنشطة ومهام المختبر الأسبوعية",
        subItems: [
          { id: "lt-12-1-1", title: "إعداد تقرير أسبوعي شامل عن أنشطة المختبر", suggestedEvidence: ["التقارير الأسبوعية", "سجل الأنشطة"] },
          { id: "lt-12-1-2", title: "توثيق التجارب المنفذة ونتائجها", suggestedEvidence: ["سجل التجارب", "صور التجارب"] },
        ],
        suggestedEvidence: ["التقارير الأسبوعية للمختبر", "سجل الأنشطة"],
      },
    ],
  },
  {
    id: "lt-std-13", number: 13, title: "تقارير دورية عن الأجهزة والمعدات", weight: 10, color: "#DC2626", icon: "📝",
    items: [
      {
        id: "lt-13-1", text: "يعد تقارير دورية عن حالة الأجهزة والمعدات",
        subItems: [
          { id: "lt-13-1-1", title: "فحص الأجهزة والمعدات دورياً", suggestedEvidence: ["سجل الفحص", "تقارير الصيانة"] },
          { id: "lt-13-1-2", title: "إعداد تقارير عن الأجهزة التالفة والمطلوب صيانتها", suggestedEvidence: ["تقارير الأعطال", "طلبات الصيانة"] },
          { id: "lt-13-1-3", title: "متابعة عمليات الصيانة والإصلاح", suggestedEvidence: ["سجل الصيانة", "محاضر الاستلام"] },
        ],
        suggestedEvidence: ["تقارير حالة الأجهزة", "سجل الصيانة"],
      },
    ],
  },
];

// ===== 7. معلمة رياض الأطفال (19 عنصر) =====
export const KINDERGARTEN_STANDARDS: Standard[] = [
  {
    id: "kg-std-1", number: 1, title: "أداء الواجبات الوظيفية", weight: 10, color: "#EC4899", icon: "📋",
    items: [
      { id: "kg-1-1", text: "يطبق الأنظمة وقواعد السلوك الوظيفية", subItems: [
        { id: "kg-1-1-1", title: "الالتزام بالأنظمة واللوائح", suggestedEvidence: ["تقرير الالتزام"] },
        { id: "kg-1-1-2", title: "تعزيز القيم المهنية", suggestedEvidence: ["صور الفعاليات"] },
      ], suggestedEvidence: ["تقرير الالتزام بالأنظمة"] },
    ],
  },
  {
    id: "kg-std-2", number: 2, title: "التفاعل مع المجتمع المهني", weight: 5, color: "#059669", icon: "🤝",
    items: [
      { id: "kg-2-1", text: "المشاركة الفعالة في مجتمعات التعليم", subItems: [
        { id: "kg-2-1-1", title: "المشاركة في الدورات والورش", suggestedEvidence: ["شهادات حضور"] },
      ], suggestedEvidence: ["شهادات الدورات"] },
    ],
  },
  {
    id: "kg-std-3", number: 3, title: "التفاعل مع أولياء الأمور", weight: 5, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      { id: "kg-3-1", text: "التواصل مع أولياء الأمور", subItems: [
        { id: "kg-3-1-1", title: "تفعيل قنوات التواصل", suggestedEvidence: ["سجل التواصل"] },
      ], suggestedEvidence: ["سجل التواصل"] },
    ],
  },
  {
    id: "kg-std-4", number: 4, title: "التنويع في استراتيجيات التدريس", weight: 5, color: "#7C3AED", icon: "📚",
    items: [
      { id: "kg-4-1", text: "استخدام أساليب تدريس مناسبة لرياض الأطفال", subItems: [
        { id: "kg-4-1-1", title: "استخدام استراتيجيات تعلم من خلال اللعب", suggestedEvidence: ["صور الأنشطة"] },
      ], suggestedEvidence: ["نماذج الأنشطة التعليمية"] },
    ],
  },
  {
    id: "kg-std-5", number: 5, title: "تحسين نتائج المتعلمين", weight: 5, color: "#CA8A04", icon: "📈",
    items: [
      { id: "kg-5-1", text: "تحسين مخرجات التعلم للأطفال", subItems: [
        { id: "kg-5-1-1", title: "متابعة تقدم الأطفال", suggestedEvidence: ["سجل الملاحظات"] },
      ], suggestedEvidence: ["تقارير تقدم الأطفال"] },
    ],
  },
  {
    id: "kg-std-6", number: 6, title: "إعداد خطة شاملة وتفصيلية للأنشطة", weight: 5, color: "#EC4899", icon: "📋",
    items: [
      {
        id: "kg-6-1", text: "إعداد خطة شاملة وتفصيلية للأنشطة",
        subItems: [
          { id: "kg-6-1-1", title: "إعداد الخطة الأسبوعية والشهرية للأنشطة", suggestedEvidence: ["الخطة الأسبوعية", "الخطة الشهرية"] },
          { id: "kg-6-1-2", title: "تضمين أنشطة متنوعة تناسب المراحل النمائية", suggestedEvidence: ["مصفوفة الأنشطة", "صور التنفيذ"] },
        ],
        suggestedEvidence: ["خطة الأنشطة الشاملة", "الجدول الزمني"],
      },
    ],
  },
  {
    id: "kg-std-7", number: 7, title: "تصميم خبرات تعلم مرنة ومبتكرة", weight: 5, color: "#F97316", icon: "🎨",
    items: [
      {
        id: "kg-7-1", text: "تصميم خبرات تعلم مرنة ومبتكرة",
        subItems: [
          { id: "kg-7-1-1", title: "تصميم أنشطة إبداعية تناسب الأطفال", suggestedEvidence: ["نماذج الأنشطة", "صور التنفيذ"] },
          { id: "kg-7-1-2", title: "دمج التعلم باللعب في الخبرات التعليمية", suggestedEvidence: ["خطط الأنشطة", "صور اللعب التعليمي"] },
        ],
        suggestedEvidence: ["نماذج خبرات التعلم المبتكرة", "صور التنفيذ"],
      },
    ],
  },
  {
    id: "kg-std-8", number: 8, title: "توظيف تقنيات ووسائل التعلم", weight: 5, color: "#059669", icon: "💻",
    items: [
      { id: "kg-8-1", text: "توظيف تقنيات ووسائل التعلم المناسبة للأطفال", subItems: [
        { id: "kg-8-1-1", title: "استخدام وسائل تعليمية مناسبة لعمر الأطفال", suggestedEvidence: ["صور الوسائل"] },
      ], suggestedEvidence: ["صور استخدام الوسائل التعليمية"] },
    ],
  },
  {
    id: "kg-std-9", number: 9, title: "التمكن من المادة العلمية", weight: 5, color: "#7C3AED", icon: "📖",
    items: [
      { id: "kg-9-1", text: "التمكن من المادة العلمية", subItems: [
        { id: "kg-9-1-1", title: "الإلمام بمحتوى المنهج ومتطلباته", suggestedEvidence: ["شهادات التدريب"] },
      ], suggestedEvidence: ["شهادات التدريب والتأهيل"] },
    ],
  },
  {
    id: "kg-std-10", number: 10, title: "استخدام استراتيجيات تدريس فاعلة", weight: 5, color: "#DC2626", icon: "🎯",
    items: [
      { id: "kg-10-1", text: "استخدام استراتيجيات تدريس فاعلة ومتنوعة", subItems: [
        { id: "kg-10-1-1", title: "تطبيق استراتيجيات تعلم نشط", suggestedEvidence: ["نماذج التحضير", "صور التنفيذ"] },
      ], suggestedEvidence: ["نماذج التحضير"] },
    ],
  },
  {
    id: "kg-std-11", number: 11, title: "إشراك الأسرة في خطط النمو والتعلم", weight: 5, color: "#0891B2", icon: "👨‍👩‍👧",
    items: [
      {
        id: "kg-11-1", text: "إشراك الأسرة في خطط النمو والتعلم",
        subItems: [
          { id: "kg-11-1-1", title: "التواصل المستمر مع الأسرة حول تقدم الطفل", suggestedEvidence: ["سجل التواصل", "تقارير التقدم"] },
          { id: "kg-11-1-2", title: "إشراك الأسرة في الأنشطة التعليمية", suggestedEvidence: ["دعوات المشاركة", "صور الفعاليات"] },
        ],
        suggestedEvidence: ["سجل التواصل مع الأسر", "تقارير التقدم"],
      },
    ],
  },
  {
    id: "kg-std-12", number: 12, title: "تهيئة بيئة تعليمية آمنة ومعززة للتطور النمائي", weight: 5, color: "#EC4899", icon: "🏠",
    items: [
      {
        id: "kg-12-1", text: "تهيئ بيئة تعليمية آمنة ومعززة للتطور النمائي",
        subItems: [
          { id: "kg-12-1-1", title: "توفير بيئة آمنة ومحفزة للأطفال", suggestedEvidence: ["صور البيئة الصفية", "تقارير السلامة"] },
          { id: "kg-12-1-2", title: "تنظيم الأركان التعليمية المتنوعة", suggestedEvidence: ["صور الأركان", "خطة الأركان"] },
        ],
        suggestedEvidence: ["صور البيئة الصفية", "خطة الأركان التعليمية"],
      },
    ],
  },
  {
    id: "kg-std-13", number: 13, title: "توفير فرص لدعم التفاعلات", weight: 5, color: "#F97316", icon: "🤝",
    items: [
      { id: "kg-13-1", text: "توفير فرص متنوعة لدعم التفاعلات في بيئة التعلم", subItems: [
        { id: "kg-13-1-1", title: "تصميم أنشطة تعاونية بين الأطفال", suggestedEvidence: ["صور الأنشطة التعاونية"] },
      ], suggestedEvidence: ["صور الأنشطة التعاونية"] },
    ],
  },
  {
    id: "kg-std-14", number: 14, title: "تقويم تعلم المتعلمين ومتابعة تقدمهم", weight: 5, color: "#059669", icon: "📊",
    items: [
      { id: "kg-14-1", text: "تقوّم تعلم المتعلمين وتتابع تقدمهم بانتظام", subItems: [
        { id: "kg-14-1-1", title: "استخدام أدوات تقويم مناسبة لعمر الأطفال", suggestedEvidence: ["نماذج التقويم", "سجل الملاحظات"] },
      ], suggestedEvidence: ["سجل تقويم الأطفال"] },
    ],
  },
  {
    id: "kg-std-15", number: 15, title: "استثمار نتائج التقويم في تعزيز النمو", weight: 5, color: "#7C3AED", icon: "📈",
    items: [
      { id: "kg-15-1", text: "تستثمر نتائج التقويم في تعزيز النمو والتعلم", subItems: [
        { id: "kg-15-1-1", title: "تحليل نتائج التقويم وتطوير الخطط", suggestedEvidence: ["تقارير التحليل"] },
      ], suggestedEvidence: ["تقارير تحليل نتائج التقويم"] },
    ],
  },
  {
    id: "kg-std-16", number: 16, title: "إشراك الأسرة في نتائج التقويم", weight: 5, color: "#DC2626", icon: "📬",
    items: [
      { id: "kg-16-1", text: "تشرك الأسرة في نتائج التقويم", subItems: [
        { id: "kg-16-1-1", title: "مشاركة نتائج التقويم مع الأسرة", suggestedEvidence: ["تقارير التقدم المرسلة"] },
      ], suggestedEvidence: ["تقارير التقدم المرسلة للأسر"] },
    ],
  },
  {
    id: "kg-std-17", number: 17, title: "دعم مستويات الأداء المستهدفة", weight: 5, color: "#0891B2", icon: "🎯",
    items: [
      { id: "kg-17-1", text: "تدعم مستويات الأداء المستهدفة لكل متعلم", subItems: [
        { id: "kg-17-1-1", title: "وضع أهداف فردية لكل طفل", suggestedEvidence: ["خطط فردية"] },
      ], suggestedEvidence: ["خطط الأداء الفردية"] },
    ],
  },
  {
    id: "kg-std-18", number: 18, title: "دعم مهارات المستقبل", weight: 5, color: "#CA8A04", icon: "🚀",
    items: [
      { id: "kg-18-1", text: "تدعم مهارات المستقبل لدى المتعلمين", subItems: [
        { id: "kg-18-1-1", title: "تنمية مهارات التفكير والإبداع", suggestedEvidence: ["أنشطة التفكير الإبداعي"] },
      ], suggestedEvidence: ["أنشطة مهارات المستقبل"] },
    ],
  },
  {
    id: "kg-std-19", number: 19, title: "دعم اكتساب القيم والمبادئ", weight: 5, color: "#EC4899", icon: "⭐",
    items: [
      { id: "kg-19-1", text: "تدعم اكتساب المتعلمين القيم والمبادئ والاتجاهات", subItems: [
        { id: "kg-19-1-1", title: "تنفيذ أنشطة تعزز القيم الإيجابية", suggestedEvidence: ["صور الأنشطة", "خطة القيم"] },
      ], suggestedEvidence: ["خطة تعزيز القيم", "صور الأنشطة"] },
    ],
  },
];

// ===== 8. المشرف التربوي (8 جدارات سلوكية قيادية) =====
export const SUPERVISOR_STANDARDS: Standard[] = [
  {
    id: "sv-std-1", number: 1, title: "المسؤولية", weight: 15, color: "#CA8A04", icon: "🎯",
    items: [
      {
        id: "sv-1-1", text: "القدرة على تحمل المسؤولية الفردية لتحقيق الأهداف بالجودة المطلوبة وفي الوقت المحدد",
        subItems: [
          { id: "sv-1-1-1", title: "الالتزام بتحقيق الأهداف في الوقت المحدد", suggestedEvidence: ["تقارير الإنجاز", "خطط العمل"] },
          { id: "sv-1-1-2", title: "تحمل المسؤولية عن جودة المخرجات", suggestedEvidence: ["تقارير الجودة", "نتائج التقييم"] },
        ],
        suggestedEvidence: ["تقارير الإنجاز", "خطط العمل المنفذة"],
      },
    ],
  },
  {
    id: "sv-std-2", number: 2, title: "العمل الجماعي", weight: 10, color: "#059669", icon: "🤝",
    items: [
      {
        id: "sv-2-1", text: "القدرة على العمل بشكل جماعي وبروح الفريق الواحد",
        subItems: [
          { id: "sv-2-1-1", title: "المشاركة الفعالة في فرق العمل", suggestedEvidence: ["محاضر الاجتماعات", "تقارير الفرق"] },
          { id: "sv-2-1-2", title: "المحافظة على علاقات مهنية جيدة", suggestedEvidence: ["شهادات التقدير", "تقارير الأداء"] },
        ],
        suggestedEvidence: ["محاضر اجتماعات الفرق", "تقارير العمل الجماعي"],
      },
    ],
  },
  {
    id: "sv-std-3", number: 3, title: "المرونة للتغيير", weight: 10, color: "#7C3AED", icon: "🔄",
    items: [
      {
        id: "sv-3-1", text: "القدرة على التكيف والعمل بشكل فعال في مختلف الظروف",
        subItems: [
          { id: "sv-3-1-1", title: "التكيف مع المتغيرات والتحديات", suggestedEvidence: ["تقارير إدارة التغيير"] },
          { id: "sv-3-1-2", title: "فهم وجهات النظر المختلفة وقبول التغيير", suggestedEvidence: ["محاضر الحوار", "تقارير المبادرات"] },
        ],
        suggestedEvidence: ["تقارير إدارة التغيير", "مبادرات التطوير"],
      },
    ],
  },
  {
    id: "sv-std-4", number: 4, title: "المبادرة", weight: 10, color: "#F97316", icon: "💡",
    items: [
      {
        id: "sv-4-1", text: "القدرة على إظهار الحرص الكافي لتحقيق أهداف العمل والرغبة في إنجاز مهام إضافية",
        subItems: [
          { id: "sv-4-1-1", title: "تقديم أفكار ومقترحات جديدة", suggestedEvidence: ["وثائق المبادرات", "تقارير الأفكار"] },
          { id: "sv-4-1-2", title: "إنجاز مهام إضافية تخدم مصلحة العمل", suggestedEvidence: ["تقارير الإنجاز الإضافي"] },
        ],
        suggestedEvidence: ["وثائق المبادرات", "تقارير الإنجاز"],
      },
    ],
  },
  {
    id: "sv-std-5", number: 5, title: "قيادة التغيير", weight: 20, color: "#DC2626", icon: "🚀",
    items: [
      {
        id: "sv-5-1", text: "القدرة على حث الموظفين لتقبل التغيير المترتب على تطوير ومواجهة التحديات",
        subItems: [
          { id: "sv-5-1-1", title: "قيادة مبادرات التغيير والتطوير", suggestedEvidence: ["خطط التغيير", "تقارير التنفيذ"] },
          { id: "sv-5-1-2", title: "تحفيز المعلمين على تبني الممارسات الجديدة", suggestedEvidence: ["تقارير التدريب", "شهادات المشاركة"] },
        ],
        suggestedEvidence: ["خطط قيادة التغيير", "تقارير التنفيذ"],
      },
    ],
  },
  {
    id: "sv-std-6", number: 6, title: "تطوير وتمكين الموظفين", weight: 10, color: "#059669", icon: "📈",
    items: [
      {
        id: "sv-6-1", text: "تأهيل الموظفين وإعدادهم ومنحهم فرص التطوير والنمو",
        subItems: [
          { id: "sv-6-1-1", title: "تنفيذ برامج تدريبية للمعلمين", suggestedEvidence: ["خطة التدريب", "تقارير التنفيذ"] },
          { id: "sv-6-1-2", title: "تفويض الصلاحيات وإشراك المعلمين في صنع القرار", suggestedEvidence: ["محاضر الاجتماعات", "قرارات التفويض"] },
        ],
        suggestedEvidence: ["خطة تطوير المعلمين", "تقارير التدريب"],
      },
    ],
  },
  {
    id: "sv-std-7", number: 7, title: "التوجه الاستراتيجي", weight: 10, color: "#0891B2", icon: "🧭",
    items: [
      {
        id: "sv-7-1", text: "القدرة على تحليل المعطيات من منظور استراتيجي شامل",
        subItems: [
          { id: "sv-7-1-1", title: "وضع خطط بعيدة المدى مرتبطة بالأهداف الاستراتيجية", suggestedEvidence: ["الخطة الاستراتيجية", "مصفوفة الأهداف"] },
          { id: "sv-7-1-2", title: "ربط الأنشطة اليومية بالرسالة والأهداف", suggestedEvidence: ["تقارير الربط", "محاضر التخطيط"] },
        ],
        suggestedEvidence: ["الخطة الاستراتيجية", "تقارير التحليل"],
      },
    ],
  },
  {
    id: "sv-std-8", number: 8, title: "اتخاذ القرارات", weight: 15, color: "#7C3AED", icon: "⚖️",
    items: [
      {
        id: "sv-8-1", text: "القدرة على جمع البيانات والمعلومات وتحليلها والوصول إلى حلول فاعلة",
        subItems: [
          { id: "sv-8-1-1", title: "جمع وتحليل البيانات لاتخاذ قرارات مستنيرة", suggestedEvidence: ["تقارير التحليل", "بيانات الأداء"] },
          { id: "sv-8-1-2", title: "اتخاذ قرارات فاعلة في الوقت المناسب", suggestedEvidence: ["محاضر القرارات", "تقارير المتابعة"] },
        ],
        suggestedEvidence: ["تقارير التحليل", "محاضر القرارات"],
      },
    ],
  },
];

// ===== دالة مساعدة لجلب معايير أي وظيفة =====
export function getStandardsForJob(jobId: string): Standard[] {
  switch (jobId) {
    case "principal": return PRINCIPAL_STANDARDS;
    case "vice_principal": return VICE_PRINCIPAL_STANDARDS;
    case "counselor": return COUNSELOR_STANDARDS;
    case "health_counselor": return HEALTH_COUNSELOR_STANDARDS;
    case "activity_leader": return ACTIVITY_LEADER_STANDARDS;
    case "lab_technician": return LAB_TECHNICIAN_STANDARDS;
    case "kindergarten": return KINDERGARTEN_STANDARDS;
    case "supervisor": return SUPERVISOR_STANDARDS;
    default: return [];
  }
}
