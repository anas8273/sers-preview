/**
 * نظام تصدير PDF - Client-Side باستخدام html2canvas-pro + jsPDF
 * يعمل بالكامل في المتصفح بدون حاجة لسيرفر أو Puppeteer
 * 
 * html2canvas-pro يدعم oklch colors وألوان CSS الحديثة
 * jsPDF ينشئ ملف PDF من الصور المولدة
 * 
 * الآلية:
 * 1. يأخذ العنصر HTML المحدد
 * 2. يحوله إلى canvas عبر html2canvas-pro (يدعم العربية)
 * 3. يحول كل صفحة (div) إلى صورة PNG عالية الجودة
 * 4. يجمع الصور في ملف PDF عبر jsPDF
 */

import html2canvas from "html2canvas-pro";
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
  headerBg: "#0097A7",
  headerText: "#FFFFFF",
  accent: "#0097A7",
  borderColor: "#B2EBF2",
  bodyBg: "#FFFFFF",
  fontFamily: "Cairo",
};

// A4 dimensions in mm
const A4_WIDTH_MM = 210;
const A4_HEIGHT_MM = 297;

/**
 * تحويل عنصر HTML إلى canvas عالي الجودة
 */
async function elementToCanvas(element: HTMLElement, scale: number = 2): Promise<HTMLCanvasElement> {
  // إخفاء الأزرار مؤقتاً
  const buttons = element.querySelectorAll("button, [data-no-print]");
  const buttonDisplays: string[] = [];
  buttons.forEach((btn, i) => {
    buttonDisplays[i] = (btn as HTMLElement).style.display;
    (btn as HTMLElement).style.display = "none";
  });

  try {
    const canvas = await html2canvas(element, {
      scale,
      useCORS: true,
      allowTaint: true,
      logging: false,
      backgroundColor: "#ffffff",
      imageTimeout: 15000,
      removeContainer: true,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });
    return canvas;
  } finally {
    // استعادة الأزرار
    buttons.forEach((btn, i) => {
      (btn as HTMLElement).style.display = buttonDisplays[i];
    });
  }
}

/**
 * تصدير عنصر HTML إلى PDF
 * يحول كل صفحة (div مباشر) إلى صورة ويجمعها في PDF
 */
export async function exportToPDF(
  elementId: string,
  filename: string = "document.pdf",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found: " + elementId);

  try {
    // البحث عن الصفحات (divs المباشرة)
    const pages = Array.from(element.children).filter(child => {
      const el = child as HTMLElement;
      // تخطي العناصر المخفية و print:hidden
      if (el.style.display === 'none') return false;
      if (el.classList.contains('print:hidden') || el.className?.includes?.('print:hidden')) return false;
      if (el.tagName !== 'DIV') return false;
      return true;
    }) as HTMLElement[];

    if (pages.length === 0) {
      // إذا لم تكن هناك صفحات فرعية، استخدم العنصر كله كصفحة واحدة
      return await exportSingleElementToPDF(element, filename, onProgress);
    }

    const total = pages.length + 1; // pages + final save
    onProgress?.(0, total);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    for (let i = 0; i < pages.length; i++) {
      onProgress?.(i + 1, total);

      const page = pages[i];
      
      // تحويل الصفحة إلى canvas
      const canvas = await elementToCanvas(page, 2);
      const imgData = canvas.toDataURL("image/jpeg", 0.92);

      if (i > 0) {
        pdf.addPage("a4", "portrait");
      }

      // إضافة الصورة بحجم A4
      pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
    }

    onProgress?.(total, total);

    // تحميل الملف
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("PDF export error:", err);
    throw err;
  }
}

/**
 * تصدير عنصر واحد كصفحة PDF واحدة
 */
async function exportSingleElementToPDF(
  element: HTMLElement,
  filename: string,
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  onProgress?.(1, 3);

  const canvas = await elementToCanvas(element, 2);
  
  onProgress?.(2, 3);

  const imgData = canvas.toDataURL("image/jpeg", 0.92);
  const pdf = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
    compress: true,
  });

  pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
  pdf.save(filename);

  onProgress?.(3, 3);
  return true;
}

