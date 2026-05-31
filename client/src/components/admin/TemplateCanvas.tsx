/**
 * TemplateCanvas — محرر قالب بصري (X/Y Canvas)
 * يسمح بتحميل خلفية PDF وتحديد مواقع الحقول بالسحب والإفلات
 * مستوحى من TemplateMapper.tsx في GitHub SERS
 */
import React, { useState, useCallback, useRef, useMemo } from 'react';
import {
  Upload, Plus, Save, Eye, Trash2, ZoomIn, ZoomOut, RotateCcw,
  Image as ImageIcon, Grid3X3, Loader2, Download, Layers,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import FieldPlacer, { type FieldPlacement } from './FieldPlacer';

// ─── Canvas Data Schema ──────────────────────────────────
export interface CanvasData {
  backgroundUrl: string | null;
  backgroundWidth: number;
  backgroundHeight: number;
  fields: FieldPlacement[];
}

const EMPTY_CANVAS: CanvasData = {
  backgroundUrl: null,
  backgroundWidth: 793.7,
  backgroundHeight: 1122.5,
  fields: [],
};

interface TemplateCanvasProps {
  /** بيانات Canvas الحالية */
  canvasData?: CanvasData | null;
  /** عند حفظ التغييرات */
  onSave?: (data: CanvasData) => void;
  /** قائمة الحقول المتاحة من SchemaEditor */
  availableFields?: { id: string; label: string }[];
  /** معرّف القالب */
  templateId?: number;
  /** CSS class */
  className?: string;
}

export default function TemplateCanvas({
  canvasData: initialData,
  onSave,
  availableFields = [],
  templateId,
  className = '',
}: TemplateCanvasProps) {
  const [canvas, setCanvas] = useState<CanvasData>(initialData || { ...EMPTY_CANVAS });
  const [selectedFieldId, setSelectedFieldId] = useState<string | null>(null);
  const [zoom, setZoom] = useState(0.7);
  const [showGrid, setShowGrid] = useState(true);
  const [uploading, setUploading] = useState(false);
  const canvasContainerRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // ─── Computed ──────────────────────────────────────────
  const placedFieldIds = useMemo(() => new Set(canvas.fields.map(f => f.fieldId)), [canvas.fields]);
  const unplacedFields = useMemo(
    () => availableFields.filter(f => !placedFieldIds.has(f.id)),
    [availableFields, placedFieldIds]
  );

  // ─── Upload Background ────────────────────────────────
  const handleUploadBackground = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      // Convert to base64 data URL for local preview
      const reader = new FileReader();
      const dataUrl = await new Promise<string>((resolve, reject) => {
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });

      // Get image dimensions
      const img = new Image();
      const dims = await new Promise<{ w: number; h: number }>((resolve, reject) => {
        img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
        img.onerror = reject;
        img.src = dataUrl;
      });

      setCanvas(prev => ({
        ...prev,
        backgroundUrl: dataUrl,
        backgroundWidth: dims.w,
        backgroundHeight: dims.h,
      }));
      toast.success('تم تحميل الخلفية بنجاح');
    } catch {
      toast.error('فشل تحميل الصورة');
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }, []);

  // ─── Add Field to Canvas ──────────────────────────────
  const addFieldToCanvas = useCallback((fieldId: string, label: string) => {
    const newField: FieldPlacement = {
      fieldId,
      label,
      x: 100 + Math.random() * 200,
      y: 100 + Math.random() * 200,
      width: 180,
      height: 30,
    };
    setCanvas(prev => ({
      ...prev,
      fields: [...prev.fields, newField],
    }));
    setSelectedFieldId(fieldId);
  }, []);

  // ─── Update Field Placement ───────────────────────────
  const updateField = useCallback((fieldId: string, placement: FieldPlacement) => {
    setCanvas(prev => ({
      ...prev,
      fields: prev.fields.map(f => f.fieldId === fieldId ? placement : f),
    }));
  }, []);

  // ─── Remove Field from Canvas ─────────────────────────
  const removeField = useCallback((fieldId: string) => {
    setCanvas(prev => ({
      ...prev,
      fields: prev.fields.filter(f => f.fieldId !== fieldId),
    }));
    if (selectedFieldId === fieldId) setSelectedFieldId(null);
  }, [selectedFieldId]);

  // ─── Save ─────────────────────────────────────────────
  const handleSave = useCallback(() => {
    onSave?.(canvas);
    toast.success('تم حفظ تنسيق القالب');
  }, [canvas, onSave]);

  return (
    <div className={`flex flex-col h-full ${className}`} dir="rtl">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 px-4 py-2.5 border-b border-gray-200 bg-white">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-bold text-gray-800" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            محرر القالب البصري
          </h3>
          <span className="text-[10px] text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">
            {canvas.fields.length} حقل
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {/* Zoom */}
          <div className="flex items-center gap-0.5 bg-gray-100 rounded-lg px-1 py-0.5">
            <button onClick={() => setZoom(z => Math.max(0.3, z - 0.1))} className="p-1 text-gray-500 hover:text-gray-700 rounded">
              <ZoomOut className="w-3.5 h-3.5" />
            </button>
            <span className="text-[10px] font-medium text-gray-600 w-8 text-center tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <button onClick={() => setZoom(z => Math.min(1.5, z + 0.1))} className="p-1 text-gray-500 hover:text-gray-700 rounded">
              <ZoomIn className="w-3.5 h-3.5" />
            </button>
            <button onClick={() => setZoom(0.7)} className="p-1 text-gray-400 hover:text-gray-600 rounded">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>

          {/* Grid toggle */}
          <button
            onClick={() => setShowGrid(!showGrid)}
            className={`p-2 rounded-lg transition-colors ${showGrid ? 'bg-teal-50 text-teal-600' : 'text-gray-400 hover:text-gray-600'}`}
            title="شبكة"
          >
            <Grid3X3 className="w-4 h-4" />
          </button>

          {/* Upload */}
          <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()} disabled={uploading} className="gap-1.5 text-xs">
            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
            خلفية
          </Button>

          {/* Save */}
          {onSave && (
            <Button size="sm" onClick={handleSave} className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700">
              <Save className="w-3.5 h-3.5" />
              حفظ
            </Button>
          )}
        </div>
      </div>

      {/* Main Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Sidebar — Available Fields */}
        <div className="w-48 border-l border-gray-200 bg-gray-50 p-3 overflow-y-auto shrink-0">
          <h4 className="text-xs font-bold text-gray-600 mb-2" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            <Layers className="w-3.5 h-3.5 inline-block ml-1" />
            الحقول المتاحة
          </h4>

          {unplacedFields.length === 0 && (
            <p className="text-[10px] text-gray-400 text-center py-4">
              {availableFields.length === 0 ? 'لا توجد حقول. أضفها من محرر الحقول.' : 'تم وضع جميع الحقول ✓'}
            </p>
          )}

          <div className="space-y-1.5">
            {unplacedFields.map(f => (
              <button
                key={f.id}
                onClick={() => addFieldToCanvas(f.id, f.label)}
                className="w-full text-right flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-lg border border-dashed border-gray-300 text-gray-600 hover:border-teal-400 hover:text-teal-700 hover:bg-teal-50 transition-colors"
              >
                <Plus className="w-3 h-3 shrink-0" />
                <span className="truncate">{f.label}</span>
              </button>
            ))}
          </div>

          {/* Placed Fields list */}
          {canvas.fields.length > 0 && (
            <>
              <h4 className="text-xs font-bold text-gray-600 mt-4 mb-2">
                الحقول الموضوعة ({canvas.fields.length})
              </h4>
              <div className="space-y-1">
                {canvas.fields.map(f => (
                  <div
                    key={f.fieldId}
                    onClick={() => setSelectedFieldId(f.fieldId)}
                    className={`flex items-center justify-between px-2 py-1.5 text-xs rounded-lg cursor-pointer transition-colors ${
                      selectedFieldId === f.fieldId
                        ? 'bg-teal-50 border border-teal-300 text-teal-700'
                        : 'bg-white border border-gray-200 text-gray-600 hover:bg-gray-50'
                    }`}
                  >
                    <span className="truncate">{f.label}</span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeField(f.fieldId); }}
                      className="text-gray-400 hover:text-red-500 p-0.5"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {/* Canvas Area */}
        <div
          ref={canvasContainerRef}
          className="flex-1 overflow-auto bg-gray-200 p-6"
          onClick={() => setSelectedFieldId(null)}
        >
          <div className="flex justify-center">
            <div
              style={{
                transform: `scale(${zoom})`,
                transformOrigin: 'top center',
                transition: 'transform 0.15s ease',
              }}
            >
              <div
                className="relative bg-white shadow-xl"
                style={{
                  width: `${canvas.backgroundWidth}px`,
                  height: `${canvas.backgroundHeight}px`,
                }}
              >
                {/* Background Image */}
                {canvas.backgroundUrl ? (
                  <img
                    src={canvas.backgroundUrl}
                    alt="خلفية القالب"
                    className="absolute inset-0 w-full h-full object-contain pointer-events-none"
                    draggable={false}
                  />
                ) : (
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-300">
                    <ImageIcon className="w-16 h-16 mb-3" />
                    <p className="text-sm font-medium" style={{ fontFamily: "'Tajawal', sans-serif" }}>
                      اضغط "خلفية" لتحميل صورة القالب
                    </p>
                    <p className="text-xs text-gray-400 mt-1">صورة PDF أو PNG</p>
                  </div>
                )}

                {/* Grid Overlay */}
                {showGrid && (
                  <svg className="absolute inset-0 w-full h-full pointer-events-none opacity-10">
                    <defs>
                      <pattern id="grid" width="50" height="50" patternUnits="userSpaceOnUse">
                        <path d="M 50 0 L 0 0 0 50" fill="none" stroke="#000" strokeWidth="0.5" />
                      </pattern>
                    </defs>
                    <rect width="100%" height="100%" fill="url(#grid)" />
                  </svg>
                )}

                {/* Placed Fields */}
                {canvas.fields.map(field => (
                  <FieldPlacer
                    key={field.fieldId}
                    field={field}
                    selected={selectedFieldId === field.fieldId}
                    containerScale={zoom}
                    onSelect={() => setSelectedFieldId(field.fieldId)}
                    onUpdate={(p) => updateField(field.fieldId, p)}
                    onRemove={() => removeField(field.fieldId)}
                  />
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleUploadBackground}
        className="hidden"
      />
    </div>
  );
}
