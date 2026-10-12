import debug from "debug";
import path from "node:path";
import pMap from "p-map";

import { BuildError } from "../../errors/BuildError.js";
import { Site } from "../../site/Site.js";
import { Filesystem } from "../../utils/Filesystem.js";
import { unthunk } from "../../utils/unthunk.js";

const log = debug("m8t:build");
const CONCURRENCY = 8;

export const run = async (opts: { root: string; signal: AbortSignal }): Promise<number> => {
  const { root, signal } = opts;
  const site = await Site.forRoot(root);
  const siteData = await site.load({ signal });

  await using tmp = await Filesystem.temporary(".build-");

  log(`write pages to ${tmp.rootPath}`);
  await pMap(
    siteData,
    async (datum) => {
      if (signal.aborted) {
        return;
      }

      const url = datum.maybeGetString("url");
      const outputPath = datum.stringOrThrow("outputPath");

      if (!datum.has("content")) {
        process.stdout.write(`skipping ${url ?? outputPath}\n`);
        return;
      }

      const content = await unthunk(datum.getOrThrow("content"), { signal });
      if (typeof content !== "string") {
        throw new BuildError(
          `datum with url ${url} has non-string content (type = ${typeof content})`,
        );
      }

      process.stdout.write(`writing ${url ?? outputPath}\n`);
      await tmp.writeFile(outputPath, content);
    },
    { concurrency: CONCURRENCY, signal },
  );

  if (await site.static.exists()) {
    signal.throwIfAborted();

    log(`copying static files to ${tmp.rootPath}`);
    const staticFiles = await site.static.ls(true);
    await pMap(
      staticFiles,
      async (file) => {
        if (signal.aborted || !file.isFile()) {
          return;
        }

        const relativePath = path.join(
          path.relative(site.static.rootPath, file.parentPath),
          file.name,
        );
        await tmp.copyFileFrom(site.static, relativePath);
      },
      { concurrency: CONCURRENCY, signal },
    );
  }

  log(`moving ${tmp.rootPath} to ${site.out.absolute("build")}`);
  await site.out.replaceDir("build", tmp);

  return 0;
};
