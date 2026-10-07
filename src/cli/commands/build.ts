import debug from "debug";
import path from "node:path";
import pMap from "p-map";

import { Site } from "../../site/Site.js";

const log = debug("m8t:build");
const CONCURRENCY = 8;

export const run = async (opts: { root: string; signal: AbortSignal }): Promise<number> => {
  const { root, signal } = opts;
  const site = await Site.forRoot(root);
  await site.out.ensureDir("build");

  const out = await site.out.cd("build");

  log(`clearing out directory ${out.rootPath}`);
  const [siteData] = await Promise.all([site.load({ signal }), out.clear()]);

  log(`write pages to ${out.rootPath}`);
  await pMap(
    siteData,
    async (datum) => {
      if (signal.aborted) {
        return;
      }

      const outputPath = datum.stringOrThrow("outputPath");
      const content = datum.stringOrThrow("content");
      const url = datum.maybeGetString("url");
      process.stdout.write(`Building ${url}\n`);

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
