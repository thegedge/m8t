import { compile, type CompileOptions } from "@mdx-js/mdx";
import { pathToFileURL } from "node:url";

import { LoadError } from "../../../errors/LoadError.js";
import type { Transpiler } from "../../../loader/ModuleLoader.js";
import type { Site } from "../../../site/Site.js";
import type { Datum } from "../../Datum.js";
import type { SingleProcessor } from "../../index.js";
import type { DefaultContext } from "../../utils.js";

export type MdxOptions = Omit<
  CompileOptions,
  "format" | "outputFormat" | "development" | "baseUrl"
>;

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

  transpilersFor(site: Site): Transpiler[] {
    return [(filename, source) => this.#compile(filename, source, site.isDevelopment)];
  }

  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (!MARKDOWN_PATH_REGEX.test(filename)) {
      return datum;
    }

    const { default: mdxContent, ...mdxData } = await context.site.loader.load(filename);
    if (typeof mdxContent != "function") {
      throw new LoadError(`expected default MDX export to be a function in ${filename}`, {
        filename,
      });
    }

    return datum.with({
      ...mdxData,
      content: (props: any) => mdxContent(props),
    });
  }

  async #compile(filename: string, source: Uint8Array, development = false) {
    if (!MARKDOWN_PATH_REGEX.test(filename)) {
      return undefined;
    }

    const compiled = await compile(source, {
      ...this.#mdxOptions,
      format: filename.endsWith(".mdx") ? "mdx" : "md",
      outputFormat: "program",
      development,
      baseUrl: pathToFileURL(filename),
    });

    return String(compiled);
  }
}
