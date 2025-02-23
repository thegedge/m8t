import { compile } from "@mdx-js/mdx";
import parseFrontmatter from "gray-matter";
import type { ElementContent, RootContent } from "hast";
import type { MDXComponents } from "mdx/types.d.ts";
import { readFile } from "node:fs/promises";
import path from "node:path";
import vm, { createContext, SyntheticModule } from "node:vm";
import rehypeKatex from "rehype-katex";
import rehypeRewrite, { type RehypeRewriteOptions } from "rehype-rewrite";
import remarkDefinitionList from "remark-definition-list";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { createElement, Fragment, renderElementToHTML, type Node, type PropsWithChildren } from "../jsx.ts";
import type { Site } from "../Site.ts";
import type { PageData } from "../types.ts";
import type { ContentFunction, Processor } from "./index.ts";

export class MdxProcessor<DataT extends PageData> implements Processor<DataT> {
  providerImportSource = import.meta.resolve("../jsx.js");

  constructor(readonly site: Site) {}

  handles(extension: string) {
    return extension == "md" || extension == "mdx";
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

      remarkPlugins: [remarkDefinitionList, remarkGfm, remarkMath],
      rehypePlugins: [
        rehypeKatex,
        [
          rehypeRewrite,
          {
            rewrite(node, _index, _parent) {
              // Add a wrapper that sits inside of the _createMdxContent function
              if (node.type == "root") {
                const [outerChildren, innerChildren] = node.children.reduce<[RootContent[], ElementContent[]]>(
                  (nodes, child) => {
                    if (child.type == "doctype") {
                      nodes[0].push(child);
                    } else {
                      nodes[1].push(child as any); // TODO see if we can make this work without `as any
                    }
                    return nodes;
                  },
                  [[], []],
                );

                node.children = [
                  ...outerChildren,
                  {
                    type: "mdxJsxFlowElement",
                    name: "InnerWrapper",
                    position: node.position,
                    attributes: [],
                    data: {
                      _mdxExplicitJsx: true,
                    },
                    children: innerChildren,
                  },
                ];
              }
            },
          } satisfies RehypeRewriteOptions,
        ],
      ],
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

    const content: ContentFunction = (props) => {
      return mdxContent({
        ...props,
        components: {
          InnerWrapper: ({ children }: PropsWithChildren) => {
            return createElement(Fragment, null, children);
          },
          ...(props.data.components as MDXComponents | undefined),
        },
      });
    };

    return {
      data: {
        ...data,
        ...mdxData,
      } as unknown as Partial<DataT>,
      content,
    };
  }

  async render(content: Node) {
    return renderElementToHTML(content);
  }
}
