import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import puppeteer from "puppeteer";
import { renderReportWorkVersionHtml } from "../server/work-version-report-renderer";
import { renderReportWorkVersionDocx } from "../server/work-version-docx-renderer";
import { closeBrowser, renderHtmlToPdf } from "../server/pdf-renderer";
import { comparableText, inspectNativeDocx } from "./output-acceptance-helpers";

// Synthetic reports only. Check real rendered positions, not a particular HTML
// tag: direction=ltr alone reverses AN-class Arabic-Indic numeric ranges.
const directory = resolve(process.argv[2] || "qa-artifacts/report-numerals");
await mkdir(directory, { recursive: true });
const browser = await puppeteer.launch({ headless: true, args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"] });
const results: Array<Record<string, unknown>> = [];
try {
  const page = await browser.newPage();
  await page.setJavaScriptEnabled(false);
  await page.setRequestInterception(true);
  page.on("request", request => { void (request.url().startsWith("data:") || request.url() === "about:blank" ? request.continue() : request.abort()).catch(() => {}); });
  for (const [name, yearLabel] of [["latin", "1448–1449"], ["arabic-indic", "١٤٤٨–١٤٤٩"], ["persian", "۱۴۴۸–۱۴۴۹"]]) {
    const snapshot = {
      kind: "report", work: { title: "تقرير التحقق من اتجاه العام الدراسي" }, capturedAt: "2026-11-10T00:00:00Z",
      academicContext: { yearLabel, termLabel: "الفصل الدراسي الأول" },
      reportDraft: { fontFamily: "Cairo", fields: { summary: "تقرير اصطناعي للتحقق من حفظ ترتيب الأرقام في النسخة القابلة للطباعة." } },
    };
    const html = renderReportWorkVersionHtml(snapshot, 1);
    await page.setContent(`<html dir="rtl"><body>${html}</body></html>`, { waitUntil: "domcontentloaded" });
    await page.evaluate(() => document.fonts.ready);
    const position = await page.evaluate(rangeText => {
      const walker = document.createTreeWalker(document.querySelector(".report-cover")!, NodeFilter.SHOW_TEXT);
      let node: Node | null;
      while ((node = walker.nextNode())) {
        const offset = node.textContent!.indexOf(rangeText);
        if (offset < 0) continue;
        const range = document.createRange();
        range.setStart(node, offset); range.setEnd(node, offset + 4);
        const first = range.getBoundingClientRect();
        range.setStart(node, offset + 5); range.setEnd(node, offset + 9);
        const last = range.getBoundingClientRect();
        return { firstX: first.x, firstRight: first.right, lastX: last.x };
      }
      throw new Error("Academic-year range is missing from the cover");
    }, yearLabel);
    assert.ok(position.firstX < position.lastX && position.firstRight <= position.lastX, `${name}: academic-year endpoints are reversed on the rendered cover`);
    await page.screenshot({ path: resolve(directory, `${name}-cover.png`), fullPage: true });
    const pdfPath = resolve(directory, `${name}.pdf`);
    await writeFile(pdfPath, await renderHtmlToPdf(html));
    const extracted = execFileSync("pdftotext", ["-enc", "UTF-8", pdfPath, "-"], { encoding: "utf8" });
    assert.ok(comparableText(extracted).includes(yearLabel), `${name}: PDF numeric range changed order`);
    const docx = await renderReportWorkVersionDocx(snapshot, 1);
    await writeFile(resolve(directory, `${name}.docx`), docx);
    assert.ok(comparableText((await inspectNativeDocx(docx)).text).includes(yearLabel), `${name}: native Word numeric range changed`);
    results.push({ name, yearLabel, ...position, nativeDocxText: true, pdfTextOrder: true });
  }
  await writeFile(resolve(directory, "acceptance.json"), JSON.stringify({ passed: true, synthetic: true, scope: "Actual Chromium positions and PDF text order; native DOCX text. Microsoft Word application is a separate acceptance gate.", results }, null, 2) + "\n");
} finally {
  await browser.close();
  await closeBrowser();
}
console.log(`Verified Latin, Arabic-Indic and Persian report ranges: ${directory}`);
