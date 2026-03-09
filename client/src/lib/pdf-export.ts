import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export interface PdfTemplate {
  headerBg: string;
  headerText: string;
  accent: string;
  borderColor: string;
  bodyBg: string;
  fontFamily: string;
  coverImageUrl?: string;
  logoUrl?: string;
}

export const DEFAULT_TEMPLATE: PdfTemplate = {
  headerBg: "#047857",
  headerText: "#FFFFFF",
  accent: "#059669",
  borderColor: "#D1FAE5",
  bodyBg: "#FFFFFF",
  fontFamily: "Tajawal",
};

/**
 * تحويل جميع ألوان oklch في العنصر إلى RGB قبل التصدير
 * html2canvas لا يدعم oklch - يجب تحويلها إلى ألوان مدعومة
 */
function convertOklchToRgb(element: HTMLElement): (() => void) {
  const originalStyles: { el: HTMLElement; prop: string; value: string }[] = [];

  const allElements = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];

  const colorProps = [
    "color",
    "backgroundColor",
    "borderColor",
    "borderTopColor",
    "borderRightColor",
    "borderBottomColor",
    "borderLeftColor",
    "outlineColor",
    "textDecorationColor",
    "boxShadow",
    "caretColor",
  ];

  for (const el of allElements) {
    const computed = window.getComputedStyle(el);
    for (const prop of colorProps) {
      const value = computed.getPropertyValue(
        prop.replace(/([A-Z])/g, "-$1").toLowerCase()
      );
      if (value && value.includes("oklch")) {
        originalStyles.push({
          el,
          prop: prop,
          value: (el.style as any)[prop] || "",
        });

        const rgb = oklchToRgbString(value);
        if (rgb) {
          (el.style as any)[prop] = rgb;
        }
      }
    }
  }

  const rootEl = document.documentElement;
  const rootComputed = window.getComputedStyle(rootEl);
  const cssVarOverrides: { name: string; original: string }[] = [];

  const cssVarNames = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
    "--border", "--input", "--ring",
    "--sidebar", "--sidebar-foreground", "--sidebar-primary", "--sidebar-primary-foreground",
    "--sidebar-accent", "--sidebar-accent-foreground", "--sidebar-border", "--sidebar-ring",
    "--chart-1", "--chart-2", "--chart-3", "--chart-4", "--chart-5",
  ];

  for (const varName of cssVarNames) {
    const val = rootComputed.getPropertyValue(varName).trim();
    if (val && val.includes("oklch")) {
      const rgb = oklchToRgbString(val);
      if (rgb) {
        cssVarOverrides.push({ name: varName, original: rootEl.style.getPropertyValue(varName) });
        rootEl.style.setProperty(varName, rgb);
      }
    }
  }

  return () => {
    for (const { el, prop, value } of originalStyles) {
      (el.style as any)[prop] = value;
    }
    for (const { name, original } of cssVarOverrides) {
      if (original) {
        rootEl.style.setProperty(name, original);
      } else {
        rootEl.style.removeProperty(name);
      }
    }
  };
}

function oklchToRgbString(oklchValue: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;

    ctx.fillStyle = oklchValue;
    ctx.fillRect(0, 0, 1, 1);

    const imageData = ctx.getImageData(0, 0, 1, 1);
    const r = imageData.data[0];
    const g = imageData.data[1];
    const b = imageData.data[2];
    const a = imageData.data[3];

    if (a < 255) {
      return `rgba(${r}, ${g}, ${b}, ${(a / 255).toFixed(3)})`;
    }
    return `rgb(${r}, ${g}, ${b})`;
  } catch {
    return null;
  }
}

// A4 dimensions at 96dpi
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

// الخط العربي الموحد لضمان التطابق
const ARABIC_FONT = "'Cairo', 'Tajawal', 'Noto Sans Arabic', sans-serif";

/**
 * تثبيت جميع الأنماط المحسوبة على العنصر المستنسخ
 * هذا يضمن أن html2canvas يرى نفس الأنماط بالضبط كما في المعاينة
 */
