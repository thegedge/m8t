import tailwindcssNesting from "@tailwindcss/nesting";
import tailwindcssPlugin from "@tailwindcss/postcss";
import postcss from "postcss";
import postcssDiscardComments from "postcss-discard-comments";
import type { MaybeArray, Processor } from "../../index.ts";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";

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

    const result = await this.processor.process(String(data.content), {
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

  private get processor() {
    this.#processor ??= postcss([tailwindcssNesting, tailwindcssPlugin, postcssDiscardComments]);
    return this.#processor;
  }
}
