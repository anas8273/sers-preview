/** Disposable runtime probe: actual non-root Chromium, Poppler and visual DOCX.
 * No evidence/output database row or private object is created. */
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import mysql from "mysql2/promise";
import JSZip from "jszip";
import { closeBrowser, renderHtmlToDocxPuppeteer, renderHtmlToPdf } from "../../server/pdf-renderer";
import { pdfPageCount, runPoppler } from "../../server/render-limits";

async function main() {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.SERS_OUTPUT_RUNTIME_PROBE !== "disposable-ci-only" || process.env.NODE_ENV !== "production" || process.env.SERS_DATABASE_NAME !== "sers_demo" || process.getuid?.() !== 10001 || Number(process.versions.node.split(".")[0]) !== 22) {
    throw new Error("Output runtime verification requires the isolated non-root CI image");
  }
  const database = new URL(process.env.DATABASE_URL ?? "");
  if (database.protocol !== "mysql:" || database.pathname !== "/sers_demo") throw new Error("Disposable database configuration required");
  const connection = await mysql.createConnection({ uri: database.href, connectTimeout: 5000 });
  try {
    const [rows] = await connection.query<mysql.RowDataPacket[]>({ sql: "SELECT DATABASE() AS name, VERSION() AS version", timeout: 5000 });
    if (rows[0]?.name !== "sers_demo" || !/^8\.4\./.test(rows[0]?.version)) throw new Error("Disposable database identity required");
  } finally { await connection.end(); }

  const directory = await mkdtemp(path.join(os.tmpdir(), "sers-output-runtime-"));
  try {
    const html = '<main style="padding:20mm;font-family:Arial;font-size:16px"><h1>اختبار تشغيل اصطناعي</h1><p>تحقق من PDF وWord داخل الحاوية دون بيانات شخصية.</p><p>Runtime probe 2026–2027</p></main>';
    const pdf = await renderHtmlToPdf(html);
    assert.equal(pdf.subarray(0, 5).toString("ascii"), "%PDF-");
    const pdfPath = path.join(directory, "probe.pdf");
    await writeFile(pdfPath, pdf, { mode: 0o600 });
    const pages = pdfPageCount(await runPoppler("pdfinfo", [pdfPath], AbortSignal.timeout(30_000)), 1);
    const word = await renderHtmlToDocxPuppeteer(html);
    const zip = await JSZip.loadAsync(word, { checkCRC32: true });
    const images = Object.keys(zip.files).filter(name => /^word\/media\/[^/]+\.png$/.test(name));
    assert.equal(images.length, 1);
    const png = await zip.file(images[0])!.async("nodebuffer");
    assert.ok(png.length > 1000 && png.length <= 8 * 1024 * 1024);
    assert.deepEqual(png.subarray(0, 8), Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    assert.ok(png.readUInt32BE(16) > 0 && png.readUInt32BE(16) <= 2200 && png.readUInt32BE(20) > 0 && png.readUInt32BE(20) <= 2200);
    const document = await zip.file("word/document.xml")!.async("string");
    assert.equal((document.match(/<w:drawing>/g) ?? []).length, 1);
    console.log(JSON.stringify({ passed: true, synthetic: true, uid: process.getuid!(), nodeMajor: 22, actualChromiumPdf: true, actualPopplerVisualWord: true, pdfPages: pages, wordImageParts: images.length, privateDataWritten: false }));
  } finally {
    try { await closeBrowser(); }
    finally { await rm(directory, { recursive: true, force: true }); }
  }
}

main().catch(() => { console.error("Disposable output runtime verification failed"); process.exitCode = 1; });
