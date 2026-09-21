import { readFile } from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, test } from "vitest";

import { Datum, TypesProcessor } from "../../../src/index.js";
import type { TypesProcessorOptions } from "../../../src/pipeline/processors/types.js";
import { makeContext, type TestContext } from "../../helpers.js";

describe("TypesProcessor", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
  });

  test("can generate types for all the things", async () => {
    const types = await process(
      {},
      context.datum({
        filename: "./another_thing.ts",
        theme: "light",
        num: 123,
        bignum: 567n,
        booly: true,
        nothing: null,
        absence: undefined,
        numbers: [1, 2, 3],
        truthyThings: [1, "yes", true],
        metadata: {
          isObject: true,
          key: "value",
        },
        "og:title": "OpenGraph title should be quoted",
      }),
    );

    expect(types).toMatchSnapshot();
  });

  test("can generate types for multiple datum", async () => {
    const types = await process(
      {},
      context.datum({ theme: "light" }),
      context.datum({ theme: "dark" }),
    );

    expect(types).toMatchSnapshot();
  });

  test("can generate a literal type when given as a literal key", async () => {
    const types = await process(
      { literalKeys: ["theme"] },
      context.datum({ theme: "light", data: "spam" }),
      context.datum({ theme: "dark", data: "eggs" }),
    );

    expect(types).toMatchSnapshot();
  });

  test("doesn't include field in type when ignored", async () => {
    const types = await process(
      { ignoredKeys: ["theme"] },
      context.datum({ theme: "light", data: "test" }),
      context.datum({ theme: "dark", data: "more" }),
    );

    expect(types).toMatchSnapshot();
  });

  test("quotes keys that need them", async () => {
    const types = await process(
      {},
      context.datum(
        {
          filename: "./base_thing.ts",
          "needs:quotes": true,
        },
        {
          filename: "./some_thing.ts",
          "also-needs-quotes": true,
        },
      ),
    );

    expect(types).toMatchSnapshot();
  });

  const process = async (options: Partial<TypesProcessorOptions>, ...data: Datum[]) => {
    const typesOutputFile = path.join(context.root, "types.d.ts");
    const processor = new TypesProcessor({
      ...options,
      typesOutputFile,
    });

    const results = await processor.processMany(data, context);
    expect(results.map((r) => r.toRecord())).toEqual(data.map((d) => d.toRecord()));

    return await readFile(typesOutputFile, "utf8");
  };
});
