import tailwindcssNesting from "@tailwindcss/nesting";
import tailwindcssPlugin from "@tailwindcss/postcss";
import { readFile } from "fs/promises";
import postcss from "postcss";
import postcssDiscardComments from "postcss-discard-comments";
import type { PageData } from "../index.ts";
import type { Site } from "../Site.ts";
import type { Processor } from "./index.ts";

export class CssProcessor<DataT extends PageData> implements Processor<DataT> {
  private processor!: postcss.Processor;

  constructor(readonly site: Site) {}

  handles(extension: string) {
    return extension === "css";
  }

  async load(filename: string) {
    await this.init();

    const content = await readFile(filename, "utf8");
    return {
      data: {},
      content: () => ({ content, filename }),
    };
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
