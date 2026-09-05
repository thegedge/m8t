import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Datum } from "../../../../src/pipeline/Datum.js";
import { MdxLoader } from "../../../../src/pipeline/processors/loaders/mdx.js";
import { dedent } from "../../../../src/utils/dedent.js";
import { unthunk } from "../../../../src/utils/unthunk.js";
import { makeContext, writeFixtures, type TestContext } from "../../../helpers.js";

describe("MdxLoader", () => {
  let mdxRoot: string;
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext({ pipelines: {} });
    mdxRoot = context.root;
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  const writeMdxFixtures = async (files: Record<string, string>) => {
    await writeFixtures(mdxRoot, files);

    const node_modules = path.join(mdxRoot, "node_modules");
    await fs.mkdir(node_modules, { recursive: true });
    await fs.cp(
      path.join(__dirname, "../../../../node_modules/react/"),
      path.join(node_modules, "react"),
      { recursive: true },
    );
  };

  const datumFor = (relativePath: string): Datum =>
    new Datum({ basePath: mdxRoot, filename: path.join(mdxRoot, relativePath) });

  describe("with no plugins", () => {
    let loader: MdxLoader;

    beforeEach(async () => {
      loader = new MdxLoader({});
      loader.init(context.site);
    });

    test("passes the datum through unchanged for files that aren't .md or .mdx", async () => {
      const datum = datumFor("notes.txt");

      const result = await loader.processOne(datum, context);

      expect(result).toBe(datum);
    });

    test.each([
      { file: "page.md", markdown: "# hello", expectedHtml: "<h1>hello</h1>" },
      { file: "page.mdx", markdown: "# hello", expectedHtml: "<h1>hello</h1>" },
    ])("compiles $file into renderable content", async ({ file, markdown, expectedHtml }) => {
      await writeMdxFixtures({ [file]: markdown });
      const datum = datumFor(file);

      const result = await loader.processOne(datum, context);

      const content = unthunk(result.get("content"));
      await expect(content).toRenderTo(expectedHtml);
    });

    test("exposes mdx-level exports on the datum, but not the default export", async () => {
      await writeMdxFixtures({
        "with-exports.mdx": dedent`
          export const title = "my title";

          # hi
        `,
      });
      const datum = datumFor("with-exports.mdx");

      const result = await loader.processOne(datum, context);

      expect(result.get("title")).toBe("my title");
      expect(result.has("default")).toBe(false);
    });

    test("imports a bare specifier", async () => {
      await writeMdxFixtures({
        "bare-import.mdx": dedent`
          import { useState } from 'react';

          export const hasHook = typeof useState;
        `,
      });
      const datum = datumFor("bare-import.mdx");

      const result = await loader.processOne(datum, context);

      expect(result.get("hasHook")).toBe("function");
    });

    test("imports a relative module and can use its exports", async () => {
      await writeMdxFixtures({
        "helper.mjs": dedent`
          export const greeting = "hi";
        `,
        "relative-import.mdx": dedent`
          import { greeting } from './helper.mjs';

          export const g = greeting;
        `,
      });
      const datum = datumFor("relative-import.mdx");

      const result = await loader.processOne(datum, context);

      expect(result.get("g")).toBe("hi");
    });

    test("resolves a nested module's relative imports against that module", async () => {
      await writeMdxFixtures({
        "helper.mjs": dedent`
          export const greeting = 'outer';
        `,
        "nested/helper.mjs": dedent`
          export const greeting = 'inner';
        `,
        "nested/inner.mdx": dedent`
          import { greeting } from './helper.mjs';

          export const innerGreeting = greeting;
        `,
        "nested-relative.mdx": dedent`
          export { innerGreeting } from './nested/inner.mdx';

          # hi
        `,
      });
      const datum = datumFor("nested-relative.mdx");

      const result = await loader.processOne(datum, context);

      expect(result.get("innerGreeting")).toBe("inner");
    });

    test("loads files whose path contains url-significant characters", async () => {
      await writeMdxFixtures({
        "od#d 100%/helper.mdx": dedent`
          export const greeting = 'hi';
        `,
        "od#d 100%/page.mdx": dedent`
          import { greeting } from './helper.mdx';

          export const g = greeting;
        `,
      });
      const datum = datumFor("od#d 100%/page.mdx");

      const result = await loader.processOne(datum, context);

      expect(result.get("g")).toBe("hi");
    });

    test("supports dynamic imports", async () => {
      await writeMdxFixtures({
        "helper.mjs": dedent`
          export const greeting = 'dynamic hi';
        `,
        "dynamic-import.mdx": dedent`
          export const load = async () => (await import('./helper.mjs')).greeting;

          # hi
        `,
      });
      const datum = datumFor("dynamic-import.mdx");

      const result = await loader.processOne(datum, context);

      const load = result.get("load") as () => Promise<string>;
      await expect(load()).resolves.toBe("dynamic hi");
    });

    test("rejects when the mdx contains invalid syntax", async () => {
      await writeMdxFixtures({ "broken.mdx": "<Broken\n" });
      const datum = datumFor("broken.mdx");

      await expect(loader.processOne(datum, context)).rejects.toThrow();
    });

    test("rejects when the mdx references import.meta.url", async () => {
      await writeMdxFixtures({ "meta-url.mdx": "export const url = import.meta.url;\n" });
      const datum = datumFor("meta-url.mdx");

      await expect(loader.processOne(datum, context)).rejects.toThrow();
    });
  });

  describe("with plugins", () => {
    test("applies configured remark plugins during compilation", async () => {
      const loader = new MdxLoader({
        remarkPlugins: [
          function upcaseText() {
            const walk = (node: any) => {
              if (node.type === "text") {
                node.value = node.value.toUpperCase();
              }
              node.children?.forEach(walk);
            };
            return walk;
          },
        ],
      });
      loader.init(context.site);

      await writeMdxFixtures({ "plugin.md": "hello world" });
      const datum = datumFor("plugin.md");

      const result = await loader.processOne(datum, context);

      const content = unthunk(result.get("content"));
      await expect(content).toRenderTo("<p>HELLO WORLD</p>");
    });
  });
});
