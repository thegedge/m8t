import { stat, watch } from "fs/promises";
import { compact, uniq } from "lodash";
import mime from "mime-types";
import path from "path";
import { setTimeout } from "timers/promises";
import { Pages, type RenderedPage } from "../../Pages";
import { Redirects } from "../../Redirects";
import type { Site } from "../../Site";

// TODO make this configurable
const REDIRECTS_PATH = "static/_redirects";

export const run = async (site: Site, _args: Record<string, unknown>): Promise<void> => {
  const filesystem = site.pagesRoot;

  let pages = await Pages.forSite(site);
  let redirects = await Redirects.fromFilesystem(filesystem, REDIRECTS_PATH);

  const exiting = new AbortController();

  // TODO better integrate this into `Pages` so we can avoid a full rebuild
  // TODO better way to do this other than an IIFE?
  (async () => {
    for await (const { filename } of watch(site.root.path, { recursive: true, signal: exiting.signal })) {
      if (filename === REDIRECTS_PATH) {
        await setTimeout(500);
        if (!exiting.signal.aborted) {
          redirects = await Redirects.fromFilesystem(filesystem, REDIRECTS_PATH);
        }
        continue;
      }

      for (const key of Object.keys(require.cache)) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete
        delete require.cache[key];
      }

      await setTimeout(500);
      if (!exiting.signal.aborted) {
        pages = await Pages.forSite(site);
      }
    }
  })().catch(() => {
    // We don't want to log the error thrown from the abort
    void 0;
  });

  const server = Bun.serve({
    // Avoid "port already in use" errors during development
    reusePort: true,

    async fetch(request, _server) {
      const url = new URL(request.url);
      const pagePath = decodeURIComponent(url.pathname);

      let page: RenderedPage | undefined;
      const urlsToTry = uniq(
        compact([
          pagePath,
          pagePath.replace(/\/$/, ""),
          path.join(pagePath, "index"),
          path.join(pagePath, "index.html"),
        ]),
      );
      for (const url of urlsToTry) {
        page = await pages.page(url);
        if (page) {
          return new Response(Bun.gzipSync(page.content), {
            headers: {
              "content-type": mime.lookup(request.url) || "text/html",
              "content-encoding": "gzip",
            },
          });
        }
      }

      const staticFile = path.join(filesystem.path, "static", url.pathname);
      try {
        if ((await stat(staticFile)).isFile()) {
          // // @ts-ignore bun-types are superceded by @types/node
          return new Response(Bun.file(staticFile));
        }
      } catch (_e) {
        // fall through to 404
      }

      const redirect = redirects.match(pagePath);
      if (redirect) {
        return new Response(null, {
          status: redirect[1],
          headers: {
            location: redirect[0],
          },
        });
      }

      return new Response(
        `Not found

path: ${url.pathname}

possible paths:
- ${pages.urls().sort().join("\n- ")}
        `,
        { status: 404 },
      );
    },
  });

  const shutdown = () => {
    exiting.abort("process exiting");
    server
      .stop()
      .then(() => {
        process.exit(0);
      })
      .catch(console.error);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
};
