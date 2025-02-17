import { stat, watch } from "fs/promises";
import { compact } from "lodash-es";
import mime from "mime-types";
import { createReadStream } from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { type RenderedPage } from "../../Pages.ts";
import { Redirects } from "../../Redirects.ts";
import type { Site } from "../../Site.ts";

// TODO make this configurable
const REDIRECTS_PATH = "static/_redirects";

export const run = async (site: Site, _args: Record<string, unknown>): Promise<void> => {
  let redirects = await Redirects.fromFilesystem(site.pagesRoot, REDIRECTS_PATH);
  const exiting = new AbortController();

  // TODO better integrate this into `Pages` so we can avoid a full rebuild
  // TODO better way to do this other than an IIFE?
  (async () => {
    for await (const { filename } of watch(site.root.path, { recursive: true, signal: exiting.signal })) {
      if (exiting.signal.aborted) {
        return;
      }

      if (filename === REDIRECTS_PATH) {
        redirects = await Redirects.fromFilesystem(site.pagesRoot, REDIRECTS_PATH);
      } else {
        // for (const key of Object.keys(require.cache)) {
        //   // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        //   delete require.cache[key];
        // }
        console.log(filename);
        await site.reload();
      }
    }
  })().catch(() => {
    // We don't want to log the error thrown from the abort
    void 0;
  });

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

  const shutdown = () => {
    exiting.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  server.listen({
    host: "0.0.0.0",
    port: 3000,
    // reusePort: true,
    signal: exiting.signal,
  });
};
