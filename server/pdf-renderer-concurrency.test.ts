import { EventEmitter } from "node:events";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
const browserMock = vi.hoisted(() => ({ launch: vi.fn() }));
vi.mock("puppeteer", () => ({ default: browserMock }));
vi.mock("./render-limits", async importOriginal => {
  const actual = await importOriginal<typeof import("./render-limits")>();
  return { ...actual, runPoppler: vi.fn(async () => "Pages: 1\n") };
});

let renderer: typeof import("./pdf-renderer");
let pages: any[], browser: any, onContent: (page: any) => void;
function pageFixture() {
  const page = new EventEmitter() as any;
  Object.assign(page, {
    setJavaScriptEnabled: vi.fn(async () => {}),
    setRequestInterception: vi.fn(async () => {}),
    setViewport: vi.fn(async () => {}),
    setContent: vi.fn(async () => {
      onContent(page);
    }),
    evaluate: vi.fn(async () => {}),
    waitForNetworkIdle: vi.fn(async () => {}),
    pdf: vi.fn(async () => Buffer.from("%PDF-fixture")),
    close: vi.fn(async () => {}),
  });
  return page;
}
beforeEach(async () => {
  vi.resetModules();
  pages = [];
  onContent = () => {};
  browser = new EventEmitter() as any;
  browser.connected = true;
  browser.newPage = vi.fn(async () => {
    const page = pageFixture();
    pages.push(page);
    return page;
  });
  browser.process = vi.fn(() => null);
  browser.close = vi.fn(async () => {
    browser.connected = false;
    browser.emit("disconnected");
  });
  browserMock.launch.mockReset().mockResolvedValue(browser);
  renderer = await import("./pdf-renderer");
});
afterEach(async () => {
  vi.useRealTimers();
  await renderer.closeBrowser();
});

describe("shared Chromium rendering admission and cancellation", () => {
  it("coalesces concurrent browser launches and shares bounded admission with visual Word", async () => {
    let release!: () => void;
    const gate = new Promise<void>(resolve => {
      release = resolve;
    });
    browserMock.launch.mockImplementationOnce(async () => {
      await gate;
      return browser;
    });
    const calls = Array.from({ length: 6 }, () =>
      renderer.renderHtmlToPdf("<p>fixture</p>")
    );
    await expect(
      renderer.renderHtmlToDocxPuppeteer("<p>fixture</p>")
    ).rejects.toMatchObject({ statusCode: 503 });
    expect(browserMock.launch).toHaveBeenCalledTimes(1);
    release();
    await Promise.all(calls);
    expect(browserMock.launch).toHaveBeenCalledTimes(1);
    expect(pages).toHaveLength(6);
    for (const page of pages) expect(page.close).toHaveBeenCalledTimes(1);
  });

  it("clears a failed browser launch so the next request can recover", async () => {
    browserMock.launch.mockRejectedValueOnce(new Error("launch failed"));
    await expect(renderer.renderHtmlToPdf("<p>one</p>")).rejects.toThrow(
      "launch failed"
    );
    await expect(
      renderer.renderHtmlToPdf("<p>two</p>")
    ).resolves.toBeInstanceOf(Buffer);
    expect(browserMock.launch).toHaveBeenCalledTimes(2);
  });

  it("closes a page stuck on fonts when the total deadline expires", async () => {
    vi.useFakeTimers();
    let rejectFonts!: (error: Error) => void;
    onContent = page => {
      page.evaluate.mockImplementation(
        () =>
          new Promise((_resolve, reject) => {
            rejectFonts = reject;
          })
      );
      page.close.mockImplementation(async () => {
        rejectFonts?.(new Error("target closed"));
      });
    };
    const result = renderer.renderHtmlToPdf("<p>stuck</p>");
    const assertion = expect(result).rejects.toMatchObject({ statusCode: 504 });
    await vi.advanceTimersByTimeAsync(60_000);
    await assertion;
    expect(pages[0].close).toHaveBeenCalledTimes(1);
    expect(pages[0].pdf).not.toHaveBeenCalled();
  });

  it("blocks script/image/private-network requests while retaining only fixed font hosts", async () => {
    const observed: {
      continue: ReturnType<typeof vi.fn>;
      abort: ReturnType<typeof vi.fn>;
    }[] = [];
    onContent = page => {
      for (const [url, type] of [
        ["http://127.0.0.1/secret", "image"],
        ["https://evil.test/x.js", "script"],
        ["https://fonts.gstatic.com/font.woff2", "font"],
        ["https://fonts.gstatic.com/track.png", "image"],
        ["data:image/png;base64,AAAA", "image"],
      ]) {
        const request = {
          url: () => url,
          resourceType: () => type,
          continue: vi.fn(async () => {}),
          abort: vi.fn(async () => {}),
        };
        observed.push(request);
        page.emit("request", request);
      }
    };
    await renderer.renderHtmlToPdf("<p>content</p>");
    expect(pages[0].setJavaScriptEnabled).toHaveBeenCalledWith(false);
    expect(pages[0].setRequestInterception).toHaveBeenCalledWith(true);
    expect(observed.map(item => item.continue.mock.calls.length)).toEqual([
      0, 0, 1, 0, 1,
    ]);
    expect(observed.map(item => item.abort.mock.calls.length)).toEqual([
      1, 1, 0, 1, 0,
    ]);
  });
});
