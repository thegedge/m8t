import React from "react";
import { describe, expect, test } from "vitest";

import type { Datum } from "../../../../src/pipeline/Datum.js";
import { ReadingTimeTransformer } from "../../../../src/pipeline/processors/transformers/reading_time.js";
import { makeContext, testData } from "../../../helpers.js";

const WPM = 2;

describe("ReadingTimeTransformer", () => {
  test("returns the datum unchanged when content is of an unknown type", async () => {
    expect(await wpm(null)).toBeUndefined();
    expect(await wpm({})).toBeUndefined();
    expect(await wpm(5)).toBeUndefined();
    expect(await wpm(() => "123")).toBeUndefined();
  });

  test("adds readingTimeMins for strings", async () => {
    expect(await wpm("this sentence has five words")).toBeCloseTo(2.5);
  });

  test("adds readingTimeMins for react elements", async () => {
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

  const wpm = async (content: unknown) => {
    const context = await makeContext();
    const transformer = new ReadingTimeTransformer(WPM);
    const datum = await transformer.processOne(testData({ content }), context);
    return (datum as Datum).get("readingTimeMins") as number | undefined;
  };
});
