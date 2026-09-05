import { compile, type CompileOptions } from "@mdx-js/mdx";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

import type { SingleProcessor, Site } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

type MdxOptions = Omit<CompileOptions, "format" | "outputFormat" | "development" | "baseUrl">;

// TODO maybe we can make this an import hook instead?

const MARKDOWN_PATH_REGEX = /\.mdx?$/;

/**
 * A loader that processes markdown and MDX files.
 *
 * The resulting content will be a React element, and all exported values in MDX will be available
 * in the returned data.
 */
export class MdxLoader implements SingleProcessor {
  readonly #mdxOptions: MdxOptions;

  constructor(options: MdxOptions) {
    this.#mdxOptions = options;
  }

  init(site: Site): void {
    site.loader.use((filename) => this.#compile(filename, site.isDevelopment));
  }

  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (!MARKDOWN_PATH_REGEX.test(filename)) {
      return datum;
    }

    const { default: mdxContent, ...mdxData } = await context.site.loader.load(filename);
    if (typeof mdxContent != "function") {
      throw new Error("expected default MDX export to be a function");
    }

    return datum.with({
      ...mdxData,
      content: (props: any) => mdxContent(props),
    });
  }

  async #compile(filename: string, development = false) {
    if (!MARKDOWN_PATH_REGEX.test(filename)) {
      return undefined;
    }

    const fileContents = await readFile(filename);

    const compiled = await compile(fileContents, {
      ...this.#mdxOptions,
      format: filename.endsWith(".mdx") ? "mdx" : "md",
      outputFormat: "program",
      development,
      baseUrl: pathToFileURL(filename),
    });

    return String(compiled);
  }
}
