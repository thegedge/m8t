import postcss from "postcss";

import { BuildError } from "../../../errors/BuildError.js";
import type { MaybeArray } from "../../../types.js";
import type { Datum } from "../../Datum.js";
import type { SingleProcessor } from "../../index.js";
import { type DefaultContext } from "../../utils.js";
import { unthunked } from "./helpers.js";

const symRenderer = Symbol.for("renderer");
const symRenderedBy = Symbol.for("renderedBy");

/**
 * A renderer that processes CSS files with PostCSS.
 */
export class CssRenderer implements SingleProcessor {
  #processor: postcss.Processor;

  constructor(postcssPlugins?: postcss.AcceptedPlugin[]) {
    this.#processor = postcss(postcssPlugins);
  }

  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    if (datum.has(symRenderedBy)) {
      return datum;
    }

    const filename = datum.maybeGetString("filename");
    if (!filename) {
      return datum;
    }

    const renderer = datum.maybeGetString(symRenderer);
    if ((renderer && renderer !== "css") || !filename.endsWith(".css")) {
      return datum;
    }

    return datum.with({
      [symRenderedBy]: this,
      mimeType: "text/css",
      content: unthunked(datum, async (content) => {
        if (typeof content !== "string") {
          throw new BuildError(`datum for ${filename} did not render to a string`);
        }

        const result = await this.#processor.process(content, { from: filename });
        const warnings = result.warnings();
        if (warnings.length > 0) {
          console.warn(`Warnings while processing ${filename}:`, warnings.join("\n\n"));
        }

        return result.toString();
      }),
    });
  }
}
