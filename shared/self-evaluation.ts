/**
 * Official Saudi ETEC School Evaluation & Accreditation Framework (`O009`)
 * الهيئة العامة لتقويم التعليم والتدريب — المركز الوطني للتقويم والتميز المدرسي (تميز)
 *
 * Models the 4 official domains (total weight 100%: الإدارة المدرسية 25%,
 * التعليم والتعلم 35%, نواتج التعلم 25%, البيئة المدرسية 15%), the 10 official
 * standards (`1-1` through `4-2`), and the full set of procedural performance
 * indicators (`1-1-1-1` through `4-2-1-3`: 48 indicators for government schools,
 * 51 indicators for private & international schools).
 *
 * Governance rule (§10 / O009): SERS computes internal school self-evaluation
 * readiness and links gaps to improvement plans and execution reports; official
 * external accreditation classification is issued exclusively by ETEC ("تميز").
 */
export const SELF_EVALUATION_FRAMEWORK_ID = "etec-school-accreditation-2026-v2" as const;

export type SelfEvaluationSchoolCategory = "government" | "private_international";

export type SelfEvaluationMeasurementTool =
  | "تحليل الوثائق"
  | "الملاحظة"
  | "الاستبانات"
  | "المقابلات"
  | "الاختبارات الوطنية";

export const SELF_EVALUATION_FRAMEWORK_META = {
  id: SELF_EVALUATION_FRAMEWORK_ID,
  version: "2026.2",
  status: "etec_aligned" as const,
  titleAr: "معايير ومؤشرات التقويم والاعتماد المدرسي (ETEC — تميز)",
  authorityAr: "هيئة تقويم التعليم والتدريب — المركز الوطني للتقويم والتميز المدرسي",
  sourceNoteAr:
    "مبني على المجالات الأربعة الرسمية بالأوزان النسبية المعتمدة (الإدارة المدرسية 25%، التعليم والتعلم 35%، نواتج التعلم 25%، البيئة المدرسية 15%) والمعايير العشرة والمؤشرات المرمّزة (48 مؤشرًا للمدارس الحكومية و51 للأهلية والعالمية). تُستخدم النتائج للتقويم الذاتي المدرسي وبناء خطة التحسين، بينما يصدر الاعتماد والتصنيف الخارجي الرسمي حصريًا عبر منصة «تميز» التابعة للهيئة.",
} as const;

export type SelfEvaluationDomainKey =
  | "administration"
  | "teaching_learning"
  | "learning_outcomes"
  | "school_environment";

export type SelfEvaluationLevel = 1 | 2 | 3 | 4;

export type ImprovementActionStatus = "planned" | "in_progress" | "completed";

export type SelfEvaluationLevelInfo = {
  level: SelfEvaluationLevel;
  label: string;
  minPercent: number;
  description: string;
};

export type SelfEvaluationDomainDef = {
  key: SelfEvaluationDomainKey;
  code: "1" | "2" | "3" | "4";
  title: string;
  weightPercent: number;
  description: string;
};

export type SelfEvaluationStandardDef = {
  code: string;
  domainKey: SelfEvaluationDomainKey;
  title: string;
  description: string;
};

export type SelfEvaluationIndicatorDef = {
  key: string;
  code: string;
  domainKey: SelfEvaluationDomainKey;
  standardCode: string;
  standardTitle: string;
  title: string;
  description: string;
  measurementTools: readonly SelfEvaluationMeasurementTool[];
  suggestedEvidenceHint: string;
  applicableTo: "all" | "private_only";
};

export const SELF_EVALUATION_LEVELS: readonly SelfEvaluationLevelInfo[] = [
  {
    level: 1,
    label: "التهيئة",
    minPercent: 0,
    description: "أقل من 50% — ممارسات أولية غير منتظمة تتطلب تأسيسًا وخطة تدخل وتحسين عاجلة.",
  },
  {
    level: 2,
    label: "الانطلاق",
    minPercent: 50,
    description: "من 50% إلى أقل من 75% — ممارسات مطبقة جزئيًا تحتاج انتظامًا وتوسيعًا في الأثر والشواهد.",
  },
  {
    level: 3,
    label: "التقدم",
    minPercent: 75,
    description: "من 75% إلى أقل من 90% — ممارسات فاعلة ومنتظمة مدعومة بشواهد تنفيذ حقيقية وأثر واضح.",
  },
  {
    level: 4,
    label: "التميز",
    minPercent: 90,
    description: "90% فأعلى — ممارسات مؤسسية مبتكرة ومستدامة تحقق أثرًا استثنائيًا قابلًا للقياس.",
  },
] as const;

export const SELF_EVALUATION_DOMAINS: readonly SelfEvaluationDomainDef[] = [
  {
    key: "administration",
    code: "1",
    title: "الإدارة المدرسية",
    weightPercent: 25,
    description: "التخطيط التشغيلي، قيادة العملية التعليمية، المجتمع المدرسي والشراكة، والتطوير المؤسسي.",
  },
  {
    key: "teaching_learning",
    code: "2",
    title: "التعليم والتعلم",
    weightPercent: 35,
    description: "بناء خبرات التعلم وتنويع استراتيجيات التدريس وتفعيل التقنية، وتقويم التعلم وتوظيف نتائجه.",
  },
  {
    key: "learning_outcomes",
    code: "3",
    title: "نواتج التعلم",
    weightPercent: 25,
    description: "التحصيل التعليمي والتقدم في الاختبارات الوطنية (نافس)، والتطور الشخصي والصحي والاجتماعي.",
  },
  {
    key: "school_environment",
    code: "4",
    title: "البيئة المدرسية",
    weightPercent: 15,
    description: "ملاءمة المبنى المدرسي والفصول والمعامل والخدمات المساندة، ومتطلبات الأمن والسلامة والصيانة والنظافة.",
  },
] as const;

export const SELF_EVALUATION_STANDARDS: readonly SelfEvaluationStandardDef[] = [
  { code: "1-1", domainKey: "administration", title: "التخطيط", description: "بناء الخطة التشغيلية للمدرسة وفق أهداف تطويرية محددة ومتابعة تنفيذها." },
  { code: "1-2", domainKey: "administration", title: "قيادة العملية التعليمية", description: "تعزيز القيم والهوية الوطنية وأخلاقيات المهنة والانضباط والسلوك الإيجابي والمواهب." },
  { code: "1-3", domainKey: "administration", title: "المجتمع المدرسي", description: "بناء العلاقات الإيجابية ومشاركة الأسرة والشراكة المجتمعية الفاعلة." },
  { code: "1-4", domainKey: "administration", title: "التطوير المؤسسي", description: "كفاءة الكوادر والرخص المهنية والتطوير المهني والتقويم الذاتي وخطط التحسين." },
  { code: "2-1", domainKey: "teaching_learning", title: "بناء خبرات التعلم", description: "تكافؤ فرص التعلم وتنفيذ المناهج وتنوع الاستراتيجيات والمهارات الأساسية والعليا والرقمية." },
  { code: "2-2", domainKey: "teaching_learning", title: "تقويم التعلم", description: "تنوع أدوات التقويم وتحليل النتائج وتوظيفها وتقديم التغذية الراجعة المستمرة." },
  { code: "3-1", domainKey: "learning_outcomes", title: "التحصيل التعليمي", description: "مستوى التحصيل والتقدم في مجالات القراءة والرياضيات والعلوم وفق الاختبارات الوطنية (نافس)." },
  { code: "3-2", domainKey: "learning_outcomes", title: "التطور الشخصي والصحي والاجتماعي", description: "الاعتزاز بالقيم والهوية والاتجاهات الإيجابية والممارسات الصحية والتطوع والانضباط والتعلم الذاتي." },
  { code: "4-1", domainKey: "school_environment", title: "المبنى المدرسي", description: "ملاءمة تنظيم المبنى والفصول والمعامل ومصادر التعلم والمرافق المساندة والوصول الشامل." },
  { code: "4-2", domainKey: "school_environment", title: "الأمن والسلامة", description: "توافر متطلبات الأمن والسلامة وانتظام الصيانة والنظافة في جميع مرافق المدرسة." },
] as const;

