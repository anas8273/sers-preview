import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook للمعاينة المفردة - يستخدم CSS transform: scale() 
 * مع حساب ديناميكي للـ scale factor بناءً على عرض الحاوية
 * + أزرار تكبير/تصغير يدوية
 * 
 * النهج: الصفحة A4 تُعرض بحجمها الأصلي (793.7px) ثم تُصغر بـ transform: scale()
 * الحاوية الخارجية تُعدل ارتفاعها لتتناسب مع الحجم المصغر
 */
export function usePreviewScale(a4Width = 793.7) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [autoScale, setAutoScale] = useState(0.5);
  const [manualZoom, setManualZoom] = useState(100);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);
  const manualZoomRef = useRef(manualZoom);
  manualZoomRef.current = manualZoom;

  // Scale النهائي = autoScale * (manualZoom / 100)
  const scale = autoScale * (manualZoom / 100);

  // حساب autoScale بناءً على عرض الحاوية - بدون dependencies على state
  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container) return;

    const containerWidth = container.clientWidth;
    // نترك هامش 32px من كل جانب
    const availableWidth = containerWidth - 32;
    // نريد أن تتسع الصفحة بالكامل داخل الحاوية
    // حد أقصى 0.85 لتبدو أنيقة حتى على الشاشات الكبيرة
    const newAutoScale = Math.max(Math.min(availableWidth / a4Width, 0.85), 0.25);
    setAutoScale(newAutoScale);

    // حساب الارتفاع المصغر
    const pageHeight = page?.scrollHeight || 1122.5;
    const finalScale = newAutoScale * (manualZoomRef.current / 100);
    setScaledHeight(pageHeight * finalScale);
  }, [a4Width]); // لا نعتمد على manualZoom - نستخدم ref

  // مراقبة تغيير حجم الحاوية
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(() => {
      recalculate();
    });
    observer.observe(container);
    
    // حساب أولي + إعادة حساب بعد render
    recalculate();
    const t1 = setTimeout(recalculate, 100);
    const t2 = setTimeout(recalculate, 500);

    return () => {
      observer.disconnect();
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [recalculate]);

  // مراقبة تغيير حجم الصفحة
  useEffect(() => {
    const page = pageRef.current;
    if (!page) return;

    const observer = new ResizeObserver(() => {
      recalculate();
    });
    observer.observe(page);

    return () => observer.disconnect();
  }, [recalculate]);

  // إعادة حساب عند تغيير manualZoom
  useEffect(() => {
    recalculate();
  }, [manualZoom, recalculate]);

  // تكبير
  const zoomIn = useCallback(() => {
    setManualZoom(prev => Math.min(prev + 25, 200));
  }, []);

  // تصغير
  const zoomOut = useCallback(() => {
    setManualZoom(prev => Math.max(prev - 25, 25));
  }, []);

  // إعادة الحجم الأصلي
  const resetZoom = useCallback(() => {
    setManualZoom(100);
  }, []);

  return {
    containerRef,
    pageRef,
    scale,
    scaledHeight,
    recalculate,
    // للتوافق مع الكود القديم
    previewImageUrl: null as string | null,
    isCapturing: false,
    capturePreview: recalculate,
    zoomLevel: manualZoom,
    zoomIn,
    zoomOut,
    resetZoom,
    setZoomLevel: setManualZoom,
  };
}
