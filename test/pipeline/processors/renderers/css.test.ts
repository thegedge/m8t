import type postcss from "postcss";
import { describe, expect, test } from "vitest";

import type { DatumShape } from "../../../../src/pipeline/Datum.js";
import { CssRenderer } from "../../../../src/pipeline/processors/renderers/css.js";
import { dedent } from "../../../../src/utils/dedent.js";
import { unthunk } from "../../../../src/utils/unthunk.js";
import { makeContext } from "../../../helpers.js";

describe("CssRenderer", () => {
  test("throws an error for invalid CSS when plugins given", async () => {
    const datum = await process(
      {
        filename: "./test.css",
        content: "asdjkl",
      },
      [{ postcssPlugin: "remove-comments" }],
    );

    await expect(unthunk(datum.getOrThrow("content"))).rejects.toThrow();
  });

  test("passes invalid CSS content through with no plugins", async () => {
    const datum = await process({
      filename: "./test.css",
      content: "invalid css",
    });

    expect(datum.toRecord()).toHaveProperty("mimeType", "text/css");
    await expect(datum).toHaveContent("invalid css");
  });

  test("renders valid CSS when plugins given", async () => {
    const datum = await process(
      {
        filename: "./test.css",
        content: "a { color: blue; }",
      },
      [{ postcssPlugin: "remove-comments" }],
    );

    expect(datum.toRecord()).toHaveProperty("mimeType", "text/css");
    await expect(datum).toHaveContent("a { color: blue; }");
  });

  test("uses given plugins to render CSS", async () => {
    const datum = await process(
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

    expect(datum.toRecord()).toHaveProperty("mimeType", "text/css");
    await expect(datum).toHaveContent("a { color: red; }");
  });

  const process = async (data: Partial<DatumShape>, plugins: postcss.Plugin[] = []) => {
    const processor = new CssRenderer(plugins);
    await using context = await makeContext();
    const result = await processor.processOne(context.datum(data), context);

    if (Array.isArray(result)) {
      throw new Error("expected a single result");
    }

    return result;
  };
});
