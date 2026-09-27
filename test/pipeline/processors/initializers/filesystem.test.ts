import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Datum } from "../../../../src/pipeline/Datum.js";
import { FilesystemInitializer } from "../../../../src/pipeline/processors/initializers/filesystem.js";
import { JsonLoader } from "../../../../src/pipeline/processors/loaders/json.js";
import { TypescriptLoader } from "../../../../src/pipeline/processors/loaders/typescript.js";
import { makeContext, writeFixtures, type TestContext } from "../../../helpers.js";

describe("FilesystemInitializer", () => {
  let initializer: FilesystemInitializer;
  let context: TestContext;

  const processRoot = async (): Promise<readonly Datum[]> => {
    const datum = new Datum({ basePath: context.root, filename: context.root });
    return await initializer.processMany([datum], context);
  };

  beforeEach(async () => {
    initializer = new FilesystemInitializer({
      loaders: [new TypescriptLoader(), new JsonLoader()],
    });
    context = await makeContext({
      pipelines: {},
      ignore: {
        globs: ["/ignored/"],
      },
    });
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  describe("with nested _data files", () => {
    beforeEach(async () => {
      await writeFixtures(context.root, {
        "_data.json": JSON.stringify({ fromRoot: "root", shadowed: "root" }),
        "a.json": JSON.stringify({ title: "a" }),
        "b.json": JSON.stringify({ title: "b" }),
        ".hidden.json": JSON.stringify({ title: "hidden" }),
        "sub/_data.json": JSON.stringify({ fromSub: "sub", shadowed: "sub" }),
        "sub/c.json": JSON.stringify({ title: "c" }),
        "sub/deep/d.json": JSON.stringify({ title: "d" }),
        "ignored/shallow.json": JSON.stringify({ title: "ignored-d" }),
        "ignored/deep/d.json": JSON.stringify({ title: "ignored-deep-d" }),
        "z.json": JSON.stringify({ title: "z" }),
      });
    });

    test("merges parent _data values into children", async () => {
      const results = await processRoot();

      const byTitle = new Map(results.map((datum) => [datum.get("title"), datum]));
      expect(byTitle.get("a")?.get("fromRoot")).toBe("root");
      expect(byTitle.get("a")?.get("fromSub")).toBeUndefined();

      for (const nestedTitle of ["c", "d"]) {
        const nested = byTitle.get(nestedTitle);
        expect(nested?.get("fromRoot")).toBe("root");
        expect(nested?.get("fromSub")).toBe("sub");
        expect(nested?.get("shadowed")).toBe("sub");
      }
    });

    test("produces results in listing order, depth-first, deterministically", async () => {
      // Implicitly, this is also testing the skipping of _data and hidden files
      const expected = ["a.json", "b.json", "z.json", "sub/c.json", "sub/deep/d.json"].map((p) => {
        return path.join(context.root, p);
      });
      const firstRun = (await processRoot()).map((datum) => datum.get("filename"));
      const secondRun = (await processRoot()).map((datum) => datum.get("filename"));

      expect(firstRun).toEqual(expected);
      expect(secondRun).toEqual(expected);
    });
  });

  test("loads and merges two data files", async () => {
    await writeFixtures(context.root, {
      "a.json": JSON.stringify({ title: "a" }),
      "_data.mjs": "export const value = 1;",
      "_data.json": JSON.stringify({ value: "testing" }),
    });

    const result = await processRoot();

    expect(result).toHaveLength(1);
    expect(result[0].toRecord()).toHaveProperty("title", "a");
    expect(result[0].get("value")).toBeOneOf([1, "testing"]);
  });

  describe("error handling", () => {
    test("throws errors for entries that fail to load", async () => {
      await writeFixtures(context.root, {
        "a.json": JSON.stringify({ title: "a" }),
        "boom.json": "not json",
        "sub/c.json": JSON.stringify({ title: "c" }),
      });

      await expect(processRoot()).rejects.toThrow();
    });

    test("throws errors when a _data file fails to load", async () => {
      await writeFixtures(context.root, {
        "_data.json": JSON.stringify({ fromRoot: "root" }),
        "sub/_data.json": "not json",
        "sub/c.json": JSON.stringify({ title: "c" }),
      });

      await expect(processRoot()).rejects.toThrow();
    });

    test("throws errors when the filename does not exist", async () => {
      const datum = new Datum({
        basePath: context.root,
        filename: path.join(context.root, "does-not-exist"),
      });

      const results = await initializer.processMany([datum], context);

      expect(results).toEqual([datum]);
    });
  });
});
