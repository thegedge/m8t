// TODO dynamic import in `run` function, catch if missing (since optional) and relay a message to add playwright to package.json
import { devices, type BrowserContextOptions } from "playwright";

import { memoize } from "./memoize.js";

export type BrowserDifferOptions = {
  browser: "chromium" | "firefox" | "webkit";
  device: keyof typeof devices;
  options: BrowserContextOptions;
};

export const imageDiff = async (current: Buffer, expected: Buffer) => {
  const compare = await playwrightComparator();
  const result = compare(expected, current, { maxDiffPixelRatio: 0.01 });
  if (result && result.errorMessage == "Buffers differ") {
    return result.diff;
  }
  return null;
};

const playwrightComparator = memoize(async () => {
  // @ts-expect-error no types
  const { utils } = await import("playwright-core/lib/coreBundle");

  return utils.getComparator("image/png") as (
    previous: Buffer,
    current: Buffer,
    options?: Record<string, unknown>,
  ) => { errorMessage: string; diff: Buffer } | null;
});
