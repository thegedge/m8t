import fs from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { Site } from "../site/Site.js";
import { createRequestHandler } from "./createRoutingServer.js";
import { Redirects } from "./Redirects.js";
import { debugPageGet } from "./routes/__debug/GET-[url].js";
import { debugGet } from "./routes/__debug/GET.js";
import { defaultRoute } from "./routes/GET-[...].js";

export const run = async (): Promise<void> => {
  const root = process.env.SITE_ROOT;
  if (!root) {
    throw new Error("Cannot run server because SITE_ROOT env var is not set");
  }

  if ((await fs.stat(root)).isDirectory() != true) {
    throw new Error("Cannot run server because SITE_ROOT is not a directory");
  }

  const site = await Site.forRoot(root);
  if (!site.devServer) {
    throw new Error("Cannot run server because site hasn't been configured with a dev server");
  }

  const exiting = new AbortController();
  const shutdown = () => {
    exiting.abort();
    setTimeout(() => {
      process.exit(1);
    }, 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runServer(site, exiting.signal);
};

/**
 * Build the request handler for a site: the `/__debug__` inspection routes, plus the default
 * route that serves the site's pages/static files (and follows redirects).
 *
 * This is deliberately free of any process/network concerns (env vars, signals, `listen`, etc.) so
 * it can be tested directly against lightweight fake request/response objects.
 */
export const createSiteHandler = (site: Site, redirects: Redirects | null) => {
  return createRequestHandler(
    {
      "/__debug__": {
        "/[url]": debugPageGet,
        "/[...]": debugGet,
      },
      "/[...]": defaultRoute,
    },
    { site, redirects },
  );
};

const runServer = async (site: Site, exiting: AbortSignal): Promise<void> => {
  // Eagerly load the data, instead of lazily on first request
  await site.data;

  const redirects = site.devServer!.redirectsPath
    ? await Redirects.fromFilesystem(site.root, site.devServer!.redirectsPath)
    : null;

  const server = createServer({}, createSiteHandler(site, redirects));

  server.listen({
    host: "0.0.0.0",
    port: site.devServer!.port,
    signal: exiting,
  });

  process.send?.("ready");
};

// Only run automatically when this module is the process's entry point (i.e. when forked as
// `server/entry.js`, per the contract with `cli/commands/serve.ts`), not when it's imported (e.g.
// by tests wanting `createSiteHandler` without the process/network side effects of `run`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(console.error);
}
