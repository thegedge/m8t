import type { MateRoute } from "../types.js";

export const debugGet: MateRoute = async ({ data: { site }, response }): Promise<void> => {
  // TODO if we guaranteed a unique identifier, we wouldn't need the concept of a URL
  const urls = await site.urls;

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
      ${urls.map((url) => `<a href="/__debug__/${encodeURIComponent(url)}">${url}</a>`).join("")}
    </div>
  </body>
</html>`.trimStart(),
  );
};
