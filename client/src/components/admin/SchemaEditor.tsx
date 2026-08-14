/**
 * SchemaEditor — محرر حقول القوالب (Admin)
 * يسمح بإضافة/حذف/ترتيب حقول النموذج ديناميكياً
 * مستوحى من GitHub SchemaBuilder (نسخة مبسطة)
 */
import React, { useState, useCallback } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Type, AlignLeft, Hash, Calendar, List, ListOrdered,
  Save, Eye, Sparkles, ArrowUp, ArrowDown, Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import type { FormSchema, FormSectionSchema, FormFieldSchema, FieldType } from '@/lib/form-schema';

// ─── Field Type Options ──────────────────────────────────
const FIELD_TYPES: { type: FieldType; label: string; icon: React.ComponentType<any> }[] = [
  { type: 'text', label: 'نص قصير', icon: Type },
  { type: 'textarea', label: 'نص طويل', icon: AlignLeft },
  { type: 'number', label: 'رقم', icon: Hash },
  { type: 'date', label: 'تاريخ', icon: Calendar },
  { type: 'select', label: 'قائمة منسدلة', icon: List },
  { type: 'list', label: 'قائمة ديناميكية', icon: ListOrdered },
];

interface SchemaEditorProps {
  schema: FormSchema;
  onChange: (schema: FormSchema) => void;
  onSave?: (schema: FormSchema) => void;
  onPreview?: (schema: FormSchema) => void;
}

