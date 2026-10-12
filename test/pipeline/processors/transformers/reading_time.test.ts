import React from "react";
import { describe, expect, test } from "vitest";

import type { Datum } from "../../../../src/pipeline/Datum.js";
import { resolveDerived } from "../../../../src/pipeline/derived.js";
import { ContentFunctionTransformer } from "../../../../src/pipeline/processors/transformers/content_function.js";
import { ReadingTimeTransformer } from "../../../../src/pipeline/processors/transformers/reading_time.js";
import { makeContext, testData } from "../../../helpers.js";

const WPM = 2;

describe("ReadingTimeTransformer", () => {
  test("resolves to undefined when content is of an unknown type", async () => {
    expect(await wpm(null)).toBeUndefined();
    expect(await wpm({})).toBeUndefined();
    expect(await wpm(5)).toBeUndefined();
    expect(await wpm(() => 5)).toBeUndefined();
  });

  test("sets a derived value rather than a number", async () => {
    await using context = await makeContext();
    const datum = (await new ReadingTimeTransformer(WPM).processOne(
      testData({ content: "one two" }),
      context,
    )) as Datum;
    expect(typeof datum.get("readingTimeMins")).toBe("function");
  });

  test("computes readingTimeMins for strings", async () => {
    expect(await wpm("this sentence has five words")).toBeCloseTo(2.5);
  });

  test("computes readingTimeMins for thunks", async () => {
    expect(await wpm(() => "this sentence has five words")).toBeCloseTo(2.5);
  });

  test("computes readingTimeMins for async thunks", async () => {
    expect(await wpm(async () => "this sentence has five words")).toBeCloseTo(2.5);
  });

  test("computes readingTimeMins for react elements", async () => {
    const element = React.createElement(
      "div",
      {},
      "this is another sentence",
      React.createElement("span", {
        children: React.createElement("em", undefined, "that has"),
      }),
      "eight words",
    );
    expect(await wpm(element)).toBeCloseTo(4);
  });

  test("computes readingTimeMins for fragments of elements", async () => {
    const element = React.createElement(
      React.Fragment,
      null,
      React.createElement("p", null, "one two"),
      [React.createElement("p", { key: "a" }, "three four")],
    );
    expect(await wpm(element)).toBeCloseTo(2);
  });

  test("computes readingTimeMins for content functions returning elements", async () => {
    const mdx = async () => React.createElement("article", null, "this has four words");
    expect(await wpm(mdx)).toBeCloseTo(2);
  });

  test("is independent of ordering with the content function transformer", async () => {
    const content = async () => "this sentence has five words";
    const before = await run(content, [
      new ReadingTimeTransformer(WPM),
      new ContentFunctionTransformer(),
    ]);
    const after = await run(content, [
      new ContentFunctionTransformer(),
      new ReadingTimeTransformer(WPM),
    ]);
    expect(before).toBeCloseTo(2.5);
    expect(after).toBeCloseTo(2.5);
  });

  test("counts the content as it was when the transformer ran", async () => {
    await using context = await makeContext();
    const datum = (await new ReadingTimeTransformer(WPM).processOne(
      testData({ content: "one two three four" }),
      context,
    )) as Datum;
    datum.with({ content: "much longer content than before the transform" });

    const resolved = await resolveDerived(datum.toRecord(), { signal: context.signal });
    expect(resolved.readingTimeMins).toBeCloseTo(2);
  });

  const wpm = (content: unknown) => run(content, [new ReadingTimeTransformer(WPM)]);

  const run = async (
    content: unknown,
    transformers: (ReadingTimeTransformer | ContentFunctionTransformer)[],
  ) => {
    await using context = await makeContext();
    let datum = testData({ content }) as Datum;
    for (const transformer of transformers) {
      datum = (await transformer.processOne(datum, context)) as Datum;
    }
    const resolved = await resolveDerived(datum.toRecord(), { signal: context.signal });
    return resolved.readingTimeMins as number | undefined;
  };
});
