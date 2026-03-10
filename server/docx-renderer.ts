/**
 * محرك تصدير Word (.docx) - SERS
 * النهج الجديد: يبني مستند Word نصي قابل للتعديل مباشرة
 * بدلاً من التقاط screenshot وتحويلها لصورة
 * 
 * يستقبل بيانات منظمة (JSON) من الفرونت ويبني المستند
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  WidthType,
  AlignmentType,
  PageOrientation,
  BorderStyle,
  ImageRun,
  HeadingLevel,
  ShadingType,
  VerticalAlign,
  Header,
  Footer,
  TabStopPosition,
  TabStopType,
  convertInchesToTwip,
} from "docx";

// ===== Types =====
interface DocxField {
  label: string;
  value: string;
}

interface DocxEvidence {
  fileName?: string;
  fileUrl?: string;
  displayAs?: "image" | "qr";
  type?: string;
  text?: string;
  link?: string;
}

interface DocxSubEvidence {
  title: string;
  fields: DocxField[];
  evidences: DocxEvidence[];
}

interface DocxCriterion {
  title: string;
  subEvidences: DocxSubEvidence[];
}

interface DocxExportData {
  personalInfo: {
    name: string;
    school: string;
    department: string;
    year: string;
    semester: string;
    evaluator: string;
    evaluatorRole: string;
    date: string;
    reportTitle: string;
  };
  criteria: DocxCriterion[];
  themeColor?: string; // لون الهوية البصرية
  mode: "single" | "full"; // معاينة مفردة أو تقرير كامل
  singleTitle?: string; // عنوان الشاهد المفرد
}

// ===== Helper functions =====
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return h.length === 6 ? h : '1a3a5c';
}

function lightenHex(hex: string): string {
  // تفتيح اللون بنسبة 80% (مزج مع الأبيض)
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const mix = 0.8;
  const lr = Math.round(r + (255 - r) * mix);
  const lg = Math.round(g + (255 - g) * mix);
  const lb = Math.round(b + (255 - b) * mix);
  return lr.toString(16).padStart(2, '0') + lg.toString(16).padStart(2, '0') + lb.toString(16).padStart(2, '0');
}

function createBorder(color: string, size = 6) {
  return {
    top: { style: BorderStyle.SINGLE, size, color },
    bottom: { style: BorderStyle.SINGLE, size, color },
    left: { style: BorderStyle.SINGLE, size, color },
    right: { style: BorderStyle.SINGLE, size, color },
  };
}

// ===== تصدير شاهد مفرد =====
function buildSingleEvidenceDoc(data: DocxExportData): Document {
  const color = hexToRgb(data.themeColor || '#1a3a5c');
  const pi = data.personalInfo;
  const criterion = data.criteria[0];
  const sub = criterion?.subEvidences[0];

  const children: (Paragraph | Table)[] = [];

  // ===== الترويسة =====
  // سطر الجهات
  const deptLines = (pi.department || '').split('\n').filter(l => l.trim());
  
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 100 },
    children: deptLines.map((line, i) => new TextRun({
      text: line.trim() + (i < deptLines.length - 1 ? '\n' : ''),
      font: 'Cairo',
      size: 22,
      color: '333333',
      break: i > 0 ? 1 : undefined,
    })),
  }));

  // خط فاصل
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 100, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color } },
    children: [],
  }));

  // عنوان البند
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({
      text: data.singleTitle || criterion?.title || 'شاهد الأداء',
      font: 'Cairo',
      size: 28,
      bold: true,
      color: 'ffffff',
    })],
  }));

  // ===== جدول الحقول =====
  if (sub && sub.fields.length > 0) {
    const tableRows: TableRow[] = [];

    for (const field of sub.fields) {
      tableRows.push(new TableRow({
        children: [
          new TableCell({
            width: { size: 25, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color },
            verticalAlign: VerticalAlign.CENTER,
            borders: createBorder(color),
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [new TextRun({
                text: field.label,
                font: 'Cairo',
                size: 22,
                bold: true,
                color: 'ffffff',
              })],
            })],
          }),
          new TableCell({
            width: { size: 75, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: createBorder(color),
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 60, after: 60 },
              children: [new TextRun({
                text: field.value || '.....................',
                font: 'Cairo',
                size: 22,
                color: field.value ? '1a1a1a' : '999999',
              })],
            })],
          }),
        ],
      }));
    }

    children.push(new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      rows: tableRows,
    }));
  }

  // ===== الشواهد المرفقة =====
  if (sub && sub.evidences.length > 0) {
    children.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 300, after: 100 },
      children: [new TextRun({
        text: 'الشواهد المرفقة:',
        font: 'Cairo',
        size: 24,
        bold: true,
        color,
      })],
    }));

    for (const ev of sub.evidences) {
      if (ev.type === 'text' && ev.text) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 60, after: 60 },
          bullet: { level: 0 },
          children: [new TextRun({
            text: ev.text,
            font: 'Cairo',
            size: 20,
            color: '333333',
          })],
        }));
      } else if (ev.type === 'link' && ev.link) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 60, after: 60 },
          bullet: { level: 0 },
          children: [new TextRun({
            text: `رابط: ${ev.link}`,
            font: 'Cairo',
            size: 20,
            color: '0066cc',
          })],
        }));
      } else if (ev.fileName) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 60, after: 60 },
          bullet: { level: 0 },
          children: [new TextRun({
            text: `ملف مرفق: ${ev.fileName}`,
            font: 'Cairo',
            size: 20,
            color: '333333',
          })],
        }));
        if (ev.fileUrl) {
          children.push(new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 20, after: 60 },
            indent: { left: convertInchesToTwip(0.5) },
            children: [new TextRun({
              text: ev.fileUrl,
              font: 'Cairo',
              size: 18,
              color: '0066cc',
            })],
          }));
        }
      }
    }
  }

  // ===== التوقيعات =====
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));

  // التوقيعات - التنفيذ بجانب الاسم
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          // التنفيذ (يمين)
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: createBorder('ffffff', 0),
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: 'التنفيذ:', font: 'Cairo', size: 22, bold: true, color }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `أ/ ${pi.name || '..........................'}`, font: 'Cairo', size: 20, color: pi.name ? '333333' : '999999' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                  new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' }),
                ],
              }),
            ],
          }),
          // مدير المدرسة (يسار)
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: createBorder('ffffff', 0),
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  new TextRun({ text: `${pi.evaluatorRole || 'مدير المدرسة'}:`, font: 'Cairo', size: 22, bold: true, color }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 80 },
                children: [
                  new TextRun({ text: `أ/ ${pi.evaluator || '..........................'}`, font: 'Cairo', size: 20, color: pi.evaluator ? '333333' : '999999' }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 120 },
                children: [
                  new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }));

  // ===== التذييل =====
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400 },
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({
      text: 'SERS - نظام السجلات التعليمية الذكي',
      font: 'Cairo',
      size: 18,
      color: 'ffffff',
      bold: true,
    })],
  }));

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Cairo', size: 22 },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  });
}

// ===== تصدير تقرير كامل =====
function buildFullReportDoc(data: DocxExportData): Document {
  const color = hexToRgb(data.themeColor || '#1a3a5c');
  const pi = data.personalInfo;

  const children: (Paragraph | Table)[] = [];

  // ===== صفحة الغلاف =====
  children.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));

  const deptLines = (pi.department || '').split('\n').filter(l => l.trim());
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: deptLines.map((line, i) => new TextRun({
      text: line.trim(),
      font: 'Cairo',
      size: 24,
      color: '333333',
      break: i > 0 ? 1 : undefined,
    })),
  }));

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 600, after: 200 },
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({
      text: pi.reportTitle || 'شواهد الأداء الوظيفي',
      font: 'Cairo',
      size: 40,
      bold: true,
      color: 'ffffff',
    })],
  }));

  // معلومات شخصية
  const infoFields = [
    { label: 'اسم المعلم/ة', value: pi.name },
    { label: 'المدرسة', value: pi.school },
    { label: 'العام الدراسي', value: pi.year },
    { label: 'الفصل الدراسي', value: pi.semester },
  ].filter(f => f.value);

  if (infoFields.length > 0) {
    children.push(new Paragraph({ spacing: { before: 400 }, children: [] }));
    
    const infoRows = infoFields.map(f => new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: lightenHex(color) },
          borders: createBorder(color, 4),
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: f.label, font: 'Cairo', size: 22, bold: true, color })],
          })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: createBorder(color, 4),
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 40, after: 40 },
            children: [new TextRun({ text: f.value, font: 'Cairo', size: 22, color: '1a1a1a' })],
          })],
        }),
      ],
    }));

    children.push(new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      rows: infoRows,
    }));
  }

  // ===== البنود =====
  for (const criterion of data.criteria) {
    // عنوان البند - صفحة جديدة
    children.push(new Paragraph({
      pageBreakBefore: true,
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 300 },
      shading: { type: ShadingType.SOLID, color },
      children: [new TextRun({
        text: criterion.title,
        font: 'Cairo',
        size: 28,
        bold: true,
        color: 'ffffff',
      })],
    }));

    for (const sub of criterion.subEvidences) {
      // عنوان الشاهد الفرعي
      children.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 300, after: 150 },
        border: { bottom: { style: BorderStyle.SINGLE, size: 4, color } },
        children: [new TextRun({
          text: sub.title,
          font: 'Cairo',
          size: 24,
          bold: true,
          color,
        })],
      }));

      // جدول الحقول
      if (sub.fields.length > 0) {
        const fieldRows = sub.fields.map(field => new TableRow({
          children: [
            new TableCell({
              width: { size: 25, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color },
              verticalAlign: VerticalAlign.CENTER,
              borders: createBorder(color),
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [new TextRun({
                  text: field.label,
                  font: 'Cairo',
                  size: 20,
                  bold: true,
                  color: 'ffffff',
                })],
              })],
            }),
            new TableCell({
              width: { size: 75, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: createBorder(color),
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 40, after: 40 },
                children: [new TextRun({
                  text: field.value || '.....................',
                  font: 'Cairo',
                  size: 20,
                  color: field.value ? '1a1a1a' : '999999',
                })],
              })],
            }),
          ],
        }));

        children.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: fieldRows,
        }));
      }

      // الشواهد المرفقة
      if (sub.evidences.length > 0) {
        children.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({
            text: 'الشواهد المرفقة:',
            font: 'Cairo',
            size: 20,
            bold: true,
            color: '555555',
          })],
        }));

        for (const ev of sub.evidences) {
          if (ev.type === 'text' && ev.text) {
            children.push(new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: ev.text, font: 'Cairo', size: 18, color: '333333' })],
            }));
          } else if (ev.type === 'link' && ev.link) {
            children.push(new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: `رابط: ${ev.link}`, font: 'Cairo', size: 18, color: '0066cc' })],
            }));
          } else if (ev.fileName) {
            children.push(new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              bullet: { level: 0 },
              children: [
                new TextRun({ text: `ملف: ${ev.fileName}`, font: 'Cairo', size: 18, color: '333333' }),
                ...(ev.fileUrl ? [new TextRun({ text: ` (${ev.fileUrl})`, font: 'Cairo', size: 16, color: '0066cc' })] : []),
              ],
            }));
          }
        }
      }
    }
  }

  // ===== التوقيعات =====
  children.push(new Paragraph({ spacing: { before: 600 }, children: [] }));

  // التوقيعات - التنفيذ بجانب الاسم
  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: createBorder('ffffff', 0),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'التنفيذ:', font: 'Cairo', size: 22, bold: true, color })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: `أ/ ${pi.name || '..........................'}`, font: 'Cairo', size: 20, color: pi.name ? '333333' : '999999' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: createBorder('ffffff', 0),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: `${pi.evaluatorRole || 'مدير المدرسة'}:`, font: 'Cairo', size: 22, bold: true, color })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: `أ/ ${pi.evaluator || '..........................'}`, font: 'Cairo', size: 20, color: pi.evaluator ? '333333' : '999999' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' })] }),
            ],
          }),
        ],
      }),
    ],
  }));

  return new Document({
    styles: {
      default: {
        document: {
          run: { font: 'Cairo', size: 22 },
          paragraph: { alignment: AlignmentType.RIGHT },
        },
      },
    },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 720, right: 720, bottom: 720, left: 720 },
        },
      },
      children,
    }],
  });
}

// ===== Main export function =====
export async function renderStructuredDocx(data: DocxExportData): Promise<Buffer> {
  const doc = data.mode === 'single'
    ? buildSingleEvidenceDoc(data)
    : buildFullReportDoc(data);

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ===== Legacy: keep old function for backward compatibility =====
export async function renderHtmlToDocx(htmlContent: string): Promise<Buffer> {
  // Fallback: إذا تم استدعاء الدالة القديمة، نستخدم Puppeteer
  const puppeteer = await import("puppeteer");
  
  let browserInstance = await puppeteer.default.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu"],
    protocolTimeout: 120000,
  });

  const page = await browserInstance.newPage();
  try {
    await page.setViewport({ width: 794, height: 1123, deviceScaleFactor: 2 });
    
    const fullHtml = `<!DOCTYPE html>
<html lang="ar" dir="rtl">
<head>
  <meta charset="UTF-8">
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@200..1000&family=Tajawal:wght@200;300;400;500;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page { size: A4; margin: 0; }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { font-family: 'Cairo', 'Tajawal', 'Arial', sans-serif; direction: rtl; background: white; }
    body { width: 210mm; min-height: 297mm; }
    .pdf-page { width: 210mm; min-height: 297mm; page-break-after: always; display: flex; flex-direction: column; }
    button, [data-no-print] { display: none !important; }
    img { max-width: 100%; }
    table { border-collapse: collapse; width: 100%; }
  </style>
</head>
<body>${htmlContent}</body>
</html>`;

    await page.setContent(fullHtml, { waitUntil: ["networkidle0", "domcontentloaded"], timeout: 60000 });
    await page.evaluate(() => document.fonts.ready);
    await new Promise(resolve => setTimeout(resolve, 2000));

    const screenshot = await page.screenshot({ type: 'png', fullPage: true, omitBackground: false });
    const screenshotBuffer = Buffer.from(screenshot);

    const { Document: Doc, Packer: Pack, Paragraph: Para, ImageRun: ImgRun, AlignmentType: Align, PageOrientation: Orient } = await import("docx");

    const doc = new Doc({
      sections: [{
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
            children: [new ImgRun({ data: screenshotBuffer, transformation: { width: 595, height: 842 }, type: "png" })],
          }),
        ],
      }],
    });

    const buffer = await Pack.toBuffer(doc);
    return Buffer.from(buffer);
  } finally {
    await page.close();
    await browserInstance.close();
  }
}

// ===== New: convert base64 image from html2canvas to Word =====
export async function renderImageToDocx(
  imageBase64: string,
  canvasWidth?: number,
  canvasHeight?: number
): Promise<Buffer> {
  // استخراج البيانات من base64
  const base64Data = imageBase64.replace(/^data:image\/\w+;base64,/, '');
  const imageBuffer = Buffer.from(base64Data, 'base64');

  // حساب أبعاد الصورة في Word (A4 = 595pt × 842pt)
  const a4WidthPt = 595;
  const a4HeightPt = 842;
  
  let imgWidth = a4WidthPt;
  let imgHeight = a4HeightPt;

  if (canvasWidth && canvasHeight) {
    const aspectRatio = canvasHeight / canvasWidth;
    imgHeight = Math.round(imgWidth * aspectRatio);
    
    // إذا كانت الصورة أطول من A4، نقسمها لصفحات
    // لكن في الغالب ستكون صفحة واحدة
    if (imgHeight > a4HeightPt * 1.5) {
      // صورة طويلة - نصغرها لتناسب العرض
      imgWidth = a4WidthPt;
      imgHeight = Math.round(imgWidth * aspectRatio);
    }
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          size: { 
            width: 11906, // A4 width in twips
            height: 16838, // A4 height in twips
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
              transformation: { width: imgWidth, height: imgHeight },
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
