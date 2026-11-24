import { createRequire } from "node:module";
import { dirname, resolve } from "node:path";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";

if (["true", "1"].includes(process.env.PUPPETEER_SKIP_DOWNLOAD ?? "")) {
  console.log("Browser download skipped by explicit PUPPETEER_SKIP_DOWNLOAD; lifecycle scripts remain enabled.");
} else {
  const require = createRequire(import.meta.url);
  const manifestPath = require.resolve("puppeteer/package.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  const bin = typeof manifest.bin === "string" ? manifest.bin : manifest.bin?.puppeteer;
  if (typeof bin !== "string" || !bin) throw new Error("The locked Puppeteer package does not declare its CLI");
  const result = spawnSync(process.execPath, [resolve(dirname(manifestPath), bin), "browsers", "install", "chrome"], { stdio: "inherit", env: process.env });
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
}
