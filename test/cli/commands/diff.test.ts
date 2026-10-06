import fs from "node:fs/promises";
import { afterEach, beforeEach, describe, expect, test } from "vitest";

import { run } from "../../../src/cli/commands/diff.js";
import { dedent } from "../../../src/utils/dedent.js";
import { fixturesRoot, writeFixtures } from "../../helpers.js";

describe("diff command", () => {
  let root: string;

  beforeEach(async () => {
    root = await fixturesRoot("m8t-diff-test-");
  });

  afterEach(async () => {
    await fs.rm(root, { recursive: true, force: true });
  });

  test("rejects when the site has no diff configuration", async () => {
    await writeFixtures(root, {
      "site.ts": dedent`
        export default {
          pipelines: { },
          devServer: { }
        }
      `,
    });

    await expect(run({ root, signal: new AbortController().signal })).rejects.toThrow(
      "site.ts doesn't specify any diff options",
    );
  });

  test("rejects when the site has no devServer configuration", async () => {
    await writeFixtures(root, {
      "site.ts": dedent`
        export default {
          pipelines: { },
          diff: { }
        }
      `,
    });

    await expect(run({ root, signal: new AbortController().signal })).rejects.toThrow(
      "m8t diff cannot run without a devServer configured",
    );
  });

  // TODO either run real browsers or allow for providing/mocking/stubbing a "differ" so we can test
});
