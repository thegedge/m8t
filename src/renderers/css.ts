import tailwindcssNesting from "@tailwindcss/nesting";
import tailwindcssPlugin from "@tailwindcss/postcss";
import postcss from "postcss";
import postcssDiscardComments from "postcss-discard-comments";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { Renderer } from "./index.ts";

export class CssRenderer implements Renderer {
  private processor!: postcss.Processor;

  constructor(readonly site: Site) {}

  handles(page: PageData): boolean {
    if (typeof page.filename !== "string") {
      return false;
    }
    return page.filename.endsWith(".css");
  }

  async render(content: { content: string; filename: string }) {
    await this.init();

    const result = await this.processor.process(content.content, {
      from: content.filename,
    });

    const warnings = result.warnings();
    if (warnings.length > 0) {
      console.warn(`Warnings while processing ${content.filename}:`, warnings.join("\n\n"));
    }

    return result.toString();
  }

  private async init() {
    if (this.processor) {
      return;
    }

    this.processor = postcss(
      tailwindcssPlugin({ base: this.site.root.path }),
      tailwindcssNesting(),
      postcssDiscardComments,
    );
  }
}
