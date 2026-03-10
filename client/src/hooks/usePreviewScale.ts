import { useEffect, useRef, useState, useCallback } from 'react';

/**
 * Hook لحساب scale factor ديناميكياً للمعاينة المفردة
 * يستخدم ResizeObserver لمراقبة حجم الحاوية وتعديل scale تلقائياً
 * 
 * @param a4Width عرض صفحة A4 بالبكسل (793.7px = 210mm)
 * @returns { containerRef, pageRef, scale, scaledHeight }
 */
export function usePreviewScale(a4Width = 793.7) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pageRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [scaledHeight, setScaledHeight] = useState<number | undefined>(undefined);

  const recalculate = useCallback(() => {
    const container = containerRef.current;
    const page = pageRef.current;
    if (!container || !page) return;

    const containerWidth = container.clientWidth;
    // إذا كانت الحاوية أصغر من عرض A4، نحتاج تصغير
    if (containerWidth < a4Width) {
      const newScale = containerWidth / a4Width;
      setScale(newScale);
      // حساب الارتفاع الفعلي بعد التصغير
      const pageHeight = page.scrollHeight;
      setScaledHeight(pageHeight * newScale);
    } else {
      setScale(1);
      setScaledHeight(undefined);
    }
  }, [a4Width]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // حساب أولي
    recalculate();

    // مراقبة تغيير حجم الحاوية
    const observer = new ResizeObserver(() => {
      recalculate();
    });
    observer.observe(container);

    // مراقبة تغيير حجم النافذة أيضاً
    window.addEventListener('resize', recalculate);

    return () => {
      observer.disconnect();
      window.removeEventListener('resize', recalculate);
    };
  }, [recalculate]);

  // إعادة الحساب بعد تحميل المحتوى (الصور مثلاً)
  useEffect(() => {
    const timer = setTimeout(recalculate, 300);
    return () => clearTimeout(timer);
  }, [recalculate]);

  return { containerRef, pageRef, scale, scaledHeight, recalculate };
}
