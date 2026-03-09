/**
 * محرك تصدير Word (.docx) - SERS
 * يستخدم Puppeteer لالتقاط صورة عالية الجودة من HTML
 * ثم يدمجها في مستند Word
 * 
 * هذا النهج يضمن تطابق التنسيق بين PDF و Word
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
  Header,
  Footer,
  TextRun,
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
  });
  return browserInstance;
}

/**
 * تحويل HTML إلى DOCX
 * يلتقط كل صفحة كصورة عالية الجودة ويدمجها في مستند Word
 */
export async function renderHtmlToDocx(htmlContent: string): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    // تعيين viewport بحجم A4
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

    // الحصول على عدد الصفحات (كل div مباشر هو صفحة)
    const pageCount = await page.evaluate(() => {
      const pages = document.querySelectorAll("body > div > div, body > div.pdf-page");
      return pages.length || 1;
    });

    // التقاط كل صفحة كصورة
    const pageImages: Buffer[] = [];
    
    for (let i = 0; i < pageCount; i++) {
      // إخفاء جميع الصفحات ما عدا الحالية
      await page.evaluate((pageIndex) => {
        const pages = document.querySelectorAll("body > div > div, body > div.pdf-page");
        pages.forEach((p, idx) => {
          (p as HTMLElement).style.display = idx === pageIndex ? 'block' : 'none';
        });
      }, i);

      // انتظار قصير للتحديث
      await new Promise(resolve => setTimeout(resolve, 300));

      // التقاط الصورة
      const screenshot = await page.screenshot({
        type: 'png',
        fullPage: true,
        omitBackground: false,
      });

      pageImages.push(Buffer.from(screenshot));
    }

    // إنشاء مستند Word
    const sections = pageImages.map((imageBuffer, index) => ({
      properties: {
        type: index === 0 ? undefined : SectionType.NEXT_PAGE,
        page: {
          size: {
            width: 11906, // A4 width in twips (210mm)
            height: 16838, // A4 height in twips (297mm)
            orientation: PageOrientation.PORTRAIT,
          },
          margin: {
            top: 0,
            right: 0,
            bottom: 0,
            left: 0,
          },
        },
      },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 0, after: 0 },
          children: [
            new ImageRun({
              data: imageBuffer,
              transformation: {
                width: 595, // A4 width in points
                height: 842, // A4 height in points
              },
              type: "png",
            }),
          ],
        }),
      ],
    }));

    const doc = new Document({
      sections,
    });

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
