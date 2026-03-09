import puppeteer from "puppeteer";

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      "--enable-font-antialiasing",
    ],
  });
  return browserInstance;
}

/**
 * تحويل HTML إلى PDF باستخدام Puppeteer
 * يدعم اللغة العربية بشكل كامل لأن Chromium يعرض النص بشكل صحيح
 * جودة عالية جداً مع خطوط واضحة وإطارات حادة
 */
export async function renderHtmlToPdf(
  htmlContent: string,
  options?: {
    format?: "A4" | "Letter";
    landscape?: boolean;
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
    scale?: number;
  }
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // تعيين viewport بحجم A4 بدقة عالية (2x)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    // تحميل HTML مع الخطوط العربية
    const fullHtml = wrapWithFonts(htmlContent);
    await page.setContent(fullHtml, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 45000,
    });

    // انتظار تحميل الخطوط
    await page.evaluate(() => document.fonts.ready);
    
    // انتظار إضافي لضمان تحميل الخطوط العربية
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // انتظار تحميل الصور
    await page.evaluate(() => {
      return new Promise<void>((resolve) => {
        const images = document.querySelectorAll("img");
        if (images.length === 0) return resolve();
        let loaded = 0;
        const total = images.length;
        images.forEach((img) => {
          if (img.complete) {
            loaded++;
            if (loaded >= total) resolve();
          } else {
            img.onload = () => { loaded++; if (loaded >= total) resolve(); };
            img.onerror = () => { loaded++; if (loaded >= total) resolve(); };
          }
        });
        // Timeout fallback
        setTimeout(resolve, 8000);
      });
    });

    // إنشاء PDF بجودة عالية
    const pdfBuffer = await page.pdf({
      format: options?.format || "A4",
      landscape: options?.landscape || false,
      printBackground: options?.printBackground !== false,
      margin: options?.margin || { top: "0", right: "0", bottom: "0", left: "0" },
      scale: options?.scale || 1,
      preferCSSPageSize: true,
    });

    return Buffer.from(pdfBuffer);
  } finally {
    await page.close();
  }
}

/**
 * تغليف HTML بالخطوط العربية والأنماط الأساسية
 * يستخدم خطوط Tajawal و Cairo مع أنماط طباعة عالية الجودة
 */
function wrapWithFonts(html: string): string {
  return `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4;
      margin: 0;
    }
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    html, body {
      font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;
      direction: rtl;
      text-align: right;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
      background: white;
      font-size: 14px;
      line-height: 1.6;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
    }
    body {
      width: 210mm;
      min-height: 297mm;
    }
    /* كل صفحة PDF */
    .pdf-page {
      width: 210mm;
      min-height: 297mm;
      height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
      background: white;
    }
    .pdf-page:last-child {
      page-break-after: auto;
    }
    /* إخفاء الأزرار */
    button, [data-no-print] {
      display: none !important;
    }
    /* ضمان عرض الصور بجودة عالية */
    img {
      max-width: 100%;
      display: inline-block;
      image-rendering: -webkit-optimize-contrast;
    }
    /* ضمان عرض الجداول */
    table {
      border-collapse: collapse;
    }
    /* تحسين جودة الحدود والإطارات */
    td, th {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    /* تحسين الخطوط في الطباعة */
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Tajawal', 'Cairo', sans-serif;
      font-weight: 700;
    }
    /* تحسين النقاط والخطوط */
    hr, .separator {
      border: none;
      height: 2px;
      background: currentColor;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * إغلاق المتصفح عند إيقاف السيرفر
 */
export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
