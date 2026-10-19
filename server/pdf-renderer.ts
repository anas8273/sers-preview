import puppeteer from "puppeteer";
import { execSync } from "child_process";
import * as fs from "fs";
import * as path from "path";
import * as os from "os";

let browserInstance: Awaited<ReturnType<typeof puppeteer.launch>> | null = null;

export const ALLOWED_RENDER_HOSTS = new Set(["fonts.googleapis.com", "fonts.gstatic.com"]);

async function getBrowser() {
  if (browserInstance && browserInstance.connected) return browserInstance;
  browserInstance = await puppeteer.launch({
    headless: true as any,
    timeout: 60_000,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--disable-background-networking",
      "--disable-component-update",
      "--disable-sync",
      "--no-first-run",
      "--font-render-hinting=none",
      "--disable-lcd-text",
      "--enable-font-antialiasing",
      "--force-color-profile=srgb",
    ],
  });
  return browserInstance;
}

async function configureSafePage(page: Awaited<ReturnType<Awaited<ReturnType<typeof getBrowser>>["newPage"]>>) {
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", request => {
    const requestUrl = request.url();
    if (requestUrl === "about:blank" || requestUrl.startsWith("data:") || requestUrl.startsWith("blob:")) {
      void request.continue();
      return;
    }

    try {
      const url = new URL(requestUrl);
      const allowedType = request.resourceType() === "stylesheet" || request.resourceType() === "font";
      if (url.protocol === "https:" && ALLOWED_RENDER_HOSTS.has(url.hostname) && allowedType) {
        void request.continue();
        return;
      }
    } catch {
      // Invalid or relative requests are blocked below.
    }
    void request.abort("blockedbyclient");
  });
}

/**
 * تحويل HTML إلى PDF باستخدام Chromium مع تعطيل JavaScript وحظر الشبكة العشوائية.
 * الصور المخصصة يجب أن تكون data/blob URLs أو تمر عبر مرحلة تجهيز موثوقة قبل الاستدعاء.
 */
export async function renderHtmlToPdf(
  htmlContent: string,
  options?: {
    format?: "A4" | "Letter";
    landscape?: boolean;
    printBackground?: boolean;
    margin?: { top?: string; right?: string; bottom?: string; left?: string };
    scale?: number;
  },
): Promise<Buffer> {
  const browser = await getBrowser();
  const page = await browser.newPage();

  try {
    await configureSafePage(page);
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });

    const fullHtml = wrapWithFonts(htmlContent);
    await page.setContent(fullHtml, {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 30_000,
    });

    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    await page.waitForNetworkIdle({ idleTime: 300, timeout: 5_000 }).catch(() => undefined);

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
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
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
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-feature-settings: 'liga' 1, 'calt' 1;
    }
    body { width: 210mm; min-height: 297mm; }
    .pdf-page {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      position: relative;
      overflow: hidden;
      background: white;
      box-sizing: border-box;
    }
    .pdf-page:last-child { page-break-after: auto; }
    body > div > div {
      width: 210mm;
      height: 297mm;
      max-height: 297mm;
      page-break-after: always;
      page-break-inside: avoid;
      overflow: hidden;
      box-sizing: border-box;
      margin-bottom: 0 !important;
      box-shadow: none !important;
    }
    body > div > div:last-child { page-break-after: auto; }
    [class*="print:hidden"], .print\:hidden, button, [data-no-print] { display: none !important; }
    img {
      max-width: 100%;
      display: inline-block;
      image-rendering: -webkit-optimize-contrast;
      image-rendering: crisp-edges;
    }
    table { border-collapse: collapse; width: 100%; }
    table td, table th { word-break: break-word; }
    td, th, [style*="border"], [style*="linear-gradient"] {
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    h1, h2, h3, h4, h5, h6 {
      font-family: 'Cairo', 'Tajawal', sans-serif;
      font-weight: 700;
    }
    hr, .separator { border: none; height: 2px; background: currentColor; }
    .field-row, .evidence-item { page-break-inside: avoid; }
    svg { shape-rendering: geometricPrecision; }
    img[alt="QR"], img[alt="qr"] { image-rendering: pixelated; }
  </style>
</head>
<body>
${html}
</body>
</html>`;
}

/**
 * تحويل HTML إلى Word عبر PDF كوسيط. المحتوى يمر عبر نفس عزل Chromium المستخدم للـPDF.
 */
export async function renderHtmlToDocxPuppeteer(htmlContent: string): Promise<Buffer> {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "docx-export-"));

  try {
    const pdfBuffer = await renderHtmlToPdf(htmlContent, {
      format: "A4",
      printBackground: true,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
      scale: 1,
    });

    const pdfPath = path.join(tmpDir, "export.pdf");
    fs.writeFileSync(pdfPath, pdfBuffer);
    const outputPrefix = path.join(tmpDir, "page");
    execSync(`pdftoppm -png -r 300 "${pdfPath}" "${outputPrefix}"`, { timeout: 120_000 });

    const pngFiles = fs.readdirSync(tmpDir)
      .filter(file => file.startsWith("page-") && file.endsWith(".png"))
      .sort();
    if (pngFiles.length === 0) throw new Error("pdftoppm لم ينتج أي صور");
    const pageImages = pngFiles.map(file => fs.readFileSync(path.join(tmpDir, file)));

    const {
      Document: Doc,
      Packer: Pack,
      Paragraph: Para,
      ImageRun: ImgRun,
      AlignmentType: Align,
      PageOrientation: Orient,
    } = await import("docx");

    const sections = pageImages.map(image => ({
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
              data: image,
              transformation: { width: 595, height: 842 },
              type: "png",
            }),
          ],
        }),
      ],
    }));

    const doc = new Doc({ sections });
    return Buffer.from(await Pack.toBuffer(doc));
  } catch (error) {
    console.error("[renderHtmlToDocxPuppeteer] Error:", error);
    throw error;
  } finally {
    try {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // Best-effort cleanup; temp directories are isolated per job.
    }
  }
}

export async function closeBrowser() {
  if (browserInstance) {
    await browserInstance.close();
    browserInstance = null;
  }
}
