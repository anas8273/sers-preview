/**
 * Report Schemas — تعريفات JSON لكل أنواع التقارير
 * كل schema يحوي الأقسام والحقول اللازمة لنوع التقرير
 * مستقبلاً: تُحمّل من API بدل الكود
 */
import type { FormSchema } from '@/lib/form-schema';

// ═══════════════════════════════════════════════════════════════
// 1. تقرير أداء الطلاب
// ═══════════════════════════════════════════════════════════════
export const STUDENT_PERFORMANCE_SCHEMA: FormSchema = {
  id: 'student-performance',
  title: 'تقرير أداء الطلاب',
  description: 'تقرير شامل عن مستوى أداء الطلاب في المادة',
  version: 1,
  sections: [
    {
      id: 'basic-info',
      title: 'البيانات الأساسية',
      columns: 2,
      fields: [
        { id: 'subject', label: 'المادة', type: 'text', placeholder: 'اسم المادة', required: true, aiEnabled: true },
        { id: 'class', label: 'الصف / الفصل', type: 'text', placeholder: 'مثال: ثالث متوسط - أ', required: true },
        { id: 'semester', label: 'الفصل الدراسي', type: 'select', options: ['الأول', 'الثاني', 'الثالث'], required: true },
        { id: 'year', label: 'العام الدراسي', type: 'text', placeholder: '1446هـ' },
      ],
    },
    {
      id: 'statistics',
      title: 'الإحصائيات',
      columns: 2,
      fields: [
        { id: 'totalStudents', label: 'عدد الطلاب', type: 'number', placeholder: '30' },
        { id: 'excellentCount', label: 'عدد المتفوقين', type: 'number', placeholder: '5' },
        { id: 'failCount', label: 'عدد المتعثرين', type: 'number', placeholder: '3' },
        { id: 'average', label: 'متوسط الدرجات', type: 'number', placeholder: '78' },
      ],
    },
    {
      id: 'analysis',
      title: 'التحليل والتوصيات',
      columns: 1,
      collapsible: true,
      fields: [
        { id: 'strengths', label: 'نقاط القوة', type: 'textarea', placeholder: 'أبرز نقاط القوة لدى الطلاب...', aiEnabled: true, aiPrompt: 'اكتب نقاط قوة لأداء طلاب في مادة {subject}' },
        { id: 'weaknesses', label: 'نقاط الضعف', type: 'textarea', placeholder: 'أبرز نقاط الضعف والتحديات...', aiEnabled: true },
        { id: 'recommendations', label: 'التوصيات', type: 'textarea', placeholder: 'التوصيات والمقترحات لتحسين الأداء...', aiEnabled: true },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 2. تقرير النشاط المهني
// ═══════════════════════════════════════════════════════════════
export const TEACHER_ACTIVITY_SCHEMA: FormSchema = {
  id: 'teacher-activity',
  title: 'تقرير النشاط المهني',
  description: 'توثيق الأنشطة والإنجازات المهنية للمعلم',
  version: 1,
  sections: [
    {
      id: 'activity-info',
      title: 'بيانات النشاط',
      columns: 2,
      fields: [
        { id: 'activityName', label: 'اسم النشاط', type: 'text', placeholder: 'مثال: ورشة عمل تطوير المهارات', required: true, aiEnabled: true },
        { id: 'activityType', label: 'نوع النشاط', type: 'select', options: ['دورة تدريبية', 'ورشة عمل', 'ندوة', 'مؤتمر', 'بحث', 'مشاركة مجتمعية', 'أخرى'], required: true },
        { id: 'startDate', label: 'تاريخ البدء', type: 'date', required: true },
        { id: 'endDate', label: 'تاريخ الانتهاء', type: 'date' },
        { id: 'location', label: 'مكان التنفيذ', type: 'text', placeholder: 'المدرسة / مركز تدريب...' },
        { id: 'beneficiaries', label: 'المستفيدون', type: 'text', placeholder: 'طلاب / معلمون / أولياء أمور...' },
      ],
    },
    {
      id: 'details',
      title: 'تفاصيل النشاط',
      columns: 1,
      collapsible: true,
      fields: [
        { id: 'goals', label: 'الأهداف', type: 'list', placeholder: 'أضف هدف...', aiEnabled: true },
        { id: 'description', label: 'وصف النشاط', type: 'textarea', placeholder: 'وصف تفصيلي للنشاط وآليات التنفيذ...', aiEnabled: true },
        { id: 'outcomes', label: 'النتائج والمخرجات', type: 'textarea', placeholder: 'أبرز النتائج المتحققة...', aiEnabled: true },
        { id: 'challenges', label: 'التحديات', type: 'textarea', placeholder: 'التحديات التي واجهت التنفيذ...' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 3. تقرير عن برنامج
// ═══════════════════════════════════════════════════════════════
export const PROGRAM_REPORT_SCHEMA: FormSchema = {
  id: 'program-report',
  title: 'تقرير عن برنامج',
  description: 'تقرير تفصيلي عن برنامج تعليمي أو تربوي',
  version: 1,
  sections: [
    {
      id: 'program-info',
      title: 'بيانات البرنامج',
      columns: 2,
      fields: [
        { id: 'subject', label: 'الموضوع', type: 'text', required: true, aiEnabled: true, placeholder: 'عنوان البرنامج' },
        { id: 'executionDate', label: 'تاريخ التنفيذ', type: 'date', required: true },
        { id: 'field', label: 'المجال', type: 'text', placeholder: 'المجال التعليمي' },
        { id: 'executor', label: 'المنفذ/ون', type: 'text', placeholder: 'أسماء المنفذين' },
        { id: 'participants', label: 'المشارك/ون', type: 'text', placeholder: 'أسماء المشاركين' },
        { id: 'beneficiaries', label: 'المستفيدون', type: 'text', placeholder: 'الفئة المستهدفة' },
        { id: 'location', label: 'مكان التنفيذ', type: 'text', placeholder: 'المكان' },
        { id: 'duration', label: 'مدة التنفيذ', type: 'text', placeholder: 'ساعتان / يوم واحد...' },
      ],
    },
    {
      id: 'program-details',
      title: 'التفاصيل',
      columns: 1,
      collapsible: true,
      fields: [
        { id: 'goals', label: 'الأهداف', type: 'list', placeholder: 'أضف هدف...', aiEnabled: true },
        { id: 'steps', label: 'خطوات التنفيذ', type: 'list', placeholder: 'أضف خطوة...', aiEnabled: true },
        { id: 'impact', label: 'أثر البرنامج', type: 'textarea', placeholder: 'الأثر المتوقع/المتحقق...', aiEnabled: true },
        { id: 'recommendations', label: 'التوصيات', type: 'textarea', placeholder: 'التوصيات...', aiEnabled: true },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// 4. تقرير زيارة
// ═══════════════════════════════════════════════════════════════
export const VISIT_REPORT_SCHEMA: FormSchema = {
  id: 'visit-report',
  title: 'تقرير زيارة',
  description: 'تقرير عن زيارة ميدانية أو صفية',
  version: 1,
  sections: [
    {
      id: 'visit-info',
      title: 'بيانات الزيارة',
      columns: 2,
      fields: [
        { id: 'visitType', label: 'نوع الزيارة', type: 'select', options: ['صفية', 'ميدانية', 'إشرافية', 'تبادلية', 'أخرى'], required: true },
        { id: 'visitDate', label: 'تاريخ الزيارة', type: 'date', required: true },
        { id: 'visitedEntity', label: 'الجهة المُزارة', type: 'text', placeholder: 'اسم المدرسة / المعلم', required: true },
        { id: 'visitor', label: 'الزائر', type: 'text', placeholder: 'اسم الزائر' },
        { id: 'subject', label: 'المادة / الدرس', type: 'text', placeholder: 'المادة أو عنوان الدرس' },
        { id: 'grade', label: 'الصف', type: 'text', placeholder: 'الصف والفصل' },
      ],
    },
    {
      id: 'visit-details',
      title: 'ملاحظات الزيارة',
      columns: 1,
      collapsible: true,
      fields: [
        { id: 'positives', label: 'الإيجابيات', type: 'textarea', placeholder: 'نقاط القوة الملاحظة...', aiEnabled: true },
        { id: 'improvements', label: 'نقاط التحسين', type: 'textarea', placeholder: 'المجالات التي تحتاج تطوير...', aiEnabled: true },
        { id: 'recommendations', label: 'التوصيات', type: 'textarea', placeholder: 'توصيات للمعلم/المدرسة...', aiEnabled: true },
        { id: 'generalNotes', label: 'ملاحظات عامة', type: 'textarea', placeholder: 'أي ملاحظات إضافية...' },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════
// Registry — كل الـ schemas مفهرسة
// ═══════════════════════════════════════════════════════════════
export const REPORT_SCHEMAS: Record<string, FormSchema> = {
  'student-performance': STUDENT_PERFORMANCE_SCHEMA,
  'teacher-activity': TEACHER_ACTIVITY_SCHEMA,
  'program-report': PROGRAM_REPORT_SCHEMA,
  'visit-report': VISIT_REPORT_SCHEMA,
};

export const REPORT_SCHEMA_LIST = Object.values(REPORT_SCHEMAS);
