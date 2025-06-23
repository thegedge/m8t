import { link } from "ansi-escapes";
import chalk from "chalk";
import { watch } from "fs";
import { fork, type ChildProcess } from "node:child_process";
import type { WatchListener } from "node:fs";
import path from "node:path";
import type { Site } from "../../Site.js";
import { printLogoAndTitleWithLines } from "../logo.js";

export const run = async (site: Site, _args: Record<string, unknown>): Promise<void> => {
  const exiting = new AbortController();
  const { resolve: finished, promise: exitingPromise } = Promise.withResolvers<void>();

  const shutdown = () => {
    exiting.abort();

    setTimeout(() => {
      finished();
    }, 1500);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await watchFiles(site, exiting.signal);
  await exitingPromise;
};

const watchFiles = async (site: Site, exiting: AbortSignal): Promise<void> => {
  const startTime = performance.now();

  const startServer = () => {
    return fork(path.join(import.meta.dirname, "serve/server.js"), {
      env: {
        ...process.env,
        SITE_ROOT: site.root.path,
      },
      cwd: path.join(import.meta.dirname, "../../../"),
      // Until node can load jsx/tsx files, we need to use a special loader
      execArgv: [...process.execArgv, "--import", "@nodejs-loaders/tsx"],
      signal: exiting,
    });
  };

  let currentServer = startServer();
  let nextServer: ChildProcess | null = null;

  currentServer.on("message", (message) => {
    if (message === "ready") {
      const url = `http://localhost:${site.builder.devServerConfig.port}`;
      printLogoAndTitleWithLines(process.stdout, [
        "",
        `Server init time: ${chalk.bold(`${Math.round(performance.now() - startTime)}ms`)}`,
        "",
        `Server listening on ${chalk.bold(link(url, url))}`,
      ]);
    }
  });

  currentServer.on("error", (message) => {
    // suppress errors
  });

  const reload: WatchListener<string> = (_event, filename) => {
    if (exiting.aborted) {
      return;
    }

    if (filename?.endsWith(".d.ts") || filename?.endsWith("profile.cpuprofile")) {
      // TODO better means of ignoring files that aren't part of the build process
      return;
    }

    const newServer = startServer();
    nextServer?.kill("SIGTERM");
    nextServer = newServer;

    nextServer.on("error", (message) => {
      // suppress errors
    });

    nextServer.on("message", (message) => {
      if (message === "ready") {
        currentServer?.kill("SIGTERM");
        currentServer = newServer;
        if (nextServer == newServer) {
          nextServer = null;
        }
      }
    });
  };

  // Normally you should close watchers once you're done with them, but since we're going to reload the process
  // we instead just unref them, to allow everything to terminate nicely.
  for (const watchDir of site.watchDirs) {
    watch(watchDir.path, { recursive: true, signal: exiting }, reload).unref();
  }
};
