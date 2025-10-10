// TODO dynamic import in `run` function, catch if missing (since optional) and relay a message to add playwright to package.json
import { chromium, devices, firefox, webkit, type Browser, type BrowserContextOptions } from "playwright";

// @ts-expect-error no types
import { getComparator } from "playwright-core/lib/utils";

import debug from "debug";
import fs from "node:fs/promises";
import os from "node:os";
import pMap from "p-map";
import type { Site } from "../../Site.js";
import type { Datum, DefaultDatumShape } from "../../types.js";
import { sortBy } from "../../utils/sortBy.js";

const log = debug("m8t:diff");

export const run = async (site: Site, _args: Record<string, unknown>, signal: AbortSignal): Promise<number> => {
  const [chromeBrowser, firefoxBrowser, webkitBrowser] = await Promise.all([
    chromium.launch(),
    firefox.launch(),
    webkit.launch(),
  ]);

  const tests = {
    "chrome-web (sm)": {
      browser: chromeBrowser,
      options: {
        ...devices["Desktop Chrome"],
        viewport: {
          width: 600,
          height: 800,
        },
      },
    },
    "chrome-web (md)": {
      browser: chromeBrowser,
      options: {
        ...devices["Desktop Chrome"],
        viewport: {
          width: 800,
          height: 1000,
        },
      },
    },
    "chrome-web (lg)": {
      browser: chromeBrowser,
      options: {
        ...devices["Desktop Chrome"],
        viewport: {
          width: 1200,
          height: 1400,
        },
      },
    },
    "firefox-web": {
      browser: firefoxBrowser,
      options: devices["Desktop Firefox"],
    },
    "safari-web": {
      browser: webkitBrowser,
      options: devices["Desktop Safari"],
    },
    iphone: {
      browser: webkitBrowser,
      options: devices["iPhone 15 Pro"],
    },
  } satisfies Record<string, { browser: Browser; options: BrowserContextOptions }>;

  try {
    // TODO why do we have to do these in every command?
    log("initializing tsx loader");
    await import("@nodejs-loaders/tsx");

    const sitePages = Object.values(await site.data)
      .filter((datum) => datum.get("mimeType") === "text/html")
      .filter((datum): datum is Datum<DefaultDatumShape & { url: string }> => !!datum.get("url"));

    // Sort such that we distribute concurrent tasks across browser instances
    const tasks = sortBy(
      (
        await pMap(Object.entries(tests), async ([name, { browser, options }]) => {
          const sanitizedName = sanitizeForFilename(name);
          await site.out.ensureDir(`diff/${sanitizedName}`);

          return sitePages.map((sitePage) => ({
            name,
            browser,
            options,
            sitePage: sitePage.toRecord(),
          }));
        })
      ).flat(),
      (v) => v.sitePage.url,
      (v) => v.name,
    );

    const compare = getComparator("image/png") as (
      previous: Buffer,
      current: Buffer,
      options?: Record<string, unknown>,
    ) => { errorMessage: string; diff: Buffer } | null;

    await pMap(
      tasks,
      async ({ name, browser, options, sitePage }) => {
        if (signal.aborted) {
          return;
        }

        const context = await browser.newContext({
          ...options,
          baseURL: "http://localhost:3000",
          reducedMotion: "reduce",
        });

        const page = await context.newPage();
        const url = sitePage.url;
        const sanitizedUrl = sanitizeForFilename(url == "/" ? "__root__" : url);
        const sanitizedName = sanitizeForFilename(name);

        console.log(`Processing ${url} with context '${name}'`);
        await page.goto(url);

        const [pageWidth, pageHeight] = await page.evaluate<[number, number]>(
          "[document.documentElement.scrollWidth, document.documentElement.scrollHeight]",
        );

        const MAX_PAGE_HEIGHT = 30000;

        for (let y = 0, index = 1; y < pageHeight; y += MAX_PAGE_HEIGHT, ++index) {
          if (signal.aborted) {
            return;
          }

          await page.setViewportSize({
            width: pageWidth,
            height: Math.min(MAX_PAGE_HEIGHT, pageHeight - y),
          });

          await page.evaluate(`window.scrollTo(0, ${y})`);

          const current = await page.screenshot({
            fullPage: false,
            scale: "css",
            type: "png",
            animations: "disabled",
            caret: "hide",
            // Mask (potentially) animated images
            mask: [page.locator("img[src*='.gif']"), page.locator("img[src*='.webp']")],
          });

          const outputPath = site.out.absolute(`diff/${sanitizedName}/${sanitizedUrl}-${index}.png`);
          if (await fileExists(outputPath)) {
            const previous = await fs.readFile(outputPath);
            const result = compare(previous, current, { maxDiffPixelRatio: 0.01 });
            const outputDiffPath = site.out.absolute(`diff/${sanitizedName}/${sanitizedUrl}-${index}.diff.png`);
            if (result) {
              await fs.writeFile(outputDiffPath, result.diff);
            } else if (await fileExists(outputDiffPath)) {
              await fs.unlink(outputDiffPath);
            }
          }

          await fs.writeFile(outputPath, current);
        }
      },
      {
        concurrency: Math.max(1, Math.floor(os.cpus().length / 3)),
        stopOnError: false,
        signal,
      },
    );
  } catch (error) {
    console.error(error);
    return 1;
  } finally {
    await Promise.all([chromeBrowser.close(), firefoxBrowser.close(), webkitBrowser.close()]);
  }

  return 0;
};

const fileExists = async (path: string) => {
  return await fs.stat(path).catch(() => false);
};

const sanitizeForFilename = (value: string) => {
  return value
    .replaceAll(/[^a-zA-Z0-9]+/g, "-")
    .replaceAll(/-+/g, "-")
    .replaceAll(/^-+|-+$/g, "");
};
