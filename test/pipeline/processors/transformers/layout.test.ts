import path from "node:path";
import { createElement, isValidElement } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { renderElementToHTML } from "../../../../src/jsx.js";
import { FilesystemInitializer } from "../../../../src/pipeline/processors/initializers/filesystem.js";
import { TypescriptLoader } from "../../../../src/pipeline/processors/loaders/typescript.js";
import {
  LayoutTransformer,
  symLayoutFilename,
} from "../../../../src/pipeline/processors/transformers/layout.js";
import { ReadingTimeTransformer } from "../../../../src/pipeline/processors/transformers/reading_time.js";
import { dedent } from "../../../../src/utils/dedent.js";
import { unthunk } from "../../../../src/utils/unthunk.js";
import {
  linkNodeModules,
  makeContext,
  testData,
  writeFixtures,
  type TestContext,
} from "../../../helpers.js";

describe("LayoutTransformer", () => {
  let context: TestContext;
  let testLayoutRoot: string;

  beforeEach(async () => {
    context = await makeContext();
    await linkNodeModules(context.root, "react");
    testLayoutRoot = path.join(context.root, "layout");
    await writeFixtures(testLayoutRoot, {
      "simple.ts": dedent`
        export const layoutType = "simple";
        export const source = "simple";

        export const content = (props) => {
          return \`<wrapped>\${props.children}</wrapped>\`;
        };
      `,
      "second.ts": dedent`
        export const layoutType = "second";
        export const source = "second";

        export const content = (props) => {
          return \`<second>\${props.children}</second>\`;
        };
      `,
      "first.ts": dedent`
        export const layout = "second.ts";
        export const layoutType = "first";
        export const source = "first";

        export const content = (props) => {
          return \`<first>\${props.children}</first>\`;
        };
      `,
      "element.ts": dedent`
        import { createElement } from "react";

        export const content = (props) => {
          return createElement("main", null, props.children);
        };
      `,
      "signal_inner.ts": dedent`
        export const layout = "signal_outer.ts";

        export const content = (props, options) => {
          globalThis.__layoutSignals.push(options.signal);
          return \`<inner>\${props.children}</inner>\`;
        };
      `,
      "signal_outer.ts": dedent`
        export const content = (props, options) => {
          globalThis.__layoutSignals.push(options.signal);
          return \`<outer>\${props.children}</outer>\`;
        };
      `,
    });
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("will render the given content inside the layout", async () => {
    const datum = await render("testing", "simple.ts");

    await expect(datum).toHaveContent("<wrapped>testing</wrapped>");
  });

  test("will include layout data in the result", async () => {
    const datum = await render("testing", "simple.ts");

    expect(datum.get("layoutType")).toEqual("simple");
    expect(datum.get("source")).toEqual("datum");
  });

  test("records the layout's full path", async () => {
    const datum = await render("testing", "simple.ts");

    expect(datum.get(symLayoutFilename)).toEqual(path.join(testLayoutRoot, "simple.ts"));
  });

  test("will recurse layouts", async () => {
    const datum = await render("wow!", "first.ts");

    // Second layout wraps the first
    await expect(datum).toHaveContent("<second><first>wow!</first></second>");

    // Layout data has the lowest precedence, so once data is set, it doesn't clobber
    expect(datum.get("layoutType")).toEqual("first");
  });

  test("lays out React element children", async () => {
    const datum = await render(createElement("p", null, "hi"), "element.ts");

    const content = await unthunk(datum.getOrThrow("content"), { signal: context.signal });
    expect(isValidElement(content)).toBe(true);
    expect(await renderElementToHTML(content as any, { signal: context.signal })).toBe(
      "<main><p>hi</p></main>",
    );
  });

  test("passes the render-time abort signal through nested layouts", async () => {
    const seen: AbortSignal[] = [];
    (globalThis as any).__layoutSignals = seen;
    try {
      const datum = await render("wow!", "signal_inner.ts");
      const { signal } = new AbortController();

      await expect(unthunk(datum.getOrThrow("content"), { signal })).resolves.toBe(
        "<outer><inner>wow!</inner></outer>",
      );
      expect(seen).toHaveLength(2);
      expect(seen[0]).toBe(signal);
      expect(seen[1]).toBe(signal);
    } finally {
      delete (globalThis as any).__layoutSignals;
    }
  });

  test("resolves derived values to plain values for the layout, memoized per signal", async () => {
    await writeFixtures(testLayoutRoot, {
      "reading.ts": dedent`
        export const content = (props) => {
          return \`<\${typeof props.readingTimeMins}:\${props.readingTimeMins}>\${props.children}\`;
        };
      `,
    });
    let calls = 0;
    const pageContent = async () => {
      calls++;
      return "one two three four";
    };
    const datum = testData({ source: "datum", content: pageContent, layout: "reading.ts" });
    await new ReadingTimeTransformer(2).processOne(datum, context);
    const result = await new LayoutTransformer(testLayoutRoot, [
      new FilesystemInitializer({ loaders: [new TypescriptLoader()] }),
    ]).processOne(datum, context);

    const { signal } = new AbortController();
    const content = result.getOrThrow("content") as (o: { signal: AbortSignal }) => Promise<string>;

    // Layout words are not counted: 4 words at 2 wpm
    await expect(content({ signal })).resolves.toBe("<number:2>one two three four");
    await expect(content({ signal })).resolves.toBe("<number:2>one two three four");

    // One call to render the layout children, one to compute the derived value, shared by
    // all consumers using the same signal.
    expect(calls).toBe(2);
  });

  const render = async (content: unknown, layout: string) => {
    const renderer = new LayoutTransformer(testLayoutRoot, [
      new FilesystemInitializer({
        loaders: [new TypescriptLoader()],
      }),
    ]);
    const datum = await renderer.processOne(
      testData({
        source: "datum",
        content,
        layout,
      }),
      context,
    );
    if (Array.isArray(datum)) {
      expect.fail("expected StringProcessor to return a single datum");
    }
    return datum;
  };
});
