import { compile } from "@mdx-js/mdx";
import parseFrontmatter from "gray-matter";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm, { createContext, SyntheticModule } from "node:vm";
import rehypeKatex from "rehype-katex";
import remarkDefinitionList, { defListHastHandlers } from "remark-definition-list";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkRehype from "remark-rehype";
import type { Site } from "../Site.ts";
import type { Loader } from "./index.ts";

export class MdxLoader implements Loader {
  providerImportSource = import.meta.resolve("../jsx.js");

  constructor(readonly site: Site) {}

  handles(filename: string) {
    return filename.endsWith(".md") || filename.endsWith(".mdx");
  }

  async load(filename: string) {
    const fileContents = await readFile(filename);
    const { data, content: mdxSource } = parseFrontmatter(fileContents);
    const baseUrl = new URL(`file://` + filename);

    const compiled = await compile(mdxSource, {
      format: "mdx",
      outputFormat: "program",
      development: process.env.NODE_ENV !== "production",
      baseUrl,

      // TODO make these configurable
      remarkPlugins: [
        remarkDefinitionList,
        remarkGfm,
        remarkMath,
        [
          remarkRehype,
          {
            handlers: defListHastHandlers,
          },
        ],
      ],
      rehypePlugins: [rehypeKatex],
    });

    const context = createContext({ parentURL: baseUrl });

    let mdxData: any;
    let mdxContent: any;
    try {
      const mdxModule = new vm.SourceTextModule(compiled.toString(), {
        identifier: filename,
        context,
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
          { context, identifier: specifier },
        );
      });
      await mdxModule.evaluate();
      ({ default: mdxContent, ...mdxData } = mdxModule.namespace as unknown as Record<string, any>);
    } catch (e) {
      throw e;
    }

    return {
      ...data,
      ...mdxData,
      filename,
      content: (props: any) => {
        return mdxContent({
          ...props,
          components: props.data.components,
        });
      },
    };
  }
}
