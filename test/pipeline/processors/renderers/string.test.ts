import { describe, expect, test } from "vitest";

import { StringRenderer } from "../../../../src/pipeline/processors/renderers/string.js";
import { makeContext, testData } from "../../../helpers.js";

describe("StringRenderer", () => {
  test("renders a given datum to a string by calling toString", async () => {
    await expect(await render("testing")).toHaveContent("testing");
    await expect(await render(["a", "b"])).toHaveContent("a,b");
    await expect(await render({})).toHaveContent("[object Object]");
    await expect(await render({ [Symbol.toStringTag]: "String" })).toHaveContent("[object String]");
    await expect(await render({ toString: () => "stringy" })).toHaveContent("stringy");
  });

  test("renders null-ish values to an empty string", async () => {
    await expect(await render(undefined)).toHaveContent("");
    await expect(await render(null)).toHaveContent("");
    await expect(await render("")).toHaveContent("");
    await expect(await render(0)).toHaveContent("0");
    await expect(await render([])).toHaveContent("");
    await expect(await render(false)).toHaveContent("false");
  });

  const render = async (content: unknown) => {
    const renderer = new StringRenderer();
    await using context = await makeContext();
    const datum = await renderer.processOne(testData({ content }), context);
    if (Array.isArray(datum)) {
      expect.fail("expected StringProcessor to return a single datum");
    }

    expect(datum.get("mimeType")).toBe("text/plain");
    return datum;
  };
});
