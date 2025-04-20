import type { IncomingMessage, ServerResponse } from "node:http";
import type { Site } from "../../../../../Site.ts";

export const debugGet = async (site: Site, _request: IncomingMessage, response: ServerResponse): Promise<void> => {
  response.writeHead(200, { "content-type": "text/html" });
  response.end(
    `
<html>
  <head>
    <style>
      :host ul,
      :root ul {
        margin: 0;
      }

      body {
        font-family: monospace;
        padding: 1rem;
      }

      .column {
        display: flex;
        flex-direction: column;
        gap: 0.1rem;
      }
    </style>
    <link href="https://unpkg.com/@alenaksu/json-viewer@2.1.2/dist/json-viewer.bundle.js" rel="preload" as="script">
  </head>
  <body>
    <h1>Debug</h1>
    <div class="column">
      ${Array.from(site.pages.pages.keys())
        .sort()
        .map((url) => `<a href="/__debug__/${encodeURIComponent(url)}">${url}</a>`)
        .join("")}
    </div>
  </body>
</html>`.trimStart(),
  );
};
