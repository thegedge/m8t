import path from "node:path";
import { symProcessedBy, symProcessingTimeMs, type Datum, type DatumShape } from "../../../pipeline/Datum.js";
import { deepCompare } from "../../../utils/deepCompare.js";
import { truncate } from "../../../utils/truncate.js";
import type { MateRoute } from "../types.js";

export const debugPageGet: MateRoute = async ({ data: { site }, params: { url }, response }): Promise<void> => {
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

const htmlForDataAndLineage = (datum: Datum): string => {
  const lineage = [...datum.lineage, datum.toRecord()];
  return lineage
    .reverse()
    .map((lineageRecord, index) => {
      const changedRecord =
        index < lineage.length - 1
          ? (Object.fromEntries(
              Reflect.ownKeys(lineageRecord)
                .map((key) => {
                  // TODO extract this to a util
                  const value = lineageRecord[key];
                  if (!(key in lineage[index + 1])) {
                    return [key, value] as const;
                  }

                  const previousValue = lineage[index + 1]?.[key];
                  if (value === previousValue || deepCompare(value, previousValue) === 0) {
                    return;
                  }

                  return [key, value] as const;
                })
                .filter((entry) => entry !== undefined)
                .sort(([keyA], [keyB]) => String(keyA).localeCompare(String(keyB))),
            ) as DatumShape)
          : lineageRecord;

      let processorName: string;
      if (symProcessedBy in changedRecord) {
        const processor = changedRecord[symProcessedBy];
        const processorConstructorName = processor?.constructor?.name;
        if (processorConstructorName) {
          processorName = processorConstructorName;
        } else {
          processorName = `&lt;${truncate(JSON.stringify(processor))}&gt;`;
        }
      } else if (/\/_data\..+$/.test(changedRecord.filename)) {
        processorName = `&lt;data ${path.relative(datum.stringOrThrow("basePath"), changedRecord.filename)}&gt;`;
      } else if (index < lineage.length - 1 && "layout" in lineage[index + 1]) {
        processorName = `&lt;layout ${lineage[index + 1].layout}&gt;`;
      } else {
        processorName = `&lt;unknown&gt;`;
      }

      const processingTimeMs = changedRecord[symProcessingTimeMs] ?? 0;

      return `
        <details>
          <summary>${processorName} in ${processingTimeMs.toFixed(2)}ms</summary>
          ${jsonViewerForData(changedRecord, index)}
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
  return (_key: string, value: unknown): unknown => {
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

        return Object.fromEntries(Object.entries(value).sort((a, b) => String(a[0]).localeCompare(String(b[0]))));
      case "function":
        return value.name ? `<function ${value.name}>` : "<function>";
      default:
        return value;
    }
  };
};
