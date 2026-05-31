import puppeteer from "puppeteer";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

async function getBrowser() {
  if (browserInstance && browserInstance.connected) {
    return browserInstance;
  }
  browserInstance = await puppeteer.launch({
    headless: true as any,
    timeout: 60000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      "--enable-font-antialiasing",
      "--force-color-profile=srgb",
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
    preferCSSPageSize?: boolean;
    appCss?: string;
    dir?: string;
    lang?: string;
    wrapperStyle?: string;
  }
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // تعيين viewport بحجم A4 بدقة عالية (3x للجودة القصوى)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });

    // تحميل HTML مع الخطوط العربية + CSS التطبيق الكامل
    const fullHtml = wrapWithFonts(
      htmlContent,
      options?.appCss || '',
      options?.dir || 'rtl',
      options?.lang || 'ar',
      options?.wrapperStyle || ''
    );
    await page.setContent(fullHtml, {
      waitUntil: ["load", "domcontentloaded"],
      timeout: 90000,
    });

    // انتظار تحميل الخطوط
    await page.evaluate(() => document.fonts.ready);

    // انتظار إضافي لضمان تحميل الخطوط العربية بالكامل
    await new Promise(resolve => setTimeout(resolve, 2500));

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

    // SmartCV: Place exact footer clone at the bottom of EACH page
    await page.evaluate(() => {
      const footer = document.querySelector('.cv-footer') as HTMLElement;
      if (!footer) return;

      const PX_PER_MM = 96 / 25.4;
      const PAGE_FULL = 297 * PX_PER_MM;   // A4 height in CSS px
      const TOP_MARGIN = 15 * PX_PER_MM;   // 15mm top margin for page 2+
      const PAGE1_CONTENT = PAGE_FULL;      // Page 1: no top margin
      const PAGE2_CONTENT = PAGE_FULL - TOP_MARGIN; // Page 2+: minus top margin
      const FOOTER_HEIGHT = footer.getBoundingClientRect().height;

      // Measure pure content height (without footer)
      const origDisplay = footer.style.display;
      footer.style.display = 'none';
      const contentHeight = document.body.scrollHeight;
      footer.style.display = origDisplay;

      // Calculate page count
      let pageCount = 1;
      const remaining = contentHeight - PAGE1_CONTENT;
      if (remaining > 0) {
        pageCount += Math.ceil(remaining / PAGE2_CONTENT);
      }

      // Ensure body is positioned for absolute children
      document.body.style.position = 'relative';

      // Place a footer clone at the bottom of each page
      for (let i = 0; i < pageCount; i++) {
        // Page bottom position in body coordinates
        const pageBottom = i === 0
          ? PAGE1_CONTENT
          : PAGE1_CONTENT + i * PAGE2_CONTENT;

        const clone = footer.cloneNode(true) as HTMLElement;
        clone.style.position = 'absolute';
        clone.style.bottom = 'auto';
        clone.style.top = (pageBottom - FOOTER_HEIGHT) + 'px';
        clone.style.left = '0';
        clone.style.right = '0';
        clone.style.width = '210mm';
        clone.style.zIndex = '9999';
        clone.style.margin = '0';
        clone.style.setProperty('-webkit-print-color-adjust', 'exact');
        if (!clone.style.backgroundColor) clone.style.backgroundColor = 'white';
        document.body.appendChild(clone);
      }

      // Ensure body is tall enough for all pages
      const totalHeight = PAGE1_CONTENT + (pageCount - 1) * PAGE2_CONTENT;
      document.body.style.minHeight = totalHeight + 'px';

      // Remove original footer from content flow
      footer.remove();
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
 * تغليف HTML (innerHTML) بالخطوط والأنماط الأساسية
 * يلف المحتوى في div مع أنماط العرض الأصلية (بدون transforms المعاينة)
 */
function wrapWithFonts(html: string, appCss: string = '', dir: string = 'rtl', lang: string = 'ar', wrapperStyle: string = ''): string {
  const fontFamily = lang === 'ar'
    ? "'Cairo', 'Tajawal', 'Noto Sans Arabic', 'Arial', sans-serif"
    : "'Inter', 'Cairo', 'Arial', sans-serif";

  // Detect SmartCV content to apply different @page margins
  const isCvContent = html.includes('data-cv-content');

  return `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&family=Inter:wght@100..900&family=Noto+Sans+Arabic:wght@100..900&display=swap" rel="stylesheet">
  
  ${appCss ? `<style>${appCss}</style>` : ''}
  
  <style>
    ${isCvContent ? `
    * {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    @page {
      size: A4;
      margin: 15mm 0 0 0;
    }
    @page :first {
      margin-top: 0;
    }
    ` : `
    @page {
      size: A4;
      margin: 0;
    }
    `}

    /* ═══ Smart Reset ═══ */
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      direction: ${dir};
      text-align: ${dir === 'rtl' ? 'right' : 'left'};
      font-family: ${fontFamily};
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: 'liga' 1, 'calt' 1;
    }
    body {
      width: 210mm;
    }
    *, *::before, *::after {
      box-sizing: border-box;
    }

    /* ═══ A4 Page Wrappers — ALL page types ═══ */
    .pdf-page, .evidence-page-wrapper {
      width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      page-break-after: always;
      overflow: hidden !important;
      position: relative;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    .pdf-page:last-child, .evidence-page-wrapper:last-child {
      page-break-after: auto;
    }

    /* ═══ Cover & Section Cover pages — strip preview spacing (PE only) ═══ */
    /* All PE page wrappers use: bg-white shadow-lg mx-auto mb-6 + minHeight: 297mm */
    body > div > div[style*="min-height"]:not([data-cv-content]) {
      margin-bottom: 0 !important;
      box-shadow: none !important;
      page-break-after: always;
      page-break-inside: avoid;
      break-inside: avoid;
      max-height: 297mm;
      overflow: hidden;
    }
    body > div > div[style*="min-height"]:not([data-cv-content]):last-child {
      page-break-after: auto;
    }

    /* ═══ SmartCV: natural multi-page flow ═══ */
    [data-cv-content] {
      max-height: none !important;
      overflow: visible !important;
      height: auto !important;
      min-height: 297mm;
    }
    [data-cv-content] > div {
      break-inside: auto;
      page-break-inside: auto;
    }
    [data-cv-content] h2,
    [data-cv-content] h3 {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
      break-after: avoid !important;
      page-break-after: avoid !important;
    }
    /* Anti-slice: only prevent breaking inside SMALL items (entries, list items) */
    /* DO NOT add break-inside:avoid to section containers or flex wrappers */
    [data-cv-content] li,
    [data-cv-content] [style*="margin-bottom: 8px"],
    [data-cv-content] [style*="margin-bottom: 6px"] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }

    /* ═══ SmartCV: Footer repeats on every page ═══ */
    /* .cv-footer is cloned at each page boundary via JS — no CSS needed */
    /* Drop entire items to next page if they exceed the space */
    [data-cv-content] p,
    [data-cv-content] li {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .cv-main-header {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }

    /* ═══ PE Footer ═══ */
    [data-pe-footer] {
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }

    /* ═══ General page flow ═══ */
    h2 {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    p, ul, li, section, span {
      overflow-wrap: break-word;
      word-break: break-word;
    }

    /* ═══ Hide interactive ═══ */
    button, [data-no-print] { display: none !important; }

    /* ═══ Print colors — force exact rendering ═══ */
    [style*="border"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    [style*="linear-gradient"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    [style*="background"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }

    /* ═══ Cleanup ═══ */
    body > div { box-shadow: none !important; }
    img { max-width: 100%; image-rendering: -webkit-optimize-contrast; }
    svg { shape-rendering: geometricPrecision; }
  </style>
</head>
<body>
<div style="${wrapperStyle || `width: 210mm; min-height: 297mm; font-family: ${fontFamily}; direction: ${dir};`}">
${html}
</div>
</body>
</html>`;
}

/**
 * تحويل HTML إلى Word عبر PDF كوسيط
 * ينشئ PDF أولاً ثم يحول كل صفحة إلى صورة PNG عبر pdftoppm ويضعها في Word
 * هذا يضمن تطابق 100% مع المعاينة
 */
export async function renderHtmlToDocxPuppeteer(htmlContent: string): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'docx-export-'));

  try {
    // الخطوة 1: إنشاء PDF من HTML
    const pdfBuffer = await renderHtmlToPdf(htmlContent, {
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      scale: 1,
    });

    // حفظ PDF مؤقتاً
    const pdfPath = path.join(tmpDir, 'export.pdf');
    fs.writeFileSync(pdfPath, pdfBuffer);

    // الخطوة 2: تحويل PDF إلى صور PNG عبر pdftoppm (جودة عالية 300 DPI)
    const outputPrefix = path.join(tmpDir, 'page');
    execSync(`pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`, { timeout: 120000 });

    // قراءة جميع الصور المنتجة
    const pngFiles = fs.readdirSync(tmpDir)
      .filter(f => f.startsWith('page-') && f.endsWith('.png'))
      .sort();

    if (pngFiles.length === 0) {
      throw new Error('pdftoppm لم ينتج أي صور');
    }

    const pageImages: Buffer[] = pngFiles.map(f => fs.readFileSync(path.join(tmpDir, f)));

    // الخطوة 3: بناء مستند Word مع صورة لكل صفحة
    const {
      Document: Doc,
      Packer: Pack,
      Paragraph: Para,
      ImageRun: ImgRun,
      AlignmentType: Align,
      PageOrientation: Orient,
    } = await import("docx");

    const sections = pageImages.map((imgBuf) => ({
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: Orient.PORTRAIT },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: [
        new Para({
          alignment: Align.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new ImgRun({
              data: imgBuf,
              transformation: { width: 595, height: 842 },
              type: "png",
            }),
          ],
        }),
      ],
    }));

    const doc = new Doc({ sections });
    const buffer = await Pack.toBuffer(doc);
    return Buffer.from(buffer);
  } catch (err) {
    console.error('[renderHtmlToDocxPuppeteer] Error:', err);
    throw err;
  } finally {
    // تنظيف الملفات المؤقتة
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch (_) { }
  }
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