export const SELF_EVALUATION_INDICATORS: readonly SelfEvaluationIndicatorDef[] = [
  // المجال الأول: الإدارة المدرسية (25%) — معيار 1-1 التخطيط
  {
    key: "1-1-1-1",
    code: "1-1-1-1",
    domainKey: "administration",
    standardCode: "1-1",
    standardTitle: "التخطيط",
    title: "تضع المدرسة خطة تشغيلية مكتملة العناصر وفق أهداف تطويرية محددة.",
    description: "بناء خطة تشغيلية شاملة تستند إلى تشخيص واقع المدرسة وتتضمن أهدافًا قابلة للقياس ومبادرات مزمنة ومسؤوليات ومؤشرات أداء.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "وثيقة الخطة التشغيلية المعتمدة، محضر لجنة التخطيط والتميز، مصفوفة الأهداف ومؤشرات القياس.",
    applicableTo: "all",
  },
  {
    key: "1-1-1-2",
    code: "1-1-1-2",
    domainKey: "administration",
    standardCode: "1-1",
    standardTitle: "التخطيط",
    title: "تتابع المدرسة تنفيذ خطتها التشغيلية وتطورها بما يضمن تحقيق أهدافها.",
    description: "رصد دوري لنسب إنجاز برامج الخطة التشغيلية ومعالجة الانحرافات وتحديث الإجراءات في ضوء التغذية الراجعة.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "تقارير المتابعة الدورية للخطة التشغيلية، محاضر مراجعة الإنجاز، قرارات التحديث والمعالجة.",
    applicableTo: "all",
  },

  // معيار 1-2 قيادة العملية التعليمية
  {
    key: "1-2-1-1",
    code: "1-2-1-1",
    domainKey: "administration",
    standardCode: "1-2",
    standardTitle: "قيادة العملية التعليمية",
    title: "تعزز المدرسة القيم الإسلامية والهوية الوطنية.",
    description: "تنفيذ برامج وأنشطة منهجية ومناسبات وطنية وتربوية تغرس القيم الإسلامية الوسطية والانتماء للوطن والاعتزاز بهويته.",
    measurementTools: ["تحليل الوثائق", "الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "تقارير البرامج القيمية والمناسبات الوطنية، مبادرات تعزيز الهوية الوطنية وتوثيق أثرها.",
    applicableTo: "all",
  },
  {
    key: "1-2-1-2",
    code: "1-2-1-2",
    domainKey: "administration",
    standardCode: "1-2",
    standardTitle: "قيادة العملية التعليمية",
    title: "تلتزم المدرسة بقيم مهنة التعليم وأخلاقياتها.",
    description: "نشر ميثاق أخلاقيات مهنة التعليم ومتابعة تمثّله في الممارسات المهنية والتعامل التربوي العادل داخل المدرسة.",
    measurementTools: ["الاستبانات", "المقابلات", "الملاحظة"],
    suggestedEvidenceHint: "شواهد تفعيل ميثاق أخلاقيات مهنة التعليم، لقاءات التوعية المهنية، سجلات المتابعة الإدارية.",
    applicableTo: "all",
  },
  {
    key: "1-2-1-3",
    code: "1-2-1-3",
    domainKey: "administration",
    standardCode: "1-2",
    standardTitle: "قيادة العملية التعليمية",
    title: "تطبق المدرسة إجراءات محددة لدعم الانضباط المدرسي، وتتابع الالتزام بها.",
    description: "تفعيل قواعد السلوك والمواظبة، ورصد الحضور والغياب والتأخر يوميًا، وتنفيذ التدخلات الوقائية والعلاجية للحد من الغياب.",
    measurementTools: ["تحليل الوثائق", "الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "إحصاءات المواظبة والانضباط، تقارير معالجة الغياب، شواهد التواصل الفوري مع أولياء الأمور.",
    applicableTo: "all",
  },
  {
    key: "1-2-1-4",
    code: "1-2-1-4",
    domainKey: "administration",
    standardCode: "1-2",
    standardTitle: "قيادة العملية التعليمية",
    title: "تنفذ المدرسة برامج وأنشطة تربوية داعمة للسلوك الإيجابي لدى المتعلمين، ومنهم ذوو الإعاقة والموهوبون، وتتابعها.",
    description: "تصميم وتنفيذ مبادرات التوجيه الطلابي لتعزيز السلوك الإيجابي والوقاية من المشكلات السلوكية لجميع فئات المتعلمين.",
    measurementTools: ["تحليل الوثائق", "الاستبانات", "المقابلات"],
    suggestedEvidenceHint: "تقارير برامج تعزيز السلوك الإيجابي، سجلات لجنة التوجيه الطلابي، قياس تراجع المخالفات السلوكية.",
    applicableTo: "all",
  },
  {
    key: "1-2-1-5",
    code: "1-2-1-5",
    domainKey: "administration",
    standardCode: "1-2",
    standardTitle: "قيادة العملية التعليمية",
    title: "تنفذ المدرسة برامج وأنشطة إثرائية لتطوير مواهب المتعلمين وتهيئتهم للمستقبل، وتتابعها.",
    description: "الكشف عن الميول والمواهب الطلابية وتقديم أندية وبرامج ومسابقات علمية وثقافية ومهارية تهيئهم لمتطلبات المستقبل.",
    measurementTools: ["تحليل الوثائق", "الاستبانات", "المقابلات"],
    suggestedEvidenceHint: "سجل حصر الموهوبين، تقارير البرامج الإثرائية والمسابقات (موهبة/أولمبياد)، منجزات الطلبة.",
    applicableTo: "all",
  },

  // معيار 1-3 المجتمع المدرسي
  {
    key: "1-3-1-1",
    code: "1-3-1-1",
    domainKey: "administration",
    standardCode: "1-3",
    standardTitle: "المجتمع المدرسي",
    title: "تعزز المدرسة بناء العلاقات الإيجابية والتعاون في المجتمع المدرسي.",
    description: "ترسيخ بيئة عمل قائمة على الاحترام المتبادل والعمل بروح الفريق والتواصل الفاعل بين الإدارة والمعلمين والمتعلمين.",
    measurementTools: ["الاستبانات", "الملاحظة", "المقابلات"],
    suggestedEvidenceHint: "مبادرات تحسين المناخ التنظيمي، نتائج استطلاعات الرضا الداخلي، فرق العمل التشاركية.",
    applicableTo: "all",
  },
  {
    key: "1-3-1-2",
    code: "1-3-1-2",
    domainKey: "administration",
    standardCode: "1-3",
    standardTitle: "المجتمع المدرسي",
    title: "تعزز المدرسة مشاركة الأسرة في تعلم أبنائهم والتحضير لمستقبلهم.",
    description: "إشراك أولياء الأمور بانتظام في متابعة تقدم أبنائهم الأكاديمي والسلوكي والإرشاد التعليمي والمهني.",
    measurementTools: ["تحليل الوثائق", "الاستبانات", "المقابلات"],
    suggestedEvidenceHint: "تقارير الجمعية العمومية ومجالس أولياء الأمور، قنوات التواصل التربوي، لقاءات الإرشاد المهني.",
    applicableTo: "all",
  },
  {
    key: "1-3-1-3",
    code: "1-3-1-3",
    domainKey: "administration",
    standardCode: "1-3",
    standardTitle: "المجتمع المدرسي",
    title: "تعزز المدرسة الشراكة المجتمعية لدعم التعلم والتأثير الإيجابي في المجتمع.",
    description: "عقد شراكات فاعلة مع مؤسسات المجتمع والقطاعين الحكومي وغير الربحي لدعم البرامج التعليمية والمبادرات المجتمعية.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "اتفاقيات ومبادرات الشراكة المجتمعية (ارتقاء)، تقارير البرامج المشتركة وأثرها على المتعلمين.",
    applicableTo: "all",
  },

  // معيار 1-4 التطوير المؤسسي
  {
    key: "1-4-1-1",
    code: "1-4-1-1",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "توفر المدرسة كادرًا تعليميًا مكتملًا ومؤهلًا بما يتسق مع المهام الموكلة له.",
    description: "استكمال نصاب التخصصات التعليمية وتكليف المعلمين وفق مؤهلاتهم وتخصصاتهم المعتمدة (خاص بالمدارس الأهلية والعالمية).",
    measurementTools: ["تحليل الوثائق"],
    suggestedEvidenceHint: "بيان ملاك الكادر التعليمي ومؤهلاتهم وتخصصاتهم وجداول الأنصبة المعتمدة.",
    applicableTo: "private_only",
  },
  {
    key: "1-4-1-2",
    code: "1-4-1-2",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "توفر المدرسة كادرًا إداريًا مكتملًا ومؤهلًا بما يتسق مع المهام الموكلة له.",
    description: "توافر التشكيلات الإدارية والمساندة المؤهلة وتوزيع المهام بوضوح (خاص بالمدارس الأهلية والعالمية).",
    measurementTools: ["تحليل الوثائق"],
    suggestedEvidenceHint: "هيكل التشكيلات الإدارية، بطاقات الوصف الوظيفي، قرارات التكليف الإداري.",
    applicableTo: "private_only",
  },
  {
    key: "1-4-1-3",
    code: "1-4-1-3",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "تظهر المدرسة الملاءة والاستدامة المالية.",
    description: "كفاية واستدامة الموارد والموازنات التشغيلية للوفاء بالتزامات المدرسة التعليمية والبيئية (خاص بالمدارس الأهلية والعالمية).",
    measurementTools: ["تحليل الوثائق"],
    suggestedEvidenceHint: "الموازنة التشغيلية المعتمدة وتقارير الاستدامة المالية والوفاء بالالتزامات.",
    applicableTo: "private_only",
  },
  {
    key: "1-4-1-4",
    code: "1-4-1-4",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "تشجع المدرسة منسوبيها للحصول على الرخصة المهنية وتتابعها.",
    description: "تحفيز المعلمين والقيادات المدرسية على استيفاء متطلبات الرخصة المهنية والترقية في مستوياتها ومتابعة سريانها.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "قاعدة بيانات الرخص المهنية للمنسوبين، مبادرات التهيئة والدعم المهني لاجتياز الاختبارات.",
    applicableTo: "all",
  },
  {
    key: "1-4-1-5",
    code: "1-4-1-5",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "تدعم المدرسة التطوير المهني لمنسوبيها وفقًا لنتائج تقويم الأداء الوظيفي واحتياجاتهم.",
    description: "تحليل احتياجات المنسوبين من نتائج الزيارات الصفية وتقويم الأداء وتنفيذ مجتمعات تعلم مهنية وبرامج تدريبية موجهة.",
    measurementTools: ["تحليل الوثائق", "الاستبانات", "المقابلات"],
    suggestedEvidenceHint: "خطة التطوير المهني المبنية على الاحتياج، سجلات الزيارات الصفية التبادلية وورش العمل.",
    applicableTo: "all",
  },
  {
    key: "1-4-1-6",
    code: "1-4-1-6",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "تطبق المدرسة التقويم الذاتي المبني على المعايير المعتمدة من الهيئة.",
    description: "تشكيل فريق التقويم الذاتي وتنفيذ عمليات الرصد والتحليل بمشاركة منسوبي المدرسة وفق معايير وأدوات الهيئة.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "قرار تشكيل فريق التقويم الذاتي، محاضر الاجتماعات، وثيقة نتائج التقويم الذاتي المدعمة بالشواهد.",
    applicableTo: "all",
  },
  {
    key: "1-4-1-7",
    code: "1-4-1-7",
    domainKey: "administration",
    standardCode: "1-4",
    standardTitle: "التطوير المؤسسي",
    title: "تنفذ المدرسة خطة التحسين بناءً على نتائج التقويم المدرسي وتتابعها.",
    description: "تحويل فجوات التقويم الذاتي والخارجي إلى خطة تحسين إجرائية محددة المسؤوليات والأزمان ومؤشرات الأثر ومتابعتها.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "وثيقة خطة التحسين المدرسي، تقارير تنفيذ المبادرات العلاجية، قياس التحسن القبلي والبعدي.",
    applicableTo: "all",
  },

  // المجال الثاني: التعليم والتعلم (35%) — معيار 2-1 بناء خبرات التعلم
  {
    key: "2-1-1-1",
    code: "2-1-1-1",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "توفر المدرسة فرصًا متكافئة للتعلم تلبي احتياجات المتعلمين بمن فيهم ذوو الإعاقة والموهوبون.",
    description: "تهيئة المواقف التعليمية والخطط التربوية الفردية والتمايز لضمان مشاركة جميع المتعلمين بفاعلية وعدالة.",
    measurementTools: ["الملاحظة", "تحليل الوثائق", "الاستبانات"],
    suggestedEvidenceHint: "نماذج التخطيط المتمايز، الخطط الفردية لذوي الإعاقة والموهوبين، تقارير الملاحظة الصفية.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-2",
    code: "2-1-1-2",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تدعم المدرسة تنفيذ المناهج؛ لتحقيق نواتج التعلم المستهدفة وفق الخطة الدراسية.",
    description: "التزام المعلمين بتوزيع المنهج وإعداد الدروس المكتملة العناصر والتركيز على نواتج التعلم المقررة لكل مرحلة.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "خطط الدروس المعتمدة، تقارير متابعة إنجاز المناهج ونواتج التعلم، سجلات الإشراف المدرسي.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-3",
    code: "2-1-1-3",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تنوع المدرسة في إستراتيجيات التدريس لتلبية احتياجات المتعلمين، ودعم تعلمهم.",
    description: "توظيف استراتيجيات التعلم النشط والتعاوني والاستقصاء بما يراعي أنماط التعلم والفروق الفردية بين الطلبة.",
    measurementTools: ["الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "بطاقات الملاحظة الصفية، تقارير الدروس التطبيقية، نماذج أنشطة صفية متنوعة.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-4",
    code: "2-1-1-4",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تفعل المدرسة التعلم الإلكتروني والتقنية الرقمية؛ لتلبية احتياجات المتعلمين، ودعم تعلمهم.",
    description: "استثمار المنصات التعليمية المعتمدة (مدرستي) والأدوات الرقمية التفاعلية والمحتوى الإثرائي لتعميق الفهم.",
    measurementTools: ["الملاحظة", "تحليل الوثائق", "الاستبانات"],
    suggestedEvidenceHint: "تقارير تفعيل منصة مدرستي والمصادر الرقمية، شواهد الدروس التفاعلية والمختبرات الافتراضية.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-5",
    code: "2-1-1-5",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "توفر المدرسة أنشطة تعلم تطبيقية ترتبط بحياة المتعلمين.",
    description: "ربط المفاهيم الدراسية بمواقف واقعية ومشاريع عملية وتجارب معملية تنمي قدرة المتعلم على توظيف المعرفة.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "نماذج المشاريع الطلابية التطبيقية، سجلات تفعيل المعامل والتجارب العملية، مهام أدائية واقعية.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-6",
    code: "2-1-1-6",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تنمي المدرسة المهارات القرائية والعددية الأساسية لدى المتعلمين.",
    description: "تخصيص برامج وممارسات صفية مستمرة لتمكين الطلبة من الفهم القرائي والطلاقة اللغوية والمهارات الحسابية الأساسية.",
    measurementTools: ["الملاحظة", "تحليل الوثائق", "الاختبارات الوطنية"],
    suggestedEvidenceHint: "برامج تحسين القراءة والحساب، اختبارات تشخيصية وتتبّعية للمهارات الأساسية، مبادرات الإثراء القرائي.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-7",
    code: "2-1-1-7",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تنمي المدرسة مهارات التفكير العليا والبحث والابتكار لدى المتعلمين.",
    description: "طرح أسئلة ومشكلات مفتوحة ومشاريع بحثية تحفز التحليل والتفكير الناقد والإبداعي وحل المشكلات.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "نماذج أسئلة ومهام التفكير العليا، مشاريع البحث العلمي والابتكار الطلابي، بطاقات الملاحظة الصفية.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-8",
    code: "2-1-1-8",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تنمي المدرسة المهارات العاطفية والاجتماعية لدى المتعلمين.",
    description: "دمج أنشطة الحوار والعمل الجماعي وإدارة الذات والتعاطف والمسؤولية داخل الموقف التعليمي والأنشطة المدرسية.",
    measurementTools: ["الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "أنشطة التعلم التعاوني والحوار الطلابي، برامج المهارات الحياتية والاجتماعية.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-9",
    code: "2-1-1-9",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تنمي المدرسة المهارات الرقمية لدى المتعلمين.",
    description: "تمكين المتعلمين من إنتاج المحتوى الرقمي والبحث الآمن والبرمجة والوعي بالأمان الرقمي ضمن الأنشطة والمقررات.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "مشاريع الطلاب الرقمية والبرمجية، مبادرات المواطنة والأمان الرقمي، تفعيل معامل الحاسب.",
    applicableTo: "all",
  },
  {
    key: "2-1-1-10",
    code: "2-1-1-10",
    domainKey: "teaching_learning",
    standardCode: "2-1",
    standardTitle: "بناء خبرات التعلم",
    title: "تعزز المدرسة دافعية المتعلمين للتعلم والاستمتاع به.",
    description: "تهيئة بيئة صفية محفزة وتقدير إنجازات الطلبة وتنويع أساليب التشويق لجعل التعلم تجربة ممتعة وجاذبة.",
    measurementTools: ["الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "برامج التحفيز والتكريم التربوي، نتائج استبانات المتعلمين، مبادرات البيئة الصفية الجاذبة.",
    applicableTo: "all",
  },

  // معيار 2-2 تقويم التعلم
  {
    key: "2-2-1-1",
    code: "2-2-1-1",
    domainKey: "teaching_learning",
    standardCode: "2-2",
    standardTitle: "تقويم التعلم",
    title: "تطبق المدرسة أساليب وأدوات تقويم متنوعة؛ للكشف عن مستويات أداء المتعلمين المختلفة.",
    description: "استخدام التقويم التشخيصي والتكويني والختامي والمهام الأدائية وسلالم التقدير بما يراعي تنوع قدرات الطلبة.",
    measurementTools: ["تحليل الوثائق", "الملاحظة"],
    suggestedEvidenceHint: "نماذج اختبارات تشخيصية ومهام أدائية وسلالم تقدير (Rubrics) وملفات أعمال الطلاب.",
    applicableTo: "all",
  },
  {
    key: "2-2-1-2",
    code: "2-2-1-2",
    domainKey: "teaching_learning",
    standardCode: "2-2",
    standardTitle: "تقويم التعلم",
    title: "تطبق المدرسة أساليب وأدوات متنوعة؛ لتقويم نواتج التعلم المستهدفة في مناهج التعليم.",
    description: "بناء الاختبارات وأدوات التقويم في ضوء جداول المواصفات ومصفوفة نواتج التعلم المستهدفة لكل مادة وصف.",
    measurementTools: ["تحليل الوثائق"],
    suggestedEvidenceHint: "جداول المواصفات للاختبارات، نماذج أسئلة مرتبطة بنواتج التعلم ومهارات التفكير.",
    applicableTo: "all",
  },
  {
    key: "2-2-1-3",
    code: "2-2-1-3",
    domainKey: "teaching_learning",
    standardCode: "2-2",
    standardTitle: "تقويم التعلم",
    title: "تحلل المدرسة نتائج التقويم، وتوظفها في تحسين عمليات التعليم والتعلم والتقويم.",
    description: "تحليل نتائج الاختبارات الدورية والوطنية إحصائيًا وتشخيصيًا وبناء خطط علاجية وإثرائية لتحسين التدريس.",
    measurementTools: ["تحليل الوثائق", "المقابلات"],
    suggestedEvidenceHint: "تقارير تحليل النتائج الفصلي، محاضر لجنة التحصيل الدراسي، خطط معالجة الفاقد التعليمي وقياس أثرها.",
    applicableTo: "all",
  },
  {
    key: "2-2-1-4",
    code: "2-2-1-4",
    domainKey: "teaching_learning",
    standardCode: "2-2",
    standardTitle: "تقويم التعلم",
    title: "تقدم المدرسة التغذية الراجعة للمتعلمين وأولياء أمورهم، وتتابع تقدمهم بشكل مستمر.",
    description: "تزويد المتعلمين وأسرهم بتغذية راجعة وصفية وبنّاءة توضح مواطن القوة وخطوات التحسن ومتابعة تقدمهم.",
    measurementTools: ["تحليل الوثائق", "الاستبانات", "الملاحظة"],
    suggestedEvidenceHint: "نماذج التغذية الراجعة المكتوبة على أعمال الطلبة، تقارير إشعارات التقدم لأولياء الأمور.",
    applicableTo: "all",
  },

  // المجال الثالث: نواتج التعلم (25%) — معيار 3-1 التحصيل التعليمي
  {
    key: "3-1-1-1",
    code: "3-1-1-1",
    domainKey: "learning_outcomes",
    standardCode: "3-1",
    standardTitle: "التحصيل التعليمي",
    title: "يحقق المتعلمون نتائج متقدمة في مجال القراءة وفقًا للاختبارات الوطنية.",
    description: "تحقيق طلبة المدرسة مستويات أداء متقدمة مقارنة بالمتوسط الوطني في مجال القراءة باختبارات «نافس».",
    measurementTools: ["الاختبارات الوطنية", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقرير نتائج المدرسة في اختبارات «نافس» (مجال القراءة)، برامج رفع الجاهزية القرائية.",
    applicableTo: "all",
  },
  {
    key: "3-1-1-2",
    code: "3-1-1-2",
    domainKey: "learning_outcomes",
    standardCode: "3-1",
    standardTitle: "التحصيل التعليمي",
    title: "يحقق المتعلمون نتائج متقدمة في مجال الرياضيات وفقًا للاختبارات الوطنية.",
    description: "تحقيق طلبة المدرسة مستويات أداء متقدمة مقارنة بالمتوسط الوطني في مجال الرياضيات باختبارات «نافس».",
    measurementTools: ["الاختبارات الوطنية", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقرير نتائج المدرسة في اختبارات «نافس» (مجال الرياضيات)، خطط تحسين المهارات الرياضية.",
    applicableTo: "all",
  },
  {
    key: "3-1-1-3",
    code: "3-1-1-3",
    domainKey: "learning_outcomes",
    standardCode: "3-1",
    standardTitle: "التحصيل التعليمي",
    title: "يحقق المتعلمون نتائج متقدمة في مجال العلوم وفقًا للاختبارات الوطنية.",
    description: "تحقيق طلبة المدرسة مستويات أداء متقدمة مقارنة بالمتوسط الوطني في مجال العلوم باختبارات «نافس».",
    measurementTools: ["الاختبارات الوطنية", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقرير نتائج المدرسة في اختبارات «نافس» (مجال العلوم)، شواهد التدريبات والممارسات العلمية.",
    applicableTo: "all",
  },
  {
    key: "3-1-1-4",
    code: "3-1-1-4",
    domainKey: "learning_outcomes",
    standardCode: "3-1",
    standardTitle: "التحصيل التعليمي",
    title: "يحقق المتعلمون تقدمًا في مجال القراءة قياسًا على مستوى أداء المدرسة السابق في الاختبارات الوطنية.",
    description: "إحراز نمو إيجابي ملموس في متوسط درجات القراءة مقارنة بدورة الاختبارات الوطنية السابقة للمدرسة.",
    measurementTools: ["الاختبارات الوطنية", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقرير المقارنة السنوية لنتائج «نافس» في القراءة، شواهد أثر الخطط العلاجية القرائية.",
    applicableTo: "all",
  },
  {
    key: "3-1-1-5",
    code: "3-1-1-5",
    domainKey: "learning_outcomes",
    standardCode: "3-1",
    standardTitle: "التحصيل التعليمي",
    title: "يحقق المتعلمون تقدمًا في مجال الرياضيات قياسًا على مستوى أداء المدرسة السابق في الاختبارات الوطنية.",
    description: "إحراز نمو إيجابي ملموس في متوسط درجات الرياضيات مقارنة بدورة الاختبارات الوطنية السابقة للمدرسة.",
    measurementTools: ["الاختبارات الوطنية", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقرير المقارنة السنوية لنتائج «نافس» في الرياضيات، شواهد معالجة المهارات الحرجة.",
    applicableTo: "all",
  },
  {
    key: "3-1-1-6",
    code: "3-1-1-6",
    domainKey: "learning_outcomes",
    standardCode: "3-1",
    standardTitle: "التحصيل التعليمي",
    title: "يحقق المتعلمون تقدمًا في مجال العلوم قياسًا على مستوى أداء المدرسة السابق في الاختبارات الوطنية.",
    description: "إحراز نمو إيجابي ملموس في متوسط درجات العلوم مقارنة بدورة الاختبارات الوطنية السابقة للمدرسة.",
    measurementTools: ["الاختبارات الوطنية", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقرير المقارنة السنوية لنتائج «نافس» في العلوم، شواهد الاستقصاء العلمي التطبيقي.",
    applicableTo: "all",
  },

  // معيار 3-2 التطور الشخصي والصحي والاجتماعي
  {
    key: "3-2-1-1",
    code: "3-2-1-1",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يظهر المتعلمون الاعتزاز بالقيم والهوية الوطنية.",
    description: "تمثّل المتعلمين للقيم الإسلامية والاعتزاز بالرموز والمنجزات الوطنية والمحافظة على الممتلكات العامة.",
    measurementTools: ["الاستبانات", "الملاحظة", "المقابلات"],
    suggestedEvidenceHint: "مشاركات الطلبة في البرامج القيمية والوطنية، نتائج استبانات المتعلمين والملاحظة الميدانية.",
    applicableTo: "all",
  },
  {
    key: "3-2-1-2",
    code: "3-2-1-2",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يظهر المتعلمون اتجاهات إيجابية نحو ذواتهم والآخرين.",
    description: "تحلي المتعلمين بالثقة بالنفس واحترام الآخرين والتعاون الإيجابي والتواصل البنّاء مع أقرانهم ومعلميهم.",
    measurementTools: ["الاستبانات", "الملاحظة"],
    suggestedEvidenceHint: "مبادرات الإرشاد الطلابي لتعزيز الثقة والتقدير الذاتي، نتائج استبانات المناخ المدرسي.",
    applicableTo: "all",
  },
  {
    key: "3-2-1-3",
    code: "3-2-1-3",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يظهر المتعلمون التزامًا بالممارسات الصحية السليمة.",
    description: "وعي المتعلمين وممارستهم للعادات الصحية في التغذية والنظافة الشخصية والنشاط البدني والوقاية الصحية.",
    measurementTools: ["الاستبانات", "الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "تقارير الإرشاد الصحي والمقصف المدرسي والنشاط الرياضي ومبادرات التوعية الصحية.",
    applicableTo: "all",
  },
  {
    key: "3-2-1-4",
    code: "3-2-1-4",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يشارك المتعلمون في الأنشطة المجتمعية والأعمال التطوعية.",
    description: "انخراط الطلبة الفاعل في المبادرات التطوعية وخدمة المجتمع داخل المدرسة وخارجها وتوثيق ساعاتهم التطوعية.",
    measurementTools: ["تحليل الوثائق", "الاستبانات", "المقابلات"],
    suggestedEvidenceHint: "سجلات الساعات التطوعية للطلبة (منصة العمل التطوعي)، تقارير المبادرات المجتمعية الطلابية.",
    applicableTo: "all",
  },
  {
    key: "3-2-1-5",
    code: "3-2-1-5",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يلتزم المتعلمون بقواعد السلوك والانضباط المدرسي.",
    description: "انتظام حضور الطلبة والتزامهم بقواعد السلوك والمواظبة والزي المدرسي واحترام أنظمة المدرسة.",
    measurementTools: ["تحليل الوثائق", "الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "مؤشرات الانضباط والحضور الطلابي، انخفاض معدلات الغياب والمخالفات السلوكية.",
    applicableTo: "all",
  },
  {
    key: "3-2-1-6",
    code: "3-2-1-6",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يظهر المتعلمون الاستقلالية والقدرة على التعلم الذاتي والبحث.",
    description: "مبادرة الطلبة للبحث عن المعرفة من مصادر موثوقة وإنجاز المهام والمشاريع باستقلالية ومسؤولية ذاتية.",
    measurementTools: ["الملاحظة", "الاستبانات", "تحليل الوثائق"],
    suggestedEvidenceHint: "نماذج بحوث ومشاريع مستقلة للطلبة، شواهد تفعيل مركز مصادر التعلم والمنصات الإثرائية.",
    applicableTo: "all",
  },
  {
    key: "3-2-1-7",
    code: "3-2-1-7",
    domainKey: "learning_outcomes",
    standardCode: "3-2",
    standardTitle: "التطور الشخصي والصحي والاجتماعي",
    title: "يظهر المتعلمون اعتزازًا بثقافتهم واحترامًا للتنوع الثقافي في المجتمع.",
    description: "وعي الطلبة بالموروث الثقافي السعودي الأصيل واحترام التنوع الثقافي والحوار الحضاري الإيجابي.",
    measurementTools: ["الاستبانات", "المقابلات", "الملاحظة"],
    suggestedEvidenceHint: "تقارير الأنشطة الثقافية والتراثية، مبادرات التسامح والحوار الثقافي الطلابي.",
    applicableTo: "all",
  },

  // المجال الرابع: البيئة المدرسية (15%) — معيار 4-1 المبنى المدرسي
  {
    key: "4-1-1-1",
    code: "4-1-1-1",
    domainKey: "school_environment",
    standardCode: "4-1",
    standardTitle: "المبنى المدرسي",
    title: "تنظيم مبنى المدرسة ملائم لعدد المتعلمين والمرحلة العمرية.",
    description: "تناسب مساحات المبنى والساحات والمرافق وتوزيعها مع أعداد الطلبة وخصائص مرحلتهم العمرية.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "بيانات الطاقة الاستيعابية وتوزيع الفصول والمرافق، تقارير جاهزية المبنى المدرسي.",
    applicableTo: "all",
  },
  {
    key: "4-1-1-2",
    code: "4-1-1-2",
    domainKey: "school_environment",
    standardCode: "4-1",
    standardTitle: "المبنى المدرسي",
    title: "تتوافر فصول ومعامل ملائمة للعملية التعليمية تلبي احتياجات المتعلمين بمن فيهم ذوو الإعاقة.",
    description: "جاهزية الفصول الدراسية والمختبرات العلمية والحاسوبية من حيث الإضاءة والتهوية والأثاث والوصول الشامل.",
    measurementTools: ["الملاحظة"],
    suggestedEvidenceHint: "تقارير جاهزية الفصول والمعامل، شواهد تهيئة الوصول الشامل لذوي الإعاقة.",
    applicableTo: "all",
  },
  {
    key: "4-1-1-3",
    code: "4-1-1-3",
    domainKey: "school_environment",
    standardCode: "4-1",
    standardTitle: "المبنى المدرسي",
    title: "تتوافر في المدرسة تجهيزات ومصادر تعلم متنوعة تلبي احتياجات المتعلمين بمن فيهم ذوو الإعاقة.",
    description: "توافر الوسائل التعليمية والأجهزة الرقمية ومصادر التعلم المساندة وتوظيفها لخدمة جميع المتعلمين.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "سجلات التجهيزات المدرسية ومصادر التعلم والسبورات التفاعلية وتقارير تفعيلها.",
    applicableTo: "all",
  },
  {
    key: "4-1-1-4",
    code: "4-1-1-4",
    domainKey: "school_environment",
    standardCode: "4-1",
    standardTitle: "المبنى المدرسي",
    title: "تلبي المرافق والخدمات المساندة احتياجات المتعلمين بمن فيهم ذوو الإعاقة.",
    description: "كفاية وملاءمة الملاعب والمقصف ودورات المياه والممرات والمنحدرات والعيادة المدرسية لجميع الفئات.",
    measurementTools: ["الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "تقارير فحص المرافق المساندة والعيادة والمقصف، تسهيلات الوصول الشامل.",
    applicableTo: "all",
  },

  // معيار 4-2 الأمن والسلامة
  {
    key: "4-2-1-1",
    code: "4-2-1-1",
    domainKey: "school_environment",
    standardCode: "4-2",
    standardTitle: "الأمن والسلامة",
    title: "تتوافر في فصول المدرسة ومعاملها وجميع مرافقها متطلبات الأمن والسلامة.",
    description: "جاهزية أنظمة الإنذار والإطفاء ومخارج الطوارئ وخطط الإخلاء الدورية وخلو المبنى من المخاطر.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "شهادة/تقرير السلامة المعتمد، محاضر فرضيات الإخلاء، سجلات فحص طفايات الحريق ومخارج الطوارئ.",
    applicableTo: "all",
  },
  {
    key: "4-2-1-2",
    code: "4-2-1-2",
    domainKey: "school_environment",
    standardCode: "4-2",
    standardTitle: "الأمن والسلامة",
    title: "تعمل المدرسة على صيانة جميع مرافق المبنى وتجهيزاته بانتظام.",
    description: "تنفيذ الصيانة الوقائية والعلاجية الدورية للتكييف والكهرباء والسباكة والأثاث والتجهيزات التقنية.",
    measurementTools: ["الملاحظة", "تحليل الوثائق"],
    suggestedEvidenceHint: "سجلات وبلاغات الصيانة الدورية والوقائية، تقارير إغلاق ملاحظات المرافق والتجهيزات.",
    applicableTo: "all",
  },
  {
    key: "4-2-1-3",
    code: "4-2-1-3",
    domainKey: "school_environment",
    standardCode: "4-2",
    standardTitle: "الأمن والسلامة",
    title: "تعمل المدرسة على نظافة المبنى المدرسي وجميع مرافقه بانتظام.",
    description: "متابعة نظافة الفصول والساحات ودورات المياه والمقصف على مدار اليوم الدراسي وحفظ مواد النظافة بأمان.",
    measurementTools: ["الملاحظة", "الاستبانات"],
    suggestedEvidenceHint: "قوائم المتابعة اليومية لنظافة المرافق، تقارير الإشراف اليومي والبيئة الصحية.",
    applicableTo: "all",
  },
] as const;

/**
 * Lossless mapping from v1 guided indicator keys (`sers-guided-self-review-v1`)
 * to official v2 ETEC indicator codes so pre-existing saved cycles & API payloads
 * upgrade seamlessly without losing any rating, rationale, evidence link, or action.
 */
export const LEGACY_V1_INDICATOR_KEY_MAP: Readonly<Record<string, string>> = {
  "admin.planning": "1-1-1-1",
  "admin.leadership": "1-4-1-5",
  "admin.community": "1-3-1-2",
  "teaching.planning": "2-1-1-3",
  "teaching.assessment": "2-2-1-3",
  "teaching.enrichment": "1-2-1-5",
  "outcomes.achievement": "3-1-1-1",
  "outcomes.values": "3-2-1-1",
  "outcomes.skills": "2-1-1-7",
  "env.building": "4-1-1-2",
  "env.safety": "4-2-1-1",
  "env.climate": "1-3-1-1",
} as const;

const VALID_INDICATOR_KEYS = new Set(SELF_EVALUATION_INDICATORS.map(item => item.key));
const VALID_ACTION_STATUSES = new Set<ImprovementActionStatus>(["planned", "in_progress", "completed"]);

export function resolveIndicatorKey(rawKey: string): string | null {
  const trimmed = rawKey.trim();
  if (VALID_INDICATOR_KEYS.has(trimmed)) return trimmed;
  return LEGACY_V1_INDICATOR_KEY_MAP[trimmed] ?? null;
}

export function getApplicableIndicators(
  schoolCategory: SelfEvaluationSchoolCategory = "government",
): readonly SelfEvaluationIndicatorDef[] {
  if (schoolCategory === "private_international") return SELF_EVALUATION_INDICATORS;
  return SELF_EVALUATION_INDICATORS.filter(ind => ind.applicableTo === "all");
}

export class SelfEvaluationValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SelfEvaluationValidationError";
  }
}

export type IndicatorAssessment = {
  indicatorKey: string;
  level: SelfEvaluationLevel | null;
  rationale: string;
  evidenceAssetIds: number[];
};

export type ImprovementAction = {
  id: string;
  indicatorKey: string;
  goal: string;
  action: string;
  ownerName: string;
  dueDate: string;
  status: ImprovementActionStatus;
  linkedWorkItemId: number | null;
};

export type SelfEvaluationDraftData = {
  schemaVersion: 2;
  frameworkId: typeof SELF_EVALUATION_FRAMEWORK_ID;
  schoolCategory: SelfEvaluationSchoolCategory;
  revision: number;
  executiveSummary: string;
  assessments: Record<string, IndicatorAssessment>;
  improvementActions: ImprovementAction[];
  updatedAt: string;
};

export type DomainSummary = {
  domainKey: SelfEvaluationDomainKey;
  code: string;
  title: string;
  weightPercent: number;
  ratedCount: number;
  totalCount: number;
  averageLevel: number | null;
  readinessPercent: number;
  gapCount: number;
};

export type SelfEvaluationSummary = {
  schoolCategory: SelfEvaluationSchoolCategory;
  totalIndicators: number;
  ratedIndicators: number;
  completionPercent: number;
  overallAverageLevel: number | null;
  overallReadinessPercent: number;
  accreditationBandLabel: string | null;
  gapIndicatorKeys: string[];
  uncoveredGapIndicatorKeys: string[];
  domains: DomainSummary[];
  actionCounts: {
    total: number;
    planned: number;
    in_progress: number;
    completed: number;
    linkedWorks: number;
  };
};

function isPositiveSafeInt(value: unknown): value is number {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0 && value <= 2147483647;
}

function isValidLevel(value: unknown): value is SelfEvaluationLevel {
  return value === 1 || value === 2 || value === 3 || value === 4;
}

export function classifyAccreditationBand(readinessPercent: number | null): string | null {
  if (readinessPercent === null) return null;
  if (readinessPercent >= 90) return "التميز";
  if (readinessPercent >= 75) return "التقدم";
  if (readinessPercent >= 50) return "الانطلاق";
  return "التهيئة";
}

/**
 * Normalizes and validates a self-evaluation cycle document (schema v2, with
 * transparent migration from v1 `sers-guided-self-review-v1` keys).
 * Enforces R09 / O009: any rated indicator MUST include a non-empty factual
 * rationale (minimum 5 trimmed characters).
 */
export function normalizeSelfEvaluationDraft(
  raw: unknown,
  options: { strictValidation?: boolean } = {},
): SelfEvaluationDraftData {
  const strict = options.strictValidation ?? false;
  const record = raw && typeof raw === "object" && !Array.isArray(raw)
    ? (raw as Record<string, unknown>)
    : {};

  const schoolCategory: SelfEvaluationSchoolCategory =
    record.schoolCategory === "private_international" ? "private_international" : "government";
  const revision = isPositiveSafeInt(record.revision) ? record.revision : 1;
  const executiveSummary = typeof record.executiveSummary === "string"
    ? record.executiveSummary.trim().slice(0, 4000)
    : "";

  const rawAssessments = record.assessments && typeof record.assessments === "object" && !Array.isArray(record.assessments)
    ? (record.assessments as Record<string, unknown>)
    : {};

  // Remap any legacy v1 keys into canonical ETEC codes without overwriting an explicit canonical entry
  const canonicalRawAssessments: Record<string, unknown> = {};
  for (const [rawKey, val] of Object.entries(rawAssessments)) {
    const resolved = resolveIndicatorKey(rawKey);
    if (!resolved) {
      if (strict) {
        throw new SelfEvaluationValidationError(`رمز المؤشر غير معروف في إطار الهيئة: ${rawKey}`);
      }
      continue;
    }
    if (rawKey === resolved || !(resolved in canonicalRawAssessments)) {
      canonicalRawAssessments[resolved] = val;
    }
  }

  const assessments: Record<string, IndicatorAssessment> = {};
  for (const indicator of SELF_EVALUATION_INDICATORS) {
    const candidate = canonicalRawAssessments[indicator.key];
    const item = candidate && typeof candidate === "object" && !Array.isArray(candidate)
      ? (candidate as Record<string, unknown>)
      : {};

    let level = item.level === null || item.level === undefined
      ? null
      : isValidLevel(item.level)
        ? item.level
        : strict
          ? (() => { throw new SelfEvaluationValidationError(`مستوى التقدير غير صالح للمؤشر ${indicator.code}`); })()
          : null;

    const rationale = typeof item.rationale === "string"
      ? item.rationale.trim().slice(0, 3000)
      : "";

    const isApplicable =
      schoolCategory === "private_international" || indicator.applicableTo === "all";

    if (level !== null && rationale.length < 5) {
      if (!isApplicable) {
        // When a cycle is switched from private_international to government, do not wedge
        // saves on an incomplete hidden private-only indicator; completed ones remain intact.
        level = null;
      } else if (strict) {
        throw new SelfEvaluationValidationError(
          `يلزم تدوين مبرر واقعي واضح (5 أحرف على الأقل) عند تقييم المؤشر (${indicator.code}: ${indicator.title})`,
        );
      }
    }

    const rawAssetIds = Array.isArray(item.evidenceAssetIds) ? item.evidenceAssetIds : [];
    const seenAssets = new Set<number>();
    const evidenceAssetIds: number[] = [];
    for (const id of rawAssetIds) {
      if (isPositiveSafeInt(id) && !seenAssets.has(id)) {
        seenAssets.add(id);
        evidenceAssetIds.push(id);
      }
      if (evidenceAssetIds.length >= 25) break;
    }

    assessments[indicator.key] = {
      indicatorKey: indicator.key,
      level,
      rationale,
      evidenceAssetIds,
    };
  }

  const rawActions = Array.isArray(record.improvementActions) ? record.improvementActions : [];
  if (strict && rawActions.length > 100) {
    throw new SelfEvaluationValidationError("الحد الأقصى لإجراءات خطة التحسين في الدورة الواحدة هو 100 إجراء");
  }

  const improvementActions: ImprovementAction[] = [];
  const seenActionIds = new Set<string>();
  for (const candidate of rawActions.slice(0, 100)) {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) continue;
    const item = candidate as Record<string, unknown>;
    const rawKey = typeof item.indicatorKey === "string" ? item.indicatorKey : "";
    const indicatorKey = resolveIndicatorKey(rawKey);
    if (!indicatorKey) {
      if (strict) throw new SelfEvaluationValidationError("إجراء التحسين مرتبط بمؤشر غير معروف في إطار الهيئة");
      continue;
    }

    const rawId = typeof item.id === "string" && item.id.trim().length >= 2
      ? item.id.trim().slice(0, 64)
      : `act-${improvementActions.length + 1}`;
    if (seenActionIds.has(rawId)) {
      if (strict) throw new SelfEvaluationValidationError("معرّف إجراء التحسين مكرر");
      continue;
    }
    seenActionIds.add(rawId);

    const goal = typeof item.goal === "string" ? item.goal.trim().slice(0, 300) : "";
    const action = typeof item.action === "string" ? item.action.trim().slice(0, 600) : "";
    if (strict && (goal.length < 3 || action.length < 3)) {
      throw new SelfEvaluationValidationError("أدخل هدف التحسين والخطوة الإجرائية بوضوح (3 أحرف على الأقل)");
    }
    if (!strict && (!goal || !action)) continue;

    const ownerName = typeof item.ownerName === "string" ? item.ownerName.trim().slice(0, 120) : "";
    const dueDateRaw = typeof item.dueDate === "string" ? item.dueDate.trim() : "";
    const dueDate = /^\d{4}-\d{2}-\d{2}$/.test(dueDateRaw) ? dueDateRaw : "";
    const status: ImprovementActionStatus =
      typeof item.status === "string" && VALID_ACTION_STATUSES.has(item.status as ImprovementActionStatus)
        ? (item.status as ImprovementActionStatus)
        : "planned";
    const linkedWorkItemId = isPositiveSafeInt(item.linkedWorkItemId) ? item.linkedWorkItemId : null;

    improvementActions.push({
      id: rawId,
      indicatorKey,
      goal,
      action,
      ownerName,
      dueDate,
      status,
      linkedWorkItemId,
    });
  }

  const updatedAt = typeof record.updatedAt === "string" && record.updatedAt.trim()
    ? record.updatedAt
    : new Date().toISOString();

  return {
    schemaVersion: 2,
    frameworkId: SELF_EVALUATION_FRAMEWORK_ID,
    schoolCategory,
    revision,
    executiveSummary,
    assessments,
    improvementActions,
    updatedAt,
  };
}

/**
 * Computes domain-level and official ETEC domain-weighted (25% / 35% / 25% / 15%)
 * school self-evaluation readiness across applicable indicators.
 */
export function computeSelfEvaluationSummary(draft: SelfEvaluationDraftData): SelfEvaluationSummary {
  const applicableIndicators = getApplicableIndicators(draft.schoolCategory);
  const actionIndicatorSet = new Set(draft.improvementActions.map(item => item.indicatorKey));
  const gapIndicatorKeys: string[] = [];
  const uncoveredGapIndicatorKeys: string[] = [];

  let weightedLevelSum = 0;
  let ratedDomainWeightSum = 0;
  let ratedIndicators = 0;

  const domains: DomainSummary[] = SELF_EVALUATION_DOMAINS.map(domain => {
    const domainIndicators = applicableIndicators.filter(ind => ind.domainKey === domain.key);
    let levelSum = 0;
    let domainRated = 0;
    let gapCount = 0;

    for (const ind of domainIndicators) {
      const assessment = draft.assessments[ind.key];
      const level = assessment?.level ?? null;
      if (level !== null) {
        domainRated += 1;
        ratedIndicators += 1;
        levelSum += level;
        if (level <= 2) {
          gapCount += 1;
          gapIndicatorKeys.push(ind.key);
          if (!actionIndicatorSet.has(ind.key)) {
            uncoveredGapIndicatorKeys.push(ind.key);
          }
        }
      }
    }

    const averageLevel = domainRated > 0 ? Math.round((levelSum / domainRated) * 100) / 100 : null;
    const readinessPercent = averageLevel !== null ? Math.round((averageLevel / 4) * 100) : 0;
    if (averageLevel !== null) {
      weightedLevelSum += averageLevel * domain.weightPercent;
      ratedDomainWeightSum += domain.weightPercent;
    }

    return {
      domainKey: domain.key,
      code: domain.code,
      title: domain.title,
      weightPercent: domain.weightPercent,
      ratedCount: domainRated,
      totalCount: domainIndicators.length,
      averageLevel,
      readinessPercent,
      gapCount,
    };
  });

  const totalIndicators = applicableIndicators.length;
  const completionPercent = totalIndicators > 0 ? Math.round((ratedIndicators / totalIndicators) * 100) : 0;
  const overallAverageLevel = ratedDomainWeightSum > 0
    ? Math.round((weightedLevelSum / ratedDomainWeightSum) * 100) / 100
    : null;
  const overallReadinessPercent = overallAverageLevel !== null
    ? Math.round((overallAverageLevel / 4) * 100)
    : 0;

  return {
    schoolCategory: draft.schoolCategory,
    totalIndicators,
    ratedIndicators,
    completionPercent,
    overallAverageLevel,
    overallReadinessPercent,
    accreditationBandLabel: overallAverageLevel !== null ? classifyAccreditationBand(overallReadinessPercent) : null,
    gapIndicatorKeys,
    uncoveredGapIndicatorKeys,
    domains,
    actionCounts: {
      total: draft.improvementActions.length,
      planned: draft.improvementActions.filter(a => a.status === "planned").length,
      in_progress: draft.improvementActions.filter(a => a.status === "in_progress").length,
      completed: draft.improvementActions.filter(a => a.status === "completed").length,
      linkedWorks: draft.improvementActions.filter(a => a.linkedWorkItemId !== null).length,
    },
  };
}
