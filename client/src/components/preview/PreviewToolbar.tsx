/**
 * PreviewToolbar — شريط أدوات موحد للمعاينة والتصدير
 * يُستخدم مع UnifiedPreview في كل الأقسام
 */
import React, { useState } from 'react';
import {
  Printer, FileDown, Share2, ZoomIn, ZoomOut, Maximize2, Minimize2,
  RotateCcw, Loader2, FileText, Image as ImageIcon, X
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface PreviewToolbarProps {
  /** عنوان المعاينة */
  title?: string;
  /** عنصر المعاينة (ref) */
  previewRef: React.RefObject<HTMLDivElement>;
  /** عند التصدير كـ PDF */
  onExportPDF?: () => Promise<void>;
  /** عند الطباعة */
  onPrint?: () => Promise<void>;
  /** عند التصدير كصورة */
  onExportImage?: () => Promise<void>;
  /** عند المشاركة */
  onShare?: () => void;
  /** عند الإغلاق */
  onClose?: () => void;
  /** الحجم الحالي (zoom %) */
  zoom?: number;
  /** تغيير الحجم */
  onZoomChange?: (zoom: number) => void;
  /** وضع ملء الشاشة */
  fullscreen?: boolean;
  /** تبديل ملء الشاشة */
  onFullscreenToggle?: () => void;
  /** CSS class */
  className?: string;
}

export default function PreviewToolbar({
  title,
  previewRef,
  onExportPDF,
  onPrint,
  onExportImage,
  onShare,
  onClose,
  zoom = 100,
  onZoomChange,
  fullscreen = false,
  onFullscreenToggle,
  className = '',
}: PreviewToolbarProps) {
  const [exporting, setExporting] = useState<'pdf' | 'image' | 'print' | null>(null);

  const handleAction = async (type: 'pdf' | 'image' | 'print', fn?: () => Promise<void>) => {
    if (!fn || exporting) return;
    setExporting(type);
    try {
      await fn();
      toast.success(
        type === 'pdf' ? 'تم تصدير PDF بنجاح' :
        type === 'image' ? 'تم تصدير الصورة بنجاح' :
        'جاري الطباعة...'
      );
    } catch (e: any) {
      toast.error(`فشل ${type === 'pdf' ? 'التصدير' : type === 'image' ? 'تصدير الصورة' : 'الطباعة'}: ${e.message || 'خطأ غير معروف'}`);
    } finally {
      setExporting(null);
    }
  };

  return (
    <div
      className={`sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-gray-200 px-4 py-2.5 flex items-center gap-2 justify-between ${className}`}
      dir="rtl"
    >
      {/* Right: Title + Close */}
      <div className="flex items-center gap-2 min-w-0">
        {onClose && (
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4" />
          </button>
        )}
        {title && (
          <h3 className="text-sm font-bold text-gray-800 truncate" style={{ fontFamily: "'Tajawal', sans-serif" }}>
            {title}
          </h3>
        )}
      </div>

      {/* Center: Zoom Controls */}
      {onZoomChange && (
        <div className="flex items-center gap-1 bg-gray-100 rounded-lg px-1 py-0.5">
          <button
            onClick={() => onZoomChange(Math.max(50, zoom - 10))}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <span className="text-[10px] font-medium text-gray-600 w-8 text-center tabular-nums">
            {zoom}%
          </span>
          <button
            onClick={() => onZoomChange(Math.min(200, zoom + 10))}
            className="p-1 text-gray-500 hover:text-gray-700 rounded"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => onZoomChange(100)}
            className="p-1 text-gray-400 hover:text-gray-600 rounded"
            title="إعادة ضبط"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>
      )}

      {/* Left: Actions */}
      <div className="flex items-center gap-1.5">
        {onFullscreenToggle && (
          <button
            onClick={onFullscreenToggle}
            className="p-2 text-gray-500 hover:text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
            title={fullscreen ? 'تصغير' : 'ملء الشاشة'}
          >
            {fullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
          </button>
        )}

        {onPrint && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('print', onPrint)}
            disabled={!!exporting}
            className="gap-1.5 text-xs"
          >
            {exporting === 'print' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Printer className="w-3.5 h-3.5" />}
            طباعة
          </Button>
        )}

        {onExportImage && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleAction('image', onExportImage)}
            disabled={!!exporting}
            className="gap-1.5 text-xs"
          >
            {exporting === 'image' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5" />}
            صورة
          </Button>
        )}

        {onExportPDF && (
          <Button
            size="sm"
            onClick={() => handleAction('pdf', onExportPDF)}
            disabled={!!exporting}
            className="gap-1.5 text-xs bg-teal-600 hover:bg-teal-700"
          >
            {exporting === 'pdf' ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FileDown className="w-3.5 h-3.5" />}
            PDF
          </Button>
        )}

        {onShare && (
          <button
            onClick={onShare}
            className="p-2 text-gray-500 hover:text-teal-600 rounded-lg hover:bg-teal-50 transition-colors"
            title="مشاركة"
          >
            <Share2 className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  );
}
