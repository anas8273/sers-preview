/**
 * FieldPlacer — حقل قابل للسحب والإفلات فوق Canvas القالب
 * يعرض label الحقل + إطار شفاف قابل للتحريك والتحجيم
 */
import React, { useState, useCallback, useRef, useEffect } from 'react';
import { GripVertical, X, Move } from 'lucide-react';

export interface FieldPlacement {
  fieldId: string;
  label: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

interface FieldPlacerProps {
  field: FieldPlacement;
  selected: boolean;
  containerScale: number;
  onSelect: () => void;
  onUpdate: (placement: FieldPlacement) => void;
  onRemove: () => void;
}

export default function FieldPlacer({
  field,
  selected,
  containerScale,
  onSelect,
  onUpdate,
  onRemove,
}: FieldPlacerProps) {
  const [isDragging, setIsDragging] = useState(false);
  const [isResizing, setIsResizing] = useState(false);
  const dragStart = useRef({ x: 0, y: 0, fieldX: 0, fieldY: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });

  // ─── Drag Logic ────────────────────────────────────────
  const handleDragStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    onSelect();
    setIsDragging(true);
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      fieldX: field.x,
      fieldY: field.y,
    };
  }, [field.x, field.y, onSelect]);

  useEffect(() => {
    if (!isDragging) return;
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - dragStart.current.x) / containerScale;
      const dy = (e.clientY - dragStart.current.y) / containerScale;
      onUpdate({
        ...field,
        x: Math.max(0, dragStart.current.fieldX + dx),
        y: Math.max(0, dragStart.current.fieldY + dy),
      });
    };
    const handleUp = () => setIsDragging(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isDragging, containerScale, field, onUpdate]);

  // ─── Resize Logic ──────────────────────────────────────
  const handleResizeStart = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsResizing(true);
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: field.width,
      h: field.height,
    };
  }, [field.width, field.height]);

  useEffect(() => {
    if (!isResizing) return;
    const handleMove = (e: MouseEvent) => {
      const dx = (e.clientX - resizeStart.current.x) / containerScale;
      const dy = (e.clientY - resizeStart.current.y) / containerScale;
      onUpdate({
        ...field,
        width: Math.max(60, resizeStart.current.w + dx),
        height: Math.max(20, resizeStart.current.h + dy),
      });
    };
    const handleUp = () => setIsResizing(false);
    window.addEventListener('mousemove', handleMove);
    window.addEventListener('mouseup', handleUp);
    return () => {
      window.removeEventListener('mousemove', handleMove);
      window.removeEventListener('mouseup', handleUp);
    };
  }, [isResizing, containerScale, field, onUpdate]);

  return (
    <div
      className={`absolute group cursor-move select-none ${
        selected ? 'z-20' : 'z-10'
      }`}
      style={{
        left: `${field.x}px`,
        top: `${field.y}px`,
        width: `${field.width}px`,
        height: `${field.height}px`,
      }}
      onClick={(e) => { e.stopPropagation(); onSelect(); }}
      onMouseDown={handleDragStart}
    >
      {/* Field Box */}
      <div
        className={`w-full h-full rounded border-2 transition-colors flex items-center justify-center ${
          selected
            ? 'border-teal-500 bg-teal-500/15 shadow-lg'
            : 'border-blue-400/60 bg-blue-400/10 hover:border-blue-500 hover:bg-blue-400/15'
        }`}
      >
        {/* Move handle */}
        <div className="absolute -top-5 right-0 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <span
            className="text-[9px] font-bold text-white bg-teal-600 px-1.5 py-0.5 rounded-t"
            style={{ fontFamily: "'Tajawal', sans-serif" }}
          >
            {field.label}
          </span>
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onRemove(); }}
            className="text-white bg-red-500 hover:bg-red-600 rounded-t p-0.5"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Center label */}
        <span
          className="text-[10px] font-medium text-gray-700 truncate px-1 pointer-events-none"
          style={{ fontFamily: "'Tajawal', sans-serif" }}
        >
          {field.label}
        </span>
      </div>

      {/* Resize handle (bottom-left for RTL) */}
      {selected && (
        <div
          onMouseDown={handleResizeStart}
          className="absolute -bottom-1 -left-1 w-3 h-3 bg-teal-500 rounded-full cursor-se-resize shadow-md hover:bg-teal-600"
        />
      )}
    </div>
  );
}
