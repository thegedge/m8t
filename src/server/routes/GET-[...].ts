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
    const mimeType = data.maybeGetString("mimeType") || mime.lookup(url) || "text/html";

    response.writeHead(200, { "content-type": mimeType });
    response.end(content);
    return;
  }

  const staticFile = path.join(site.static.path, pagePath);
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
        if (!response.writableEnded) {
          if (!response.headersSent) {
            response.writeHead(500, { "Content-Type": "text/plain" });
          }
          response.end(JSON.stringify(error, null, 2));
        }
      });

      response.on("error", (error) => {
        console.error("response error", error);
        stream.destroy();
        response.destroy();
      });

      stream.pipe(response);

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
