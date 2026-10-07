import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { run } from "../../../src/cli/commands/validate.js";
import { AbortError } from "../../../src/errors/AbortError.js";
import { fixturesRoot, siteTsWithPages, writeFixtures } from "../../helpers.js";

describe("validate command", () => {
  let root: string;

  beforeEach(async () => {
    root = await fixturesRoot("m8t-validate-test-");
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test("stops processing the site with an AbortError when the signal is aborted", async () => {
    await writeFixtures(root, {
      "site.ts": siteTsWithPages([
        { url: "/", filename: "index.html", mimeType: "text/html", content: "<p>hi</p>" },
      ]),
    });

    const validating = run({
      root,
      signal: AbortSignal.abort(new AbortError("sad")),
      verbose: false,
      failFast: false,
    });

    await expect(validating).rejects.toThrow(AbortError);
    await expect(validating).rejects.toThrow("sad");
  });
});
