import { link } from "ansi-escapes";
import chalk from "chalk";
import { watch } from "fs/promises";
import { fork, type ChildProcess } from "node:child_process";
import type { Site } from "../../Site.ts";
import { printLogoAndTitleWithLines } from "../logo.ts";

export const run = async (site: Site, _args: Record<string, unknown>): Promise<void> => {
  const exiting = new AbortController();

  const shutdown = () => {
    exiting.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await watchFiles(site, exiting.signal);
};

export const watchFiles = async (site: Site, exiting: AbortSignal): Promise<void> => {
  (async () => {
    let currentServer = fork(`${import.meta.dirname}/server.ts`, {
      env: {
        ...process.env,
        SITE_ROOT: site.root.path,
      },
      signal: exiting,
    });
    let nextServer: ChildProcess | null = null;

    currentServer.on("message", (message) => {
      if (message === "ready") {
        const url = `http://localhost:${site.builder.devServerConfig.port}`;
        printLogoAndTitleWithLines(process.stdout, ["", `Server listening on ${chalk.bold(link(url, url))}`]);
      }
    });

    currentServer.on("error", (message) => {
      // suppress errors
    });

    for await (const changeInfo of watch(site.root.path, { recursive: true, signal: exiting })) {
      if (exiting.aborted) {
        return;
      }

      if (changeInfo.filename?.endsWith(".d.ts")) {
        // TODO better means of ignoring files that aren't part of the build process
        return;
      }

      const newServer = fork(`${import.meta.dirname}/server.ts`, {
        env: {
          ...process.env,
          SITE_ROOT: site.root.path,
        },
        signal: exiting,
      });
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
    }
  })().catch(() => {
    // We don't want to log the error thrown from the abort
    void 0;
  });

  const interval = setInterval(() => {
    // Do nothing, but this will keep the node process open
  }, 60_000);

  exiting.addEventListener("abort", () => {
    clearInterval(interval);
  });
};
