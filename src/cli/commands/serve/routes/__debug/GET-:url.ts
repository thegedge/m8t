import { isEqual } from "lodash-es";
import type { IncomingMessage, ServerResponse } from "node:http";
import { symLineage, symProcessingTime, symProcessor, type PageData } from "../../../../../PageData.js";
import type { Site } from "../../../../../Site.js";

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
    <script>
      document.addEventListener("DOMContentLoaded", () => {
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
      ${htmlForData(page, "final", true)}
      <h3>Lineage</h3>
      ${htmlForDataAndLineage(page)}
    </div>
  </body>
</html>`.trimStart(),
  );
};

const htmlForDataAndLineage = (data: PageData): string => {
  const lineage = lineageArrayForData(data);
  return lineage
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
            ) as PageData)
          : data;

      return htmlForData(changedData, index);
    })
    .join("\n");
};

const htmlForData = (data: PageData, id: string | number, open = false): string => {
  const { processor, processingTimeMs } = summaryForData(data);
  return `
    <details${open ? " open" : ""}>
      <summary>${processor} in ${processingTimeMs}</summary>
      <json-viewer id="data-${id}"></json-viewer>
      <script>
      document.addEventListener("DOMContentLoaded", () => {
        const wrapper = document.getElementById("data-${id}");
        wrapper.data = ${JSON.stringify(data, pageDataJsonReplacer)};
      });
      </script>
    </details>
  `;
};

const lineageArrayForData = (data: PageData): PageData[] => {
  const lineage = [];
  while (data) {
    lineage.push(data);
    data = data[symLineage]!;
  }
  return lineage;
};

const pageDataJsonReplacer = (key: string, value: unknown): unknown => {
  if (key === "content") {
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

        const name = value.constructor?.name;
        return name && name !== "Object" ? `<object (${name})>` : "<object>";
      case "function":
        return value.name ? `<function (${value.name})>` : "<function>";
      default:
        return value;
    }
  }

  if (typeof value === "function") {
    // TODO maybe see if there's a nicer way to format this
    return value.name ?? `<function name="${value.toString().slice(0, 100)}">`;
  }

  return value;
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
