# WorkVersion PDF Word and QR acceptance

Run the production renderers against synthetic frozen snapshots:

```sh
sudo apt-get update
sudo apt-get install -y poppler-utils fonts-noto-core
node --import tsx scripts/verify-work-version-outputs.ts qa-artifacts/work-version-outputs
```

Puppeteer's Chrome must already be installed. This command needs no database, service credentials or network source images. Publish the output directory as a CI artifact, including on failure. `acceptance.json` records pass/fail, source and artifact hashes, decoded QR payloads, PDF page/line/word counts and text retention checks.

The golden snapshot is shared with the existing six-page Word fixture. The second fixture extends Arabic paragraphs and evidence captions across pages and inserts 37 independent end markers. The gate verifies all markers survive actual PDF rendering, extracts native Arabic text, checks every word box against A4 bounds, requires embedded evidence images, and decodes the actual rendered PDF QR with jsQR. Word checks read native OOXML, compare every field, check editable tables and deterministic bytes, and decode the embedded QR PNG rather than trusting its URL label.

PDF page PNGs are exported for visual inspection; bounding boxes and text checks alone do not prove perfect visual typography. A reviewer must inspect each final PNG before a release claims visual acceptance. PDF bytes can vary with Chromium/font versions and PDF creation timestamps; byte equality is required only for the existing deterministic Word renderer.

No physical-camera test or Microsoft Word application test is claimed. Local Chromium may be blocked by sandbox socket restrictions; that failure is not a passed PDF gate. The previously recorded LibreOffice Word inspection remains in `work-version-docx-qa.md`.

The report-specific PDF renderer uses normal print fragmentation instead of fixed-height clipped pages. PDF renderer revision 2 preserves reading of recognized revision-1 artifacts, while revocation remains effective across renderer revisions for the same immutable version and type.
