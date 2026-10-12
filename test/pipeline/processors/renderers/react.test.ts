import { createElement, use } from "react";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AbortError } from "../../../../src/errors/AbortError.js";
import { symRenderer } from "../../../../src/pipeline/processors/renderers/helpers.js";
import { ReactRenderer } from "../../../../src/pipeline/processors/renderers/react.js";
import { unthunk } from "../../../../src/utils/unthunk.js";
import { makeContext, testData, type TestContext } from "../../../helpers.js";

const SuspendForever = () => {
  use(new Promise<never>(() => {}));
  return null;
};

describe("ReactRenderer", () => {
  const renderer = new ReactRenderer();

  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("renders a React element to HTML when no renderer set", async () => {
    const datum = await process({ content: createElement("p", null, "hi") });

    expect(datum.get(Symbol.for("renderedBy"))).toBe(renderer);
    expect(datum.get("mimeType")).toBe("text/html");
    await expect(datum).toHaveContent("<p>hi</p>");
  });

  test("renders a React element to HTML when renderer set to react", async () => {
    const datum = await process({
      content: createElement("span", null, 1),
      [symRenderer]: "react",
    });

    expect(datum.get(Symbol.for("renderedBy"))).toBe(renderer);
    expect(datum.get("mimeType")).toBe("text/html");
    await expect(datum).toHaveContent("<span>1</span>");
  });

  test("renders a string", async () => {
    const datum = await process({
      content: "testing",
      mimeType: "text/plain",
      [symRenderer]: "react",
    });

    expect(datum.get(Symbol.for("renderedBy"))).toBe(renderer);
    expect(datum.get("mimeType")).toBe("text/plain");
    await expect(datum).toHaveContent("testing");
  });

  test("throws when not a string/react element", async () => {
    const datum = await process({
      content: 1,
      [symRenderer]: "react",
    });

    await expect(unthunk(datum.getOrThrow("content"))).rejects.toThrow(
      /did not return a valid React element/,
    );
  });

  test("does not render a string unless renderer set to react", async () => {
    const datum = await process({ content: 123 });

    expect(datum.get(Symbol.for("renderedBy"))).toBeUndefined();
  });

  test("stops rendering when the context's signal aborts", async () => {
    const datum = await process({ content: createElement(SuspendForever) });

    const rendering = unthunk(datum.getOrThrow("content"), context);
    context.controller.abort(new AbortError("sad"));

    await expect(rendering).rejects.toThrow(new AbortError("sad"));
  });

  const process = async (data: Record<string, unknown>) => {
    const datum = await renderer.processOne(testData(data), context);
    if (Array.isArray(datum)) {
      expect.fail("expected ReactRenderer to return a single datum");
    }

    return datum;
  };
});
