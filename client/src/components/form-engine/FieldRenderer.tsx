/**
 * FieldRenderer — يعرض حقل واحد حسب نوعه
 * يستخدم مع FormEngine لعرض الحقول ديناميكياً
 */
import React, { useCallback } from 'react';
import { Plus, Trash2, Sparkles, Loader2 } from 'lucide-react';
import type { FormFieldSchema } from '@/lib/form-schema';

interface FieldRendererProps {
  field: FormFieldSchema;
  value: string;
  onChange: (value: string) => void;
  onAIFill?: (fieldId: string) => void;
  aiLoading?: boolean;
}

export default function FieldRenderer({ field, value, onChange, onAIFill, aiLoading }: FieldRendererProps) {
  const baseClass = "w-full rounded-lg border border-gray-200 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder-gray-400 transition-all focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 focus:outline-none";

  const renderInput = () => {
    switch (field.type) {
      case 'textarea':
      case 'richtext':
        return (
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            rows={4}
            className={`${baseClass} resize-none`}
          />
        );

      case 'number':
        return (
          <input
            type="number"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            min={field.min}
            max={field.max}
            className={baseClass}
          />
        );

      case 'date':
        return (
          <input
            type="date"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          />
        );

      case 'select':
        return (
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={baseClass}
          >
            <option value="">{field.placeholder || 'اختر...'}</option>
            {field.options?.map((opt) => (
              <option key={opt} value={opt}>{opt}</option>
            ))}
          </select>
        );

      case 'list':
        return <ListField value={value} onChange={onChange} placeholder={field.placeholder} />;

      default:
        return (
          <input
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={field.placeholder}
            className={baseClass}
          />
        );
    }
  };

  return (
    <div className={`${field.colSpan === 2 ? 'col-span-2' : ''}`}>
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-semibold text-gray-700" style={{ fontFamily: "'Tajawal', sans-serif" }}>
          {field.label}
          {field.required && <span className="text-red-400 mr-1">*</span>}
        </label>
        {field.aiEnabled && onAIFill && (
          <button
            type="button"
            onClick={() => onAIFill(field.id)}
            disabled={aiLoading}
            className="flex items-center gap-1 text-[10px] font-medium text-teal-600 hover:text-teal-700 transition-colors disabled:opacity-50"
          >
            {aiLoading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Sparkles className="w-3 h-3" />}
            AI
          </button>
        )}
      </div>
      {renderInput()}
      {field.helperText && (
        <p className="text-[10px] text-gray-400 mt-1">{field.helperText}</p>
      )}
    </div>
  );
}

// ─── List Field Sub-component ───────────────────────────
function ListField({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  // Store as JSON array string
  const items: string[] = (() => {
    try { const p = JSON.parse(value); return Array.isArray(p) ? p : []; }
    catch { return value ? value.split('\n').filter(Boolean) : []; }
  })();

  const update = useCallback((newItems: string[]) => {
    onChange(JSON.stringify(newItems));
  }, [onChange]);

  const addItem = useCallback(() => {
    update([...items, '']);
  }, [items, update]);

  const removeItem = useCallback((idx: number) => {
    update(items.filter((_, i) => i !== idx));
  }, [items, update]);

  const changeItem = useCallback((idx: number, val: string) => {
    const next = [...items];
    next[idx] = val;
    update(next);
  }, [items, update]);

  return (
    <div className="space-y-2">
      {items.map((item, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <span className="text-[10px] text-gray-400 font-mono w-5 text-center shrink-0">{idx + 1}</span>
          <input
            type="text"
            value={item}
            onChange={(e) => changeItem(idx, e.target.value)}
            placeholder={placeholder || `العنصر ${idx + 1}`}
            className="flex-1 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-teal-400 focus:ring-2 focus:ring-teal-400/20 focus:outline-none"
          />
          <button type="button" onClick={() => removeItem(idx)} className="text-gray-400 hover:text-red-500 transition-colors p-1">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="flex items-center gap-1.5 text-xs font-medium text-teal-600 hover:text-teal-700 transition-colors py-1"
      >
        <Plus className="w-3.5 h-3.5" />
        إضافة عنصر
      </button>
    </div>
  );
}
