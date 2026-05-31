/**
 * FieldSchemaBuilder — مدير الحقول الديناميكي للقوالب الجاهزة
 *
 * يسمح للمدير بإنشاء/حذف/إعادة ترتيب الحقول التي تظهر في القالب.
 * كل حقل يحتوي على: id, label, type, required, placeholder
 * + تنسيق شامل: fontSize, color, textAlign, fontWeight, x, y
 * يخزَّن في عمود formSchema بقاعدة البيانات.
 */
import React, { useState } from 'react';
import {
  Plus, Trash2, GripVertical, ChevronDown, ChevronUp,
  Type, AlignLeft, Calendar, List, Hash, Loader2,
  AlignCenter, AlignRight, Bold, Paintbrush, Move,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────
export interface SchemaField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'date' | 'select' | 'number';
  required: boolean;
  placeholder?: string;
  options?: string[]; // for select type
  // ─── Formatting ─────────────────
  fontSize?: number;
  color?: string;
  textAlign?: 'right' | 'center' | 'left';
  fontWeight?: number;
  // ─── Absolute Positioning (for image-based templates) ─────
  x?: number;
  y?: number;
}

interface FieldSchemaBuilderProps {
  fields: SchemaField[];
  onChange: (fields: SchemaField[]) => void;
  isSaving?: boolean;
  /** When true, shows X/Y positioning controls (for image-background templates) */
  showPositioning?: boolean;
}

// ─── Field Type Meta ──────────────────────────────────────
const FIELD_TYPES: { value: SchemaField['type']; label: string; icon: React.ReactNode; color: string }[] = [
  { value: 'text',     label: 'نص قصير',   icon: <Type className="w-3 h-3" />,      color: '#2563eb' },
  { value: 'textarea', label: 'نص طويل',   icon: <AlignLeft className="w-3 h-3" />, color: '#7c3aed' },
  { value: 'date',     label: 'تاريخ',     icon: <Calendar className="w-3 h-3" />,  color: '#059669' },
  { value: 'select',   label: 'قائمة',     icon: <List className="w-3 h-3" />,      color: '#d97706' },
  { value: 'number',   label: 'رقم',       icon: <Hash className="w-3 h-3" />,      color: '#dc2626' },
];

const TYPE_META = Object.fromEntries(FIELD_TYPES.map(t => [t.value, t]));

// ─── Auto-generate safe ID from Arabic label ──────────────
function generateFieldId(label: string): string {
  const slug = label
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^\u0621-\u064Aa-zA-Z0-9_]/g, '')
    .substring(0, 30);
  return `field_${slug || Date.now()}`;
}

