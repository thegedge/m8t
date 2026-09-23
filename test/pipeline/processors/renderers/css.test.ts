import type postcss from "postcss";
import { beforeEach, describe, expect, test } from "vitest";

import type { DatumShape } from "../../../../src/pipeline/Datum.js";
import { CssRenderer } from "../../../../src/pipeline/processors/renderers/css.js";
import { dedent } from "../../../../src/utils/dedent.js";
import { makeContext, type TestContext } from "../../../helpers.js";

describe("CssRenderer", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  test("throws an error for invalid CSS when plugins given", async () => {
    const processPromise = process(
      {
        filename: "./test.css",
        content: "asdjkl",
      },
      [{ postcssPlugin: "remove-comments" }],
    );

    await expect(processPromise).rejects.toThrow();
  });

  test("passes invalid CSS content through with no plugins", async () => {
    const value = await process({
      filename: "./test.css",
      content: "invalid css",
    });

    expect(value.toRecord()).toHaveProperty("mimeType", "text/css");
    expect(value.toRecord()).toHaveProperty("content", "invalid css");
  });

  test("renders valid CSS when plugins given", async () => {
    const value = await process(
      {
        filename: "./test.css",
        content: "a { color: blue; }",
      },
      [{ postcssPlugin: "remove-comments" }],
    );

    expect(value.toRecord()).toHaveProperty("mimeType", "text/css");
    expect(value.toRecord()).toHaveProperty("content", "a { color: blue; }");
  });

  test("uses given plugins to render CSS", async () => {
    const value = await process(
      {
        filename: "./test.css",
        content: dedent`
          /* Make all of the links red */
          a { color: red; }
        `,
      },
      [
        {
          postcssPlugin: "remove-comments",
          Comment(comment, _helper) {
            comment.remove();
          },
        },
      ],
    );

    expect(value.toRecord()).toHaveProperty("mimeType", "text/css");
    expect(value.toRecord()).toHaveProperty("content", "a { color: red; }");
  });

  const process = async (data: Partial<DatumShape>, plugins: postcss.Plugin[] = []) => {
    const processor = new CssRenderer(plugins);
    const result = await processor.processOne(context.datum(data), context);

    if (Array.isArray(result)) {
      throw new Error("expected a single result");
    }

    return result;
  };
});
