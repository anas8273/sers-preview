/**
 * نظام تصدير Word (.docx) - SERS
 * 
 * النهج الجديد: يرسل بيانات منظمة (JSON) إلى السيرفر
 * السيرفر يبني مستند Word نصي قابل للتعديل مباشرة
 * 
 * النهج القديم (HTML → screenshot) لا يزال متاحاً كـ fallback
 */

import { saveAs } from 'file-saver';

// ===== Types =====
interface DocxField {
  label: string;
  value: string;
}

interface DocxEvidence {
  fileName?: string;
  fileUrl?: string;
  displayAs?: "image" | "qr";
  type?: string;
  text?: string;
  link?: string;
}

interface DocxSubEvidence {
  title: string;
  fields: DocxField[];
  evidences: DocxEvidence[];
}

interface DocxCriterion {
  title: string;
  subEvidences: DocxSubEvidence[];
}

interface DocxPersonalInfo {
  name: string;
  school: string;
  department: string;
  year: string;
  semester: string;
  evaluator: string;
  evaluatorRole: string;
  date: string;
  reportTitle: string;
}

export interface DocxExportData {
  personalInfo: DocxPersonalInfo;
  criteria: DocxCriterion[];
  themeColor?: string;
  mode: "single" | "full";
  singleTitle?: string;
}

/**
 * تصدير Word نصي قابل للتعديل - النهج الجديد
 * يرسل بيانات منظمة بدلاً من HTML
 */
export async function exportToDocxStructured(
  data: DocxExportData,
  filename: string = "document.docx",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  try {
    onProgress?.(1, 3);

    // إرسال البيانات المنظمة إلى السيرفر
    onProgress?.(2, 3);

    const response = await fetch('/api/export-docx', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data, filename }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'DOCX export failed');
    }

    // تحميل الملف
    const blob = await response.blob();
    saveAs(blob, filename);

    onProgress?.(3, 3);
    return true;
  } catch (err) {
    console.error("DOCX structured export error:", err);
    throw err;
  }
}

/**
 * تصدير Word عبر HTML (النهج القديم - fallback)
 * يحول HTML إلى صورة في Word
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

    // Step 1: استخراج HTML مع جميع الأنماط
    const htmlContent = await extractHtmlWithFullStyles(element);
    
    onProgress?.(2, 4);

    // Step 2: إرسال HTML إلى السيرفر
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
 * استخراج HTML مع تحويل جميع الأنماط المحسوبة إلى inline styles
 */
async function extractHtmlWithFullStyles(element: HTMLElement): Promise<string> {
  const buttons = element.querySelectorAll("button, [data-no-print]");
  const buttonDisplays: string[] = [];
  buttons.forEach((btn, i) => {
    buttonDisplays[i] = (btn as HTMLElement).style.display;
    (btn as HTMLElement).style.display = "none";
  });

  const clone = element.cloneNode(true) as HTMLElement;

  buttons.forEach((btn, i) => {
    (btn as HTMLElement).style.display = buttonDisplays[i];
  });

  clone.querySelectorAll("button, [data-no-print]").forEach(el => el.remove());

  await inlineComputedStyles(element, clone);
  await convertImagesToDataUrls(clone);
  convertOklchInClone(clone);

  const pages = clone.querySelectorAll(":scope > div");
  if (pages.length > 0) {
    pages.forEach(page => {
      (page as HTMLElement).classList.add('pdf-page');
      (page as HTMLElement).style.boxShadow = 'none';
      (page as HTMLElement).style.marginBottom = '0';
    });
  }

  return clone.innerHTML;
}

async function inlineComputedStyles(original: HTMLElement, clone: HTMLElement): Promise<void> {
  const origElements = [original, ...Array.from(original.querySelectorAll("*"))] as HTMLElement[];
  const cloneElements = [clone, ...Array.from(clone.querySelectorAll("*"))] as HTMLElement[];

  const importantProps = [
    'color', 'backgroundColor', 'background', 'backgroundImage',
    'borderTop', 'borderRight', 'borderBottom', 'borderLeft',
    'borderTopColor', 'borderRightColor', 'borderBottomColor', 'borderLeftColor',
    'borderTopWidth', 'borderRightWidth', 'borderBottomWidth', 'borderLeftWidth',
    'borderTopStyle', 'borderRightStyle', 'borderBottomStyle', 'borderLeftStyle',
    'fontSize', 'fontWeight', 'fontFamily', 'lineHeight', 'letterSpacing',
    'textAlign', 'direction', 'display', 'flexDirection', 'justifyContent', 'alignItems',
    'padding', 'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
    'margin', 'marginTop', 'marginRight', 'marginBottom', 'marginLeft',
    'width', 'maxWidth', 'minWidth', 'height', 'minHeight', 'maxHeight',
    'position', 'top', 'right', 'bottom', 'left', 'zIndex',
    'overflow', 'whiteSpace', 'wordBreak', 'textDecoration',
    'borderRadius', 'boxShadow', 'opacity', 'filter',
    'gridTemplateColumns', 'gridTemplateRows', 'gap',
    'flex', 'flexGrow', 'flexShrink', 'flexBasis', 'flexWrap',
    'tableLayout', 'borderCollapse', 'borderSpacing',
    'verticalAlign', 'textIndent',
    'clipPath', 'objectFit', 'objectPosition',
    'textOverflow', 'overflowWrap',
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

  const allElements = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
  for (const el of allElements) {
    const bgImage = el.style.backgroundImage;
    if (bgImage && bgImage.includes("url(")) {
      const urlMatch = bgImage.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
      if (urlMatch) {
        try {
          const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(urlMatch[1])}`;
          const resp = await fetch(proxyUrl);
          if (resp.ok) {
            const blob = await resp.blob();
            const dataUrl = await blobToDataUrl(blob);
            el.style.backgroundImage = `url(${dataUrl})`;
          }
        } catch {
          // skip
        }
      }
    }
  }
}

function convertOklchInClone(element: HTMLElement): void {
  const allElements = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
  const colorProps = [
    "color", "background-color", "border-color", "border-top-color",
    "border-right-color", "border-bottom-color", "border-left-color",
    "background",
  ];

  for (const el of allElements) {
    for (const prop of colorProps) {
      const value = el.style.getPropertyValue(prop);
      if (value && value.includes("oklch")) {
        const rgb = oklchToRgb(value);
        if (rgb) el.style.setProperty(prop, rgb);
      }
    }
  }
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
