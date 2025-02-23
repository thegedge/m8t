import { link } from "ansi-escapes";
import chalk from "chalk";
import { watch } from "fs/promises";
import { fork, type ChildProcess } from "node:child_process";
import type { Site } from "../../Site.ts";
import { printLogoWithLines } from "../logo.ts";

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
        const url = `http://localhost:${site.config.devServer.port}`;
        printLogoWithLines(process.stdout, ["", `Server listening on ${chalk.bold(link(url, url))}`]);
      }
    });

    currentServer.on("error", (message) => {
      // suppress errors
    });

    for await (const _changeInfo of watch(site.root.path, { recursive: true, signal: exiting })) {
      if (exiting.aborted) {
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
