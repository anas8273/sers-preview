/**
 * A4PreviewFrame — معاينة A4 داخل iframe معزول تماماً
 *
 * التقنية: iframe حقيقي + حقن CSS + ReactDOM.createPortal
 *  1. إنشاء <iframe> بدون src (about:blank)
 *  2. نسخ جميع <style> و <link rel="stylesheet"> من document.head → iframe.head
 *  3. حقن Google Fonts + Tailwind CSS variables
 *  4. ReactDOM.createPortal لعرض children داخل الـ iframe body
 *  5. transform: scale() على الـ iframe للتحجيم المتناسب
 *
 * النتيجة: نسخة كربونية 100% — نفس CSS، نفس خطوط، نفس تنسيقات
 */
import React, { useRef, useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { A4_WIDTH_PX, A4_HEIGHT_PX } from '@shared/template-types';

// ─── Types ────────────────────────────────────────────────
interface A4PreviewFrameProps {
  /** React children to render inside the iframe (the REAL production component) */
  children: React.ReactNode;
  /** Fixed scale value (auto-calculated if not set) */
  fixedScale?: number;
  /** Container CSS class */
  className?: string;
  /** Show paper shadow */
  showShadow?: boolean;
}

/**
 * Copies all stylesheets from parent document into the iframe.
 * This ensures Tailwind CSS, Google Fonts, and all global styles transfer.
 */
function injectParentStyles(iframeDoc: Document) {
  const parentHead = document.head;

  // 1. Copy all <link rel="stylesheet"> (Tailwind CDN, Vite output, etc.)
  parentHead.querySelectorAll('link[rel="stylesheet"]').forEach(link => {
    iframeDoc.head.appendChild(link.cloneNode(true));
  });

  // 2. Copy all <style> tags (Vite injected styles, Tailwind utilities, CSS vars)
  parentHead.querySelectorAll('style').forEach(style => {
    iframeDoc.head.appendChild(style.cloneNode(true));
  });

  // 3. Ensure Google Fonts are loaded (Cairo, Tajawal — critical for Arabic)
  const fontLink = iframeDoc.createElement('link');
  fontLink.rel = 'stylesheet';
  fontLink.href = 'https://fonts.googleapis.com/css2?family=Cairo:wght@300;400;500;600;700;800;900&family=Tajawal:wght@300;400;500;700;800;900&family=Noto+Kufi+Arabic:wght@400;500;600;700;800;900&family=Amiri:wght@400;700&family=Almarai:wght@300;400;700;800&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap';
  iframeDoc.head.appendChild(fontLink);

  // 4. Copy CSS custom properties from parent :root
  const rootStyles = getComputedStyle(document.documentElement);
  const cssVars: string[] = [];
  for (let i = 0; i < rootStyles.length; i++) {
    const prop = rootStyles[i];
    if (prop.startsWith('--')) {
      cssVars.push(`${prop}: ${rootStyles.getPropertyValue(prop)};`);
    }
  }

  // 5. Base styles + sub-pixel rendering fixes for scaled borders
  const baseStyle = iframeDoc.createElement('style');
  baseStyle.textContent = `
    :root { ${cssVars.join(' ')} }
    html, body {
      margin: 0;
      padding: 0;
      font-family: 'Cairo', 'Tajawal', sans-serif;
      direction: rtl;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      background: #ffffff;
      overflow: hidden;
      width: ${A4_WIDTH_PX}px;
    }
    /* Sub-pixel rendering: prevent border blur under transform: scale() */
    * {
      -webkit-backface-visibility: hidden;
      backface-visibility: hidden;
    }
    .pdf-page {
      width: 210mm;
      min-height: 297mm;
    }
    /* SVG: prevent stroke distortion under scale transforms */
    svg path, svg line, svg rect, svg circle {
      vector-effect: non-scaling-stroke;
    }
  `;
  iframeDoc.head.appendChild(baseStyle);
}

/**
 * Auto-calculates scale to fit A4 inside container
 */
function useResponsiveScale(
  containerRef: React.RefObject<HTMLDivElement | null>,
  fixedScale?: number,
) {
  const [scale, setScale] = useState(fixedScale || 0.5);

  const recalc = useCallback(() => {
    if (fixedScale !== undefined) { setScale(fixedScale); return; }
    const el = containerRef.current;
    if (!el) return;
    const cw = el.clientWidth;
    const ch = el.clientHeight || cw * 1.414;
    const sx = cw / A4_WIDTH_PX;
    const sy = ch / A4_HEIGHT_PX;
    setScale(Math.max(0.1, Math.min(sx, sy, 1)));
  }, [fixedScale, containerRef]);

  useEffect(() => {
    recalc();
    const ro = new ResizeObserver(recalc);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, [recalc, containerRef]);

  return scale;
}

export default function A4PreviewFrame({
  children,
  fixedScale,
  className = '',
  showShadow = true,
}: A4PreviewFrameProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);
  const scale = useResponsiveScale(containerRef, fixedScale);

  // One-time setup: inject CSS into iframe and create the portal mount point
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const setup = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Write base structure
      doc.open();
      doc.write('<!DOCTYPE html><html dir="rtl"><head></head><body style="margin:0;padding:0;overflow:hidden"></body></html>');
      doc.close();

      // Inject all parent CSS into iframe
      injectParentStyles(doc);

      // Create mount point for React portal
      const mount = doc.createElement('div');
      mount.id = 'iframe-portal-root';
      mount.setAttribute('dir', 'rtl');
      mount.style.fontFamily = "'Cairo', 'Tajawal', sans-serif";
      doc.body.appendChild(mount);

      setMountNode(mount);
    };

    // For about:blank iframes, contentDocument is available immediately
    setup();
  }, []);

  const scaledHeight = A4_HEIGHT_PX * scale;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        width: '100%',
        height: `${scaledHeight}px`,
        position: 'relative',
        overflow: 'hidden',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'flex-start',
      }}
    >
      <iframe
        ref={iframeRef}
        title="A4 Template Preview"
        style={{
          border: 'none',
          width: `${A4_WIDTH_PX}px`,
          height: `${A4_HEIGHT_PX}px`,
          transform: `scale(${scale})`,
          transformOrigin: 'top center',
          boxShadow: showShadow
            ? '0 4px 24px rgba(0,0,0,0.12), 0 0 0 1px rgba(0,0,0,0.04)'
            : 'none',
          borderRadius: '2px',
          background: '#ffffff',
        }}
      />
      {/* ReactDOM.createPortal renders children into the iframe's DOM */}
      {mountNode && createPortal(
        <div dir="rtl" style={{ fontFamily: "'Cairo', 'Tajawal', sans-serif" }}>
          {children}
        </div>,
        mountNode,
      )}
    </div>
  );
}

