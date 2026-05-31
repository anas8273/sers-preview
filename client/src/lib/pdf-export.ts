/**
 * نظام تصدير PDF — innerHTML + CSS مصفّى
 * 
 * Export PDF: innerHTML + CSS + wrapperStyle → POST /api/export-pdf → Puppeteer → تحميل مباشر
 * Print:     printViaWindow() → نافذة طباعة المتصفح
 * 
 * يستخدم innerHTML (محتوى العنصر فقط بدون حاوية المعاينة)
 * + CSS مجمّع ومصفّى من @media print
 * + wrapperStyle (أنماط الحاوية الأصلية)
 */

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

// ═══════════════════════════════════════════════════════════════
// CSS Collection — CORS-safe + Print-sanitized
// ═══════════════════════════════════════════════════════════════

/**
 * Strip @media print blocks and @page rules from collected CSS.
 * Puppeteer runs in print mode — our @media print { body * { visibility: hidden } }
 * would blank the entire PDF. Server defines its own page rules.
 */
function sanitizeCssForPuppeteer(css: string): string {
  let result = css;
  result = result.replace(/@media\s+print\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/gi, '');
  result = result.replace(/@page\s*[^{]*\{[^}]*\}/gi, '');
  return result;
}

/**
 * Collect all compiled CSS from the current page (CORS-safe).
 * Returns sanitized CSS safe for Puppeteer.
 */
function collectPageCSS(): string {
  const cssChunks: string[] = [];

  try {
    for (const sheet of Array.from(document.styleSheets)) {
      try {
        const rules = Array.from(sheet.cssRules);
        cssChunks.push(rules.map(r => r.cssText).join('\n'));
      } catch {
        // Cross-origin stylesheet — skip
      }
    }
  } catch { /* fallback */ }

  try {
    for (const tag of Array.from(document.querySelectorAll('style'))) {
      const content = tag.innerHTML || tag.textContent || '';
      if (content.trim()) cssChunks.push(content);
    }
  } catch { /* ignore */ }

  return sanitizeCssForPuppeteer(cssChunks.join('\n'));
}

// ═══════════════════════════════════════════════════════════════
// Image URL Fix — Relative → Absolute
// ═══════════════════════════════════════════════════════════════

function fixRelativeUrls(html: string): string {
  const origin = window.location.origin;

  html = html.replace(
    /(<img[^>]+src=["'])(\/[^"']*|\.\/[^"']*)(["'])/gi,
    (_, prefix, relUrl, suffix) => {
      const absUrl = relUrl.startsWith('/') ? origin + relUrl : origin + '/' + relUrl;
      return prefix + absUrl + suffix;
    }
  );

  html = html.replace(
    /url\(["']?(\/[^"')]+|\.\/[^"')]+)["']?\)/gi,
    (_, relUrl) => {
      const absUrl = relUrl.startsWith('/') ? origin + relUrl : origin + '/' + relUrl;
      return `url("${absUrl}")`;
    }
  );

  return html;
}

/**
 * Extract safe wrapper style from element.
 * Strips transform/scale/zoom that are preview-only artifacts.
 */
function getSafeWrapperStyle(element: HTMLElement): string {
  const raw = element.getAttribute('style') || '';
  // Remove preview transforms that break PDF layout
  return raw
    .replace(/transform\s*:\s*[^;]+;?/gi, '')
    .replace(/zoom\s*:\s*[^;]+;?/gi, '')
    .replace(/overflow\s*:\s*[^;]+;?/gi, '')
    .replace(/max-height\s*:\s*[^;]+;?/gi, '')
    .trim();
}

// ═══════════════════════════════════════════════════════════════
// Export PDF — تحميل مباشر عبر Puppeteer
// ═══════════════════════════════════════════════════════════════

export async function exportToPDF(
  elementId: string,
  filename: string = "document.pdf",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found: " + elementId);

  try {
    onProgress?.(1, 4);

    // Step 1: Collect CSS (Tailwind + app CSS)
    const appCss = collectPageCSS();

    onProgress?.(2, 4);

    // Step 2: Take innerHTML (content ONLY, no preview container transforms)
    let htmlContent = element.innerHTML;
    htmlContent = fixRelativeUrls(htmlContent);

    const dir = element.style.direction || 'rtl';
    const lang = dir === 'rtl' ? 'ar' : 'en';

    // Get the wrapper style (width, font, direction) without preview transforms
    const wrapperStyle = getSafeWrapperStyle(element);

    onProgress?.(3, 4);

    // Step 3: Send to server
    const response = await fetch('/api/export-pdf', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        html: htmlContent,
        css: appCss,
        filename,
        dir,
        lang,
        wrapperStyle,
      }),
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || 'PDF export failed');
    }

    // Step 4: Download PDF blob
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    onProgress?.(4, 4);
    return true;
  } catch (err) {
    console.error("PDF export error:", err);
    throw err;
  }
}

// ═══════════════════════════════════════════════════════════════
// Print — نافذة طباعة المتصفح
// ═══════════════════════════════════════════════════════════════

