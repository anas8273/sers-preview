/**
 * محرك تصدير Word (.docx) - SERS
 * النهج: يبني مستند Word نصي قابل للتعديل مباشرة
 * مطابق للمعاينة: ترويسة رسمية + جداول بلون واحد موحد + فوتر
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
import { z } from "zod";
import { sanitizeEvidenceImage } from "./work-version-inline-image";

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
  themeColor?: string;
  mode: "single" | "full";
  singleTitle?: string;
}

const boundedText = z.string().max(10_000);
const docxExportSchema = z.object({
  personalInfo: z.object({
    name: boundedText, school: boundedText, department: boundedText, year: boundedText,
    semester: boundedText, evaluator: boundedText, evaluatorRole: boundedText,
    date: boundedText, reportTitle: boundedText,
  }).strict(),
  criteria: z.array(z.object({
    title: boundedText,
    subEvidences: z.array(z.object({
      title: boundedText,
      fields: z.array(z.object({ label: boundedText, value: boundedText }).strict()).max(200),
      evidences: z.array(z.object({
        fileName: z.string().max(512).optional(), fileUrl: z.string().max(2_048).optional(),
        displayAs: z.enum(["image", "qr"]).optional(), type: z.string().max(64).optional(),
        text: boundedText.optional(), link: z.string().max(2_048).optional(),
      }).strict()).max(200),
    }).strict()).max(100),
  }).strict()).max(100),
  themeColor: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
  mode: z.enum(["single", "full"]), singleTitle: boundedText.optional(),
}).strict();

/** Validate untrusted structured export data before building a document. */
export function validateStructuredDocxData(input: unknown): DocxExportData {
  const parsed = docxExportSchema.safeParse(input);
  if (!parsed.success) throw new Error("Invalid structured DOCX data");
  return parsed.data;
}

// ===== Helper functions =====
function hexToRgb(hex: string): string {
  const h = hex.replace('#', '');
  return h.length === 6 ? h : '1a3a5c';
}

function lightenHex(hex: string, mix = 0.85): string {
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
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

function noBorder() {
  return {
    top: { style: BorderStyle.NONE, size: 0, color: 'ffffff' },
    bottom: { style: BorderStyle.NONE, size: 0, color: 'ffffff' },
    left: { style: BorderStyle.NONE, size: 0, color: 'ffffff' },
    right: { style: BorderStyle.NONE, size: 0, color: 'ffffff' },
  };
}

/** إنشاء ترويسة رسمية - المملكة + وزارة التعليم + الإدارة + المدرسة */
function buildOfficialHeader(pi: DocxExportData['personalInfo'], color: string): (Paragraph | Table)[] {
  const elements: (Paragraph | Table)[] = [];
  const deptLines = (pi.department || '').split('\n').filter(l => l.trim());

  // شريط علوي ملون
  elements.push(new Paragraph({
    spacing: { after: 0 },
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({ text: ' ', font: 'Cairo', size: 6 })],
  }));

  // جدول الترويسة: (المملكة + وزارة + إدارة + مدرسة) يمين | شعار وسط | معلومات يسار
  const rightCellChildren: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 80, after: 20 },
      children: [new TextRun({ text: 'المملكة العربية السعودية', font: 'Cairo', size: 20, bold: true, color: hexToRgb(color) })],
    }),
    new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: 'وزارة التعليم', font: 'Cairo', size: 20, bold: true, color: hexToRgb(color) })],
    }),
    ...deptLines.map(line => new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 20, after: 20 },
      children: [new TextRun({ text: line.trim(), font: 'Cairo', size: 18, bold: true, color: hexToRgb(color) })],
    })),
  ];
  if (pi.school) {
    rightCellChildren.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      spacing: { before: 20, after: 40 },
      children: [new TextRun({ text: pi.school, font: 'Cairo', size: 18, bold: true, color: hexToRgb(color) })],
    }));
  }

  const headerRow = new TableRow({
    children: [
      // الجهات (يمين)
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        verticalAlign: VerticalAlign.CENTER,
        children: rightCellChildren,
      }),
      // شعار وزارة التعليم (وسط)
      new TableCell({
        width: { size: 20, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        verticalAlign: VerticalAlign.CENTER,
        children: [new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 40, after: 40 },
          children: [new TextRun({
            text: 'وزارة التعليم',
            font: 'Cairo',
            size: 22,
            bold: true,
            color: hexToRgb(color),
          })],
        })],
      }),
      // المعلومات (يسار)
      new TableCell({
        width: { size: 40, type: WidthType.PERCENTAGE },
        borders: noBorder(),
        verticalAlign: VerticalAlign.CENTER,
        children: [
          ...(pi.semester ? [new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 40, after: 20 },
            children: [new TextRun({ text: `الفصل الدراسي: ${pi.semester}`, font: 'Cairo', size: 18, color: hexToRgb(color) })],
          })] : []),
          ...(pi.year ? [new Paragraph({
            alignment: AlignmentType.LEFT,
            spacing: { before: 20, after: 40 },
            children: [new TextRun({ text: `العام الدراسي: ${pi.year}`, font: 'Cairo', size: 18, color: hexToRgb(color) })],
          })] : []),
        ],
      }),
    ],
  });

  elements.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [headerRow],
  }));

  // خط فاصل
  elements.push(new Paragraph({
    spacing: { before: 60, after: 120 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 8, color } },
    children: [],
  }));

  return elements;
}

