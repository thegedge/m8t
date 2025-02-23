import { stat } from "fs/promises";
import { compact } from "lodash-es";
import mime from "mime-types";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import { register } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { type RenderedPage } from "../../Pages.ts";
import { Redirects } from "../../Redirects.ts";
import { Site } from "../../Site.ts";

register("@nodejs-loaders/tsx", import.meta.url);

export const run = async (): Promise<void> => {
  const root = process.env.SITE_ROOT;
  if (!root) {
    throw new Error("Cannot run server because SITE_ROOT env var is not set");
  }

  if ((await fs.stat(root)).isDirectory() != true) {
    throw new Error("Cannot run server because SITE_ROOT is not a directory");
  }

  const site = await Site.forRoot(root);
  const exiting = new AbortController();
  const shutdown = () => {
    exiting.abort();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runServer(site, exiting.signal);
};

export const runServer = async (site: Site, exiting: AbortSignal): Promise<void> => {
  await site.pages.init();
  const redirects = await Redirects.fromFilesystem(site.pagesRoot, site.config.redirectsPath);

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

const entryFile = process.argv?.[1];
const __filename = fileURLToPath(import.meta.url);
if (entryFile !== __filename) {
  console.log("Can only run this file as a main script");
  process.exit(1);
}

run().catch(console.error);
