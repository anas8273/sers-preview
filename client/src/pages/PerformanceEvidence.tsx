/**
 * شواهد الأداء الوظيفي - صفحة تفاعلية كاملة
 * البنود الحقيقية من وزارة التعليم + شواهد فرعية + رفع ملفات متنوعة + باركود QR + ذكاء اصطناعي
 */
import { useState, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, Download, Printer, Eye, ChevronDown, ChevronUp,
  Plus, Trash2, Upload, Link as LinkIcon, QrCode, Image,
  FileText, Video, Type, Sparkles, Save, RotateCcw, X,
  CheckCircle2, AlertCircle, Camera, Globe
} from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";

// ===== البنود الحقيقية لتقييم أداء المعلم (12 بند) =====
const TEACHER_CRITERIA = [
  {
    id: "t1", title: "أداء الواجبات الوظيفية", maxScore: 5,
    description: "الالتزام بالحضور والانصراف وتنفيذ المهام الموكلة",
    suggestedEvidences: [
      "تقرير تنفيذ إذاعة مدرسية",
      "تقرير تنفيذ نشاط لا صفي",
      "تقرير تنفيذ حصة انتظار",
      "تقرير المشاركة في لجان المدرسة",
      "تقرير الإشراف اليومي",
    ],
  },
  {
    id: "t2", title: "التفاعل مع المجتمع المهني", maxScore: 5,
    description: "المشاركة الفاعلة في مجتمعات التعلم المهنية والزيارات التبادلية",
    suggestedEvidences: [
      "استمارة وتقرير تبادل الزيارات بين المعلمين",
      "تقرير جلسات مجتمعات التعلم المهنية",
      "تقرير المشاركة في اجتماعات التخصص",
      "تقرير بحث الدرس",
      "تقرير البحث الإجرائي",
    ],
  },
  {
    id: "t3", title: "التفاعل مع أولياء الأمور", maxScore: 5,
    description: "التواصل المستمر مع أولياء الأمور وإشراكهم في العملية التعليمية",
    suggestedEvidences: [
      "تقرير التواصل مع أولياء الأمور عبر منصة مدرستي",
      "تقرير الاجتماع الأول لأولياء الأمور",
      "تقرير اجتماع مجلس الآباء",
      "رسائل التواصل مع أولياء الأمور",
    ],
  },
  {
    id: "t4", title: "التنوع في استراتيجيات التدريس", maxScore: 5,
    description: "استخدام استراتيجيات تدريس متنوعة وفعالة تراعي الفروق الفردية",
    suggestedEvidences: [
      "تقرير تطبيق استراتيجية التعلم النشط",
      "تقرير تطبيق استراتيجية التعلم باللعب",
      "تقرير تطبيق استراتيجية خرائط المفاهيم",
      "تقرير تطبيق استراتيجية العصف الذهني",
      "تقرير تطبيق استراتيجية تمثيل الأدوار",
      "تقرير تطبيق استراتيجية التعلم التعاوني",
    ],
  },
  {
    id: "t5", title: "تحسين نتائج المتعلمين", maxScore: 5,
    description: "العمل على رفع مستوى تحصيل الطلاب من خلال الخطط العلاجية والإثرائية",
    suggestedEvidences: [
      "تقرير تصنيف الطلاب حسب مستوى التحصيل الدراسي",
      "خطة علاجية فردية أو جماعية",
      "خطة إثرائية فردية أو جماعية",
      "تقرير مقارنة نتائج الفترات",
      "تقرير المتفوقين والمتأخرين دراسياً",
    ],
  },
  {
    id: "t6", title: "إعداد وتنفيذ خطة التعلم", maxScore: 5,
    description: "التخطيط الجيد للدروس وتنفيذها وفق الخطة الزمنية",
    suggestedEvidences: [
      "خطة أسبوعية لمادة واحدة",
      "خطة أسبوعية لأكثر من مادة",
      "تقرير إنجاز المعلم اليومي والأسبوعي",
      "نموذج تحضير درس يومي",
      "توزيع المنهج الدراسي",
    ],
  },
  {
    id: "t7", title: "توظيف تقنيات ووسائل التعلم المناسبة", maxScore: 5,
    description: "استخدام التقنية والوسائل التعليمية المناسبة في العملية التعليمية",
    suggestedEvidences: [
      "تقرير توظيف Microsoft Forms",
      "تقرير توظيف Google Classroom",
      "تقرير توظيف ClassDojo",
      "تقرير توظيف Padlet",
      "تقرير توظيف Canva for Education",
      "تقرير توظيف Quizizz",
      "تقرير استخدام أجهزة العرض الضوئي",
    ],
  },
  {
    id: "t8", title: "تهيئة البيئة التعليمية", maxScore: 5,
    description: "توفير بيئة تعليمية محفزة وجاذبة للتعلم",
    suggestedEvidences: [
      "وسائل تعليمية جاهزة",
      "لوحات وبنرات إرشادية",
      "صور تجهيز الفصل الدراسي",
      "ركن التعلم الذاتي",
    ],
  },
  {
    id: "t9", title: "الإدارة الصفية", maxScore: 5,
    description: "إدارة الصف بفاعلية وتوفير بيئة آمنة ومنظمة",
    suggestedEvidences: [
      "استراتيجيات الإدارة الصفية المطبقة",
      "خطة دعم السلوك الإيجابي",
      "سجل متابعة سلوك الطلاب",
      "قوانين الصف المتفق عليها",
    ],
  },
  {
    id: "t10", title: "تحليل نتائج المتعلمين وتشخيص مستوياتهم", maxScore: 5,
    description: "تحليل نتائج الطلاب وتشخيص نقاط القوة والضعف",
    suggestedEvidences: [
      "تحليل نتائج مادة لصف واحد",
      "تقرير تصنيف الطلاب حسب أنماط التعلم",
      "تقرير مقارنة نتائج الفترات",
      "رسوم بيانية لتحليل النتائج",
    ],
  },
  {
    id: "t11", title: "تنوع أساليب التقويم", maxScore: 5,
    description: "استخدام أساليب تقويم متنوعة لقياس مستوى تحصيل الطلاب",
    suggestedEvidences: [
      "اختبار تشخيصي",
      "اختبار بعدي",
      "اختبار فترة",
      "اختبار نهائي",
      "تقويم أداء / ملاحظة",
      "ملف إنجاز الطالب",
    ],
  },
  {
    id: "t12", title: "تهيئة البيئة المدرسية للبرامج والأنشطة الطلابية", maxScore: 5,
    description: "المشاركة في تنفيذ البرامج والأنشطة المدرسية",
    suggestedEvidences: [
      "مبادرات مدرسية جاهزة",
      "تقرير المشاركة في أيام عالمية ومناسبات",
      "برامج تقنية جاهزة",
      "تقرير تنفيذ برنامج تكريم الطلاب",
    ],
  },
];

