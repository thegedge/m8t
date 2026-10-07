import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AbortError } from "../../src/index.js";
import type { Datum } from "../../src/pipeline/Datum.js";
import { processManyWithSingle } from "../../src/pipeline/utils.js";
import { makeContext, testData, type TestContext } from "../helpers.js";

describe("processManyWithSingle", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("processes every datum", async () => {
    const data = Array.from({ length: 10 }, (_, index) => testData({ index }));
    const processed: Datum[] = [];

    await processManyWithSingle(data, context, {
      processOne: async (datum: Datum) => {
        processed.push(datum);
        return datum;
      },
    });

    expect(processed).toHaveLength(data.length);
  });

  test("stops starting new work once the signal aborts", async () => {
    const data = Array.from({ length: 10 }, (_, index) => testData({ index }));
    const processed: Datum[] = [];

    const result = processManyWithSingle(data, context, {
      processOne: async (datum: Datum) => {
        processed.push(datum);
        context.controller.abort(new AbortError("sad"));
        return datum;
      },
    });

    await expect(result).rejects.toThrow(AbortError);
    await expect(result).rejects.toThrow("sad");
    expect(processed.length).toBeLessThan(data.length);
  });
});
