import path from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";

import { Datum, symProcessedBy } from "../../src/pipeline/Datum.js";
import { FilesystemInitializer } from "../../src/pipeline/processors/initializers/FilesystemInitializer.js";
import { makeContext, StubLoader, writeFixtures, type TestContext } from "../helpers.js";

describe("FilesystemInitializer", () => {
  let loader: StubLoader;
  let initializer: FilesystemInitializer;
  let context: TestContext;

  const processRoot = async (): Promise<readonly Datum[]> => {
    const datum = new Datum({ basePath: context.root, filename: context.root });
    return await initializer.processMany([datum], context);
  };

  beforeEach(async () => {
    loader = new StubLoader();
    initializer = new FilesystemInitializer({ loaders: [loader] });
    context = await makeContext({ pipelines: {} });
  });

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  describe("with nested _data files", () => {
    beforeEach(async () => {
      await writeFixtures(context.root, {
        "_data.ts": JSON.stringify({ fromRoot: "root", shadowed: "root" }),
        "a.json": JSON.stringify({ title: "a" }),
        "b.json": JSON.stringify({ title: "b" }),
        ".hidden.json": JSON.stringify({ title: "hidden" }),
        "sub/_data.ts": JSON.stringify({ fromSub: "sub", shadowed: "sub" }),
        "sub/c.json": JSON.stringify({ title: "c" }),
        "sub/deep/d.json": JSON.stringify({ title: "d" }),
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

    test("marks results as processed by the loader that loaded them", async () => {
      const results = await processRoot();
      for (const datum of results) {
        expect(datum.get(symProcessedBy)).toBe(loader);
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

  describe("error handling", () => {
    test("skips only the entries that fail to load", async () => {
      const spy = vi.spyOn(console, "error").mockImplementation(() => {});
      await writeFixtures(context.root, {
        "a.json": JSON.stringify({ title: "a" }),
        "boom.json": "not json",
        "sub/c.json": JSON.stringify({ title: "c" }),
      });

      const results = await processRoot();

      const titles = results.map((datum) => datum.get("title"));
      expect(titles).toEqual(["a", "c"]);
      expect(spy).toHaveBeenCalled();
    });

    test("continues with parent data when a _data file fails to load", async () => {
      const spy = vi.spyOn(console, "warn").mockImplementation(() => {});
      await writeFixtures(context.root, {
        "_data.ts": JSON.stringify({ fromRoot: "root" }),
        "sub/_data.ts": "not json",
        "sub/c.json": JSON.stringify({ title: "c" }),
      });

      const results = await processRoot();

      expect(results).toHaveLength(1);
      expect(results[0]?.get("title")).toBe("c");
      expect(results[0]?.get("fromRoot")).toBe("root");
      expect(spy).toHaveBeenCalled();
    });

    test("returns the datum unchanged when the filename does not exist", async () => {
      const datum = new Datum({
        basePath: context.root,
        filename: path.join(context.root, "does-not-exist"),
      });

      const results = await initializer.processMany([datum], context);

      expect(results).toEqual([datum]);
    });
  });
});
