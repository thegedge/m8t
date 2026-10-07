import fs from "node:fs/promises";
import { createServer } from "node:http";
import { pathToFileURL } from "node:url";

import { EnvironmentError } from "../errors/EnvironmentError.js";
import { MissingOptionError } from "../errors/MissingOptionError.js";
import { Site } from "../site/Site.js";
import type { SiteData } from "../site/SiteData.js";
import { createRequestHandler } from "./createRoutingServer.js";
import { Redirects } from "./Redirects.js";
import { debugPageGet } from "./routes/__debug/GET-[url].js";
import { debugGet } from "./routes/__debug/GET.js";
import { defaultRoute } from "./routes/GET-[...].js";

export const run = async (controller = new AbortController()): Promise<void> => {
  const root = process.env.SITE_ROOT;
  if (!root) {
    throw new EnvironmentError("Cannot run server because SITE_ROOT env var is not set");
  }

  if ((await fs.stat(root)).isDirectory() != true) {
    throw new EnvironmentError("Cannot run server because SITE_ROOT is not a directory");
  }

  const site = await Site.forRoot(root);
  if (!site.devServer) {
    throw new MissingOptionError("devServer");
  }

  const shutdown = () => {
    controller.abort();
    setTimeout(() => {
      process.exit(1);
    }, 1000).unref();
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runServer(site, controller.signal);
};

/**
 * Build the request handler for a site: the `/__debug__` inspection routes, plus the default
 * route that serves the site's pages/static files (and follows redirects).
 *
 * This is deliberately free of any process/network concerns (env vars, signals, `listen`, etc.) so
 * it can be tested directly against lightweight fake request/response objects.
 */
export const createSiteHandler = (site: Site, siteData: SiteData, redirects: Redirects | null) => {
  return createRequestHandler(
    {
      "/__debug__": {
        "/[url]": debugPageGet,
        "/[...]": debugGet,
      },
      "/[...]": defaultRoute,
    },
    { site, siteData, redirects },
  );
};

/** @private */
export const runServer = async (site: Site, signal: AbortSignal): Promise<void> => {
  const siteData = await site.load({ signal });

  const redirects = site.devServer!.redirectsPath
    ? await Redirects.fromFilesystem(site.root, site.devServer!.redirectsPath, { signal })
    : null;

  const server = createServer({}, createSiteHandler(site, siteData, redirects));
  const { resolve, reject, promise } = Promise.withResolvers<void>();

  server.once("error", (err) => {
    reject(err);
  });

  server.listen(
    {
      host: "0.0.0.0",
      port: site.devServer!.port,
      signal,
    },
    () => {
      process.send?.("ready");
      resolve();
    },
  );

  await promise;
};

// Only run automatically when this module is the process's entry point (i.e. when forked as
// `server/entry.js`, per the contract with `cli/commands/serve.ts`), not when it's imported (e.g.
// by tests wanting `createSiteHandler` without the process/network side effects of `run`).
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  run().catch(console.error);
}
