import { jsPDF } from "jspdf";
import html2canvas from "html2canvas";

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
  headerBg: "#047857",
  headerText: "#FFFFFF",
  accent: "#059669",
  borderColor: "#D1FAE5",
  bodyBg: "#FFFFFF",
  fontFamily: "Tajawal",
};

// A4 dimensions in pixels at 96 DPI
const A4_WIDTH_PX = 794;
const A4_HEIGHT_PX = 1123;

// Cache for converted images to avoid re-fetching
const imageDataUrlCache = new Map<string, string>();

/**
 * تحويل صورة خارجية إلى data URL عبر server proxy
 * يتجاوز مشاكل CORS بالكامل
 */
async function fetchImageAsDataUrl(url: string): Promise<string | null> {
  // Check cache first
  if (imageDataUrlCache.has(url)) {
    return imageDataUrlCache.get(url)!;
  }

  // Skip data URLs and blob URLs
  if (url.startsWith("data:") || url.startsWith("blob:")) {
    return url;
  }

  try {
    // Method 1: Try direct fetch first (same-origin images)
    const directResponse = await fetch(url, { mode: "cors" }).catch(() => null);
    if (directResponse && directResponse.ok) {
      const blob = await directResponse.blob();
      const dataUrl = await blobToDataUrl(blob);
      imageDataUrlCache.set(url, dataUrl);
      return dataUrl;
    }
  } catch {
    // Fall through to proxy
  }

  try {
    // Method 2: Use server-side proxy to bypass CORS
    const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(url)}`;
    const proxyResponse = await fetch(proxyUrl);
    if (proxyResponse.ok) {
      const blob = await proxyResponse.blob();
      const dataUrl = await blobToDataUrl(blob);
      imageDataUrlCache.set(url, dataUrl);
      return dataUrl;
    }
  } catch {
    // Fall through to canvas method
  }

  try {
    // Method 3: Canvas-based conversion (last resort)
    const dataUrl = await canvasImageToDataUrl(url);
    if (dataUrl) {
      imageDataUrlCache.set(url, dataUrl);
      return dataUrl;
    }
  } catch {
    // All methods failed
  }

  return null;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

function canvasImageToDataUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          resolve(canvas.toDataURL("image/png"));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    // Add cache-busting parameter
    img.src = url + (url.includes("?") ? "&" : "?") + "_t=" + Date.now();
  });
}

/**
 * تحويل جميع ألوان oklch في العنصر إلى RGB قبل التصدير
 */
function convertOklchColors(element: HTMLElement): (() => void) {
  const originalStyles: { el: HTMLElement; prop: string; value: string }[] = [];
  const allElements = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];

  const colorProps = [
    "color", "backgroundColor", "borderColor", "borderTopColor",
    "borderRightColor", "borderBottomColor", "borderLeftColor",
    "outlineColor", "textDecorationColor", "boxShadow",
    "background",
  ];

  for (const el of allElements) {
    const computed = window.getComputedStyle(el);
    for (const prop of colorProps) {
      const cssProp = prop.replace(/([A-Z])/g, "-$1").toLowerCase();
      const value = computed.getPropertyValue(cssProp);
      if (value && value.includes("oklch")) {
        originalStyles.push({ el, prop, value: (el.style as any)[prop] || "" });
        const rgb = oklchToRgb(value);
        if (rgb) (el.style as any)[prop] = rgb;
      }
    }
  }

  // Convert CSS variables too
  const rootEl = document.documentElement;
  const rootComputed = window.getComputedStyle(rootEl);
  const cssVarOverrides: { name: string; original: string }[] = [];
  const cssVarNames = [
    "--background", "--foreground", "--card", "--card-foreground",
    "--popover", "--popover-foreground", "--primary", "--primary-foreground",
    "--secondary", "--secondary-foreground", "--muted", "--muted-foreground",
    "--accent", "--accent-foreground", "--destructive", "--destructive-foreground",
    "--border", "--input", "--ring",
  ];

  for (const varName of cssVarNames) {
    const val = rootComputed.getPropertyValue(varName).trim();
    if (val && val.includes("oklch")) {
      const rgb = oklchToRgb(val);
      if (rgb) {
        cssVarOverrides.push({ name: varName, original: rootEl.style.getPropertyValue(varName) });
        rootEl.style.setProperty(varName, rgb);
      }
    }
  }

  return () => {
    for (const { el, prop, value } of originalStyles) {
      (el.style as any)[prop] = value;
    }
    for (const { name, original } of cssVarOverrides) {
      if (original) rootEl.style.setProperty(name, original);
      else rootEl.style.removeProperty(name);
    }
  };
}

function oklchToRgb(oklchValue: string): string | null {
  try {
    const canvas = document.createElement("canvas");
    canvas.width = 1;
    canvas.height = 1;
    const ctx = canvas.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = oklchValue;
    ctx.fillRect(0, 0, 1, 1);
    const d = ctx.getImageData(0, 0, 1, 1).data;
    return d[3] < 255
      ? `rgba(${d[0]},${d[1]},${d[2]},${(d[3] / 255).toFixed(3)})`
      : `rgb(${d[0]},${d[1]},${d[2]})`;
  } catch {
    return null;
  }
}

/**
 * تحويل جميع الصور الخارجية في العنصر إلى data URLs
 * يستخدم server proxy لتجاوز CORS
 */
async function convertAllImagesToDataUrls(element: HTMLElement): Promise<(() => void)> {
  const images = element.querySelectorAll("img");
  const originals: { img: HTMLImageElement; src: string }[] = [];

  const promises = Array.from(images).map(async (img) => {
    const src = img.src;
    if (src && !src.startsWith("data:") && !src.startsWith("blob:")) {
      const dataUrl = await fetchImageAsDataUrl(src);
      if (dataUrl) {
        originals.push({ img, src });
        img.src = dataUrl;
      }
    }
  });

  await Promise.all(promises);

  // Also convert background images in inline styles
  const allElements = [element, ...Array.from(element.querySelectorAll("*"))] as HTMLElement[];
  const bgOriginals: { el: HTMLElement; prop: string; value: string }[] = [];

  for (const el of allElements) {
    const bgImage = el.style.backgroundImage;
    if (bgImage && bgImage.includes("url(")) {
      const urlMatch = bgImage.match(/url\(['"]?(https?:\/\/[^'")\s]+)['"]?\)/);
      if (urlMatch) {
        const imgUrl = urlMatch[1];
        const dataUrl = await fetchImageAsDataUrl(imgUrl);
        if (dataUrl) {
          bgOriginals.push({ el, prop: "backgroundImage", value: bgImage });
          el.style.backgroundImage = `url(${dataUrl})`;
        }
      }
    }
  }

  return () => {
    for (const { img, src } of originals) {
      img.src = src;
    }
    for (const { el, prop, value } of bgOriginals) {
      (el.style as any)[prop] = value;
    }
  };
}

/**
 * إنشاء inline font styles لتضمين الخطوط العربية مباشرة
 * يتجنب CSS SecurityError من Google Fonts
 */
function getInlineFontStyles(): string {
  return `
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 300 800;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcWmhzfH5lWWgcQyyS4J0.woff2) format('woff2');
      unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC;
    }
    @font-face {
      font-family: 'Cairo';
      font-style: normal;
      font-weight: 300 800;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/cairo/v28/SLXgc1nY6HkvangtZmpcWmhzfH5lWWgcQyyS4J0.woff2) format('woff2');
      unicode-range: U+0000-00FF, U+0131, U+0152-0153, U+02BB-02BC, U+02C6, U+02DA, U+02DC, U+0304, U+0308, U+0329, U+2000-206F, U+2074, U+20AC, U+2122, U+2191, U+2193, U+2212, U+2215, U+FEFF, U+FFFD;
    }
    @font-face {
      font-family: 'Tajawal';
      font-style: normal;
      font-weight: 400;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/tajawal/v9/Iura6YBj_oCad4k1nzSBC45I.woff2) format('woff2');
      unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC;
    }
    @font-face {
      font-family: 'Tajawal';
      font-style: normal;
      font-weight: 700;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/tajawal/v9/Iurf6YBj_oCad4k1l_6gHrRpiYlJ.woff2) format('woff2');
      unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC;
    }
    @font-face {
      font-family: 'Tajawal';
      font-style: normal;
      font-weight: 800;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/tajawal/v9/Iurf6YBj_oCad4k1l4KjHrRpiYlJ.woff2) format('woff2');
      unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC;
    }
    @font-face {
      font-family: 'Tajawal';
      font-style: normal;
      font-weight: 900;
      font-display: swap;
      src: url(https://fonts.gstatic.com/s/tajawal/v9/Iurf6YBj_oCad4k1l6ahHrRpiYlJ.woff2) format('woff2');
      unicode-range: U+0600-06FF, U+0750-077F, U+0870-088E, U+0890-0891, U+0898-08E1, U+08E3-08FF, U+200C-200E, U+2010-2011, U+204F, U+2E41, U+FB50-FDFF, U+FE70-FE9F, U+FE80-FEFC;
    }
  `;
}

/**
 * تصدير PDF بنظام صفحات A4 منفصلة - جودة عالية مع دعم كامل للعربية
 * يستخدم html2canvas + jsPDF
 * كل div مباشر داخل preview-content = صفحة PDF واحدة
 */
export async function exportToPDF(
  elementId: string,
  filename: string = "document.pdf",
  onProgress?: (current: number, total: number) => void
): Promise<boolean> {
  const element = document.getElementById(elementId);
  if (!element) throw new Error("Element not found: " + elementId);

  try {
    // Step 1: Hide buttons and interactive elements
    const buttons = element.querySelectorAll("button, [data-no-print]");
    buttons.forEach((btn) => ((btn as HTMLElement).style.display = "none"));

    // Step 2: Convert oklch colors to RGB
    const restoreColors = convertOklchColors(element);

    // Step 3: Convert all external images to data URLs (bypasses CORS)
    const restoreImages = await convertAllImagesToDataUrls(element);

    // Step 4: Wait for fonts to be ready
    await document.fonts.ready;
    await new Promise((resolve) => setTimeout(resolve, 300));

    // Step 5: Create PDF
    const pdf = new jsPDF({
      orientation: "portrait",
      unit: "mm",
      format: "a4",
    });

    const pdfWidth = pdf.internal.pageSize.getWidth(); // 210mm
    const pdfHeight = pdf.internal.pageSize.getHeight(); // 297mm

    // Find separate pages (direct child divs)
    const pages = element.querySelectorAll(":scope > div");
    const totalPages = pages.length || 1;

    if (pages.length > 0) {
      for (let i = 0; i < pages.length; i++) {
        const page = pages[i] as HTMLElement;
        if (i > 0) pdf.addPage();
        onProgress?.(i + 1, totalPages);

        // Fix page dimensions for consistent rendering
        const origStyles = {
          width: page.style.width,
          maxWidth: page.style.maxWidth,
          minHeight: page.style.minHeight,
          boxShadow: page.style.boxShadow,
          marginBottom: page.style.marginBottom,
          overflow: page.style.overflow,
        };

        page.style.width = A4_WIDTH_PX + "px";
        page.style.maxWidth = A4_WIDTH_PX + "px";
        page.style.minHeight = A4_HEIGHT_PX + "px";
        page.style.boxShadow = "none";
        page.style.marginBottom = "0";
        page.style.overflow = "hidden";

        try {
          const canvas = await html2canvas(page, {
            scale: 2.5,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
            width: A4_WIDTH_PX,
            windowWidth: A4_WIDTH_PX,
            // Remove external stylesheets to avoid CSS SecurityError
            ignoreElements: (el: Element) => {
              // Ignore link elements that load external CSS (Google Fonts etc.)
              if (el.tagName === "LINK" && el.getAttribute("rel") === "stylesheet") {
                const href = el.getAttribute("href") || "";
                if (href.includes("fonts.googleapis.com")) {
                  return true;
                }
              }
              return false;
            },
            onclone: (clonedDoc: Document) => {
              // Inject inline font definitions to replace Google Fonts link
              const style = clonedDoc.createElement("style");
              style.textContent = getInlineFontStyles() + `
                * {
                  font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif !important;
                }
              `;
              clonedDoc.head.appendChild(style);

              // Remove Google Fonts link tags to prevent SecurityError
              const links = clonedDoc.querySelectorAll('link[href*="fonts.googleapis.com"]');
              links.forEach((link) => link.remove());
            },
          });

          const imgData = canvas.toDataURL("image/jpeg", 0.92);
          const ratio = pdfWidth / canvas.width;
          const scaledHeight = canvas.height * ratio;

          if (scaledHeight <= pdfHeight + 2) {
            // Page fits in one PDF page
            pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, Math.min(scaledHeight, pdfHeight));
          } else {
            // Page is taller than A4 - split it
            const pageCanvasHeight = pdfHeight / ratio;
            let remainingHeight = canvas.height;
            let sourceY = 0;
            let subPage = 0;

            while (remainingHeight > 20) {
              if (subPage > 0) pdf.addPage();
              const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);

              const sliceCanvas = document.createElement("canvas");
              sliceCanvas.width = canvas.width;
              sliceCanvas.height = Math.ceil(sliceHeight);
              const ctx = sliceCanvas.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "#ffffff";
                ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
                ctx.drawImage(
                  canvas,
                  0, sourceY, canvas.width, sliceHeight,
                  0, 0, canvas.width, sliceHeight
                );
                const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
                pdf.addImage(sliceData, "JPEG", 0, 0, pdfWidth, sliceHeight * ratio);
              }

              sourceY += sliceHeight;
              remainingHeight -= sliceHeight;
              subPage++;
            }
          }
        } catch (pageError) {
          console.warn(`Error exporting page ${i + 1}:`, pageError);
          // Add blank page as fallback
        }

        // Restore original styles
        page.style.width = origStyles.width;
        page.style.maxWidth = origStyles.maxWidth;
        page.style.minHeight = origStyles.minHeight;
        page.style.boxShadow = origStyles.boxShadow;
        page.style.marginBottom = origStyles.marginBottom;
        page.style.overflow = origStyles.overflow;

        // Let browser breathe
        await new Promise((resolve) => setTimeout(resolve, 150));
      }
    } else {
      // Fallback: capture entire element
      onProgress?.(1, 1);
      const canvas = await html2canvas(element, {
        scale: 2,
        useCORS: true,
        allowTaint: true,
        backgroundColor: "#ffffff",
        logging: false,
        width: A4_WIDTH_PX,
        windowWidth: A4_WIDTH_PX,
        onclone: (clonedDoc: Document) => {
          const style = clonedDoc.createElement("style");
          style.textContent = getInlineFontStyles() + `
            * { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif !important; }
          `;
          clonedDoc.head.appendChild(style);
          const links = clonedDoc.querySelectorAll('link[href*="fonts.googleapis.com"]');
          links.forEach((link) => link.remove());
        },
      });

      const imgData = canvas.toDataURL("image/jpeg", 0.92);
      const ratio = pdfWidth / canvas.width;
      const scaledHeight = canvas.height * ratio;

      if (scaledHeight <= pdfHeight) {
        pdf.addImage(imgData, "JPEG", 0, 0, pdfWidth, scaledHeight);
      } else {
        const pageCanvasHeight = pdfHeight / ratio;
        let remainingHeight = canvas.height;
        let sourceY = 0;
        let pageNum = 0;

        while (remainingHeight > 20) {
          if (pageNum > 0) pdf.addPage();
          const sliceHeight = Math.min(pageCanvasHeight, remainingHeight);

          const sliceCanvas = document.createElement("canvas");
          sliceCanvas.width = canvas.width;
          sliceCanvas.height = Math.ceil(sliceHeight);
          const ctx = sliceCanvas.getContext("2d");
          if (ctx) {
            ctx.fillStyle = "#ffffff";
            ctx.fillRect(0, 0, sliceCanvas.width, sliceCanvas.height);
            ctx.drawImage(
              canvas,
              0, sourceY, canvas.width, sliceHeight,
              0, 0, canvas.width, sliceHeight
            );
            const sliceData = sliceCanvas.toDataURL("image/jpeg", 0.92);
            pdf.addImage(sliceData, "JPEG", 0, 0, pdfWidth, sliceHeight * ratio);
          }

          sourceY += sliceHeight;
          remainingHeight -= sliceHeight;
          pageNum++;
        }
      }
    }

    // Step 6: Restore everything
    restoreColors();
    restoreImages();
    buttons.forEach((btn) => ((btn as HTMLElement).style.display = ""));

    // Step 7: Save PDF
    pdf.save(filename);
    return true;
  } catch (err) {
    console.error("PDF export error:", err);
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
      <style>
        ${getInlineFontStyles()}
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Cairo', 'Tajawal', sans-serif; direction: rtl; background: white; }
        @media print {
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
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
  }, 1000);
}
