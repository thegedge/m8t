import { link } from "ansi-escapes";
import debug from "debug";
import { watch } from "fs";
import { fork } from "node:child_process";
import path from "node:path";
import { styleText } from "node:util";

import { MissingOptionError } from "../../errors/MissingOptionError.js";
import { Site } from "../../site/Site.js";
import { Reloader, type ReloaderSubprocess } from "../../utils/Reloader.js";
import { printLogoAndTitleWithLines } from "../tui/logo.js";

const log = debug("m8t:serve");

const clearLine = () => {
  process.stdout.write("\r" + " ".repeat(80) + "\r");
};

const showReadyMessage = (startTime: number, url: string) => {
  const elapsed = Math.round(performance.now() - startTime);

  clearLine();

  printLogoAndTitleWithLines(process.stdout, [
    "",
    `Server listening on ${styleText("bold", link(url, url))}`,
    "",
    styleText("green", `✓ Server loaded in: ${styleText("bold", `${elapsed}ms`)}`),
  ]);
};

const startServer = (site: Site, exiting: AbortSignal): ReloaderSubprocess => {
  return fork(path.join(import.meta.dirname, "../../server/entry.js"), {
    env: {
      ...process.env,
      SITE_ROOT: site.root.rootPath,
    },
    cwd: path.join(import.meta.dirname, "../../../"),
    execArgv: process.execArgv,
    signal: exiting,
  });
};

/**
 * Whether or not a changed path is significant enough to warrant a reload.
 *
 * Changes under the site's static directory, or matching the site's ignore rules, are not.
 */
const isIgnoredChange = (site: Site, watchDirRoot: string, absolutePath: string): boolean => {
  const matcher = site.ignoredFilesMatcher.withBase(watchDirRoot);
  return absolutePath.startsWith(site.static.rootPath) || matcher.matches(absolutePath);
};

const watchFiles = (site: Site, exiting: AbortSignal): void => {
  if (!site.devServer) {
    throw new MissingOptionError("devServer");
  }
  const url = `http://localhost:${site.devServer.port}`;

  let first = true;
  const reloader = new Reloader({
    spawn: () => startServer(site, exiting),
    signal: exiting,
    onReady: (startTime) => {
      if (first) {
        // TODO show feedback; indicate the server is reloading
        showReadyMessage(startTime, url);
        first = false;
      }
    },
  });

  reloader.start();

  // Normally you should close watchers once you're done with them, but since we're going to reload
  // the process we instead just unref them, to allow everything to terminate nicely.
  for (const watchDir of site.watchDirs) {
    watch(watchDir.rootPath, { recursive: true, signal: exiting }, (event, filePath) => {
      if (!filePath) {
        return;
      }

      if (filePath == path.basename(watchDir.rootPath)) {
        // TODO I observed this locally when running playwright, where what appeared to be a change
        //      to the root dir was causing a reload, but verify it wasn't some other playwright
        //      quirk where it was creating a dir named similarly to the path under which it was
        //      running
        return;
      }

      const absolutePath = path.join(watchDir.rootPath, filePath);
      if (isIgnoredChange(site, watchDir.rootPath, absolutePath)) {
        return;
      }

      log(`reloading because of ${filePath} (${event})`);
      reloader.reload();
    }).unref();
  }
};

export const run = async (opts: { root: string; signal: AbortSignal }): Promise<number> => {
  const { root, signal } = opts;
  const site = await Site.forRoot(root);

  const { resolve: finished, promise: finishedPromise } = Promise.withResolvers<number>();
  signal.addEventListener("abort", () => {
    setTimeout(() => {
      finished(0);
    }, 1500);
  });

  watchFiles(site, signal);

  return await finishedPromise;
};
