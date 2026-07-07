import fs from "node:fs/promises";

import { Site } from "../Site.js";
import { createRoutingServer } from "./createRoutingServer.js";
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
      process.exit(0);
    }, 1000);
  };
  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);

  await runServer(site, exiting.signal);
};

const runServer = async (site: Site, exiting: AbortSignal): Promise<void> => {
  // Eagerly load the data, instead of lazily on first request
  await site.data;

  const redirects = site.devServer!.redirectsPath
    ? await Redirects.fromFilesystem(site.root, site.devServer!.redirectsPath)
    : null;

  const server = createRoutingServer(
    {
      "/__debug__": {
        "/[url]": debugPageGet,
        "/[...]": debugGet,
      },
      "/[...]": defaultRoute,
    },
    { site, redirects },
  );

  server.listen({
    host: "0.0.0.0",
    port: site.devServer!.port,
    signal: exiting,
  });

  process.send?.("ready");
};

run().catch(console.error);
