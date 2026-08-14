/**
 * Performance Evidence — Job Types Registry
 * سجل الوظائف مع معاييرها (criteria)
 * مستخرج من PerformanceEvidence.tsx
 */
import {
  GraduationCap, Building2, ClipboardList, Users, Heart,
  Megaphone, FlaskConical, BookOpen, Baby, Accessibility,
  Briefcase, Search as SearchIcon,
} from 'lucide-react';
import type { JobType, Criterion, FormField } from './pe-types';
import { STANDARDS } from '@/lib/standards-data';
import {
  PRINCIPAL_STANDARDS, VICE_PRINCIPAL_STANDARDS, COUNSELOR_STANDARDS,
  HEALTH_COUNSELOR_STANDARDS, ACTIVITY_LEADER_STANDARDS, LAB_TECHNICIAN_STANDARDS,
  KINDERGARTEN_STANDARDS, SUPERVISOR_STANDARDS, SPECIAL_ED_STANDARDS,
} from '@/lib/all-jobs-standards';

// ─── Criterion Builders ──────────────────────────────────

/** بناء بنود بسيطة (للوظائف بدون معايير رسمية) */
export function makeSimpleCriteria(
  prefix: string,
  items: { id: string; title: string; desc: string; subTitle: string; formFields?: FormField[] }[]
): Criterion[] {
  return items.map(item => ({
    id: `${prefix}_${item.id}`,
    title: item.title,
    maxScore: 5,
    description: item.desc,
    subEvidences: [{
      id: `${prefix}_${item.id}_sub`,
      title: item.subTitle,
      description: item.desc,
      type: 'both' as const,
      formFields: item.formFields || [
        { id: 'report_title', label: 'الموضوع', type: 'text' as const, placeholder: 'أدخل موضوع الشاهد...' },
        { id: 'title', label: 'العنوان', type: 'text' as const, placeholder: 'أدخل العنوان...' },
        { id: 'date', label: 'التاريخ', type: 'date' as const },
        { id: 'details', label: 'التفاصيل', type: 'textarea' as const, placeholder: 'أدخل التفاصيل...' },
        { id: 'notes', label: 'ملاحظات', type: 'textarea' as const, placeholder: 'ملاحظات إضافية...' },
      ],
    }],
  }));
}

/** بناء بنود من المعايير الرسمية (3 مستويات) */
export function buildStandardsCriteria(standards: { id: string; title: string; weight: number; items: any[] }[]): Criterion[] {
  return standards.map(std => ({
    id: std.id,
    title: std.title,
    maxScore: 5,
    description: `${std.items.length} بند · الوزن ${std.weight}%`,
    subEvidences: std.items.flatMap(item => [
      {
        id: item.id,
        title: item.text,
        description: (item.suggestedEvidence || []).join(' · '),
        type: 'both' as const,
        formFields: [
          { id: 'report_title', label: 'الموضوع', type: 'text' as const, placeholder: 'أدخل موضوع الشاهد...' },
          { id: 'evidence_desc', label: 'وصف الشاهد', type: 'textarea' as const, placeholder: 'اكتب وصفاً للشاهد المقدم...' },
          { id: 'date', label: 'التاريخ', type: 'date' as const },
          { id: 'notes', label: 'ملاحظات', type: 'textarea' as const, placeholder: 'ملاحظات إضافية...' },
        ],
      },
      ...(item.subItems || []).map((sub: any) => ({
        id: sub.id,
        title: sub.title,
        description: (sub.suggestedEvidence || []).join(' · '),
        type: 'both' as const,
        isSubItem: true,
        parentTitle: item.text,
        formFields: [
          { id: 'report_title', label: 'الموضوع', type: 'text' as const, placeholder: 'أدخل موضوع الشاهد...' },
          { id: 'evidence_desc', label: 'وصف الشاهد', type: 'textarea' as const, placeholder: 'اكتب وصفاً للشاهد المقدم...' },
          { id: 'date', label: 'التاريخ', type: 'date' as const },
          { id: 'notes', label: 'ملاحظات', type: 'textarea' as const, placeholder: 'ملاحظات إضافية...' },
        ],
      })),
    ]),
  }));
}

// ─── Pre-built Criteria ──────────────────────────────────
const TEACHER_CRITERIA = buildStandardsCriteria(STANDARDS);
const PRINCIPAL_CRITERIA = buildStandardsCriteria(PRINCIPAL_STANDARDS);
const VICE_PRINCIPAL_CRITERIA = buildStandardsCriteria(VICE_PRINCIPAL_STANDARDS);
const COUNSELOR_CRITERIA = buildStandardsCriteria(COUNSELOR_STANDARDS);
const HEALTH_COUNSELOR_CRITERIA = buildStandardsCriteria(HEALTH_COUNSELOR_STANDARDS);
const ACTIVITY_LEADER_CRITERIA = buildStandardsCriteria(ACTIVITY_LEADER_STANDARDS);
const LAB_TECHNICIAN_CRITERIA = buildStandardsCriteria(LAB_TECHNICIAN_STANDARDS);
const KINDERGARTEN_CRITERIA = buildStandardsCriteria(KINDERGARTEN_STANDARDS);
const SUPERVISOR_CRITERIA = buildStandardsCriteria(SUPERVISOR_STANDARDS);
const SPECIAL_ED_CRITERIA = buildStandardsCriteria(SPECIAL_ED_STANDARDS);

