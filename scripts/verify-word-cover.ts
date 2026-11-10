import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import JSZip from "jszip";
import { comparableText, plainXml } from "./output-acceptance-helpers";

// Run after verify-report-identity.ts. This adds a real Writer layout check to
// the native OOXML checks; it is not a Microsoft Word application acceptance.
const source = resolve(process.argv[2] || "qa-artifacts/work-version-outputs/identity/noto-kufi-arabic.docx");
const directory = resolve(process.argv[3] || "qa-artifacts/word-cover-layout");
await mkdir(directory, { recursive: true });
const profile = await mkdtemp(join(tmpdir(), "sers-word-cover-"));
try {
  const archive = await JSZip.loadAsync(await readFile(source));
  const core = await archive.file("docProps/core.xml")!.async("string");
  const title = plainXml(core.match(/<dc:title>([\s\S]*?)<\/dc:title>/)?.[1] || "");
  assert.ok(title.length > 180, "The cover acceptance fixture must exercise a long title");
  const header = plainXml(await archive.file("word/header1.xml")!.async("string"));
  assert.ok(Array.from(header).length <= 64 && header.endsWith("…"), "Running header must be bounded without truncating the cover title");
  execFileSync("soffice", [`-env:UserInstallation=${pathToFileURL(profile).href}`, "--headless", "--convert-to", "pdf", "--outdir", directory, source], { timeout: 120_000, stdio: "pipe" });
  const pdf = join(directory, `${basename(source, ".docx")}.pdf`);
  const coverText = execFileSync("pdftotext", ["-f", "1", "-l", "1", "-enc", "UTF-8", pdf, "-"], { encoding: "utf8" });
  // The independently bounded running header above cannot satisfy the complete
  // 255-character title assertion if its actual cover title moves to page 2.
  assert.ok(comparableText(coverText).includes(comparableText(title)), "Full long title must remain on the first cover page");
  for (const label of ["نسخة 7", "٢٨ أكتوبر ٢٠٢٦", "العام الدراسي", "الفصل الدراسي الأول"]) {
    assert.ok(comparableText(coverText).includes(comparableText(label)), `${label} must remain on the first cover page`);
  }
  assert.ok(!comparableText(coverText).includes(comparableText("ملخص التقرير")), "Report content must start after its cover");
  execFileSync("pdftoppm", ["-f", "1", "-singlefile", "-png", "-scale-to", "1400", pdf, join(directory, "cover")], { timeout: 60_000, stdio: "pipe" });
  await writeFile(join(directory, "acceptance.json"), JSON.stringify({ passed: true, synthetic: true, fullTitleOnCover: true,
    contextOnCover: true, runningHeaderCharacters: Array.from(header).length,
    scope: "Actual LibreOffice Writer layout of the long-title Arabic fixture. Microsoft Word remains a separate application acceptance gate." }, null, 2) + "\n");
  console.log(`Verified long Arabic Word cover in Writer: ${directory}`);
} finally { await rm(profile, { recursive: true, force: true }); }