// ─── Field Editor ────────────────────────────────────────
function FieldEditor({ field, onChange, onRemove, onMoveUp, onMoveDown, isFirst, isLast }: {
  field: FormFieldSchema;
  onChange: (field: FormFieldSchema) => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  isFirst: boolean;
  isLast: boolean;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="border border-gray-200 rounded-lg bg-white overflow-hidden">
      {/* Field Header */}
      <div className="flex items-center gap-2 px-3 py-2 bg-gray-50 border-b border-gray-100">
        <GripVertical className="w-4 h-4 text-gray-300 cursor-move shrink-0" />
        <input
          type="text"
          value={field.label}
          onChange={(e) => onChange({ ...field, label: e.target.value })}
          className="flex-1 bg-transparent text-sm font-medium text-gray-800 focus:outline-none"
          placeholder="عنوان الحقل"
        />
        <select
          value={field.type}
          onChange={(e) => onChange({ ...field, type: e.target.value as FieldType })}
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
        >
          {FIELD_TYPES.map((ft) => (
            <option key={ft.type} value={ft.type}>{ft.label}</option>
          ))}
        </select>
        <label className="flex items-center gap-1 text-[10px] text-gray-500">
          <input
            type="checkbox"
            checked={field.required ?? false}
            onChange={(e) => onChange({ ...field, required: e.target.checked })}
            className="w-3 h-3"
          />
          مطلوب
        </label>
        <button onClick={() => setExpanded(!expanded)} className="text-gray-400 hover:text-gray-600 p-1">
          <Settings2 className="w-3.5 h-3.5" />
        </button>
        <div className="flex gap-0.5">
          <button onClick={onMoveUp} disabled={isFirst} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-0.5">
            <ArrowUp className="w-3 h-3" />
          </button>
          <button onClick={onMoveDown} disabled={isLast} className="text-gray-400 hover:text-gray-600 disabled:opacity-30 p-0.5">
            <ArrowDown className="w-3 h-3" />
          </button>
        </div>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 p-1">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Field Options (Expanded) */}
      {expanded && (
        <div className="px-3 py-3 grid grid-cols-2 gap-3 text-xs">
          <div>
            <label className="text-gray-500 block mb-1">Placeholder</label>
            <input
              type="text"
              value={field.placeholder ?? ''}
              onChange={(e) => onChange({ ...field, placeholder: e.target.value })}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">قيمة افتراضية</label>
            <input
              type="text"
              value={field.defaultValue ?? ''}
              onChange={(e) => onChange({ ...field, defaultValue: e.target.value })}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            />
          </div>
          <div>
            <label className="text-gray-500 block mb-1">عرض (أعمدة)</label>
            <select
              value={field.colSpan ?? 1}
              onChange={(e) => onChange({ ...field, colSpan: Number(e.target.value) as 1 | 2 })}
              className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm"
            >
              <option value={1}>نصف عرض</option>
              <option value={2}>عرض كامل</option>
            </select>
          </div>
          <div className="flex items-center gap-2">
            <label className="flex items-center gap-1.5 text-gray-500">
              <input
                type="checkbox"
                checked={field.aiEnabled ?? false}
                onChange={(e) => onChange({ ...field, aiEnabled: e.target.checked })}
                className="w-3.5 h-3.5"
              />
              <Sparkles className="w-3 h-3 text-teal-500" />
              دعم AI
            </label>
          </div>
          {field.type === 'select' && (
            <div className="col-span-2">
              <label className="text-gray-500 block mb-1">الخيارات (كل سطر = خيار)</label>
              <textarea
                value={(field.options ?? []).join('\n')}
                onChange={(e) => onChange({ ...field, options: e.target.value.split('\n').filter(Boolean) })}
                rows={3}
                className="w-full border border-gray-200 rounded px-2 py-1.5 text-sm resize-none"
                placeholder="الخيار الأول&#10;الخيار الثاني&#10;..."
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Section Editor ──────────────────────────────────────
function SectionEditor({ section, onChange, onRemove }: {
  section: FormSectionSchema;
  onChange: (section: FormSectionSchema) => void;
  onRemove: () => void;
}) {
  const [collapsed, setCollapsed] = useState(false);

  const addField = useCallback(() => {
    const newField: FormFieldSchema = {
      id: `field_${Date.now()}`,
      label: 'حقل جديد',
      type: 'text',
      required: false,
    };
    onChange({ ...section, fields: [...section.fields, newField] });
  }, [section, onChange]);

  const updateField = useCallback((idx: number, field: FormFieldSchema) => {
    const next = [...section.fields];
    next[idx] = field;
    onChange({ ...section, fields: next });
  }, [section, onChange]);

  const removeField = useCallback((idx: number) => {
    onChange({ ...section, fields: section.fields.filter((_, i) => i !== idx) });
  }, [section, onChange]);

  const moveField = useCallback((idx: number, dir: -1 | 1) => {
    const next = [...section.fields];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange({ ...section, fields: next });
  }, [section, onChange]);

  return (
    <div className="border border-gray-200 rounded-xl overflow-hidden bg-gray-50/50">
      {/* Section Header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-200 bg-white">
        <button onClick={() => setCollapsed(!collapsed)} className="text-gray-400">
          {collapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
        </button>
        <input
          type="text"
          value={section.title}
          onChange={(e) => onChange({ ...section, title: e.target.value })}
          className="flex-1 text-sm font-bold text-gray-800 bg-transparent focus:outline-none"
          placeholder="عنوان القسم"
        />
        <select
          value={section.columns ?? 1}
          onChange={(e) => onChange({ ...section, columns: Number(e.target.value) as 1 | 2 })}
          className="text-xs border border-gray-200 rounded px-2 py-1 bg-white"
        >
          <option value={1}>عمود واحد</option>
          <option value={2}>عمودين</option>
        </select>
        <label className="flex items-center gap-1 text-[10px] text-gray-500">
          <input
            type="checkbox"
            checked={section.collapsible ?? false}
            onChange={(e) => onChange({ ...section, collapsible: e.target.checked })}
            className="w-3 h-3"
          />
          قابل للطي
        </label>
        <button onClick={onRemove} className="text-gray-400 hover:text-red-500 p-1">
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Section Fields */}
      {!collapsed && (
        <div className="p-3 space-y-2">
          {section.fields.map((field, idx) => (
            <FieldEditor
              key={field.id}
              field={field}
              onChange={(f) => updateField(idx, f)}
              onRemove={() => removeField(idx)}
              onMoveUp={() => moveField(idx, -1)}
              onMoveDown={() => moveField(idx, 1)}
              isFirst={idx === 0}
              isLast={idx === section.fields.length - 1}
            />
          ))}
          <button
            onClick={addField}
            className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 py-2 px-3 rounded-lg hover:bg-teal-50 transition-colors w-full justify-center border border-dashed border-teal-300"
          >
            <Plus className="w-3.5 h-3.5" />
            إضافة حقل
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Main SchemaEditor ───────────────────────────────────
export default function SchemaEditor({ schema, onChange, onSave, onPreview }: SchemaEditorProps) {
  const addSection = useCallback(() => {
    const newSection: FormSectionSchema = {
      id: `section_${Date.now()}`,
      title: 'قسم جديد',
      columns: 2,
      fields: [],
    };
    onChange({ ...schema, sections: [...schema.sections, newSection] });
  }, [schema, onChange]);

  const updateSection = useCallback((idx: number, section: FormSectionSchema) => {
    const next = [...schema.sections];
    next[idx] = section;
    onChange({ ...schema, sections: next });
  }, [schema, onChange]);

  const removeSection = useCallback((idx: number) => {
    if (schema.sections.length <= 1) {
      toast.error('يجب وجود قسم واحد على الأقل');
      return;
    }
    onChange({ ...schema, sections: schema.sections.filter((_, i) => i !== idx) });
  }, [schema, onChange]);

  const totalFields = schema.sections.reduce((acc, s) => acc + s.fields.length, 0);

  return (
    <div className="space-y-4" dir="rtl">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-bold text-gray-900" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            محرر حقول النموذج
          </h3>
          <p className="text-xs text-gray-500">
            {schema.sections.length} قسم · {totalFields} حقل
          </p>
        </div>
        <div className="flex gap-2">
          {onPreview && (
            <Button variant="outline" size="sm" onClick={() => onPreview(schema)} className="gap-1.5">
              <Eye className="w-3.5 h-3.5" />
              معاينة
            </Button>
          )}
          {onSave && (
            <Button size="sm" onClick={() => onSave(schema)} className="gap-1.5 bg-teal-600 hover:bg-teal-700">
              <Save className="w-3.5 h-3.5" />
              حفظ
            </Button>
          )}
        </div>
      </div>

      {/* Schema Info */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">عنوان النموذج</label>
          <input
            type="text"
            value={schema.title}
            onChange={(e) => onChange({ ...schema, title: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 focus:outline-none"
          />
        </div>
        <div>
          <label className="text-xs font-medium text-gray-600 mb-1 block">الوصف</label>
          <input
            type="text"
            value={schema.description ?? ''}
            onChange={(e) => onChange({ ...schema, description: e.target.value })}
            className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 focus:outline-none"
          />
        </div>
      </div>

      {/* Sections */}
      <div className="space-y-3">
        {schema.sections.map((section, idx) => (
          <SectionEditor
            key={section.id}
            section={section}
            onChange={(s) => updateSection(idx, s)}
            onRemove={() => removeSection(idx)}
          />
        ))}
      </div>

      {/* Add Section */}
      <button
        onClick={addSection}
        className="flex items-center gap-2 text-sm font-medium text-teal-600 hover:text-teal-700 py-3 px-4 rounded-xl hover:bg-teal-50 transition-colors w-full justify-center border-2 border-dashed border-teal-300"
      >
        <Plus className="w-4 h-4" />
        إضافة قسم جديد
      </button>
    </div>
  );
}