function freezeComputedStyles(clonedEl: HTMLElement) {
  clonedEl.style.width = A4_WIDTH_PX + 'px';
  clonedEl.style.maxWidth = A4_WIDTH_PX + 'px';
  clonedEl.style.minWidth = A4_WIDTH_PX + 'px';
  clonedEl.style.minHeight = A4_HEIGHT_PX + 'px';
  clonedEl.style.marginBottom = '0';
  clonedEl.style.boxShadow = 'none';
  clonedEl.style.border = 'none';
  clonedEl.style.direction = 'rtl';
  clonedEl.style.overflow = 'hidden';
  clonedEl.classList.remove('shadow-lg', 'mb-6');
  clonedEl.style.fontFamily = ARABIC_FONT;

  const allInner = clonedEl.querySelectorAll('*');
  allInner.forEach((el) => {
    const htmlEl = el as HTMLElement;
    const computed = window.getComputedStyle(htmlEl);

    // ضمان الخطوط العربية
    const ff = computed.fontFamily;
    if (!ff || ff === 'serif' || ff === 'sans-serif' || ff === 'system-ui' || ff.includes('ui-')) {
      htmlEl.style.fontFamily = ARABIC_FONT;
    }

    // تثبيت أحجام الخطوط
    const fontSize = computed.fontSize;
    if (fontSize) htmlEl.style.fontSize = fontSize;

    // تثبيت الألوان - تحويل oklch
    const bgColor = computed.backgroundColor;
    if (bgColor && bgColor.includes('oklch')) {
      const rgb = oklchToRgbString(bgColor);
      if (rgb) htmlEl.style.backgroundColor = rgb;
    }
    const textColor = computed.color;
    if (textColor && textColor.includes('oklch')) {
      const rgb = oklchToRgbString(textColor);
      if (rgb) htmlEl.style.color = rgb;
    }
    const borderColor = computed.borderColor;
    if (borderColor && borderColor.includes('oklch')) {
      const rgb = oklchToRgbString(borderColor);
      if (rgb) htmlEl.style.borderColor = rgb;
    }

    // تثبيت line-height
    const lineHeight = computed.lineHeight;
    if (lineHeight && lineHeight !== 'normal') htmlEl.style.lineHeight = lineHeight;

    // تثبيت font-weight
    const fontWeight = computed.fontWeight;
    if (fontWeight) htmlEl.style.fontWeight = fontWeight;

    // تثبيت letter-spacing
    const letterSpacing = computed.letterSpacing;
    if (letterSpacing && letterSpacing !== 'normal') htmlEl.style.letterSpacing = letterSpacing;

    // تثبيت text-align
    const textAlign = computed.textAlign;
    if (textAlign) htmlEl.style.textAlign = textAlign;

    // تثبيت padding و margin
    htmlEl.style.padding = computed.padding;
    htmlEl.style.margin = computed.margin;
  });
}

/**
 * تصدير PDF بنظام صفحات A4 منفصلة - جودة عالية
 * كل div مباشر داخل preview-content = صفحة PDF واحدة
 * يحافظ على الخطوط والتنسيق والترتيب بالضبط كما في المعاينة
 */