// ===== بنود تقييم أداء المدير =====
const PRINCIPAL_CRITERIA = [
  { id: "p1", title: "القيادة المدرسية", maxScore: 5, description: "قيادة المدرسة بفاعلية نحو تحقيق رؤيتها ورسالتها", suggestedEvidences: ["الخطة التشغيلية للمدرسة", "محاضر اجتماعات مجلس المدرسة", "تقرير تحقيق الأهداف"] },
  { id: "p2", title: "التخطيط الاستراتيجي", maxScore: 5, description: "وضع خطط استراتيجية واضحة ومتابعة تنفيذها", suggestedEvidences: ["الخطة الاستراتيجية", "تقرير متابعة الخطة", "مؤشرات الأداء"] },
  { id: "p3", title: "إدارة الموارد البشرية", maxScore: 5, description: "إدارة وتطوير الكوادر البشرية بالمدرسة", suggestedEvidences: ["خطة التطوير المهني", "تقارير تقييم الأداء", "برامج التحفيز"] },
  { id: "p4", title: "إدارة البيئة المدرسية", maxScore: 5, description: "توفير بيئة مدرسية آمنة ومحفزة للتعلم", suggestedEvidences: ["تقرير السلامة المدرسية", "خطة الإخلاء", "تقرير الصيانة"] },
  { id: "p5", title: "العلاقات المجتمعية والشراكات", maxScore: 5, description: "تعزيز الشراكة مع أولياء الأمور والمجتمع المحلي", suggestedEvidences: ["سجل الشراكة المجتمعية", "تقرير مجلس الآباء", "اتفاقيات الشراكة"] },
  { id: "p6", title: "التطوير المهني", maxScore: 5, description: "دعم التطوير المهني للعاملين بالمدرسة", suggestedEvidences: ["خطة التدريب", "تقارير الورش", "شهادات التدريب"] },
  { id: "p7", title: "الإشراف على العملية التعليمية", maxScore: 5, description: "متابعة العملية التعليمية والإشراف على المعلمين", suggestedEvidences: ["سجل الزيارات الصفية", "تقارير المتابعة", "خطط التحسين"] },
  { id: "p8", title: "تحسين نتائج الطلاب", maxScore: 5, description: "العمل على رفع مستوى تحصيل الطلاب", suggestedEvidences: ["تقرير تحليل النتائج", "خطط التحسين", "مقارنة النتائج"] },
  { id: "p9", title: "إدارة الأزمات والمخاطر", maxScore: 5, description: "الاستعداد للأزمات وإدارتها بفاعلية", suggestedEvidences: ["خطة إدارة الأزمات", "تقرير التدريبات", "خطة الطوارئ"] },
];

