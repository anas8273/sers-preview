import { createHash } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { renderReportWorkVersionDocx } from "../server/work-version-docx-renderer";

import { createGoldenWorkVersionSnapshot } from "../tests/fixtures/work-version-golden";

const snapshot = createGoldenWorkVersionSnapshot();
const directory = resolve(process.argv[2] || "qa-artifacts/work-version-docx");
await mkdir(directory, { recursive: true });
const bytes = await renderReportWorkVersionDocx(snapshot, 7);
await writeFile(resolve(directory, "arabic-work-version-golden.docx"), bytes);
await writeFile(resolve(directory, "manifest.json"), `${JSON.stringify({ fixture: "synthetic Arabic WorkVersion", version: 7, bytes: bytes.length, sha256: createHash("sha256").update(bytes).digest("hex"), expected: ["editable Arabic text", "mixed Arabic/Latin numbers", "RTL evidence table", "two embedded synthetic previews", "QR", "headers and page-number footer", "explicit section page breaks"] }, null, 2)}\n`);
console.log(`Created Arabic DOCX QA fixture in ${directory}`);