/** إنشاء فوتر */
function buildFooter(color: string): Footer {
  return new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.CENTER,
        shading: { type: ShadingType.SOLID, color },
        children: [new TextRun({
          text: 'SERS - نظام السجلات التعليمية الذكي',
          font: 'Cairo',
          size: 16,
          bold: true,
          color: 'ffffff',
        })],
      }),
    ],
  });
}

/** إنشاء header */
function buildHeaderElement(color: string): Header {
  return new Header({
    children: [
      new Paragraph({
        spacing: { after: 0 },
        shading: { type: ShadingType.SOLID, color },
        children: [new TextRun({ text: ' ', font: 'Cairo', size: 4 })],
      }),
    ],
  });
}

// ===== تصدير شاهد مفرد =====
function buildSingleEvidenceDoc(data: DocxExportData): Document {
  const color = hexToRgb(data.themeColor || '#1a3a5c');
  const pi = data.personalInfo;
  const criterion = data.criteria[0];
  const sub = criterion?.subEvidences[0];

  const children: (Paragraph | Table)[] = [];

  // ===== الترويسة الرسمية =====
  children.push(...buildOfficialHeader(pi, color));

  // عنوان البند - شريط ملون
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 200 },
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({
      text: data.singleTitle || criterion?.title || 'شاهد الأداء',
      font: 'Cairo',
      size: 26,
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
            width: { size: 28, type: WidthType.PERCENTAGE },
            shading: { type: ShadingType.SOLID, color },
            verticalAlign: VerticalAlign.CENTER,
            borders: createBorder(color),
            children: [new Paragraph({
              alignment: AlignmentType.CENTER,
              spacing: { before: 60, after: 60 },
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
            width: { size: 72, type: WidthType.PERCENTAGE },
            verticalAlign: VerticalAlign.CENTER,
            borders: createBorder(color),
            children: [new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 60, after: 60 },
              indent: { right: 120 },
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
        size: 22,
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

  children.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder(),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'التنفيذ:', font: 'Cairo', size: 22, bold: true, color })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 80 }, children: [new TextRun({ text: `أ/ ${pi.name || '..........................'}`, font: 'Cairo', size: 20, color: pi.name ? '333333' : '999999' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: noBorder(),
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
          margin: { top: 400, right: 720, bottom: 600, left: 720 },
        },
      },
      headers: { default: buildHeaderElement(color) },
      footers: { default: buildFooter(color) },
      children,
    }],
  });
}

