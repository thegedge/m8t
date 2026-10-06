import path from "node:path";
import { beforeEach, describe, expect, test } from "vitest";

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

  const process = async (filename: string, data: Record<string, unknown> = {}) => {
    const processor = new ReadFileLoader();
    const result = await processor.processOne(
      new Datum({
        basePath: context.root,
        filename: path.join(context.root, filename),
        ...data,
      }),
      context,
    );
    if (Array.isArray(result)) {
      expect.fail("expected StringProcessor to return a single datum");
    }
    return result.toRecord();
  };
});
