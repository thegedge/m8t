import { stat, watch } from "fs/promises";
import { compact } from "lodash-es";
import mime from "mime-types";
import { fork, type ChildProcess } from "node:child_process";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { type RenderedPage } from "../../Pages.ts";
import { Redirects } from "../../Redirects.ts";
import type { Site } from "../../Site.ts";

// TODO make this configurable
const REDIRECTS_PATH = "static/_redirects";

export const run = async (site: Site, args: { _: string[] }): Promise<void> => {
  const exiting = new AbortController();

  const shutdown = () => {
    exiting.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  // TODO fix args parsing so that this is args.server
  if (args._.includes("--server")) {
    await runServer(site, exiting.signal);
  } else {
    await watchFiles(site, exiting.signal);
  }
};

export const watchFiles = async (site: Site, exiting: AbortSignal): Promise<void> => {
  (async () => {
    let currentServer = fork(`${import.meta.dirname}/../index.ts`, ["serve", "--", "--server"], {
      signal: exiting,
    });
    let nextServer: ChildProcess | null = null;

    for await (const _changeInfo of watch(site.root.path, { recursive: true, signal: exiting })) {
      if (exiting.aborted) {
        return;
      }

      const newServer = fork(`${import.meta.dirname}/../index.ts`, ["serve", "--", "--server"], {
        signal: exiting,
      });
      nextServer?.kill("SIGTERM");
      nextServer = newServer;

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

export const runServer = async (site: Site, exiting: AbortSignal): Promise<void> => {
  await site.pages.init();
  const redirects = await Redirects.fromFilesystem(site.pagesRoot, REDIRECTS_PATH);

  const server = createServer({}, async (request, response) => {
    try {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "", `https://${host}`);
      const pagePath = decodeURIComponent(url.pathname);

      let page: RenderedPage | undefined;
      const urlsToTry = compact([
        pagePath,
        pagePath.replace(/\/$/, ""),
        path.join(pagePath, "index"),
        path.join(pagePath, "index.html"),
      ]);
      for (const url of urlsToTry) {
        page = await site.pages.page(url);
        if (page) {
          response.writeHead(200, { "content-type": mime.lookup(url) || "text/html" });
          response.end(page.content);
          return;
        }
      }

      const staticFile = path.join(site.pagesRoot.path, "static", url.pathname);
      try {
        if ((await stat(staticFile)).isFile()) {
          response.writeHead(200, { "content-encoding": "text/plain" });
          createReadStream(staticFile).pipe(response);
          return;
        }
      } catch (_e) {
        // fall through to 404
      }

      const redirect = redirects.match(pagePath);
      if (redirect) {
        response.writeHead(redirect[1], {
          location: redirect[0],
        });
        response.end();
        return;
      }

      response.writeHead(404);
      response.end(`
Not found
  path: ${url.pathname}

Possible paths:
  - ${site.pages.urls().sort().join("\n  - ")}
`);
      return;
    } catch (error) {
      response.writeHead(500, {
        "content-type": "text/plain",
      });
      response.end(`Internal Server Error\n\n${error.stack}`);
    }
  });

  server.listen({
    host: "0.0.0.0",
    port: 3000,
    // reusePort: true,
    signal: exiting,
  });

  process.send?.("ready");
  console.log("listening on port 3000");
};
