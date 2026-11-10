import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import JSZip from "jszip";
import { PNG } from "pngjs";
import { REPORT_FONT_FAMILIES } from "../shared/report-appearance";
import { renderReportWorkVersionDocx } from "../server/work-version-docx-renderer";
import { renderReportWorkVersionHtml } from "../server/work-version-report-renderer";
import { closeBrowser, renderHtmlToPdf } from "../server/pdf-renderer";
import { createGoldenWorkVersionSnapshot } from "../tests/fixtures/work-version-golden";
import { comparableText, decodeQrPng, inspectNativeDocx } from "./output-acceptance-helpers";

// Uses the production renderers, bundled fonts and synthetic school identity.
// Embedded evidence previews below are fixtures, not proof that the current
// upload -> WorkVersion writer freezes previews of users' scanned photographs.
const directory = resolve(process.argv[2] || "qa-artifacts/work-version-outputs/identity");
await mkdir(directory, { recursive: true });
const logo = new PNG({ width: 80, height: 120 });
for (let y = 0; y < logo.height; y++) for (let x = 0; x < logo.width; x++) {
  const offset = (y * logo.width + x) * 4;
  logo.data.set(x > 12 && x < 68 && y > 18 && y < 102 ? [15, 118, 110, 255] : [255, 255, 255, 255], offset);
}
const schoolLogo = PNG.sync.write(logo).toString("base64");
const checks: unknown[] = [];
try {
  for (const [index, family] of REPORT_FONT_FAMILIES.entries()) {
    const base = createGoldenWorkVersionSnapshot();
    const identity = {
      reportIdentityVersion: "1", ministryLogo: "yes", schoolLogoPng: schoolLogo,
      schoolName: "مدرسة المستقبل لتنمية المهارات — مدرسة اختبار اصطناعية",
      reportPreparer: "مريم التجريبية", schoolPrincipal: "خالد التجريبي",
    };
    const snapshot = { ...base,
      work: { title: index === 2 ? "تقرير توثيق المبادرة التعليمية وتنمية المهارات وتحسين جودة الممارسات ".repeat(5).slice(0, 255) : base.work.title },
      reportDraft: { ...base.reportDraft, fontFamily: family, fields: { ...base.reportDraft.fields, ...identity } },
    };
    const name = family.replaceAll(" ", "-").toLowerCase();
    const before = JSON.stringify(snapshot);
    const docx = await renderReportWorkVersionDocx(snapshot, 7);
    const native = await inspectNativeDocx(docx);
    assert.equal(native.imageCount, 5, `${family}: two identity logos, two fixture previews and one QR are required`);
    assert.equal(native.nativeTables, 2, `${family}: evidence and signature tables must remain editable`);
    assert.deepEqual(native.decodedQr, [snapshot.shareReference.url]);
    const archive = await JSZip.loadAsync(docx);
    const xml = await archive.file("word/document.xml")!.async("string");
    assert.ok(xml.includes(`w:cs="${family}"`), `${family}: complex-script font must match the selected font`);
    assert.ok(archive.file("word/fonts/report-regular.odttf"));
    assert.ok(archive.file("word/fonts/report-bold.odttf"));
    const html = renderReportWorkVersionHtml(snapshot, 7);
    const pdf = await renderHtmlToPdf(html);
    const pdfPath = resolve(directory, `${name}.pdf`);
    await writeFile(pdfPath, pdf);
    await writeFile(resolve(directory, `${name}.docx`), docx);
    await writeFile(resolve(directory, `${name}.html`), html);
    const extracted = execFileSync("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], { encoding: "utf8" });
    const visible = [snapshot.work.title, ...Object.values(base.reportDraft.fields), identity.schoolName,
      identity.reportPreparer, identity.schoolPrincipal, "معد التقرير", "مدير المدرسة"];
    for (const value of visible) {
      assert.ok(comparableText(native.text).includes(comparableText(value)), `${family}: editable Word text is missing`);
    }
    // Poppler can reorder Arabic ligature/combining-mark clusters in embedded
    // fonts even when the glyphs render correctly. Do not mistake that for
    // missing document content or claim exact PDF copy/paste fidelity.
    const arabicLetters = (value: string) => (value.match(/[\u0621-\u064a]/g) ?? []).length;
    assert.ok(arabicLetters(extracted) >= arabicLetters(visible.join(" ")) * 0.98,
      `${family}: rendered PDF lost Arabic text`);
    for (const marker of [identity.schoolName, "مريم", "خالد", "معد التقرير", "مدير المدرسة"]) {
      assert.ok(comparableText(extracted).includes(comparableText(marker)), `${family}: PDF identity text is missing: ${marker}`);
    }
    const fonts = execFileSync("pdffonts", [pdfPath], { encoding: "utf8" });
    assert.match(fonts, new RegExp(family.replaceAll(" ", ""), "i"), `${family}: PDF font must be embedded`);
    const bounds = execFileSync("pdftotext", ["-bbox-layout", pdfPath, "-"], { encoding: "utf8" });
    const pages = [...bounds.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)];
    assert.ok(pages.length > 1 && pages.length <= 10, `${family}: unexpected identity report pagination`);
    for (const page of pages) for (const word of page[3].matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">/g)) {
      const [left, top, right, bottom] = word.slice(1).map(Number);
      assert.ok(left >= 8 && top >= 8 && right <= Number(page[1]) - 8 && bottom <= Number(page[2]) - 8,
        `${family}: text extends outside printable A4 bounds`);
    }
    const prefix = resolve(directory, `${name}-page`);
    execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-png", "-scale-to", "1400", pdfPath, `${prefix}-cover`]);
    // The signature and QR sections follow the evidence pages; preserve all
    // pages for visual review, including a long-title cover with Noto Kufi.
    execFileSync("pdftoppm", ["-png", "-scale-to", "1400", pdfPath, prefix]);
    let decoded = 0;
    for (let page = 1; page <= pages.length; page++) {
      const suffix = String(page).padStart(String(pages.length).length, "0");
      const value = decodeQrPng(await readFile(`${prefix}-${suffix}.png`));
      if (value) { assert.equal(value, snapshot.shareReference.url); decoded++; }
    }
    assert.equal(decoded, 1, `${family}: QR in the actual rendered PDF must decode`);
    assert.equal(JSON.stringify(snapshot), before, "Rendering must not change the frozen report");
    checks.push({ font: family, pages: pages.length, logos: 2, nativeWordTables: native.nativeTables,
      editableText: true, pdfFontEmbedded: true, pdfPageBounds: true, digitalQr: true,
      pdfSha256: createHash("sha256").update(pdf).digest("hex"),
      docxSha256: createHash("sha256").update(docx).digest("hex") });
  }
  await writeFile(resolve(directory, "acceptance.json"), JSON.stringify({ status: "passed", checks,
    scope: "Synthetic identity, native editable Word, actual PDF and digital QR. Microsoft Word, physical print and cameras need human acceptance." }, null, 2));
  console.log(`Verified Arabic report identity with all ${checks.length} bundled fonts: ${directory}`);
} finally { await closeBrowser(); }
