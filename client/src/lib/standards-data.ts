/**
 * معايير الأداء الوظيفي للمعلم 1447هـ - وزارة التعليم السعودية
 * 11 معيار مهني + 45 مؤشر فرعي
 */

export interface Indicator {
  id: string;
  text: string;
  suggestedEvidence: string[];
}

export interface Standard {
  id: string;
  number: number;
  title: string;
  weight: number; // النسبة المئوية
  color: string;
  icon: string; // emoji
  indicators: Indicator[];
}

export interface Evidence {
  id: string;
  standardId: string;
  indicatorId: string;
  type: "image" | "link" | "video" | "file" | "text";
  content: string; // URL or text
  displayAs: "image" | "qr"; // للصور فقط
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
        text: "يطبق الأنظمة وقواعد السلوك الوظيفية وأخلاقيات بيئة التعلم",
        suggestedEvidence: [
          "صورة من سجل الحضور والانصراف",
          "شهادة التزام بالأنظمة من المدير",
          "صورة من ميثاق أخلاقيات المهنة الموقع",
          "تقرير الالتزام بالدوام الرسمي",
        ],
      },
      {
        id: "std-1-ind-2",
        text: "يعزز الانتماء والولاء للوطن والقيم الوطنية",
        suggestedEvidence: [
          "صور من فعاليات اليوم الوطني",
          "صور أنشطة تعزيز الهوية الوطنية",
          "تقرير عن مشاركة في مناسبات وطنية",
          "صور لوحات وطنية في الفصل",
        ],
      },
      {
        id: "std-1-ind-3",
        text: "يحافظ على خصوصية المعلومات المهنية وحماية البيانات",
        suggestedEvidence: [
          "إقرار بالمحافظة على سرية المعلومات",
          "شهادة دورة أمن المعلومات",
          "صورة من سياسة حماية البيانات الموقعة",
        ],
      },
      {
        id: "std-1-ind-4",
        text: "الامتثال للقوانين واللوائح وسياسات وإجراءات العمل",
        suggestedEvidence: [
          "صورة من سجل المناوبة",
          "تقرير الالتزام باللوائح",
          "صورة من سجل الانتظار",
          "شهادة حسن السيرة والسلوك",
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
        text: "حضور المؤتمرات والندوات التعليمية",
        suggestedEvidence: [
          "شهادات حضور مؤتمرات",
          "صور من المشاركة في ندوات تعليمية",
          "تقرير عن ندوة تم حضورها",
        ],
      },
      {
        id: "std-2-ind-2",
        text: "المشاركة في ورش العمل التدريبية لتحسين المهارات التعليمية",
        suggestedEvidence: [
          "شهادات ورش عمل",
          "صور من ورش تدريبية",
          "تقرير عن ورشة عمل تم تنفيذها",
        ],
      },
      {
        id: "std-2-ind-3",
        text: "تقديم استشارات تربوية للمعلمين الجدد",
        suggestedEvidence: [
          "محاضر اجتماعات إرشادية",
          "تقرير عن برنامج تهيئة المعلمين الجدد",
          "شهادة شكر من معلم جديد",
        ],
      },
      {
        id: "std-2-ind-4",
        text: "إطلاق مبادرات تعليمية لتحسين جودة التعليم",
        suggestedEvidence: [
          "وثيقة المبادرة التعليمية",
          "صور من تنفيذ المبادرة",
          "تقرير نتائج المبادرة",
        ],
      },
      {
        id: "std-2-ind-5",
        text: "الالتحاق ببرامج تدريبية لتعلم أساليب تدريس حديثة",
        suggestedEvidence: [
          "شهادات دورات تدريبية",
          "صور من منصات التدريب الإلكتروني",
          "تقرير عن البرنامج التدريبي",
        ],
      },
      {
        id: "std-2-ind-6",
        text: "الحصول على شهادات مهنية معتمدة في مجال التعليم",
        suggestedEvidence: [
          "صور الشهادات المهنية",
          "شهادة الرخصة المهنية",
          "شهادات تطوير مهني",
        ],
      },
      {
        id: "std-2-ind-7",
        text: "تبادل الخبرات مع المعلمين من مدارس أخرى",
        suggestedEvidence: [
          "تقرير زيارة مدرسة أخرى",
          "صور من لقاءات تبادل الخبرات",
          "محاضر اجتماعات مجتمعات التعلم المهنية",
        ],
      },
    ],
  },
  {
    id: "std-3",
    number: 3,
    title: "التفاعل مع أولياء الأمور",
    weight: 10,
    color: "#0284C7",
    icon: "👨‍👩‍👧",
    indicators: [
      {
        id: "std-3-ind-1",
        text: "تنظيم اجتماعات دورية مع أولياء الأمور لمناقشة تقدم الطلاب",
        suggestedEvidence: [
          "محاضر اجتماعات أولياء الأمور",
          "صور من لقاءات أولياء الأمور",
          "جدول الاجتماعات الدورية",
        ],
      },
      {
        id: "std-3-ind-2",
        text: "إرسال تقارير منتظمة عن أداء الطلاب أكاديمياً وسلوكياً",
        suggestedEvidence: [
          "نماذج تقارير الطلاب المرسلة",
          "صور من رسائل التواصل مع أولياء الأمور",
          "سجل المتابعة الأكاديمية",
        ],
      },
      {
        id: "std-3-ind-3",
        text: "استخدام وسائل التواصل الحديثة لإبقاء أولياء الأمور على اطلاع",
        suggestedEvidence: [
          "صور من مجموعات الواتساب التعليمية",
          "صور من منصة مدرستي - التواصل",
          "رسائل إلكترونية لأولياء الأمور",
        ],
      },
      {
        id: "std-3-ind-4",
        text: "الاستماع لملاحظات أولياء الأمور والعمل على تحسين الأداء",
        suggestedEvidence: [
          "استبيان رضا أولياء الأمور",
          "تقرير تحليل ملاحظات أولياء الأمور",
          "خطة تحسين بناءً على الملاحظات",
        ],
      },
    ],
  },
  {
    id: "std-4",
    number: 4,
    title: "التنويع في استراتيجيات التدريس",
    weight: 10,
    color: "#D97706",
    icon: "🎯",
    indicators: [
      {
        id: "std-4-ind-1",
        text: "استخدام التعلم النشط مثل المناقشات الجماعية والعروض التقديمية",
        suggestedEvidence: [
          "صور من أنشطة التعلم النشط",
          "تحضير درس يتضمن استراتيجيات نشطة",
          "فيديو لحصة تعلم نشط",
        ],
      },
      {
        id: "std-4-ind-2",
        text: "تطبيق التعلم القائم على المشاريع لتعزيز الإبداع وحل المشكلات",
        suggestedEvidence: [
          "صور مشاريع الطلاب",
          "خطة مشروع تعليمي",
          "تقرير نتائج التعلم القائم على المشاريع",
        ],
      },
      {
        id: "std-4-ind-3",
        text: "استخدام الوسائل البصرية والسمعية مثل الفيديوهات والصور",
        suggestedEvidence: [
          "صور الوسائل التعليمية المستخدمة",
          "روابط فيديوهات تعليمية",
          "صور عروض تقديمية",
        ],
      },
      {
        id: "std-4-ind-4",
        text: "تخصيص أنشطة تعليمية تناسب أنماط التعلم المختلفة",
        suggestedEvidence: [
          "أوراق عمل متنوعة (بصري، سمعي، حركي)",
          "تحضير درس يراعي الفروق الفردية",
          "صور أنشطة متنوعة",
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
        text: "تقديم دروس إضافية للطلاب الذين يحتاجون إلى دعم",
        suggestedEvidence: [
          "جدول الحصص الإضافية",
          "سجل حضور الدروس الإضافية",
          "تقرير عن البرنامج العلاجي",
        ],
      },
      {
        id: "std-5-ind-2",
        text: "استخدام أساليب تقييم مستمرة لتحديد نقاط الضعف",
        suggestedEvidence: [
          "نماذج اختبارات تشخيصية",
          "سجل متابعة مستوى الطلاب",
          "تقرير تحليل نتائج",
        ],
      },
      {
        id: "std-5-ind-3",
        text: "تشجيع الطلاب على المشاركة في المسابقات الأكاديمية",
        suggestedEvidence: [
          "شهادات مشاركة الطلاب في مسابقات",
          "صور من المسابقات",
          "تقرير عن إنجازات الطلاب",
        ],
      },
      {
        id: "std-5-ind-4",
        text: "توفير مصادر تعليمية إضافية مثل الكتب الإلكترونية والمواقع",
        suggestedEvidence: [
          "قائمة المصادر التعليمية الإضافية",
          "صور من المكتبة الصفية",
          "روابط مواقع تعليمية مشاركة مع الطلاب",
        ],
      },
    ],
  },
  {
    id: "std-6",
    number: 6,
    title: "إعداد وتنفيذ خطة التعلم",
    weight: 10,
    color: "#2563EB",
    icon: "📝",
    indicators: [
      {
        id: "std-6-ind-1",
        text: "وضع أهداف تعليمية واضحة وقابلة للقياس",
        suggestedEvidence: [
          "نماذج تحضير دروس بأهداف واضحة",
          "خطة الفصل الدراسي",
          "سجل الأهداف التعليمية",
        ],
      },
      {
        id: "std-6-ind-2",
        text: "تصميم خطط دراسية تتوافق مع المنهج واحتياجات الطلاب",
        suggestedEvidence: [
          "الخطة الدراسية الفصلية",
          "توزيع المنهج",
          "تحضير دروس يومية",
        ],
      },
      {
        id: "std-6-ind-3",
        text: "مراجعة الخطط بشكل دوري وتعديلها بناءً على نتائج الطلاب",
        suggestedEvidence: [
          "نسخ معدلة من الخطط",
          "تقرير مراجعة الخطة",
          "محاضر اجتماعات مراجعة المنهج",
        ],
      },
      {
        id: "std-6-ind-4",
        text: "مشاركة الخطط مع الزملاء للحصول على ملاحظات وتحسينها",
        suggestedEvidence: [
          "محاضر اجتماعات القسم",
          "ملاحظات الزملاء على الخطط",
          "تقرير مجتمع التعلم المهني",
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
        text: "استخدام السبورات الذكية والأجهزة اللوحية في التدريس",
        suggestedEvidence: [
          "صور استخدام السبورة الذكية",
          "صور الأجهزة اللوحية في الفصل",
          "تقرير عن توظيف التقنية",
        ],
      },
      {
        id: "std-7-ind-2",
        text: "تطبيق برامج التعلم الإلكتروني مثل منصات التعليم عن بعد",
        suggestedEvidence: [
          "صور من منصة مدرستي",
          "تقرير استخدام المنصات الإلكترونية",
          "صور واجبات إلكترونية",
        ],
      },
      {
        id: "std-7-ind-3",
        text: "تشجيع الطلاب على استخدام التطبيقات التعليمية",
        suggestedEvidence: [
          "قائمة التطبيقات التعليمية المستخدمة",
          "صور من تطبيقات تعليمية",
          "تقرير عن أثر التطبيقات",
        ],
      },
      {
        id: "std-7-ind-4",
        text: "تنظيم ورش عمل حول استخدام التكنولوجيا في التعليم",
        suggestedEvidence: [
          "صور من ورش العمل التقنية",
          "شهادات تدريب تقني",
          "تقرير ورشة عمل",
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
        text: "تزيين الفصل بوسائل تعليمية جذابة",
        suggestedEvidence: [
          "صور الفصل المزين",
          "صور الوسائل التعليمية المعلقة",
          "صور ركن التعلم",
        ],
      },
      {
        id: "std-8-ind-2",
        text: "تنظيم الفصل بشكل يسهل الحركة والتفاعل",
        suggestedEvidence: [
          "صور ترتيب المقاعد",
          "مخطط توزيع الفصل",
          "صور أركان التعلم المختلفة",
        ],
      },
      {
        id: "std-8-ind-3",
        text: "توفير الأدوات والموارد التعليمية اللازمة",
        suggestedEvidence: [
          "صور الأدوات التعليمية",
          "قائمة جرد المواد التعليمية",
          "صور المكتبة الصفية",
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
        text: "وضع قواعد واضحة للسلوك في الصف",
        suggestedEvidence: [
          "صورة لوحة قواعد الصف",
          "ميثاق الصف الدراسي",
          "صور القوانين الصفية المعلقة",
        ],
      },
      {
        id: "std-9-ind-2",
        text: "استخدام أساليب تحفيزية لتشجيع الطلاب على الالتزام",
        suggestedEvidence: [
          "صور لوحة التحفيز",
          "نظام النقاط والمكافآت",
          "شهادات تقدير للطلاب المتميزين",
        ],
      },
      {
        id: "std-9-ind-3",
        text: "التعامل مع المشكلات السلوكية بشكل عادل وحازم",
        suggestedEvidence: [
          "سجل المتابعة السلوكية",
          "خطة تعديل السلوك",
          "تقرير عن حالة سلوكية ومعالجتها",
        ],
      },
      {
        id: "std-9-ind-4",
        text: "تنظيم الوقت بشكل فعال خلال الحصة",
        suggestedEvidence: [
          "خطة توزيع وقت الحصة",
          "تحضير درس يوضح توزيع الوقت",
          "تقرير زيارة صفية يوضح إدارة الوقت",
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
        text: "استخدام اختبارات تقييمية دورية لقياس تقدم الطلاب",
        suggestedEvidence: [
          "نماذج اختبارات دورية",
          "جدول الاختبارات التقييمية",
          "سجل درجات الطلاب",
        ],
      },
      {
        id: "std-10-ind-2",
        text: "تحليل النتائج لتحديد نقاط القوة والضعف",
        suggestedEvidence: [
          "تقرير تحليل النتائج",
          "رسوم بيانية لمستويات الطلاب",
          "جدول تحليل الأسئلة",
        ],
      },
      {
        id: "std-10-ind-3",
        text: "توفير تغذية راجعة فردية للطلاب",
        suggestedEvidence: [
          "نماذج تغذية راجعة مكتوبة",
          "سجل المقابلات الفردية مع الطلاب",
          "تقرير متابعة فردية",
        ],
      },
      {
        id: "std-10-ind-4",
        text: "تطبيق خطط علاجية للطلاب الذين يحتاجون إلى دعم",
        suggestedEvidence: [
          "الخطة العلاجية",
          "سجل متابعة الطلاب المتأخرين",
          "تقرير نتائج البرنامج العلاجي",
        ],
      },
    ],
  },
  {
    id: "std-11",
    number: 11,
    title: "تنوع أساليب التقويم",
    weight: 10,
    color: "#BE185D",
    icon: "✅",
    indicators: [
      {
        id: "std-11-ind-1",
        text: "استخدام الاختبارات الكتابية والشفوية",
        suggestedEvidence: [
          "نماذج اختبارات كتابية",
          "سجل الاختبارات الشفوية",
          "جدول توزيع الدرجات",
        ],
      },
      {
        id: "std-11-ind-2",
        text: "تطبيق التقييم العملي من خلال المشاريع والعروض",
        suggestedEvidence: [
          "صور مشاريع الطلاب",
          "معايير تقييم المشاريع (روبرك)",
          "صور عروض الطلاب التقديمية",
        ],
      },
      {
        id: "std-11-ind-3",
        text: "استخدام التقييم التكويني لتتبع تقدم الطلاب بشكل مستمر",
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