// ===== تصدير تقرير كامل =====
function buildFullReportDoc(data: DocxExportData): Document {
  const color = hexToRgb(data.themeColor || '#1a3a5c');
  const pi = data.personalInfo;
  const lightColor = lightenHex(color, 0.9);

  // ===== القسم الأول: صفحة الغلاف =====
  const coverChildren: (Paragraph | Table)[] = [];

  coverChildren.push(new Paragraph({ spacing: { before: 1200 }, children: [] }));

  // الجهات
  const deptLines = (pi.department || '').split('\n').filter(l => l.trim());
  coverChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { after: 200 },
    children: deptLines.map((line, i) => new TextRun({
      text: line.trim(),
      font: 'Cairo',
      size: 24,
      bold: true,
      color,
      break: i > 0 ? 1 : undefined,
    })),
  }));

  // خط فاصل
  coverChildren.push(new Paragraph({
    spacing: { before: 100, after: 100 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 12, color } },
    children: [],
  }));

  // عنوان التقرير
  coverChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 400, after: 200 },
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
    coverChildren.push(new Paragraph({ spacing: { before: 400 }, children: [] }));

    const infoRows = infoFields.map(f => new TableRow({
      children: [
        new TableCell({
          width: { size: 30, type: WidthType.PERCENTAGE },
          shading: { type: ShadingType.SOLID, color: lightColor },
          borders: createBorder(color, 4),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 60, after: 60 },
            children: [new TextRun({ text: f.label, font: 'Cairo', size: 22, bold: true, color })],
          })],
        }),
        new TableCell({
          width: { size: 70, type: WidthType.PERCENTAGE },
          borders: createBorder(color, 4),
          verticalAlign: VerticalAlign.CENTER,
          children: [new Paragraph({
            alignment: AlignmentType.RIGHT,
            spacing: { before: 60, after: 60 },
            indent: { right: 120 },
            children: [new TextRun({ text: f.value, font: 'Cairo', size: 22, color: '1a1a1a' })],
          })],
        }),
      ],
    }));

    coverChildren.push(new Table({
      width: { size: 80, type: WidthType.PERCENTAGE },
      rows: infoRows,
    }));
  }

  // فوتر الغلاف
  coverChildren.push(new Paragraph({ spacing: { before: 2000 }, children: [] }));
  coverChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({
      text: 'SERS - نظام السجلات التعليمية الذكي',
      font: 'Cairo',
      size: 18,
      bold: true,
      color: 'ffffff',
    })],
  }));

  // ===== أقسام البنود =====
  const contentSections = data.criteria.map((criterion, ci) => {
    const sectionChildren: (Paragraph | Table)[] = [];

    // ترويسة رسمية لكل صفحة بند
    sectionChildren.push(...buildOfficialHeader(pi, color));

    // عنوان البند
    sectionChildren.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 200, after: 300 },
      shading: { type: ShadingType.SOLID, color },
      children: [new TextRun({
        text: criterion.title,
        font: 'Cairo',
        size: 26,
        bold: true,
        color: 'ffffff',
      })],
    }));

    for (const sub of criterion.subEvidences) {
      // عنوان الشاهد الفرعي
      sectionChildren.push(new Paragraph({
        alignment: AlignmentType.RIGHT,
        spacing: { before: 300, after: 150 },
        shading: { type: ShadingType.SOLID, color: lightColor },
        border: { right: { style: BorderStyle.SINGLE, size: 18, color } },
        children: [new TextRun({
          text: `  ${sub.title}`,
          font: 'Cairo',
          size: 22,
          bold: true,
          color,
        })],
      }));

      // جدول الحقول
      if (sub.fields.length > 0) {
        const fieldRows = sub.fields.map(field => new TableRow({
          children: [
            new TableCell({
              width: { size: 28, type: WidthType.PERCENTAGE },
              shading: { type: ShadingType.SOLID, color },
              verticalAlign: VerticalAlign.CENTER,
              borders: createBorder(color),
              children: [new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 50, after: 50 },
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
              width: { size: 72, type: WidthType.PERCENTAGE },
              verticalAlign: VerticalAlign.CENTER,
              borders: createBorder(color),
              children: [new Paragraph({
                alignment: AlignmentType.RIGHT,
                spacing: { before: 50, after: 50 },
                indent: { right: 120 },
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

        sectionChildren.push(new Table({
          width: { size: 100, type: WidthType.PERCENTAGE },
          rows: fieldRows,
        }));
      }

      // الشواهد المرفقة
      if (sub.evidences.length > 0) {
        sectionChildren.push(new Paragraph({
          alignment: AlignmentType.RIGHT,
          spacing: { before: 200, after: 80 },
          children: [new TextRun({
            text: 'الشواهد المرفقة:',
            font: 'Cairo',
            size: 20,
            bold: true,
            color,
          })],
        }));

        for (const ev of sub.evidences) {
          if (ev.type === 'text' && ev.text) {
            sectionChildren.push(new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: ev.text, font: 'Cairo', size: 18, color: '333333' })],
            }));
          } else if (ev.type === 'link' && ev.link) {
            sectionChildren.push(new Paragraph({
              alignment: AlignmentType.RIGHT,
              spacing: { before: 40, after: 40 },
              bullet: { level: 0 },
              children: [new TextRun({ text: `رابط: ${ev.link}`, font: 'Cairo', size: 18, color: '0066cc' })],
            }));
          } else if (ev.fileName) {
            sectionChildren.push(new Paragraph({
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

    return {
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
          margin: { top: 400, right: 720, bottom: 600, left: 720 },
        },
      },
      headers: { default: buildHeaderElement(color) },
      footers: { default: buildFooter(color) },
      children: sectionChildren,
    };
  });

  // ===== القسم الأخير: التوقيعات =====
  const signChildren: (Paragraph | Table)[] = [];
  signChildren.push(...buildOfficialHeader(pi, color));

  signChildren.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 200, after: 300 },
    shading: { type: ShadingType.SOLID, color },
    children: [new TextRun({
      text: 'التوقيعات والاعتماد',
      font: 'Cairo',
      size: 26,
      bold: true,
      color: 'ffffff',
    })],
  }));

  signChildren.push(new Paragraph({ spacing: { before: 400 }, children: [] }));

  signChildren.push(new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: createBorder(color, 4),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: 'التنفيذ:', font: 'Cairo', size: 22, bold: true, color })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: `أ/ ${pi.name || '..........................'}`, font: 'Cairo', size: 20, color: pi.name ? '333333' : '999999' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 120 }, children: [new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' })] }),
            ],
          }),
          new TableCell({
            width: { size: 50, type: WidthType.PERCENTAGE },
            borders: createBorder(color, 4),
            children: [
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 120 }, children: [new TextRun({ text: `${pi.evaluatorRole || 'مدير المدرسة'}:`, font: 'Cairo', size: 22, bold: true, color })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 100 }, children: [new TextRun({ text: `أ/ ${pi.evaluator || '..........................'}`, font: 'Cairo', size: 20, color: pi.evaluator ? '333333' : '999999' })] }),
              new Paragraph({ alignment: AlignmentType.CENTER, spacing: { before: 160, after: 120 }, children: [new TextRun({ text: 'التوقيع: ..........................', font: 'Cairo', size: 20, color: '999999' })] }),
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
    sections: [
      // صفحة الغلاف
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
            margin: { top: 720, right: 720, bottom: 600, left: 720 },
          },
        },
        footers: { default: buildFooter(color) },
        children: coverChildren,
      },
      // صفحات البنود
      ...contentSections,
      // صفحة التوقيعات
      {
        properties: {
          page: {
            size: { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT },
            margin: { top: 400, right: 720, bottom: 600, left: 720 },
          },
        },
        headers: { default: buildHeaderElement(color) },
        footers: { default: buildFooter(color) },
        children: signChildren,
      },
    ],
  });
}

