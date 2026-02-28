/**
 * شواهد الأداء الوظيفي - النسخة النهائية المتقدمة
 * ✅ ذكاء اصطناعي حقيقي عبر tRPC + invokeLLM (بدون حاجة لمفتاح API)
 * ✅ إضافة شاهد واحد بزر واحد (بدل 5 خانات)
 * ✅ إضافة أقسام رئيسية وفرعية جديدة من المستخدم
 * ✅ معاينة ذكية: صور كصور، ملفات/فيديو/روابط → باركود QR حقيقي
 * ✅ PDF بثيمات متعددة
 * ✅ حفظ واستعادة محلي
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Download, Printer, Eye, ChevronDown, ChevronUp,
  Plus, Trash2, Upload, Link as LinkIcon, QrCode, Image,
  FileText, Video, Type, Sparkles, Save, X,
  Bot, ChevronLeft, BarChart3, Layers,
  Loader2, Send, PlusCircle
} from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";
import { trpc } from "@/lib/trpc";

// ===== أنواع البيانات =====
type EvidenceType = "text" | "image" | "link" | "file" | "video";

interface SubEvidence {
  id: string;
  title: string;
  description: string;
  type: "report" | "upload" | "both";
  formFields?: FormField[];
  aiSuggestions?: string[];
  isCustom?: boolean;
}

interface FormField {
  id: string;
  label: string;
  type: "text" | "textarea" | "select" | "date" | "number";
  placeholder?: string;
  options?: string[];
  required?: boolean;
}

interface EvidenceItem {
  id: string;
  subEvidenceId: string;
  type: EvidenceType;
  text: string;
  link: string;
  fileData: string | null;
  fileName: string;
  displayAs: "image" | "qr";
  formData?: Record<string, string>;
}

interface CriterionData {
  score: number;
  notes: string;
  evidences: EvidenceItem[];
  customSubEvidences: SubEvidence[];
}

interface Criterion {
  id: string;
  title: string;
  maxScore: number;
  description: string;
  subEvidences: SubEvidence[];
}

// ===== البنود الحقيقية لتقييم أداء المعلم (12 بند) =====
const TEACHER_CRITERIA: Criterion[] = [
  {
    id: "t1", title: "أداء الواجبات الوظيفية", maxScore: 5,
    description: "الالتزام بالحضور والانصراف وتنفيذ المهام الموكلة والمشاركة في الأعمال المدرسية",
    subEvidences: [
      {
        id: "t1-1", title: "تقرير تنفيذ إذاعة مدرسية", description: "توثيق تنفيذ الإذاعة المدرسية",
        type: "report" as const,
        formFields: [
          { id: "topic", label: "موضوع الإذاعة", type: "text" as const, placeholder: "مثال: اليوم الوطني", required: true },
          { id: "date", label: "تاريخ التنفيذ", type: "date" as const, required: true },
          { id: "students_count", label: "عدد الطلاب المشاركين", type: "number" as const, placeholder: "مثال: 8" },
          { id: "segments", label: "فقرات الإذاعة", type: "textarea" as const, placeholder: "القرآن الكريم - الحديث الشريف - كلمة الصباح..." },
          { id: "notes", label: "ملاحظات إضافية", type: "textarea" as const, placeholder: "أي ملاحظات حول التنفيذ" },
        ],
      },
      {
        id: "t1-2", title: "تقرير تنفيذ نشاط لا صفي", description: "توثيق الأنشطة اللاصفية",
        type: "report" as const,
        formFields: [
          { id: "activity_name", label: "اسم النشاط", type: "text" as const, placeholder: "مثال: مسابقة القراءة", required: true },
          { id: "date", label: "تاريخ التنفيذ", type: "date" as const, required: true },
          { id: "target_group", label: "الفئة المستهدفة", type: "text" as const, placeholder: "مثال: طلاب الصف الرابع" },
          { id: "objectives", label: "أهداف النشاط", type: "textarea" as const, placeholder: "الأهداف المراد تحقيقها..." },
          { id: "description", label: "وصف النشاط", type: "textarea" as const, placeholder: "وصف تفصيلي..." },
          { id: "results", label: "النتائج والتوصيات", type: "textarea" as const, placeholder: "ما تم تحقيقه..." },
        ],
      },
      {
        id: "t1-3", title: "تقرير حصة انتظار", description: "توثيق حصص الانتظار",
        type: "report" as const,
        formFields: [
          { id: "class", label: "الصف والفصل", type: "text" as const, placeholder: "مثال: 3/أ", required: true },
          { id: "date", label: "تاريخ الحصة", type: "date" as const, required: true },
          { id: "period", label: "رقم الحصة", type: "select" as const, options: ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة"] },
          { id: "activities", label: "الأنشطة المنفذة", type: "textarea" as const, placeholder: "ما تم تنفيذه..." },
        ],
      },
      {
        id: "t1-4", title: "المشاركة في لجان المدرسة", description: "توثيق المشاركة في اللجان",
        type: "report" as const,
        formFields: [
          { id: "committee_name", label: "اسم اللجنة", type: "text" as const, placeholder: "مثال: لجنة الاختبارات", required: true },
          { id: "role", label: "الدور في اللجنة", type: "text" as const, placeholder: "عضو / مقرر / رئيس" },
          { id: "tasks", label: "المهام المنفذة", type: "textarea" as const, placeholder: "المهام التي تم تنفيذها..." },
        ],
      },
      {
        id: "t1-5", title: "الإشراف اليومي", description: "توثيق الإشراف اليومي",
        type: "both" as const,
        formFields: [
          { id: "location", label: "مكان الإشراف", type: "select" as const, options: ["البوابة الرئيسية", "الفناء", "الممرات", "المقصف", "المصلى", "أخرى"] },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "observations", label: "الملاحظات", type: "textarea" as const, placeholder: "ملاحظات الإشراف..." },
        ],
      },
    ],
  },
  {
    id: "t2", title: "التفاعل مع المجتمع المهني", maxScore: 5,
    description: "المشاركة في مجتمعات التعلم المهنية والزيارات التبادلية",
    subEvidences: [
      { id: "t2-1", title: "تقرير تبادل الزيارات", description: "توثيق الزيارات التبادلية الصفية", type: "report" as const,
        formFields: [
          { id: "visited_teacher", label: "اسم المعلم/ة", type: "text" as const, required: true },
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "date", label: "تاريخ الزيارة", type: "date" as const, required: true },
          { id: "lesson", label: "عنوان الدرس", type: "text" as const },
          { id: "strengths", label: "نقاط القوة", type: "textarea" as const },
          { id: "improvements", label: "نقاط التحسين", type: "textarea" as const },
        ] },
      { id: "t2-2", title: "محضر مجتمع التعلم المهني", description: "توثيق اجتماعات مجتمع التعلم", type: "report" as const,
        formFields: [
          { id: "topic", label: "الموضوع", type: "text" as const, required: true },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "attendees", label: "الحضور", type: "textarea" as const },
          { id: "outcomes", label: "المخرجات", type: "textarea" as const },
        ] },
      { id: "t2-3", title: "بحث الدرس", description: "توثيق بحث الدرس التعاوني", type: "report" as const,
        formFields: [
          { id: "lesson", label: "عنوان الدرس", type: "text" as const, required: true },
          { id: "team", label: "فريق العمل", type: "textarea" as const },
          { id: "findings", label: "النتائج", type: "textarea" as const },
        ] },
      { id: "t2-4", title: "شهادات الدورات التدريبية", description: "توثيق الدورات والورش", type: "upload" as const },
    ],
  },
  {
    id: "t3", title: "التفاعل مع أولياء الأمور والمجتمع", maxScore: 5,
    description: "التواصل الفعال مع أولياء الأمور وتعزيز الشراكة المجتمعية",
    subEvidences: [
      { id: "t3-1", title: "سجل التواصل مع أولياء الأمور", description: "توثيق التواصل", type: "report" as const,
        formFields: [
          { id: "parent_name", label: "اسم ولي الأمر", type: "text" as const },
          { id: "student_name", label: "اسم الطالب", type: "text" as const },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "method", label: "وسيلة التواصل", type: "select" as const, options: ["حضوري", "هاتفي", "رسالة نصية", "تطبيق مدرستي", "أخرى"] },
          { id: "topic", label: "الموضوع", type: "textarea" as const },
        ] },
      { id: "t3-2", title: "تقرير مشاركة مجتمعية", description: "توثيق الشراكات المجتمعية", type: "both" as const,
        formFields: [
          { id: "activity", label: "النشاط", type: "text" as const },
          { id: "partner", label: "الجهة الشريكة", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t4", title: "التنوع في استراتيجيات التدريس", maxScore: 5,
    description: "استخدام استراتيجيات تدريس متنوعة وفعالة تراعي الفروق الفردية",
    subEvidences: [
      { id: "t4-1", title: "تقرير تطبيق استراتيجية", description: "توثيق تطبيق استراتيجية تدريسية", type: "report" as const,
        formFields: [
          { id: "strategy_name", label: "اسم الاستراتيجية", type: "text" as const, required: true },
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "lesson", label: "الدرس", type: "text" as const },
          { id: "steps", label: "خطوات التنفيذ", type: "textarea" as const },
          { id: "results", label: "النتائج", type: "textarea" as const },
        ] },
      { id: "t4-2", title: "صور/فيديو تطبيق الاستراتيجيات", description: "توثيق بصري", type: "upload" as const },
    ],
  },
  {
    id: "t5", title: "تحسين نتائج المتعلمين", maxScore: 5,
    description: "العمل على رفع مستوى تحصيل الطلاب وتحسين نتائجهم",
    subEvidences: [
      { id: "t5-1", title: "خطة تحسين النتائج", description: "خطة لتحسين مستوى الطلاب", type: "report" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "current_level", label: "المستوى الحالي", type: "textarea" as const },
          { id: "target", label: "المستوى المستهدف", type: "textarea" as const },
          { id: "strategies", label: "الاستراتيجيات المتبعة", type: "textarea" as const },
        ] },
      { id: "t5-2", title: "مقارنة النتائج قبل وبعد", description: "مقارنة النتائج", type: "both" as const,
        formFields: [
          { id: "before", label: "النتائج قبل", type: "textarea" as const },
          { id: "after", label: "النتائج بعد", type: "textarea" as const },
          { id: "analysis", label: "التحليل", type: "textarea" as const },
        ] },
      { id: "t5-3", title: "برامج التقوية والمعالجة", description: "توثيق برامج التقوية", type: "report" as const,
        formFields: [
          { id: "program", label: "اسم البرنامج", type: "text" as const },
          { id: "target_students", label: "الطلاب المستهدفون", type: "textarea" as const },
          { id: "activities", label: "الأنشطة", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t6", title: "إعداد وتنفيذ خطة التعلم", maxScore: 5,
    description: "إعداد خطط الدروس وتنفيذها بفاعلية مع تحقيق الأهداف التعليمية",
    subEvidences: [
      { id: "t6-1", title: "التحضير اليومي", description: "نماذج تحضير الدروس", type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "lesson", label: "عنوان الدرس", type: "text" as const },
          { id: "objectives", label: "الأهداف", type: "textarea" as const },
          { id: "activities", label: "الأنشطة", type: "textarea" as const },
          { id: "assessment", label: "التقويم", type: "textarea" as const },
        ] },
      { id: "t6-2", title: "توزيع المنهج", description: "خطة توزيع المنهج", type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "semester", label: "الفصل الدراسي", type: "text" as const },
          { id: "distribution", label: "التوزيع", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t7", title: "توظيف تقنيات ووسائل التعلم", maxScore: 5,
    description: "استخدام التقنية والوسائل التعليمية بفاعلية في العملية التعليمية",
    subEvidences: [
      { id: "t7-1", title: "تقرير توظيف التقنية", description: "توثيق استخدام التقنية", type: "report" as const,
        formFields: [
          { id: "tool", label: "الأداة/التطبيق", type: "text" as const, required: true },
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "usage", label: "كيفية الاستخدام", type: "textarea" as const },
          { id: "impact", label: "الأثر على التعلم", type: "textarea" as const },
        ] },
      { id: "t7-2", title: "وسائل تعليمية", description: "توثيق الوسائل التعليمية", type: "both" as const,
        formFields: [
          { id: "tool_name", label: "اسم الوسيلة", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t8", title: "تهيئة البيئة التعليمية", maxScore: 5,
    description: "توفير بيئة تعليمية محفزة وآمنة تدعم التعلم الفعال",
    subEvidences: [
      { id: "t8-1", title: "صور البيئة الصفية", description: "توثيق بصري للبيئة الصفية", type: "upload" as const },
      { id: "t8-2", title: "ركن التعلم", description: "توثيق أركان التعلم", type: "both" as const,
        formFields: [
          { id: "corner_name", label: "اسم الركن", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t9", title: "الإدارة الصفية", maxScore: 5,
    description: "إدارة الصف بفاعلية وتوفير بيئة آمنة ومنظمة",
    subEvidences: [
      { id: "t9-1", title: "قوانين الصف", description: "قوانين الصف المتفق عليها", type: "both" as const,
        formFields: [
          { id: "rules", label: "قوانين الصف", type: "textarea" as const, placeholder: "1. الاستئذان\n2. احترام الآخرين..." },
          { id: "rewards", label: "نظام المكافآت", type: "textarea" as const },
        ] },
      { id: "t9-2", title: "خطة السلوك الإيجابي", description: "تعزيز السلوك الإيجابي", type: "report" as const,
        formFields: [
          { id: "behaviors", label: "السلوكيات المستهدفة", type: "textarea" as const },
          { id: "reinforcement", label: "أساليب التعزيز", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t10", title: "تحليل نتائج المتعلمين", maxScore: 5,
    description: "تحليل نتائج الطلاب وتشخيص نقاط القوة والضعف",
    subEvidences: [
      { id: "t10-1", title: "تحليل نتائج مادة", description: "تحليل نتائج مادة لصف", type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const, required: true },
          { id: "period", label: "الفترة", type: "select" as const, options: ["الأولى", "الثانية", "الثالثة", "النهائي"] },
          { id: "total_students", label: "عدد الطلاب", type: "number" as const },
          { id: "pass_count", label: "عدد الناجحين", type: "number" as const },
          { id: "fail_count", label: "عدد الراسبين", type: "number" as const },
          { id: "average", label: "المتوسط", type: "number" as const },
          { id: "analysis", label: "التحليل والتوصيات", type: "textarea" as const },
        ] },
      { id: "t10-2", title: "كشف تصنيف الطلاب", description: "تصنيف حسب المستوى", type: "report" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "excellent", label: "متفوقون (90-100)", type: "textarea" as const },
          { id: "good", label: "جيد جداً (80-89)", type: "textarea" as const },
          { id: "avg", label: "جيد (70-79)", type: "textarea" as const },
          { id: "weak", label: "ضعيف (أقل من 60)", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t11", title: "تنوع أساليب التقويم", maxScore: 5,
    description: "استخدام أساليب تقويم متنوعة لقياس مستوى التحصيل",
    subEvidences: [
      { id: "t11-1", title: "اختبار تشخيصي / قبلي", description: "نموذج اختبار تشخيصي", type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "skills", label: "المهارات المستهدفة", type: "textarea" as const },
          { id: "results_summary", label: "ملخص النتائج", type: "textarea" as const },
        ] },
      { id: "t11-2", title: "تقويم بديل (مشروع/ملف إنجاز)", description: "أساليب تقويم بديلة", type: "both" as const,
        formFields: [
          { id: "eval_type", label: "نوع التقويم", type: "select" as const, options: ["مشروع", "ملف إنجاز", "عرض تقديمي", "بحث", "أخرى"] },
          { id: "description", label: "الوصف", type: "textarea" as const },
          { id: "criteria", label: "معايير التقييم", type: "textarea" as const },
        ] },
    ],
  },
  {
    id: "t12", title: "البرامج والأنشطة الطلابية", maxScore: 5,
    description: "المشاركة في تنفيذ البرامج والأنشطة الطلابية المتنوعة",
    subEvidences: [
      { id: "t12-1", title: "تقرير برنامج طلابي", description: "توثيق تنفيذ برنامج", type: "report" as const,
        formFields: [
          { id: "program_name", label: "اسم البرنامج", type: "text" as const, required: true },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "target", label: "الفئة المستهدفة", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
          { id: "results", label: "النتائج", type: "textarea" as const },
        ] },
      { id: "t12-2", title: "صور الأنشطة والبرامج", description: "توثيق بصري", type: "upload" as const },
      { id: "t12-3", title: "خطة النشاط الطلابي", description: "خطة الأنشطة", type: "report" as const,
        formFields: [
          { id: "semester", label: "الفصل", type: "text" as const },
          { id: "activities", label: "الأنشطة المخططة", type: "textarea" as const },
          { id: "timeline", label: "الجدول الزمني", type: "textarea" as const },
        ] },
    ],
  },
];

// ===== بنود بقية الوظائف (مختصرة) =====
function makeSimpleCriteria(prefix: string, items: { id: string; title: string; desc: string; subTitle: string }[]): Criterion[] {
  return items.map(item => ({
    id: `${prefix}${item.id}`, title: item.title, maxScore: 5, description: item.desc,
    subEvidences: [{ id: `${prefix}${item.id}-1`, title: item.subTitle, type: "both" as const, description: item.desc, formFields: [{ id: "content", label: "المحتوى", type: "textarea" as const, placeholder: "أدخل التفاصيل..." }] }],
  }));
}

const PRINCIPAL_CRITERIA = makeSimpleCriteria("p", [
  { id: "1", title: "القيادة المدرسية", desc: "قيادة المدرسة بفاعلية", subTitle: "الخطة التشغيلية" },
  { id: "2", title: "التخطيط الاستراتيجي", desc: "وضع خطط استراتيجية", subTitle: "الخطة الاستراتيجية" },
  { id: "3", title: "إدارة الموارد البشرية", desc: "إدارة وتطوير الكوادر", subTitle: "خطة التطوير المهني" },
  { id: "4", title: "إدارة البيئة المدرسية", desc: "توفير بيئة آمنة", subTitle: "تقرير السلامة" },
  { id: "5", title: "العلاقات المجتمعية", desc: "تعزيز الشراكة", subTitle: "سجل الشراكة المجتمعية" },
  { id: "6", title: "التطوير المهني", desc: "دعم التطوير", subTitle: "خطة التدريب" },
  { id: "7", title: "الإشراف على العملية التعليمية", desc: "متابعة العملية التعليمية", subTitle: "سجل الزيارات الصفية" },
  { id: "8", title: "تحسين نتائج الطلاب", desc: "رفع مستوى التحصيل", subTitle: "تقرير تحليل النتائج" },
  { id: "9", title: "إدارة الأزمات", desc: "الاستعداد للأزمات", subTitle: "خطة إدارة الأزمات" },
]);

const VICE_PRINCIPAL_CRITERIA = makeSimpleCriteria("v", [
  { id: "1", title: "المشاركة في التخطيط", desc: "المشاركة في إعداد الخطط", subTitle: "الخطة التشغيلية" },
  { id: "2", title: "متابعة الحضور والغياب", desc: "متابعة الحضور", subTitle: "سجل الحضور" },
  { id: "3", title: "الإشراف على الاختبارات", desc: "تنظيم الاختبارات", subTitle: "جدول الاختبارات" },
  { id: "4", title: "متابعة النظام والانضباط", desc: "الحفاظ على النظام", subTitle: "سجل الملاحظات السلوكية" },
  { id: "5", title: "إدارة شؤون الطلاب", desc: "إدارة الشؤون", subTitle: "سجل شؤون الطلاب" },
  { id: "6", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "7", title: "الإشراف على الأنشطة", desc: "الإشراف على الأنشطة", subTitle: "خطة الأنشطة" },
]);

const COUNSELOR_CRITERIA = makeSimpleCriteria("c", [
  { id: "1", title: "التوجيه والإرشاد الفردي", desc: "تقديم خدمات الإرشاد", subTitle: "سجل الحالات الفردية" },
  { id: "2", title: "التوجيه الجماعي", desc: "تنفيذ برامج جماعية", subTitle: "خطة البرامج الجماعية" },
  { id: "3", title: "البرامج الوقائية", desc: "تنفيذ البرامج الوقائية", subTitle: "خطة البرامج الوقائية" },
  { id: "4", title: "البرامج العلاجية", desc: "تنفيذ البرامج العلاجية", subTitle: "خطط العلاج" },
  { id: "5", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "6", title: "دراسة الحالات السلوكية", desc: "دراسة الحالات", subTitle: "ملفات الحالات" },
  { id: "7", title: "التقارير والإحصاءات", desc: "إعداد التقارير", subTitle: "التقارير الشهرية" },
]);

const HEALTH_COUNSELOR_CRITERIA = makeSimpleCriteria("h", [
  { id: "1", title: "التثقيف الصحي", desc: "تنفيذ برامج التثقيف", subTitle: "خطة التثقيف الصحي" },
  { id: "2", title: "الإسعافات الأولية", desc: "تقديم الإسعافات", subTitle: "سجل الإسعافات" },
  { id: "3", title: "البيئة الصحية", desc: "متابعة البيئة الصحية", subTitle: "تقارير المتابعة" },
  { id: "4", title: "متابعة الحالات الصحية", desc: "متابعة الحالات المزمنة", subTitle: "سجل الحالات" },
  { id: "5", title: "التقارير الصحية", desc: "إعداد التقارير", subTitle: "التقارير الشهرية" },
]);

const SUPERVISOR_CRITERIA = makeSimpleCriteria("s", [
  { id: "1", title: "التخطيط للإشراف", desc: "إعداد خطط إشرافية", subTitle: "الخطة الإشرافية" },
  { id: "2", title: "الزيارات الصفية", desc: "تنفيذ الزيارات", subTitle: "سجل الزيارات" },
  { id: "3", title: "تطوير المعلمين", desc: "دعم التطوير المهني", subTitle: "خطة التطوير" },
  { id: "4", title: "تحليل نتائج الطلاب", desc: "تحليل النتائج", subTitle: "تقارير التحليل" },
  { id: "5", title: "البرامج التدريبية", desc: "تنفيذ البرامج", subTitle: "خطة التدريب" },
]);

const LIBRARIAN_CRITERIA = makeSimpleCriteria("l", [
  { id: "1", title: "تنظيم مصادر التعلم", desc: "تنظيم وفهرسة المصادر", subTitle: "سجل المصادر" },
  { id: "2", title: "خدمة المستفيدين", desc: "تقديم خدمات متميزة", subTitle: "سجل الإعارة" },
  { id: "3", title: "التقنيات التعليمية", desc: "توظيف التقنيات", subTitle: "تقرير التقنيات" },
  { id: "4", title: "البرامج والأنشطة", desc: "تنفيذ البرامج", subTitle: "خطة البرامج" },
]);

const KINDERGARTEN_CRITERIA = makeSimpleCriteria("k", [
  { id: "1", title: "التخطيط للأنشطة", desc: "التخطيط لأنشطة تعليمية", subTitle: "خطة الأنشطة الأسبوعية" },
  { id: "2", title: "تنفيذ الأنشطة التعليمية", desc: "تنفيذ أنشطة إبداعية", subTitle: "صور الأنشطة" },
  { id: "3", title: "إدارة الصف", desc: "إدارة الصف بطريقة مناسبة", subTitle: "قوانين الصف" },
  { id: "4", title: "التقويم والمتابعة", desc: "تقويم نمو الأطفال", subTitle: "سجل الملاحظات" },
  { id: "5", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "6", title: "البيئة التعليمية", desc: "تهيئة بيئة آمنة", subTitle: "صور البيئة الصفية" },
]);

const SPECIAL_ED_CRITERIA = makeSimpleCriteria("se", [
  { id: "1", title: "إعداد الخطة التعليمية الفردية (IEP)", desc: "إعداد خطط فردية", subTitle: "الخطة التعليمية الفردية" },
  { id: "2", title: "تنفيذ البرامج التعليمية", desc: "تنفيذ البرامج", subTitle: "سجل الجلسات" },
  { id: "3", title: "التقييم والتشخيص", desc: "تقييم الاحتياجات", subTitle: "تقارير التقييم" },
  { id: "4", title: "التواصل مع أولياء الأمور", desc: "التواصل المستمر", subTitle: "سجل التواصل" },
  { id: "5", title: "التعديل السلوكي", desc: "تطبيق برامج التعديل", subTitle: "خطط التعديل السلوكي" },
  { id: "6", title: "التكامل مع المعلمين", desc: "التعاون مع معلمي التعليم العام", subTitle: "خطط الدمج" },
]);

const ADMIN_ASSISTANT_CRITERIA = makeSimpleCriteria("a", [
  { id: "1", title: "الأعمال الإدارية", desc: "تنفيذ الأعمال الإدارية", subTitle: "سجل المهام" },
  { id: "2", title: "المراسلات والتقارير", desc: "إعداد المراسلات", subTitle: "سجل الصادر والوارد" },
  { id: "3", title: "متابعة الحضور والغياب", desc: "متابعة الحضور", subTitle: "سجل الحضور" },
  { id: "4", title: "خدمة المراجعين", desc: "تقديم خدمة متميزة", subTitle: "سجل المراجعين" },
  { id: "5", title: "الأرشفة والتوثيق", desc: "أرشفة الملفات", subTitle: "نظام الأرشفة" },
]);

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

// ===== الثيمات =====
const THEMES = [
  { id: "simple", name: "بسيط", headerBg: "#f8f9fa", headerText: "#1a1a1a", accent: "#059669", borderColor: "#e5e7eb", bodyBg: "#fff" },
  { id: "official", name: "الهوية الرسمية", headerBg: "#1B5E20", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20", bodyBg: "#fff" },
  { id: "official-gradient", name: "تدرج رسمي", headerBg: "linear-gradient(135deg, #1B5E20, #2E7D32, #43A047)", headerText: "#fff", accent: "#2E7D32", borderColor: "#1B5E20", bodyBg: "#fff" },
  { id: "blue", name: "أزرق كلاسيكي", headerBg: "#0D47A1", headerText: "#fff", accent: "#1565C0", borderColor: "#0D47A1", bodyBg: "#fff" },
  { id: "purple", name: "بنفسجي أنيق", headerBg: "#4A148C", headerText: "#fff", accent: "#6A1B9A", borderColor: "#4A148C", bodyBg: "#fff" },
];

function createEmptyEvidence(subEvidenceId: string = ""): EvidenceItem {
  return {
    id: `ev_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    subEvidenceId, type: "text", text: "", link: "",
    fileData: null, fileName: "", displayAs: "image", formData: {},
  };
}

// ===== المكون الرئيسي =====
export default function PerformanceEvidence() {
  const [, navigate] = useLocation();
  const [step, setStep] = useState<"select" | "criteria-list" | "criterion-detail" | "final-review" | "preview">("select");
  const [selectedJob, setSelectedJob] = useState<typeof JOB_TYPES[0] | null>(null);
  const [selectedTheme, setSelectedTheme] = useState(THEMES[1]);
  const [currentCriterionIndex, setCurrentCriterionIndex] = useState(0);
  const [expandedSubEvidence, setExpandedSubEvidence] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

  // AI State - using tRPC (no API key needed)
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiChat, setAiChat] = useState<Record<string, string[]>>({});
  const [aiPrompt, setAiPrompt] = useState("");

  // tRPC AI mutations
  const suggestEvidenceMutation = trpc.ai.suggestEvidence.useMutation();
  const fillFormMutation = trpc.ai.fillFormFields.useMutation();
  const improveMutation = trpc.ai.improveText.useMutation();
  const suggestMutation = trpc.ai.suggest.useMutation();

  // Add custom sub-evidence / main section
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState("");
  const [showAddMainSection, setShowAddMainSection] = useState(false);
  const [newMainSectionTitle, setNewMainSectionTitle] = useState("");
  const [newMainSectionDesc, setNewMainSectionDesc] = useState("");
  const [customCriteria, setCustomCriteria] = useState<Criterion[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadRef = useRef<{ criterionId: string; subEvidenceId: string } | null>(null);

  const [personalInfo, setPersonalInfo] = useState({
    name: "", school: "",
    department: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة",
    year: "١٤٤٧هـ", semester: "الفصل الدراسي الثاني",
    evaluator: "", evaluatorRole: "مدير المدرسة", date: "",
  });

  const [criteriaData, setCriteriaData] = useState<Record<string, CriterionData>>({});

  // All criteria = job criteria + custom criteria
  const allCriteria = [...(selectedJob?.criteria || []), ...customCriteria];

  const initCriteriaData = (criteria: Criterion[]) => {
    const data: Record<string, CriterionData> = {};
    criteria.forEach((c) => {
      data[c.id] = { score: 0, notes: "", evidences: [], customSubEvidences: [] };
    });
    setCriteriaData(data);
  };

  const handleSelectJob = (job: typeof JOB_TYPES[0]) => {
    setSelectedJob(job);
    setCustomCriteria([]);
    initCriteriaData(job.criteria);
    setStep("criteria-list");
  };

  const updateScore = (criterionId: string, score: number) => {
    setCriteriaData((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], score } }));
  };

  const addEvidence = (criterionId: string, subEvidenceId: string, type: EvidenceType = "text") => {
    const ev = createEmptyEvidence(subEvidenceId);
    ev.type = type;
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, ev] },
    }));
  };

  const removeEvidence = (criterionId: string, evidenceId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: prev[criterionId].evidences.filter((e) => e.id !== evidenceId) },
    }));
  };

  const updateEvidence = (criterionId: string, evidenceId: string, updates: Partial<EvidenceItem>) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: prev[criterionId].evidences.map((e) => (e.id === evidenceId ? { ...e, ...updates } : e)) },
    }));
  };

  const updateFormField = (criterionId: string, evidenceId: string, fieldId: string, value: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: prev[criterionId].evidences.map((e) =>
          e.id === evidenceId ? { ...e, formData: { ...e.formData, [fieldId]: value } } : e
        ),
      },
    }));
  };

  const addCustomSubEvidence = (criterionId: string) => {
    if (!newSubTitle.trim()) return;
    const newSub: SubEvidence = {
      id: `custom_${Date.now()}`, title: newSubTitle.trim(),
      description: "قسم فرعي مخصص", type: "both", isCustom: true,
      formFields: [{ id: "content", label: "المحتوى", type: "textarea" as const, placeholder: "أدخل المحتوى..." }],
    };
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], customSubEvidences: [...prev[criterionId].customSubEvidences, newSub] },
    }));
    setNewSubTitle("");
    setShowAddSub(null);
  };

  const addCustomMainSection = () => {
    if (!newMainSectionTitle.trim()) return;
    const newCriterion: Criterion = {
      id: `custom_main_${Date.now()}`,
      title: newMainSectionTitle.trim(),
      maxScore: 5,
      description: newMainSectionDesc.trim() || "قسم رئيسي مخصص",
      subEvidences: [{ id: `custom_main_${Date.now()}_sub1`, title: "شاهد عام", description: "شاهد عام", type: "both" as const, formFields: [{ id: "content", label: "المحتوى", type: "textarea" as const, placeholder: "أدخل التفاصيل..." }] }],
    };
    setCustomCriteria(prev => [...prev, newCriterion]);
    setCriteriaData(prev => ({ ...prev, [newCriterion.id]: { score: 0, notes: "", evidences: [], customSubEvidences: [] } }));
    setNewMainSectionTitle("");
    setNewMainSectionDesc("");
    setShowAddMainSection(false);
  };

  const handleFileUpload = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeUploadRef.current) return;
    const { criterionId, subEvidenceId } = activeUploadRef.current;
    const reader = new FileReader();
    reader.onload = () => {
      const isImage = file.type.startsWith("image/");
      const isVideo = file.type.startsWith("video/");
      const newEv = createEmptyEvidence(subEvidenceId);
      newEv.type = isImage ? "image" : isVideo ? "video" : "file";
      newEv.fileData = reader.result as string;
      newEv.fileName = file.name;
      newEv.text = file.name;
      newEv.displayAs = isImage ? "image" : "qr";
      setCriteriaData((prev) => ({
        ...prev,
        [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, newEv] },
      }));
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  }, []);

  const triggerFileUpload = (criterionId: string, subEvidenceId: string) => {
    activeUploadRef.current = { criterionId, subEvidenceId };
    fileInputRef.current?.click();
  };

  // ===== AI API Call via tRPC =====
  const callAI = async (criterionId: string, subId: string, userPrompt: string) => {
    const key = `${criterionId}_${subId}`;
    setAiLoading(key);
    try {
      const currentCrit = allCriteria.find(c => c.id === criterionId);
      const allSubs = [...(currentCrit?.subEvidences || []), ...(criteriaData[criterionId]?.customSubEvidences || [])];
      const currentSub = allSubs.find(s => s.id === subId);

      const result = await suggestMutation.mutateAsync({
        prompt: userPrompt || `اقترح شاهد أداء وظيفي لبند "${currentCrit?.title}" - ${currentSub?.title}`,
        context: `الوظيفة: ${selectedJob?.title}, البند: ${currentCrit?.title}, الشاهد الفرعي: ${currentSub?.title}`,
      });
      if (result.content) {
        setAiChat((prev) => ({ ...prev, [key]: [...(prev[key] || []), result.content] }));
      }
    } catch (err) {
      setAiChat((prev) => ({ ...prev, [key]: [...(prev[key] || []), "حدث خطأ في الاتصال بالذكاء الاصطناعي. يرجى المحاولة مرة أخرى."] }));
    }
    setAiLoading(null);
    setAiPrompt("");
  };

  const applyAIText = (criterionId: string, subId: string, text: string) => {
    const ev = createEmptyEvidence(subId);
    ev.text = text;
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, ev] },
    }));
  };

  const fillFormWithAI = async (criterionId: string, subId: string, evId: string, fields: FormField[]) => {
    const key = `fill_${evId}`;
    setAiLoading(key);
    try {
      const currentCrit = allCriteria.find(c => c.id === criterionId);
      const allSubs = [...(currentCrit?.subEvidences || []), ...(criteriaData[criterionId]?.customSubEvidences || [])];
      const currentSub = allSubs.find(s => s.id === subId);

      const result = await fillFormMutation.mutateAsync({
        jobTitle: selectedJob?.title || "",
        criterionName: currentCrit?.title || "",
        subEvidenceName: currentSub?.title || "",
        formFields: fields.map(f => ({ id: f.id, label: f.label, type: f.type })),
      });
      if (result.success && result.filledData) {
        Object.entries(result.filledData).forEach(([fieldId, value]) => {
          updateFormField(criterionId, evId, fieldId, String(value));
        });
      }
    } catch { /* ignore errors */ }
    setAiLoading(null);
  };

  const improveFieldText = async (criterionId: string, evId: string, fieldId: string, currentText: string) => {
    if (!currentText.trim()) return;
    const key = `improve_${evId}_${fieldId}`;
    setAiLoading(key);
    try {
      const result = await improveMutation.mutateAsync({
        text: currentText,
        context: `شاهد أداء وظيفي - ${selectedJob?.title}`,
      });
      if (result.improved) {
        updateFormField(criterionId, evId, fieldId, result.improved);
      }
    } catch { /* ignore */ }
    setAiLoading(null);
  };

  const saveReport = () => {
    const data = { personalInfo, criteriaData, jobId: selectedJob?.id, themeId: selectedTheme.id, customCriteria };
    localStorage.setItem(`sers_perf_${personalInfo.name || "draft"}`, JSON.stringify(data));
    import("sonner").then(({ toast }) => toast.success("تم حفظ البيانات بنجاح!"));
  };

  const totalScore = Object.values(criteriaData).reduce((sum, c) => sum + c.score, 0);
  const maxScore = allCriteria.length * 5;
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
    await exportToPDF("preview-content", `شواهد_الأداء_${personalInfo.name || "مستند"}.pdf`);
    setIsExporting(false);
  };

  const currentCriterion = allCriteria[currentCriterionIndex];

  // ===== Render Evidence Item =====
  const renderEvidenceItem = (ev: EvidenceItem, criterionId: string) => (
    <motion.div key={ev.id} initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}
      className="bg-gray-50 rounded-xl p-4 border border-gray-200 group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          {ev.type === 'text' && <Type className="w-4 h-4 text-gray-500" />}
          {ev.type === 'image' && <Image className="w-4 h-4 text-blue-500" />}
          {ev.type === 'link' && <LinkIcon className="w-4 h-4 text-purple-500" />}
          {ev.type === 'file' && <FileText className="w-4 h-4 text-orange-500" />}
          {ev.type === 'video' && <Video className="w-4 h-4 text-red-500" />}
          <span className="text-xs font-medium text-gray-500">
            {ev.type === 'text' ? 'نص' : ev.type === 'image' ? 'صورة' : ev.type === 'link' ? 'رابط' : ev.type === 'file' ? 'ملف' : 'فيديو'}
          </span>
          {ev.fileName && <span className="text-xs text-gray-400">({ev.fileName})</span>}
        </div>
        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          {ev.type === 'image' && (
            <button onClick={() => updateEvidence(criterionId, ev.id, { displayAs: ev.displayAs === 'image' ? 'qr' : 'image' })}
              className={`p-1.5 rounded-lg text-xs ${ev.displayAs === 'qr' ? 'bg-violet-100 text-violet-600' : 'bg-blue-100 text-blue-600'}`}
              title={ev.displayAs === 'image' ? 'تحويل لباركود' : 'عرض كصورة'}>
              {ev.displayAs === 'image' ? <QrCode className="w-3.5 h-3.5" /> : <Image className="w-3.5 h-3.5" />}
            </button>
          )}
          <button onClick={() => removeEvidence(criterionId, ev.id)} className="p-1.5 rounded-lg text-red-400 hover:text-red-600 hover:bg-red-50">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {ev.type === 'text' && !ev.formData && (
        <textarea value={ev.text} onChange={(e) => updateEvidence(criterionId, ev.id, { text: e.target.value })}
          placeholder="اكتب نص الشاهد هنا..." rows={2}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
      )}

      {ev.type === 'link' && (
        <input type="url" value={ev.link} onChange={(e) => updateEvidence(criterionId, ev.id, { link: e.target.value })}
          placeholder="https://example.com" dir="ltr"
          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
      )}

      {(ev.type === 'image' || ev.type === 'video' || ev.type === 'file') && ev.fileData && (
        <div className="mt-2">
          {ev.type === 'image' && ev.displayAs === 'image' && (
            <img src={ev.fileData} alt="" className="max-h-48 rounded-lg border border-gray-200" />
          )}
          {ev.type === 'image' && ev.displayAs === 'qr' && (
            <div className="flex items-center gap-3 bg-violet-50 p-3 rounded-lg">
              <img src={generateQRDataURL(ev.fileData.substring(0, 200))} alt="QR" className="w-16 h-16" />
              <span className="text-xs text-violet-600">سيظهر كباركود QR عند الطباعة</span>
            </div>
          )}
          {ev.type === 'video' && (
            <div className="flex items-center gap-3 bg-red-50 p-3 rounded-lg">
              <Video className="w-8 h-8 text-red-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">{ev.fileName}</p>
                <p className="text-xs text-red-500">سيتحول لباركود QR عند الطباعة</p>
              </div>
            </div>
          )}
          {ev.type === 'file' && (
            <div className="flex items-center gap-3 bg-orange-50 p-3 rounded-lg">
              <FileText className="w-8 h-8 text-orange-500" />
              <div>
                <p className="text-sm font-medium text-gray-700">{ev.fileName}</p>
                <p className="text-xs text-orange-500">سيتحول لباركود QR عند الطباعة</p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );

  // ===== Step 1: اختيار الوظيفة =====
  if (step === "select") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
            </button>
          </div>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4"><span className="text-3xl">📊</span></div>
            <h1 className="text-3xl font-black text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>شواهد الأداء الوظيفي</h1>
            <p className="text-gray-500 max-w-lg mx-auto text-sm">اختر الوظيفة لبدء إعداد الشواهد. كل بند يحتوي على شواهد فرعية مع فورمات تفاعلية وذكاء اصطناعي حقيقي.</p>
            <div className="flex items-center justify-center gap-2 mt-3">
              <Sparkles className="w-4 h-4 text-violet-500" />
              <span className="text-sm text-violet-600 font-medium">الذكاء الاصطناعي مفعّل تلقائياً</span>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {JOB_TYPES.map((job, i) => (
              <motion.button key={job.id} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}
                whileHover={{ y: -4, boxShadow: "0 12px 30px rgba(0,0,0,0.08)" }}
                onClick={() => handleSelectJob(job)}
                className="bg-white rounded-xl p-5 border border-gray-200 text-right hover:border-emerald-300 transition-all">
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

  // ===== Step 2: قائمة البنود =====
  if (step === "criteria-list") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("select")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm">
                <ArrowLeft className="w-4 h-4" />تغيير الوظيفة
              </button>
              <button onClick={saveReport} className="flex items-center gap-1.5 text-blue-600 text-sm"><Save className="w-4 h-4" />حفظ</button>
            </div>
            <div className="flex items-center gap-4">
              <div className="text-left">
                <div className="text-2xl font-black" style={{ color: getGrade(percentage).color }}>{percentage}%</div>
                <div className="text-xs text-gray-500">{getGrade(percentage).label} · {totalScore}/{maxScore}</div>
              </div>
              <button onClick={() => setStep("final-review")} className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:bg-emerald-700">
                <Eye className="w-4 h-4" />التقييم النهائي
              </button>
            </div>
          </div>

          <h1 className="text-2xl font-black text-gray-900 mb-1" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            {selectedJob?.icon} {selectedJob?.title}
          </h1>
          <p className="text-sm text-gray-500 mb-6">اضغط على أي بند لفتح الشواهد الفرعية</p>

          {/* البيانات الشخصية */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <h2 className="font-bold text-gray-800 mb-4 text-base flex items-center gap-2"><FileText className="w-5 h-5 text-emerald-600" />البيانات الأساسية</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                { key: "name", label: "الاسم الكامل", placeholder: "أدخل الاسم الرباعي" },
                { key: "school", label: "المدرسة", placeholder: "اسم المدرسة" },
                { key: "year", label: "العام الدراسي", placeholder: "١٤٤٧هـ" },
                { key: "semester", label: "الفصل الدراسي", placeholder: "الفصل الدراسي الثاني" },
                { key: "evaluator", label: "اسم المقيّم", placeholder: "اسم المقيّم" },
                { key: "evaluatorRole", label: "صفة المقيّم", placeholder: "مدير المدرسة" },
                { key: "date", label: "تاريخ التقييم", placeholder: "١٤٤٧/٠٦/١٥" },
              ].map((field) => (
                <div key={field.key}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">{field.label}</label>
                  <input type="text" value={(personalInfo as any)[field.key]}
                    onChange={(e) => setPersonalInfo((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    placeholder={field.placeholder}
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
                </div>
              ))}
            </div>
          </div>

          {/* قائمة البنود */}
          <div className="space-y-3">
            {allCriteria.map((criterion, index) => {
              const data = criteriaData[criterion.id];
              if (!data) return null;
              const evidenceCount = data.evidences.length;
              const isCustom = criterion.id.startsWith("custom_main_");
              return (
                <motion.button key={criterion.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
                  onClick={() => { setCurrentCriterionIndex(index); setStep("criterion-detail"); }}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all text-right group">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-lg flex items-center justify-center font-bold text-sm shrink-0 group-hover:bg-emerald-100 ${isCustom ? 'bg-violet-50 text-violet-700' : 'bg-emerald-50 text-emerald-700'}`}>
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                        {criterion.title} {isCustom && <span className="text-xs text-violet-500 mr-1">(مخصص)</span>}
                      </h3>
                      <p className="text-xs text-gray-500">{criterion.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <div className="text-lg font-black" style={{ color: data.score >= 4 ? '#16A34A' : data.score >= 3 ? '#CA8A04' : '#9CA3AF' }}>{data.score}</div>
                        <div className="text-[10px] text-gray-400">من {criterion.maxScore}</div>
                      </div>
                      <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-1 rounded-md">{evidenceCount} شاهد</span>
                      <ChevronLeft className="w-5 h-5 text-gray-300 group-hover:text-emerald-500" />
                    </div>
                  </div>
                </motion.button>
              );
            })}
          </div>

          {/* إضافة قسم رئيسي جديد */}
          <div className="mt-4">
            {showAddMainSection ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-violet-300 p-5">
                <h4 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-2"><PlusCircle className="w-4 h-4" />إضافة بند رئيسي جديد</h4>
                <div className="space-y-3">
                  <input type="text" value={newMainSectionTitle} onChange={(e) => setNewMainSectionTitle(e.target.value)}
                    placeholder="اسم البند الرئيسي الجديد..."
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                  <input type="text" value={newMainSectionDesc} onChange={(e) => setNewMainSectionDesc(e.target.value)}
                    placeholder="وصف مختصر (اختياري)..."
                    className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                  <div className="flex gap-2">
                    <button onClick={addCustomMainSection}
                      className="px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">إضافة</button>
                    <button onClick={() => { setShowAddMainSection(false); setNewMainSectionTitle(""); setNewMainSectionDesc(""); }}
                      className="px-3 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200"><X className="w-4 h-4" /></button>
                  </div>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddMainSection(true)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors text-sm">
                <PlusCircle className="w-5 h-5" />إضافة بند رئيسي جديد
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== Step 3: تفاصيل البند =====
  if (step === "criterion-detail" && currentCriterion) {
    const data = criteriaData[currentCriterion.id] || { score: 0, notes: "", evidences: [], customSubEvidences: [] };
    const allSubEvidences = [...(currentCriterion.subEvidences || []), ...(data.customSubEvidences || [])];

    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <input type="file" ref={fileInputRef} className="hidden" accept="image/*,video/*,.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx" onChange={handleFileUpload} />
        <div className="max-w-4xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("criteria-list")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
                <ArrowRight className="w-4 h-4" />العودة للبنود
              </button>
              <div className="flex gap-1">
                <button disabled={currentCriterionIndex === 0} onClick={() => setCurrentCriterionIndex(i => i - 1)} className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"><ArrowRight className="w-4 h-4" /></button>
                <button disabled={currentCriterionIndex === allCriteria.length - 1} onClick={() => setCurrentCriterionIndex(i => i + 1)} className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"><ArrowLeft className="w-4 h-4" /></button>
              </div>
            </div>
            <span className="text-sm text-gray-500">البند {currentCriterionIndex + 1} من {allCriteria.length}</span>
          </div>

          {/* Criterion Header */}
          <div className="bg-white rounded-xl border border-gray-200 p-5 mb-5">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center text-emerald-700 font-bold text-sm">{currentCriterionIndex + 1}</span>
                  <h1 className="text-xl font-black text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>{currentCriterion.title}</h1>
                </div>
                <p className="text-sm text-gray-500 mr-10">{currentCriterion.description}</p>
              </div>
              <div className="text-center">
                <label className="text-xs text-gray-500 block mb-1">الدرجة</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map((s) => (
                    <button key={s} onClick={() => updateScore(currentCriterion.id, s)}
                      className={`w-9 h-9 rounded-lg text-sm font-bold transition-all ${data.score >= s ? 'bg-emerald-600 text-white shadow-md' : 'bg-gray-100 text-gray-400 hover:bg-gray-200'}`}>{s}</button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Sub-Evidences */}
          <div className="space-y-4">
            {allSubEvidences.map((sub) => {
              const subEvidences = data.evidences.filter(e => e.subEvidenceId === sub.id);
              const isExpanded = expandedSubEvidence === sub.id;
              const aiKey = `${currentCriterion.id}_${sub.id}`;
              const aiMessages = aiChat[aiKey] || [];
              const hasFormEvidence = subEvidences.some(e => e.formData && Object.keys(e.formData).length > 0);

              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Sub Header */}
                  <div role="button" tabIndex={0} onClick={() => {
                    setExpandedSubEvidence(isExpanded ? null : sub.id);
                    if (!isExpanded && (sub.type === 'report' || sub.type === 'both') && sub.formFields && !hasFormEvidence) {
                      addEvidence(currentCriterion.id, sub.id, "text");
                    }
                  }}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedSubEvidence(isExpanded ? null : sub.id); }}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-right cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${sub.type === 'report' ? 'bg-blue-50 text-blue-600' : sub.type === 'upload' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                        {sub.type === 'report' ? <FileText className="w-4 h-4" /> : sub.type === 'upload' ? <Upload className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm">{sub.title} {sub.isCustom && <span className="text-xs text-violet-500 mr-1">(مخصص)</span>}</h3>
                        <p className="text-xs text-gray-500">{sub.description} · {subEvidences.length} شاهد</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 overflow-hidden">
                        <div className="p-4 space-y-4">
                          {/* Form Fields */}
                          {(sub.type === 'report' || sub.type === 'both') && sub.formFields && (() => {
                            const formEv = subEvidences.find(e => e.formData !== undefined);
                            if (!formEv) return null;
                            return (
                              <div className="bg-blue-50/50 rounded-xl p-4 border border-blue-100">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-sm font-bold text-gray-700 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" />نموذج التقرير</h4>
                                  <button onClick={() => fillFormWithAI(currentCriterion.id, sub.id, formEv.id, sub.formFields!)}
                                    disabled={aiLoading === `fill_${formEv.id}`}
                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium hover:bg-violet-200 disabled:opacity-50">
                                    {aiLoading === `fill_${formEv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                    تعبئة بالذكاء الاصطناعي
                                  </button>
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {sub.formFields.map((field: FormField) => (
                                    <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                      <div className="flex items-center justify-between mb-1">
                                        <label className="block text-xs font-medium text-gray-600">
                                          {field.label} {field.required && <span className="text-red-500">*</span>}
                                        </label>
                                        {field.type === 'textarea' && formEv.formData?.[field.id] && (
                                          <button onClick={() => improveFieldText(currentCriterion.id, formEv.id, field.id, formEv.formData?.[field.id] || '')}
                                            disabled={aiLoading === `improve_${formEv.id}_${field.id}`}
                                            className="text-[10px] text-violet-600 hover:text-violet-700 flex items-center gap-1">
                                            {aiLoading === `improve_${formEv.id}_${field.id}` ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
                                            تحسين
                                          </button>
                                        )}
                                      </div>
                                      {field.type === 'textarea' ? (
                                        <textarea value={formEv.formData?.[field.id] || ''} onChange={(e) => updateFormField(currentCriterion.id, formEv.id, field.id, e.target.value)}
                                          placeholder={field.placeholder} rows={3}
                                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white" />
                                      ) : field.type === 'select' ? (
                                        <select value={formEv.formData?.[field.id] || ''} onChange={(e) => updateFormField(currentCriterion.id, formEv.id, field.id, e.target.value)}
                                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white">
                                          <option value="">اختر...</option>
                                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : (
                                        <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                          value={formEv.formData?.[field.id] || ''} onChange={(e) => updateFormField(currentCriterion.id, formEv.id, field.id, e.target.value)}
                                          placeholder={field.placeholder}
                                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-white" />
                                      )}
                                    </div>
                                  ))}
                                </div>
                              </div>
                            );
                          })()}

                          {/* Evidences List */}
                          {subEvidences.filter(e => {
                            if (e.formData && Object.keys(e.formData).some(k => e.formData![k])) return false;
                            if (e.type === 'text' && !e.text && e.formData) return false;
                            return true;
                          }).length > 0 && (
                            <div className="space-y-2">
                              {subEvidences.filter(e => {
                                if (e.formData && Object.keys(e.formData).some(k => e.formData![k])) return false;
                                if (e.type === 'text' && !e.text && e.formData) return false;
                                return true;
                              }).map((ev) => renderEvidenceItem(ev, currentCriterion.id))}
                            </div>
                          )}

                          {/* Add Evidence Button */}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => addEvidence(currentCriterion.id, sub.id, "text")}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-emerald-300 text-emerald-600 hover:bg-emerald-50 text-xs font-medium transition-colors">
                              <Plus className="w-4 h-4" />إضافة شاهد نصي
                            </button>
                            <button onClick={() => triggerFileUpload(currentCriterion.id, sub.id)}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-blue-300 text-blue-600 hover:bg-blue-50 text-xs font-medium transition-colors">
                              <Upload className="w-4 h-4" />رفع صورة / ملف / فيديو
                            </button>
                            <button onClick={() => addEvidence(currentCriterion.id, sub.id, "link")}
                              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl border-2 border-dashed border-purple-300 text-purple-600 hover:bg-purple-50 text-xs font-medium transition-colors">
                              <LinkIcon className="w-4 h-4" />إضافة رابط
                            </button>
                          </div>

                          {/* AI Chat Section */}
                          <div className="bg-violet-50/50 rounded-xl p-4 border border-violet-100">
                            <div className="flex items-center gap-2 mb-3">
                              <Bot className="w-4 h-4 text-violet-600" />
                              <span className="text-sm font-bold text-violet-700">مساعد الذكاء الاصطناعي</span>
                              <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full">مفعّل</span>
                            </div>
                            {aiMessages.length > 0 && (
                              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                {aiMessages.map((msg, idx) => (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-violet-200">
                                    <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg}</p>
                                    <button onClick={() => applyAIText(currentCriterion.id, sub.id, msg)}
                                      className="mt-2 text-xs bg-violet-600 text-white px-3 py-1.5 rounded-md hover:bg-violet-700">
                                      استخدام كشاهد
                                    </button>
                                  </div>
                                ))}
                              </div>
                            )}
                            <div className="flex gap-2">
                              <input type="text" value={aiPrompt} onChange={(e) => setAiPrompt(e.target.value)}
                                placeholder={`اطلب اقتراح لـ "${sub.title}"...`}
                                onKeyDown={(e) => { if (e.key === 'Enter') callAI(currentCriterion.id, sub.id, aiPrompt); }}
                                className="flex-1 px-3 py-2.5 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 bg-white" />
                              <button onClick={() => callAI(currentCriterion.id, sub.id, aiPrompt)}
                                disabled={aiLoading === aiKey}
                                className="px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700 disabled:opacity-50 flex items-center gap-1.5">
                                {aiLoading === aiKey ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              );
            })}
          </div>

          {/* Add Custom Sub-Evidence */}
          <div className="mt-4">
            {showAddSub === currentCriterion.id ? (
              <div className="bg-white rounded-xl border-2 border-dashed border-violet-300 p-4">
                <h4 className="text-sm font-bold text-violet-700 mb-3 flex items-center gap-2"><PlusCircle className="w-4 h-4" />إضافة قسم فرعي جديد</h4>
                <div className="flex gap-2">
                  <input type="text" value={newSubTitle} onChange={(e) => setNewSubTitle(e.target.value)}
                    placeholder="اسم القسم الفرعي الجديد..."
                    className="flex-1 px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20" />
                  <button onClick={() => addCustomSubEvidence(currentCriterion.id)}
                    className="px-4 py-2.5 rounded-lg bg-violet-600 text-white text-sm font-medium hover:bg-violet-700">إضافة</button>
                  <button onClick={() => { setShowAddSub(null); setNewSubTitle(""); }}
                    className="px-3 py-2.5 rounded-lg bg-gray-100 text-gray-600 text-sm hover:bg-gray-200"><X className="w-4 h-4" /></button>
                </div>
              </div>
            ) : (
              <button onClick={() => setShowAddSub(currentCriterion.id)}
                className="w-full flex items-center justify-center gap-2 p-4 rounded-xl border-2 border-dashed border-gray-300 text-gray-500 hover:border-violet-400 hover:text-violet-600 transition-colors text-sm">
                <PlusCircle className="w-5 h-5" />إضافة قسم فرعي جديد
              </button>
            )}
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between mt-6 bg-white rounded-xl p-4 border border-gray-200">
            <button disabled={currentCriterionIndex === 0} onClick={() => setCurrentCriterionIndex(i => i - 1)}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-gray-100 text-gray-700 text-sm disabled:opacity-30">
              <ArrowRight className="w-4 h-4" />البند السابق
            </button>
            {currentCriterionIndex < allCriteria.length - 1 ? (
              <button onClick={() => setCurrentCriterionIndex(i => i + 1)}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">
                البند التالي<ArrowLeft className="w-4 h-4" />
              </button>
            ) : (
              <button onClick={() => setStep('final-review')}
                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm hover:bg-emerald-700">
                <BarChart3 className="w-4 h-4" />التقييم النهائي
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  // ===== Step 4: التقييم النهائي =====
  if (step === 'final-review') {
    const grade = getGrade(percentage);
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-4 md:p-6" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setStep('criteria-list')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm bg-white px-3 py-2 rounded-lg border border-gray-200">
              <ArrowRight className="w-4 h-4" />العودة للبنود
            </button>
            <div className="flex gap-2">
              <button onClick={saveReport} className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700"><Save className="w-4 h-4" />حفظ</button>
              <button onClick={() => setStep('preview')} className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700"><Eye className="w-4 h-4" />معاينة وتصدير</button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-5 text-center">
            <h1 className="text-2xl font-black text-gray-900 mb-4" style={{ fontFamily: "'Tajawal', sans-serif" }}>ملخص التقييم النهائي</h1>
            <div className="flex items-center justify-center gap-8">
              <div>
                <div className="text-5xl font-black" style={{ color: grade.color }}>{percentage}%</div>
                <div className="text-lg font-bold mt-1" style={{ color: grade.color }}>{grade.label}</div>
              </div>
              <div className="text-right">
                <p className="text-sm text-gray-500">المجموع: <strong className="text-gray-800">{totalScore}</strong> من <strong className="text-gray-800">{maxScore}</strong></p>
                <p className="text-sm text-gray-500">الوظيفة: <strong className="text-gray-800">{selectedJob?.title}</strong></p>
                <p className="text-sm text-gray-500">الاسم: <strong className="text-gray-800">{personalInfo.name || '—'}</strong></p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="text-right text-xs font-bold text-gray-600 p-3">م</th>
                  <th className="text-right text-xs font-bold text-gray-600 p-3">البند</th>
                  <th className="text-center text-xs font-bold text-gray-600 p-3">الدرجة</th>
                  <th className="text-center text-xs font-bold text-gray-600 p-3">الشواهد</th>
                </tr>
              </thead>
              <tbody>
                {allCriteria.map((c, i) => {
                  const d = criteriaData[c.id];
                  return (
                    <tr key={c.id} className="border-t border-gray-100 hover:bg-gray-50 cursor-pointer" onClick={() => { setCurrentCriterionIndex(i); setStep('criterion-detail'); }}>
                      <td className="p-3 text-sm text-gray-500">{i + 1}</td>
                      <td className="p-3 text-sm font-medium text-gray-800">{c.title}</td>
                      <td className="p-3 text-center">
                        <span className={`inline-block px-2 py-1 rounded-md text-sm font-bold ${d?.score >= 4 ? 'bg-green-100 text-green-700' : d?.score >= 3 ? 'bg-yellow-100 text-yellow-700' : 'bg-gray-100 text-gray-500'}`}>
                          {d?.score || 0}/{c.maxScore}
                        </span>
                      </td>
                      <td className="p-3 text-center text-sm text-gray-500">{d?.evidences.length || 0}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-5 mt-5">
            <h3 className="font-bold text-gray-800 mb-3 text-sm">اختر ثيم التصدير</h3>
            <div className="flex flex-wrap gap-2">
              {THEMES.map((t) => (
                <button key={t.id} onClick={() => setSelectedTheme(t)}
                  className={`px-4 py-2 rounded-lg text-sm border transition-all ${selectedTheme.id === t.id ? 'border-emerald-500 bg-emerald-50 text-emerald-700 font-bold' : 'border-gray-200 text-gray-600 hover:border-gray-300'}`}>
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ===== Step 5: المعاينة والتصدير =====
  if (step === 'preview') {
    const grade = getGrade(percentage);
    const theme = selectedTheme;
    return (
      <div className="min-h-screen bg-gray-100 p-4" dir="rtl">
        <div className="max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-200 sticky top-2 z-10">
            <button onClick={() => setStep('final-review')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm">
              <ArrowRight className="w-4 h-4" />العودة
            </button>
            <div className="flex gap-2">
              <button onClick={handleExportPDF} disabled={isExporting}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
                {isExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                {isExporting ? 'جاري التصدير...' : 'تحميل PDF'}
              </button>
              <button onClick={() => printElement('preview-content')}
                className="flex items-center gap-1.5 bg-blue-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-blue-700">
                <Printer className="w-4 h-4" />طباعة
              </button>
            </div>
          </div>

          {/* Preview Content */}
          <div id="preview-content" className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
            {/* Header */}
            <div style={{ background: theme.headerBg, color: theme.headerText, padding: '2rem', textAlign: 'center' }}>
              <p className="text-sm opacity-80 mb-1" style={{ whiteSpace: 'pre-line' }}>{personalInfo.department}</p>
              <h1 className="text-2xl font-black mb-1">شواهد الأداء الوظيفي</h1>
              <p className="text-lg font-bold">{selectedJob?.title}</p>
              <p className="text-sm opacity-80 mt-1">{personalInfo.year} - {personalInfo.semester}</p>
            </div>

            {/* Personal Info */}
            <div className="p-6 border-b" style={{ borderColor: theme.borderColor }}>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div><span className="text-gray-500">الاسم:</span> <strong>{personalInfo.name || '—'}</strong></div>
                <div><span className="text-gray-500">المدرسة:</span> <strong>{personalInfo.school || '—'}</strong></div>
                <div><span className="text-gray-500">المقيّم:</span> <strong>{personalInfo.evaluator || '—'}</strong></div>
                <div><span className="text-gray-500">التاريخ:</span> <strong>{personalInfo.date || '—'}</strong></div>
              </div>
            </div>

            {/* Criteria Table */}
            <div className="p-6">
              <table className="w-full border-collapse text-sm" style={{ borderColor: theme.borderColor }}>
                <thead>
                  <tr style={{ background: theme.accent, color: '#fff' }}>
                    <th className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>م</th>
                    <th className="p-2 border text-right" style={{ borderColor: theme.borderColor }}>البند</th>
                    <th className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>الدرجة</th>
                  </tr>
                </thead>
                <tbody>
                  {allCriteria.map((c, i) => (
                    <tr key={c.id} className={i % 2 === 0 ? '' : 'bg-gray-50'}>
                      <td className="p-2 border text-center" style={{ borderColor: theme.borderColor }}>{i + 1}</td>
                      <td className="p-2 border" style={{ borderColor: theme.borderColor }}>{c.title}</td>
                      <td className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{criteriaData[c.id]?.score || 0}/{c.maxScore}</td>
                    </tr>
                  ))}
                  <tr style={{ background: theme.accent, color: '#fff' }}>
                    <td colSpan={2} className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>المجموع</td>
                    <td className="p-2 border text-center font-bold" style={{ borderColor: theme.borderColor }}>{totalScore}/{maxScore}</td>
                  </tr>
                </tbody>
              </table>

              {/* Grade */}
              <div className="text-center mt-6 p-4 rounded-xl" style={{ background: `${grade.color}15` }}>
                <p className="text-sm text-gray-600">التقدير النهائي</p>
                <p className="text-3xl font-black" style={{ color: grade.color }}>{percentage}% - {grade.label}</p>
              </div>

              {/* Evidences */}
              {allCriteria.map((c, i) => {
                const d = criteriaData[c.id];
                if (!d || d.evidences.length === 0) return null;
                return (
                  <div key={c.id} className="mt-6 page-break-inside-avoid">
                    <h3 className="font-bold text-sm mb-2" style={{ color: theme.accent }}>{i + 1}. {c.title}</h3>
                    <div className="space-y-2">
                      {d.evidences.map((ev) => (
                        <div key={ev.id} className="p-3 rounded-lg border" style={{ borderColor: theme.borderColor }}>
                          {ev.type === 'text' && ev.text && <p className="text-sm">{ev.text}</p>}
                          {ev.type === 'link' && ev.link && (
                            <div className="flex items-center gap-3">
                              <img src={generateQRDataURL(ev.link)} alt="QR" className="w-16 h-16" />
                              <span className="text-xs text-gray-500">{ev.link}</span>
                            </div>
                          )}
                          {ev.type === 'image' && ev.fileData && (
                            ev.displayAs === 'image'
                              ? <img src={ev.fileData} alt="" className="max-h-40 rounded" />
                              : <div className="flex items-center gap-3">
                                  <img src={generateQRDataURL(ev.fileData.substring(0, 200))} alt="QR" className="w-16 h-16" />
                                  <span className="text-xs text-gray-500">{ev.fileName}</span>
                                </div>
                          )}
                          {(ev.type === 'video' || ev.type === 'file') && ev.fileData && (
                            <div className="flex items-center gap-3">
                              <img src={generateQRDataURL(ev.fileName || 'file')} alt="QR" className="w-16 h-16" />
                              <span className="text-xs text-gray-500">{ev.fileName}</span>
                            </div>
                          )}
                          {ev.formData && Object.entries(ev.formData).some(([, v]) => v) && (
                            <div className="text-sm space-y-1">
                              {Object.entries(ev.formData).filter(([, v]) => v).map(([key, val]) => (
                                <p key={key}><span className="text-gray-500">{key}:</span> {val}</p>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}

              {/* Signatures */}
              <div className="mt-10 grid grid-cols-2 gap-8 text-center text-sm">
                <div>
                  <p className="text-gray-500 mb-8">توقيع المقيّم</p>
                  <div className="border-t border-gray-300 pt-2">{personalInfo.evaluator || '____________'}</div>
                  <p className="text-xs text-gray-400 mt-1">{personalInfo.evaluatorRole}</p>
                </div>
                <div>
                  <p className="text-gray-500 mb-8">توقيع الموظف</p>
                  <div className="border-t border-gray-300 pt-2">{personalInfo.name || '____________'}</div>
                  <p className="text-xs text-gray-400 mt-1">{selectedJob?.title}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
