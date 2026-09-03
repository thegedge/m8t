import fs from "node:fs";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Datum } from "../../../../src/pipeline/Datum.js";
import { MdxLoader } from "../../../../src/pipeline/processors/loaders/mdx.js";
import { unthunk } from "../../../../src/utils/unthunk.js";
import { makeContext, writeFixtures, type TestContext } from "../../../helpers.js";

describe("MdxLoader", () => {
  let mdxRoot: string;
  let context: TestContext;
  let loader: MdxLoader;

  beforeEach(async () => {
    const repoRoot = path.resolve(import.meta.dirname, "../../../../");
    mdxRoot = await fs.promises.mkdtemp(path.join(repoRoot, "node_modules", "m8t-mdx-test-"));
    context = await makeContext({ pipelines: {} });
    loader = new MdxLoader({});
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
    await fs.promises.rm(mdxRoot, { recursive: true, force: true });
  });

  const writeMdxFixtures = (files: Record<string, string>) => writeFixtures(mdxRoot, files);

  const datumFor = (relativePath: string): Datum =>
    new Datum({ basePath: mdxRoot, filename: path.join(mdxRoot, relativePath) });

  test("passes the datum through unchanged for files that aren't .md or .mdx", async () => {
    const datum = datumFor("notes.txt");

    const result = await loader.processOne(datum, context);

    expect(result).toBe(datum);
  });

  test.each([
    { file: "page.mdx", markdown: "# hello\n", expectedHtml: "<h1>hello</h1>" },
    { file: "page.md", markdown: "# hello\n", expectedHtml: "<h1>hello</h1>" },
  ])("compiles $file into renderable content", async ({ file, markdown, expectedHtml }) => {
    await writeMdxFixtures({ [file]: markdown });
    const datum = datumFor(file);

    const result = await loader.processOne(datum, context);

    const content = unthunk(result.get("content"));

    await expect(content).toRenderTo(expectedHtml);
  });

  test("exposes mdx-level exports on the datum, but not the default export", async () => {
    await writeMdxFixtures({
      "with-exports.mdx": 'export const title = "my title";\n\n# hi\n',
    });
    const datum = datumFor("with-exports.mdx");

    const result = await loader.processOne(datum, context);

    expect(result.get("title")).toBe("my title");
    expect(result.has("default")).toBe(false);
  });

  test("imports a bare specifier", async () => {
    await writeMdxFixtures({
      "bare-import.mdx":
        "import { useState } from 'react';\n\nexport const hasHook = typeof useState;\n",
    });
    const datum = datumFor("bare-import.mdx");

    const result = await loader.processOne(datum, context);

    expect(result.get("hasHook")).toBe("function");
  });

  test("imports a relative module and can use its exports", async () => {
    await writeMdxFixtures({
      "helper.mjs": "export const greeting = 'hi';\n",
      "relative-import.mdx":
        "import { greeting } from './helper.mjs';\n\nexport const g = greeting;\n",
    });
    const datum = datumFor("relative-import.mdx");

    const result = await loader.processOne(datum, context);

    expect(result.get("g")).toBe("hi");
  });

  test("applies configured remark plugins during compilation", async () => {
    const upcaseText = () => (tree: any) => {
      const walk = (node: any) => {
        if (node.type === "text") {
          node.value = node.value.toUpperCase();
        }
        node.children?.forEach(walk);
      };
      walk(tree);
    };
    const pluginLoader = new MdxLoader({ remarkPlugins: [upcaseText] });
    await writeMdxFixtures({ "plugin.mdx": "hello world\n" });
    const datum = datumFor("plugin.mdx");

    const result = await pluginLoader.processOne(datum, context);

    const content = unthunk(result.get("content"));

    await expect(content).toRenderTo("<p>HELLO WORLD</p>");
  });

  describe("error handling", () => {
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
});
