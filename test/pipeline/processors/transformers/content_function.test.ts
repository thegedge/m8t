import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { ContentFunctionTransformer } from "../../../../src/index.js";
import type { DatumShape } from "../../../../src/pipeline/Datum.js";
import { makeContext, type TestContext } from "../../../helpers.js";

describe("ContentFunctionTransformer", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("runs a content function and set content on the result", async () => {
    const result = await processOne({
      content: () => "this is the content",
    });

    expect(result.toRecord()).toMatchObject({
      content: "this is the content",
    });
  });

  test("returns a datum as-is if no content function", async () => {
    const result = await processOne({ content: "this is the content" });

    expect(result.toRecord()).toMatchObject({
      content: "this is the content",
    });
  });

  test("returns all results yielded from a generator function", async () => {
    const filename = path.join(context.root, "test.ts");
    const result = await processMany({
      filename,
      content: function* () {
        yield { content: "this is the first", num: 1 };
        yield { content: "and the second", number: 2 };
      },
    });

    expect(result.map((a) => a.toRecord())).toMatchObject([
      { filename, content: "this is the first", num: 1 },
      { filename, content: "and the second", number: 2 },
    ]);
  });

  const processOne = async (data: Partial<DatumShape>) => {
    const processor = new ContentFunctionTransformer();
    const result = await processor.processOne(context.datum(data), context);

    if (Array.isArray(result)) {
      throw new Error("expected a single result");
    }

    return result;
  };

  const processMany = async (data: Partial<DatumShape>) => {
    const processor = new ContentFunctionTransformer();
    const result = await processor.processOne(context.datum(data), context);

    if (!Array.isArray(result)) {
      throw new Error("expected an array result");
    }

    return result;
  };
});