// ===== بنود تقييم أداء الوكيل =====
const VICE_PRINCIPAL_CRITERIA = [
  { id: "v1", title: "المشاركة في التخطيط المدرسي", maxScore: 5, description: "المشاركة الفاعلة في إعداد وتنفيذ الخطط المدرسية", suggestedEvidences: ["الخطة التشغيلية", "محاضر الاجتماعات", "تقارير المتابعة"] },
  { id: "v2", title: "متابعة الحضور والغياب", maxScore: 5, description: "متابعة حضور وغياب الطلاب والمعلمين", suggestedEvidences: ["سجل الحضور والغياب", "تقارير الغياب", "إشعارات أولياء الأمور"] },
  { id: "v3", title: "الإشراف على الاختبارات", maxScore: 5, description: "تنظيم والإشراف على سير الاختبارات", suggestedEvidences: ["جدول الاختبارات", "لوحات اللجان", "تقرير سير الاختبارات"] },
  { id: "v4", title: "متابعة النظام والانضباط", maxScore: 5, description: "الحفاظ على النظام والانضباط في المدرسة", suggestedEvidences: ["سجل الملاحظات السلوكية", "تقارير المتابعة", "خطة الانضباط"] },
  { id: "v5", title: "إدارة شؤون الطلاب", maxScore: 5, description: "إدارة شؤون الطلاب وتلبية احتياجاتهم", suggestedEvidences: ["سجل شؤون الطلاب", "تقارير المتابعة", "إحصاءات الطلاب"] },
  { id: "v6", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر مع أولياء الأمور", suggestedEvidences: ["سجل التواصل", "تقارير الاجتماعات", "رسائل التواصل"] },
  { id: "v7", title: "الإشراف على الأنشطة", maxScore: 5, description: "الإشراف على الأنشطة المدرسية وتنظيمها", suggestedEvidences: ["خطة الأنشطة", "تقارير التنفيذ", "صور الأنشطة"] },
];

// ===== بنود تقييم أداء الموجه الطلابي =====
const COUNSELOR_CRITERIA = [
  { id: "c1", title: "التوجيه والإرشاد الفردي", maxScore: 5, description: "تقديم خدمات التوجيه والإرشاد الفردي للطلاب", suggestedEvidences: ["سجل الحالات الفردية", "تقارير المتابعة", "خطط العلاج"] },
  { id: "c2", title: "التوجيه والإرشاد الجماعي", maxScore: 5, description: "تنفيذ برامج التوجيه والإرشاد الجماعي", suggestedEvidences: ["خطة البرامج الجماعية", "تقارير التنفيذ", "استبيانات التقييم"] },
  { id: "c3", title: "البرامج الوقائية", maxScore: 5, description: "تنفيذ البرامج الوقائية للحد من المشكلات السلوكية", suggestedEvidences: ["خطة البرامج الوقائية", "تقارير التنفيذ", "نشرات التوعية"] },
  { id: "c4", title: "البرامج العلاجية", maxScore: 5, description: "تنفيذ البرامج العلاجية للحالات السلوكية", suggestedEvidences: ["خطط العلاج", "تقارير المتابعة", "نتائج التدخل"] },
  { id: "c5", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر مع أولياء الأمور بشأن أبنائهم", suggestedEvidences: ["سجل التواصل", "تقارير الاجتماعات", "إشعارات أولياء الأمور"] },
  { id: "c6", title: "دراسة الحالات السلوكية", maxScore: 5, description: "دراسة الحالات السلوكية وتقديم الحلول المناسبة", suggestedEvidences: ["ملفات الحالات", "تقارير الدراسة", "خطط التدخل"] },
  { id: "c7", title: "التقارير والإحصاءات", maxScore: 5, description: "إعداد التقارير والإحصاءات الدورية", suggestedEvidences: ["التقارير الشهرية", "الإحصاءات", "تقرير نهاية العام"] },
];

// ===== بنود تقييم أداء الموجه الصحي =====
const HEALTH_COUNSELOR_CRITERIA = [
  { id: "h1", title: "التثقيف الصحي", maxScore: 5, description: "تنفيذ برامج التثقيف الصحي للطلاب والمعلمين", suggestedEvidences: ["خطة التثقيف الصحي", "نشرات صحية", "تقارير البرامج"] },
  { id: "h2", title: "الإسعافات الأولية", maxScore: 5, description: "تقديم الإسعافات الأولية والرعاية الصحية", suggestedEvidences: ["سجل الإسعافات", "تقارير الحالات", "جرد الأدوية"] },
  { id: "h3", title: "البيئة الصحية المدرسية", maxScore: 5, description: "متابعة البيئة الصحية المدرسية والمقصف", suggestedEvidences: ["تقارير المتابعة", "سجل النظافة", "تقرير المقصف"] },
  { id: "h4", title: "متابعة الحالات الصحية", maxScore: 5, description: "متابعة الحالات الصحية المزمنة والطارئة", suggestedEvidences: ["سجل الحالات المزمنة", "تقارير المتابعة", "إحالات طبية"] },
  { id: "h5", title: "التقارير الصحية", maxScore: 5, description: "إعداد التقارير الصحية الدورية", suggestedEvidences: ["التقارير الشهرية", "الإحصاءات الصحية", "تقرير نهاية العام"] },
];

// ===== بنود تقييم أداء المشرف التربوي =====
const SUPERVISOR_CRITERIA = [
  { id: "s1", title: "التخطيط للإشراف", maxScore: 5, description: "إعداد خطط إشرافية واضحة ومتابعة تنفيذها", suggestedEvidences: ["الخطة الإشرافية", "جدول الزيارات", "تقارير المتابعة"] },
  { id: "s2", title: "الزيارات الصفية", maxScore: 5, description: "تنفيذ الزيارات الصفية وتقديم التغذية الراجعة", suggestedEvidences: ["سجل الزيارات", "استمارات التقييم", "تقارير التغذية الراجعة"] },
  { id: "s3", title: "تطوير المعلمين مهنياً", maxScore: 5, description: "دعم التطوير المهني للمعلمين", suggestedEvidences: ["خطة التطوير المهني", "تقارير الورش", "برامج التدريب"] },
  { id: "s4", title: "تحليل نتائج الطلاب", maxScore: 5, description: "تحليل نتائج الطلاب وتقديم التوصيات", suggestedEvidences: ["تقارير التحليل", "خطط التحسين", "مقارنة النتائج"] },
  { id: "s5", title: "البرامج التدريبية", maxScore: 5, description: "تنفيذ البرامج التدريبية للمعلمين", suggestedEvidences: ["خطة التدريب", "تقارير التنفيذ", "استبيانات التقييم"] },
];

// ===== بنود تقييم أداء أمين مصادر التعلم =====
const LIBRARIAN_CRITERIA = [
  { id: "l1", title: "تنظيم مصادر التعلم", maxScore: 5, description: "تنظيم وفهرسة مصادر التعلم المتاحة", suggestedEvidences: ["سجل المصادر", "نظام الفهرسة", "تقرير الجرد"] },
  { id: "l2", title: "خدمة المستفيدين", maxScore: 5, description: "تقديم خدمات متميزة للمستفيدين", suggestedEvidences: ["سجل الإعارة", "إحصاءات الاستخدام", "استبيانات الرضا"] },
  { id: "l3", title: "التقنيات التعليمية", maxScore: 5, description: "توظيف التقنيات التعليمية في مركز المصادر", suggestedEvidences: ["تقرير التقنيات", "برامج رقمية", "تدريب المعلمين"] },
  { id: "l4", title: "البرامج والأنشطة", maxScore: 5, description: "تنفيذ برامج وأنشطة تشجع على القراءة والبحث", suggestedEvidences: ["خطة البرامج", "تقارير التنفيذ", "مسابقات القراءة"] },
];

// ===== بنود تقييم أداء معلمة رياض الأطفال =====
const KINDERGARTEN_CRITERIA = [
  { id: "k1", title: "التخطيط للأنشطة", maxScore: 5, description: "التخطيط لأنشطة تعليمية متنوعة تناسب المرحلة العمرية", suggestedEvidences: ["خطة الأنشطة الأسبوعية", "تحضير الحلقات", "خطة الأركان"] },
  { id: "k2", title: "تنفيذ الأنشطة التعليمية", maxScore: 5, description: "تنفيذ الأنشطة التعليمية بطرق إبداعية وممتعة", suggestedEvidences: ["صور الأنشطة", "تقارير التنفيذ", "فيديوهات الحلقات"] },
  { id: "k3", title: "إدارة الصف", maxScore: 5, description: "إدارة الصف بطريقة تراعي خصائص المرحلة العمرية", suggestedEvidences: ["قوانين الصف", "نظام التعزيز", "خطة الروتين اليومي"] },
  { id: "k4", title: "التقويم والمتابعة", maxScore: 5, description: "تقويم ومتابعة نمو وتطور الأطفال", suggestedEvidences: ["سجل الملاحظات", "تقارير التقدم", "ملف إنجاز الطفل"] },
  { id: "k5", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر مع أولياء الأمور", suggestedEvidences: ["سجل التواصل", "تقارير الاجتماعات", "نشرات للأسر"] },
  { id: "k6", title: "البيئة التعليمية", maxScore: 5, description: "تهيئة بيئة تعليمية آمنة ومحفزة للأطفال", suggestedEvidences: ["صور البيئة الصفية", "تجهيز الأركان", "وسائل تعليمية"] },
];

// ===== بنود تقييم أداء معلم التربية الخاصة =====
const SPECIAL_ED_CRITERIA = [
  { id: "se1", title: "إعداد الخطة التعليمية الفردية (IEP)", maxScore: 5, description: "إعداد خطط تعليمية فردية لكل طالب", suggestedEvidences: ["الخطة التعليمية الفردية", "أهداف قابلة للقياس", "تقارير التقدم"] },
  { id: "se2", title: "تنفيذ البرامج التعليمية", maxScore: 5, description: "تنفيذ البرامج التعليمية المناسبة لكل طالب", suggestedEvidences: ["سجل الجلسات", "تقارير التنفيذ", "أدوات التدريس المعدلة"] },
  { id: "se3", title: "التقييم والتشخيص", maxScore: 5, description: "تقييم وتشخيص احتياجات الطلاب", suggestedEvidences: ["تقارير التقييم", "نتائج الاختبارات", "ملف الطالب"] },
  { id: "se4", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر مع أولياء الأمور", suggestedEvidences: ["سجل التواصل", "تقارير الاجتماعات", "برامج تدريب الأسر"] },
  { id: "se5", title: "التعديل السلوكي", maxScore: 5, description: "تطبيق برامج التعديل السلوكي", suggestedEvidences: ["خطط التعديل السلوكي", "سجل السلوك", "تقارير التقدم"] },
  { id: "se6", title: "التكامل مع المعلمين", maxScore: 5, description: "التعاون مع معلمي التعليم العام", suggestedEvidences: ["خطط الدمج", "تقارير التعاون", "اجتماعات الفريق"] },
];

// ===== بنود تقييم أداء المساعد الإداري =====
const ADMIN_ASSISTANT_CRITERIA = [
  { id: "a1", title: "الأعمال الإدارية", maxScore: 5, description: "تنفيذ الأعمال الإدارية بكفاءة ودقة", suggestedEvidences: ["سجل المهام", "تقارير الإنجاز", "نماذج العمل"] },
  { id: "a2", title: "المراسلات والتقارير", maxScore: 5, description: "إعداد المراسلات والتقارير الإدارية", suggestedEvidences: ["سجل الصادر والوارد", "نماذج المراسلات", "التقارير الدورية"] },
  { id: "a3", title: "متابعة الحضور والغياب", maxScore: 5, description: "متابعة حضور وغياب المعلمين والطلاب", suggestedEvidences: ["سجل الحضور", "تقارير الغياب", "إحصاءات شهرية"] },
  { id: "a4", title: "خدمة المراجعين", maxScore: 5, description: "تقديم خدمة متميزة للمراجعين", suggestedEvidences: ["سجل المراجعين", "استبيانات الرضا", "تقارير الخدمة"] },
  { id: "a5", title: "الأرشفة والتوثيق", maxScore: 5, description: "أرشفة وتوثيق الملفات والسجلات", suggestedEvidences: ["نظام الأرشفة", "سجل الملفات", "تقارير التوثيق"] },
];

// ===== أنواع الوظائف =====
const JOB_TYPES = [
  { id: "teacher", title: "معلم / معلمة", icon: "👨‍🏫", criteria: TEACHER_CRITERIA },
  { id: "principal", title: "مدير / مديرة مدرسة", icon: "👔", criteria: PRINCIPAL_CRITERIA },
  { id: "vice_principal", title: "وكيل / وكيلة مدرسة", icon: "📋", criteria: VICE_PRINCIPAL_CRITERIA },
  { id: "counselor", title: "موجه/ة طلابي/ة", icon: "🤝", criteria: COUNSELOR_CRITERIA },
  { id: "health_counselor", title: "موجه/ة صحي/ة", icon: "🏥", criteria: HEALTH_COUNSELOR_CRITERIA },
  { id: "supervisor", title: "مشرف/ة تربوي/ة", icon: "🔍", criteria: SUPERVISOR_CRITERIA },
  { id: "librarian", title: "أمين/ة مصادر تعلم", icon: "📚", criteria: LIBRARIAN_CRITERIA },
  { id: "kindergarten", title: "معلمة رياض أطفال", icon: "🧒", criteria: KINDERGARTEN_CRITERIA },
  { id: "special_ed", title: "معلم/ة تربية خاصة", icon: "♿", criteria: SPECIAL_ED_CRITERIA },
  { id: "admin_assistant", title: "مساعد/ة إداري/ة", icon: "🗂️", criteria: ADMIN_ASSISTANT_CRITERIA },
];

// ===== أنواع الشواهد =====
type EvidenceType = "text" | "image" | "link" | "file" | "video";

interface EvidenceItem {
  id: string;
  type: EvidenceType;
  text: string;
  link: string;
  fileData: string | null; // base64 for images
  fileName: string;
  displayAs: "image" | "qr"; // for images: show as image or QR
}

interface CriterionData {
  score: number;
  notes: string;
  evidences: EvidenceItem[];
}

// ===== الثيمات =====
const THEMES = [
  { id: "simple", name: "بسيط (توفير حبر)", headerBg: "#f8f9fa", headerText: "#1a1a1a", accent: "#059669", borderColor: "#e5e7eb", bodyBg: "#fff" },
  { id: "official", name: "الهوية البصرية الرسمية", headerBg: "#1B5E20", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20", bodyBg: "#fff" },
  { id: "official-gradient", name: "الهوية البصرية تدرج", headerBg: "linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20", bodyBg: "#fff" },
  { id: "blue", name: "الأزرق الكلاسيكي", headerBg: "#0D47A1", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1", bodyBg: "#fff" },
  { id: "purple", name: "البنفسجي الأنيق", headerBg: "#4A148C", headerText: "#fff", accent: "#6A1B9A", borderColor: "#4A148C", bodyBg: "#fff" },
];

const FONT_OPTIONS = [
  { id: "default", name: "الافتراضي", family: "'Cairo', 'Tajawal', sans-serif" },
  { id: "identity", name: "خط الهوية", family: "'Tajawal', sans-serif" },
];

const SIZE_OPTIONS = [
  { id: "normal", name: "عادي", scale: 1 },
  { id: "medium", name: "وسط 95%", scale: 0.95 },
  { id: "small", name: "صغير 90%", scale: 0.90 },
  { id: "smaller", name: "أصغر 85%", scale: 0.85 },
];

// ===== اقتراحات الذكاء الاصطناعي =====
const AI_SUGGESTIONS: Record<string, string[]> = {
  t1: [
    "تم تنفيذ إذاعة مدرسية صباحية تناولت موضوعات تربوية وقيم سلوكية إيجابية، بمشاركة مجموعة من الطلاب في تقديم الفقرات المتنوعة.",
    "تم تنفيذ نشاط لا صفي بعنوان (اسم النشاط) بمشاركة (عدد) طالب، وتضمن النشاط فقرات متنوعة تهدف إلى تنمية المهارات.",
    "تم تنفيذ حصة انتظار للصف (رقم الصف) وتم خلالها مراجعة المهارات الأساسية وتقديم أنشطة تعليمية ترفيهية.",
  ],
  t2: [
    "تم تنفيذ زيارة تبادلية مع المعلم/ة (الاسم) في مادة (المادة) وتم تبادل الخبرات والملاحظات البناءة.",
    "تم المشاركة في جلسة مجتمع تعلم مهني بعنوان (العنوان) وتم مناقشة أفضل الممارسات التعليمية.",
  ],
  t4: [
    "تم تطبيق استراتيجية التعلم النشط في درس (اسم الدرس) حيث شارك الطلاب بفاعلية في بناء المعرفة.",
    "تم استخدام استراتيجية العصف الذهني لاستخراج أفكار الطلاب حول موضوع (الموضوع).",
  ],
};

function createEmptyEvidence(): EvidenceItem {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    type: "text",
    text: "",
    link: "",
    fileData: null,
    fileName: "",
    displayAs: "image",
  };
}

export default function PerformanceEvidence() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"select" | "fill" | "preview">("select");
  const [selectedJob, setSelectedJob] = useState<typeof JOB_TYPES[0] | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[1]);
  const [selectedFont, setSelectedFont] = useState(FONT_OPTIONS[0]);
  const [selectedSize, setSelectedSize] = useState(SIZE_OPTIONS[0]);
  const [expandedCriterion, setExpandedCriterion] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [showAISuggestions, setShowAISuggestions] = useState<string | null>(null);
  const [savedReports, setSavedReports] = useState<string[]>(() => {
    try {
      const saved = localStorage.getItem("sers_perf_saved_list");
      return saved ? JSON.parse(saved) : [];
    } catch { return []; }
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeEvidenceRef = useRef<{ criterionId: string; evidenceId: string } | null>(null);

  // بيانات المستخدم
  const [personalInfo, setPersonalInfo] = useState({
    name: "",
    school: "",
    department: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة",
    year: "١٤٤٧هـ",
    semester: "الفصل الدراسي الثاني",
    evaluator: "",
    evaluatorRole: "مدير المدرسة",
    date: "",
  });

  const [criteriaData, setCriteriaData] = useState<Record<string, CriterionData>>({});

  const initCriteriaData = (criteria: typeof TEACHER_CRITERIA) => {
    const data: Record<string, CriterionData> = {};
    criteria.forEach((c) => {
      data[c.id] = { score: 0, notes: "", evidences: [createEmptyEvidence()] };
    });
    setCriteriaData(data);
  };

  const handleSelectJob = (job: typeof JOB_TYPES[0]) => {
    setSelectedJob(job);
    initCriteriaData(job.criteria);
    setStep("fill");
  };

  const updateScore = (criterionId: string, score: number) => {
    setCriteriaData((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], score } }));
  };

  const updateNotes = (criterionId: string, notes: string) => {
    setCriteriaData((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], notes } }));
  };

  const addEvidence = (criterionId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: [...prev[criterionId].evidences, createEmptyEvidence()],
      },
    }));
  };

  const removeEvidence = (criterionId: string, evidenceId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: prev[criterionId].evidences.filter((e) => e.id !== evidenceId),
      },
    }));
  };

  const updateEvidence = (criterionId: string, evidenceId: string, updates: Partial<EvidenceItem>) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: prev[criterionId].evidences.map((e) => (e.id === evidenceId ? { ...e, ...updates } : e)),
      },
    }));
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeEvidenceRef.current) return;
    const { criterionId, evidenceId } = activeEvidenceRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      updateEvidence(criterionId, evidenceId, {
        type: isImage ? "image" : isVideo ? "video" : "file",
        fileData: reader.result as string,
        fileName: file.name,
        text: file.name,
        displayAs: isImage ? "image" : "qr",
      });
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const triggerFileUpload = (criterionId: string, evidenceId: string) => {
    activeEvidenceRef.current = { criterionId, evidenceId };
    fileInputRef.current?.click();
  };

  // حفظ واستعادة البيانات
  const saveReport = () => {
    const reportName = `${personalInfo.name || "تقرير"} - ${selectedJob?.title || ""} - ${new Date().toLocaleDateString("ar-SA")}`;
    const data = { personalInfo, criteriaData, jobId: selectedJob?.id, themeId: selectedTheme.id };
    localStorage.setItem(`sers_perf_${reportName}`, JSON.stringify(data));
    const list = [...savedReports.filter(n => n !== reportName), reportName];
    setSavedReports(list);
    localStorage.setItem("sers_perf_saved_list", JSON.stringify(list));
    alert("تم حفظ البيانات بنجاح!");
  };

  const loadReport = (reportName: string) => {
    try {
      const data = JSON.parse(localStorage.getItem(`sers_perf_${reportName}`) || "");
      setPersonalInfo(data.personalInfo);
      setCriteriaData(data.criteriaData);
      const job = JOB_TYPES.find(j => j.id === data.jobId);
      if (job) setSelectedJob(job);
      const theme = THEMES.find(t => t.id === data.themeId);
      if (theme) setSelectedTheme(theme);
    } catch { alert("خطأ في تحميل التقرير"); }
  };

  const resetAll = () => {
    if (confirm("هل تريد استعادة القيم الافتراضية؟ سيتم حذف جميع البيانات المدخلة.")) {
      if (selectedJob) initCriteriaData(selectedJob.criteria);
      setPersonalInfo({
        name: "", school: "",
        department: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة",
        year: "١٤٤٧هـ", semester: "الفصل الدراسي الثاني",
        evaluator: "", evaluatorRole: "مدير المدرسة", date: "",
      });
    }
  };

  const totalScore = Object.values(criteriaData).reduce((sum, c) => sum + c.score, 0);
  const maxScore = selectedJob ? selectedJob.criteria.length * 5 : 0;
  const percentage = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: "ممتاز", color: "#16A34A" };
    if (pct >= 80) return { label: "جيد جداً", color: "#2563EB" };
    if (pct >= 70) return { label: "جيد", color: "#CA8A04" };
    if (pct >= 60) return { label: "مقبول", color: "#EA580C" };
    return { label: "ضعيف", color: "#DC2626" };
  };

  const handleExportPDF = async () => {
    setIsExporting(true);
    await exportToPDF("preview-content", `شواهد_الأداء_الوظيفي_${personalInfo.name || "مستند"}.pdf`);
    setIsExporting(false);
  };

  const applyAISuggestion = (criterionId: string, suggestion: string) => {
    const data = criteriaData[criterionId];
    if (!data) return;
    const emptyEvidence = data.evidences.find(e => !e.text);
    if (emptyEvidence) {
      updateEvidence(criterionId, emptyEvidence.id, { text: suggestion, type: "text" });
    } else {
      const newEv = createEmptyEvidence();
      newEv.text = suggestion;
      newEv.type = "text";
      setCriteriaData(prev => ({
        ...prev,
        [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, newEv] },
      }));
    }
    setShowAISuggestions(null);
  };

  // ===== Step 1: اختيار الوظيفة =====
  if (step === "select") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6 transition-colors">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">العودة للرئيسية</span>
          </button>

          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4">
              <span className="text-3xl">📊</span>
            </div>
            <h1 className="text-3xl font-black text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              شواهد الأداء الوظيفي
            </h1>
            <p className="text-gray-500 max-w-lg mx-auto">
              اختر الوظيفة لبدء إعداد شواهد الأداء الوظيفي وفق معايير وزارة التعليم.
              كل وظيفة تحتوي على البنود الرسمية مع شواهد فرعية مقترحة.
            </p>
          </div>

          {/* التقارير المحفوظة */}
          {savedReports.length > 0 && (
            <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
              <h3 className="text-sm font-bold text-gray-700 mb-2">📁 التقارير المحفوظة</h3>
              <div className="flex flex-wrap gap-2">
                {savedReports.map((name) => (
                  <button
                    key={name}
                    onClick={() => { loadReport(name); setStep("fill"); }}
                    className="text-xs bg-emerald-50 text-emerald-700 px-3 py-1.5 rounded-lg hover:bg-emerald-100 transition-colors"
                  >
                    {name}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {JOB_TYPES.map((job, i) => (
              <motion.button
                key={job.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
                whileHover={{ y: -4, boxShadow: "0 12px 30px rgba(0,0,0,0.08)" }}
                onClick={() => handleSelectJob(job)}
                className="bg-white rounded-xl p-5 border border-gray-200 text-right hover:border-emerald-300 transition-all group"
              >
                <div className="text-3xl mb-3">{job.icon}</div>
                <h3 className="font-bold text-gray-800 mb-1 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>{job.title}</h3>
                <p className="text-xs text-gray-500">{job.criteria.length} بند تقييم</p>
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // ===== Step 2: إدخال البيانات =====
  if (step === "fill") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx" onChange={handleFileUpload} />

        <div className="max-w-5xl mx-auto">
          {/* شريط التحكم العلوي */}
          <div className="flex items-center justify-between mb-5 flex-wrap gap-3 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("select")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm">
                <ArrowLeft className="w-4 h-4" />
                تغيير الوظيفة
              </button>
              <span className="text-gray-300">|</span>
              <button onClick={saveReport} className="flex items-center gap-1.5 text-blue-600 hover:text-blue-700 text-sm">
                <Save className="w-4 h-4" />
                حفظ
              </button>
              <button onClick={resetAll} className="flex items-center gap-1.5 text-gray-500 hover:text-red-600 text-sm">
                <RotateCcw className="w-4 h-4" />
                استعادة
              </button>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left">
                <div className="text-2xl font-black" style={{ color: getGrade(percentage).color }}>{percentage}%</div>
                <div className="text-xs text-gray-500">{getGrade(percentage).label} · {totalScore}/{maxScore}</div>
              </div>
              <button
                onClick={() => setStep("preview")}
                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Eye className="w-4 h-4" />
                معاينة
              </button>
            </div>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            {selectedJob?.icon} شواهد الأداء الوظيفي - {selectedJob?.title}
          </h1>
          <p className="text-sm text-gray-500 mb-6">{selectedJob?.criteria.length} بند تقييم · أدخل البيانات والشواهد ثم اضغط معاينة</p>

          {/* البيانات الشخصية */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              <FileText className="w-5 h-5 text-emerald-600" />
              البيانات الأساسية
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "name", label: "الاسم الكامل", placeholder: "أدخل الاسم الرباعي", type: "input" },
                { key: "school", label: "المدرسة", placeholder: "اسم المدرسة", type: "input" },
                { key: "department", label: "معلومات الهيدر", placeholder: "المملكة العربية السعودية...", type: "textarea" },
                { key: "year", label: "العام الدراسي", placeholder: "١٤٤٧هـ", type: "input" },
                { key: "semester", label: "الفصل الدراسي", placeholder: "الفصل الدراسي الثاني", type: "input" },
                { key: "evaluator", label: "اسم المقيّم", placeholder: "اسم المقيّم", type: "input" },
                { key: "evaluatorRole", label: "صفة المقيّم", placeholder: "مدير المدرسة / المشرف التربوي", type: "input" },
                { key: "date", label: "تاريخ التقييم", placeholder: "١٤٤٧/٠٦/١٥", type: "input" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  {field.type === "textarea" ? (
                    <textarea
                      value={(personalInfo as any)[field.key]}
                      onChange={(e) => setPersonalInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      rows={3}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                    />
                  ) : (
                    <input
                      type="text"
                      value={(personalInfo as any)[field.key]}
                      onChange={(e) => setPersonalInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                      placeholder={field.placeholder}
                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* تخصيص التصميم */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base flex items-center gap-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
              🎨 تخصيص التصميم
            </h2>
            <div className="space-y-4">
              {/* ستايل التقرير */}
              <div>
                <label className="block text-sm font-medium text-gray-600 mb-2">ستايل التقرير</label>
                <div className="flex gap-2 flex-wrap">
                  {THEMES.map((theme) => (
                    <button
                      key={theme.id}
                      onClick={() => setSelectedTheme(theme)}
                      className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 text-xs font-medium transition-all ${
                        selectedTheme.id === theme.id ? "border-emerald-600 bg-emerald-50 shadow-sm" : "border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      <div className="w-4 h-4 rounded-full border" style={{ background: theme.headerBg.includes("gradient") ? theme.headerBg : theme.headerBg }} />
                      {theme.name}
                    </button>
                  ))}
                </div>
              </div>
              {/* نوع الخط */}
              <div className="flex gap-6">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">نوع الخط</label>
                  <div className="flex gap-2">
                    {FONT_OPTIONS.map((font) => (
                      <button
                        key={font.id}
                        onClick={() => setSelectedFont(font)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          selectedFont.id === font.id ? "border-emerald-600 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {font.name}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">حجم النص</label>
                  <div className="flex gap-2">
                    {SIZE_OPTIONS.map((size) => (
                      <button
                        key={size.id}
                        onClick={() => setSelectedSize(size)}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                          selectedSize.id === size.id ? "border-emerald-600 bg-emerald-50" : "border-gray-200 hover:border-gray-300"
                        }`}
                      >
                        {size.name}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* البنود */}
          <div className="space-y-3">
            {selectedJob?.criteria.map((criterion, index) => {
              const data = criteriaData[criterion.id];
              const isExpanded = expandedCriterion === criterion.id;
              if (!data) return null;
              const filledEvidences = data.evidences.filter(e => e.text).length;
              return (
                <motion.div
                  key={criterion.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.02 }}
                  className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                  <button
                    onClick={() => setExpandedCriterion(isExpanded ? null : criterion.id)}
                    className="w-full flex items-center gap-4 p-4 hover:bg-gray-50/50 transition-colors"
                  >
                    <div className="w-9 h-9 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0">
                      {index + 1}
                    </div>
                    <div className="flex-1 text-right">
                      <h3 className="font-semibold text-gray-800 text-sm">{criterion.title}</h3>
                      <p className="text-xs text-gray-500 mt-0.5">{criterion.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {filledEvidences > 0 && (
                        <span className="text-[10px] bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">{filledEvidences} شاهد</span>
                      )}
                      <div className="text-center min-w-[40px]">
                        <div className="text-lg font-bold" style={{ color: data.score >= 4 ? "#16A34A" : data.score >= 3 ? "#CA8A04" : data.score >= 1 ? "#EA580C" : "#D1D5DB" }}>
                          {data.score}
                        </div>
                        <div className="text-[10px] text-gray-400">/ {criterion.maxScore}</div>
                      </div>
                      {isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                    </div>
                  </button>

                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="px-4 pb-5 border-t border-gray-100 pt-4">
                          {/* الدرجة */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-2">الدرجة</label>
                            <div className="flex gap-2">
                              {[1, 2, 3, 4, 5].map((score) => (
                                <button
                                  key={score}
                                  onClick={() => updateScore(criterion.id, score)}
                                  className={`w-11 h-11 rounded-lg font-bold text-base transition-all ${
                                    data.score === score
                                      ? "bg-emerald-600 text-white shadow-md scale-110"
                                      : "bg-gray-100 text-gray-600 hover:bg-gray-200"
                                  }`}
                                >
                                  {score}
                                </button>
                              ))}
                            </div>
                          </div>

                          {/* الشواهد الفرعية المقترحة */}
                          {"suggestedEvidences" in criterion && (
                            <div className="mb-4 bg-amber-50 rounded-lg p-3 border border-amber-200">
                              <div className="flex items-center gap-2 mb-2">
                                <AlertCircle className="w-4 h-4 text-amber-600" />
                                <span className="text-xs font-bold text-amber-700">شواهد فرعية مقترحة لهذا البند:</span>
                              </div>
                              <div className="flex flex-wrap gap-1.5">
                                {(criterion as any).suggestedEvidences.map((sug: string, si: number) => (
                                  <span key={si} className="text-[11px] bg-white text-amber-800 px-2 py-1 rounded border border-amber-200">
                                    {sug}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {/* ملاحظات */}
                          <div className="mb-4">
                            <label className="block text-sm font-medium text-gray-700 mb-1">ملاحظات</label>
                            <textarea
                              value={data.notes}
                              onChange={(e) => updateNotes(criterion.id, e.target.value)}
                              placeholder="أضف ملاحظاتك هنا..."
                              rows={2}
                              className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none"
                            />
                          </div>

                          {/* الشواهد والأدلة */}
                          <div>
                            <div className="flex items-center justify-between mb-3">
                              <label className="text-sm font-medium text-gray-700">الشواهد والأدلة</label>
                              <div className="flex items-center gap-2">
                                {AI_SUGGESTIONS[criterion.id] && (
                                  <button
                                    onClick={() => setShowAISuggestions(showAISuggestions === criterion.id ? null : criterion.id)}
                                    className="flex items-center gap-1 text-xs text-purple-600 hover:text-purple-700 bg-purple-50 px-2 py-1 rounded-lg"
                                  >
                                    <Sparkles className="w-3 h-3" />
                                    اقتراحات ذكية
                                  </button>
                                )}
                                <button
                                  onClick={() => addEvidence(criterion.id)}
                                  className="flex items-center gap-1 text-xs text-emerald-600 hover:text-emerald-700 bg-emerald-50 px-2 py-1 rounded-lg"
                                >
                                  <Plus className="w-3 h-3" />
                                  إضافة شاهد
                                </button>
                              </div>
                            </div>

                            {/* اقتراحات الذكاء الاصطناعي */}
                            <AnimatePresence>
                              {showAISuggestions === criterion.id && AI_SUGGESTIONS[criterion.id] && (
                                <motion.div
                                  initial={{ height: 0, opacity: 0 }}
                                  animate={{ height: "auto", opacity: 1 }}
                                  exit={{ height: 0, opacity: 0 }}
                                  className="mb-3 bg-purple-50 rounded-lg p-3 border border-purple-200 overflow-hidden"
                                >
                                  <div className="flex items-center gap-2 mb-2">
                                    <Sparkles className="w-4 h-4 text-purple-600" />
                                    <span className="text-xs font-bold text-purple-700">اقتراحات الذكاء الاصطناعي - اضغط لإضافة:</span>
                                  </div>
                                  <div className="space-y-1.5">
                                    {AI_SUGGESTIONS[criterion.id].map((sug, si) => (
                                      <button
                                        key={si}
                                        onClick={() => applyAISuggestion(criterion.id, sug)}
                                        className="w-full text-right text-xs bg-white text-purple-800 p-2 rounded border border-purple-200 hover:bg-purple-100 transition-colors"
                                      >
                                        {sug}
                                      </button>
                                    ))}
                                  </div>
                                </motion.div>
                              )}
                            </AnimatePresence>

                            <div className="space-y-2">
                              {data.evidences.map((evidence, ei) => (
                                <div key={evidence.id} className="bg-gray-50 rounded-lg p-3">
                                  <div className="flex items-start gap-2 mb-2">
                                    <span className="text-xs text-gray-400 mt-2.5 shrink-0 w-5">#{ei + 1}</span>
                                    <div className="flex-1">
                                      <input
                                        type="text"
                                        value={evidence.text}
                                        onChange={(e) => updateEvidence(criterion.id, evidence.id, { text: e.target.value })}
                                        placeholder="وصف الشاهد..."
                                        className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                      />
                                    </div>
                                    {data.evidences.length > 1 && (
                                      <button onClick={() => removeEvidence(criterion.id, evidence.id)} className="text-red-400 hover:text-red-600 mt-2">
                                        <Trash2 className="w-4 h-4" />
                                      </button>
                                    )}
                                  </div>

                                  {/* أنواع الشواهد */}
                                  <div className="flex items-center gap-2 mr-7 mb-2">
                                    <span className="text-[10px] text-gray-400">نوع:</span>
                                    {([
                                      { type: "text" as EvidenceType, icon: Type, label: "نص" },
                                      { type: "image" as EvidenceType, icon: Image, label: "صورة" },
                                      { type: "link" as EvidenceType, icon: Globe, label: "رابط" },
                                      { type: "file" as EvidenceType, icon: FileText, label: "ملف" },
                                      { type: "video" as EvidenceType, icon: Video, label: "فيديو" },
                                    ]).map(({ type, icon: Icon, label }) => (
                                      <button
                                        key={type}
                                        onClick={() => {
                                          if (type === "image" || type === "file" || type === "video") {
                                            triggerFileUpload(criterion.id, evidence.id);
                                          } else {
                                            updateEvidence(criterion.id, evidence.id, { type });
                                          }
                                        }}
                                        className={`flex items-center gap-1 text-[10px] px-2 py-1 rounded transition-all ${
                                          evidence.type === type ? "bg-emerald-100 text-emerald-700 font-medium" : "bg-white text-gray-500 hover:bg-gray-100"
                                        }`}
                                      >
                                        <Icon className="w-3 h-3" />
                                        {label}
                                      </button>
                                    ))}
                                  </div>

                                  {/* حقل الرابط */}
                                  {(evidence.type === "link" || evidence.type === "video") && (
                                    <div className="mr-7">
                                      <div className="relative">
                                        <Globe className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400" />
                                        <input
                                          type="url"
                                          value={evidence.link}
                                          onChange={(e) => updateEvidence(criterion.id, evidence.id, { link: e.target.value })}
                                          placeholder="أدخل الرابط هنا..."
                                          className="w-full pr-7 pl-3 py-1.5 rounded-lg border border-gray-200 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/20"
                                        />
                                      </div>
                                      <p className="text-[10px] text-gray-400 mt-1">سيتم تحويل الرابط تلقائياً إلى باركود QR عند الطباعة</p>
                                    </div>
                                  )}

                                  {/* معاينة الصورة المرفوعة */}
                                  {evidence.type === "image" && evidence.fileData && (
                                    <div className="mr-7 mt-2">
                                      <div className="flex items-center gap-3">
                                        <img src={evidence.fileData} alt={evidence.fileName} className="w-16 h-16 object-cover rounded-lg border" />
                                        <div className="flex-1">
                                          <p className="text-xs text-gray-600">{evidence.fileName}</p>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-[10px] text-gray-400">عند الطباعة:</span>
                                            <button
                                              onClick={() => updateEvidence(criterion.id, evidence.id, { displayAs: "image" })}
                                              className={`text-[10px] px-2 py-0.5 rounded ${evidence.displayAs === "image" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                                            >
                                              <Camera className="w-3 h-3 inline ml-1" />صورة
                                            </button>
                                            <button
                                              onClick={() => updateEvidence(criterion.id, evidence.id, { displayAs: "qr" })}
                                              className={`text-[10px] px-2 py-0.5 rounded ${evidence.displayAs === "qr" ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-500"}`}
                                            >
                                              <QrCode className="w-3 h-3 inline ml-1" />باركود
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  )}

                                  {/* معاينة الملف المرفوع */}
                                  {evidence.type === "file" && evidence.fileName && (
                                    <div className="mr-7 mt-1">
                                      <div className="flex items-center gap-2 bg-blue-50 px-3 py-1.5 rounded-lg">
                                        <FileText className="w-4 h-4 text-blue-600" />
                                        <span className="text-xs text-blue-700">{evidence.fileName}</span>
                                        <span className="text-[10px] text-blue-500">(سيظهر كباركود QR عند الطباعة)</span>
                                      </div>
                                    </div>
                                  )}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </div>

          {/* زر المعاينة */}
          <div className="mt-6 flex justify-center">
            <button
              onClick={() => setStep("preview")}
              className="flex items-center gap-2 bg-emerald-600 text-white px-8 py-3 rounded-xl text-base font-bold hover:bg-emerald-700 transition-colors shadow-lg"
            >
              <Eye className="w-5 h-5" />
              معاينة وتصدير
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ===== Step 3: المعاينة والتصدير =====
  const grade = getGrade(percentage);
  const qrData = generateQRDataURL(`SERS-PERF|${personalInfo.name}|${selectedJob?.title}|${totalScore}/${maxScore}|${personalInfo.date}`);

  return (
    <div className="min-h-screen bg-gray-100 p-4 md:p-6" dir="rtl">
      <div className="max-w-4xl mx-auto">
        {/* أزرار التحكم */}
        <div className="flex items-center justify-between mb-4 flex-wrap gap-3 bg-white rounded-xl p-4 shadow-sm">
          <button onClick={() => setStep("fill")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
            <ArrowLeft className="w-4 h-4" />
            <span className="text-sm">تعديل البيانات</span>
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={saveReport}
              className="flex items-center gap-2 bg-blue-50 text-blue-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-blue-100 transition-colors"
            >
              <Save className="w-4 h-4" />
              حفظ
            </button>
            <button
              onClick={() => printElement("preview-content")}
              className="flex items-center gap-2 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm font-medium hover:bg-gray-200 transition-colors"
            >
              <Printer className="w-4 h-4" />
              طباعة
            </button>
            <button
              onClick={handleExportPDF}
              disabled={isExporting}
              className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              {isExporting ? "جاري التصدير..." : "تحميل PDF"}
            </button>
          </div>
        </div>

        {/* المعاينة الحية */}
        <div
          id="preview-content"
          className="bg-white rounded-xl shadow-lg overflow-hidden"
          style={{ fontFamily: selectedFont.family, fontSize: `${selectedSize.scale * 100}%` }}
        >
          {/* الهيدر */}
          <div
            className="p-6 text-center"
            style={{
              background: selectedTheme.headerBg,
              color: selectedTheme.headerText,
            }}
          >
            <div className="flex items-center justify-between mb-3">
              <img src={qrData} alt="QR" className="w-16 h-16 rounded" />
              <div className="flex-1 px-4">
                <div className="text-xs whitespace-pre-line opacity-80 mb-2">{personalInfo.department}</div>
                <h1 className="text-xl font-black mb-0.5">شواهد الأداء الوظيفي</h1>
                <p className="text-sm opacity-80">{selectedJob?.title}</p>
              </div>
              <div className="text-left text-xs opacity-70">
                <div>العام الدراسي {personalInfo.year}</div>
                <div>{personalInfo.semester}</div>
              </div>
            </div>
          </div>

          {/* البيانات الشخصية */}
          <div className="p-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6 text-sm">
              {[
                { label: "الاسم", value: personalInfo.name },
                { label: "المدرسة", value: personalInfo.school },
                { label: "المقيّم", value: personalInfo.evaluator },
                { label: "صفة المقيّم", value: personalInfo.evaluatorRole },
                { label: "التاريخ", value: personalInfo.date },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-2.5">
                  <div className="text-[10px] text-gray-400 mb-0.5">{item.label}</div>
                  <div className="font-semibold text-gray-800 text-sm">{item.value || "---"}</div>
                </div>
              ))}
            </div>

            {/* النتيجة */}
            <div className="flex items-center justify-center gap-8 mb-6 p-4 rounded-xl" style={{ backgroundColor: grade.color + "10", border: `2px solid ${grade.color}30` }}>
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: grade.color }}>{totalScore}</div>
                <div className="text-xs text-gray-500">من {maxScore}</div>
              </div>
              <div className="text-center">
                <div className="text-3xl font-black" style={{ color: grade.color }}>{percentage}%</div>
                <div className="text-xs text-gray-500">النسبة</div>
              </div>
              <div className="text-center">
                <div className="text-xl font-black" style={{ color: grade.color }}>{grade.label}</div>
                <div className="text-xs text-gray-500">التقدير</div>
              </div>
            </div>

            {/* جدول البنود */}
            <table className="w-full text-sm border-collapse mb-6">
              <thead>
                <tr style={{ background: selectedTheme.headerBg, color: selectedTheme.headerText }}>
                  <th className="p-2 text-right text-xs w-8">م</th>
                  <th className="p-2 text-right text-xs">البند</th>
                  <th className="p-2 text-center text-xs w-14">الدرجة</th>
                  <th className="p-2 text-right text-xs">الملاحظات</th>
                  <th className="p-2 text-right text-xs">الشواهد</th>
                </tr>
              </thead>
              <tbody>
                {selectedJob?.criteria.map((criterion, index) => {
                  const data = criteriaData[criterion.id];
                  if (!data) return null;
                  const filledEvidences = data.evidences.filter(e => e.text);
                  return (
                    <tr key={criterion.id} className={index % 2 === 0 ? "bg-white" : "bg-gray-50"}>
                      <td className="p-2 text-center border border-gray-200 font-bold text-xs" style={{ color: selectedTheme.accent }}>{index + 1}</td>
                      <td className="p-2 border border-gray-200">
                        <div className="font-semibold text-gray-800 text-xs">{criterion.title}</div>
                      </td>
                      <td className="p-2 text-center border border-gray-200">
                        <span className="inline-flex items-center justify-center w-7 h-7 rounded-full font-bold text-white text-xs" style={{ backgroundColor: data.score >= 4 ? "#16A34A" : data.score >= 3 ? "#CA8A04" : data.score >= 1 ? "#EA580C" : "#D1D5DB" }}>
                          {data.score}
                        </span>
                      </td>
                      <td className="p-2 border border-gray-200 text-xs text-gray-600 max-w-[150px]">{data.notes || "---"}</td>
                      <td className="p-2 border border-gray-200 text-xs max-w-[200px]">
                        {filledEvidences.length > 0 ? filledEvidences.map((e) => (
                          <div key={e.id} className="mb-1.5">
                            <span className="text-gray-800">• {e.text}</span>
                            {/* صورة */}
                            {e.type === "image" && e.fileData && e.displayAs === "image" && (
                              <div className="mt-1"><img src={e.fileData} alt="" className="w-20 h-14 object-cover rounded border" /></div>
                            )}
                            {/* صورة كباركود */}
                            {e.type === "image" && e.fileData && e.displayAs === "qr" && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <img src={generateQRDataURL(e.fileData.substring(0, 200))} alt="QR" className="w-8 h-8" />
                                <span className="text-[9px] text-gray-400">باركود الصورة</span>
                              </div>
                            )}
                            {/* رابط كباركود */}
                            {(e.type === "link" || e.type === "video") && e.link && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <img src={generateQRDataURL(e.link)} alt="QR" className="w-10 h-10" />
                                <span className="text-[9px] text-blue-500 break-all">{e.link.length > 40 ? e.link.substring(0, 40) + "..." : e.link}</span>
                              </div>
                            )}
                            {/* ملف كباركود */}
                            {e.type === "file" && e.fileName && (
                              <div className="flex items-center gap-1 mt-0.5">
                                <QrCode className="w-3 h-3 text-gray-400" />
                                <span className="text-[9px] text-gray-500">{e.fileName}</span>
                              </div>
                            )}
                          </div>
                        )) : <span className="text-gray-400">---</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* التوقيعات */}
            <div className="grid grid-cols-3 gap-4 pt-6 border-t border-gray-200">
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-8">توقيع المقيّم</div>
                <div className="border-t border-gray-300 pt-2 text-sm font-medium">{personalInfo.evaluator || "_______________"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-8">توقيع {selectedJob?.title.includes("معلم") ? "المعلم/ة" : "الموظف/ة"}</div>
                <div className="border-t border-gray-300 pt-2 text-sm font-medium">{personalInfo.name || "_______________"}</div>
              </div>
              <div className="text-center">
                <div className="text-xs text-gray-500 mb-8">اعتماد مدير/ة المدرسة</div>
                <div className="border-t border-gray-300 pt-2 text-sm font-medium">_______________</div>
              </div>
            </div>

            {/* الفوتر */}
            <div className="mt-6 pt-4 border-t border-gray-100 text-center text-[10px] text-gray-400">
              تم إنشاء هذا المستند بواسطة نظام SERS - السجلات التعليمية الذكية
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
