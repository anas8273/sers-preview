import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = readFileSync(resolve(process.cwd(), "client/src/App.tsx"), "utf8");
const publicOutputSource = readFileSync(resolve(process.cwd(), "client/src/pages/PublicOutput.tsx"), "utf8");
const shareActionsSource = readFileSync(resolve(process.cwd(), "client/src/components/ReportShareActions.tsx"), "utf8");

describe("public WorkVersion output UI", () => {
  it("routes public outputs before authenticated workspace routes and hides workspace chrome", () => {
    expect(appSource).toContain('<Route path={"/output/:token"} component={PublicOutput} />');
    expect(appSource.indexOf('/output/:token')).toBeLessThan(appSource.indexOf('<Route path={"/"}'));
    expect(appSource).toContain('if (location.startsWith("/output/")) return null');
  });

  it("resolves public output data through the constrained public router", () => {
    expect(publicOutputSource).toContain("trpc.publicOutput.resolve.useMutation");
    expect(publicOutputSource).toContain("resolveMutation.mutateAsync({ token");
    expect(publicOutputSource).not.toContain("dangerouslySetInnerHTML");
    expect(publicOutputSource).not.toContain("externalUrl");
    expect(publicOutputSource).not.toContain("storageKey");
    expect(publicOutputSource).not.toContain("ownerOrganizationId");
  });

  it("uses a password field without persisting the password in browser storage", () => {
    expect(publicOutputSource).toContain('type="password"');
    expect(publicOutputSource).toContain('autoComplete="current-password"');
    expect(publicOutputSource).not.toContain("localStorage");
    expect(publicOutputSource).not.toContain("sessionStorage");
  });

  it("renders only safe report fields and evidence summaries with React escaping", () => {
    expect(publicOutputSource).toContain("data.report.fields.map");
    expect(publicOutputSource).toContain("data.report.evidence.map");
    expect(publicOutputSource).toContain("لا يعرض هذا المسار الملفات الأصلية");
  });
});

describe("report share creation UI", () => {
  it("creates shares through the scrypt-protected share router", () => {
    expect(shareActionsSource).toContain("trpc.shareOutput.create.useMutation");
    expect(shareActionsSource).not.toContain("trpc.domain.output.create.useMutation");
  });

  it("requires immutable versions and exposes expiry, password, QR, and revoke controls", () => {
    expect(shareActionsSource).toContain("reviewSupport.versions.useQuery");
    expect(shareActionsSource).toContain('visibility === "protected" ? password : undefined');
    expect(shareActionsSource).toContain("expiresAt:");
    expect(shareActionsSource).toContain("QRCode.toDataURL");
    expect(shareActionsSource).toContain("domain.output.revoke.useMutation");
  });

  it("builds public URLs only from opaque output tokens", () => {
    expect(shareActionsSource).toContain("/output/${created.token}");
    expect(shareActionsSource).not.toContain("storageKey");
    expect(shareActionsSource).not.toContain("ownerUserId");
  });
});