export async function exportToPDF(
  elementId: string,
  filename: string = "document.pdf",
  onProgress?: (current: number, total: number) => void
) {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found");

  try {
    // إخفاء الأزرار والعناصر التفاعلية أثناء التصدير
    const buttons = element.querySelectorAll('button, [data-no-print]');
    buttons.forEach(btn => (btn as HTMLElement).style.display = 'none');

    // تحويل ألوان oklch إلى RGB قبل html2canvas
    const restoreColors = convertOklchToRgb(element);

    // انتظار تحميل الخطوط والصور
    await document.fonts.ready;
    await new Promise(resolve => setTimeout(resolve, 1000));

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    // البحث عن الصفحات المنفصلة (divs المباشرة داخل preview-content)
    const pages = element.querySelectorAll(':scope > div');
    const totalPages = pages.length || 1;
    
    if (pages.length > 0) {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        
        if (i > 0) pdf.addPage();
        
        // إبلاغ بالتقدم
        onProgress?.(i + 1, totalPages);

        const canvas = await html2canvas(page, {
          scale: 2.5, // جودة عالية جداً
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          imageTimeout: 30000,
          width: A4_WIDTH_PX,
          windowWidth: A4_WIDTH_PX,
          onclone: (_clonedDoc, clonedEl) => {
            freezeComputedStyles(clonedEl);
          },
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.96);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = pdfWidth / imgWidth;
        const scaledHeight = imgHeight * ratio;

        if (scaledHeight <= pdfHeight + 2) {
          // الصفحة تناسب صفحة PDF واحدة
          pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, Math.min(scaledHeight, pdfHeight));
        } else {
          // الصفحة أطول من A4 - تقسيمها على عدة صفحات PDF
          const pageCanvasHeight = pdfHeight / ratio;
          let remainingHeight = imgHeight;
          let sourceY = 0;
          let subPage = 0;

          while (remainingHeight > 20) {
            if (subPage > 0) pdf.addPage();

            const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
            
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = imgWidth;
            pageCanvas.height = Math.ceil(sliceHeight);
            const ctx = pageCanvas.getContext('2d');
            if (ctx) {
              ctx.fillStyle = '#ffffff';
              ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
              ctx.drawImage(canvas, 0, sourceY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
              const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.96);
              pdf.addImage(pageImgData, "JPEG", 0, 0, pdfWidth, sliceHeight * ratio);
            }

            sourceY += sliceHeight;
            remainingHeight -= sliceHeight;
            subPage++;
          }
        }

        // إعطاء المتصفح فرصة للتنفس بين الصفحات
        await new Promise(resolve => setTimeout(resolve, 150));
      }
    } else {
      // Fallback: التقاط العنصر بالكامل كصورة واحدة
      onProgress?.(1, 1);
      const canvas = await html2canvas(element, {
        scale: 2.5,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        onclone: (_clonedDoc, clonedEl) => {
          freezeComputedStyles(clonedEl);
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.96);
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = pdfWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= pdfHeight) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, scaledHeight);
      } else {
        const pageCanvasHeight = pdfHeight / ratio;
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let pageNum = 0;

        while (remainingHeight > 20) {
          if (pageNum > 0) pdf.addPage();

          const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = Math.ceil(sliceHeight);
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
            ctx.drawImage(canvas, 0, sourceY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
            const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.96);
            pdf.addImage(pageImgData, "JPEG", 0, 0, pdfWidth, sliceHeight * ratio);
          }

          sourceY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }
    }

    // استعادة الألوان الأصلية
    restoreColors();

    // إعادة إظهار الأزرار
    buttons.forEach(btn => (btn as HTMLElement).style.display = '');

    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("PDF export error:", err);
    throw err;
  }
}

/**
 * تطبيق ثيم القالب على عنصر HTML قبل التصدير
 */
export function applyTemplateToElement(element: HTMLElement, template: PdfTemplate) {
  const headers = element.querySelectorAll('[data-pdf-header]');
  headers.forEach(h => {
    (h as HTMLElement).style.backgroundColor = template.headerBg;
    (h as HTMLElement).style.color = template.headerText;
  });

  const accents = element.querySelectorAll('[data-pdf-accent]');
  accents.forEach(a => {
    (a as HTMLElement).style.color = template.accent;
  });

  const accentBgs = element.querySelectorAll('[data-pdf-accent-bg]');
  accentBgs.forEach(a => {
    (a as HTMLElement).style.backgroundColor = template.accent + '15';
    (a as HTMLElement).style.borderColor = template.accent;
  });

  const borders = element.querySelectorAll('[data-pdf-border]');
  borders.forEach(b => {
    (b as HTMLElement).style.borderColor = template.borderColor;
  });

  const bodies = element.querySelectorAll('[data-pdf-body]');
  bodies.forEach(b => {
    (b as HTMLElement).style.backgroundColor = template.bodyBg;
  });

  element.style.fontFamily = `'${template.fontFamily}', sans-serif`;
}

export function printElement(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) return;

  const printWindow = window.open("", "_blank");
  if (!printWindow) return;

  printWindow.document.write(`
    <!DOCTYPE html>
    <html lang="ar" dir="rtl">
    <head>
      <meta charset="UTF-8">
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800;900&family=Cairo:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; background: white; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          [data-no-print] { display: none !important; }
          body > div > div { 
            page-break-after: always; 
            margin: 0 !important;
            box-shadow: none !important;
          }
          body > div > div:last-child { 
            page-break-after: avoid; 
          }
        }
        @page {
          size: A4;
          margin: 0;
        }
      </style>
    </head>
    <body>${element.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 800);
}
