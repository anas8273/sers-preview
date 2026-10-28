import puppeteer, { type Browser, type Page } from "puppeteer";
import { promises as fs } from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { requireActive, ResourceLimitError } from "./bounded-work";
import {
  pdfPageCount,
  RENDER_LIMITS,
  runPoppler,
  withDocumentRenderBudget,
} from "./render-limits";

let browserInstance: Browser | null = null;
let browserLaunch: Promise<Browser> | null = null;
export const ALLOWED_RENDER_HOSTS = new Set([
  "fonts.googleapis.com",
  "fonts.gstatic.com",
]);

async function getBrowser(): Promise<Browser> {
  if (browserInstance?.connected) return browserInstance;
  if (browserLaunch) return browserLaunch;
  const pending = puppeteer
    .launch({
      headless: true,
      timeout: 15_000,
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
    })
    .then(browser => {
      browserInstance = browser;
      browser.once("disconnected", () => {
        if (browserInstance === browser) browserInstance = null;
      });
      return browser;
    })
    .finally(() => {
      if (browserLaunch === pending) browserLaunch = null;
    });
  browserLaunch = pending;
  return pending;
}

async function killBrowser(browser: Browser) {
  if (browserInstance === browser) browserInstance = null;
  const child = browser.process();
  if (child?.pid && child.exitCode === null && !child.signalCode) {
    // Puppeteer starts Chromium in its own process group on Linux. Kill the
    // group after a failed graceful close so renderer subprocesses do not leak.
    await new Promise<void>(resolve => {
      const done = () => {
        child.removeListener("exit", done);
        child.removeListener("error", done);
        resolve();
      };
      child.once("exit", done);
      child.once("error", done);
      try {
        process.kill(-child.pid!, "SIGKILL");
      } catch {
        if (!child.kill("SIGKILL")) done();
      }
    });
  }
}

async function boundedClose(close: () => Promise<unknown>, browser: Browser) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    await Promise.race([
      close().catch(() => killBrowser(browser)),
      new Promise<void>(resolve => {
        timer = setTimeout(() => {
          void killBrowser(browser).then(resolve);
        }, 2000);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function configureSafePage(page: Page) {
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", request => {
    const requestUrl = request.url();
    if (
      requestUrl === "about:blank" ||
      requestUrl.startsWith("data:") ||
      requestUrl.startsWith("blob:")
    ) {
      void request.continue().catch(() => undefined);
      return;
    }
    try {
      const url = new URL(requestUrl);
      const allowedType =
        request.resourceType() === "stylesheet" ||
        request.resourceType() === "font";
      if (
        url.protocol === "https:" &&
        ALLOWED_RENDER_HOSTS.has(url.hostname) &&
        allowedType
      ) {
        void request.continue().catch(() => undefined);
        return;
      }
    } catch {
      /* Invalid requests are blocked. */
    }
    void request.abort("blockedbyclient").catch(() => undefined);
  });
}

type PdfOptions = {
  format?: "A4" | "Letter";
  landscape?: boolean;
  printBackground?: boolean;
  margin?: { top?: string; right?: string; bottom?: string; left?: string };
  scale?: number;
};

function assertRenderInput(htmlContent: string) {
  if (
    typeof htmlContent !== "string" ||
    Buffer.byteLength(htmlContent, "utf8") > RENDER_LIMITS.htmlBytes
  )
    throw new ResourceLimitError("Document input exceeds the size limit", 413);
}

async function verifyPdfPages(
  bytes: Buffer,
  maximum: number,
  signal: AbortSignal
) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "sers-pdf-check-"));
  try {
    const filename = path.join(directory, "output.pdf");
    await fs.writeFile(filename, bytes, { mode: 0o600 });
    return pdfPageCount(
      await runPoppler("pdfinfo", [filename], signal),
      maximum
    );
  } finally {
    await fs.rm(directory, { recursive: true, force: true });
  }
}

