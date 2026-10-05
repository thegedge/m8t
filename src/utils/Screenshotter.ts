import type { devices, Browser, BrowserContextOptions, BrowserType } from "playwright";

import type { Datum } from "../pipeline/Datum.js";
import { merge } from "./merge.js";

// TODO Check for a running server instead of processing everything and then failing.
//      Even better: just start the server, if it isn't already running.
//      Also, make sure to retry on connection failure. Sometimes it slips.

const MAX_PAGE_HEIGHT = 30000; // clamping the viewport to ensure there's enough availablememory

/**
 * Options for constructing a {@link Screenshotter}
 */
export type ScreenshotterOptions = {
  /** The kind of browser */
  browser: "chromium" | "firefox" | "webkit";

  /** The name of the device running the browser */
  device: keyof typeof devices;

  /** Additional browser configuration */
  options?: BrowserContextOptions;
};

/** Something capable of taking a screenshot of a given datum */
export type Screenshotter = {
  screenshot(options: {
    baseURL: string;
    datum: Datum;
    signal?: AbortSignal;
  }): AsyncGenerator<Buffer>;

  [Symbol.asyncDispose](): Promise<void>;
};

/**
 * Construct a {@link Screenshotter} for a given set of options.
 *
 * @returns the {@link Screenshotter} instance, or `null` if no corresponding screenshotter can be
 *          constructed for the given options
 */
export const screenshotterForOptions = async (
  options: ScreenshotterOptions,
): Promise<Screenshotter | null> => {
  let browser: BrowserType;
  switch (options.browser) {
    case "chromium":
      const { chromium } = await import("playwright");
      browser = chromium;
      break;
    case "firefox":
      const { firefox } = await import("playwright");
      browser = firefox;
      break;
    case "webkit":
      const { webkit } = await import("playwright");
      browser = webkit;
      break;
  }

  const { devices } = await import("playwright");
  return new BrowserScreenshotter(browser, merge(devices[options.device], options));
};

class BrowserScreenshotter implements Screenshotter {
  #options: BrowserContextOptions;
  #browserType: BrowserType;
  #browser: Browser | null = null;

  constructor(browser: BrowserType, options: BrowserContextOptions) {
    this.#browserType = browser;
    this.#options = options;
  }

  async *screenshot(options: {
    baseURL: string;
    datum: Datum;
    signal?: AbortSignal;
  }): AsyncGenerator<Buffer> {
    const { baseURL, datum, signal } = options;
    if (signal?.aborted) {
      return;
    }

    const url = datum.maybeGetString("url");
    if (!url) {
      return;
    }

    const datumMimeType = datum.maybeGetString("mimeType");
    if (datumMimeType != "text/html") {
      return;
    }

    const browser = await this.browser();
    await using context = await browser.newContext({
      ...options,
      baseURL,
      reducedMotion: "reduce",
    });

    await using page = await context.newPage();
    await page.goto(url, { signal });

    const pageHeight = await page.evaluate<number>("document.documentElement.scrollHeight");
    for (let y = 0, index = 1; y < pageHeight; y += MAX_PAGE_HEIGHT, ++index) {
      if (signal?.aborted) {
        return;
      }

      await page.setViewportSize({
        width: this.#options.viewport?.width || 1024,
        height: Math.min(MAX_PAGE_HEIGHT, pageHeight - y),
      });

      await page.evaluate(`window.scrollTo(0, ${y})`, { signal });

      yield await page.screenshot({
        signal,
        fullPage: false,
        scale: "css",
        type: "png",
        animations: "disabled",
        caret: "hide",
        // Mask (potentially) animated images
        mask: [page.locator("img[src*='.gif']"), page.locator("img[src*='.webp']")],
      });
    }
  }

  async browser() {
    if (!this.#browser) {
      this.#browser = await this.#browserType.launch();
    }
    return this.#browser;
  }

  async [Symbol.asyncDispose]() {
    if (this.#browser) {
      const browser = this.#browser;
      this.#browser = null;
      await browser.close();
    }
  }
}