/**
 * استخراج HTML للتصدير (يستخدم من Word export)
 */
export async function extractHtmlForExport(element: HTMLElement): Promise<string> {
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

  return clone.innerHTML;
}

/**
 * تصدير PDF متعدد التقارير - يجمع عدة عناصر HTML في ملف PDF واحد
 * يتيح للمستخدم تصدير عدة تقارير (شواهد مختلفة) دفعة واحدة
 */
export async function exportMultipleReportsToPDF(
  elementIds: string[],
  filename: string = "تقارير_متعددة.pdf",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  if (elementIds.length === 0) throw new Error("No elements to export");

  try {
    // حساب العدد الإجمالي للصفحات
    let totalPages = 0;
    const elementPages: { element: HTMLElement; pages: HTMLElement[] }[] = [];

    for (const elId of elementIds) {
      const element = document.getElementById(elId);
      if (!element) continue;

      const pages = Array.from(element.children).filter(child => {
        const el = child as HTMLElement;
        if (el.style.display === 'none') return false;
        if (el.classList.contains('print:hidden') || el.className?.includes?.('print:hidden')) return false;
        if (el.tagName !== 'DIV') return false;
        return true;
      }) as HTMLElement[];

      if (pages.length > 0) {
        elementPages.push({ element, pages });
        totalPages += pages.length;
      } else {
        // العنصر نفسه كصفحة واحدة
        elementPages.push({ element, pages: [element] });
        totalPages += 1;
      }
    }

    if (totalPages === 0) throw new Error("No content to export");

    const total = totalPages + 1; // pages + final save
    let currentPage = 0;
    onProgress?.(0, total);

    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
      compress: true,
    });

    let isFirstPage = true;

    for (const { pages } of elementPages) {
      for (const page of pages) {
        currentPage++;
        onProgress?.(currentPage, total);

        const canvas = await elementToCanvas(page, 2);
        const imgData = canvas.toDataURL("image/jpeg", 0.92);

        if (!isFirstPage) {
          pdf.addPage("a4", "portrait");
        }
        isFirstPage = false;

        pdf.addImage(imgData, "JPEG", 0, 0, A4_WIDTH_MM, A4_HEIGHT_MM);
      }
    }

    onProgress?.(total, total);
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("Multi-PDF export error:", err);
    throw err;
  }
}

/**
 * تطبيق ثيم القالب على عنصر HTML
 */
export function applyTemplateToElement(element: HTMLElement, template: PdfTemplate) {
  const headers = element.querySelectorAll("[data-pdf-header]");
  headers.forEach((h) => {
    (h as HTMLElement).style.backgroundColor = template.headerBg;
    (h as HTMLElement).style.color = template.headerText;
  });

  const accents = element.querySelectorAll("[data-pdf-accent]");
  accents.forEach((a) => {
    (a as HTMLElement).style.color = template.accent;
  });

  const borders = element.querySelectorAll("[data-pdf-border]");
  borders.forEach((b) => {
    (b as HTMLElement).style.borderColor = template.borderColor;
  });

  element.style.fontFamily = `'${template.fontFamily}', sans-serif`;
}

/**
 * طباعة عنصر HTML في نافذة جديدة
 * محسّن لجودة طباعة عالية
 */
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
      <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; background: white; }
        @media print {
          body {
            -webkit-print-color-adjust: exact;
            print-color-adjust: exact;
            color-adjust: exact;
          }
          [data-no-print] { display: none !important; }
          button { display: none !important; }
          body > div > div {
            page-break-after: always;
            margin: 0 !important;
            box-shadow: none !important;
          }
          body > div > div:last-child { page-break-after: avoid; }
        }
        @page { size: A4; margin: 0; }
      </style>
    </head>
    <body>${element.innerHTML}</body>
    </html>
  `);
  printWindow.document.close();
  setTimeout(() => {
    printWindow.print();
    printWindow.close();
  }, 1500);
}
