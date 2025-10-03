import { isEqual } from "lodash-es";
import type { IncomingMessage, ServerResponse } from "node:http";
import { symProcessedBy, symProcessingTimeMs, type Datum, type DatumShape } from "../../../pipeline/Datum.js";
import type { Site } from "../../../Site.js";

export const debugPageGet = async (site: Site, request: IncomingMessage, response: ServerResponse): Promise<void> => {
  const url = decodeURIComponent(request.url?.replace("/__debug__/", "") ?? "");
  const data = await site.dataByUrl(url);
  if (!data) {
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
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        // Ugh, styling custom components can be a pain :cry:
        const sheet = new CSSStyleSheet;
        sheet.replaceSync(".preview { margin-left: 1ch }");
        for (const host of document.querySelectorAll("json-viewer")) {
          host.shadowRoot.adoptedStyleSheets.push(sheet);
        }

        // When a <details> is clicked with the alt key pressed, toggle the open state of all <details>
        document.querySelectorAll("details").forEach((detail) => {
          detail.addEventListener("click", (event) => {
            if (event.altKey) {
              event.stopPropagation();
              event.preventDefault();

              let open = !detail.open;
              requestIdleCallback(() => {
                document.querySelectorAll("details").forEach((detail) => {
                  detail.open = open;
                });
              });
             }
          });
        });
      });
    </script>
  </head>
  <body>
    <h1>Debug -- ${url}</h1>
    <div class="column">
      ${jsonViewerForData(data.toRecord(), "final")}
      <h3>Lineage</h3>
      ${htmlForDataAndLineage(data)}
    </div>
  </body>
</html>`.trimStart(),
  );
};

const htmlForDataAndLineage = (data: Datum): string => {
  const lineage = [...data.lineage, data.toRecord()];
  return lineage
    .reverse()
    .map((data, index) => {
      const changedData =
        index < lineage.length - 1
          ? (Object.fromEntries(
              Reflect.ownKeys(data)
                .map((key) => {
                  const value = data[key];
                  if (!(key in lineage[index + 1])) {
                    return [key, value] as const;
                  }

                  const previousValue = lineage[index + 1]?.[key];
                  if (value === previousValue || isEqual(value, previousValue)) {
                    return;
                  }

                  return [key, value] as const;
                })
                .filter((entry) => entry !== undefined)
                .sort(([keyA], [keyB]) => String(keyA).localeCompare(String(keyB))),
            ) as DatumShape)
          : data;

      let processor: string;
      if (symProcessedBy in changedData) {
        processor = changedData[symProcessedBy]?.constructor?.name || "&lt;unknown&gt;";
      } else {
        processor = `&lt;unknown&gt;`;
      }

      const processingTimeMs = changedData[symProcessingTimeMs] ?? 0;

      return `
        <details>
          <summary>${processor} in ${processingTimeMs.toFixed(2)}ms</summary>
          ${jsonViewerForData(changedData, index)}
        </details>
      `;
    })
    .join("\n");
};

const jsonViewerForData = (data: DatumShape, id: string | number) => {
  return `
    <json-viewer id="data-${id}"></json-viewer>
    <script>
      document.addEventListener("DOMContentLoaded", () => {
        const wrapper = document.getElementById("data-${id}");
        wrapper.data = ${JSON.stringify(data, DatumJsonReplacer())};
      });
    </script>
  `;
};

const DatumJsonReplacer = () => {
  const seen = new Set<unknown>();
  return (key: string, value: unknown): unknown => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "<circular reference>";
      }

      seen.add(value);
    }

    switch (typeof value) {
      case "string":
        return value.length > 100 ? value.slice(0, 100) + "..." : value;
      case "object":
        if (value == null) {
          return value;
        }

        if ("$$typeof" in value && "type" in value) {
          const type = value.type;
          if (typeof type !== "object" || (type && type.constructor !== Object.prototype.constructor)) {
            return `<React (${String(type)})>`;
          }
        }

        return value;
      case "function":
        return value.name ? `<function ${value.name}>` : "<function>";
      default:
        return value;
    }
  };
};
