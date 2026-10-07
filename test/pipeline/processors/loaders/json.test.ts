import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AbortError } from "../../../../src/index.js";
import { JsonLoader } from "../../../../src/pipeline/processors/loaders/json.js";
import { makeContext, writeFixtures, type TestContext } from "../../../helpers.js";

describe("JsonLoader", () => {
  let context: TestContext;

  beforeEach(async () => {
    context = await makeContext();
    await writeFixtures(context.root, { "data.json": '{ "title": "hello" }' });
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  test("merges the file's JSON into the datum", async () => {
    const datum = await new JsonLoader().processOne(context.datum("data.json"), context);

    expect(datum.get("title")).toBe("hello");
  });

  test("stops reading the file when the context's signal aborts", async () => {
    context.controller.abort(new AbortError("sad"));
    const loading = new JsonLoader().processOne(context.datum("data.json"), context);

    await expect(loading).rejects.toThrow(
      expect.objectContaining({ cause: new AbortError("sad") }),
    );
  });
});
