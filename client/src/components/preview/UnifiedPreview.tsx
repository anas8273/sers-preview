/**
 * UnifiedPreview — معاينة موحدة لجميع الأقسام
 * يعرض المحتوى في إطار A4 مع scaling responsive
 * يستخدم usePreviewScale hook للتحجيم التلقائي
 */
import React, { useState, useCallback, useId } from 'react';
import { usePreviewScale } from '@/hooks/usePreviewScale';
import { exportToPDF, printElement } from '@/lib/pdf-export';
import PreviewToolbar from './PreviewToolbar';

interface UnifiedPreviewProps {
  /** عنوان المعاينة */
  title?: string;
  /** محتوى المعاينة (React children) */
  children: React.ReactNode;
  /** اسم الملف عند التصدير */
  exportFileName?: string;
  /** إظهار الأدوات */
  showToolbar?: boolean;
  /** عند الإغلاق */
  onClose?: () => void;
  /** عند المشاركة */
  onShare?: () => void;
  /** CSS class للحاوية الخارجية */
  className?: string;
}

export default function UnifiedPreview({
  title = 'معاينة',
  children,
  exportFileName = 'document',
  showToolbar = true,
  onClose,
  onShare,
  className = '',
}: UnifiedPreviewProps) {
  const [fullscreen, setFullscreen] = useState(false);
  const pageId = 'unified-preview-page';

  // usePreviewScale manages its own refs and zoom — no args needed
  const {
    containerRef,
    pageRef,
    previewScale,
    wrapperWidth,
    wrapperHeight,
    zoomLevel,
    zoomIn,
    zoomOut,
    resetZoom,
  } = usePreviewScale();

  const handleExportPDF = useCallback(async () => {
    await exportToPDF(pageId, `${exportFileName}.pdf`);
  }, [exportFileName]);

  const handlePrint = useCallback(async () => {
    printElement(pageId);
  }, []);

  const handleExportImage = useCallback(async () => {
    if (!pageRef.current) return;
    const { default: html2canvas } = await import('html2canvas');
    const canvas = await html2canvas(pageRef.current, {
      scale: 2,
      useCORS: true,
      backgroundColor: '#ffffff',
    });
    const link = document.createElement('a');
    link.download = `${exportFileName}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
  }, [exportFileName, pageRef]);

  const handleZoomChange = useCallback((newZoom: number) => {
    // The hook manages zoom internally via zoomIn/zoomOut/resetZoom
    // Map external zoom request to the closest action
    if (newZoom > zoomLevel) zoomIn();
    else if (newZoom < zoomLevel) zoomOut();
    else resetZoom();
  }, [zoomLevel, zoomIn, zoomOut, resetZoom]);

  return (
    <div
      className={`flex flex-col ${fullscreen ? 'fixed inset-0 z-50 bg-gray-900/50' : ''} ${className}`}
    >
      {/* Toolbar */}
      {showToolbar && (
        <PreviewToolbar
          title={title}
          previewRef={pageRef as any}
          onExportPDF={handleExportPDF}
          onPrint={handlePrint}
          onExportImage={handleExportImage}
          onShare={onShare}
          onClose={onClose}
          zoom={zoomLevel}
          onZoomChange={handleZoomChange}
          fullscreen={fullscreen}
          onFullscreenToggle={() => setFullscreen(!fullscreen)}
        />
      )}

      {/* Preview Container */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-auto bg-gray-100 ${fullscreen ? 'p-6' : 'p-4'}`}
        style={{ minHeight: 400 }}
      >
        <div className="flex justify-center">
          <div
            style={{
              width: `${wrapperWidth}px`,
              height: `${wrapperHeight}px`,
              transition: 'width 0.2s ease, height 0.2s ease',
            }}
          >
            {/* A4 Page */}
            <div
              ref={pageRef}
              id={pageId}
              className="bg-white shadow-xl origin-top-right"
              style={{
                width: '793.7px',
                minHeight: '1122.5px',
                transform: `scale(${previewScale})`,
                transformOrigin: 'top right',
              }}
              dir="rtl"
            >
              {children}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

