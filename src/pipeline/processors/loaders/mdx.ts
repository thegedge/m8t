import { compile } from "@mdx-js/mdx";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm, { createContext, SyntheticModule } from "node:vm";
import rehypeKatex from "rehype-katex";
import remarkDefinitionList, { defListHastHandlers } from "remark-definition-list";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import type { SingleProcessor } from "../../../index.js";
import type { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";

/**
 * A loader that processes markdown and MDX files.
 *
 * The resulting content will be a React element.
 */
export class MdxLoader implements SingleProcessor {
  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    const filename = datum.get("filename");
    if (!filename.endsWith(".md") && !filename.endsWith(".mdx")) {
      return datum;
    }

    const fileContents = await readFile(filename);
    const baseUrl = new URL("file://" + filename);

    const compiled = await compile(fileContents, {
      format: "mdx",
      outputFormat: "program",
      development: context.site.isDevelopment,
      baseUrl,

      remarkRehypeOptions: {
        handlers: defListHastHandlers,
      },

      // TODO make these configurable
      // TODO add a plugin to remove a single <p> element nested in another element, due to how interleaving works in MDX v2
      //      See https://github.com/rehypejs/rehype-unwrap-images/blob/main/lib/index.js for an example of how to write such a plugin
      remarkPlugins: [remarkDefinitionList, remarkGfm, remarkMath],
      rehypePlugins: [[rehypeKatex, { strict: true }]],
    });

    const mdxContext = createContext({ parentURL: baseUrl });

    let mdxData: any;
    let mdxContent: any;
    try {
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
      ({ default: mdxContent, ...mdxData } = mdxModule.namespace as unknown as Record<string, any>);
    } catch (e) {
      throw e;
    }

    return datum.with({
      ...mdxData,
      content: (props: any) => mdxContent(props),
    });
  }
}
