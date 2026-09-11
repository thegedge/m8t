import { describe, expect, test } from "vitest";

import { Datum } from "../src/pipeline/Datum.js";
import { Search } from "../src/Search.js";

describe("Search", () => {
  const testData = (data: Record<string, unknown>) =>
    new Datum({
      basePath: "root",
      filename: "abc.txt",
      ...data,
    });

  const searcher = new Search([
    testData({ spam: "example", eggs: 0 }),
    testData({ spam: "", eggs: 1 }),
    testData({ spam: undefined, eggs: 2 }),
    testData({ spam: "example", eggs: 3 }),
    testData({ eggs: 4 }),
  ]);

  test("can find data for a given field in the data set", async () => {
    expect(await searcher.pages({ where: { spam: "example" } })).toEqual([
      expect.objectContaining({ eggs: 0 }),
      expect.objectContaining({ eggs: 3 }),
    ]);
  });

  test("can find data for an empty string in the data set", async () => {
    expect(await searcher.pages({ where: { spam: "" } })).toEqual([
      expect.objectContaining({ eggs: 1 }),
    ]);
  });

  test("can find data for undefined in the data set", async () => {
    expect(await searcher.pages({ where: { spam: undefined } })).toEqual([
      // Note the strictness: a missing key is different from undefined
      expect.objectContaining({ eggs: 2 }),
    ]);

    expect(await searcher.pages({ where: { eggs: undefined } })).toEqual([]);
  });

  test("can sort ascending", async () => {
    expect(await searcher.pages({ sort: ["eggs", "asc"] })).toEqual([
      expect.objectContaining({ eggs: 0 }),
      expect.objectContaining({ eggs: 1 }),
      expect.objectContaining({ eggs: 2 }),
      expect.objectContaining({ eggs: 3 }),
      expect.objectContaining({ eggs: 4 }),
    ]);
  });

  test("can sort descending", async () => {
    expect(await searcher.pages({ sort: ["eggs", "desc"] })).toEqual([
      expect.objectContaining({ eggs: 4 }),
      expect.objectContaining({ eggs: 3 }),
      expect.objectContaining({ eggs: 2 }),
      expect.objectContaining({ eggs: 1 }),
      expect.objectContaining({ eggs: 0 }),
    ]);
  });

  test("uses scalarCompare for ordering", async () => {
    expect(await searcher.pages({ sort: ["spam", "asc"] })).toEqual([
      expect.objectContaining({ spam: undefined, eggs: 2 }),
      expect.objectContaining({ eggs: 4 }),
      expect.objectContaining({ spam: "", eggs: 1 }),
      expect.objectContaining({ spam: "example", eggs: 0 }),
      expect.objectContaining({ spam: "example", eggs: 3 }),
    ]);
  });

  test("can combine filtering and sorting", async () => {
    expect(await searcher.pages({ where: { spam: "example" }, sort: ["eggs", "desc"] })).toEqual([
      expect.objectContaining({ eggs: 3 }),
      expect.objectContaining({ eggs: 0 }),
    ]);
  });
});
