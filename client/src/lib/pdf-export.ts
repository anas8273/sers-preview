import html2canvas from "html2canvas";
import { jsPDF } from "jspdf";

export async function exportToPDF(elementId: string, filename: string = "document.pdf") {
  const element = document.getElementById(elementId);
  if (!element) return;

  try {
    // إخفاء الأزرار والعناصر التفاعلية أثناء التصدير
    const buttons = element.querySelectorAll('button, [data-no-print]');
    buttons.forEach(btn => (btn as HTMLElement).style.display = 'none');

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: "#ffffff",
      logging: false,
      windowWidth: element.scrollWidth,
      windowHeight: element.scrollHeight,
    });

    // إعادة إظهار الأزرار
    buttons.forEach(btn => (btn as HTMLElement).style.display = '');

    const imgData = canvas.toDataURL("image/jpeg", 0.95);
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const margin = 5;
    const usableWidth = pdfWidth - margin * 2;
    const usableHeight = pdfHeight - margin * 2;

    const imgWidth = canvas.width;
    const imgHeight = canvas.height;
    const ratio = usableWidth / imgWidth;
    const scaledHeight = imgHeight * ratio;

    // تقسيم المحتوى على صفحات متعددة
    if (scaledHeight <= usableHeight) {
      // صفحة واحدة
      pdf.addImage(imgData, "JPEG", margin, margin, usableWidth, scaledHeight);
    } else {
      // صفحات متعددة
      const pageCanvasHeight = usableHeight / ratio;
      let remainingHeight = imgHeight;
      let sourceY = 0;
      let pageNum = 0;

      while (remainingHeight > 0) {
        if (pageNum > 0) pdf.addPage();

        const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);
        
        // إنشاء canvas مقطع لكل صفحة
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

    pdf.save(filename);
  } catch (err) {
    console.error("PDF export error:", err);
  }
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
      <link href="https://fonts.googleapis.com/css2?family=Tajawal:wght@400;500;700;800&family=Cairo:wght@300;400;500;600;700&display=swap" rel="stylesheet">
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .page-break { page-break-before: always; }
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
