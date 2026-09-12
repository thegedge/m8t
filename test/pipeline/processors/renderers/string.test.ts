import { describe, expect, test } from "vitest";

import { StringRenderer } from "../../../../src/pipeline/processors/renderers/string.js";
import { makeContext, testData } from "../../../helpers.js";

describe("StringRenderer", () => {
  test("renders a given datum to a string by calling toString", async () => {
    expect(await render("testing")).toEqual("testing");
    expect(await render(["a", "b"])).toEqual("a,b");
    expect(await render({})).toEqual("[object Object]");
    expect(await render({ [Symbol.toStringTag]: "String" })).toEqual("[object String]");
    expect(await render({ toString: () => "stringy" })).toEqual("stringy");
  });

  test("renders null-ish values to an empty string", async () => {
    expect(await render(undefined)).toEqual("");
    expect(await render(null)).toEqual("");
    expect(await render("")).toEqual("");
    expect(await render(0)).toEqual("0");
    expect(await render([])).toEqual("");
    expect(await render(false)).toEqual("false");
  });

  const render = async (content: unknown) => {
    const renderer = new StringRenderer();
    const datum = await renderer.processOne(testData({ content }), await makeContext());
    if (Array.isArray(datum)) {
      expect.fail("expected StringProcessor to return a single datum");
    }
    expect(datum.get("mimeType")).toBe("text/plain");
    return datum.get("content");
  };
});
