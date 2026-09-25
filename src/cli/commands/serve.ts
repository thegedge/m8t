import { link } from "ansi-escapes";
import debug from "debug";
import { watch } from "fs";
import { fork, type ChildProcess } from "node:child_process";
import path from "node:path";
import { styleText } from "node:util";
import pDebounce from "p-debounce";

import { Site } from "../../site/Site.js";
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

export const run = async (
  root: string,
  _args: Record<string, unknown>,
  signal: AbortSignal,
): Promise<number> => {
  const { resolve: finished, promise: finishedPromise } = Promise.withResolvers<number>();
  const site = await Site.forRoot(root);

  signal.addEventListener("abort", () => {
    setTimeout(() => {
      finished(0);
    }, 1500);
  });

  await watchFiles(site, signal);
  return await finishedPromise;
};

const watchFiles = async (site: Site, exiting: AbortSignal): Promise<void> => {
  if (!site.devServer) {
    throw new Error("Dev server port not found");
  }

  const startTime = performance.now();
  let reloadStartTime = startTime;

  const startServer = () => {
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

  let currentServer = startServer();
  let nextServer: ChildProcess | null = null;
  const url = `http://localhost:${site.devServer.port}`;

  currentServer.on("message", (message) => {
    if (message === "ready") {
      showReadyMessage(reloadStartTime, url);
    }
  });

  currentServer.on("error", (_message) => {
    // TODO stop suppressing errors and show them
  });

  const changedPaths: string[] = [];
  const reload = pDebounce(async () => {
    if (exiting.aborted) {
      return;
    }

    const paths = changedPaths.map((p) => path.relative(site.root.rootPath, p));
    const summary = paths.length > 10 ? paths.slice(0, 10).join(", ") + "..." : paths.join(", ");
    log("reloading due to changes in %s", summary);
    changedPaths.length = 0;

    // Start reload timing and animation
    reloadStartTime = performance.now();

    const server = currentServer;
    if (server.exitCode === null && server.signalCode === null) {
      await new Promise<void>((resolve) => {
        server.on("exit", () => resolve());
        server.kill("SIGTERM"); // kill after setting up the listener to ensure it fires
      });
    }

    const newServer = startServer();
    nextServer?.kill("SIGTERM");
    nextServer = newServer;

    newServer.on("error", (_message: unknown) => {
      // TODO stop suppressing errors and show them
    });

    newServer.on("message", (message: unknown) => {
      if (message === "ready") {
        // draw(reloadStartTime, url, false).render(buffer);

        currentServer = newServer;
        if (nextServer == newServer) {
          nextServer = null;
        }
      }
    });
  }, 500);

  // Normally you should close watchers once you're done with them, but since we're going to reload the process
  // we instead just unref them, to allow everything to terminate nicely.
  for (const watchDir of site.watchDirs) {
    const matcher = site.ignoredFilesMatcher.withBase(watchDir.rootPath);
    watch(watchDir.rootPath, { recursive: true, signal: exiting }, (_event, filePath) => {
      if (!filePath) {
        return;
      }

      const absolutePath = path.join(watchDir.rootPath, filePath);
      if (absolutePath.startsWith(site.static.rootPath) || matcher.matches(absolutePath)) {
        return;
      }

      changedPaths.push(absolutePath);
      reload();
    }).unref();
  }
};
