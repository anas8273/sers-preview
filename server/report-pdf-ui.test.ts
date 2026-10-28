import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const panelSource = readFileSync(resolve(process.cwd(), "client/src/components/ReportPdfActions.tsx"), "utf8");

describe("report WorkVersion PDF controls", () => {
  it("mounts the PDF action component at the application level while restricting it to report routes", () => {
    expect(appSource).toContain('import ReportPdfActions from "./components/ReportPdfActions"');
    expect(appSource).toContain("<ReportPdfActions />");
    expect(panelSource).toContain('useRoute<{ id: string }>("/work/:id/report")');
    expect(panelSource).toContain("if (!validWorkId) return null");
  });

  it("selects the newest immutable version rather than exporting a mutable draft", () => {
    expect(panelSource).toContain("reviewSupport.versions.useQuery");
    expect(panelSource).toContain("right.versionNumber - left.versionNumber");
    expect(panelSource).toContain("احفظ التقرير ثم أنشئ «نسخة ثابتة» أولًا");
  });

  it("uses only the WorkVersion-bound private PDF APIs", () => {
    expect(panelSource).toContain("domain.output.generatePrivatePdf.useMutation");
    expect(panelSource).toContain("domain.output.downloadPrivatePdf.useMutation");
    expect(panelSource).toContain("workVersionId: latestVersion.id");
    expect(panelSource).not.toContain("/api/export-pdf");
    expect(panelSource).not.toContain("innerHTML");
  });

  it("shows artifact integrity and requires an explicit user download", () => {
    expect(panelSource).toContain("SHA-256:");
    expect(panelSource).toContain('target="_blank"');
    expect(panelSource).toContain('rel="noreferrer"');
    expect(panelSource).toContain("تحديث رابط التنزيل");
  });

  it("explains the private editable copy boundary", () => {
    expect(panelSource).toContain("هذا المخرج خاص");
    expect(panelSource).toContain("لا تغيّر النسخة المحفوظة في النظام");
    expect(panelSource).toContain("Word قابل للتعديل");
    expect(panelSource).toContain("workVersionDocx.generatePrivateDocx.useMutation");
    expect(panelSource).toContain("ReportArtifactSession key={workId}");
  });
});
