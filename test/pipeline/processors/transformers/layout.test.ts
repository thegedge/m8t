import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";

import { FilesystemInitializer } from "../../../../src/pipeline/processors/initializers/filesystem.js";
import { TypescriptLoader } from "../../../../src/pipeline/processors/loaders/typescript.js";
import { LayoutTransformer } from "../../../../src/pipeline/processors/transformers/layout.js";
import { dedent } from "../../../../src/utils/dedent.js";
import { makeContext, testData, writeFixtures, type TestContext } from "../../../helpers.js";

describe("LayoutTransformer", () => {
  let context: TestContext;
  let testLayoutRoot: string;

  beforeEach(async () => {
    context = await makeContext();
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
    });
  });

  test("will render the given content inside the layout", async () => {
    const datum = await render("testing", "simple.ts");

    expect(datum.get("content")).toEqual("<wrapped>testing</wrapped>");
  });

  test("will include layout data in the result", async () => {
    const datum = await render("testing", "simple.ts");

    expect(datum.get("layoutType")).toEqual("simple");
    expect(datum.get("source")).toEqual("datum");
  });

  test("will recurse layouts", async () => {
    const datum = await render("wow!", "first.ts");

    // Second layout wraps the first
    expect(datum.get("content")).toEqual("<second><first>wow!</first></second>");

    // Layout data has the lowest precedence, so once data is set, it doesn't clobber
    expect(datum.get("layoutType")).toEqual("first");
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
