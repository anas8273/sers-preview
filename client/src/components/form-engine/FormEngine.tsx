/**
 * FormEngine — المكون الرئيسي لعرض النماذج الديناميكية
 * يقرأ FormSchema (JSON) ويعرض الحقول تلقائياً مع أقسام قابلة للطي
 * يدعم: AI fill, validation, progress tracking
 */
import React, { useState, useCallback, useMemo } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { FormSchema, FormSectionSchema } from '@/lib/form-schema';
import { computeCompletion } from '@/lib/form-schema';
import FieldRenderer from './FieldRenderer';

interface FormEngineProps {
  /** تعريف النموذج (JSON schema) */
  schema: FormSchema;
  /** البيانات الحالية */
  data: Record<string, string>;
  /** عند تغيير أي حقل */
  onChange: (data: Record<string, string>) => void;
  /** عند طلب AI fill لحقل */
  onAIFill?: (fieldId: string) => void;
  /** هل AI يحمّل */
  aiLoading?: boolean;
  /** إظهار شريط التقدم */
  showProgress?: boolean;
  /** CSS class إضافي */
  className?: string;
}

// ─── Section Component ───────────────────────────────────
function FormSection({ section, data, onChange, onAIFill, aiLoading }: {
  section: FormSectionSchema;
  data: Record<string, string>;
  onChange: (fieldId: string, value: string) => void;
  onAIFill?: (fieldId: string) => void;
  aiLoading?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(section.defaultCollapsed ?? false);
  const canCollapse = section.collapsible !== false;

  return (
    <div className="bg-white rounded-xl border border-gray-100 overflow-hidden">
      {/* Section Header */}
      <button
        type="button"
        onClick={() => canCollapse && setCollapsed(!collapsed)}
        className={`w-full flex items-center justify-between px-4 py-3 text-right transition-colors ${
          canCollapse ? 'hover:bg-gray-50 cursor-pointer' : 'cursor-default'
        }`}
      >
        <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>
          {section.title}
        </h3>
        {canCollapse && (
          collapsed
            ? <ChevronDown className="w-4 h-4 text-gray-400" />
            : <ChevronUp className="w-4 h-4 text-gray-400" />
        )}
      </button>

      {/* Section Fields */}
      {!collapsed && (
        <div className={`px-4 pb-4 grid gap-4 ${
          section.columns === 2 ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-1'
        }`}>
          {section.fields.map((field) => (
            <FieldRenderer
              key={field.id}
              field={field}
              value={data[field.id] ?? ''}
              onChange={(val) => onChange(field.id, val)}
              onAIFill={onAIFill}
              aiLoading={aiLoading}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Main FormEngine ─────────────────────────────────────
export default function FormEngine({
  schema,
  data,
  onChange,
  onAIFill,
  aiLoading,
  showProgress = true,
  className = '',
}: FormEngineProps) {
  const handleFieldChange = useCallback((fieldId: string, value: string) => {
    onChange({ ...data, [fieldId]: value });
  }, [data, onChange]);

  const progress = useMemo(() => {
    if (!showProgress) return 0;
    return computeCompletion(schema, data);
  }, [schema, data, showProgress]);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Progress Bar */}
      {showProgress && (
        <div className="flex items-center gap-3">
          <div className="flex-1 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500 ease-out"
              style={{
                width: `${progress}%`,
                background: progress === 100
                  ? 'linear-gradient(90deg, #059669, #10b981)'
                  : 'linear-gradient(90deg, #0d9488, #14b8a6)',
              }}
            />
          </div>
          <span className="text-xs font-bold text-gray-500 tabular-nums w-10 text-left">
            {progress}%
          </span>
        </div>
      )}

      {/* Sections */}
      {schema.sections.map((section) => (
        <FormSection
          key={section.id}
          section={section}
          data={data}
          onChange={handleFieldChange}
          onAIFill={onAIFill}
          aiLoading={aiLoading}
        />
      ))}
    </div>
  );
}
