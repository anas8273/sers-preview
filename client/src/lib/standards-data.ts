/**
 * معايير الأداء الوظيفي للمعلم/المعلمة 1447هـ - وزارة التعليم السعودية
 * 11 بند أداء وظيفي مع فقرات فرعية رسمية + شواهد مقترحة
 * المصادر: ملف شواهد الأداء المعتمد + ملف شواهد الأداء الجديد والشامل + شواهد رياض الأطفال
 */

export interface SuggestedEvidenceItem {
  text: string;
  priority: "essential" | "supporting" | "additional";
}

export interface Indicator {
  id: string;
  text: string;
  suggestedEvidence: string[];
}

export interface Standard {
  id: string;
  number: number;
  title: string;
  weight: number;
  color: string;
  icon: string;
  indicators: Indicator[];
}

export interface Evidence {
  id: string;
  standardId: string;
  indicatorId: string;
  type: "image" | "link" | "video" | "file" | "text";
  content: string;
  displayAs: "image" | "qr";
  title: string;
  createdAt: number;
}

export interface UserProfile {
  name: string;
  school: string;
  subject: string;
  grade: string;
  year: string;
  role: string;
}

export const STANDARDS: Standard[] = [
  {
    id: "std-1",
    number: 1,
    title: "أداء الواجبات الوظيفية",
    weight: 10,
    color: "#059669",
    icon: "📋",
    indicators: [
      {
        id: "std-1-ind-1",
        text: "التقيد بالدوام الرسمي والحفاظ عليه",
        suggestedEvidence: [
          "صورة من سجل الحضور والانصراف",
          "تقرير الالتزام بالدوام الرسمي من النظام",
          "خطاب شكر على الانضباط",
        ],
      },
      {
        id: "std-1-ind-2",
        text: "تأدية الحصص الدراسية وفق الجدول الدراسي",
        suggestedEvidence: [
          "صورة من الجدول الدراسي",
          "سجل تنفيذ الحصص",
          "تقرير متابعة تنفيذ الجدول",
        ],
      },
      {
        id: "std-1-ind-3",
        text: "المشاركة في الإشراف والمناوبة وحصص الانتظار",
        suggestedEvidence: [
          "صورة من سجل المناوبة والإشراف اليومي",
          "صورة من سجل الانتظار",
          "جدول المناوبة المعتمد",
        ],
      },
      {
        id: "std-1-ind-4",
        text: "إعداد ومتابعة الدروس والواجبات والاختبارات",
        suggestedEvidence: [
          "نماذج من تحضير الدروس",
          "نماذج من الواجبات المنزلية",
          "نماذج من الاختبارات",
          "خطة توزيع المنهج",
        ],
      },
      {
        id: "std-1-ind-5",
        text: "المشاركة في اللجان المدرسية وتفعيلها",
        suggestedEvidence: [
          "قرار تشكيل اللجنة",
          "محاضر اجتماعات اللجان",
          "تقرير إنجازات اللجنة",
        ],
      },
      {
        id: "std-1-ind-6",
        text: "المشاركة في الأنشطة والمناسبات الوطنية",
        suggestedEvidence: [
          "صور من فعاليات اليوم الوطني",
          "صور أنشطة يوم التأسيس",
          "تقرير عن المشاركة في مناسبات وطنية",
        ],
      },
      {
        id: "std-1-ind-7",
        text: "تفعيل الإذاعة الصباحية والالتزام بالطابور الصباحي",
        suggestedEvidence: [
          "جدول الإذاعة المدرسية",
          "صور من تنفيذ الإذاعة",
          "تقرير تفعيل الإذاعة الصباحية",
        ],
      },
      {
        id: "std-1-ind-8",
        text: "الالتزام بالسلوك المهني وأخلاقيات المهنة",
        suggestedEvidence: [
          "صورة من ميثاق أخلاقيات المهنة الموقع",
          "شهادة حسن السيرة والسلوك",
          "خطاب شكر من المدير",
        ],
      },
      {
        id: "std-1-ind-9",
        text: "تفعيل منصة مدرستي والأنظمة الإلكترونية",
        suggestedEvidence: [
          "صور من منصة مدرستي",
          "تقرير استخدام المنصة",
          "صور واجبات إلكترونية على المنصة",
        ],
      },
      {
        id: "std-1-ind-10",
        text: "الاطلاع والالتزام بالتعاميم واللوائح المنظمة",
        suggestedEvidence: [
          "صور التوقيع بالعلم على التعاميم",
          "سجل الاطلاع على اللوائح",
          "صور من التعاميم الموقعة",
        ],
      },
    ],
  },
  {
    id: "std-2",
    number: 2,
    title: "التفاعل مع المجتمع المهني",
    weight: 10,
    color: "#7C3AED",
    icon: "🤝",
    indicators: [
      {
        id: "std-2-ind-1",
        text: "المشاركة الفاعلة في مجتمعات التعلم المهنية",
        suggestedEvidence: [
          "صورة من سجل مجتمعات التعلم المهنية",
          "محاضر اجتماعات مجتمعات التعلم",
          "تقرير المشاركة في مجتمع التعلم",
        ],
      },
      {
        id: "std-2-ind-2",
        text: "تبادل الزيارات الصفية مع الزملاء",
        suggestedEvidence: [
          "سجل تبادل الزيارات",
          "نموذج ملاحظة الزيارة الصفية",
          "تقرير عن الزيارات التبادلية",
        ],
      },
      {
        id: "std-2-ind-3",
        text: "تنفيذ الدروس التطبيقية وبحث الدرس",
        suggestedEvidence: [
          "تقرير تنفيذ درس تطبيقي",
          "صور من الدرس التطبيقي",
          "نموذج بحث الدرس",
        ],
      },
      {
        id: "std-2-ind-4",
        text: "حضور الدورات والورش التدريبية",
        suggestedEvidence: [
          "شهادات حضور الدورات والورش التدريبية",
          "صور من الورش التدريبية",
          "تقرير عن البرنامج التدريبي",
        ],
      },
      {
        id: "std-2-ind-5",
        text: "الإنتاج المعرفي (أوراق عمل، عروض تقديمية، ملازم)",
        suggestedEvidence: [
          "نماذج أوراق عمل",
          "عروض تقديمية تم إعدادها",
          "ملازم وتقارير تعليمية",
        ],
      },
      {
        id: "std-2-ind-6",
        text: "الحصول على شهادات مهنية معتمدة",
        suggestedEvidence: [
          "شهادة الرخصة المهنية",
          "شهادات تطوير مهني",
          "شهادات دورات معتمدة",
        ],
      },
      {
        id: "std-2-ind-7",
        text: "إطلاق مبادرات تعليمية لتحسين جودة التعليم",
        suggestedEvidence: [
          "وثيقة المبادرة التعليمية",
          "صور من تنفيذ المبادرة",
          "تقرير نتائج المبادرة",
        ],
      },
    ],
  },
  {
    id: "std-3",
    number: 3,
    title: "التفاعل مع أولياء الأمور",
    weight: 5,
    color: "#0284C7",
    icon: "👨‍👩‍👧",
    indicators: [
      {
        id: "std-3-ind-1",
        text: "التواصل الفعال مع أولياء الأمور بالتنسيق مع الموجه الطلابي",
        suggestedEvidence: [
          "صور من التواصل مع أولياء الأمور",
          "تقرير اجتماع ولي الأمر مع المعلم",
          "سجل التواصل مع أولياء الأمور",
        ],
      },
      {
        id: "std-3-ind-2",
        text: "تزويد أولياء الأمور بمستويات الطلبة بشكل دوري",
        suggestedEvidence: [
          "نماذج تقارير الطلاب المرسلة لأولياء الأمور",
          "صور من رسائل التواصل",
          "سجل المتابعة الأكاديمية",
        ],
      },
      {
        id: "std-3-ind-3",
        text: "المشاركة الفاعلة في الجمعية العمومية للمعلمين وأولياء الأمور",
        suggestedEvidence: [
          "صور من الجمعية العمومية لأولياء الأمور والمعلمين",
          "محاضر اجتماعات الجمعية",
          "تقرير المشاركة في الجمعية",
        ],
      },
      {
        id: "std-3-ind-4",
        text: "تفعيل الخطة الأسبوعية للمدرسة وإشراك أولياء الأمور",
        suggestedEvidence: [
          "نسخة من الخطة الأسبوعية للمدرسة",
          "صور من تفعيل الخطة",
          "تقرير مشاركة أولياء الأمور",
        ],
      },
      {
        id: "std-3-ind-5",
        text: "إيصال الملاحظات الهامة لأولياء الأمور في الوقت المناسب",
        suggestedEvidence: [
          "صور من الرسائل المرسلة لأولياء الأمور",
          "سجل الملاحظات المرسلة",
          "تقرير متابعة التواصل",
        ],
      },
    ],
  },
  {
    id: "std-4",
    number: 4,
    title: "التنويع في استراتيجيات التدريس",
    weight: 15,
    color: "#D97706",
    icon: "🎯",
    indicators: [
      {
        id: "std-4-ind-1",
        text: "استخدام استراتيجيات متنوعة تناسب مستويات الطلبة",
        suggestedEvidence: [
          "تقرير عن تطبيق استراتيجية تدريس",
          "صور من أنشطة التعلم النشط",
          "تحضير درس يتضمن استراتيجيات متنوعة",
        ],
      },
      {
        id: "std-4-ind-2",
        text: "مراعاة الفروق الفردية بين الطلاب",
        suggestedEvidence: [
          "أوراق عمل متنوعة المستويات",
          "تحضير درس يراعي الفروق الفردية",
          "تقرير تصنيف الطلبة وفق أنماط التعلم",
        ],
      },
      {
        id: "std-4-ind-3",
        text: "تطبيق التعلم القائم على المشاريع والاستقصاء",
        suggestedEvidence: [
          "صور مشاريع الطلاب",
          "خطة مشروع تعليمي",
          "تقرير نتائج التعلم القائم على المشاريع",
        ],
      },
      {
        id: "std-4-ind-4",
        text: "استخدام الوسائل البصرية والسمعية في التدريس",
        suggestedEvidence: [
          "صور الوسائل التعليمية المستخدمة",
          "فيديوهات تعليمية",
          "صور عروض تقديمية",
        ],
      },
    ],
  },
  {
    id: "std-5",
    number: 5,
    title: "تحسين نتائج المتعلمين",
    weight: 10,
    color: "#DC2626",
    icon: "📈",
    indicators: [
      {
        id: "std-5-ind-1",
        text: "معالجة الفاقد التعليمي لدى الطلاب",
        suggestedEvidence: [
          "سجل معالجة الفاقد التعليمي",
          "خطة علاجية للطلاب المتأخرين",
          "تقرير نتائج البرنامج العلاجي",
        ],
      },
      {
        id: "std-5-ind-2",
        text: "وضع الخطط العلاجية للطلاب الضعاف",
        suggestedEvidence: [
          "الخطة العلاجية المعتمدة",
          "نتائج الاختبار القبلي والبعدي",
          "كشف متابعة الطلبة",
        ],
      },
      {
        id: "std-5-ind-3",
        text: "وضع الخطط الإثرائية للطلاب المتميزين",
        suggestedEvidence: [
          "الخطة الإثرائية",
          "أنشطة إثرائية للطلاب المتميزين",
          "تقرير عن البرنامج الإثرائي",
        ],
      },
      {
        id: "std-5-ind-4",
        text: "تكريم الطلبة المتميزين والذين تحسن مستواهم",
        suggestedEvidence: [
          "شهادات تقدير للطلاب المتميزين",
          "صور من حفل التكريم",
          "سجل الطلاب المتميزين",
        ],
      },
    ],
  },
  {
    id: "std-6",
    number: 6,
    title: "إعداد وتنفيذ خطة التعلم",
    weight: 15,
    color: "#2563EB",
    icon: "📝",
    indicators: [
      {
        id: "std-6-ind-1",
        text: "توزيع المنهج وفق الخطة الزمنية المعتمدة",
        suggestedEvidence: [
          "خطة توزيع المنهج المعتمدة",
          "جدول التوزيع الأسبوعي",
          "تقرير متابعة تنفيذ المنهج",
        ],
      },
      {
        id: "std-6-ind-2",
        text: "إعداد الدروس بشكل يومي وفق الأهداف التعليمية",
        suggestedEvidence: [
          "نماذج من تحضير الدروس اليومية",
          "دفتر التحضير",
          "صور من إعداد الدروس الإلكترونية",
        ],
      },
      {
        id: "std-6-ind-3",
        text: "إعداد الواجبات والاختبارات وفق المعايير",
        suggestedEvidence: [
          "نماذج من الواجبات المنزلية",
          "نماذج من الاختبارات",
          "جدول مواصفات الاختبار",
        ],
      },
      {
        id: "std-6-ind-4",
        text: "تنفيذ الدروس وفق الخطة مع التعديل حسب الحاجة",
        suggestedEvidence: [
          "سجل تنفيذ الدروس",
          "تقرير الزيارة الصفية",
          "نسخ معدلة من الخطط",
        ],
      },
    ],
  },
  {
    id: "std-7",
    number: 7,
    title: "توظيف تقنيات ووسائل التعلم المناسبة",
    weight: 10,
    color: "#9333EA",
    icon: "💻",
    indicators: [
      {
        id: "std-7-ind-1",
        text: "دمج التقنية في التعليم واستخدام الأدوات الرقمية",
        suggestedEvidence: [
          "صور استخدام السبورة الذكية",
          "صور من التطبيقات التعليمية",
          "تقرير عن توظيف التقنية في الدروس",
        ],
      },
      {
        id: "std-7-ind-2",
        text: "التنويع في الوسائل التعليمية المستخدمة",
        suggestedEvidence: [
          "صور من الوسائل التعليمية المستخدمة",
          "قائمة الوسائل التعليمية",
          "تقرير عن الوسائل المبتكرة",
        ],
      },
      {
        id: "std-7-ind-3",
        text: "تفعيل المنصات الإلكترونية في التعليم",
        suggestedEvidence: [
          "صور من منصة مدرستي",
          "تقرير استخدام المنصات الإلكترونية",
          "صور واجبات إلكترونية",
        ],
      },
      {
        id: "std-7-ind-4",
        text: "تشجيع الطلاب على استخدام التطبيقات التعليمية",
        suggestedEvidence: [
          "قائمة التطبيقات التعليمية المستخدمة",
          "صور من استخدام الطلاب للتطبيقات",
          "تقرير عن أثر التطبيقات على التعلم",
        ],
      },
    ],
  },
  {
    id: "std-8",
    number: 8,
    title: "تهيئة البيئة التعليمية",
    weight: 5,
    color: "#059669",
    icon: "🏫",
    indicators: [
      {
        id: "std-8-ind-1",
        text: "مراعاة حاجات الطلبة وتوفير بيئة آمنة",
        suggestedEvidence: [
          "صور من البيئة الصفية الآمنة",
          "تقرير عن إجراءات السلامة",
          "صور من تجهيزات الفصل",
        ],
      },
      {
        id: "std-8-ind-2",
        text: "التهيئة النفسية للطلاب وبناء علاقات إيجابية",
        suggestedEvidence: [
          "صور من أنشطة التهيئة النفسية",
          "تقرير عن البرامج الإرشادية",
          "صور من الأنشطة الترفيهية",
        ],
      },
      {
        id: "std-8-ind-3",
        text: "التحفيز المادي والمعنوي للطلاب",
        suggestedEvidence: [
          "نماذج من التحفيز المادي والمعنوي",
          "صور لوحة التحفيز",
          "شهادات تقدير للطلاب",
        ],
      },
      {
        id: "std-8-ind-4",
        text: "تزيين الفصل بوسائل تعليمية جذابة وتنظيمه",
        suggestedEvidence: [
          "صور الفصل المزين",
          "صور الوسائل التعليمية المعلقة",
          "صور أركان التعلم المختلفة",
        ],
      },
    ],
  },
  {
    id: "std-9",
    number: 9,
    title: "الإدارة الصفية",
    weight: 5,
    color: "#EA580C",
    icon: "🎓",
    indicators: [
      {
        id: "std-9-ind-1",
        text: "ضبط سلوك الطلبة ووضع قواعد واضحة للصف",
        suggestedEvidence: [
          "صورة لوحة قواعد الصف",
          "ميثاق الصف الدراسي",
          "صور القوانين الصفية المعلقة",
        ],
      },
      {
        id: "std-9-ind-2",
        text: "شد انتباه الطلبة واستخدام أساليب تحفيزية",
        suggestedEvidence: [
          "صور من أساليب جذب الانتباه",
          "نظام النقاط والمكافآت",
          "صور من الأنشطة التحفيزية",
        ],
      },
      {
        id: "std-9-ind-3",
        text: "متابعة الحضور والغياب والتأخر",
        suggestedEvidence: [
          "كشف المتابعة اليومية",
          "سجل الحضور والغياب",
          "تقرير متابعة الانضباط",
        ],
      },
      {
        id: "std-9-ind-4",
        text: "تنظيم الوقت بشكل فعال خلال الحصة",
        suggestedEvidence: [
          "خطة توزيع وقت الحصة",
          "تحضير درس يوضح توزيع الوقت",
          "تقرير زيارة صفية",
        ],
      },
    ],
  },
  {
    id: "std-10",
    number: 10,
    title: "تحليل نتائج المتعلمين وتشخيص مستوياتهم",
    weight: 10,
    color: "#0891B2",
    icon: "📊",
    indicators: [
      {
        id: "std-10-ind-1",
        text: "تحليل نتائج الاختبارات الفترية والنهائية",
        suggestedEvidence: [
          "تقرير تحليل نتائج الطلبة",
          "رسوم بيانية لمستويات الطلاب",
          "جدول تحليل الأسئلة",
        ],
      },
      {
        id: "std-10-ind-2",
        text: "تصنيف الطلبة وفق نتائجهم وتحديد نقاط القوة والضعف",
        suggestedEvidence: [
          "كشف تصنيف الطلبة",
          "تقرير نقاط القوة والضعف",
          "سجل درجات الطلاب",
        ],
      },
      {
        id: "std-10-ind-3",
        text: "معالجة الفاقد التعليمي بناءً على نتائج التحليل",
        suggestedEvidence: [
          "سجل معالجة الفاقد التعليمي",
          "خطة علاجية مبنية على التحليل",
          "تقرير متابعة المعالجة",
        ],
      },
      {
        id: "std-10-ind-4",
        text: "توفير تغذية راجعة فردية للطلاب",
        suggestedEvidence: [
          "نماذج تغذية راجعة مكتوبة",
          "سجل المقابلات الفردية مع الطلاب",
          "تقرير متابعة فردية",
        ],
      },
    ],
  },
  {
    id: "std-11",
    number: 11,
    title: "تنوع أساليب التقويم",
    weight: 5,
    color: "#BE185D",
    icon: "✅",
    indicators: [
      {
        id: "std-11-ind-1",
        text: "تطبيق الاختبارات الورقية والإلكترونية",
        suggestedEvidence: [
          "نماذج اختبارات ورقية",
          "صور من اختبارات إلكترونية",
          "جدول توزيع الدرجات",
        ],
      },
      {
        id: "std-11-ind-2",
        text: "تقييم مشاريع الطلبة والمهام الأدائية",
        suggestedEvidence: [
          "صور مشاريع الطلاب",
          "معايير تقييم المشاريع (روبرك)",
          "نماذج من المهام الأدائية",
        ],
      },
      {
        id: "std-11-ind-3",
        text: "استخدام ملفات إنجاز الطلبة كأداة تقويم",
        suggestedEvidence: [
          "نماذج من ملفات إنجاز الطلبة",
          "صور من أعمال الطلاب المميزة",
          "تقرير تقييم ملفات الإنجاز",
        ],
      },
      {
        id: "std-11-ind-4",
        text: "استخدام التقييم التكويني لتتبع تقدم الطلاب",
        suggestedEvidence: [
          "نماذج تقييم تكويني",
          "سجل الملاحظات اليومية",
          "أدوات التقييم المستمر (بطاقات خروج، استبيانات)",
        ],
      },
    ],
  },
];