// ===== Main export function =====
export async function renderStructuredDocx(data: DocxExportData): Promise<Buffer> {
  const validated = validateStructuredDocxData(data);
  const doc = validated.mode === 'single'
    ? buildSingleEvidenceDoc(validated)
    : buildFullReportDoc(validated);

  const buffer = await Packer.toBuffer(doc);
  return Buffer.from(buffer);
}

// ===== Legacy: keep old function for backward compatibility =====
export async function renderHtmlToDocx(htmlContent: string): Promise<Buffer> {
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

    await page.setContent(fullHtml, { waitUntil: "load", timeout: 60000 });
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
  const imageBuffer = validateDocxImageInput(imageBase64, canvasWidth, canvasHeight);

  const a4WidthPt = 595;
  const a4HeightPt = 842;

  let imgWidth = a4WidthPt;
  let imgHeight = a4HeightPt;

  if (canvasWidth && canvasHeight) {
    const aspectRatio = canvasHeight / canvasWidth;
    imgHeight = Math.round(imgWidth * aspectRatio);

    if (imgHeight > a4HeightPt * 1.5) {
      imgWidth = a4WidthPt;
      imgHeight = Math.round(imgWidth * aspectRatio);
    }
  }

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

const DOCX_PNG_SIGNATURE = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
const DOCX_MAX_IMAGE_BYTES = 6 * 1024 * 1024;
const DOCX_MAX_IMAGE_DIMENSION = 1_600;
const DOCX_MAX_IMAGE_PIXELS = 1_000_000;

const docxPngCrcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  return crc >>> 0;
});

