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

  const urls = await site.urls;

  response.writeHead(404);
  response.end(`
Not found
path: ${url.pathname}

Possible paths:
- ${urls.join("\n  - ")}
`);
};
