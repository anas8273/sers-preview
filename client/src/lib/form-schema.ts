/**
 * Form Schema Types — SERS FormEngine
 * أنواع TypeScript لتعريف النماذج ديناميكياً عبر JSON
 * مستوحاة من هيكل GitHub SERS (dynamic_forms collection)
 */
import { z } from 'zod';

// ─── Field Types ─────────────────────────────────────────
export type FieldType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'select'
  | 'multiselect'
  | 'list'       // قائمة ديناميكية (إضافة/حذف عناصر)
  | 'richtext'
  | 'image'
  | 'signatures';

// ─── Form Field ──────────────────────────────────────────
export interface FormFieldSchema {
  /** معرّف فريد للحقل */
  id: string;
  /** عنوان الحقل بالعربية */
  label: string;
  /** نوع الحقل */
  type: FieldType;
  /** نص placeholder */
  placeholder?: string;
  /** مطلوب؟ */
  required?: boolean;
  /** قيمة افتراضية */
  defaultValue?: string;
  /** خيارات (لـ select / multiselect) */
  options?: string[];
  /** عرض الحقل في الشبكة (1 = نصف, 2 = كامل) */
  colSpan?: 1 | 2;
  /** الحد الأدنى (number) أو الطول (text) */
  min?: number;
  /** الحد الأقصى */
  max?: number;
  /** هل يدعم AI fill؟ */
  aiEnabled?: boolean;
  /** prompt مخصص لـ AI */
  aiPrompt?: string;
  /** نص مساعد */
  helperText?: string;
  /** أيقونة (اسم lucide) */
  icon?: string;
}

// ─── Form Section ────────────────────────────────────────
export interface FormSectionSchema {
  /** معرّف فريد للقسم */
  id: string;
  /** عنوان القسم */
  title: string;
  /** أيقونة القسم */
  icon?: string;
  /** عدد الأعمدة */
  columns?: 1 | 2;
  /** قابل للطي */
  collapsible?: boolean;
  /** مطوي بشكل افتراضي */
  defaultCollapsed?: boolean;
  /** الحقول في هذا القسم */
  fields: FormFieldSchema[];
}

// ─── Form Schema ─────────────────────────────────────────
export interface FormSchema {
  /** معرّف النموذج */
  id: string;
  /** عنوان النموذج */
  title: string;
  /** وصف مختصر */
  description?: string;
  /** الإصدار */
  version: number;
  /** الأقسام */
  sections: FormSectionSchema[];
}

// ─── Zod Validation Generators ───────────────────────────

/**
 * يولّد Zod schema من FormFieldSchema
 */
export function fieldToZod(field: FormFieldSchema): z.ZodTypeAny {
  let schema: z.ZodTypeAny;

  switch (field.type) {
    case 'number':
      schema = z.coerce.number();
      if (field.min !== undefined) schema = (schema as z.ZodNumber).min(field.min);
      if (field.max !== undefined) schema = (schema as z.ZodNumber).max(field.max);
      break;
    case 'date':
      schema = z.string().min(1, 'التاريخ مطلوب');
      break;
    case 'select':
      if (field.options?.length) {
        schema = z.enum(field.options as [string, ...string[]]);
      } else {
        schema = z.string();
      }
      break;
    case 'multiselect':
      schema = z.array(z.string());
      break;
    case 'list':
      schema = z.array(z.string());
      break;
    default:
      schema = z.string();
      if (field.min) schema = (schema as z.ZodString).min(field.min);
      if (field.max) schema = (schema as z.ZodString).max(field.max);
  }

  if (!field.required) {
    schema = schema.optional();
  }

  return schema;
}

/**
 * يولّد Zod object schema كامل من FormSchema
 */
export function formToZodSchema(form: FormSchema): z.ZodObject<Record<string, z.ZodTypeAny>> {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const section of form.sections) {
    for (const field of section.fields) {
      shape[field.id] = fieldToZod(field);
    }
  }
  return z.object(shape);
}

/**
 * يستخرج القيم الافتراضية من FormSchema
 */
export function getDefaultValues(form: FormSchema): Record<string, string> {
  const defaults: Record<string, string> = {};
  for (const section of form.sections) {
    for (const field of section.fields) {
      defaults[field.id] = field.defaultValue ?? '';
    }
  }
  return defaults;
}

/**
 * يحسب نسبة إكمال النموذج
 */
export function computeCompletion(form: FormSchema, data: Record<string, string>): number {
  let total = 0;
  let filled = 0;
  for (const section of form.sections) {
    for (const field of section.fields) {
      if (field.required) {
        total++;
        const v = data[field.id];
        if (v && v.trim().length > 0) filled++;
      }
    }
  }
  return total === 0 ? 100 : Math.round((filled / total) * 100);
}
