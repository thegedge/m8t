import postcss from "postcss";
import type { MaybeArray, SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import { type DefaultContext } from "../../utils.js";

/**
 * A renderer that stringifies its content and processes it with PostCSS.
 */
export class CssRenderer implements SingleProcessor {
  #processor!: postcss.Processor;

  async processOne(datum: Datum, _context: DefaultContext): Promise<MaybeArray<Datum>> {
    const filename = datum.get("filename");
    if (!filename.endsWith(".css")) {
      return datum;
    }

    const content = datum.get("content");
    if (typeof content !== "string") {
      return datum;
    }

    // TODO figure out how this plugin could tell `TypesProcessor` to ignore `postcssPlugins`
    const processor = await this.processor(datum.get("postcssPlugins") as postcss.Plugin[]);
    const result = await processor.process(content, { from: filename });
    const warnings = result.warnings();
    if (warnings.length > 0) {
      console.warn(`Warnings while processing ${filename}:`, warnings.join("\n\n"));
    }

    return datum.with({
      mimeType: "text/css",
      content: result.toString(),
    });
  }

  private async processor(postcssPlugins?: postcss.Plugin[]) {
    if (!this.#processor) {
      if (postcssPlugins) {
        this.#processor = postcss(postcssPlugins);
      } else {
        const tailwindcssNesting = await maybeImportDefault(import("@tailwindcss/nesting"));
        const tailwindcssPlugin = await maybeImportDefault(import("@tailwindcss/postcss"));
        const postcssDiscardComments = await maybeImportDefault(import("postcss-discard-comments"));
        this.#processor = postcss([tailwindcssNesting, tailwindcssPlugin, postcssDiscardComments].filter((v) => !!v));
      }
    }
    return this.#processor;
  }
}

const maybeImportDefault = async <T>(module: Promise<{ default: T }>): Promise<T | null> => {
  try {
    const { default: value } = await module;
    return value;
  } catch (e) {
    return null;
  }
};
