import postcss from "postcss";
import type { MaybeArray, Processor } from "../../index.js";
import type { PageData } from "../../PageData.js";
import type { Site } from "../../Site.js";

/**
 * A renderer that stringifies its content and processes it with PostCSS.
 */
export class CssRenderer implements Processor {
  #processor!: postcss.Processor;

  async process(_site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined> {
    if (!data.filename.endsWith(".css")) {
      return;
    }

    if ("mimeType" in data) {
      return;
    }

    if (!data.content) {
      return;
    }

    const processor = await this.processor(data.postcssPlugins as postcss.Plugin[]);
    const result = await processor.process(String(data.content), {
      from: data.filename,
    });

    const warnings = result.warnings();
    if (warnings.length > 0) {
      console.warn(`Warnings while processing ${data.filename}:`, warnings.join("\n\n"));
    }

    return {
      ...data,
      mimeType: "text/css",
      content: result.toString(),
    };
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
