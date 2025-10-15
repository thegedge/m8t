import path from "node:path";
import { Readable } from "node:stream";
import { test } from "node:test";
import { FileMatcher } from "../../src/utils/FileMatcher.js";

test.assert.register("pathMatches", function (fileMatcher: FileMatcher, path: string) {
  this.assert.equal(fileMatcher.matches(path), true, `${path} should match`);
});

test.assert.register("notPathMatches", function (fileMatcher: FileMatcher, path: string) {
  this.assert.equal(fileMatcher.matches(path), false, `${path} should not match`);
});

declare module "node:test" {
  interface TestContextAssert {
    pathMatches(fileMatcher: FileMatcher, path: string): void;
    notPathMatches(fileMatcher: FileMatcher, path: string): void;
  }
}

test("FileMatcher", (t) => {
  t.test("fromOptions", (t) => {
    t.test("throws an error if given a relative base path", async (t) => {
      await t.assert.rejects(() => FileMatcher.fromOptions({ base: "test" }));
    });

    t.test("with only globs", (t) => {
      t.test("matches at any level for literal patterns without directory separators", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.csv"],
        });

        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "./file.csv");
        t.assert.pathMatches(fileMatcher, "test/test.csv");
        t.assert.pathMatches(fileMatcher, "a/b/c/test.csv");
        t.assert.notPathMatches(fileMatcher, ".file.csv");
        t.assert.notPathMatches(fileMatcher, "test.txt");
        t.assert.notPathMatches(fileMatcher, "../file.csv");
      });

      t.test("matches exactly at base with literal patterns starting with a directory separator", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["/*.csv"],
        });

        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.notPathMatches(fileMatcher, "blah/file.csv");
        t.assert.notPathMatches(fileMatcher, "nested/blah/test.csv");
      });

      t.test("matches relative to base with literal patterns containing with a directory separator", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["blah/*.csv"],
        });

        t.assert.notPathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "blah/file.csv");
        t.assert.notPathMatches(fileMatcher, "nested/blah/test.csv");
      });

      t.test("does not match if given includes and excludes and nothing matches", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.csv", "!*.txt"],
        });

        t.assert.notPathMatches(fileMatcher, "test.txt");
        t.assert.notPathMatches(fileMatcher, "homer_bushes.gif");
      });

      t.test("matches dot files when given the dot option", async (t) => {
        t.skip("`dot: true` option needs to be implemented");

        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["**/*.txt", "!test/file.js"],
          dot: true,
        });
        t.assert.pathMatches(fileMatcher, ".file.txt");
        t.assert.pathMatches(fileMatcher, "test/file.txt");
        t.assert.pathMatches(fileMatcher, ".thing/test/file.txt");
        t.assert.pathMatches(fileMatcher, "thing/.test/file.txt");
        t.assert.pathMatches(fileMatcher, ".thing/.test/file.txt");
        t.assert.pathMatches(fileMatcher, ".test/file.js");
        t.assert.pathMatches(fileMatcher, "test/.file.js");
        t.assert.pathMatches(fileMatcher, ".test/.file.js");
        t.assert.notPathMatches(fileMatcher, "test/file.js");
      });

      t.test("excludes matches with an anchored ignore pattern", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.csv", "!/*.csv"],
        });

        t.assert.notPathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "blah/file.csv");
        t.assert.pathMatches(fileMatcher, "nested/blah/test.csv");
      });

      t.test("matches non-ignored paths when only ignore globs are provided", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["!*.csv", "!blah"],
        });

        t.assert.pathMatches(fileMatcher, "file.txt");
        t.assert.notPathMatches(fileMatcher, "blah/file.txt");
        t.assert.notPathMatches(fileMatcher, "file.csv");
        t.assert.notPathMatches(fileMatcher, "blah/file.csv");
        t.assert.notPathMatches(fileMatcher, "nested/blah/test.csv");
      });

      t.test("does not match when given an ignore pattern", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["file.js", "!test/file.js"],
        });

        t.assert.pathMatches(fileMatcher, "file.js");
        t.assert.notPathMatches(fileMatcher, "test/file.js");
      });

      t.test("always matches when given no patterns, unless outside of base path", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["# This is a comment", ""],
          base: "/Users/jane",
        });
        t.assert.pathMatches(fileMatcher, "/Users/jane/test/file.txt");
        t.assert.notPathMatches(fileMatcher, "/Users/john/test/file.js");
      });

      t.test("matches intermediate directories when given a ** pattern", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["blah/**/*.txt"],
        });
        t.assert.pathMatches(fileMatcher, "blah/test/file.txt");
        t.assert.pathMatches(fileMatcher, "blah/nested/test/file.txt");
        t.assert.notPathMatches(fileMatcher, "noblah/test/file.txt");
      });

      t.test("last pattern takes precedence when there is overlap", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["test/**", "!test/**/*.txt", "test/blah/thing.txt"],
        });
        t.assert.notPathMatches(fileMatcher, "test/file.txt");
        t.assert.pathMatches(fileMatcher, "test/file.csv");
        t.assert.notPathMatches(fileMatcher, "test/file/file.txt");
        t.assert.notPathMatches(fileMatcher, "test/file/file2.txt");
        t.assert.notPathMatches(fileMatcher, "test/file/file/file.txt");
        t.assert.pathMatches(fileMatcher, "test/blah/thing.txt");
      });

      t.test("matches only absolute paths that start with the base when given the base option", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["*.txt"],
          base: "/Users/jane",
        });
        t.assert.pathMatches(fileMatcher, "file.txt");
        t.assert.pathMatches(fileMatcher, "/Users/jane/file.txt");
        t.assert.notPathMatches(fileMatcher, "/Users/john/file.txt");
      });

      t.test("matches exactly at base with literal patterns starting with a directory separator", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          globs: ["/*.csv"],
        });

        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.notPathMatches(fileMatcher, "blah/file.csv");
        t.assert.notPathMatches(fileMatcher, "nested/blah/test.csv");
      });

      t.test("matches only directories when given a directory pattern", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          base: path.join(import.meta.dirname, "../../"),
          globs: ["utils/"],
        });

        t.assert.pathMatches(fileMatcher, "test/utils");
        t.assert.pathMatches(fileMatcher, "test/utils/");
        t.assert.pathMatches(fileMatcher, "utils/FileMatcher.test.ts");
        t.assert.notPathMatches(fileMatcher, "utils");
        t.assert.notPathMatches(fileMatcher, "utils/");
        t.assert.notPathMatches(fileMatcher, "nested/blah/test.csv");
      });
    });

    t.test("with only files", (t) => {
      t.test("matches exactly at base with literal patterns starting with a directory separator", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          files: [
            stream(`
              # This is a comment
              *.csv
            `),
          ],
        });

        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "blah/file.csv");
        t.assert.pathMatches(fileMatcher, "nested/blah/test.csv");
        t.assert.notPathMatches(fileMatcher, "test.txt");
        t.assert.notPathMatches(fileMatcher, "blah/test.txt");
      });

      t.test("ignores files that do not exist", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          files: [stream(`*.csv`), "does_not_exist.ignore"],
        });

        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "blah/file.csv");
        t.assert.pathMatches(fileMatcher, "nested/blah/test.csv");
        t.assert.notPathMatches(fileMatcher, "test.txt");
        t.assert.notPathMatches(fileMatcher, "blah/test.txt");
      });
    });

    t.test("with files and globs", (t) => {
      t.test("matches exactly at base with literal patterns starting with a directory separator", async (t) => {
        const fileMatcher = await FileMatcher.fromOptions({
          files: [stream(`*.csv`)],
          globs: ["!blah.csv"],
        });

        t.assert.pathMatches(fileMatcher, "file.csv");
        t.assert.pathMatches(fileMatcher, "blah/test.csv");
        t.assert.notPathMatches(fileMatcher, "blah.csv");
      });
    });

    t.test("withBase", (t) => {
      t.test("creates a new FileMatcher with the same rules but a different base directory", async (t) => {
        const fileMatcher = (
          await FileMatcher.fromOptions({
            globs: ["*.txt"],
            base: "/Users/jane",
          })
        ).withBase("/Users/john");

        t.assert.pathMatches(fileMatcher, "file.txt");
        t.assert.notPathMatches(fileMatcher, "/Users/jane/file.txt");
        t.assert.pathMatches(fileMatcher, "/Users/john/file.txt");
      });
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
