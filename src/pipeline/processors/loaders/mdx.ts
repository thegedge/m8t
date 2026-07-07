import { compile, type CompileOptions } from "@mdx-js/mdx";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm, { createContext, SyntheticModule } from "node:vm";

import type { SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

type MdxOptions = Omit<CompileOptions, "format" | "outputFormat" | "development" | "baseUrl">;

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

  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (!filename.endsWith(".md") && !filename.endsWith(".mdx")) {
      return datum;
    }

    const fileContents = await readFile(filename);
    const baseUrl = new URL("file://" + filename);

    const compiled = await compile(fileContents, {
      ...this.#mdxOptions,
      format: "mdx",
      outputFormat: "program",
      development: context.site.isDevelopment,
      baseUrl,
    });

    const mdxContext = createContext({ parentURL: baseUrl });

    // TODO figure out why I had to do this instead of just using things directly, and then document the "why"
    const mdxModule = new vm.SourceTextModule(compiled.toString(), {
      identifier: filename,
      context: mdxContext,
      initializeImportMeta(meta) {
        meta.dirname = path.dirname(filename);
        meta.filename = filename;
        meta.url = baseUrl.toString();
      },
    });
    await mdxModule.link(async (specifier, _referencingModule, _extra) => {
      const resolved = import.meta.resolve(specifier, baseUrl.toString());
      const mod = await import(resolved);
      const exportNames = Object.keys(mod).filter((name) => name != "module.exports");
      return new SyntheticModule(
        exportNames,
        function () {
          for (const exportName of exportNames) {
            this.setExport(exportName, mod[exportName]);
          }
        },
        { context: mdxContext, identifier: specifier },
      );
    });
    await mdxModule.evaluate();

    const { default: mdxContent, ...mdxData } = mdxModule.namespace as unknown as Record<
      string,
      any
    >;
    return datum.with({
      ...mdxData,
      content: (props: any) => mdxContent(props),
    });
  }
}
