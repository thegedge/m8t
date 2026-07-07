import debug from "debug";
import path from "node:path";

import { Site } from "../../Site.js";

const log = debug("m8t:build");

export const run = async (
  site: Site,
  _args: { _: [string] },
  signal: AbortSignal,
): Promise<number> => {
  log("initializing tsx loader");
  await import("@nodejs-loaders/tsx");

  log(`clearing out directory ${site.out.path}`);
  await site.out.clear();

  log(`building pages to ${site.out.path}`);
  for (const url of await site.urls) {
    if (signal.aborted) {
      return 0;
    }

    process.stdout.write(`Building page for ${url}...`);
    const data = await site.dataByUrl(url);
    if (!data) {
      throw new Error(`Could not build page for URL ${url}`);
    }

    const outputPath = data.stringOrThrow("outputPath");
    const content = data.stringOrThrow("content");

    await site.out.writeFile(outputPath, content);
    process.stdout.write(`Done!\n\tStored in ${outputPath}\n`);
  }

  log(`copying static files to ${site.out.path}`);
  const staticFiles = await site.static.ls(true);
  for (const file of staticFiles) {
    if (signal.aborted) {
      return 0;
    }

    if (file.isFile()) {
      await site.out.copyFileFrom(
        site.static,
        path.join(path.relative(site.static.path, file.parentPath), file.name),
      );
    }
  }

  return 0;
};