function docxPngCrc32(bytes: Buffer): number {
  let crc = 0xffffffff;
  for (let index = 0; index < bytes.length; index++) {
    const byte = bytes[index];
    crc = docxPngCrcTable[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

/**
 * Check the complete PNG container before invoking pngjs. This preflight is
 * important because a valid signature/IHDR does not prove that chunks fit in
 * the input or that their CRCs and compressed raster are safe to decode.
 */
function validateBoundedDocxPng(imageBuffer: Buffer): { width: number; height: number } {
  if (imageBuffer.length < 33 || imageBuffer.length > DOCX_MAX_IMAGE_BYTES || !imageBuffer.subarray(0, 8).equals(DOCX_PNG_SIGNATURE)) {
    throw new Error("Invalid DOCX PNG image");
  }

  let offset = 8;
  let chunkCount = 0;
  let width = 0;
  let height = 0;
  let sawHeader = false;
  let sawImageData = false;
  let sawEnd = false;
  while (offset < imageBuffer.length) {
    if (++chunkCount > 128 || offset + 12 > imageBuffer.length) throw new Error("Invalid DOCX PNG chunks");
    const length = imageBuffer.readUInt32BE(offset);
    const end = offset + 12 + length;
    if (end > imageBuffer.length) throw new Error("Invalid DOCX PNG chunk length");
    const type = imageBuffer.toString("ascii", offset + 4, offset + 8);
    const body = imageBuffer.subarray(offset + 8, end - 4);
    if (docxPngCrc32(imageBuffer.subarray(offset + 4, end - 4)) !== imageBuffer.readUInt32BE(end - 4)) {
      throw new Error("Invalid DOCX PNG checksum");
    }
    if (sawEnd) throw new Error("Invalid DOCX PNG trailing data");

    if (type === "IHDR") {
      if (sawHeader || chunkCount !== 1 || length !== 13) throw new Error("Invalid DOCX PNG header");
      sawHeader = true;
      width = body.readUInt32BE(0);
      height = body.readUInt32BE(4);
      const bitDepth = body[8];
      const colorType = body[9];
      if (!width || !height || width > DOCX_MAX_IMAGE_DIMENSION || height > DOCX_MAX_IMAGE_DIMENSION
        || width * height > DOCX_MAX_IMAGE_PIXELS || bitDepth !== 8 || ![0, 2, 3, 4, 6].includes(colorType)
        || body[10] !== 0 || body[11] !== 0 || body[12] !== 0) {
        throw new Error("Unsupported DOCX PNG dimensions or encoding");
      }
    } else {
      if (!sawHeader) throw new Error("Missing DOCX PNG header");
      if (type === "IDAT") sawImageData = true;
      else if (type === "IEND") {
        if (length !== 0 || !sawImageData || end !== imageBuffer.length) throw new Error("Invalid DOCX PNG end");
        sawEnd = true;
      } else if (/^[A-Z]/.test(type) && !["PLTE", "tRNS"].includes(type)) {
        throw new Error("Unsupported DOCX PNG format");
      }
    }
    offset = end;
  }
  if (!sawHeader || !sawImageData || !sawEnd) throw new Error("Incomplete DOCX PNG");
  return { width, height };
}

function validateDocxCanvasDimension(value: unknown): asserts value is number | undefined {
  if (value !== undefined && (typeof value !== "number" || !Number.isFinite(value) || !Number.isSafeInteger(value)
    || value < 1 || value > DOCX_MAX_IMAGE_DIMENSION)) throw new Error("Invalid DOCX canvas dimensions");
}

/**
 * Legacy image export only emits PNG ImageRun data. Accept strict canonical
 * base64 with an exact PNG MIME, fully validate the PNG, and pass only the
 * bounded metadata-free PNG returned by the existing evidence sanitizer to
 * ImageRun. No header-only or truncated image is accepted.
 */
export function validateDocxImageInput(imageBase64: unknown, canvasWidth?: unknown, canvasHeight?: unknown): Buffer {
  if (typeof imageBase64 !== "string" || imageBase64.length > 1_400_000) throw new Error("Invalid DOCX image payload");
  const raw = imageBase64.match(/^data:(image\/png);base64,([A-Za-z0-9+/]+={0,2})$/);
  const base64Data = raw ? raw[2] : imageBase64;
  if (!/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(base64Data)
    || base64Data.length % 4 !== 0) throw new Error("Invalid DOCX image encoding");
  const imageBuffer = Buffer.from(base64Data, "base64");
  if (imageBuffer.toString("base64") !== base64Data) throw new Error("Invalid DOCX image encoding");
  const dimensions = validateBoundedDocxPng(imageBuffer);
  validateDocxCanvasDimension(canvasWidth);
  validateDocxCanvasDimension(canvasHeight);
  if (canvasWidth !== undefined && canvasHeight !== undefined && canvasWidth * canvasHeight > DOCX_MAX_IMAGE_PIXELS) {
    throw new Error("DOCX canvas dimensions exceed the pixel limit");
  }

  const sanitized = sanitizeEvidenceImage(imageBuffer, "image/png");
  if (sanitized.width !== dimensions.width || sanitized.height !== dimensions.height || sanitized.bytes.length > DOCX_MAX_IMAGE_BYTES) {
    throw new Error("Invalid DOCX sanitized PNG");
  }
  return sanitized.bytes;
}