// ─── Component ────────────────────────────────────────────
export default function FieldSchemaBuilder({ fields, onChange, isSaving, showPositioning }: FieldSchemaBuilderProps) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [dragIdx, setDragIdx] = useState<number | null>(null);

  // ─── CRUD ───────────────────────────────────────────────
  const addField = () => {
    const newField: SchemaField = {
      id: `field_${Date.now()}`,
      label: '',
      type: 'text',
      required: false,
      placeholder: '',
      fontSize: 13,
      color: '#1a1a1a',
      textAlign: 'right',
      fontWeight: 400,
    };
    onChange([...fields, newField]);
    setExpandedId(newField.id);
  };

  const updateField = (idx: number, patch: Partial<SchemaField>) => {
    const updated = fields.map((f, i) => i === idx ? { ...f, ...patch } : f);
    onChange(updated);
  };

  const removeField = (idx: number) => {
    onChange(fields.filter((_, i) => i !== idx));
  };

  // ─── Reorder (manual up/down) ───────────────────────────
  const moveField = (idx: number, dir: -1 | 1) => {
    const newIdx = idx + dir;
    if (newIdx < 0 || newIdx >= fields.length) return;
    const arr = [...fields];
    [arr[idx], arr[newIdx]] = [arr[newIdx], arr[idx]];
    onChange(arr);
  };

  // ─── Drag & Drop ───────────────────────────────────────
  const handleDragStart = (idx: number) => setDragIdx(idx);
  const handleDragOver = (e: React.DragEvent, idx: number) => {
    e.preventDefault();
    if (dragIdx === null || dragIdx === idx) return;
    const arr = [...fields];
    const [moved] = arr.splice(dragIdx, 1);
    arr.splice(idx, 0, moved);
    onChange(arr);
    setDragIdx(idx);
  };
  const handleDragEnd = () => setDragIdx(null);

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-bold text-gray-600 flex items-center gap-1.5">
          <List className="w-3.5 h-3.5 text-blue-500" />
          هيكل الحقول ({fields.length} حقل)
        </p>
        <button
          onClick={addField}
          className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold bg-blue-50 text-blue-600 hover:bg-blue-100 border border-blue-200 transition-colors"
        >
          <Plus className="w-3 h-3" />
          إضافة حقل
        </button>
      </div>

      {/* Empty State */}
      {fields.length === 0 && (
        <div className="text-center py-8 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
          <List className="w-8 h-8 text-gray-300 mx-auto mb-2" />
          <p className="text-xs text-gray-400 mb-2">لا توجد حقول — اضغط "إضافة حقل" لإنشاء أول حقل</p>
          <button onClick={addField} className="text-[10px] text-blue-500 hover:text-blue-700 font-bold">
            + إضافة أول حقل
          </button>
        </div>
      )}

      {/* Field List */}
      <div className="space-y-1.5">
        {fields.map((field, idx) => {
          const meta = TYPE_META[field.type] || TYPE_META.text;
          const isExpanded = expandedId === field.id;

          return (
            <div
              key={field.id}
              draggable
              onDragStart={() => handleDragStart(idx)}
              onDragOver={(e) => handleDragOver(e, idx)}
              onDragEnd={handleDragEnd}
              className={`rounded-lg border transition-all ${
                dragIdx === idx
                  ? 'border-blue-400 bg-blue-50/50 shadow-sm'
                  : isExpanded
                    ? 'border-gray-300 bg-white shadow-sm'
                    : 'border-gray-200 bg-gray-50 hover:bg-white hover:border-gray-300'
              }`}
            >
              {/* Summary Row */}
              <div className="flex items-center gap-1.5 px-2.5 py-2 cursor-pointer" onClick={() => setExpandedId(isExpanded ? null : field.id)}>
                <GripVertical className="w-3 h-3 text-gray-300 cursor-grab shrink-0" />

                {/* Type badge */}
                <span
                  className="px-1.5 py-0.5 rounded text-[8px] font-bold shrink-0 text-white"
                  style={{ background: meta.color }}
                >
                  {meta.label}
                </span>

                {/* Label (editable inline) */}
                <input
                  value={field.label}
                  onChange={e => { e.stopPropagation(); updateField(idx, { label: e.target.value }); }}
                  onClick={e => e.stopPropagation()}
                  onBlur={() => {
                    if (!field.label && field.id.startsWith('field_')) {
                      // Auto-generate ID won't happen on empty label
                    } else if (field.id.startsWith('field_')) {
                      updateField(idx, { id: generateFieldId(field.label) });
                    }
                  }}
                  placeholder="اسم الحقل..."
                  className="flex-1 bg-transparent text-xs font-medium text-gray-800 outline-none border-none px-1 min-w-0 placeholder:text-gray-300"
                />

                {/* Formatting indicators */}
                {field.fontSize && field.fontSize !== 13 && (
                  <span className="text-[7px] text-gray-400 shrink-0">{field.fontSize}px</span>
                )}
                {field.color && field.color !== '#1a1a1a' && (
                  <span className="w-2.5 h-2.5 rounded-full border border-gray-200 shrink-0" style={{ backgroundColor: field.color }} />
                )}

                {/* Required indicator */}
                {field.required && (
                  <span className="text-[8px] text-red-400 font-bold shrink-0">إلزامي</span>
                )}

                {/* Actions */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button onClick={e => { e.stopPropagation(); moveField(idx, -1); }} disabled={idx === 0}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-20">
                    <ChevronUp className="w-3 h-3 text-gray-400" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); moveField(idx, 1); }} disabled={idx === fields.length - 1}
                    className="p-0.5 rounded hover:bg-gray-200 disabled:opacity-20">
                    <ChevronDown className="w-3 h-3 text-gray-400" />
                  </button>
                  <button onClick={e => { e.stopPropagation(); removeField(idx); }}
                    className="p-0.5 rounded hover:bg-red-100 text-red-400 hover:text-red-600">
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              {/* Expanded Detail */}
              {isExpanded && (
                <div className="px-3 pb-3 pt-1 border-t border-gray-100 space-y-2.5">
                  {/* ID */}
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">المعرف البرمجي (id)</label>
                    <input value={field.id} onChange={e => updateField(idx, { id: e.target.value })}
                      className="w-full px-2 py-1 rounded border text-[10px] font-mono bg-gray-50 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                  </div>

                  {/* Type */}
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">نوع الحقل</label>
                    <select value={field.type} onChange={e => updateField(idx, { type: e.target.value as any })}
                      className="w-full px-2 py-1 rounded border text-xs bg-white focus:ring-1 focus:ring-blue-200 focus:outline-none">
                      {FIELD_TYPES.map(t => (
                        <option key={t.value} value={t.value}>{t.label} ({t.value})</option>
                      ))}
                    </select>
                  </div>

                  {/* Placeholder */}
                  <div>
                    <label className="text-[9px] text-gray-400 block mb-0.5">نص تلميحي (placeholder)</label>
                    <input value={field.placeholder || ''} onChange={e => updateField(idx, { placeholder: e.target.value })}
                      placeholder="اكتب النص التلميحي..."
                      className="w-full px-2 py-1 rounded border text-[10px] bg-gray-50 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                  </div>

                  {/* Select options */}
                  {field.type === 'select' && (
                    <div>
                      <label className="text-[9px] text-gray-400 block mb-0.5">الخيارات (مفصولة بفاصلة)</label>
                      <input value={(field.options || []).join(', ')}
                        onChange={e => updateField(idx, { options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) })}
                        placeholder="خيار1, خيار2, خيار3"
                        className="w-full px-2 py-1 rounded border text-[10px] bg-gray-50 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                    </div>
                  )}

                  {/* Required toggle */}
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={field.required}
                      onChange={e => updateField(idx, { required: e.target.checked })}
                      className="w-3.5 h-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-200" />
                    <span className="text-[10px] text-gray-500">حقل إلزامي</span>
                  </label>

                  {/* ═══════════ FORMATTING SECTION ═══════════ */}
                  <div className="border-t border-gray-100 pt-2.5 mt-2.5">
                    <p className="text-[9px] font-bold text-gray-500 flex items-center gap-1 mb-2">
                      <Paintbrush className="w-3 h-3 text-purple-500" />
                      تنسيق الحقل
                    </p>

                    {/* Font Size */}
                    <div className="mb-2">
                      <label className="text-[9px] text-gray-400 block mb-0.5">حجم الخط: {field.fontSize || 13}px</label>
                      <input type="range" min={8} max={48} step={1}
                        value={field.fontSize || 13}
                        onChange={e => updateField(idx, { fontSize: Number(e.target.value) })}
                        className="w-full h-1.5 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-blue-600" />
                    </div>

                    {/* Color */}
                    <div className="mb-2">
                      <label className="text-[9px] text-gray-400 block mb-0.5">لون النص</label>
                      <div className="flex items-center gap-1.5">
                        <input type="color" value={field.color || '#1a1a1a'}
                          onChange={e => updateField(idx, { color: e.target.value })}
                          className="w-7 h-7 rounded border cursor-pointer p-0.5" />
                        <input type="text" value={field.color || '#1a1a1a'}
                          onChange={e => updateField(idx, { color: e.target.value })}
                          className="flex-1 px-2 py-1 bg-gray-50 rounded border text-[10px] font-mono focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                      </div>
                    </div>

                    {/* Text Align + Bold */}
                    <div className="flex items-center gap-1.5 mb-2">
                      <div className="flex border rounded-lg overflow-hidden">
                        {([
                          { icon: AlignRight, value: 'right' as const, label: 'يمين' },
                          { icon: AlignCenter, value: 'center' as const, label: 'وسط' },
                          { icon: AlignLeft, value: 'left' as const, label: 'يسار' },
                        ] as const).map(a => (
                          <button key={a.value}
                            onClick={() => updateField(idx, { textAlign: a.value })}
                            className={`p-1.5 transition-colors ${
                              (field.textAlign || 'right') === a.value
                                ? 'bg-blue-50 text-blue-600'
                                : 'text-gray-400 hover:text-gray-600'
                            }`}
                            title={a.label}>
                            <a.icon className="w-3 h-3" />
                          </button>
                        ))}
                      </div>
                      <button
                        onClick={() => updateField(idx, { fontWeight: (field.fontWeight || 400) === 700 ? 400 : 700 })}
                        className={`p-1.5 rounded-lg border transition-colors ${
                          field.fontWeight === 700
                            ? 'bg-blue-50 border-blue-200 text-blue-600'
                            : 'border-gray-200 text-gray-400 hover:text-gray-600'
                        }`}
                        title="غامق">
                        <Bold className="w-3 h-3" />
                      </button>
                    </div>

                    {/* X, Y Positioning (for image-based templates) */}
                    {showPositioning && (
                      <div className="grid grid-cols-2 gap-1.5">
                        <div>
                          <label className="text-[9px] text-gray-400 flex items-center gap-0.5 mb-0.5">
                            <Move className="w-2.5 h-2.5" /> X (px)
                          </label>
                          <input type="number" value={field.x ?? 0} min={0}
                            onChange={e => updateField(idx, { x: Number(e.target.value) })}
                            className="w-full px-2 py-1 rounded border text-[10px] bg-gray-50 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                        </div>
                        <div>
                          <label className="text-[9px] text-gray-400 flex items-center gap-0.5 mb-0.5">
                            <Move className="w-2.5 h-2.5" /> Y (px)
                          </label>
                          <input type="number" value={field.y ?? 0} min={0}
                            onChange={e => updateField(idx, { y: Number(e.target.value) })}
                            className="w-full px-2 py-1 rounded border text-[10px] bg-gray-50 focus:ring-1 focus:ring-blue-200 focus:outline-none" />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Status bar */}
      {isSaving && (
        <div className="flex items-center gap-1.5 text-[10px] text-blue-500 justify-center py-1">
          <Loader2 className="w-3 h-3 animate-spin" />
          جاري حفظ الحقول...
        </div>
      )}
    </div>
  );
}
