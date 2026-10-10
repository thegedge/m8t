import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { Filesystem } from "../../src/utils/Filesystem.js";
import { fixturesRoot, writeFixtures } from "../helpers.js";

describe("Filesystem", () => {
  let root: string;
  let filesystem: Filesystem;

  beforeEach(async () => {
    root = await fixturesRoot("m8t-filesystem-test-");
    filesystem = new Filesystem(root);

    // Written out of order so that creation order can't accidentally produce a sorted listing
    await writeFixtures(root, {
      "zeta.txt": "",
      "b/z.txt": "",
      "_data.json": "",
      "a-b.txt": "",
      "b/a.txt": "",
      "B.txt": "",
      "alpha.txt": "",
      "a/c.txt": "",
    });
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  describe("ls", () => {
    test("returns entries sorted by name", async () => {
      const names = (await filesystem.ls()).map((entry) => entry.name);

      expect(names).toEqual(["_data.json", "a", "a-b.txt", "alpha.txt", "b", "B.txt", "zeta.txt"]);
    });

    test("returns recursive entries sorted by full path", async () => {
      const paths = (await filesystem.ls(true)).map((entry) =>
        path.relative(root, path.join(entry.parentPath, entry.name)),
      );

      expect(paths).toEqual([
        "_data.json",
        "a",
        "a-b.txt",
        "a/c.txt",
        "alpha.txt",
        "b",
        "B.txt",
        "b/a.txt",
        "b/z.txt",
        "zeta.txt",
      ]);
    });
  });
});
