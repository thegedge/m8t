import postcss from "postcss";

import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import { type DefaultContext } from "../../utils.js";

/**
 * A renderer that processes CSS files with PostCSS.
 */
export class CssRenderer implements SingleProcessor {
  #processor: postcss.Processor;

  constructor(postcssPlugins?: postcss.Plugin[]) {
    this.#processor = postcss(postcssPlugins);
  }

  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const filename = datum.get("filename");
    if (!filename.endsWith(".css")) {
      return datum;
    }

    const content = datum.get("content");
    if (typeof content !== "string") {
      return datum;
    }

    const result = await this.#processor.process(content, { from: filename });
    const warnings = result.warnings();
    if (warnings.length > 0) {
      console.warn(`Warnings while processing ${filename}:`, warnings.join("\n\n"));
    }

    return datum.with({
      mimeType: "text/css",
      content: result.toString(),
    });
  }
}
