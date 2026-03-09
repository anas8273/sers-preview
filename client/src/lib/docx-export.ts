/**
 * نظام تصدير Word (.docx) - SERS
 * يحول المعاينة HTML إلى ملف Word بتنسيق مطابق
 * يستخدم مكتبة docx لإنشاء مستند Word احترافي
 * 
 * الآلية:
 * 1. يأخذ HTML من العنصر المحدد
 * 2. يرسله إلى السيرفر عبر /api/export-docx
 * 3. السيرفر يحول HTML إلى DOCX باستخدام مكتبة docx
 * 4. النتيجة: ملف Word بتنسيق احترافي مع دعم RTL والعربية
 */

import { saveAs } from 'file-saver';

/**
 * تصدير Word عبر Server-Side Rendering
 * يرسل HTML إلى السيرفر الذي يحوله إلى DOCX
 */
export async function exportToDocx(
  elementId: string,
  filename: string = "document.docx",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found: " + elementId);

  try {
    onProgress?.(1, 4);

    // Step 1: استخراج HTML من العنصر
    const htmlContent = await extractHtmlForDocx(element);
    
    onProgress?.(2, 4);

    // Step 2: إرسال HTML إلى السيرفر لتحويله إلى DOCX
    onProgress?.(3, 4);

    const response = await fetch('/api/export-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ html: htmlContent, filename }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'DOCX export failed');
    }

    // Step 3: تحميل الملف
    const blob = await response.blob();
    saveAs(blob, filename);

    onProgress?.(4, 4);
    return true;
  } catch (err) {
    console.error("DOCX export error:", err);
    throw err;
  }
}

/**
 * استخراج HTML مع تنظيف للتحويل إلى DOCX
 */
async function extractHtmlForDocx(element: HTMLElement): Promise<string> {
  // إخفاء الأزرار مؤقتاً
  const buttons = element.querySelectorAll("button, [data-no-print]");
  const buttonDisplays: string[] = [];
  buttons.forEach((btn, i) => {
    buttonDisplays[i] = (btn as HTMLElement).style.display;
    (btn as HTMLElement).style.display = "none";
  });

  // نسخ العنصر
  const clone = element.cloneNode(true) as HTMLElement;

  // استعادة الأزرار في العنصر الأصلي
  buttons.forEach((btn, i) => {
    (btn as HTMLElement).style.display = buttonDisplays[i];
  });

  // حذف الأزرار من النسخة
  clone.querySelectorAll("button, [data-no-print]").forEach(el => el.remove());

  // تحويل الأنماط المحسوبة إلى inline styles
  await inlineComputedStylesForDocx(element, clone);

  // تحويل الصور إلى data URLs
  await convertImagesToDataUrls(clone);

  return clone.innerHTML;
}

/**
 * تحويل الأنماط المحسوبة إلى inline styles
 */
async function inlineComputedStylesForDocx(original: HTMLElement, clone: HTMLElement): Promise<void> {
  const origElements = [original, ...Array.from(original.querySelectorAll("*"))] as HTMLElement[];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll("*"))] as HTMLElement[];

  const importantProps = [
    'color', 'backgroundColor', 'background',
    'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'fontSize', 'fontWeight', 'fontFamily', 'lineHeight',
    'textAlign', 'direction', 'display',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'width', 'maxWidth', 'minWidth', 'height', 'minHeight',
  ];

  for (let i = 0; i < Math.min(origElements.length, cloneElements.length); i++) {
    const origEl = origElements[i];
    const cloneEl = cloneElements[i];
    
    if (origEl.offsetParent === null && origEl !== original) continue;

    const computed = window.getComputedStyle(origEl);
    
    for (const prop of importantProps) {
      const cssProp = prop.replace(/([A-Z])/g, '-$1').toLowerCase();
      const value = computed.getPropertyValue(cssProp);
      if (value && value !== '' && value !== 'none' && value !== 'normal' && value !== 'auto') {
        if (value.includes('oklch')) {
          const rgb = oklchToRgb(value);
          if (rgb) {
            cloneEl.style.setProperty(cssProp, rgb);
            continue;
          }
        }
        cloneEl.style.setProperty(cssProp, value);
      }
    }

    cloneEl.style.fontFamily = "'Cairo', 'Tajawal', 'Arial', sans-serif";
  }
}

/**
 * تحويل الصور الخارجية إلى data URLs
 */
async function convertImagesToDataUrls(element: HTMLElement): Promise<void> {
  const images = element.querySelectorAll("img");
  
  const promises = Array.from(images).map(async (img) => {
    const src = img.getAttribute("src") || img.src;
    if (src && !src.startsWith("data:") && !src.startsWith("blob:")) {
      try {
        let dataUrl: string | null = null;
        try {
          const resp = await fetch(src, { mode: "cors" });
          if (resp.ok) {
            const blob = await resp.blob();
            dataUrl = await blobToDataUrl(blob);
          }
        } catch {
          // fallback to proxy
        }
        
        if (!dataUrl) {
          try {
            const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(src)}`;
            const resp = await fetch(proxyUrl);
            if (resp.ok) {
              const blob = await resp.blob();
              dataUrl = await blobToDataUrl(blob);
            }
          } catch {
            // skip
          }
        }
        
        if (dataUrl) {
          img.src = dataUrl;
          img.setAttribute("src", dataUrl);
        }
      } catch {
        // skip
      }
    }
  });

  await Promise.all(promises);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function oklchToRgb(oklchValue: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = oklchValue;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return d[3] < 255
      ? `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`
      : `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch {
    return null;
  }
}
