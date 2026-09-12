import path from "node:path";
import { Readable } from "node:stream";
import { describe, expect, test } from "vitest";

import { FileMatcher } from "../../src/utils/FileMatcher.js";

describe("FileMatcher", () => {
  describe("fromOptions", () => {
    test("throws an error if given a relative base path", async () => {
      await expect(() => FileMatcher.fromOptions({ base: "test" })).rejects.toThrow(
        "base must be an absolute path",
      );
    });

    describe("with only globs", () => {
      test("never matches the base path", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*"],
          base: "/var/local/test",
        });

        expect(fileMatcher).toMatchPath("/var/local/test/file.txt");
        expect(fileMatcher).not.toMatchPath("/var/local/test/");
      });
      test("matches at any level for literal patterns without directory separators", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.csv"],
        });

        expect(fileMatcher).toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("test/test.csv");
        expect(fileMatcher).toMatchPath("a/b/c/test.csv");
        expect(fileMatcher).toMatchPath(".file.csv");
        expect(fileMatcher).not.toMatchPath("test.txt");
      });

      test("matches exactly at base with literal patterns starting with a directory separator", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["/*.csv"],
        });

        expect(fileMatcher).toMatchPath("file.csv");
        expect(fileMatcher).not.toMatchPath("blah/file.csv");
        expect(fileMatcher).not.toMatchPath("nested/blah/test.csv");
      });

      test("matches relative to base with literal patterns containing with a directory separator", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["blah/*.csv"],
        });

        expect(fileMatcher).not.toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("blah/file.csv");
        expect(fileMatcher).not.toMatchPath("nested/blah/test.csv");
      });

      test("does not match if given includes and excludes and nothing matches", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.csv", "!*.txt"],
        });

        expect(fileMatcher).not.toMatchPath("test.txt");
        expect(fileMatcher).not.toMatchPath("homer_bushes.gif");
      });

      test("excludes matches with an anchored ignore pattern", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.csv", "!/*.csv"],
        });

        expect(fileMatcher).not.toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("blah/file.csv");
        expect(fileMatcher).toMatchPath("nested/blah/test.csv");
      });

      test("matches non-ignored paths when only ignore globs are provided", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*", "!*/", "!*.csv"],
        });

        expect(fileMatcher).toMatchPath("file.txt");
        expect(fileMatcher).not.toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("blah/file.txt");
        expect(fileMatcher).not.toMatchPath("blah/file.csv");
        expect(fileMatcher).not.toMatchPath("nested/blah/test.csv");
      });

      test("does not match when given an ignore pattern", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["file.js", "!test/file.js"],
        });

        expect(fileMatcher).toMatchPath("file.js");
        expect(fileMatcher).not.toMatchPath("test/file.js");
      });

      test("always matches when given no patterns, unless outside of base path", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["# This is a comment", "*.txt"],
          base: "/Users/jane",
        });
        expect(fileMatcher).toMatchPath("/Users/jane/test/file.txt");
        expect(fileMatcher).not.toMatchPath("/Users/john/test/file.js");
      });

      test("matches intermediate directories when given a ** pattern", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["blah/**/*.txt"],
        });
        expect(fileMatcher).toMatchPath("blah/test/file.txt");
        expect(fileMatcher).toMatchPath("blah/nested/test/file.txt");
        expect(fileMatcher).not.toMatchPath("noblah/test/file.txt");
      });

      test("last pattern takes precedence when there is overlap", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: [
            "test/**",
            // If it's helpful (it was for me): the above will cause directories to be ignored,
            // so if we don't "unignore" them, the gitignore spec doesn't descend into them.
            // This aids in performance, but makes certain scenarios hard to express!
            "!test/**/*/",
            "!test/**/*.txt",
            "test/blah/thing.txt",
          ],
        });
        expect(fileMatcher).not.toMatchPath("test/file.txt");
        expect(fileMatcher).toMatchPath("test/file.csv");
        expect(fileMatcher).not.toMatchPath("test/file/file.txt");
        expect(fileMatcher).not.toMatchPath("test/file/file2.txt");
        expect(fileMatcher).not.toMatchPath("test/file/file/file.txt");
        expect(fileMatcher).toMatchPath("test/blah/thing.txt");
      });

      test("matches only absolute paths that start with the base when given the base option", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.txt"],
          base: "/Users/jane",
        });
        expect(fileMatcher).toMatchPath("file.txt");
        expect(fileMatcher).toMatchPath("/Users/jane/file.txt");
        expect(fileMatcher).not.toMatchPath("/Users/john/file.txt");
      });

      test("matches exactly at base with literal patterns starting with a directory separator", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["/*.csv"],
        });

        expect(fileMatcher).toMatchPath("file.csv");
        expect(fileMatcher).not.toMatchPath("blah/file.csv");
        expect(fileMatcher).not.toMatchPath("nested/blah/test.csv");
      });

      test("matches only directories when given a directory pattern", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          base: path.join(import.meta.dirname, "../../"),
          globs: ["utils/"],
        });

        expect(fileMatcher).not.toMatchPath("test/utils");
        expect(fileMatcher).toMatchPath("test/utils/");
        expect(fileMatcher).toMatchPath("utils/FileMatcher.test.ts");
        expect(fileMatcher).not.toMatchPath("utils");
        expect(fileMatcher).toMatchPath("utils/");
        expect(fileMatcher).not.toMatchPath("nested/blah/test.csv");
      });
    });

    describe("with only files", () => {
      test("matches exactly at base with literal patterns starting with a directory separator", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          files: [
            stream(`
              # This is a comment
              *.csv
            `),
          ],
        });

        expect(fileMatcher).toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("blah/file.csv");
        expect(fileMatcher).toMatchPath("nested/blah/test.csv");
        expect(fileMatcher).not.toMatchPath("test.txt");
        expect(fileMatcher).not.toMatchPath("blah/test.txt");
      });

      test("ignores files that do not exist", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          files: [stream(`*.csv`), "does_not_exist.ignore"],
        });

        expect(fileMatcher).toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("blah/file.csv");
        expect(fileMatcher).toMatchPath("nested/blah/test.csv");
        expect(fileMatcher).not.toMatchPath("test.txt");
        expect(fileMatcher).not.toMatchPath("blah/test.txt");
      });
    });

    describe("with files and globs", () => {
      test("matches exactly at base with literal patterns starting with a directory separator", async () => {
        const fileMatcher = await FileMatcher.fromOptions({
          files: [stream(`*.csv`)],
          globs: ["!blah.csv"],
        });

        expect(fileMatcher).toMatchPath("file.csv");
        expect(fileMatcher).toMatchPath("blah/test.csv");
        expect(fileMatcher).not.toMatchPath("blah.csv");
      });
    });

    describe("withBase", () => {
      test("creates a new FileMatcher with the same rules but a different base directory", async () => {
        const fileMatcher = (
          await FileMatcher.fromOptions({
            globs: ["*.txt"],
            base: "/Users/jane",
          })
        ).withBase("/Users/john");

        expect(fileMatcher).toMatchPath("file.txt");
        expect(fileMatcher).not.toMatchPath("/Users/jane/file.txt");
        expect(fileMatcher).toMatchPath("/Users/john/file.txt");
      });
    });

    test("matches a path and all its descendants for a glob ending in /", async () => {
      const fileMatcher = await FileMatcher.fromOptions({
        globs: ["blah/"],
      });

      expect(fileMatcher).not.toMatchPath("file.csv");
      expect(fileMatcher).not.toMatchPath("blah.csv");
      expect(fileMatcher).toMatchPath("blah/");
      expect(fileMatcher).toMatchPath("blah/stuff.csv");
      expect(fileMatcher).toMatchPath("blah/more/stuff.csv");
    });
  });
});

const stream = (data: string) => {
  const readableStream = new Readable();
  readableStream._read = function () {}; // No-op, as we're pushing data directly
  readableStream.push(data); // Push the in-memory data (string or buffer)
  readableStream.push(null); // Signal the end of the stream
  return readableStream;
};
