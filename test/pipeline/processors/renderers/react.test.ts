import { createElement, use } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AbortError } from "../../../../src/errors/AbortError.js";
import { ReactRenderer } from "../../../../src/pipeline/processors/renderers/react.js";
import { makeContext, testData, type TestContext } from "../../../helpers.js";

const SuspendForever = () => {
  use(new Promise<never>(() => {}));
  return null;
};

describe("ReactRenderer", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("renders a React element to HTML", async () => {
    const renderer = new ReactRenderer();

    const datum = await renderer.processOne(
      testData({ content: createElement("p", null, "hi") }),
      context,
    );

    if (Array.isArray(datum)) {
      expect.fail("expected ReactRenderer to return a single datum");
    }
    expect(datum.get("content")).toBe("<p>hi</p>");
    expect(datum.get("mimeType")).toBe("text/html");
  });

  test("stops rendering when the context's signal aborts", async () => {
    const renderer = new ReactRenderer();
    const rendering = renderer.processOne(
      testData({ content: createElement(SuspendForever) }),
      context,
    );
    context.controller.abort(new AbortError("sad"));

    await expect(rendering).rejects.toThrow(AbortError);
    await expect(rendering).rejects.toThrow("sad");
  });
});
