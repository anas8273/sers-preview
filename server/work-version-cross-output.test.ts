import { describe, expect, it } from "vitest";
import { PNG } from "pngjs";
import { renderReportWorkVersionDocx } from "./work-version-docx-renderer";
import { renderReportWorkVersionHtml } from "./work-version-report-renderer";
import { createGoldenWorkVersionSnapshot } from "../tests/fixtures/work-version-golden";
import { comparableText, decodeQrPng, inspectNativeDocx } from "../scripts/output-acceptance-helpers";

describe("cross-output immutable report acceptance", () => {
  it("digitally decodes the actual embedded Word QR and retains editable Arabic fields/table", async () => {
    const snapshot = createGoldenWorkVersionSnapshot();
    const before = JSON.stringify(snapshot);
    const inspected = await inspectNativeDocx(await renderReportWorkVersionDocx(snapshot, 7));
    expect(inspected.decodedQr).toEqual([snapshot.shareReference.url]);
    expect(inspected.nativeTables).toBe(1);
    expect(inspected.imageCount).toBe(3);
    for (const content of Object.values(snapshot.reportDraft.fields)) expect(comparableText(inspected.text)).toContain(comparableText(content));
    expect(JSON.stringify(snapshot)).toBe(before);
    const blank = new PNG({ width: 256, height: 256 }); blank.data.fill(255);
    expect(decodeQrPng(PNG.sync.write(blank))).toBeNull();
  });

  it("preserves full long text and selected inline media without interpreting source URLs", () => {
    const snapshot = createGoldenWorkVersionSnapshot();
    snapshot.reportDraft.fields.summary = `${snapshot.reportDraft.fields.summary.repeat(8)}\nB09LONGTAIL`;
    Object.assign(snapshot.assets[0], { storageKey: "private/never-export", externalUrl: "https://private.invalid/never-fetch" });
    const html = renderReportWorkVersionHtml(snapshot, 7);
    expect(html).toContain("B09LONGTAIL");
    expect(html).toContain("<thead>");
    expect(html.match(/src="data:image\/png;base64,/g)).toHaveLength(2);
    expect(html).toContain(snapshot.shareReference.url);
    expect(html).not.toContain("private/never-export");
    expect(html).not.toContain("private.invalid");
    // Actual PDF pagination/text bounds and QR raster decoding run in the
    // browser-backed acceptance script; source assertions alone are not that gate.
  });

  it("rejects malformed frozen media and invalid QR references in PDF too", () => {
    const snapshot = createGoldenWorkVersionSnapshot();
    snapshot.assets[0].preview!.dataBase64 = Buffer.from("not a PNG").toString("base64");
    expect(() => renderReportWorkVersionHtml(snapshot, 7)).toThrow();
    const invalidQr = createGoldenWorkVersionSnapshot();
    invalidQr.shareReference.url = "file:///etc/passwd";
    expect(() => renderReportWorkVersionHtml(invalidQr, 7)).toThrow(/share reference/);
  });
});
