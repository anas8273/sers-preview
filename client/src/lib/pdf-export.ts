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

/**
 * تصدير PDF بنظام صفحات A4 منفصلة
 * يلتقط كل صفحة (div مباشر داخل preview-content) كصورة منفصلة ويضيفها كصفحة PDF
 */
export async function exportToPDF(elementId: string, filename: string = "document.pdf") {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    // إخفاء الأزرار والعناصر التفاعلية أثناء التصدير
    const buttons = element.querySelectorAll('button, [data-no-print]');
    buttons.forEach(btn => (btn as HTMLElement).style.display = 'none');

    // تحويل ألوان oklch إلى RGB قبل html2canvas
    const restoreColors = convertOklchToRgb(element);

    await new Promise(resolve => setTimeout(resolve, 100));

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();

    // البحث عن الصفحات المنفصلة (divs المباشرة داخل preview-content)
    const pages = element.querySelectorAll(':scope > div');
    
    if (pages.length > 0) {
      // نظام الصفحات المنفصلة - كل div هو صفحة A4
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        
        if (i > 0) pdf.addPage();

        const canvas = await html2canvas(page, {
          scale: 2,
          useCORS: true,
          allowTaint: true,
          backgroundColor: "#ffffff",
          logging: false,
          windowWidth: page.scrollWidth,
          windowHeight: page.scrollHeight,
        });

        const imgData = canvas.toDataURL("image/jpeg", 0.95);
        const imgWidth = canvas.width;
        const imgHeight = canvas.height;
        const ratio = pdfWidth / imgWidth;
        const scaledHeight = imgHeight * ratio;

        if (scaledHeight <= pdfHeight) {
          // الصفحة تناسب صفحة PDF واحدة
          pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, scaledHeight);
        } else {
          // الصفحة أطول من A4 - تقسيمها على عدة صفحات PDF
          const pageCanvasHeight = pdfHeight / ratio;
          let remainingHeight = imgHeight;
          let sourceY = 0;
          let subPage = 0;

          while (remainingHeight > 0) {
            if (subPage > 0) pdf.addPage();

            const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
            
            const pageCanvas = document.createElement('canvas');
            pageCanvas.width = imgWidth;
            pageCanvas.height = sliceHeight;
            const ctx = pageCanvas.getContext('2d');
            if (ctx) {
              ctx.drawImage(canvas, 0, sourceY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
              const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
              pdf.addImage(pageImgData, "JPEG", 0, 0, pdfWidth, sliceHeight * ratio);
            }

            sourceY += sliceHeight;
            remainingHeight -= sliceHeight;
            subPage++;
          }
        }
      }
    } else {
      // Fallback: التقاط العنصر بالكامل كصورة واحدة
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        windowWidth: element.scrollWidth,
        windowHeight: element.scrollHeight,
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.95);
      const margin = 5;
      const usableWidth = pdfWidth - margin * 2;
      const usableHeight = pdfHeight - margin * 2;
      const imgWidth = canvas.width;
      const imgHeight = canvas.height;
      const ratio = usableWidth / imgWidth;
      const scaledHeight = imgHeight * ratio;

      if (scaledHeight <= usableHeight) {
        pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, scaledHeight);
      } else {
        const pageCanvasHeight = usableHeight / ratio;
        let remainingHeight = imgHeight;
        let sourceY = 0;
        let pageNum = 0;

        while (remainingHeight > 0) {
          if (pageNum > 0) pdf.addPage();

          const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
          
          const pageCanvas = document.createElement('canvas');
          pageCanvas.width = imgWidth;
          pageCanvas.height = sliceHeight;
          const ctx = pageCanvas.getContext('2d');
          if (ctx) {
            ctx.drawImage(canvas, 0, sourceY, imgWidth, sliceHeight, 0, 0, imgWidth, sliceHeight);
            const pageImgData = pageCanvas.toDataURL("image/jpeg", 0.95);
            pdf.addImage(pageImgData, "JPEG", margin, margin, usableWidth, sliceHeight * ratio);
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
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Cairo:wght@300;400;500;600;700&family=Almarai:wght@300;400;700;800&family=IBM+Plex+Sans+Arabic:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; background: #f5f5f5; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; background: white; }
          [data-no-print] { display: none !important; }
        }
        /* تنسيق صفحات A4 للطباعة */
        @media print {
          body > div > div { 
            page-break-after: always; 
            margin: 0 !important;
            box-shadow: none !important;
          }
          body > div > div:last-child { 
            page-break-after: avoid; 
          }
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
  }, 500);
}
