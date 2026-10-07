import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { AbortError } from "../../src/index.js";
import { Redirects } from "../../src/server/Redirects.js";
import { dedent } from "../../src/utils/dedent.js";
import { Filesystem } from "../../src/utils/Filesystem.js";
import { fixturesRoot, writeFixtures } from "../helpers.js";

describe("Redirects", () => {
  describe("fromFilesystem", () => {
    let root: string;

    beforeEach(async () => {
      root = await fixturesRoot("m8t-redirects-test-");
      await writeFixtures(root, { _redirects: "/old /new 302" });
    });

    afterEach(async () => {
      await fs.rm(root, { recursive: true, force: true });
    });

    test("parses redirects from a file", async () => {
      const redirects = await Redirects.fromFilesystem(new Filesystem(root), "_redirects");

      expect(redirects.match("/old")).toEqual(["/new", 302]);
    });

    test("stops reading the file when the signal is aborted", async () => {
      const reading = Redirects.fromFilesystem(new Filesystem(root), "_redirects", {
        signal: AbortSignal.abort(new AbortError("sad")),
      });

      await expect(reading).rejects.toThrow(
        expect.objectContaining({ cause: new AbortError("sad") }),
      );
    });
  });

  test("parses correctly on the happy path", () => {
    const redirects = Redirects.fromString(dedent`
      # this is a comment
      /about.html                      /about

      # With params
      /blog/:year/:month/:day/:slug    /blog/:year-:month-:day-:slug

          # whitespace doesn't matter
          /dev/:year-:month-:day-:slug     /all-my-dev

      # Splats too. And order matters!
      /blog/*                          /blog/not-found.html       404
      /spam/*                   /eggs/:splat               301

      # nothing else
    `);

    expect(redirects.match("/about")).toBeUndefined();
    expect(redirects.match("/about.htm")).toBeUndefined();
    expect(redirects.match("/about.html")).toEqual(["/about", 301]);

    expect(redirects.match("/blog")).toBeUndefined();
    expect(redirects.match("/blog/2000/01/this-is-my-story")).toEqual([
      "/blog/not-found.html",
      404,
    ]);
    expect(redirects.match("/blog/2000/01/12/this-is-my-story")).toEqual([
      "/blog/2000-01-12-this-is-my-story",
      301,
    ]);
    expect(redirects.match("/blog/2020/11/22/another-story")).toEqual([
      "/blog/2020-11-22-another-story",
      301,
    ]);

    expect(redirects.match("/spam")).toBeUndefined();
    expect(redirects.match("/spam/just/some/stuff.txt")).toEqual([
      "/eggs/just/some/stuff.txt",
      301,
    ]);

    expect(redirects.match("/dev")).toBeUndefined();
    expect(redirects.match("/dev/2000-testing")).toBeUndefined();
    expect(redirects.match("/dev/2000-01-23-testing")).toEqual(["/all-my-dev", 301]);
  });

  test("validates the status", () => {
    const redirects = Redirects.fromString(dedent`
      /about.html  /about  not_a_valid_status
    `);

    expect(redirects.match("/about.html")).toEqual(["/about", 301]);
  });
});
