import { link } from "ansi-escapes";
import chalk from "chalk";
import debug from "debug";
import { watch } from "fs";
import { fork, type ChildProcess } from "node:child_process";
import type { WatchListener } from "node:fs";
import path from "node:path";
import pDebounce from "p-debounce";
import type { Site } from "../../Site.js";
import { printLogoAndTitleWithLines } from "../tui/logo.js";

const log = debug("m8t:serve");

// Animation characters for reloading indicator
const ANIMATION_CHARS = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];
let animationIndex = 0;
let globalAnimationInterval: NodeJS.Timeout | null = null;

const clearLine = () => {
  process.stdout.write("\r" + " ".repeat(80) + "\r");
};

const showReloadingMessage = (isInitialLoad = false) => {
  const animationChar = ANIMATION_CHARS[animationIndex];
  animationIndex = (animationIndex + 1) % ANIMATION_CHARS.length;

  const message = isInitialLoad ? "Server starting up" : "Reloading";
  process.stdout.write(chalk.blue(`\r${animationChar} ${message}...`));
};

const showReadyMessage = (startTime: number, url: string, isInitialLoad = false) => {
  const elapsed = Math.round(performance.now() - startTime);

  clearLine();

  if (isInitialLoad) {
    printLogoAndTitleWithLines(process.stdout, [
      "",
      `Server listening on ${chalk.bold(link(url, url))}`,
      "",
      chalk.green(`✓ Server loaded in: ${chalk.bold(`${elapsed}ms`)}`),
    ]);
  } else {
    process.stdout.write(chalk.green(`\r✓ Reloaded in ${chalk.bold(`${elapsed}ms`)}`));
  }
};

export const run = async (site: Site, _args: Record<string, unknown>): Promise<void> => {
  const exiting = new AbortController();
  const { resolve: finished, promise: exitingPromise } = Promise.withResolvers<void>();

  const shutdown = () => {
    exiting.abort();

    if (globalAnimationInterval) {
      clearInterval(globalAnimationInterval);
      globalAnimationInterval = null;
    }

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
  let reloadStartTime = startTime;

  const startServer = () => {
    return fork(path.join(import.meta.dirname, "../../server/entry.js"), {
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
  const url = `http://localhost:${site.builder.devServerConfig.port}`;

  currentServer.on("message", (message) => {
    if (message === "ready") {
      if (globalAnimationInterval) {
        clearInterval(globalAnimationInterval);
        globalAnimationInterval = null;
      }

      showReadyMessage(reloadStartTime, url, true);
    }
  });

  currentServer.on("error", (_message) => {
    // TODO stop suppressing errors and show them
  });

  const reload: WatchListener<string> = pDebounce(async (_event, filename) => {
    if (exiting.aborted) {
      return;
    }

    if (filename?.endsWith(".d.ts") || filename?.endsWith("profile.cpuprofile") || filename?.endsWith(".rb")) {
      // TODO expose a way for the user to ignore files that aren't part of the build process
      return;
    }

    log("reloading due to changes in %s", filename);

    // Start reload timing and animation
    reloadStartTime = performance.now();

    const server = currentServer;
    if (server) {
      await new Promise<void>((resolve) => {
        server.on("exit", () => resolve());
        server.kill("SIGTERM"); // kill after setting up the listener to ensure it fires
      });
    }

    const newServer = startServer();
    nextServer?.kill("SIGTERM");
    nextServer = newServer;

    newServer.on("error", (message: unknown) => {
      // suppress errors
      // TODO is there something we can do here? show error? try again?
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
    watch(watchDir.path, { recursive: true, signal: exiting }, reload).unref();
  }
};