// ─── Full-Size Preview Dialog ──────────────────────────────
export function A4PreviewDialog({
  isOpen,
  onClose,
  children,
  templateName,
  onEdit,
}: {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  templateName?: string;
  onEdit?: () => void;
}) {
  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      {/* Dialog */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-auto">
        <div
          className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[95vh] flex flex-col overflow-hidden"
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 dark:border-gray-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#2563EB" strokeWidth="2">
                  <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                  <circle cx="12" cy="12" r="3" />
                </svg>
              </div>
              <div>
                <h2 className="text-base font-bold text-gray-900 dark:text-white">
                  معاينة: {templateName || 'القالب'}
                </h2>
                <p className="text-xs text-gray-500">
                  المعاينة الحية — نفس ما يراه المستخدم النهائي (iframe معزول)
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
            >
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>

          {/* Preview Area */}
          <div
            className="flex-1 overflow-auto p-6"
            style={{ background: 'linear-gradient(135deg, #f1f5f9, #e2e8f0)' }}
          >
            <div className="flex justify-center" style={{ minHeight: '500px' }}>
              <A4PreviewFrame className="mx-auto" fixedScale={0.75}>
                {children}
              </A4PreviewFrame>
            </div>
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between px-6 py-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50 shrink-0">
            <button
              onClick={onClose}
              className="px-5 py-2 rounded-lg border border-gray-300 dark:border-gray-600 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
            >
              إغلاق
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="18" height="18" rx="2" />
                <path d="M3 9h18" />
              </svg>
              <span>A4 — 210mm × 297mm</span>
            </div>
            {onEdit && (
              <button
                onClick={onEdit}
                className="px-5 py-2 rounded-lg bg-teal-600 text-white text-sm font-medium hover:bg-teal-700 transition-colors flex items-center gap-2"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
                  <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" />
                </svg>
                تعديل هذا القالب
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
