import mime from "mime-types";
import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";

import type { MateRoute } from "./types.js";

export const defaultRoute: MateRoute = async ({ data: { redirects, site }, request, response }) => {
  const url = new URL(request.url ?? "", `https://${request.headers.host}`);
  const pagePath = decodeURIComponent(url.pathname);
  const urlsToTry = [
    pagePath,
    pagePath.replace(/\/$/, ""),
    path.join(pagePath, "index"),
    path.join(pagePath, "index.html"),
  ];
  for (const url of urlsToTry) {
    if (!url) {
      continue;
    }

    const data = await site.dataByUrl(url);
    if (!data) {
      continue;
    }

    const content = data.stringOrThrow("content");
    const mimeType = data.maybeGetString("mimeType") || mime.lookup(url) || "text/plain";

    response.writeHead(200, { "content-type": mimeType });
    response.end(content);
    return;
  }

  const staticFile = path.join(site.static.rootPath, pagePath);
  try {
    const statResult = await stat(staticFile);
    if (statResult.isFile()) {
      response.writeHead(200, {
        "Content-Type": mime.lookup(staticFile) || "application/octet-stream",
        "Content-Length": statResult.size,
      });

      const stream = createReadStream(staticFile, {
        autoClose: true,
        emitClose: true,
      });

      stream.on("error", (error) => {
        console.error("read stream error", error);
        response.destroy(error);
      });

      response.on("error", (error) => {
        console.error("response error", error);
        stream.destroy();
        response.destroy();
      });

      stream.pipe(response);

      return;
    }
  } catch {
    // fall through to 404
  }

  if (redirects) {
    const redirect = redirects.match(pagePath);
    if (redirect) {
      const [location, status] = redirect;
      if (status >= 300 && status < 400) {
        response.writeHead(status, { location });
        response.end();
      } else {
        response.writeHead(status);
        // TODO need to internally resolve the location and respond appropriately
        response.end("");
      }
      return;
    }
  }

  if (!response.headersSent) {
    const urls = await site.urls;
    if (!response.headersSent) {
      response.writeHead(404, { "Content-Type": "text/plain" });
    }
    response.end(
      `
        Not found
        path: ${url.pathname}

        Possible paths:
        - ${urls.join("\n  - ")}
      `
        .trim()
        .replaceAll(/^\s+/gm, ""),
    );
  }
};
