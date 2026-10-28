import { spawn } from "node:child_process";
import {
  BoundedTaskQueue,
  requireActive,
  ResourceLimitError,
} from "./bounded-work";

export const RENDER_LIMITS = Object.freeze({
  active: 2,
  queued: 4,
  htmlBytes: 16 * 1024 * 1024,
  pdfBytes: 64 * 1024 * 1024,
  pdfPages: 80,
  pdfTimeoutMs: 60_000,
  visualDocxPages: 20,
  visualDocxImageBytes: 40 * 1024 * 1024,
  rasterPageBytes: 8 * 1024 * 1024,
  docxTimeoutMs: 90_000,
});
const renderQueue = new BoundedTaskQueue(
  RENDER_LIMITS.active,
  RENDER_LIMITS.queued
);

export function withDocumentRenderBudget<T>(
  operation: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number = RENDER_LIMITS.pdfTimeoutMs
) {
  return renderQueue.run(operation, timeoutMs);
}

/** Fixed native commands, no shell, bounded memory/CPU/output/files and an
 * abortable child. Settlement waits for close, including after cancellation, so
 * queue capacity is not released while a cancelled parser still runs. */
export function runPoppler(
  binary: "pdfinfo" | "pdftoppm",
  args: string[],
  signal: AbortSignal
): Promise<string> {
  requireActive(signal);
  return new Promise((resolve, reject) => {
    const child = spawn(
      "/usr/bin/prlimit",
      [
        "--as=536870912",
        "--cpu=20",
        "--nofile=64",
        `--fsize=${RENDER_LIMITS.rasterPageBytes}`,
        "--",
        binary,
        ...args,
      ],
      {
        stdio: ["ignore", "pipe", "pipe"],
        env: { ...process.env, LC_ALL: "C" },
      }
    );
    let failure: Error | undefined,
      stdout = "",
      outputBytes = 0;
    const stop = (error: Error) => {
      failure ??= error;
      child.kill("SIGKILL");
    };
    const abort = () =>
      stop(new ResourceLimitError("Document rendering timed out", 504));
    const timer = setTimeout(abort, 30_000);
    signal.addEventListener("abort", abort, { once: true });
    const output = (chunk: Buffer, retain: boolean) => {
      outputBytes += chunk.length;
      if (outputBytes > 64 * 1024) {
        stop(new Error("Document parser exceeded the output limit"));
        return;
      }
      if (retain) stdout += chunk.toString("utf8");
    };
    child.stdout.on("data", chunk => output(chunk, true));
    child.stderr.on("data", chunk => output(chunk, false));
    child.once("error", () => {
      failure ??= new Error("Document parser is unavailable");
    });
    child.once("close", code => {
      clearTimeout(timer);
      signal.removeEventListener("abort", abort);
      if (failure || code !== 0)
        reject(
          failure ?? new Error("Document parser rejected the generated output")
        );
      else resolve(stdout);
    });
    if (signal.aborted) abort();
  });
}

export function pdfPageCount(info: string, maximum: number): number {
  const match = /^Pages:\s+(\d+)\s*$/m.exec(info);
  const pages = Number(match?.[1]);
  if (!Number.isSafeInteger(pages) || pages < 1)
    throw new Error("Unable to verify generated document page count");
  if (pages > maximum)
    throw new ResourceLimitError("Document exceeds the page limit", 413);
  return pages;
}
