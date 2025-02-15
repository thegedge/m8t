import { compile } from "@mdx-js/mdx";
import { readFile } from "fs/promises";
import parseFrontmatter from "gray-matter";
import { ElementContent, RootContent } from "hast";
import { MDXComponents } from "mdx/types";
import rehypeKatex from "rehype-katex";
import rehypeRewrite, { type RehypeRewriteOptions } from "rehype-rewrite";
import remarkDefinitionList from "remark-definition-list";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import { ContentFunction, Processor } from ".";
import { Fragment, createElement, jsxDEV, renderElementToHTML, type Node, type PropsWithChildren } from "../jsx";
import type { Site } from "../Site";
import { PageData } from "../types";

// eslint-disable-next-line @typescript-eslint/no-empty-function, @typescript-eslint/no-unsafe-member-access
const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor as new (
  source?: string,
) => (...args: unknown[]) => any;

export class MdxProcessor<DataT extends PageData> implements Processor<DataT> {
  constructor(readonly site: Site) {}

  handles(extension: string) {
    return extension == "md" || extension == "mdx";
  }

  async load(filename: string) {
    const fileContents = await readFile(filename);
    const { data, content: mdxSource } = parseFrontmatter(fileContents);

    const compiled = await compile(mdxSource, {
      format: "mdx",
      outputFormat: "function-body",
      development: process.env.NODE_ENV !== "production",
      providerImportSource: undefined,
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
                      nodes[1].push(child as any); // TODO fix this
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

    const { default: mdxContent, ...mdxData } = await new AsyncFunction(compiled.toString())({
      baseUrl: new URL(`file://` + filename),
      Fragment,
      jsx: createElement,
      jsxs: createElement,
      jsxDEV,
    });

    const content: ContentFunction = (props) => {
      // TODO figure out how to make TS happier here
      // eslint-disable-next-line @typescript-eslint/no-unsafe-call
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
