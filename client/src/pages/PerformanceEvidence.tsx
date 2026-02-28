/**
 * شواهد الأداء الوظيفي - النسخة النهائية المتقدمة
 * ✅ ذكاء اصطناعي API حقيقي (OpenAI compatible)
 * ✅ إضافة شاهد واحد بزر واحد (بدل 5 خانات)
 * ✅ إضافة أقسام فرعية جديدة من المستخدم
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
  Bot, Lightbulb, ChevronLeft, Star, BarChart3, Layers,
  Settings, Loader2, Send, PlusCircle, GripVertical
} from "lucide-react";
import { useLocation } from "wouter";
import { exportToPDF, printElement } from "@/lib/pdf-export";
import { generateQRDataURL } from "@/lib/qr-utils";

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

// ===== البنود الحقيقية لتقييم أداء المعلم (12 بند) =====
const TEACHER_CRITERIA = [
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
        aiSuggestions: ["تقرير إذاعة مدرسية", "توثيق فقرات الإذاعة"],
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
        aiSuggestions: ["تقرير نشاط لاصفي", "توثيق الأنشطة"],
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
        aiSuggestions: ["تقرير حصة انتظار"],
      },
      {
        id: "t1-4", title: "المشاركة في لجان المدرسة", description: "توثيق المشاركة في اللجان",
        type: "report" as const,
        formFields: [
          { id: "committee_name", label: "اسم اللجنة", type: "text" as const, placeholder: "مثال: لجنة الاختبارات", required: true },
          { id: "role", label: "الدور في اللجنة", type: "text" as const, placeholder: "عضو / مقرر / رئيس" },
          { id: "tasks", label: "المهام المنفذة", type: "textarea" as const, placeholder: "المهام التي تم تنفيذها..." },
        ],
        aiSuggestions: ["تقرير مشاركة في لجنة"],
      },
      {
        id: "t1-5", title: "الإشراف اليومي", description: "توثيق الإشراف اليومي",
        type: "both" as const,
        formFields: [
          { id: "location", label: "مكان الإشراف", type: "select" as const, options: ["البوابة الرئيسية", "الفناء", "الممرات", "المقصف", "المصلى", "أخرى"] },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "observations", label: "الملاحظات", type: "textarea" as const, placeholder: "ملاحظات الإشراف..." },
        ],
        aiSuggestions: ["تقرير إشراف يومي"],
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
        ], aiSuggestions: ["تقرير زيارة تبادلية"] },
      { id: "t2-2", title: "محضر مجتمع التعلم المهني", description: "توثيق اجتماعات مجتمع التعلم", type: "report" as const,
        formFields: [
          { id: "topic", label: "الموضوع", type: "text" as const, required: true },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "attendees", label: "الحضور", type: "textarea" as const },
          { id: "outcomes", label: "المخرجات", type: "textarea" as const },
        ], aiSuggestions: ["محضر مجتمع تعلم مهني"] },
      { id: "t2-3", title: "بحث الدرس", description: "توثيق بحث الدرس التعاوني", type: "report" as const,
        formFields: [
          { id: "lesson", label: "عنوان الدرس", type: "text" as const, required: true },
          { id: "team", label: "فريق العمل", type: "textarea" as const },
          { id: "findings", label: "النتائج", type: "textarea" as const },
        ], aiSuggestions: ["تقرير بحث درس"] },
      { id: "t2-4", title: "شهادات الدورات التدريبية", description: "توثيق الدورات والورش", type: "upload" as const, aiSuggestions: ["شهادة دورة تدريبية"] },
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
        ], aiSuggestions: ["تقرير تواصل مع ولي أمر"] },
      { id: "t3-2", title: "تقرير مشاركة مجتمعية", description: "توثيق الشراكات المجتمعية", type: "both" as const,
        formFields: [
          { id: "activity", label: "النشاط", type: "text" as const },
          { id: "partner", label: "الجهة الشريكة", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
        ], aiSuggestions: ["تقرير مشاركة مجتمعية"] },
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
        ], aiSuggestions: ["تقرير تطبيق استراتيجية تدريسية"] },
      { id: "t4-2", title: "صور/فيديو تطبيق الاستراتيجيات", description: "توثيق بصري", type: "upload" as const, aiSuggestions: ["صور تطبيق استراتيجيات"] },
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
        ], aiSuggestions: ["خطة تحسين نتائج"] },
      { id: "t5-2", title: "مقارنة النتائج قبل وبعد", description: "مقارنة النتائج", type: "both" as const,
        formFields: [
          { id: "before", label: "النتائج قبل", type: "textarea" as const },
          { id: "after", label: "النتائج بعد", type: "textarea" as const },
          { id: "analysis", label: "التحليل", type: "textarea" as const },
        ], aiSuggestions: ["مقارنة نتائج قبل وبعد"] },
      { id: "t5-3", title: "برامج التقوية والمعالجة", description: "توثيق برامج التقوية", type: "report" as const,
        formFields: [
          { id: "program", label: "اسم البرنامج", type: "text" as const },
          { id: "target_students", label: "الطلاب المستهدفون", type: "textarea" as const },
          { id: "activities", label: "الأنشطة", type: "textarea" as const },
        ], aiSuggestions: ["تقرير برنامج تقوية"] },
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
        ], aiSuggestions: ["نموذج تحضير درس"] },
      { id: "t6-2", title: "توزيع المنهج", description: "خطة توزيع المنهج", type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "semester", label: "الفصل الدراسي", type: "text" as const },
          { id: "distribution", label: "التوزيع", type: "textarea" as const },
        ], aiSuggestions: ["توزيع منهج دراسي"] },
      { id: "t6-3", title: "خريطة نواتج التعلم", description: "خريطة المنهج", type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "outcomes", label: "نواتج التعلم", type: "textarea" as const },
        ], aiSuggestions: ["خريطة نواتج تعلم"] },
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
        ], aiSuggestions: ["تقرير توظيف تقنية تعليمية"] },
      { id: "t7-2", title: "وسائل تعليمية", description: "توثيق الوسائل التعليمية", type: "both" as const,
        formFields: [
          { id: "tool_name", label: "اسم الوسيلة", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
        ], aiSuggestions: ["وسيلة تعليمية مبتكرة"] },
    ],
  },
  {
    id: "t8", title: "تهيئة البيئة التعليمية", maxScore: 5,
    description: "توفير بيئة تعليمية محفزة وآمنة تدعم التعلم الفعال",
    subEvidences: [
      { id: "t8-1", title: "صور البيئة الصفية", description: "توثيق بصري للبيئة الصفية", type: "upload" as const, aiSuggestions: ["صور البيئة الصفية المحفزة"] },
      { id: "t8-2", title: "ركن التعلم", description: "توثيق أركان التعلم", type: "both" as const,
        formFields: [
          { id: "corner_name", label: "اسم الركن", type: "text" as const },
          { id: "description", label: "الوصف", type: "textarea" as const },
        ], aiSuggestions: ["ركن تعلم مبتكر"] },
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
        ], aiSuggestions: ["قوانين صفية"] },
      { id: "t9-2", title: "خطة السلوك الإيجابي", description: "تعزيز السلوك الإيجابي", type: "report" as const,
        formFields: [
          { id: "behaviors", label: "السلوكيات المستهدفة", type: "textarea" as const },
          { id: "reinforcement", label: "أساليب التعزيز", type: "textarea" as const },
        ], aiSuggestions: ["خطة سلوك إيجابي"] },
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
        ], aiSuggestions: ["تحليل نتائج مادة دراسية"] },
      { id: "t10-2", title: "كشف تصنيف الطلاب", description: "تصنيف حسب المستوى", type: "report" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "excellent", label: "متفوقون (90-100)", type: "textarea" as const },
          { id: "good", label: "جيد جداً (80-89)", type: "textarea" as const },
          { id: "average", label: "جيد (70-79)", type: "textarea" as const },
          { id: "weak", label: "ضعيف (أقل من 60)", type: "textarea" as const },
        ], aiSuggestions: ["كشف تصنيف طلاب"] },
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
        ], aiSuggestions: ["اختبار تشخيصي"] },
      { id: "t11-2", title: "تقويم بديل (مشروع/ملف إنجاز)", description: "أساليب تقويم بديلة", type: "both" as const,
        formFields: [
          { id: "type", label: "نوع التقويم", type: "select" as const, options: ["مشروع", "ملف إنجاز", "عرض تقديمي", "بحث", "أخرى"] },
          { id: "description", label: "الوصف", type: "textarea" as const },
          { id: "criteria", label: "معايير التقييم", type: "textarea" as const },
        ], aiSuggestions: ["تقويم بديل"] },
      { id: "t11-3", title: "سلالم التقدير (روبريك)", description: "معايير تقييم واضحة", type: "both" as const,
        formFields: [
          { id: "skill", label: "المهارة", type: "text" as const },
          { id: "levels", label: "مستويات الأداء", type: "textarea" as const },
        ], aiSuggestions: ["سلم تقدير"] },
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
        ], aiSuggestions: ["تقرير برنامج طلابي"] },
      { id: "t12-2", title: "صور الأنشطة والبرامج", description: "توثيق بصري", type: "upload" as const, aiSuggestions: ["صور أنشطة طلابية"] },
      { id: "t12-3", title: "خطة النشاط الطلابي", description: "خطة الأنشطة", type: "report" as const,
        formFields: [
          { id: "semester", label: "الفصل", type: "text" as const },
          { id: "activities", label: "الأنشطة المخططة", type: "textarea" as const },
          { id: "timeline", label: "الجدول الزمني", type: "textarea" as const },
        ], aiSuggestions: ["خطة نشاط طلابي"] },
    ],
  },
];

// ===== بنود بقية الوظائف =====
const PRINCIPAL_CRITERIA = [
  { id: "p1", title: "القيادة المدرسية", maxScore: 5, description: "قيادة المدرسة بفاعلية", subEvidences: [
    { id: "p1-1", title: "الخطة التشغيلية", type: "both" as const, description: "إعداد الخطة التشغيلية", formFields: [{ id: "plan", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["خطة تشغيلية"] },
    { id: "p1-2", title: "محاضر اجتماعات مجلس المدرسة", type: "both" as const, description: "توثيق الاجتماعات", formFields: [{ id: "meeting", label: "ملخص الاجتماع", type: "textarea" as const }], aiSuggestions: ["محضر اجتماع"] },
  ]},
  { id: "p2", title: "التخطيط الاستراتيجي", maxScore: 5, description: "وضع خطط استراتيجية", subEvidences: [{ id: "p2-1", title: "الخطة الاستراتيجية", type: "both" as const, description: "الخطة الاستراتيجية", formFields: [{ id: "strategy", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["خطة استراتيجية"] }] },
  { id: "p3", title: "إدارة الموارد البشرية", maxScore: 5, description: "إدارة وتطوير الكوادر", subEvidences: [{ id: "p3-1", title: "خطة التطوير المهني", type: "both" as const, description: "تطوير المعلمين", formFields: [{ id: "plan", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["خطة تطوير مهني"] }] },
  { id: "p4", title: "إدارة البيئة المدرسية", maxScore: 5, description: "توفير بيئة آمنة", subEvidences: [{ id: "p4-1", title: "تقرير السلامة", type: "report" as const, description: "تقرير السلامة", formFields: [{ id: "report", label: "التقرير", type: "textarea" as const }], aiSuggestions: ["تقرير سلامة"] }] },
  { id: "p5", title: "العلاقات المجتمعية", maxScore: 5, description: "تعزيز الشراكة", subEvidences: [{ id: "p5-1", title: "سجل الشراكة المجتمعية", type: "both" as const, description: "توثيق الشراكات", formFields: [{ id: "partnership", label: "التفاصيل", type: "textarea" as const }], aiSuggestions: ["شراكة مجتمعية"] }] },
  { id: "p6", title: "التطوير المهني", maxScore: 5, description: "دعم التطوير", subEvidences: [{ id: "p6-1", title: "خطة التدريب", type: "both" as const, description: "خطة التدريب", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة تدريب"] }] },
  { id: "p7", title: "الإشراف على العملية التعليمية", maxScore: 5, description: "متابعة العملية التعليمية", subEvidences: [{ id: "p7-1", title: "سجل الزيارات الصفية", type: "both" as const, description: "توثيق الزيارات", formFields: [{ id: "visits", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل زيارات صفية"] }] },
  { id: "p8", title: "تحسين نتائج الطلاب", maxScore: 5, description: "رفع مستوى التحصيل", subEvidences: [{ id: "p8-1", title: "تقرير تحليل النتائج", type: "both" as const, description: "تحليل النتائج", formFields: [{ id: "analysis", label: "التحليل", type: "textarea" as const }], aiSuggestions: ["تحليل نتائج"] }] },
  { id: "p9", title: "إدارة الأزمات", maxScore: 5, description: "الاستعداد للأزمات", subEvidences: [{ id: "p9-1", title: "خطة إدارة الأزمات", type: "both" as const, description: "خطة الطوارئ", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة أزمات"] }] },
];

const VICE_PRINCIPAL_CRITERIA = [
  { id: "v1", title: "المشاركة في التخطيط", maxScore: 5, description: "المشاركة في إعداد الخطط", subEvidences: [{ id: "v1-1", title: "الخطة التشغيلية", type: "both" as const, description: "المشاركة في الخطة", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة تشغيلية"] }] },
  { id: "v2", title: "متابعة الحضور والغياب", maxScore: 5, description: "متابعة الحضور", subEvidences: [{ id: "v2-1", title: "سجل الحضور", type: "both" as const, description: "توثيق الحضور", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل حضور"] }] },
  { id: "v3", title: "الإشراف على الاختبارات", maxScore: 5, description: "تنظيم الاختبارات", subEvidences: [{ id: "v3-1", title: "جدول الاختبارات", type: "both" as const, description: "إعداد الجداول", formFields: [{ id: "schedule", label: "الجدول", type: "textarea" as const }], aiSuggestions: ["جدول اختبارات"] }] },
  { id: "v4", title: "متابعة النظام والانضباط", maxScore: 5, description: "الحفاظ على النظام", subEvidences: [{ id: "v4-1", title: "سجل الملاحظات السلوكية", type: "both" as const, description: "توثيق السلوك", formFields: [{ id: "notes", label: "الملاحظات", type: "textarea" as const }], aiSuggestions: ["سجل سلوكي"] }] },
  { id: "v5", title: "إدارة شؤون الطلاب", maxScore: 5, description: "إدارة الشؤون", subEvidences: [{ id: "v5-1", title: "سجل شؤون الطلاب", type: "both" as const, description: "توثيق الشؤون", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل شؤون طلاب"] }] },
  { id: "v6", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "v6-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل تواصل"] }] },
  { id: "v7", title: "الإشراف على الأنشطة", maxScore: 5, description: "الإشراف على الأنشطة", subEvidences: [{ id: "v7-1", title: "خطة الأنشطة", type: "both" as const, description: "توثيق الأنشطة", formFields: [{ id: "activities", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة أنشطة"] }] },
];

const COUNSELOR_CRITERIA = [
  { id: "c1", title: "التوجيه والإرشاد الفردي", maxScore: 5, description: "تقديم خدمات الإرشاد", subEvidences: [{ id: "c1-1", title: "سجل الحالات الفردية", type: "both" as const, description: "توثيق الحالات", formFields: [{ id: "cases", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل حالات فردية"] }] },
  { id: "c2", title: "التوجيه الجماعي", maxScore: 5, description: "تنفيذ برامج جماعية", subEvidences: [{ id: "c2-1", title: "خطة البرامج الجماعية", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "programs", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["برنامج إرشاد جماعي"] }] },
  { id: "c3", title: "البرامج الوقائية", maxScore: 5, description: "تنفيذ البرامج الوقائية", subEvidences: [{ id: "c3-1", title: "خطة البرامج الوقائية", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "programs", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["برنامج وقائي"] }] },
  { id: "c4", title: "البرامج العلاجية", maxScore: 5, description: "تنفيذ البرامج العلاجية", subEvidences: [{ id: "c4-1", title: "خطط العلاج", type: "both" as const, description: "توثيق العلاج", formFields: [{ id: "plans", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["برنامج علاجي"] }] },
  { id: "c5", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "c5-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل تواصل"] }] },
  { id: "c6", title: "دراسة الحالات السلوكية", maxScore: 5, description: "دراسة الحالات", subEvidences: [{ id: "c6-1", title: "ملفات الحالات", type: "both" as const, description: "توثيق الدراسة", formFields: [{ id: "cases", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["دراسة حالة سلوكية"] }] },
  { id: "c7", title: "التقارير والإحصاءات", maxScore: 5, description: "إعداد التقارير", subEvidences: [{ id: "c7-1", title: "التقارير الشهرية", type: "both" as const, description: "توثيق التقارير", formFields: [{ id: "reports", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تقرير شهري"] }] },
];

const HEALTH_COUNSELOR_CRITERIA = [
  { id: "h1", title: "التثقيف الصحي", maxScore: 5, description: "تنفيذ برامج التثقيف", subEvidences: [{ id: "h1-1", title: "خطة التثقيف الصحي", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["برنامج تثقيف صحي"] }] },
  { id: "h2", title: "الإسعافات الأولية", maxScore: 5, description: "تقديم الإسعافات", subEvidences: [{ id: "h2-1", title: "سجل الإسعافات", type: "both" as const, description: "توثيق الإسعافات", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل إسعافات"] }] },
  { id: "h3", title: "البيئة الصحية", maxScore: 5, description: "متابعة البيئة الصحية", subEvidences: [{ id: "h3-1", title: "تقارير المتابعة", type: "both" as const, description: "توثيق المتابعة", formFields: [{ id: "reports", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تقرير بيئة صحية"] }] },
  { id: "h4", title: "متابعة الحالات الصحية", maxScore: 5, description: "متابعة الحالات المزمنة", subEvidences: [{ id: "h4-1", title: "سجل الحالات", type: "both" as const, description: "توثيق الحالات", formFields: [{ id: "cases", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل حالات صحية"] }] },
  { id: "h5", title: "التقارير الصحية", maxScore: 5, description: "إعداد التقارير", subEvidences: [{ id: "h5-1", title: "التقارير الشهرية", type: "both" as const, description: "توثيق التقارير", formFields: [{ id: "reports", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تقرير صحي شهري"] }] },
];

const SUPERVISOR_CRITERIA = [
  { id: "s1", title: "التخطيط للإشراف", maxScore: 5, description: "إعداد خطط إشرافية", subEvidences: [{ id: "s1-1", title: "الخطة الإشرافية", type: "both" as const, description: "توثيق الخطة", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة إشرافية"] }] },
  { id: "s2", title: "الزيارات الصفية", maxScore: 5, description: "تنفيذ الزيارات", subEvidences: [{ id: "s2-1", title: "سجل الزيارات", type: "both" as const, description: "توثيق الزيارات", formFields: [{ id: "visits", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل زيارات صفية"] }] },
  { id: "s3", title: "تطوير المعلمين", maxScore: 5, description: "دعم التطوير المهني", subEvidences: [{ id: "s3-1", title: "خطة التطوير", type: "both" as const, description: "توثيق التطوير", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة تطوير مهني"] }] },
  { id: "s4", title: "تحليل نتائج الطلاب", maxScore: 5, description: "تحليل النتائج", subEvidences: [{ id: "s4-1", title: "تقارير التحليل", type: "both" as const, description: "توثيق التحليل", formFields: [{ id: "analysis", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تحليل نتائج"] }] },
  { id: "s5", title: "البرامج التدريبية", maxScore: 5, description: "تنفيذ البرامج", subEvidences: [{ id: "s5-1", title: "خطة التدريب", type: "both" as const, description: "توثيق التدريب", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["برنامج تدريبي"] }] },
];

const LIBRARIAN_CRITERIA = [
  { id: "l1", title: "تنظيم مصادر التعلم", maxScore: 5, description: "تنظيم وفهرسة المصادر", subEvidences: [{ id: "l1-1", title: "سجل المصادر", type: "both" as const, description: "توثيق المصادر", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل مصادر تعلم"] }] },
  { id: "l2", title: "خدمة المستفيدين", maxScore: 5, description: "تقديم خدمات متميزة", subEvidences: [{ id: "l2-1", title: "سجل الإعارة", type: "both" as const, description: "توثيق الإعارة", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل إعارة"] }] },
  { id: "l3", title: "التقنيات التعليمية", maxScore: 5, description: "توظيف التقنيات", subEvidences: [{ id: "l3-1", title: "تقرير التقنيات", type: "both" as const, description: "توثيق التقنيات", formFields: [{ id: "report", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تقرير تقنيات"] }] },
  { id: "l4", title: "البرامج والأنشطة", maxScore: 5, description: "تنفيذ البرامج", subEvidences: [{ id: "l4-1", title: "خطة البرامج", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["برنامج تشجيع قراءة"] }] },
];

const KINDERGARTEN_CRITERIA = [
  { id: "k1", title: "التخطيط للأنشطة", maxScore: 5, description: "التخطيط لأنشطة تعليمية", subEvidences: [{ id: "k1-1", title: "خطة الأنشطة الأسبوعية", type: "both" as const, description: "توثيق الخطة", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة أنشطة أسبوعية"] }] },
  { id: "k2", title: "تنفيذ الأنشطة التعليمية", maxScore: 5, description: "تنفيذ أنشطة إبداعية", subEvidences: [{ id: "k2-1", title: "صور الأنشطة", type: "upload" as const, description: "توثيق بصري", aiSuggestions: ["صور أنشطة رياض أطفال"] }] },
  { id: "k3", title: "إدارة الصف", maxScore: 5, description: "إدارة الصف بطريقة مناسبة", subEvidences: [{ id: "k3-1", title: "قوانين الصف", type: "both" as const, description: "توثيق القوانين", formFields: [{ id: "rules", label: "القوانين", type: "textarea" as const }], aiSuggestions: ["قوانين صفية للأطفال"] }] },
  { id: "k4", title: "التقويم والمتابعة", maxScore: 5, description: "تقويم نمو الأطفال", subEvidences: [{ id: "k4-1", title: "سجل الملاحظات", type: "both" as const, description: "توثيق الملاحظات", formFields: [{ id: "notes", label: "الملاحظات", type: "textarea" as const }], aiSuggestions: ["سجل متابعة نمو"] }] },
  { id: "k5", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "k5-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل تواصل أولياء أمور"] }] },
  { id: "k6", title: "البيئة التعليمية", maxScore: 5, description: "تهيئة بيئة آمنة", subEvidences: [{ id: "k6-1", title: "صور البيئة الصفية", type: "upload" as const, description: "توثيق بصري", aiSuggestions: ["صور بيئة صفية"] }] },
];

const SPECIAL_ED_CRITERIA = [
  { id: "se1", title: "إعداد الخطة التعليمية الفردية (IEP)", maxScore: 5, description: "إعداد خطط فردية", subEvidences: [{ id: "se1-1", title: "الخطة التعليمية الفردية", type: "both" as const, description: "توثيق الخطة", formFields: [{ id: "iep", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["خطة تعليمية فردية"] }] },
  { id: "se2", title: "تنفيذ البرامج التعليمية", maxScore: 5, description: "تنفيذ البرامج", subEvidences: [{ id: "se2-1", title: "سجل الجلسات", type: "both" as const, description: "توثيق الجلسات", formFields: [{ id: "sessions", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل جلسات تعليمية"] }] },
  { id: "se3", title: "التقييم والتشخيص", maxScore: 5, description: "تقييم الاحتياجات", subEvidences: [{ id: "se3-1", title: "تقارير التقييم", type: "both" as const, description: "توثيق التقييم", formFields: [{ id: "assessment", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تقرير تقييم"] }] },
  { id: "se4", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "se4-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل تواصل"] }] },
  { id: "se5", title: "التعديل السلوكي", maxScore: 5, description: "تطبيق برامج التعديل", subEvidences: [{ id: "se5-1", title: "خطط التعديل السلوكي", type: "both" as const, description: "توثيق الخطط", formFields: [{ id: "plans", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة تعديل سلوكي"] }] },
  { id: "se6", title: "التكامل مع المعلمين", maxScore: 5, description: "التعاون مع معلمي التعليم العام", subEvidences: [{ id: "se6-1", title: "خطط الدمج", type: "both" as const, description: "توثيق التعاون", formFields: [{ id: "plans", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["خطة دمج"] }] },
];

const ADMIN_ASSISTANT_CRITERIA = [
  { id: "a1", title: "الأعمال الإدارية", maxScore: 5, description: "تنفيذ الأعمال الإدارية", subEvidences: [{ id: "a1-1", title: "سجل المهام", type: "both" as const, description: "توثيق المهام", formFields: [{ id: "tasks", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل مهام إدارية"] }] },
  { id: "a2", title: "المراسلات والتقارير", maxScore: 5, description: "إعداد المراسلات", subEvidences: [{ id: "a2-1", title: "سجل الصادر والوارد", type: "both" as const, description: "توثيق المراسلات", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل مراسلات"] }] },
  { id: "a3", title: "متابعة الحضور والغياب", maxScore: 5, description: "متابعة الحضور", subEvidences: [{ id: "a3-1", title: "سجل الحضور", type: "both" as const, description: "توثيق الحضور", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل حضور"] }] },
  { id: "a4", title: "خدمة المراجعين", maxScore: 5, description: "تقديم خدمة متميزة", subEvidences: [{ id: "a4-1", title: "سجل المراجعين", type: "both" as const, description: "توثيق الخدمة", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["سجل مراجعين"] }] },
  { id: "a5", title: "الأرشفة والتوثيق", maxScore: 5, description: "أرشفة الملفات", subEvidences: [{ id: "a5-1", title: "نظام الأرشفة", type: "both" as const, description: "توثيق الأرشفة", formFields: [{ id: "system", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["نظام أرشفة"] }] },
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

  // AI State
  const [aiApiKey, setAiApiKey] = useState(() => localStorage.getItem("sers_ai_key") || "");
  const [showAiSettings, setShowAiSettings] = useState(false);
  const [aiLoading, setAiLoading] = useState<string | null>(null);
  const [aiChat, setAiChat] = useState<Record<string, string[]>>({});
  const [aiPrompt, setAiPrompt] = useState("");

  // Add custom sub-evidence
  const [showAddSub, setShowAddSub] = useState<string | null>(null);
  const [newSubTitle, setNewSubTitle] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);
  const activeUploadRef = useRef<{ criterionId: string; subEvidenceId: string } | null>(null);

  const [personalInfo, setPersonalInfo] = useState({
    name: "", school: "",
    department: "المملكة العربية السعودية\nوزارة التعليم\nالإدارة العامة للتعليم بمنطقة",
    year: "١٤٤٧هـ", semester: "الفصل الدراسي الثاني",
    evaluator: "", evaluatorRole: "مدير المدرسة", date: "",
  });

  const [criteriaData, setCriteriaData] = useState<Record<string, CriterionData>>({});

  const initCriteriaData = (criteria: any[]) => {
    const data: Record<string, CriterionData> = {};
    criteria.forEach((c: any) => {
      data[c.id] = { score: 0, notes: "", evidences: [], customSubEvidences: [] };
    });
    setCriteriaData(data);
  };

  useEffect(() => {
    if (aiApiKey) localStorage.setItem("sers_ai_key", aiApiKey);
  }, [aiApiKey]);

  const handleSelectJob = (job: typeof JOB_TYPES[0]) => {
    setSelectedJob(job);
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
      aiSuggestions: ["محتوى مخصص"],
    };
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], customSubEvidences: [...prev[criterionId].customSubEvidences, newSub] },
    }));
    setNewSubTitle("");
    setShowAddSub(null);
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

  // ===== AI API Call =====
  const callAI = async (criterionId: string, subId: string, context: string) => {
    if (!aiApiKey) { setShowAiSettings(true); return; }
    const key = `${criterionId}_${subId}`;
    setAiLoading(key);
    try {
      const apiUrl = aiApiKey.startsWith("sk-") ? "https://api.openai.com/v1/chat/completions" : aiApiKey;
      const response = await fetch(apiUrl.includes("http") ? apiUrl : "https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "أنت مساعد تعليمي متخصص في إعداد شواهد الأداء الوظيفي للمعلمين والإداريين في المملكة العربية السعودية. ساعد المستخدم في كتابة شواهد احترافية ومفصلة. أجب باللغة العربية فقط." },
            { role: "user", content: context || aiPrompt },
          ],
          max_tokens: 500,
          temperature: 0.7,
        }),
      });
      const data = await response.json();
      const aiResponse = data.choices?.[0]?.message?.content || "عذراً، لم أتمكن من الحصول على اقتراح. تأكد من صحة مفتاح API.";
      setAiChat((prev) => ({ ...prev, [key]: [...(prev[key] || []), aiResponse] }));
    } catch (err) {
      setAiChat((prev) => ({ ...prev, [key]: [...(prev[key] || []), "خطأ في الاتصال بالذكاء الاصطناعي. تأكد من مفتاح API والاتصال بالإنترنت."] }));
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
    if (!aiApiKey) { setShowAiSettings(true); return; }
    const key = `fill_${evId}`;
    setAiLoading(key);
    try {
      const fieldNames = fields.map(f => f.label).join("، ");
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { "Content-Type": "application/json", "Authorization": `Bearer ${aiApiKey}` },
        body: JSON.stringify({
          model: "gpt-3.5-turbo",
          messages: [
            { role: "system", content: "أنت مساعد تعليمي. أعد بيانات JSON فقط بدون أي نص إضافي. المفاتيح هي معرفات الحقول." },
            { role: "user", content: `املأ هذه الحقول ببيانات واقعية لمعلم سعودي: ${fieldNames}. أعد JSON بالمفاتيح: ${fields.map(f => f.id).join(", ")}` },
          ],
          max_tokens: 500,
        }),
      });
      const data = await response.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]);
          Object.entries(parsed).forEach(([fieldId, value]) => {
            updateFormField(criterionId, evId, fieldId, String(value));
          });
        }
      } catch { /* ignore parse errors */ }
    } catch { /* ignore network errors */ }
    setAiLoading(null);
  };

  const saveReport = () => {
    const data = { personalInfo, criteriaData, jobId: selectedJob?.id, themeId: selectedTheme.id };
    localStorage.setItem(`sers_perf_${personalInfo.name || "draft"}`, JSON.stringify(data));
    alert("تم حفظ البيانات بنجاح!");
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
    await exportToPDF("preview-content", `شواهد_الأداء_${personalInfo.name || "مستند"}.pdf`);
    setIsExporting(false);
  };

  const currentCriterion = selectedJob?.criteria[currentCriterionIndex];

  // ===== AI Settings Modal =====
  const AISettingsModal = () => (
    <AnimatePresence>
      {showAiSettings && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4" onClick={() => setShowAiSettings(false)}>
          <motion.div initial={{ scale: 0.9 }} animate={{ scale: 1 }} exit={{ scale: 0.9 }}
            className="bg-white rounded-2xl p-6 max-w-md w-full shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-black text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>إعدادات الذكاء الاصطناعي</h3>
              <button onClick={() => setShowAiSettings(false)} className="p-1 rounded-lg hover:bg-gray-100"><X className="w-5 h-5" /></button>
            </div>
            <p className="text-sm text-gray-500 mb-4">أدخل مفتاح API الخاص بك (OpenAI أو أي خدمة متوافقة) لتفعيل ميزات الذكاء الاصطناعي التفاعلية.</p>
            <input type="password" value={aiApiKey} onChange={(e) => setAiApiKey(e.target.value)}
              placeholder="sk-..." dir="ltr"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 focus:border-violet-400 mb-3" />
            <p className="text-xs text-gray-400 mb-4">المفتاح يُحفظ محلياً في متصفحك فقط ولا يُرسل لأي جهة.</p>
            <button onClick={() => setShowAiSettings(false)}
              className="w-full bg-violet-600 text-white py-2.5 rounded-xl text-sm font-bold hover:bg-violet-700">حفظ</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );

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
        <AISettingsModal />
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-6">
            <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700">
              <ArrowLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
            </button>
            <button onClick={() => setShowAiSettings(true)} className="flex items-center gap-2 text-violet-600 hover:text-violet-700 text-sm bg-violet-50 px-3 py-2 rounded-lg">
              <Settings className="w-4 h-4" />إعدادات AI
            </button>
          </div>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4"><span className="text-3xl">📊</span></div>
            <h1 className="text-3xl font-black text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>شواهد الأداء الوظيفي</h1>
            <p className="text-gray-500 max-w-lg mx-auto text-sm">اختر الوظيفة لبدء إعداد الشواهد. كل بند يحتوي على شواهد فرعية مع فورمات تفاعلية وذكاء اصطناعي حقيقي.</p>
            {aiApiKey && <p className="text-xs text-emerald-600 mt-2 flex items-center justify-center gap-1"><Sparkles className="w-3 h-3" />الذكاء الاصطناعي مفعّل</p>}
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
        <AISettingsModal />
        <div className="max-w-5xl mx-auto">
          <div className="flex items-center justify-between mb-5 bg-white rounded-xl p-4 shadow-sm border border-gray-100">
            <div className="flex items-center gap-3">
              <button onClick={() => setStep("select")} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm">
                <ArrowLeft className="w-4 h-4" />تغيير الوظيفة
              </button>
              <button onClick={saveReport} className="flex items-center gap-1.5 text-blue-600 text-sm"><Save className="w-4 h-4" />حفظ</button>
              <button onClick={() => setShowAiSettings(true)} className="flex items-center gap-1.5 text-violet-600 text-sm"><Sparkles className="w-4 h-4" />AI</button>
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
            {selectedJob?.criteria.map((criterion: any, index: number) => {
              const data = criteriaData[criterion.id];
              if (!data) return null;
              const evidenceCount = data.evidences.length;
              return (
                <motion.button key={criterion.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
                  onClick={() => { setCurrentCriterionIndex(index); setStep("criterion-detail"); }}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all text-right group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0 group-hover:bg-emerald-100">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-sm" style={{ fontFamily: "'Tajawal', sans-serif" }}>{criterion.title}</h3>
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
        <AISettingsModal />
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
                <button disabled={currentCriterionIndex === (selectedJob?.criteria.length || 0) - 1} onClick={() => setCurrentCriterionIndex(i => i + 1)} className="p-2 rounded-lg bg-white border border-gray-200 disabled:opacity-30"><ArrowLeft className="w-4 h-4" /></button>
              </div>
            </div>
            <span className="text-sm text-gray-500">البند {currentCriterionIndex + 1} من {selectedJob?.criteria.length}</span>
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
            {allSubEvidences.map((sub: any) => {
              const subEvidences = data.evidences.filter(e => e.subEvidenceId === sub.id);
              const isExpanded = expandedSubEvidence === sub.id;
              const aiKey = `${currentCriterion.id}_${sub.id}`;
              const aiMessages = aiChat[aiKey] || [];

              // Auto-create form evidence for report types
              const hasFormEvidence = subEvidences.some(e => e.formData && Object.keys(e.formData).length > 0);
              let formEvId = subEvidences.find(e => e.formData)?.id;

              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Sub Header */}
                  <div role="button" tabIndex={0} onClick={() => {
                    setExpandedSubEvidence(isExpanded ? null : sub.id);
                    // Auto-create form evidence when expanding report type
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
                                  {aiApiKey && (
                                    <button onClick={() => fillFormWithAI(currentCriterion.id, sub.id, formEv.id, sub.formFields!)}
                                      disabled={aiLoading === `fill_${formEv.id}`}
                                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-violet-100 text-violet-700 text-xs font-medium hover:bg-violet-200 disabled:opacity-50">
                                      {aiLoading === `fill_${formEv.id}` ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5" />}
                                      تعبئة بالذكاء الاصطناعي
                                    </button>
                                  )}
                                </div>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {sub.formFields.map((field: FormField) => (
                                    <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                      </label>
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
                          {subEvidences.filter(e => !(e.formData && Object.keys(e.formData).length === 0 && e.type === 'text' && !e.text)).length > 0 && (
                            <div className="space-y-2">
                              {subEvidences.filter(e => {
                                // Don't show empty form evidences as separate items
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
                              {!aiApiKey && <span className="text-xs text-gray-400">(أدخل مفتاح API أولاً)</span>}
                            </div>
                            {aiMessages.length > 0 && (
                              <div className="space-y-2 mb-3 max-h-48 overflow-y-auto">
                                {aiMessages.map((msg, idx) => (
                                  <div key={idx} className="bg-white rounded-lg p-3 border border-violet-200">
                                    <p className="text-sm text-gray-700 leading-relaxed">{msg}</p>
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
                                onKeyDown={(e) => { if (e.key === 'Enter') callAI(currentCriterion.id, sub.id, aiPrompt || `اقترح شاهد أداء وظيفي لبند "${currentCriterion.title}" - ${sub.title}`); }}
                                className="flex-1 px-3 py-2.5 rounded-lg border border-violet-200 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500/20 bg-white" />
                              <button onClick={() => callAI(currentCriterion.id, sub.id, aiPrompt || `اقترح شاهد أداء وظيفي لبند "${currentCriterion.title}" - ${sub.title}`)}
                                disabled={aiLoading === aiKey || !aiApiKey}
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
            {currentCriterionIndex < (selectedJob?.criteria.length || 0) - 1 ? (
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
                {selectedJob?.criteria.map((c: any, i: number) => {
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
              <p className="text-sm opacity-80 mb-1">{personalInfo.department}</p>
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
                  {selectedJob?.criteria.map((c: any, i: number) => (
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
              {selectedJob?.criteria.map((c: any, i: number) => {
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
                          {ev.formData && Object.entries(ev.formData).some(([_, v]) => v) && (
                            <div className="text-sm space-y-1">
                              {Object.entries(ev.formData).filter(([_, v]) => v).map(([key, val]) => (
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
