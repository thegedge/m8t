import debug from "debug";
import path from "node:path";
import pMap from "p-map";

import { Site } from "../../Site.js";

const log = debug("m8t:build");
const CONCURRENCY = 8;

export const run = async (
  site: Site,
  _args: { _: [string] },
  signal: AbortSignal,
): Promise<number> => {
  log("initializing tsx loader");
  await import("../../loader/register.js");

  log(`clearing out directory ${site.out.path}`);
  await site.out.clear();

  log(`building pages to ${site.out.path}`);
  await pMap(
    await site.urls,
    async (url) => {
      if (signal.aborted) {
        return;
      }

      process.stdout.write(`Building ${url}\n`);
      const data = await site.dataByUrl(url);
      if (!data) {
        throw new Error(`Could not build page for URL ${url}`);
      }

      if (signal.aborted) {
        return;
      }

      const outputPath = data.stringOrThrow("outputPath");
      const content = data.stringOrThrow("content");

      await site.out.writeFile(outputPath, content);
    },
    { concurrency: CONCURRENCY, signal },
  );

  log(`copying static files to ${site.out.path}`);
  const staticFiles = await site.static.ls(true);
  await pMap(
    staticFiles,
    async (file) => {
      if (signal.aborted || !file.isFile()) {
        return;
      }

      await site.out.copyFileFrom(
        site.static,
        path.join(path.relative(site.static.path, file.parentPath), file.name),
      );
    },
    { concurrency: CONCURRENCY, signal },
  );

  return 0;
};
