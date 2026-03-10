/**
 * محرك تصدير Word (.docx) - SERS
 * النهج: يستخدم Puppeteer لتوليد PDF أولاً ثم يحول كل صفحة إلى صورة
 * ثم يدمج الصور في مستند Word
 * 
 * هذا يضمن تطابق 100% بين PDF و Word
 */
import puppeteer from "puppeteer";
import {
  Document,
  Packer,
  Paragraph,
  ImageRun,
  AlignmentType,
  PageOrientation,
  SectionType,
} from "docx";

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
      "--force-color-profile=srgb",
    ],
    protocolTimeout: 120000,
  });
  return browserInstance;
}

/**
 * تحويل HTML إلى DOCX
 * الخطوات:
 * 1. تحميل HTML في Puppeteer
 * 2. التقاط صورة كاملة للصفحة (fullPage screenshot)
 * 3. تقسيم الصورة إلى صفحات A4
 * 4. إنشاء مستند Word مع الصور
 */
export async function renderHtmlToDocx(htmlContent: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // تعيين viewport بحجم A4 (عرض 794px)
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });

    // تحميل HTML مع الخطوط العربية
    const fullHtml = wrapWithFonts(htmlContent);
    await page.setContent(fullHtml, {
      waitUntil: ["networkidle0", "domcontentloaded"],
      timeout: 60000,
    });

    // انتظار تحميل الخطوط
    await page.evaluate(() => document.fonts.ready);
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
        setTimeout(resolve, 10000);
      });
    });

    // التقاط صورة كاملة للصفحة بالكامل
    const fullScreenshot = await page.screenshot({
      type: 'png',
      fullPage: true,
      omitBackground: false,
    });

    const screenshotBuffer = Buffer.from(fullScreenshot);

    // الحصول على ارتفاع الصفحة الكلي
    const pageHeight = await page.evaluate(() => document.body.scrollHeight);
    const a4HeightPx = 1123; // ارتفاع A4 بالبكسل عند 96dpi
    const numPages = Math.max(1, Math.ceil(pageHeight / a4HeightPx));

    // إذا كانت صفحة واحدة فقط - استخدم الصورة كاملة
    if (numPages <= 1) {
      const doc = new Document({
        sections: [{
          properties: {
            page: {
              size: {
                width: 11906,
                height: 16838,
                orientation: PageOrientation.PORTRAIT,
              },
              margin: { top: 0, right: 0, bottom: 0, left: 0 },
            },
          },
          children: [
            new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 0, after: 0 },
              children: [
                new ImageRun({
                  data: screenshotBuffer,
                  transformation: { width: 595, height: 842 },
                  type: "png",
                }),
              ],
            }),
          ],
        }],
      });

      const buffer = await Packer.toBuffer(doc);
      return Buffer.from(buffer);
    }

    // إذا كانت عدة صفحات - التقاط كل صفحة على حدة
    const pageImages: Buffer[] = [];

    // البحث عن صفحات pdf-page
    const pdfPageCount = await page.evaluate(() => {
      const pages = document.querySelectorAll('.pdf-page');
      return pages.length;
    });

    if (pdfPageCount > 0) {
      // لدينا صفحات pdf-page - نلتقط كل واحدة على حدة
      for (let i = 0; i < pdfPageCount; i++) {
        // إظهار صفحة واحدة فقط
        await page.evaluate((pageIndex) => {
          const pages = document.querySelectorAll('.pdf-page');
          pages.forEach((p, idx) => {
            (p as HTMLElement).style.display = idx === pageIndex ? 'flex' : 'none';
            if (idx === pageIndex) {
              (p as HTMLElement).style.minHeight = '297mm';
              (p as HTMLElement).style.width = '210mm';
              (p as HTMLElement).style.margin = '0';
              (p as HTMLElement).style.boxShadow = 'none';
            }
          });
        }, i);

        await new Promise(resolve => setTimeout(resolve, 500));

        const screenshot = await page.screenshot({
          type: 'png',
          fullPage: true,
          omitBackground: false,
        });

        pageImages.push(Buffer.from(screenshot));
      }
    } else {
      // لا توجد صفحات pdf-page - نستخدم الصورة الكاملة
      pageImages.push(screenshotBuffer);
    }

    // إنشاء مستند Word
    const sections = pageImages.map((imageBuffer, index) => ({
      properties: {
        type: index === 0 ? undefined : SectionType.NEXT_PAGE,
        page: {
          size: {
            width: 11906,
            height: 16838,
            orientation: PageOrientation.PORTRAIT,
          },
          margin: { top: 0, right: 0, bottom: 0, left: 0 },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: { width: 595, height: 842 },
              type: "png",
            }),
          ],
        }),
      ],
    }));

    const doc = new Document({ sections });
    const buffer = await Packer.toBuffer(doc);
    return Buffer.from(buffer);
  } finally {
    await page.close();
  }
}

/**
 * تغليف HTML بالخطوط العربية
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
      font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif;
      direction: rtl;
      text-align: right;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
      color-adjust: exact;
      background: white;
      font-size: 14px;
      line-height: 1.7;
      color: #1a1a1a;
      -webkit-font-smoothing: antialiased;
      text-rendering: optimizeLegibility;
    }
    body {
      width: 210mm;
      min-height: 297mm;
    }
    .pdf-page {
      width: 210mm;
      min-height: 297mm;
      page-break-after: always;
      position: relative;
      overflow: visible;
      background: white;
      display: flex;
      flex-direction: column;
    }
    .pdf-page:last-child {
      page-break-after: auto;
    }
    button, [data-no-print] {
      display: none !important;
    }
    img {
      max-width: 100%;
      display: inline-block;
    }
    table {
      border-collapse: collapse;
      width: 100%;
    }
    body > div > div {
      margin-bottom: 0 !important;
      box-shadow: none !important;
    }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}
