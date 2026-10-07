import fs from "node:fs/promises";
import path from "node:path";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { run } from "../../../src/cli/commands/build.js";
import { AbortError } from "../../../src/errors/AbortError.js";
import { LoadError } from "../../../src/errors/LoadError.js";
import { fixturesRoot, siteTsWithPages, writeFixtures } from "../../helpers.js";

describe("build command", () => {
  let root: string;

  beforeEach(async () => {
    root = await fixturesRoot("m8t-build-test-");
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test("rejects with a LoadError when the root has no site.ts", async () => {
    const building = run({ root, signal: new AbortController().signal });
    await expect(building).rejects.toBeInstanceOf(LoadError);
    await expect(building).rejects.toHaveProperty("filename", path.join(root, "site.ts"));
  });

  test("rejects with a LoadError when site.ts imports a missing module", async () => {
    await writeFixtures(root, {
      "site.ts": `import "./missing.ts";\nexport default { pipelines: {} };\n`,
    });

    const building = run({ root, signal: new AbortController().signal });
    await expect(building).rejects.toBeInstanceOf(LoadError);
    await expect(building).rejects.toHaveProperty("cause.code", "ERR_MODULE_NOT_FOUND");
  });

  test("writes each page's content to its output path under out/build", async () => {
    await writeFixtures(root, {
      "site.ts": siteTsWithPages([
        { url: "/", outputPath: "index.html", content: "<h1>Home</h1>" },
        { url: "/about", outputPath: "about/index.html", content: "<h1>About</h1>" },
      ]),
    });

    const code = await run({ root, signal: new AbortController().signal });

    expect(code).toBe(0);
    await expect(fs.readFile(path.join(root, "out/build/index.html"), "utf-8")).resolves.toBe(
      "<h1>Home</h1>",
    );
    await expect(fs.readFile(path.join(root, "out/build/about/index.html"), "utf-8")).resolves.toBe(
      "<h1>About</h1>",
    );
  });

  test("stops processing the site when the signal is aborted", async () => {
    await writeFixtures(root, {
      "site.ts": siteTsWithPages([
        { url: "/", outputPath: "index.html", content: "<h1>Home</h1>" },
      ]),
    });

    const building = run({ root, signal: AbortSignal.abort(new AbortError("sad")) });

    await expect(building).rejects.toThrow(AbortError);
    await expect(building).rejects.toThrow("sad");
  });

  test("copies static files into the build output, preserving their relative paths", async () => {
    await writeFixtures(root, {
      "site.ts": siteTsWithPages([
        { url: "/", outputPath: "index.html", content: "<h1>Home</h1>" },
      ]),
      "static/images/logo.png": "totally-a-png",
    });

    await run({ root, signal: new AbortController().signal });

    await expect(fs.readFile(path.join(root, "out/build/images/logo.png"), "utf-8")).resolves.toBe(
      "totally-a-png",
    );
  });

  test("clears any pre-existing contents of the build output directory before building", async () => {
    await writeFixtures(root, {
      "site.ts": siteTsWithPages([
        { url: "/", outputPath: "index.html", content: "<h1>Home</h1>" },
      ]),
      "out/build/stale.html": "should be removed",
    });

    await run({ root, signal: new AbortController().signal });

    await expect(fs.stat(path.join(root, "out/build/stale.html"))).rejects.toThrow();
  });
});
