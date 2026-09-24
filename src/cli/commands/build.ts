import debug from "debug";
import path from "node:path";
import pMap from "p-map";

import { Site } from "../../site/Site.js";

const log = debug("m8t:build");
const CONCURRENCY = 8;

export const run = async (
  site: Site,
  _args: { _: [string] },
  signal: AbortSignal,
): Promise<number> => {
  await site.out.ensureDir("build");

  const out = await site.out.cd("build");

  log(`clearing out directory ${out.rootPath}`);
  await Promise.any([site.urls, out.clear()]); // also get the urls promises booted up

  log(`building pages to ${out.rootPath}`);
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

      await out.writeFile(outputPath, content);
    },
    { concurrency: CONCURRENCY, signal },
  );

  if (await site.static.exists()) {
    log(`copying static files to ${out.rootPath}`);
    const staticFiles = await site.static.ls(true);
    await pMap(
      staticFiles,
      async (file) => {
        if (signal.aborted || !file.isFile()) {
          return;
        }

        await out.copyFileFrom(
          site.static,
          path.join(path.relative(site.static.rootPath, file.parentPath), file.name),
        );
      },
      { concurrency: CONCURRENCY, signal },
    );
  }

  return 0;
};
