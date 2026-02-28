/**
 * شواهد الأداء الوظيفي - نسخة متقدمة
 * كل بند = صفحة مستقلة | شواهد فرعية كأقسام منفصلة | فورمات تفاعلية | رفع ملفات | باركود QR | ذكاء اصطناعي
 */
import { useState, useRef, useCallback, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft, ArrowRight, Download, Printer, Eye, ChevronDown, ChevronUp,
  Plus, Trash2, Upload, Link as LinkIcon, QrCode, Image,
  FileText, Video, Type, Sparkles, Save, RotateCcw, X,
  CheckCircle2, AlertCircle, Camera, Globe, Bot, Lightbulb,
  ChevronLeft, Home, Star, BarChart3, Layers
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
}

// ===== البنود الحقيقية لتقييم أداء المعلم (12 بند) مع شواهد فرعية مفصلة =====
const TEACHER_CRITERIA = [
  {
    id: "t1", title: "أداء الواجبات الوظيفية", maxScore: 5,
    description: "الالتزام بالحضور والانصراف وتنفيذ المهام الموكلة والمشاركة في الأعمال المدرسية",
    subEvidences: [
      {
        id: "t1-1", title: "تقرير تنفيذ إذاعة مدرسية", description: "توثيق تنفيذ الإذاعة المدرسية مع الفقرات والمشاركين",
        type: "report" as const,
        formFields: [
          { id: "topic", label: "موضوع الإذاعة", type: "text" as const, placeholder: "مثال: اليوم الوطني", required: true },
          { id: "date", label: "تاريخ التنفيذ", type: "date" as const, required: true },
          { id: "students_count", label: "عدد الطلاب المشاركين", type: "number" as const, placeholder: "مثال: 8" },
          { id: "segments", label: "فقرات الإذاعة", type: "textarea" as const, placeholder: "القرآن الكريم - الحديث الشريف - كلمة الصباح - فقرة هل تعلم..." },
          { id: "notes", label: "ملاحظات إضافية", type: "textarea" as const, placeholder: "أي ملاحظات حول التنفيذ" },
        ],
        aiSuggestions: [
          "تم تنفيذ إذاعة مدرسية صباحية بعنوان (اليوم الوطني) تضمنت فقرات: القرآن الكريم، الحديث الشريف، كلمة عن المناسبة، مسابقة ثقافية، ونشيد وطني. شارك فيها 8 طلاب من الصف السادس.",
          "تم تنفيذ إذاعة مدرسية عن (النظافة الشخصية) بمشاركة 6 طلاب، تضمنت فقرات تثقيفية وعرض مرئي عن أهمية النظافة.",
        ],
      },
      {
        id: "t1-2", title: "تقرير تنفيذ نشاط لا صفي", description: "توثيق تنفيذ نشاط لا صفي مع الأهداف والنتائج",
        type: "report" as const,
        formFields: [
          { id: "activity_name", label: "اسم النشاط", type: "text" as const, placeholder: "مثال: مسابقة القراءة", required: true },
          { id: "date", label: "تاريخ التنفيذ", type: "date" as const, required: true },
          { id: "target_group", label: "الفئة المستهدفة", type: "text" as const, placeholder: "مثال: طلاب الصف الرابع" },
          { id: "objectives", label: "أهداف النشاط", type: "textarea" as const, placeholder: "الأهداف المراد تحقيقها..." },
          { id: "description", label: "وصف النشاط", type: "textarea" as const, placeholder: "وصف تفصيلي لما تم تنفيذه..." },
          { id: "results", label: "النتائج والتوصيات", type: "textarea" as const, placeholder: "ما تم تحقيقه من أهداف..." },
        ],
        aiSuggestions: [
          "تم تنفيذ نشاط لا صفي بعنوان (مسابقة القراءة الحرة) لطلاب الصف الرابع بهدف تعزيز حب القراءة. شارك 25 طالباً وتم تكريم أفضل 3 قراء.",
        ],
      },
      {
        id: "t1-3", title: "تقرير تنفيذ حصة انتظار", description: "توثيق تنفيذ حصة الانتظار والأنشطة المقدمة",
        type: "report" as const,
        formFields: [
          { id: "class", label: "الصف والفصل", type: "text" as const, placeholder: "مثال: 3/أ", required: true },
          { id: "date", label: "تاريخ الحصة", type: "date" as const, required: true },
          { id: "period", label: "رقم الحصة", type: "select" as const, options: ["الأولى", "الثانية", "الثالثة", "الرابعة", "الخامسة", "السادسة", "السابعة"] },
          { id: "activities", label: "الأنشطة المنفذة", type: "textarea" as const, placeholder: "ما تم تنفيذه خلال الحصة..." },
        ],
        aiSuggestions: [
          "تم تنفيذ حصة انتظار للصف 3/أ في الحصة الثالثة، تضمنت مراجعة مهارات الرياضيات الأساسية مع أنشطة تعليمية ترفيهية.",
        ],
      },
      {
        id: "t1-4", title: "تقرير المشاركة في لجان المدرسة", description: "توثيق المشاركة في اللجان المدرسية",
        type: "report" as const,
        formFields: [
          { id: "committee_name", label: "اسم اللجنة", type: "text" as const, placeholder: "مثال: لجنة الاختبارات", required: true },
          { id: "role", label: "الدور في اللجنة", type: "text" as const, placeholder: "مثال: عضو / مقرر / رئيس" },
          { id: "tasks", label: "المهام المنفذة", type: "textarea" as const, placeholder: "المهام التي تم تنفيذها..." },
          { id: "date", label: "الفترة", type: "text" as const, placeholder: "مثال: الفصل الأول 1447هـ" },
        ],
        aiSuggestions: [
          "تم المشاركة في لجنة الاختبارات كعضو فاعل، وتضمنت المهام: إعداد جداول الاختبارات، تنظيم اللجان، ومراقبة سير الاختبارات.",
        ],
      },
      {
        id: "t1-5", title: "تقرير الإشراف اليومي", description: "توثيق الإشراف اليومي على الطلاب",
        type: "both" as const,
        formFields: [
          { id: "location", label: "مكان الإشراف", type: "select" as const, options: ["البوابة الرئيسية", "الفناء", "الممرات", "المقصف", "المصلى", "أخرى"] },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "period", label: "الفترة", type: "select" as const, options: ["قبل الطابور", "الفسحة الأولى", "الفسحة الثانية", "نهاية الدوام"] },
          { id: "observations", label: "الملاحظات", type: "textarea" as const, placeholder: "ملاحظات الإشراف..." },
        ],
        aiSuggestions: [
          "تم تنفيذ الإشراف اليومي على البوابة الرئيسية خلال فترة الفسحة الأولى، وتم التأكد من سلامة الطلاب وانضباطهم.",
        ],
      },
    ],
  },
  {
    id: "t2", title: "التفاعل مع المجتمع المهني", maxScore: 5,
    description: "المشاركة الفاعلة في مجتمعات التعلم المهنية والزيارات التبادلية وبحث الدرس",
    subEvidences: [
      {
        id: "t2-1", title: "تقرير تبادل الزيارات بين المعلمين", description: "توثيق الزيارات التبادلية الصفية",
        type: "report" as const,
        formFields: [
          { id: "visited_teacher", label: "اسم المعلم/ة الزائر/ة", type: "text" as const, required: true },
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const },
          { id: "date", label: "تاريخ الزيارة", type: "date" as const, required: true },
          { id: "lesson", label: "عنوان الدرس", type: "text" as const },
          { id: "strengths", label: "نقاط القوة", type: "textarea" as const, placeholder: "ما لاحظته من نقاط قوة..." },
          { id: "improvements", label: "نقاط التحسين", type: "textarea" as const, placeholder: "مقترحات التحسين..." },
          { id: "lessons_learned", label: "الدروس المستفادة", type: "textarea" as const, placeholder: "ما تعلمته من الزيارة..." },
        ],
        aiSuggestions: [
          "تم تنفيذ زيارة تبادلية مع المعلم/ة (الاسم) في مادة (الرياضيات) للصف الخامس. لوحظ التنوع في استراتيجيات التدريس واستخدام التقنية بفاعلية.",
        ],
      },
      {
        id: "t2-2", title: "تقرير جلسات مجتمعات التعلم المهنية", description: "توثيق المشاركة في مجتمعات التعلم المهنية",
        type: "report" as const,
        formFields: [
          { id: "session_title", label: "عنوان الجلسة", type: "text" as const, required: true },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "participants", label: "المشاركون", type: "textarea" as const, placeholder: "أسماء المشاركين..." },
          { id: "topics", label: "المحاور المطروحة", type: "textarea" as const, placeholder: "المواضيع التي تمت مناقشتها..." },
          { id: "outcomes", label: "المخرجات والتوصيات", type: "textarea" as const, placeholder: "ما تم الاتفاق عليه..." },
        ],
        aiSuggestions: [
          "تم المشاركة في جلسة مجتمع تعلم مهني بعنوان (تطوير أساليب التقويم) بمشاركة 5 معلمين. تم مناقشة أفضل الممارسات وتبادل الخبرات.",
        ],
      },
      {
        id: "t2-3", title: "تقرير بحث الدرس", description: "توثيق المشاركة في بحث الدرس",
        type: "report" as const,
        formFields: [
          { id: "lesson_title", label: "عنوان الدرس", type: "text" as const, required: true },
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "team", label: "فريق البحث", type: "textarea" as const, placeholder: "أسماء أعضاء الفريق..." },
          { id: "research_question", label: "سؤال البحث", type: "textarea" as const, placeholder: "السؤال الذي يسعى البحث للإجابة عنه..." },
          { id: "methodology", label: "المنهجية", type: "textarea" as const, placeholder: "خطوات تنفيذ البحث..." },
          { id: "findings", label: "النتائج", type: "textarea" as const, placeholder: "ما توصل إليه البحث..." },
        ],
        aiSuggestions: [
          "تم تنفيذ بحث درس في مادة العلوم بعنوان (أثر استخدام التجارب العملية في فهم المفاهيم العلمية) بمشاركة 3 معلمين.",
        ],
      },
      {
        id: "t2-4", title: "تقرير البحث الإجرائي", description: "توثيق البحث الإجرائي",
        type: "both" as const,
        formFields: [
          { id: "title", label: "عنوان البحث", type: "text" as const, required: true },
          { id: "problem", label: "المشكلة البحثية", type: "textarea" as const },
          { id: "objectives", label: "أهداف البحث", type: "textarea" as const },
          { id: "methodology", label: "المنهجية", type: "textarea" as const },
          { id: "results", label: "النتائج", type: "textarea" as const },
          { id: "recommendations", label: "التوصيات", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد بحث إجرائي بعنوان (أثر التعلم التعاوني في تحسين مهارات حل المسائل الرياضية لطلاب الصف الرابع).",
        ],
      },
    ],
  },
  {
    id: "t3", title: "التفاعل مع أولياء الأمور", maxScore: 5,
    description: "التواصل المستمر مع أولياء الأمور وإشراكهم في العملية التعليمية",
    subEvidences: [
      {
        id: "t3-1", title: "تقرير التواصل عبر منصة مدرستي", description: "توثيق التواصل مع أولياء الأمور عبر المنصة",
        type: "both" as const,
        formFields: [
          { id: "communication_type", label: "نوع التواصل", type: "select" as const, options: ["رسالة نصية", "اجتماع افتراضي", "تقرير أداء", "إشعار غياب", "أخرى"] },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "parent_name", label: "اسم ولي الأمر", type: "text" as const },
          { id: "topic", label: "الموضوع", type: "text" as const },
          { id: "details", label: "التفاصيل", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم التواصل مع ولي أمر الطالب (الاسم) عبر منصة مدرستي لمناقشة مستوى الطالب الدراسي وتقديم توصيات لتحسين الأداء.",
        ],
      },
      {
        id: "t3-2", title: "تقرير اجتماع أولياء الأمور", description: "توثيق اجتماعات أولياء الأمور",
        type: "report" as const,
        formFields: [
          { id: "meeting_type", label: "نوع الاجتماع", type: "select" as const, options: ["الاجتماع الأول", "اجتماع دوري", "اجتماع طارئ", "مجلس الآباء"] },
          { id: "date", label: "التاريخ", type: "date" as const, required: true },
          { id: "attendees_count", label: "عدد الحضور", type: "number" as const },
          { id: "agenda", label: "جدول الأعمال", type: "textarea" as const },
          { id: "decisions", label: "القرارات والتوصيات", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم عقد الاجتماع الأول لأولياء الأمور بحضور 20 ولي أمر. تم مناقشة الخطة الدراسية وآلية التواصل وتوزيع الجداول.",
        ],
      },
    ],
  },
  {
    id: "t4", title: "التنوع في استراتيجيات التدريس", maxScore: 5,
    description: "استخدام استراتيجيات تدريس متنوعة وفعالة تراعي الفروق الفردية بين الطلاب",
    subEvidences: [
      {
        id: "t4-1", title: "تقرير تطبيق استراتيجية تعلم نشط", description: "توثيق تطبيق استراتيجية تعلم نشط في الحصة",
        type: "report" as const,
        formFields: [
          { id: "strategy_name", label: "اسم الاستراتيجية", type: "select" as const, options: ["التعلم التعاوني", "العصف الذهني", "خرائط المفاهيم", "تمثيل الأدوار", "التعلم باللعب", "الصف المقلوب", "التعلم بالمشاريع", "حل المشكلات", "أخرى"], required: true },
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "lesson", label: "عنوان الدرس", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "steps", label: "خطوات التطبيق", type: "textarea" as const, placeholder: "كيف تم تطبيق الاستراتيجية..." },
          { id: "student_interaction", label: "تفاعل الطلاب", type: "textarea" as const, placeholder: "كيف تفاعل الطلاب مع الاستراتيجية..." },
          { id: "results", label: "النتائج", type: "textarea" as const, placeholder: "ما تحقق من أهداف..." },
        ],
        aiSuggestions: [
          "تم تطبيق استراتيجية التعلم التعاوني في درس (الكسور) للصف الرابع. تم تقسيم الطلاب إلى 5 مجموعات وتفاعلوا بشكل إيجابي مع النشاط.",
          "تم استخدام استراتيجية العصف الذهني لاستخراج أفكار الطلاب حول موضوع (التلوث البيئي) في مادة العلوم.",
        ],
      },
      {
        id: "t4-2", title: "صور/فيديو تطبيق الاستراتيجية", description: "توثيق بصري لتطبيق الاستراتيجية",
        type: "upload" as const,
        aiSuggestions: ["التقط صوراً أو فيديو أثناء تطبيق الاستراتيجية مع الطلاب لتوثيق التفاعل والمشاركة."],
      },
    ],
  },
  {
    id: "t5", title: "تحسين نتائج المتعلمين", maxScore: 5,
    description: "العمل على رفع مستوى تحصيل الطلاب من خلال الخطط العلاجية والإثرائية",
    subEvidences: [
      {
        id: "t5-1", title: "خطة علاجية", description: "خطة علاجية فردية أو جماعية للطلاب المتأخرين",
        type: "report" as const,
        formFields: [
          { id: "plan_type", label: "نوع الخطة", type: "select" as const, options: ["فردية", "جماعية"], required: true },
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "students", label: "الطلاب المستهدفون", type: "textarea" as const, placeholder: "أسماء الطلاب..." },
          { id: "weaknesses", label: "نقاط الضعف المحددة", type: "textarea" as const, placeholder: "المهارات التي يحتاج الطلاب لتحسينها..." },
          { id: "activities", label: "الأنشطة العلاجية", type: "textarea" as const, placeholder: "الأنشطة المقترحة للعلاج..." },
          { id: "duration", label: "المدة الزمنية", type: "text" as const, placeholder: "مثال: أسبوعين" },
          { id: "evaluation", label: "أسلوب التقويم", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد خطة علاجية جماعية لـ 5 طلاب في مادة الرياضيات لتحسين مهارة الجمع والطرح، تتضمن أنشطة يومية لمدة أسبوعين.",
        ],
      },
      {
        id: "t5-2", title: "خطة إثرائية", description: "خطة إثرائية للطلاب المتفوقين",
        type: "report" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "students", label: "الطلاب المستهدفون", type: "textarea" as const },
          { id: "enrichment_activities", label: "الأنشطة الإثرائية", type: "textarea" as const, placeholder: "الأنشطة المقدمة للطلاب المتفوقين..." },
          { id: "expected_outcomes", label: "المخرجات المتوقعة", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد خطة إثرائية لـ 3 طلاب متفوقين في مادة العلوم تتضمن مشاريع بحثية ومسابقات علمية.",
        ],
      },
      {
        id: "t5-3", title: "تقرير مقارنة نتائج الفترات", description: "مقارنة نتائج الطلاب بين الفترات",
        type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const },
          { id: "period1", label: "نتائج الفترة الأولى", type: "textarea" as const },
          { id: "period2", label: "نتائج الفترة الثانية", type: "textarea" as const },
          { id: "analysis", label: "التحليل والملاحظات", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم مقارنة نتائج الفترة الأولى والثانية لمادة الرياضيات للصف الرابع. لوحظ تحسن بنسبة 15% في متوسط الدرجات.",
        ],
      },
    ],
  },
  {
    id: "t6", title: "إعداد وتنفيذ خطة التعلم", maxScore: 5,
    description: "التخطيط الجيد للدروس وتنفيذها وفق الخطة الزمنية مع توزيع المنهج",
    subEvidences: [
      {
        id: "t6-1", title: "تحضير درس يومي", description: "نموذج تحضير درس يومي",
        type: "report" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "lesson", label: "عنوان الدرس", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "objectives", label: "أهداف الدرس", type: "textarea" as const, placeholder: "الأهداف السلوكية..." },
          { id: "introduction", label: "التهيئة والتمهيد", type: "textarea" as const },
          { id: "presentation", label: "عرض الدرس", type: "textarea" as const },
          { id: "strategies", label: "الاستراتيجيات المستخدمة", type: "textarea" as const },
          { id: "evaluation", label: "التقويم", type: "textarea" as const },
          { id: "homework", label: "الواجب المنزلي", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم تحضير درس يومي في مادة اللغة العربية بعنوان (الفاعل) للصف الخامس، يتضمن أهداف سلوكية واضحة واستراتيجيات تدريس متنوعة.",
        ],
      },
      {
        id: "t6-2", title: "توزيع المنهج الدراسي", description: "توزيع المنهج على أسابيع الفصل الدراسي",
        type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف", type: "text" as const },
          { id: "semester", label: "الفصل الدراسي", type: "select" as const, options: ["الأول", "الثاني", "الثالث"] },
          { id: "weeks_count", label: "عدد الأسابيع", type: "number" as const },
          { id: "distribution", label: "التوزيع الأسبوعي", type: "textarea" as const, placeholder: "الأسبوع 1: ... الأسبوع 2: ..." },
        ],
        aiSuggestions: [
          "تم إعداد توزيع المنهج لمادة الرياضيات للصف الرابع على 16 أسبوعاً للفصل الدراسي الثاني.",
        ],
      },
      {
        id: "t6-3", title: "خطة أسبوعية", description: "الخطة الأسبوعية للمعلم",
        type: "report" as const,
        formFields: [
          { id: "week", label: "الأسبوع", type: "text" as const, placeholder: "مثال: الأسبوع الخامس" },
          { id: "date_range", label: "الفترة", type: "text" as const, placeholder: "من - إلى" },
          { id: "subjects", label: "المواد والدروس", type: "textarea" as const, placeholder: "السبت: رياضيات - درس الكسور\nالأحد: علوم - درس النباتات..." },
          { id: "notes", label: "ملاحظات", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد الخطة الأسبوعية للأسبوع الخامس متضمنة جميع الحصص والدروس والأنشطة المصاحبة.",
        ],
      },
    ],
  },
  {
    id: "t7", title: "توظيف تقنيات ووسائل التعلم", maxScore: 5,
    description: "استخدام التقنية والوسائل التعليمية المناسبة في العملية التعليمية",
    subEvidences: [
      {
        id: "t7-1", title: "تقرير توظيف أداة تقنية", description: "توثيق استخدام أداة تقنية في التدريس",
        type: "report" as const,
        formFields: [
          { id: "tool_name", label: "اسم الأداة/التطبيق", type: "select" as const, options: ["Microsoft Forms", "Google Classroom", "ClassDojo", "Padlet", "Canva", "Quizizz", "Kahoot", "Nearpod", "Wordwall", "أخرى"], required: true },
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "lesson", label: "الدرس", type: "text" as const },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "usage", label: "كيفية الاستخدام", type: "textarea" as const, placeholder: "كيف تم توظيف الأداة في الدرس..." },
          { id: "impact", label: "الأثر على التعلم", type: "textarea" as const, placeholder: "ما أثر استخدام الأداة على تعلم الطلاب..." },
        ],
        aiSuggestions: [
          "تم توظيف تطبيق Quizizz لإنشاء اختبار تفاعلي في مادة العلوم، شارك فيه 28 طالباً وحقق تفاعلاً إيجابياً.",
          "تم استخدام Padlet لإنشاء جدار تعاوني لمشاركة أفكار الطلاب حول موضوع البيئة.",
        ],
      },
      {
        id: "t7-2", title: "لقطات شاشة / صور التطبيق", description: "توثيق بصري لاستخدام التقنية",
        type: "upload" as const,
        aiSuggestions: ["التقط لقطات شاشة من التطبيق أو صور أثناء استخدام التقنية مع الطلاب."],
      },
    ],
  },
  {
    id: "t8", title: "تهيئة البيئة التعليمية", maxScore: 5,
    description: "توفير بيئة تعليمية محفزة وجاذبة للتعلم داخل وخارج الفصل",
    subEvidences: [
      {
        id: "t8-1", title: "صور تجهيز الفصل الدراسي", description: "توثيق بصري لتجهيز البيئة الصفية",
        type: "upload" as const,
        aiSuggestions: ["التقط صوراً للفصل بعد تجهيزه بالوسائل التعليمية واللوحات والأركان التعليمية."],
      },
      {
        id: "t8-2", title: "وسائل تعليمية جاهزة", description: "توثيق الوسائل التعليمية المستخدمة",
        type: "both" as const,
        formFields: [
          { id: "tool_name", label: "اسم الوسيلة", type: "text" as const, required: true },
          { id: "subject", label: "المادة", type: "text" as const },
          { id: "description", label: "وصف الوسيلة", type: "textarea" as const },
          { id: "usage", label: "كيفية الاستخدام", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد وسيلة تعليمية (عجلة الضرب) لمادة الرياضيات تساعد الطلاب على حفظ جدول الضرب بطريقة ممتعة.",
        ],
      },
    ],
  },
  {
    id: "t9", title: "الإدارة الصفية", maxScore: 5,
    description: "إدارة الصف بفاعلية وتوفير بيئة آمنة ومنظمة تدعم التعلم",
    subEvidences: [
      {
        id: "t9-1", title: "قوانين الصف", description: "توثيق قوانين الصف المتفق عليها مع الطلاب",
        type: "both" as const,
        formFields: [
          { id: "rules", label: "قوانين الصف", type: "textarea" as const, placeholder: "1. الاستئذان قبل الكلام\n2. احترام الآخرين\n3. ..." },
          { id: "rewards", label: "نظام المكافآت", type: "textarea" as const },
          { id: "consequences", label: "الإجراءات التصحيحية", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم وضع قوانين صفية بالتشاور مع الطلاب تتضمن: الاستئذان، احترام الآخرين، المحافظة على النظافة، الالتزام بالوقت.",
        ],
      },
      {
        id: "t9-2", title: "خطة دعم السلوك الإيجابي", description: "خطة لتعزيز السلوك الإيجابي",
        type: "report" as const,
        formFields: [
          { id: "positive_behaviors", label: "السلوكيات الإيجابية المستهدفة", type: "textarea" as const },
          { id: "reinforcement", label: "أساليب التعزيز", type: "textarea" as const },
          { id: "tracking", label: "آلية المتابعة", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد خطة لدعم السلوك الإيجابي تتضمن نظام نقاط ومكافآت أسبوعية للطلاب المتميزين سلوكياً.",
        ],
      },
    ],
  },
  {
    id: "t10", title: "تحليل نتائج المتعلمين وتشخيص مستوياتهم", maxScore: 5,
    description: "تحليل نتائج الطلاب وتشخيص نقاط القوة والضعف واتخاذ القرارات المناسبة",
    subEvidences: [
      {
        id: "t10-1", title: "تحليل نتائج مادة", description: "تحليل نتائج مادة لصف واحد",
        type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const, required: true },
          { id: "period", label: "الفترة", type: "select" as const, options: ["الأولى", "الثانية", "الثالثة", "النهائي"] },
          { id: "total_students", label: "عدد الطلاب", type: "number" as const },
          { id: "pass_count", label: "عدد الناجحين", type: "number" as const },
          { id: "fail_count", label: "عدد الراسبين", type: "number" as const },
          { id: "average", label: "المتوسط", type: "number" as const },
          { id: "analysis", label: "التحليل والتوصيات", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم تحليل نتائج مادة الرياضيات للصف 4/أ. عدد الطلاب 30، الناجحون 26، المتوسط 78%. أبرز نقاط الضعف: الكسور والأعداد العشرية.",
        ],
      },
      {
        id: "t10-2", title: "كشف تصنيف الطلاب", description: "تصنيف الطلاب حسب مستوى التحصيل",
        type: "report" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف والفصل", type: "text" as const },
          { id: "excellent", label: "متفوقون (90-100)", type: "textarea" as const, placeholder: "أسماء الطلاب..." },
          { id: "good", label: "جيد جداً (80-89)", type: "textarea" as const },
          { id: "average", label: "جيد (70-79)", type: "textarea" as const },
          { id: "below", label: "مقبول (60-69)", type: "textarea" as const },
          { id: "weak", label: "ضعيف (أقل من 60)", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم تصنيف طلاب الصف 4/أ في مادة الرياضيات: متفوقون 8، جيد جداً 10، جيد 7، مقبول 3، ضعيف 2.",
        ],
      },
    ],
  },
  {
    id: "t11", title: "تنوع أساليب التقويم", maxScore: 5,
    description: "استخدام أساليب تقويم متنوعة لقياس مستوى تحصيل الطلاب بشكل شامل",
    subEvidences: [
      {
        id: "t11-1", title: "اختبار تشخيصي / قبلي", description: "نموذج اختبار تشخيصي",
        type: "both" as const,
        formFields: [
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف", type: "text" as const },
          { id: "skills", label: "المهارات المستهدفة", type: "textarea" as const },
          { id: "questions_count", label: "عدد الأسئلة", type: "number" as const },
          { id: "results_summary", label: "ملخص النتائج", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم إعداد اختبار تشخيصي في مادة اللغة العربية لقياس مهارات القراءة والكتابة لطلاب الصف الثالث.",
        ],
      },
      {
        id: "t11-2", title: "اختبار فترة / نهائي", description: "نموذج اختبار فترة أو نهائي",
        type: "both" as const,
        formFields: [
          { id: "exam_type", label: "نوع الاختبار", type: "select" as const, options: ["فترة أولى", "فترة ثانية", "نهائي"] },
          { id: "subject", label: "المادة", type: "text" as const, required: true },
          { id: "class", label: "الصف", type: "text" as const },
          { id: "date", label: "التاريخ", type: "date" as const },
        ],
        aiSuggestions: [
          "تم إعداد اختبار الفترة الأولى لمادة العلوم للصف الخامس يتضمن أسئلة متنوعة (اختيار من متعدد، صح وخطأ، مقالي).",
        ],
      },
      {
        id: "t11-3", title: "تقويم أداء / ملاحظة", description: "نموذج تقويم أداء عملي",
        type: "report" as const,
        formFields: [
          { id: "skill", label: "المهارة المقاسة", type: "text" as const, required: true },
          { id: "criteria", label: "معايير التقويم", type: "textarea" as const },
          { id: "students", label: "الطلاب", type: "textarea" as const },
          { id: "results", label: "النتائج", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم تقويم أداء الطلاب في مهارة القراءة الجهرية باستخدام بطاقة ملاحظة تتضمن معايير: الطلاقة، النطق الصحيح، التعبير.",
        ],
      },
    ],
  },
  {
    id: "t12", title: "البرامج والأنشطة الطلابية", maxScore: 5,
    description: "المشاركة في تنفيذ البرامج والأنشطة المدرسية والمبادرات",
    subEvidences: [
      {
        id: "t12-1", title: "تقرير تنفيذ مبادرة مدرسية", description: "توثيق تنفيذ مبادرة مدرسية",
        type: "report" as const,
        formFields: [
          { id: "initiative_name", label: "اسم المبادرة", type: "text" as const, required: true },
          { id: "objectives", label: "أهداف المبادرة", type: "textarea" as const },
          { id: "target_group", label: "الفئة المستهدفة", type: "text" as const },
          { id: "activities", label: "الأنشطة المنفذة", type: "textarea" as const },
          { id: "date", label: "تاريخ التنفيذ", type: "date" as const },
          { id: "results", label: "النتائج", type: "textarea" as const },
        ],
        aiSuggestions: [
          "تم تنفيذ مبادرة (حديقتي الخضراء) بمشاركة 30 طالباً بهدف تعزيز الوعي البيئي. تم زراعة 20 شتلة في حديقة المدرسة.",
        ],
      },
      {
        id: "t12-2", title: "تقرير المشاركة في يوم عالمي", description: "توثيق المشاركة في الأيام العالمية",
        type: "report" as const,
        formFields: [
          { id: "event_name", label: "اسم المناسبة", type: "text" as const, required: true },
          { id: "date", label: "التاريخ", type: "date" as const },
          { id: "activities", label: "الأنشطة المنفذة", type: "textarea" as const },
          { id: "participants", label: "عدد المشاركين", type: "number" as const },
        ],
        aiSuggestions: [
          "تم المشاركة في فعاليات اليوم العالمي للغة العربية بتنفيذ مسابقة شعرية ومعرض للخط العربي بمشاركة 50 طالباً.",
        ],
      },
      {
        id: "t12-3", title: "صور/فيديو الأنشطة", description: "توثيق بصري للأنشطة والبرامج",
        type: "upload" as const,
        aiSuggestions: ["التقط صوراً أو فيديو للأنشطة والبرامج المنفذة لتوثيقها بصرياً."],
      },
    ],
  },
];

// ===== بنود بقية الوظائف (مختصرة مع شواهد فرعية) =====
const PRINCIPAL_CRITERIA = [
  { id: "p1", title: "القيادة المدرسية", maxScore: 5, description: "قيادة المدرسة بفاعلية نحو تحقيق رؤيتها", subEvidences: [
    { id: "p1-1", title: "الخطة التشغيلية للمدرسة", type: "both" as const, description: "إعداد الخطة التشغيلية", formFields: [{ id: "plan", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["تم إعداد الخطة التشغيلية للمدرسة متضمنة الأهداف والبرامج والمؤشرات."] },
    { id: "p1-2", title: "محاضر اجتماعات مجلس المدرسة", type: "both" as const, description: "توثيق اجتماعات المجلس", formFields: [{ id: "meeting", label: "ملخص الاجتماع", type: "textarea" as const }], aiSuggestions: ["تم عقد اجتماع مجلس المدرسة لمناقشة الخطة التشغيلية."] },
  ]},
  { id: "p2", title: "التخطيط الاستراتيجي", maxScore: 5, description: "وضع خطط استراتيجية واضحة", subEvidences: [
    { id: "p2-1", title: "الخطة الاستراتيجية", type: "both" as const, description: "الخطة الاستراتيجية للمدرسة", formFields: [{ id: "strategy", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["تم إعداد الخطة الاستراتيجية للمدرسة."] },
  ]},
  { id: "p3", title: "إدارة الموارد البشرية", maxScore: 5, description: "إدارة وتطوير الكوادر البشرية", subEvidences: [
    { id: "p3-1", title: "خطة التطوير المهني", type: "both" as const, description: "خطة تطوير المعلمين", formFields: [{ id: "plan", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["تم إعداد خطة التطوير المهني للمعلمين."] },
  ]},
  { id: "p4", title: "إدارة البيئة المدرسية", maxScore: 5, description: "توفير بيئة مدرسية آمنة", subEvidences: [
    { id: "p4-1", title: "تقرير السلامة المدرسية", type: "report" as const, description: "تقرير السلامة", formFields: [{ id: "report", label: "التقرير", type: "textarea" as const }], aiSuggestions: ["تم إعداد تقرير السلامة المدرسية."] },
  ]},
  { id: "p5", title: "العلاقات المجتمعية", maxScore: 5, description: "تعزيز الشراكة مع المجتمع", subEvidences: [
    { id: "p5-1", title: "سجل الشراكة المجتمعية", type: "both" as const, description: "توثيق الشراكات", formFields: [{ id: "partnership", label: "تفاصيل الشراكة", type: "textarea" as const }], aiSuggestions: ["تم توثيق الشراكة المجتمعية مع جهة خارجية."] },
  ]},
  { id: "p6", title: "التطوير المهني", maxScore: 5, description: "دعم التطوير المهني", subEvidences: [
    { id: "p6-1", title: "خطة التدريب", type: "both" as const, description: "خطة تدريب المعلمين", formFields: [{ id: "plan", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["تم إعداد خطة التدريب."] },
  ]},
  { id: "p7", title: "الإشراف على العملية التعليمية", maxScore: 5, description: "متابعة العملية التعليمية", subEvidences: [
    { id: "p7-1", title: "سجل الزيارات الصفية", type: "both" as const, description: "توثيق الزيارات", formFields: [{ id: "visits", label: "ملخص الزيارات", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ زيارات صفية للمعلمين."] },
  ]},
  { id: "p8", title: "تحسين نتائج الطلاب", maxScore: 5, description: "رفع مستوى تحصيل الطلاب", subEvidences: [
    { id: "p8-1", title: "تقرير تحليل النتائج", type: "both" as const, description: "تحليل نتائج الطلاب", formFields: [{ id: "analysis", label: "التحليل", type: "textarea" as const }], aiSuggestions: ["تم تحليل نتائج الطلاب."] },
  ]},
  { id: "p9", title: "إدارة الأزمات", maxScore: 5, description: "الاستعداد للأزمات", subEvidences: [
    { id: "p9-1", title: "خطة إدارة الأزمات", type: "both" as const, description: "خطة الطوارئ", formFields: [{ id: "plan", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["تم إعداد خطة إدارة الأزمات."] },
  ]},
];

const VICE_PRINCIPAL_CRITERIA = [
  { id: "v1", title: "المشاركة في التخطيط المدرسي", maxScore: 5, description: "المشاركة في إعداد الخطط", subEvidences: [{ id: "v1-1", title: "الخطة التشغيلية", type: "both" as const, description: "المشاركة في الخطة", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم المشاركة في إعداد الخطة التشغيلية."] }] },
  { id: "v2", title: "متابعة الحضور والغياب", maxScore: 5, description: "متابعة حضور الطلاب والمعلمين", subEvidences: [{ id: "v2-1", title: "سجل الحضور والغياب", type: "both" as const, description: "توثيق الحضور", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم متابعة الحضور والغياب بشكل يومي."] }] },
  { id: "v3", title: "الإشراف على الاختبارات", maxScore: 5, description: "تنظيم الاختبارات", subEvidences: [{ id: "v3-1", title: "جدول الاختبارات", type: "both" as const, description: "إعداد الجداول", formFields: [{ id: "schedule", label: "الجدول", type: "textarea" as const }], aiSuggestions: ["تم إعداد جدول الاختبارات."] }] },
  { id: "v4", title: "متابعة النظام والانضباط", maxScore: 5, description: "الحفاظ على النظام", subEvidences: [{ id: "v4-1", title: "سجل الملاحظات السلوكية", type: "both" as const, description: "توثيق السلوك", formFields: [{ id: "notes", label: "الملاحظات", type: "textarea" as const }], aiSuggestions: ["تم متابعة انضباط الطلاب."] }] },
  { id: "v5", title: "إدارة شؤون الطلاب", maxScore: 5, description: "إدارة شؤون الطلاب", subEvidences: [{ id: "v5-1", title: "سجل شؤون الطلاب", type: "both" as const, description: "توثيق الشؤون", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم إدارة شؤون الطلاب."] }] },
  { id: "v6", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "v6-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم التواصل مع أولياء الأمور."] }] },
  { id: "v7", title: "الإشراف على الأنشطة", maxScore: 5, description: "الإشراف على الأنشطة", subEvidences: [{ id: "v7-1", title: "خطة الأنشطة", type: "both" as const, description: "توثيق الأنشطة", formFields: [{ id: "activities", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم الإشراف على الأنشطة المدرسية."] }] },
];

const COUNSELOR_CRITERIA = [
  { id: "c1", title: "التوجيه والإرشاد الفردي", maxScore: 5, description: "تقديم خدمات الإرشاد الفردي", subEvidences: [{ id: "c1-1", title: "سجل الحالات الفردية", type: "both" as const, description: "توثيق الحالات", formFields: [{ id: "cases", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تقديم خدمات الإرشاد الفردي."] }] },
  { id: "c2", title: "التوجيه والإرشاد الجماعي", maxScore: 5, description: "تنفيذ برامج جماعية", subEvidences: [{ id: "c2-1", title: "خطة البرامج الجماعية", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "programs", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ برامج إرشاد جماعي."] }] },
  { id: "c3", title: "البرامج الوقائية", maxScore: 5, description: "تنفيذ البرامج الوقائية", subEvidences: [{ id: "c3-1", title: "خطة البرامج الوقائية", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "programs", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ برامج وقائية."] }] },
  { id: "c4", title: "البرامج العلاجية", maxScore: 5, description: "تنفيذ البرامج العلاجية", subEvidences: [{ id: "c4-1", title: "خطط العلاج", type: "both" as const, description: "توثيق العلاج", formFields: [{ id: "plans", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ برامج علاجية."] }] },
  { id: "c5", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "c5-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم التواصل مع أولياء الأمور."] }] },
  { id: "c6", title: "دراسة الحالات السلوكية", maxScore: 5, description: "دراسة الحالات", subEvidences: [{ id: "c6-1", title: "ملفات الحالات", type: "both" as const, description: "توثيق الدراسة", formFields: [{ id: "cases", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم دراسة الحالات السلوكية."] }] },
  { id: "c7", title: "التقارير والإحصاءات", maxScore: 5, description: "إعداد التقارير", subEvidences: [{ id: "c7-1", title: "التقارير الشهرية", type: "both" as const, description: "توثيق التقارير", formFields: [{ id: "reports", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم إعداد التقارير الشهرية."] }] },
];

const HEALTH_COUNSELOR_CRITERIA = [
  { id: "h1", title: "التثقيف الصحي", maxScore: 5, description: "تنفيذ برامج التثقيف الصحي", subEvidences: [{ id: "h1-1", title: "خطة التثقيف الصحي", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ برنامج تثقيف صحي."] }] },
  { id: "h2", title: "الإسعافات الأولية", maxScore: 5, description: "تقديم الإسعافات الأولية", subEvidences: [{ id: "h2-1", title: "سجل الإسعافات", type: "both" as const, description: "توثيق الإسعافات", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تقديم إسعافات أولية."] }] },
  { id: "h3", title: "البيئة الصحية المدرسية", maxScore: 5, description: "متابعة البيئة الصحية", subEvidences: [{ id: "h3-1", title: "تقارير المتابعة", type: "both" as const, description: "توثيق المتابعة", formFields: [{ id: "reports", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم متابعة البيئة الصحية."] }] },
  { id: "h4", title: "متابعة الحالات الصحية", maxScore: 5, description: "متابعة الحالات المزمنة", subEvidences: [{ id: "h4-1", title: "سجل الحالات المزمنة", type: "both" as const, description: "توثيق الحالات", formFields: [{ id: "cases", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم متابعة الحالات الصحية."] }] },
  { id: "h5", title: "التقارير الصحية", maxScore: 5, description: "إعداد التقارير الصحية", subEvidences: [{ id: "h5-1", title: "التقارير الشهرية", type: "both" as const, description: "توثيق التقارير", formFields: [{ id: "reports", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم إعداد التقارير الصحية."] }] },
];

const SUPERVISOR_CRITERIA = [
  { id: "s1", title: "التخطيط للإشراف", maxScore: 5, description: "إعداد خطط إشرافية", subEvidences: [{ id: "s1-1", title: "الخطة الإشرافية", type: "both" as const, description: "توثيق الخطة", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم إعداد الخطة الإشرافية."] }] },
  { id: "s2", title: "الزيارات الصفية", maxScore: 5, description: "تنفيذ الزيارات الصفية", subEvidences: [{ id: "s2-1", title: "سجل الزيارات", type: "both" as const, description: "توثيق الزيارات", formFields: [{ id: "visits", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ زيارات صفية."] }] },
  { id: "s3", title: "تطوير المعلمين مهنياً", maxScore: 5, description: "دعم التطوير المهني", subEvidences: [{ id: "s3-1", title: "خطة التطوير المهني", type: "both" as const, description: "توثيق التطوير", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم دعم التطوير المهني."] }] },
  { id: "s4", title: "تحليل نتائج الطلاب", maxScore: 5, description: "تحليل النتائج", subEvidences: [{ id: "s4-1", title: "تقارير التحليل", type: "both" as const, description: "توثيق التحليل", formFields: [{ id: "analysis", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تحليل نتائج الطلاب."] }] },
  { id: "s5", title: "البرامج التدريبية", maxScore: 5, description: "تنفيذ البرامج التدريبية", subEvidences: [{ id: "s5-1", title: "خطة التدريب", type: "both" as const, description: "توثيق التدريب", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ برامج تدريبية."] }] },
];

const LIBRARIAN_CRITERIA = [
  { id: "l1", title: "تنظيم مصادر التعلم", maxScore: 5, description: "تنظيم وفهرسة المصادر", subEvidences: [{ id: "l1-1", title: "سجل المصادر", type: "both" as const, description: "توثيق المصادر", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنظيم مصادر التعلم."] }] },
  { id: "l2", title: "خدمة المستفيدين", maxScore: 5, description: "تقديم خدمات متميزة", subEvidences: [{ id: "l2-1", title: "سجل الإعارة", type: "both" as const, description: "توثيق الإعارة", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تقديم خدمات الإعارة."] }] },
  { id: "l3", title: "التقنيات التعليمية", maxScore: 5, description: "توظيف التقنيات", subEvidences: [{ id: "l3-1", title: "تقرير التقنيات", type: "both" as const, description: "توثيق التقنيات", formFields: [{ id: "report", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم توظيف التقنيات التعليمية."] }] },
  { id: "l4", title: "البرامج والأنشطة", maxScore: 5, description: "تنفيذ البرامج", subEvidences: [{ id: "l4-1", title: "خطة البرامج", type: "both" as const, description: "توثيق البرامج", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ برامج تشجع على القراءة."] }] },
];

const KINDERGARTEN_CRITERIA = [
  { id: "k1", title: "التخطيط للأنشطة", maxScore: 5, description: "التخطيط لأنشطة تعليمية", subEvidences: [{ id: "k1-1", title: "خطة الأنشطة الأسبوعية", type: "both" as const, description: "توثيق الخطة", formFields: [{ id: "plan", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم إعداد خطة الأنشطة الأسبوعية."] }] },
  { id: "k2", title: "تنفيذ الأنشطة التعليمية", maxScore: 5, description: "تنفيذ أنشطة إبداعية", subEvidences: [{ id: "k2-1", title: "صور الأنشطة", type: "upload" as const, description: "توثيق بصري", aiSuggestions: ["التقط صوراً للأنشطة التعليمية."] }] },
  { id: "k3", title: "إدارة الصف", maxScore: 5, description: "إدارة الصف بطريقة مناسبة", subEvidences: [{ id: "k3-1", title: "قوانين الصف", type: "both" as const, description: "توثيق القوانين", formFields: [{ id: "rules", label: "القوانين", type: "textarea" as const }], aiSuggestions: ["تم وضع قوانين صفية مناسبة للأطفال."] }] },
  { id: "k4", title: "التقويم والمتابعة", maxScore: 5, description: "تقويم نمو الأطفال", subEvidences: [{ id: "k4-1", title: "سجل الملاحظات", type: "both" as const, description: "توثيق الملاحظات", formFields: [{ id: "notes", label: "الملاحظات", type: "textarea" as const }], aiSuggestions: ["تم متابعة نمو وتطور الأطفال."] }] },
  { id: "k5", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "k5-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم التواصل مع أولياء الأمور."] }] },
  { id: "k6", title: "البيئة التعليمية", maxScore: 5, description: "تهيئة بيئة آمنة", subEvidences: [{ id: "k6-1", title: "صور البيئة الصفية", type: "upload" as const, description: "توثيق بصري", aiSuggestions: ["التقط صوراً للبيئة الصفية."] }] },
];

const SPECIAL_ED_CRITERIA = [
  { id: "se1", title: "إعداد الخطة التعليمية الفردية (IEP)", maxScore: 5, description: "إعداد خطط فردية", subEvidences: [{ id: "se1-1", title: "الخطة التعليمية الفردية", type: "both" as const, description: "توثيق الخطة", formFields: [{ id: "iep", label: "ملخص الخطة", type: "textarea" as const }], aiSuggestions: ["تم إعداد الخطة التعليمية الفردية."] }] },
  { id: "se2", title: "تنفيذ البرامج التعليمية", maxScore: 5, description: "تنفيذ البرامج المناسبة", subEvidences: [{ id: "se2-1", title: "سجل الجلسات", type: "both" as const, description: "توثيق الجلسات", formFields: [{ id: "sessions", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ البرامج التعليمية."] }] },
  { id: "se3", title: "التقييم والتشخيص", maxScore: 5, description: "تقييم احتياجات الطلاب", subEvidences: [{ id: "se3-1", title: "تقارير التقييم", type: "both" as const, description: "توثيق التقييم", formFields: [{ id: "assessment", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تقييم احتياجات الطلاب."] }] },
  { id: "se4", title: "التواصل مع أولياء الأمور", maxScore: 5, description: "التواصل المستمر", subEvidences: [{ id: "se4-1", title: "سجل التواصل", type: "both" as const, description: "توثيق التواصل", formFields: [{ id: "comm", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم التواصل مع أولياء الأمور."] }] },
  { id: "se5", title: "التعديل السلوكي", maxScore: 5, description: "تطبيق برامج التعديل السلوكي", subEvidences: [{ id: "se5-1", title: "خطط التعديل السلوكي", type: "both" as const, description: "توثيق الخطط", formFields: [{ id: "plans", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تطبيق برامج التعديل السلوكي."] }] },
  { id: "se6", title: "التكامل مع المعلمين", maxScore: 5, description: "التعاون مع معلمي التعليم العام", subEvidences: [{ id: "se6-1", title: "خطط الدمج", type: "both" as const, description: "توثيق التعاون", formFields: [{ id: "plans", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم التعاون مع معلمي التعليم العام."] }] },
];

const ADMIN_ASSISTANT_CRITERIA = [
  { id: "a1", title: "الأعمال الإدارية", maxScore: 5, description: "تنفيذ الأعمال الإدارية بكفاءة", subEvidences: [{ id: "a1-1", title: "سجل المهام", type: "both" as const, description: "توثيق المهام", formFields: [{ id: "tasks", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تنفيذ الأعمال الإدارية."] }] },
  { id: "a2", title: "المراسلات والتقارير", maxScore: 5, description: "إعداد المراسلات", subEvidences: [{ id: "a2-1", title: "سجل الصادر والوارد", type: "both" as const, description: "توثيق المراسلات", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم إعداد المراسلات."] }] },
  { id: "a3", title: "متابعة الحضور والغياب", maxScore: 5, description: "متابعة الحضور", subEvidences: [{ id: "a3-1", title: "سجل الحضور", type: "both" as const, description: "توثيق الحضور", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم متابعة الحضور والغياب."] }] },
  { id: "a4", title: "خدمة المراجعين", maxScore: 5, description: "تقديم خدمة متميزة", subEvidences: [{ id: "a4-1", title: "سجل المراجعين", type: "both" as const, description: "توثيق الخدمة", formFields: [{ id: "record", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم تقديم خدمة متميزة للمراجعين."] }] },
  { id: "a5", title: "الأرشفة والتوثيق", maxScore: 5, description: "أرشفة الملفات", subEvidences: [{ id: "a5-1", title: "نظام الأرشفة", type: "both" as const, description: "توثيق الأرشفة", formFields: [{ id: "system", label: "الملخص", type: "textarea" as const }], aiSuggestions: ["تم أرشفة وتوثيق الملفات."] }] },
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
    subEvidenceId,
    type: "text",
    text: "",
    link: "",
    fileData: null,
    fileName: "",
    displayAs: "image",
    formData: {},
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
  const [showAI, setShowAI] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);

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
      data[c.id] = { score: 0, notes: "", evidences: [] };
    });
    setCriteriaData(data);
  };

  const handleSelectJob = (job: typeof JOB_TYPES[0]) => {
    setSelectedJob(job);
    initCriteriaData(job.criteria);
    setStep("criteria-list");
  };

  const updateScore = (criterionId: string, score: number) => {
    setCriteriaData((prev) => ({ ...prev, [criterionId]: { ...prev[criterionId], score } }));
  };

  const addEvidenceForSub = (criterionId: string, subEvidenceId: string) => {
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: {
        ...prev[criterionId],
        evidences: [...prev[criterionId].evidences, createEmptyEvidence(subEvidenceId)],
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

  const applyAISuggestion = (criterionId: string, subEvidenceId: string, suggestion: string) => {
    const newEv = createEmptyEvidence(subEvidenceId);
    newEv.text = suggestion;
    newEv.type = "text";
    setCriteriaData((prev) => ({
      ...prev,
      [criterionId]: { ...prev[criterionId], evidences: [...prev[criterionId].evidences, newEv] },
    }));
    setShowAI(null);
  };

  const saveReport = () => {
    const reportName = `${personalInfo.name || "تقرير"} - ${selectedJob?.title || ""} - ${new Date().toLocaleDateString("ar-SA")}`;
    const data = { personalInfo, criteriaData, jobId: selectedJob?.id, themeId: selectedTheme.id };
    localStorage.setItem(`sers_perf_${reportName}`, JSON.stringify(data));
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

  // ===== Step 1: اختيار الوظيفة =====
  if (step === "select") {
    return (
      <div className="min-h-screen bg-[#F8FAFC] p-6" dir="rtl">
        <div className="max-w-5xl mx-auto">
          <button onClick={() => navigate("/")} className="flex items-center gap-2 text-gray-500 hover:text-gray-700 mb-6">
            <ArrowLeft className="w-4 h-4" /><span className="text-sm">العودة للرئيسية</span>
          </button>
          <div className="text-center mb-10">
            <div className="w-16 h-16 rounded-2xl bg-emerald-100 flex items-center justify-center mx-auto mb-4"><span className="text-3xl">📊</span></div>
            <h1 className="text-3xl font-black text-gray-900 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>شواهد الأداء الوظيفي</h1>
            <p className="text-gray-500 max-w-lg mx-auto">اختر الوظيفة لبدء إعداد شواهد الأداء الوظيفي. كل بند يحتوي على شواهد فرعية مفصلة مع فورمات تفاعلية ودعم الذكاء الاصطناعي.</p>
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
          <p className="text-sm text-gray-500 mb-6">اضغط على أي بند لفتح الشواهد الفرعية وإدخال البيانات</p>

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
              const subCount = criterion.subEvidences?.length || 0;
              return (
                <motion.button key={criterion.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.02 }}
                  onClick={() => { setCurrentCriterionIndex(index); setStep("criterion-detail"); }}
                  className="w-full bg-white rounded-xl border border-gray-200 p-4 hover:border-emerald-300 hover:shadow-md transition-all text-right group">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center text-emerald-700 font-bold text-sm shrink-0 group-hover:bg-emerald-100">
                      {index + 1}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-bold text-gray-800 text-sm mb-0.5" style={{ fontFamily: "'Tajawal', sans-serif" }}>{criterion.title}</h3>
                      <p className="text-xs text-gray-500">{criterion.description}</p>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      <div className="text-center">
                        <div className="text-lg font-black" style={{ color: data.score >= 4 ? '#16A34A' : data.score >= 3 ? '#CA8A04' : '#9CA3AF' }}>{data.score}</div>
                        <div className="text-[10px] text-gray-400">من {criterion.maxScore}</div>
                      </div>
                      <div className="flex flex-col items-center gap-0.5">
                        <span className="text-[10px] text-gray-400">{evidenceCount} شاهد</span>
                        <span className="text-[10px] text-gray-400">{subCount} فرعي</span>
                      </div>
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
    const data = criteriaData[currentCriterion.id] || { score: 0, notes: "", evidences: [] };
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
            {currentCriterion.subEvidences?.map((sub: any) => {
              const subEvidences = data.evidences.filter(e => e.subEvidenceId === sub.id);
              const isExpanded = expandedSubEvidence === sub.id;
              return (
                <div key={sub.id} className="bg-white rounded-xl border border-gray-200 overflow-hidden">
                  {/* Sub Header */}
                  <div role="button" tabIndex={0} onClick={() => setExpandedSubEvidence(isExpanded ? null : sub.id)}
                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setExpandedSubEvidence(isExpanded ? null : sub.id); }}
                    className="w-full flex items-center justify-between p-4 hover:bg-gray-50 transition-colors text-right cursor-pointer">
                    <div className="flex items-center gap-3">
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-sm ${sub.type === 'report' ? 'bg-blue-50 text-blue-600' : sub.type === 'upload' ? 'bg-orange-50 text-orange-600' : 'bg-purple-50 text-purple-600'}`}>
                        {sub.type === 'report' ? <FileText className="w-4 h-4" /> : sub.type === 'upload' ? <Upload className="w-4 h-4" /> : <Layers className="w-4 h-4" />}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800 text-sm">{sub.title}</h3>
                        <p className="text-xs text-gray-500">{sub.description} · {subEvidences.length} شاهد مرفق</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {sub.aiSuggestions && (
                        <button onClick={(e) => { e.stopPropagation(); setShowAI(showAI === sub.id ? null : sub.id); }}
                          className="p-2 rounded-lg bg-violet-50 text-violet-600 hover:bg-violet-100" title="اقتراحات الذكاء الاصطناعي">
                          <Sparkles className="w-4 h-4" />
                        </button>
                      )}
                      {isExpanded ? <ChevronUp className="w-5 h-5 text-gray-400" /> : <ChevronDown className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {/* AI Suggestions Popup */}
                  <AnimatePresence>
                    {showAI === sub.id && sub.aiSuggestions && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-violet-100 bg-violet-50/50 overflow-hidden">
                        <div className="p-4">
                          <div className="flex items-center gap-2 mb-3">
                            <Bot className="w-4 h-4 text-violet-600" />
                            <span className="text-sm font-bold text-violet-700">اقتراحات الذكاء الاصطناعي</span>
                          </div>
                          <div className="space-y-2">
                            {sub.aiSuggestions.map((suggestion: string, idx: number) => (
                              <div key={idx} className="bg-white rounded-lg p-3 border border-violet-200 flex items-start gap-3">
                                <Lightbulb className="w-4 h-4 text-violet-500 mt-0.5 shrink-0" />
                                <p className="text-sm text-gray-700 flex-1 leading-relaxed">{suggestion}</p>
                                <button onClick={() => applyAISuggestion(currentCriterion.id, sub.id, suggestion)}
                                  className="text-xs bg-violet-600 text-white px-3 py-1.5 rounded-md hover:bg-violet-700 shrink-0">استخدام</button>
                              </div>
                            ))}
                          </div>
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Expanded Content */}
                  <AnimatePresence>
                    {isExpanded && (
                      <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                        className="border-t border-gray-100 overflow-hidden">
                        <div className="p-4">
                          {/* Form Fields */}
                          {(sub.type === 'report' || sub.type === 'both') && sub.formFields && (
                            <div className="mb-4">
                              <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><FileText className="w-4 h-4 text-blue-500" />نموذج التقرير</h4>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {sub.formFields.map((field: FormField) => {
                                  const firstEv = subEvidences.find(e => e.formData) || (subEvidences.length === 0 ? null : subEvidences[0]);
                                  const evId = firstEv?.id;
                                  if (!evId && subEvidences.length === 0) {
                                    addEvidenceForSub(currentCriterion.id, sub.id);
                                    return null;
                                  }
                                  if (!evId) return null;
                                  const value = firstEv?.formData?.[field.id] || '';
                                  return (
                                    <div key={field.id} className={field.type === 'textarea' ? 'md:col-span-2' : ''}>
                                      <label className="block text-xs font-medium text-gray-600 mb-1">
                                        {field.label} {field.required && <span className="text-red-500">*</span>}
                                      </label>
                                      {field.type === 'textarea' ? (
                                        <textarea value={value} onChange={(e) => updateFormField(currentCriterion.id, evId, field.id, e.target.value)}
                                          placeholder={field.placeholder} rows={3}
                                          className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400 resize-none" />
                                      ) : field.type === 'select' ? (
                                        <select value={value} onChange={(e) => updateFormField(currentCriterion.id, evId, field.id, e.target.value)}
                                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400">
                                          <option value="">اختر...</option>
                                          {field.options?.map(opt => <option key={opt} value={opt}>{opt}</option>)}
                                        </select>
                                      ) : (
                                        <input type={field.type === 'date' ? 'date' : field.type === 'number' ? 'number' : 'text'}
                                          value={value} onChange={(e) => updateFormField(currentCriterion.id, evId, field.id, e.target.value)}
                                          placeholder={field.placeholder}
                                          className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20 focus:border-emerald-400" />
                                      )}
                                    </div>
                                  );
                                })}
                              </div>
                            </div>
                          )}

                          {/* Upload / Evidence Area */}
                          <div className="mb-3">
                            <h4 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2"><Upload className="w-4 h-4 text-orange-500" />إرفاق الشواهد</h4>
                            <div className="flex flex-wrap gap-2 mb-3">
                              <button onClick={() => addEvidenceForSub(currentCriterion.id, sub.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-emerald-400 hover:text-emerald-600 text-xs">
                                <Type className="w-3.5 h-3.5" />نص
                              </button>
                              <button onClick={() => triggerFileUpload(currentCriterion.id, sub.id)} className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-blue-400 hover:text-blue-600 text-xs">
                                <Image className="w-3.5 h-3.5" />صورة / ملف / فيديو
                              </button>
                              <button onClick={() => { const ev = createEmptyEvidence(sub.id); ev.type = 'link'; setCriteriaData(prev => ({ ...prev, [currentCriterion.id]: { ...prev[currentCriterion.id], evidences: [...prev[currentCriterion.id].evidences, ev] } })); }}
                                className="flex items-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-gray-300 text-gray-500 hover:border-purple-400 hover:text-purple-600 text-xs">
                                <LinkIcon className="w-3.5 h-3.5" />رابط
                              </button>
                            </div>

                            {/* Evidence Items */}
                            <div className="space-y-2">
                              {subEvidences.map((ev) => (
                                <div key={ev.id} className="bg-gray-50 rounded-lg p-3 border border-gray-200">
                                  <div className="flex items-center justify-between mb-2">
                                    <div className="flex items-center gap-2">
                                      {ev.type === 'text' && <Type className="w-4 h-4 text-gray-500" />}
                                      {ev.type === 'image' && <Image className="w-4 h-4 text-blue-500" />}
                                      {ev.type === 'link' && <LinkIcon className="w-4 h-4 text-purple-500" />}
                                      {ev.type === 'file' && <FileText className="w-4 h-4 text-orange-500" />}
                                      {ev.type === 'video' && <Video className="w-4 h-4 text-red-500" />}
                                      <span className="text-xs text-gray-500">
                                        {ev.type === 'text' ? 'نص' : ev.type === 'image' ? 'صورة' : ev.type === 'link' ? 'رابط' : ev.type === 'file' ? 'ملف' : 'فيديو'}
                                      </span>
                                    </div>
                                    <button onClick={() => removeEvidence(currentCriterion.id, ev.id)} className="text-red-400 hover:text-red-600"><Trash2 className="w-4 h-4" /></button>
                                  </div>

                                  {ev.type === 'text' && !ev.formData && (
                                    <textarea value={ev.text} onChange={(e) => updateEvidence(currentCriterion.id, ev.id, { text: e.target.value })}
                                      placeholder="اكتب نص الشاهد هنا..." rows={2}
                                      className="w-full px-3 py-2 rounded-lg border border-gray-200 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                  )}

                                  {ev.type === 'link' && (
                                    <input type="url" value={ev.link} onChange={(e) => updateEvidence(currentCriterion.id, ev.id, { link: e.target.value })}
                                      placeholder="https://example.com" dir="ltr"
                                      className="w-full px-3 py-2.5 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/20" />
                                  )}

                                  {ev.type === 'image' && ev.fileData && (
                                    <div>
                                      <img src={ev.fileData} alt={ev.fileName} className="max-h-48 rounded-lg border border-gray-200 mb-2" />
                                      <div className="flex items-center gap-2">
                                        <span className="text-xs text-gray-500">عرض عند الطباعة:</span>
                                        <button onClick={() => updateEvidence(currentCriterion.id, ev.id, { displayAs: 'image' })}
                                          className={`text-xs px-2 py-1 rounded ${ev.displayAs === 'image' ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                                          <Image className="w-3 h-3 inline ml-1" />صورة
                                        </button>
                                        <button onClick={() => updateEvidence(currentCriterion.id, ev.id, { displayAs: 'qr' })}
                                          className={`text-xs px-2 py-1 rounded ${ev.displayAs === 'qr' ? 'bg-purple-100 text-purple-700' : 'bg-gray-100 text-gray-500'}`}>
                                          <QrCode className="w-3 h-3 inline ml-1" />باركود
                                        </button>
                                      </div>
                                    </div>
                                  )}

                                  {(ev.type === 'video' || ev.type === 'file') && ev.fileData && (
                                    <div className="flex items-center gap-2 bg-white p-2 rounded-lg border border-gray-200">
                                      <FileText className="w-5 h-5 text-gray-400" />
                                      <span className="text-sm text-gray-700">{ev.fileName}</span>
                                      <span className="text-xs text-gray-400 mr-auto">سيظهر كباركود QR عند الطباعة</span>
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
                </div>
              );
            })}
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

          {/* Score Summary */}
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
                <p className="text-sm text-gray-500">المدرسة: <strong className="text-gray-800">{personalInfo.school || '—'}</strong></p>
              </div>
            </div>
          </div>

          {/* Criteria Summary Table */}
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

          {/* Theme Selection */}
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
          {/* Controls */}
          <div className="flex items-center justify-between mb-4 bg-white rounded-xl p-4 shadow-sm border border-gray-200 sticky top-2 z-10">
            <button onClick={() => setStep('final-review')} className="flex items-center gap-1.5 text-gray-500 hover:text-gray-700 text-sm">
              <ArrowRight className="w-4 h-4" />العودة
            </button>
            <div className="flex gap-2">
              <button onClick={() => printElement('preview-content')} className="flex items-center gap-1.5 bg-gray-100 text-gray-700 px-4 py-2 rounded-lg text-sm hover:bg-gray-200">
                <Printer className="w-4 h-4" />طباعة
              </button>
              <button onClick={handleExportPDF} disabled={isExporting}
                className="flex items-center gap-1.5 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-emerald-700 disabled:opacity-50">
                <Download className="w-4 h-4" />{isExporting ? 'جاري التصدير...' : 'تصدير PDF'}
              </button>
            </div>
          </div>

          {/* Preview Content */}
          <div id="preview-content" className="bg-white rounded-xl shadow-lg overflow-hidden" style={{ fontFamily: "'Tajawal', 'Cairo', sans-serif" }}>
            {/* Header */}
            <div className="p-6 text-center" style={{ background: theme.headerBg, color: theme.headerText }}>
              <h1 className="text-2xl font-black mb-1">شواهد الأداء الوظيفي</h1>
              <p className="text-sm opacity-90">{selectedJob?.title} - {personalInfo.year}</p>
            </div>

            {/* Personal Info */}
            <div className="p-5 border-b" style={{ borderColor: theme.borderColor }}>
              <div className="grid grid-cols-2 gap-3 text-sm">
                <div><span className="text-gray-500">الاسم:</span> <strong>{personalInfo.name || '—'}</strong></div>
                <div><span className="text-gray-500">المدرسة:</span> <strong>{personalInfo.school || '—'}</strong></div>
                <div><span className="text-gray-500">المقيّم:</span> <strong>{personalInfo.evaluator || '—'}</strong></div>
                <div><span className="text-gray-500">التاريخ:</span> <strong>{personalInfo.date || '—'}</strong></div>
              </div>
            </div>

            {/* Criteria Details */}
            {selectedJob?.criteria.map((c: any, i: number) => {
              const d = criteriaData[c.id];
              if (!d) return null;
              return (
                <div key={c.id} className="p-5 border-b" style={{ borderColor: theme.borderColor }}>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800">
                      <span className="inline-block w-7 h-7 rounded-md text-white text-sm text-center leading-7 ml-2" style={{ background: theme.accent }}>{i + 1}</span>
                      {c.title}
                    </h3>
                    <span className="font-bold text-lg" style={{ color: d.score >= 4 ? '#16A34A' : d.score >= 3 ? '#CA8A04' : '#9CA3AF' }}>{d.score}/{c.maxScore}</span>
                  </div>
                  {d.evidences.length > 0 && (
                    <div className="space-y-2 mr-9">
                      {d.evidences.map((ev, idx) => (
                        <div key={ev.id} className="bg-gray-50 rounded-lg p-3 text-sm">
                          {ev.formData && Object.keys(ev.formData).length > 0 ? (
                            <div className="space-y-1">
                              {Object.entries(ev.formData).filter(([,v]) => v).map(([k, v]) => (
                                <div key={k}><span className="text-gray-500">{k}:</span> {v}</div>
                              ))}
                            </div>
                          ) : ev.type === 'text' && ev.text ? (
                            <p>{ev.text}</p>
                          ) : ev.type === 'image' && ev.fileData ? (
                            ev.displayAs === 'image' ? (
                              <img src={ev.fileData} alt="" className="max-h-40 rounded" />
                            ) : (
                              <div className="flex items-center gap-2"><QrCode className="w-5 h-5" /><span>باركود QR للصورة</span></div>
                            )
                          ) : ev.type === 'link' && ev.link ? (
                            <div className="flex items-center gap-2"><QrCode className="w-5 h-5 text-purple-500" /><span>{ev.link}</span></div>
                          ) : ev.fileName ? (
                            <div className="flex items-center gap-2"><FileText className="w-4 h-4" /><span>{ev.fileName}</span></div>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {/* Summary */}
            <div className="p-6 text-center" style={{ background: theme.headerBg, color: theme.headerText }}>
              <div className="text-4xl font-black mb-1">{percentage}%</div>
              <div className="text-lg font-bold">{grade.label}</div>
              <div className="text-sm opacity-80 mt-1">{totalScore} من {maxScore}</div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
