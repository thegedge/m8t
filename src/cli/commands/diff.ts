import fs from "node:fs/promises";
import os from "node:os";
import pMap from "p-map";
// TODO dynamic import in `run` function, catch if missing (since optional) and relay a message to add playwright to package.json
import {
  chromium,
  devices,
  firefox,
  webkit,
  type Browser,
  type BrowserContextOptions,
} from "playwright";
// @ts-expect-error no types
import { utils } from "playwright-core/lib/coreBundle";

import type { Site } from "../../Site.js";
import type { Datum, DefaultDatumShape } from "../../types.js";
import { sortBy } from "../../utils/sortBy.js";

// TODO Check for a running server instead of processing everything and then failing.
//      Even better: just start the server, if it isn't already running.
//      Also, make sure to retry on connection failure. Sometimes it slips.

export const run = async (
  site: Site,
  _args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<number> => {
  if (!site.devServer) {
    throw new Error("m8t diff cannot run without a devServer configured");
  }
  const baseURL = `http://localhost:${site.devServer.port}`;

  await site.out.ensureDir("diff");
  const out = site.out.cd("diff");

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
    const sitePages = Object.values(await site.data)
      .filter((datum) => datum.get("mimeType") === "text/html")
      .filter((datum): datum is Datum<DefaultDatumShape & { url: string }> => !!datum.get("url"));

    // Sort such that we distribute concurrent tasks across browser instances
    const tasks = sortBy(
      (
        await pMap(Object.entries(tests), async ([name, { browser, options }]) => {
          const sanitizedName = sanitizeForFilename(name);
          await out.ensureDir(sanitizedName);

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

    const compare = utils.getComparator("image/png") as (
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

        await using context = await browser.newContext({
          ...options,
          baseURL,
          reducedMotion: "reduce",
        });

        const page = await context.newPage();
        const url = sitePage.url;
        const sanitizedUrl = sanitizeForFilename(url);
        const sanitizedName = sanitizeForFilename(name);

        console.log(`Processing ${url} with context '${name}'`);
        await page.goto(url);

        const pageHeight = await page.evaluate<number>("document.documentElement.scrollHeight");
        const MAX_PAGE_HEIGHT = 30000;

        for (let y = 0, index = 1; y < pageHeight; y += MAX_PAGE_HEIGHT, ++index) {
          if (signal.aborted) {
            return;
          }

          await page.setViewportSize({
            width: options.viewport.width,
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

          const outputPath = out.absolute(`${sanitizedName}/${sanitizedUrl}-${index}.png`);
          if (await fileExists(outputPath)) {
            const previous = await fs.readFile(outputPath);
            const result = compare(previous, current, { maxDiffPixelRatio: 0.01 });
            const outputDiffPath = out.absolute(
              `${sanitizedName}/${sanitizedUrl}-${index}.diff.png`,
            );
            if (result && result.errorMessage == "Buffers differ") {
              await fs.writeFile(outputDiffPath, result.diff);
            } else if (!result && (await fileExists(outputDiffPath))) {
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
  if (!value || value == "/") {
    return "__root__";
  }

  let encoded: string;
  if (value.includes("--")) {
    encoded = encodeURIComponent(value);
  } else {
    // If we won't have any collisions with --, replace `/` with `--` for nicer filenames
    encoded = encodeURIComponent(value.replaceAll("/", "--"));
  }

  // Replace some other common URI-escaped characters with valid path characters
  encoded = encoded.replaceAll("%20", " ");

  // Finally, `.` and `..` aren't a great idea. By this point, we should have a relative
  // path without any dots. Encode something a bit obnoxious, so it stands out.
  return encoded.replaceAll(".", "__dot__");
};
