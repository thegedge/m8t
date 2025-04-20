import type { IncomingMessage, ServerResponse } from "node:http";
import { symLineage, symProcessingTime, symProcessor, type PageData } from "../../../../../PageData.ts";
import type { Site } from "../../../../../Site.ts";

export const debugPageGet = async (site: Site, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = decodeURIComponent(request.url?.replace("/__debug__/", "") ?? "");
  const page = site.pages.pages.get(url);
  if (!page) {
    response.writeHead(404, { "content-type": "text/html" });
    response.end("Not found");
    return;
  }

  response.writeHead(200, { "content-type": "text/html" });
  response.end(
    `
<html>
  <head>
    <style>
      :host ul,
      :root ul {
        margin: 0;
        padding: 0;
      }

      body {
        font-family: monospace;
        padding: 1rem;
      }

      summary {
        font-weight: bold;
        cursor: pointer;

        &:hover {
          text-decoration: underline;
        }
      }

      .column {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      json-viewer {
        margin-left: 1rem;

        /* Background, font and indentation */
        --background-color: #ffffff;
        --color: #000000;
        --font-family: monospace;
        --font-size: 0.8rem;
        --line-height: 1rem;

        --indent-size: 0.5em;
        --indentguide-size: 1px;
        --indentguide-style: solid;
        --indentguide-color: #333;
        --indentguide-color-active: #666;
        --indentguide: var(--indentguide-size) var(--indentguide-style) var(--indentguide-color);
        --indentguide-active: var(--indentguide-size) var(--indentguide-style) var(--indentguide-color-active);

        --outline-color: #e0e4e5;
        --outline-width: 1px;
        --outline-style: dotted;

        /* Types colors */
        --string-color: #336622;
        --number-color: #112266;
        --boolean-color: #4ba7ef;
        --null-color: #441144;
        --property-color: #000000;

        /* Collapsed node preview */
        --preview-color: #deae8f;
      }
    </style>
    <script src="https://unpkg.com/@alenaksu/json-viewer@2.1.2/dist/json-viewer.bundle.js"></script>
  </head>
  <body>
    <h1>Debug -- ${url}</h1>
    <div class="column">
      ${htmlForData(page, true)}
    </div>
  </body>
</html>`.trimStart(),
  );
};

let idCounter = 1;

const htmlForData = (data: PageData, first = false): string => {
  const id = idCounter++;
  const { processor, processingTimeMs } = summaryForData(data);
  return `
    <details ${first ? "open" : ""}>
      <summary>${processor} in ${processingTimeMs}</summary>
      <json-viewer id="data-${id}"></json-viewer>
      <script>
      document.addEventListener("DOMContentLoaded", () => {
        const wrapper = document.getElementById("data-${id}");
        wrapper.data = ${JSON.stringify(data, (key, value) => {
          if (key === "content") {
            return "<omitted>";
          }
          return value;
        })};
      });
      </script>
    </details>
    ${data[symLineage] ? htmlForData(data[symLineage]) : ""}
  `;
};

const summaryForData = (data: PageData) => {
  if (!(symProcessor in data)) {
    return {
      processor: `&lt;${symLineage in data ? "data" : "root"}&gt;`,
      processingTimeMs: `${(data[symProcessingTime] ?? 0).toFixed(2)}ms`,
    };
  }

  return {
    processor: data[symProcessor]?.constructor?.name || "&lt;unknown processor&gt;",
    processingTimeMs: `${(data[symProcessingTime] ?? 0).toFixed(2)}ms`,
  };
};
