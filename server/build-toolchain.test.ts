import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const docker = readFileSync(resolve("Dockerfile"), "utf8");
describe("locked build toolchain", () => {
  it("uses the same pnpm in the container and includes the workspace policy", () => {
    expect(docker).toContain(pkg.packageManager);
    expect(docker).toContain("pnpm-workspace.yaml");
    expect(docker).not.toContain("--ignore-scripts");
    expect(docker).toContain("COPY scripts/install-browser.mjs");
  });
  it("skips only the explicit browser download rather than all lifecycle scripts", () => {
    expect(pkg.scripts.postinstall).toBe("node scripts/install-browser.mjs");
    const output = execFileSync(process.execPath, [resolve("scripts/install-browser.mjs")], { encoding: "utf8", env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "true" } });
    expect(output).toContain("lifecycle scripts remain enabled");
  });
});
