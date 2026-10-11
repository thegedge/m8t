import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { BuildError } from "../../../../src/errors/BuildError.js";
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
        yield { url: "/first", content: "this is the first", num: 1 };
        yield { url: "/second", content: "and the second", number: 2 };
      },
    });

    expect(result.map((a) => a.toRecord())).toMatchObject([
      { filename, url: "/first", content: "this is the first", num: 1 },
      { filename, url: "/second", content: "and the second", number: 2 },
    ]);
  });

  test("passes the abort signal to a content function", async () => {
    let received: unknown;
    await processOne({
      content: (_data: unknown, options: { signal: AbortSignal }) => {
        received = options.signal;
        return "";
      },
    });

    expect(received).toBe(context.signal);
  });

  test("passes the abort signal to a generator content function", async () => {
    let received: unknown;
    await processMany({
      content: function* (_data: unknown, options: { signal: AbortSignal }) {
        received = options.signal;
        yield { url: "/a" };
      },
    });

    expect(received).toBe(context.signal);
  });

  test("throws if a generator content function yields a result without a url", async () => {
    const promise = processMany({
      content: function* () {
        yield { url: "/a" };
        yield { content: "no url here" };
      },
    });

    await expect(promise).rejects.toThrow(BuildError);
    await expect(promise).rejects.toThrow(/without a url \(yield #2\)/);
  });

  test("does not let a yielded result inherit the url of its parent", async () => {
    const promise = processMany({
      url: "/parent",
      content: function* () {
        yield { content: "no url here" };
      },
    });

    await expect(promise).rejects.toThrow(BuildError);
  });

  test("throws if a generator content function yields the same url twice", async () => {
    const promise = processMany({
      content: function* () {
        yield { url: "/a" };
        yield { url: "/b" };
        yield { url: "/a" };
      },
    });

    await expect(promise).rejects.toThrow(BuildError);
    await expect(promise).rejects.toThrow(/yielded the url \/a twice/);
    await expect(promise).rejects.toMatchObject({ url: "/a" });
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
