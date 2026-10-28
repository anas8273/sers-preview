import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { mkdir, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderReportWorkVersionDocx } from "../server/work-version-docx-renderer";
import { renderReportWorkVersionHtml } from "../server/work-version-report-renderer";
import { closeBrowser, renderHtmlToPdf } from "../server/pdf-renderer";
import { createGoldenWorkVersionSnapshot } from "../tests/fixtures/work-version-golden";
import { comparableText, decodeQrPng, inspectNativeDocx, plainXml } from "./output-acceptance-helpers";

// Requires installed Puppeteer Chrome, Poppler (pdfinfo/pdftotext/pdftoppm),
// and an Arabic font. Exports synthetic fixtures only; never connects to a DB.
const directory = resolve(process.argv[2] || "qa-artifacts/work-version-outputs");
await mkdir(directory, { recursive: true });
const hash = (bytes: string | Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const arabicCount = (value: string) => (value.match(/[\u0621-\u064a]/g) ?? []).length;
const base = createGoldenWorkVersionSnapshot();
const stress = createGoldenWorkVersionSnapshot();
const markers: string[] = [];
const paragraph = base.reportDraft.fields.summary.split("\n")[0];
stress.reportDraft.fields.summary = Array.from({ length: 24 }, (_, index) => {
  const marker = `B09LONG${String(index + 1).padStart(3, "0")}`;
  markers.push(marker); return `${paragraph}\n${marker}`;
}).join("\n");
for (const [index, asset] of stress.assets.entries()) {
  const marker = `B09EVIDENCE${String(index + 1).padStart(3, "0")}`;
  markers.push(marker);
  asset.caption = `${asset.caption.repeat(index === 0 ? 12 : 1)} ${marker}`;
}
stress.reportDraft.fields.recommendations += "\nB09FINALFIELD";
markers.push("B09FINALFIELD");
const manifest: Record<string, unknown> = {
  fixture: "synthetic immutable Arabic WorkVersion", version: 7,
  scope: "Digital QR decoding, native document text/table checks, rendered PDF text retention and page bounds. No physical-camera or Microsoft Word application test is claimed.",
  pdfGenerator: "production renderReportWorkVersionHtml + renderHtmlToPdf",
  checks: {}, artifacts: [], status: "running",
};
const artifacts: Array<Record<string, unknown>> = [];
const checks: Record<string, unknown> = {};
try {
  for (const [name, snapshot, expectedMarkers] of [["golden", base, []], ["long-rtl", stress, markers]] as const) {
    const frozen = JSON.stringify(snapshot);
    const docx = await renderReportWorkVersionDocx(snapshot, 7);
    const inspected = await inspectNativeDocx(docx);
    assert.deepEqual(inspected.decodedQr, [snapshot.shareReference.url], `${name}: embedded DOCX QR must decode to the frozen URL`);
    assert.equal(inspected.nativeTables, 1);
    assert.equal(inspected.imageCount, 3);
    for (const field of Object.values(snapshot.reportDraft.fields)) assert.ok(comparableText(inspected.text).includes(comparableText(field)), `${name}: editable DOCX field missing`);
    assert.deepEqual(await renderReportWorkVersionDocx(snapshot, 7), docx, `${name}: DOCX bytes changed on retry`);
    const html = renderReportWorkVersionHtml(snapshot, 7);
    assert.equal(JSON.stringify(snapshot), frozen, "Renderer mutated the source snapshot");
    await writeFile(resolve(directory, `${name}.docx`), docx);
    await writeFile(resolve(directory, `${name}.html`), html);
    await writeFile(resolve(directory, `${name}-snapshot.json`), `${frozen}\n`);
    artifacts.push({ name: `${name}.docx`, bytes: docx.length, sha256: hash(docx) });
    checks[name] = { stage: "word-passed", snapshotSha256: hash(frozen), docxQrDecoded: inspected.decodedQr };
    const pdf = await renderHtmlToPdf(html);
    const pdfName = `${name}.pdf`, pdfPath = resolve(directory, pdfName);
    await writeFile(pdfPath, pdf);
    const extracted = execFileSync("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], { encoding: "utf8", maxBuffer: 8 * 1024 * 1024 });
    await writeFile(resolve(directory, `${name}-text.txt`), extracted);
    for (const marker of expectedMarkers) assert.ok(extracted.includes(marker), `${name}: clipped paragraph or table row ${marker}`);
    const sourceArabic = arabicCount(Object.values(snapshot.reportDraft.fields).join(" "));
    assert.ok(arabicCount(extracted) >= sourceArabic * 0.98, `${name}: Arabic text extraction lost report content`);
    const bbox = execFileSync("pdftotext", ["-bbox-layout", "-enc", "UTF-8", pdfPath, "-"], { encoding: "utf8", maxBuffer: 16 * 1024 * 1024 });
    await writeFile(resolve(directory, `${name}-bounds.xhtml`), bbox);
    const pages = Array.from(bbox.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g));
    assert.ok(pages.length > 1, `${name}: expected a multipage PDF`);
    let words = 0, lines = 0;
    for (const [pageIndex, page] of pages.entries()) {
      const width = Number(page[1]), height = Number(page[2]);
      assert.ok(Math.abs(width - 595.28) < 2 && Math.abs(height - 841.89) < 2, "PDF page must be A4");
      lines += (page[3].match(/<line /g) ?? []).length;
      for (const word of page[3].matchAll(/<word xMin="([\d.-]+)" yMin="([\d.-]+)" xMax="([\d.-]+)" yMax="([\d.-]+)">([\s\S]*?)<\/word>/g)) {
        words++;
        const [left, top, right, bottom] = word.slice(1, 5).map(Number);
        assert.ok(left >= 8 && top >= 8 && right <= width - 8 && bottom <= height - 8 && right >= left && bottom >= top,
          `${name}: page ${pageIndex + 1} text exceeds printable bounds: ${plainXml(word[5])}`);
      }
    }
    assert.ok(words > 150 && lines > 20, `${name}: PDF does not contain sufficient native text`);
    const imageList = execFileSync("pdfimages", ["-list", pdfPath], { encoding: "utf8" });
    assert.ok((imageList.match(/^\s*\d+\s+\d+\s+image\s/gm) ?? []).length >= 2, `${name}: embedded evidence previews missing`);
    await writeFile(resolve(directory, `${name}-images.txt`), imageList);
    for (const old of (await readdir(directory)).filter(file => new RegExp(`^${name}-page-[0-9]+[.]png$`).test(file))) await rm(resolve(directory, old));
    execFileSync("pdftoppm", ["-png", "-r", "120", pdfPath, resolve(directory, `${name}-page`)], { timeout: 120_000, maxBuffer: 1024 * 1024 });
    const pngs = (await readdir(directory)).filter(file => file.startsWith(`${name}-page-`) && file.endsWith(".png")).sort();
    assert.equal(pngs.length, pages.length, `${name}: missing rendered page`);
    const decodedPages: Array<{ page: string; url: string }> = [];
    for (const png of pngs) {
      const decoded = decodeQrPng(await readFile(resolve(directory, png)));
      if (decoded) decodedPages.push({ page: png, url: decoded });
    }
    assert.deepEqual(decodedPages.map(value => value.url), [snapshot.shareReference.url], `${name}: actual rendered PDF QR failed digital decoding`);
    checks[name] = { snapshotSha256: hash(frozen), pages: pages.length, words, lines, requiredMarkers: expectedMarkers.length, retainedMarkers: expectedMarkers.length,
      arabicSourceLetters: sourceArabic, arabicExtractedLetters: arabicCount(extracted), nativeDocxTable: true, editableDocxText: true,
      docxQrDecoded: inspected.decodedQr, pdfQrDecoded: decodedPages, pageBoundsPassed: true, evidenceImagesPresent: true };
    artifacts.push({ name: pdfName, bytes: pdf.length, sha256: hash(pdf) });
  }
  assert.ok((checks["long-rtl"] as { pages: number }).pages > (checks.golden as { pages: number }).pages, "Long content did not paginate beyond the golden report");
  manifest.status = "passed";
} catch (error) {
  manifest.status = "failed";
  manifest.error = error instanceof Error ? error.message : String(error);
  throw error;
} finally {
  manifest.checks = checks; manifest.artifacts = artifacts;
  await writeFile(resolve(directory, "acceptance.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await closeBrowser();
}
console.log(`Verified immutable PDF/Word/QR outputs; synthetic artifacts: ${directory}`);