async function renderPdf(
  htmlContent: string,
  options: PdfOptions | undefined,
  signal: AbortSignal,
  maximumPages: number
): Promise<Buffer> {
  requireActive(signal);
  const browser = await getBrowser();
  requireActive(signal);
  let page: Page | undefined;
  let closing: Promise<void> | undefined;
  const close = () => (closing ??= boundedClose(() => page!.close(), browser));
  const abort = () => {
    if (page) void close();
    else void killBrowser(browser);
  };
  signal.addEventListener("abort", abort, { once: true });
  try {
    page = await browser.newPage();
    requireActive(signal);
    await configureSafePage(page);
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 3 });
    await page.setContent(wrapWithFonts(htmlContent), {
      waitUntil: ["domcontentloaded", "networkidle2"],
      timeout: 30_000,
    });
    await page.evaluate(async () => {
      await document.fonts.ready;
    });
    requireActive(signal);
    await page
      .waitForNetworkIdle({ idleTime: 300, timeout: 5_000 })
      .catch(() => undefined);
    requireActive(signal);
    const pdfBuffer = await page.pdf({
      format: options?.format || "A4",
      landscape: options?.landscape || false,
      printBackground: options?.printBackground !== false,
      margin: options?.margin || {
        top: "0",
        right: "0",
        bottom: "0",
        left: "0",
      },
      scale: options?.scale || 1,
      preferCSSPageSize: true,
      timeout: 30_000,
      // Render one sentinel page beyond the limit, then reject it. Never return
      // a silently truncated document when the submitted content is too long.
      pageRanges: `1-${maximumPages + 1}`,
    });
    requireActive(signal);
    if (pdfBuffer.byteLength > RENDER_LIMITS.pdfBytes)
      throw new ResourceLimitError("Generated PDF exceeds the size limit", 413);
    const buffer = Buffer.from(pdfBuffer);
    await verifyPdfPages(buffer, maximumPages, signal);
    requireActive(signal);
    return buffer;
  } finally {
    signal.removeEventListener("abort", abort);
    if (page) await close();
  }
}

/** All PDF callers share admission and a deadline covering queueing, browser
 * launch, navigation, fonts, printing, parser validation and cleanup. */
export async function renderHtmlToPdf(
  htmlContent: string,
  options?: PdfOptions
): Promise<Buffer> {
  assertRenderInput(htmlContent);
  return withDocumentRenderBudget(signal =>
    renderPdf(htmlContent, options, signal, RENDER_LIMITS.pdfPages)
  );
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

/** Legacy visual DOCX uses the same queue and isolated PDF pipeline. Native
 * editable WorkVersion DOCX is separate and does not rasterize its text. */
export async function renderHtmlToDocxPuppeteer(
  htmlContent: string
): Promise<Buffer> {
  assertRenderInput(htmlContent);
  return withDocumentRenderBudget(async signal => {
    const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "docx-export-"));
    try {
      const pdfBuffer = await renderPdf(
        htmlContent,
        {
          format: "A4",
          printBackground: true,
          margin: { top: "0", right: "0", bottom: "0", left: "0" },
          scale: 1,
        },
        signal,
        RENDER_LIMITS.visualDocxPages
      );
      const pdfPath = path.join(tmpDir, "export.pdf");
      await fs.writeFile(pdfPath, pdfBuffer, { mode: 0o600 });
      const pages = pdfPageCount(
        await runPoppler("pdfinfo", [pdfPath], signal),
        RENDER_LIMITS.visualDocxPages
      );
      const pageImages: Buffer[] = [];
      let totalBytes = 0;
      // Rasterize one bounded page at a time. No shell, no blocking child, no
      // unbounded directory of 300-DPI files before the byte limit is checked.
      for (let page = 1; page <= pages; page++) {
        requireActive(signal);
        const outputPrefix = path.join(tmpDir, `page-${page}`);
        await runPoppler(
          "pdftoppm",
          [
            "-f",
            String(page),
            "-l",
            String(page),
            "-singlefile",
            "-png",
            "-r",
            "150",
            "-scale-to",
            "2200",
            pdfPath,
            outputPrefix,
          ],
          signal
        );
        const filename = `${outputPrefix}.png`,
          info = await fs.stat(filename);
        totalBytes += info.size;
        if (
          !info.isFile() ||
          info.size > RENDER_LIMITS.rasterPageBytes ||
          totalBytes > RENDER_LIMITS.visualDocxImageBytes
        )
          throw new ResourceLimitError(
            "Visual Word output exceeds the image limit",
            413
          );
        pageImages.push(await fs.readFile(filename));
        await fs.unlink(filename);
      }
      requireActive(signal);
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
      const result = Buffer.from(await Pack.toBuffer(new Doc({ sections })));
      requireActive(signal);
      if (result.length > RENDER_LIMITS.visualDocxImageBytes)
        throw new ResourceLimitError(
          "Visual Word output exceeds the size limit",
          413
        );
      return result;
    } finally {
      await fs.rm(tmpDir, { recursive: true, force: true });
    }
  }, RENDER_LIMITS.docxTimeoutMs);
}

export async function closeBrowser() {
  const browser = browserInstance ?? (await browserLaunch?.catch(() => null));
  if (browser) await boundedClose(() => browser.close(), browser);
  browserInstance = null;
}
