import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";

import { AbortError } from "../../../../src/errors/AbortError.js";
import { Datum } from "../../../../src/pipeline/Datum.js";
import { ReadFileLoader } from "../../../../src/pipeline/processors/loaders/read_file.js";
import { makeContext, writeFixtures, type TestContext } from "../../../helpers.js";

describe("ReadFileLoader", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
    await writeFixtures(context.root, { "file.txt": "Hey, there!" });
  });

  test("can read a file", async () => {
    const result = await process("file.txt");

    expect(result.content).toBeTypeOf("function");
    expect(await (result.content as any)()).toEqual("Hey, there!");
  });

  test("overrides the given datum's content", async () => {
    const result = await process("file.txt", { content: "Overwrite me" });

    expect(result.content).toBeTypeOf("function");
    expect(await (result.content as any)()).toEqual("Hey, there!");
  });

  test("returns the datum as-is if already loaded by someone else", async () => {
    const result = await process("file.txt", {
      content: "Overwrite me",
      [Symbol.for("loadedFor")]: path.join(context.root, "file.txt"),
    });

    expect(result.content).toEqual("Overwrite me");
  });

  test("stops reading the file when the context's signal aborts", async () => {
    context.controller.abort(new AbortError("sad"));

    const result = await process("file.txt", {}, context);
    const content = Promise.try(result.content as any);

    await expect(content).rejects.toThrow(
      expect.objectContaining({ cause: new AbortError("sad") }),
    );
  });

  const process = async (
    filename: string,
    data: Record<string, unknown> = {},
    processContext: TestContext = context,
  ) => {
    const processor = new ReadFileLoader();
    const result = await processor.processOne(
      new Datum({
        basePath: context.root,
        filename: path.join(context.root, filename),
        ...data,
      }),
      processContext,
    );
    if (Array.isArray(result)) {
      expect.fail("expected StringProcessor to return a single datum");
    }
    return result.toRecord();
  };
});