const LIBRARIAN_CRITERIA = makeSimpleCriteria('l', [
  { id: '1', title: 'تنظيم مصادر التعلم', desc: 'تنظيم وفهرسة المصادر', subTitle: 'سجل المصادر' },
  { id: '2', title: 'خدمة المستفيدين', desc: 'تقديم خدمات متميزة', subTitle: 'سجل الإعارة' },
  { id: '3', title: 'التقنيات التعليمية', desc: 'توظيف التقنيات', subTitle: 'تقرير التقنيات' },
  { id: '4', title: 'البرامج والأنشطة', desc: 'تنفيذ البرامج', subTitle: 'خطة البرامج' },
]);

const ADMIN_ASSISTANT_CRITERIA = makeSimpleCriteria('a', [
  { id: '1', title: 'الأعمال الإدارية', desc: 'تنفيذ الأعمال الإدارية', subTitle: 'سجل المهام' },
  { id: '2', title: 'المراسلات والتقارير', desc: 'إعداد المراسلات', subTitle: 'سجل الصادر والوارد' },
  { id: '3', title: 'متابعة الحضور والغياب', desc: 'متابعة الحضور', subTitle: 'سجل الحضور' },
  { id: '4', title: 'خدمة المراجعين', desc: 'تقديم خدمة متميزة', subTitle: 'سجل المراجعين' },
  { id: '5', title: 'الأرشفة والتوثيق', desc: 'أرشفة الملفات', subTitle: 'نظام الأرشفة' },
]);

// ─── Job Types Registry ──────────────────────────────────
export const JOB_TYPES: JobType[] = [
  { id: 'teacher', title: 'معلم / معلمة', icon: GraduationCap, emoji: '👨‍🏫', criteria: TEACHER_CRITERIA, hasStandards: true, color: '#0097A7', desc: 'نظام شامل يغطي 11 معيار و 45 مؤشر أداء وفق المعايير الرسمية' },
  { id: 'principal', title: 'مدير / مديرة مدرسة', icon: Building2, emoji: '👔', criteria: PRINCIPAL_CRITERIA, hasStandards: true, color: '#2563EB', desc: 'معايير القيادة المدرسية والإدارة التعليمية والتطوير المهني' },
  { id: 'vice_principal', title: 'وكيل / وكيلة مدرسة', icon: ClipboardList, emoji: '📋', criteria: VICE_PRINCIPAL_CRITERIA, hasStandards: true, color: '#7C3AED', desc: 'معايير الإشراف على الشؤون التعليمية والإدارية بالمدرسة' },
  { id: 'counselor', title: 'موجه/ة طلابي/ة', icon: Users, emoji: '🤝', criteria: COUNSELOR_CRITERIA, hasStandards: true, color: '#0891B2', desc: 'معايير التوجيه والإرشاد الطلابي والدعم النفسي والاجتماعي' },
  { id: 'health_counselor', title: 'معلم/ة مسند له توجيه صحي', icon: Heart, emoji: '🏥', criteria: HEALTH_COUNSELOR_CRITERIA, hasStandards: true, color: '#DC2626', desc: 'معايير التوعية الصحية والإسعافات الأولية والبيئة المدرسية' },
  { id: 'activity_leader', title: 'معلم/ة مسند له نشاط (رائد/ة نشاط)', icon: Megaphone, emoji: '🏆', criteria: ACTIVITY_LEADER_CRITERIA, hasStandards: true, color: '#F59E0B', desc: 'معايير تخطيط وتنفيذ الأنشطة الطلابية والبرامج اللاصفية' },
  { id: 'lab_technician', title: 'محضر/ة مختبر', icon: FlaskConical, emoji: '🧪', criteria: LAB_TECHNICIAN_CRITERIA, hasStandards: true, color: '#8B5CF6', desc: 'معايير إعداد وتجهيز المختبرات وتطبيق معايير السلامة' },
  { id: 'supervisor', title: 'مشرف/ة تربوي/ة (التشكيلات الإشرافية)', icon: SearchIcon, emoji: '🔍', criteria: SUPERVISOR_CRITERIA, hasStandards: true, color: '#CA8A04', desc: 'معايير الإشراف التربوي والمتابعة الميدانية وتطوير الأداء' },
  { id: 'kindergarten', title: 'معلمة رياض أطفال', icon: Baby, emoji: '🧒', criteria: KINDERGARTEN_CRITERIA, hasStandards: true, color: '#EC4899', desc: 'معايير رعاية الطفولة المبكرة والتعلم باللعب والتنمية الشاملة' },
  { id: 'librarian', title: 'أمين/ة مصادر تعلم', icon: BookOpen, emoji: '📚', criteria: LIBRARIAN_CRITERIA, hasStandards: false, color: '#9333EA', desc: 'معايير إدارة مصادر التعلم وتنظيم المكتبة وخدمة المستفيدين' },
  { id: 'special_ed', title: 'معلم/ة تربية خاصة', icon: Accessibility, emoji: '♿', criteria: SPECIAL_ED_CRITERIA, hasStandards: true, color: '#F97316', desc: 'معايير التربية الخاصة والخطط الفردية والتقييم والتشخيص والدمج' },
  { id: 'admin_assistant', title: 'مساعد/ة إداري/ة', icon: Briefcase, emoji: '🗂️', criteria: ADMIN_ASSISTANT_CRITERIA, hasStandards: false, color: '#6B7280', desc: 'معايير الدعم الإداري والتنظيم المكتبي والمتابعة اليومية' },
];

/** الحصول على الوظيفة حسب المعرّف */
export function getJobById(jobId: string): JobType | undefined {
  return JOB_TYPES.find(j => j.id === jobId);
}
