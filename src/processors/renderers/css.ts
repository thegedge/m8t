import tailwindcssNesting from "@tailwindcss/nesting";
import tailwindcssPlugin from "@tailwindcss/postcss";
import postcss from "postcss";
import postcssDiscardComments from "postcss-discard-comments";
import type { PageData } from "../../PageData.ts";
import type { Site } from "../../Site.ts";
import type { Processor } from "../../index.ts";

/**
 * A renderer that stringifies its content and processes it with PostCSS.
 */
export class CssRenderer implements Processor {
  private processor!: postcss.Processor;

  constructor(readonly site: Site) {}

  async process(data: PageData) {
    if (!data.filename.endsWith(".css")) {
      return;
    }

    if ("mimeType" in data) {
      return;
    }

    if (!data.content) {
      return;
    }

    await this.init();

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

  private async init() {
    this.processor ??= postcss(
      tailwindcssPlugin({ base: this.site.root.path }),
      tailwindcssNesting(),
      postcssDiscardComments,
    );
  }
}
