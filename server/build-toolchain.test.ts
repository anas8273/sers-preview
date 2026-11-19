import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const pkg = JSON.parse(readFileSync(resolve("package.json"), "utf8"));
const docker = readFileSync(resolve("Dockerfile"), "utf8");
const npmrc = readFileSync(resolve(".npmrc"), "utf8");
const workspace = readFileSync(resolve("pnpm-workspace.yaml"), "utf8");
describe("locked build toolchain", () => {
  it("uses the same pnpm in the container and includes the workspace policy", () => {
    expect(docker).toContain(pkg.packageManager);
    expect(pkg.packageManager).toBe("pnpm@10.34.9");
    expect(pkg.engines.pnpm).toBe("10.34.9");
    expect(pkg.devDependencies.pnpm).toBe("10.34.9");
    expect(npmrc).toContain("manage-package-manager-versions=true");
    expect(docker).toContain("pnpm-workspace.yaml");
    expect(docker).not.toContain("--ignore-scripts");
    expect(docker).toContain("COPY scripts/install-browser.mjs");
    expect(workspace).toContain("onlyBuiltDependencies:");
    expect(workspace).toContain("- esbuild");
    expect(workspace).toContain("- '@tailwindcss/oxide'");
    expect(workspace).toContain("ignoredBuiltDependencies:");
    expect(workspace).toContain("- puppeteer");
  });
  it("pins the patched Vitest line and exposes supported serial worker controls", () => {
    expect(pkg.devDependencies.vitest).toBe("4.1.12");
    expect(JSON.parse(readFileSync(resolve("node_modules/vite/package.json"), "utf8")).version).toBe("7.3.7");
    const help = execFileSync("pnpm", ["exec", "vitest", "--help"], { encoding: "utf8" });
    expect(help).toContain("--maxWorkers");
    expect(help).toContain("--fileParallelism");
    expect(help).not.toContain("--minWorkers");
  });
  it("skips only the explicit browser download rather than all lifecycle scripts", () => {
    expect(pkg.scripts.postinstall).toBe("node scripts/install-browser.mjs");
    const output = execFileSync(process.execPath, [resolve("scripts/install-browser.mjs")], { encoding: "utf8", env: { ...process.env, PUPPETEER_SKIP_DOWNLOAD: "true" } });
    expect(output).toContain("lifecycle scripts remain enabled");
  });
});
