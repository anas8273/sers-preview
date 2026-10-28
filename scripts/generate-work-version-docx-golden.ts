import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { deflateSync } from "node:zlib";
import { renderReportWorkVersionDocx } from "../server/work-version-docx-renderer";

// Reproducible synthetic QA fixture. No real student data, external image reads,
// credentials or active share token are used. Run with node --import tsx.
function preview(colors: number[][]) {
  const width = 640, height = 280;
  const pixels = Buffer.alloc(height * (width * 4 + 1));
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const stripe = Math.floor(x / (width / colors.length));
    const inBar = y > 45 + stripe * 25 && y < height - 35 && x % 160 > 20 && x % 160 < 140;
    const color = inBar ? colors[stripe] : [244, 247, 250];
    const offset = y * (width * 4 + 1) + 1 + x * 4;
    pixels.set([...color, 255], offset);
  }
  function chunk(type: string, data: Buffer) {
    const content = Buffer.concat([Buffer.from(type), data]);
    let crc = 0xffffffff;
    for (let i = 0; i < content.length; i++) {
      crc ^= content[i];
      for (let bit = 0; bit < 8; bit++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
    const head = Buffer.alloc(4), tail = Buffer.alloc(4);
    head.writeUInt32BE(data.length); tail.writeUInt32BE((crc ^ 0xffffffff) >>> 0);
    return Buffer.concat([head, content, tail]);
  }
  const header = Buffer.alloc(13); header.writeUInt32BE(width); header.writeUInt32BE(height, 4); header[8] = 8; header[9] = 6;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)), chunk("IEND", Buffer.alloc(0))]).toString("base64");
}

const paragraph = "نفذ فريق المدرسة نشاطًا تدريبيًا لتنمية مهارات القراءة والفهم لدى الطلاب. جُمعت الملاحظات خلال التنفيذ وقورنت النتائج بأهداف النشاط، مع توثيق الشواهد المختارة دون إضافة أي بيانات شخصية. يوضح هذا النص التجريبي سلامة اتصال الحروف العربية، والتفاف السطور، وانتقال الفقرات بين الصفحات مع المحافظة على اتجاه الكتابة من اليمين إلى اليسار.";
const snapshot = {
  schemaVersion: 1, kind: "report", capturedAt: "2026-10-28T05:00:00Z",
  work: { title: "تقرير تنمية مهارات القراءة والفهم" },
  academicContext: { yearLabel: "١٤٤٨ هـ / 2026–2027", termLabel: "الفصل الدراسي الأول" },
  reportDraft: { fontFamily: "Arial", evidenceAssetIds: Array.from({ length: 12 }, (_, i) => i + 1), fields: {
    summary: `${paragraph}\n${paragraph}\n${paragraph}`,
    objectives: "تحسين الفهم القرائي وفق مؤشرات قابلة للقياس.\nمتابعة أثر الأنشطة على ٢٤ مشاركًا في ثلاث مجموعات.\nاختبار النص المختلط: Word 2026 — KPI 78% — المجموعة A / B.",
    audience: "طلاب المرحلة الابتدائية والمعلمون المشاركون في النشاط. جميع الأسماء والأرقام هنا بيانات اصطناعية لفحص جودة المستند.",
    implementation: `${paragraph}\n${paragraph}\n${paragraph}`,
    results: "بلغت نسبة الإكمال التجريبية ٩٢٪، وارتفع المؤشر من 64 إلى 78 نقطة. هذه أرقام توضيحية وليست نتائج لمدرسة حقيقية.",
    impact: "يسمح توثيق الملاحظات بمقارنة التقدم وإعادة تصميم النشاط. تبقى الفقرات والجداول نصًا أصليًا قابلًا للتحرير داخل المستند.",
    recommendations: "مراجعة الشواهد ذات الصلة قبل اعتماد التقرير.\nتكرار القياس في الفترة التالية ومقارنة النتائج مع خط الأساس.",
  } },
  assets: Array.from({ length: 12 }, (_, index) => ({
    id: index + 1, title: `شاهد تجريبي ${index + 1} لتوثيق النشاط`,
    caption: "وصف عربي قابل للتحرير يوضح محتوى الشاهد والغرض من إدراجه في النسخة المعتمدة.",
    ...(index < 2 ? { preview: { mimeType: "image/png", dataBase64: preview(index === 0 ? [[15, 118, 110], [45, 140, 135], [78, 157, 151], [109, 174, 169]] : [[35, 86, 137], [60, 112, 164], [89, 139, 188], [120, 164, 207]]) } } : {}),
  })),
  shareReference: { url: "https://example.invalid/output/fixture_token_not_a_live_link", label: "مرجع المشاركة التجريبي" },
};
const directory = resolve(process.argv[2] || "qa-artifacts/work-version-docx");
await mkdir(directory, { recursive: true });
const bytes = await renderReportWorkVersionDocx(snapshot, 7);
await writeFile(resolve(directory, "arabic-work-version-golden.docx"), bytes);
await writeFile(resolve(directory, "manifest.json"), `${JSON.stringify({ fixture: "synthetic Arabic WorkVersion", version: 7, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: ["editable Arabic text", "mixed Arabic/Latin numbers", "RTL evidence table", "two embedded synthetic previews", "QR", "headers and page-number footer", "explicit section page breaks"] }, null, 2)}\n`);
console.log(`Created Arabic DOCX QA fixture in ${directory}`);
