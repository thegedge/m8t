import tailwindcssNesting from "@tailwindcss/nesting";
import { readFile } from "fs/promises";
import path from "path";
import postcss from "postcss";
import postcssDiscardComments from "postcss-discard-comments";
import postcssImport from "postcss-import";
import tailwindcss from "tailwindcss";
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
    // TODO ideally do this on construction (e.g., an async factory)
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition
    if (this.processor) {
      return;
    }

    // TODO search for various configs
    // TODO remove casts below (without we get error `Excessive stack depth comparing types A and B`)
    const configFile = path.join(this.site.root.path, "tailwind.config.ts");
    const config: { options: tailwindcss.Config } = await import(configFile);
    this.processor = postcss(
      postcssImport({
        // TODO make this configurable
        path: [path.join(this.site.root.path, "src/includes/styles")],
      }),
      tailwindcssNesting(),
      tailwindcss({
        ...config.options,
        content: Array.isArray(config.options.content)
          ? config.options.content.map((pattern) => {
              if (typeof pattern === "string") {
                return path.join(this.site.root.path, pattern);
              }
              return pattern;
            })
          : config.options.content,
      }),
      postcssDiscardComments,
    );
  }
}
