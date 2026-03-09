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
    // تعيين viewport بحجم A4 بدقة عالية (3x للجودة القصوى)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });

    // تحميل HTML مع الخطوط العربية
    const fullHtml = wrapWithFonts(htmlContent);
    await page.setContent(fullHtml, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 60000,
    });

    // انتظار تحميل الخطوط
    await page.evaluate(() => document.fonts.ready);
    
    // انتظار إضافي لضمان تحميل الخطوط العربية بالكامل
    await new Promise(resolve => setTimeout(resolve, 2000));
    
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
        setTimeout(resolve, 10000);
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
  const parts = [
    '<!DOCTYPE html>',
    '<html lang="ar" dir="rtl">',
    '<head>',
    '  <meta charset="UTF-8">',
    '  <meta name="viewport" content="width=device-width, initial-scale=1.0">',
    '  <link rel="preconnect" href="https://fonts.googleapis.com">',
    '  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>',
    '  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&display=swap" rel="stylesheet">',
    '  <style>',
    '    @page { size: A4; margin: 0; }',
    '    * { margin: 0; padding: 0; box-sizing: border-box; }',
    '    html, body {',
    "      font-family: 'Tajawal', 'Cairo', 'Arial', sans-serif;",
    '      direction: rtl; text-align: right;',
    '      -webkit-print-color-adjust: exact; print-color-adjust: exact; color-adjust: exact;',
    '      background: white; font-size: 14px; line-height: 1.7; color: #1a1a1a;',
    '      -webkit-font-smoothing: antialiased; -moz-osx-font-smoothing: grayscale;',
    '      text-rendering: optimizeLegibility;',
    "      font-feature-settings: 'liga' 1, 'calt' 1;",
    '    }',
    '    body { width: 210mm; min-height: 297mm; }',
    '    .pdf-page {',
    '      width: 210mm; min-height: 297mm; height: 297mm;',
    '      page-break-after: always; page-break-inside: avoid;',
    '      position: relative; overflow: hidden; background: white;',
    '      display: flex; flex-direction: column;',
    '    }',
    '    .pdf-page:last-child { page-break-after: auto; }',
    '    button, [data-no-print] { display: none !important; }',
    '    img { max-width: 100%; display: inline-block; image-rendering: -webkit-optimize-contrast; image-rendering: crisp-edges; }',
    '    table { border-collapse: collapse; width: 100%; }',
    '    td, th { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    "    h1, h2, h3, h4, h5, h6 { font-family: 'Tajawal', 'Cairo', sans-serif; font-weight: 700; }",
    '    hr, .separator { border: none; height: 2px; background: currentColor; }',
    '    [style*="border"] { -webkit-print-color-adjust: exact; print-color-adjust: exact; }',
    '    .field-row, .evidence-item { page-break-inside: avoid; }',
    '  </style>',
    '</head>',
    '<body>',
    html,
    '</body>',
    '</html>',
  ];
  return parts.join('\n');
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