// حساب إجمالي المؤشرات
export const TOTAL_INDICATORS = STANDARDS.reduce(
  (sum, std) => sum + std.indicators.length,
  0
);

// دالة حساب نسبة الإنجاز لمعيار معين
export function getStandardProgress(
  standardId: string,
  evidences: Evidence[]
): { covered: number; total: number; percentage: number } {
  const standard = STANDARDS.find((s) => s.id === standardId);
  if (!standard) return { covered: 0, total: 0, percentage: 0 };

  const total = standard.indicators.length;
  const coveredIndicators = new Set(
    evidences
      .filter((e) => e.standardId === standardId)
      .map((e) => e.indicatorId)
  );
  const covered = coveredIndicators.size;

  return {
    covered,
    total,
    percentage: total > 0 ? Math.round((covered / total) * 100) : 0,
  };
}

// دالة حساب نسبة الإنجاز الكلية
export function getOverallProgress(evidences: Evidence[]): {
  coveredIndicators: number;
  totalIndicators: number;
  percentage: number;
  coveredStandards: number;
  partialStandards: number;
  missingStandards: number;
} {
  let coveredIndicators = 0;
  let coveredStandards = 0;
  let partialStandards = 0;
  let missingStandards = 0;

  for (const std of STANDARDS) {
    const progress = getStandardProgress(std.id, evidences);
    coveredIndicators += progress.covered;

    if (progress.percentage === 100) {
      coveredStandards++;
    } else if (progress.percentage > 0) {
      partialStandards++;
    } else {
      missingStandards++;
    }
  }

  return {
    coveredIndicators,
    totalIndicators: TOTAL_INDICATORS,
    percentage: Math.round((coveredIndicators / TOTAL_INDICATORS) * 100),
    coveredStandards,
    partialStandards,
    missingStandards,
  };
}

// دالة الحصول على حالة المعيار
export function getStandardStatus(
  standardId: string,
  evidences: Evidence[]
): "complete" | "partial" | "missing" {
  const progress = getStandardProgress(standardId, evidences);
  if (progress.percentage === 100) return "complete";
  if (progress.percentage > 0) return "partial";
  return "missing";
}
