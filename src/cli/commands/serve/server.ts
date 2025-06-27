import { stat } from "fs/promises";
import { compact } from "lodash-es";
import mime from "mime-types";
import { createReadStream } from "node:fs";
import fs from "node:fs/promises";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stringOrThrow, type PageData } from "../../../PageData.js";
import { Redirects } from "../../../Redirects.js";
import type { Site } from "../../../Site.js";
import { SiteBuilder } from "../../../SiteBuilder.js";
import { debugPageGet } from "./routes/__debug/GET-:url.js";
import { debugGet } from "./routes/__debug/GET.js";

export const run = async (): Promise<void> => {
  const root = process.env.SITE_ROOT;
  if (!root) {
    throw new Error("Cannot run server because SITE_ROOT env var is not set");
  }

  if ((await fs.stat(root)).isDirectory() != true) {
    throw new Error("Cannot run server because SITE_ROOT is not a directory");
  }

  const site = await SiteBuilder.siteForRoot(root);
  const exiting = new AbortController();
  const shutdown = () => {
    exiting.abort();
    setTimeout(() => {
      process.exit(0);
    }, 1000);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runServer(site, exiting.signal);
};

export const runServer = async (site: Site, exiting: AbortSignal): Promise<void> => {
  await site.pages.init();

  const redirects = site.builder.devServerConfig.redirectsPath
    ? await Redirects.fromFilesystem(site.root, site.builder.devServerConfig.redirectsPath)
    : null;

  const server = createServer({}, async (request, response) => {
    try {
      const host = request.headers.host ?? "localhost";
      const url = new URL(request.url ?? "", `https://${host}`);
      const pagePath = decodeURIComponent(url.pathname);

      if (pagePath == "/__debug__") {
        await debugGet(site, request, response);
        return;
      }

      if (pagePath.startsWith("/__debug__/")) {
        await debugPageGet(site, request, response);
        return;
      }

      let page: PageData | undefined;
      const urlsToTry = compact([
        pagePath,
        pagePath.replace(/\/$/, ""),
        path.join(pagePath, "index"),
        path.join(pagePath, "index.html"),
      ]);
      for (const url of urlsToTry) {
        page = await site.pages.page(url);
        if (page) {
          const content = stringOrThrow(page.content, "content");
          response.writeHead(200, { "content-type": mime.lookup(url) || "text/html" });
          response.end(content);
          return;
        }
      }

      const staticFile = path.join(site.static.path, url.pathname);
      try {
        if ((await stat(staticFile)).isFile()) {
          const mimeType = mime.lookup(staticFile) || "text/plain";
          response.writeHead(200, { "content-type": mimeType });
          createReadStream(staticFile).pipe(response);
          return;
        }
      } catch (_e) {
        // fall through to 404
      }

      if (redirects) {
        const redirect = redirects.match(pagePath);
        if (redirect) {
          response.writeHead(redirect[1], { location: redirect[0] });
          response.end();
          return;
        }
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
      response.writeHead(500, { "content-type": "text/plain" });
      response.end(`Internal Server Error\n\n${error.stack}`);
    }
  });

  server.listen({
    host: "0.0.0.0",
    port: site.builder.devServerConfig.port,
    signal: exiting,
  });

  process.send?.("ready");
};

const entryFile = process.argv?.[1];
const __filename = fileURLToPath(import.meta.url);
if (entryFile !== __filename) {
  console.log("Can only run this file as a main script");
  process.exit(1);
}

run().catch(console.error);
