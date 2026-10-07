import fs from "node:fs/promises";

import { MissingOptionError } from "../../errors/MissingOptionError.js";
import type { Datum, DatumShape } from "../../pipeline/Datum.js";
import { Site } from "../../site/Site.js";
import { imageDiff } from "../../utils/imageDiff.js";
import { screenshotterForOptions } from "../../utils/Screenshotter.js";

// TODO Check for a running server instead of processing everything and then failing.
//      Even better: just start the server, if it isn't already running.
//      Also, make sure to retry on connection failure. Sometimes it slips.

export const run = async (opts: { root: string; signal: AbortSignal }): Promise<number> => {
  const { root, signal } = opts;

  const site = await Site.forRoot(root);
  if (!site.diff) {
    throw new MissingOptionError("diff");
  }

  if (!site.devServer) {
    throw new MissingOptionError("devServer");
  }
  const baseURL = `http://localhost:${site.devServer.port}`;

  await site.out.ensureDir("diff");
  const out = await site.out.cd("diff");

  const siteData = await site.load({ signal });
  const sitePages = Iterator.from(siteData)
    .filter((datum) => datum.get("mimeType") === "text/html")
    .filter((datum): datum is Datum<DatumShape & { url: string }> => !!datum.get("url"))
    .toArray();

  for (const [name, options] of Object.entries(site.diff)) {
    if (signal.aborted) {
      break;
    }

    await using screenshotter = await screenshotterForOptions(options);
    if (!screenshotter) {
      continue;
    }

    const sanitizedName = sanitizeForFilename(name);
    await out.ensureDir(sanitizedName);

    for (const datum of sitePages) {
      if (signal.aborted) {
        break;
      }

      const url = datum.get("url");
      const sanitizedUrl = sanitizeForFilename(url);

      console.log(`Processing ${url} with context '${name}'`);

      let index = 1;
      for await (const current of screenshotter.screenshot({ baseURL, datum, signal })) {
        const outputPath = `${sanitizedName}/${sanitizedUrl}-${index}.png`;
        if (await out.exists(outputPath)) {
          const outputDiffPath = `${sanitizedName}/${sanitizedUrl}-${index}.diff.png`;
          const previous = await fs.readFile(outputPath);
          const result = await imageDiff(previous, current);
          if (result) {
            await out.writeFile(outputDiffPath, result);
          } else if (!result && (await out.exists(outputDiffPath))) {
            await out.remove(outputDiffPath);
          }
        }

        await fs.writeFile(outputPath, current);
      }
    }
  }

  return 0;
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

  // The above may have inserted a "--" at the beginning
  encoded = encoded.replace(/^--/, "");

  // Replace some other common URI-escaped characters with valid path characters
  encoded = encoded.replaceAll("%20", " ");

  // Finally, `.` and `..` aren't a great idea. By this point, we should have a relative
  // path without any dots. Encode something a bit obnoxious, so it stands out.
  return encoded.replaceAll(".", "__dot__");
};