export function printElement(elementId: string) {
  const element = document.getElementById(elementId);
  if (!element) return;
  printViaWindow(element, "سيرة-ذاتية");
}

async function printViaWindow(element: HTMLElement, documentTitle: string): Promise<boolean> {
  return new Promise((resolve) => {
    const dir = element.style.direction || 'rtl';
    const lang = dir === 'rtl' ? 'ar' : 'en';
    const fontFamily = lang === 'ar' ? "'Cairo', 'Tajawal', sans-serif" : "'Inter', sans-serif";
    const contentHtml = element.innerHTML;
    const wrapperStyle = getSafeWrapperStyle(element);
    const appCss = collectPageCSS();

    const printDoc = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&family=Inter:wght@100..900&family=Noto+Sans+Arabic:wght@100..900&display=swap" rel="stylesheet">
  <style>${appCss}</style>
  <style>
    ${contentHtml.includes('data-cv-content') ? `
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
    @page { size: A4; margin: 0; }
    `}
    html, body {
      margin: 0 !important;
      padding: 0 !important;
      background-color: white !important;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
      color-adjust: exact !important;
      font-family: ${fontFamily};
      direction: ${dir};
    }
    body { width: 210mm; }
    *, *::before, *::after { box-sizing: border-box; }
    .pdf-page, .evidence-page-wrapper {
      width: 210mm !important;
      min-height: 297mm !important;
      max-height: 297mm !important;
      margin: 0 auto !important;
      box-sizing: border-box !important;
      page-break-after: always;
      overflow: hidden !important;
      position: relative;
    }
    .pdf-page:last-child, .evidence-page-wrapper:last-child { page-break-after: auto; }
    /* Cover & section cover pages — strip preview spacing (PE only) */
    #print-area > div[style*="min-height"]:not([data-cv-content]) {
      margin-bottom: 0 !important;
      box-shadow: none !important;
      page-break-after: always;
      page-break-inside: avoid;
      max-height: 297mm;
      overflow: hidden;
    }
    #print-area > div[style*="min-height"]:not([data-cv-content]):last-child { page-break-after: auto; }
    /* SmartCV: natural multi-page flow */
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
    /* Anti-slice: only small items */
    [data-cv-content] li,
    [data-cv-content] [style*="margin-bottom: 8px"],
    [data-cv-content] [style*="margin-bottom: 6px"] {
      break-inside: avoid !important;
      page-break-inside: avoid !important;
    }
    /* .cv-footer cloned via JS at each page boundary */
    [data-cv-content] p,
    [data-cv-content] li {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .cv-main-header { break-inside: avoid !important; }
    h2 { break-inside: avoid !important; }
    button, [data-no-print] { display: none !important; }
    [style*="background"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    [style*="border"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    [style*="linear-gradient"] { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
  </style>
</head>
<body>
  <div id="print-area" style="${wrapperStyle}">
    ${contentHtml}
  </div>
</body>
</html>`;

    const printWindow = window.open('', '_blank', 'width=800,height=600');
    if (!printWindow) {
      window.print();
      resolve(true);
      return;
    }

    printWindow.document.open();
    printWindow.document.write(printDoc);
    printWindow.document.close();

    const triggerPrint = () => {
      try {
        printWindow.focus();
        printWindow.print();
      } catch (e) {
        console.error('Print failed:', e);
      }
      setTimeout(() => {
        try { printWindow.close(); } catch { /* ignore */ }
        resolve(true);
      }, 1000);
    };

    if (printWindow.document.readyState === 'complete') {
      setTimeout(triggerPrint, 1500);
    } else {
      printWindow.onload = () => setTimeout(triggerPrint, 1500);
      setTimeout(triggerPrint, 3000);
    }
  });
}

// ═══════════════════════════════════════════════════════════════
// أدوات مشتركة
// ═══════════════════════════════════════════════════════════════

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

export async function extractHtmlForExport(element: HTMLElement): Promise<string> {
  return element.innerHTML;
}

export async function exportMultipleReportsToPDF(
  elementIds: string[],
  filename: string = "تقارير_متعددة.pdf",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  if (elementIds.length === 0) throw new Error("No elements to export");

  const total = elementIds.length + 2;
  const appCss = collectPageCSS();
  let combinedHtml = '';

  for (let i = 0; i < elementIds.length; i++) {
    onProgress?.(i + 1, total);
    const element = document.getElementById(elementIds[i]);
    if (!element) continue;

    if (i > 0) {
      combinedHtml += '<div style="break-before: page; page-break-before: always;"></div>';
    }
    combinedHtml += element.innerHTML;
  }

  if (!combinedHtml) throw new Error("No content to export");
  combinedHtml = fixRelativeUrls(combinedHtml);

  onProgress?.(total - 1, total);

  const response = await fetch('/api/export-pdf', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      html: combinedHtml,
      css: appCss,
      filename,
      dir: 'rtl',
      lang: 'ar',
    }),
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(error.error || 'PDF export failed');
  }

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  onProgress?.(total, total);
  return true;
}
