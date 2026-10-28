import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { promisify } from "node:util";
import { jsPDF } from "jspdf";
import { PNG } from "pngjs";
import { describe, expect, it } from "vitest";
import { createClamAvUploadScanner } from "./upload-scanner";

// CI must start a real clamd with current signatures and install qpdf + util-linux.
// There is intentionally no mock or skip-on-unavailable path once explicitly enabled.
describe.skipIf(process.env.SERS_SCANNER_INTEGRATION !== "1")("real ClamAV and qpdf acceptance", () => {
  const scanner = () => createClamAvUploadScanner({ host: process.env.SERS_CLAMAV_HOST ?? "127.0.0.1", port: Number(process.env.SERS_CLAMAV_PORT ?? 3310), timeoutMs: 20_000 });
  const pdf = (active = false) => { const doc = new jsPDF(); doc.text("Private evidence acceptance test", 20, 20); if (active) doc.addJS("app.alert('test')"); return Buffer.from(doc.output("arraybuffer")); };

  it("accepts a structurally valid PDF only after a real malware scan", async () => {
    expect(await scanner().scan({ bytes: pdf(), fileName: "evidence.pdf", declaredMimeType: "application/pdf" })).toMatchObject({ status: "clean", mimeType: "application/pdf", engineVersion: expect.stringMatching(/^ClamAV /) });
  }, 30_000);

  it("detects the standard EICAR antivirus test file", async () => {
    const eicar = Buffer.from(["X5O!P%@AP[4\\PZX54(P^)7CC)7}$", "EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*"].join(""));
    expect(await scanner().scan({ bytes: eicar, fileName: "eicar.txt", declaredMimeType: "text/plain" })).toMatchObject({ status: "rejected", reason: "malware_detected" });
  }, 30_000);

  it("rejects malformed, active and encrypted PDF containers", async () => {
    const folder = await mkdtemp(path.join(tmpdir(), "sers-qpdf-acceptance-"));
    try {
      const source = path.join(folder, "source.pdf"), encrypted = path.join(folder, "encrypted.pdf");
      await writeFile(source, pdf(), { mode: 0o600 });
      await promisify(execFile)("/usr/bin/qpdf", ["--encrypt", "user-password", "owner-password", "256", "--", source, encrypted], { timeout: 10_000, maxBuffer: 65_536 });
      for (const bytes of [Buffer.from("%PDF-1.7\nnot a pdf"), pdf(true), await readFile(encrypted)]) {
        expect(await scanner().scan({ bytes, fileName: "unsafe.pdf", declaredMimeType: "application/pdf" })).toMatchObject({ status: "rejected", reason: "invalid_or_active_pdf" });
      }
    } finally { await rm(folder, { recursive: true, force: true }); }
  }, 30_000);

  it("accepts decoded raster and UTF-8 text through the real daemon", async () => {
    const png = new PNG({ width: 2, height: 2 }); png.data.fill(255);
    expect(await scanner().scan({ bytes: PNG.sync.write(png), fileName: "evidence.png", declaredMimeType: "image/png" })).toMatchObject({ status: "clean" });
    expect(await scanner().scan({ bytes: Buffer.from("دليل خاص\nPrivate evidence"), fileName: "evidence.txt", declaredMimeType: "text/plain" })).toMatchObject({ status: "clean" });
  }, 30_000);
});
