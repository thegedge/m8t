import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import { Datum, Pipeline, Site, type SiteOptions } from "../src/index.js";
import type { Loader } from "../src/pipeline/processors/initializers/FilesystemInitializer.js";
import type { DefaultContext } from "../src/pipeline/utils.js";
import { NonAsyncTimeMeasurement } from "../src/utils/NonAsyncTimeMeasurement.js";

/**
 * A loader that parses each fixture file as JSON and merges it into the datum.
 *
 * Files containing invalid JSON make the load throw, which lets tests exercise the error paths.
 */
export class StubLoader implements Loader {
  readonly loadedFilenames: string[] = [];

  async processOne(datum: Datum, _context: DefaultContext): Promise<Datum> {
    const filename = datum.stringOrThrow("filename");
    const contents = await fs.readFile(filename, "utf-8");
    const parsed: unknown = JSON.parse(contents);
    this.loadedFilenames.push(filename);
    return datum.branch(parsed as Record<string, unknown>);
  }
}

export type TestContext = DefaultContext & {
  /** The root path where tests can write output, fixtures, etc */
  root: string;

  [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Make a test context.
 *
 * Empty pipeline,
 */
export const makeContext = async (options: SiteOptions): Promise<TestContext> => {
  const root = await fixturesRoot("m8t-test-");
  const site = await Site.fromOptions(root, options);
  return {
    performanceTracker: new NonAsyncTimeMeasurement(),
    pipeline: new Pipeline({ stages: Object.values(site.pipelines)[0] }),
    root,
    site,
    signal: new AbortController().signal,

    [Symbol.asyncDispose]: async () => {
      await fs.rm(root, { recursive: true, force: true });
    },
  };
};

/**
 * Get a temp directory to which fixtures can be written.
 */
export const fixturesRoot = async (prefix: string) => {
  const tmpdir = await fs.realpath(os.tmpdir());
  return await fs.mkdtemp(path.join(tmpdir, prefix));
};

/**
 * Write files to a given root.
 *
 * Intermediate directories will be written.
 *
 * @param root the root directory to which the files are written
 * @param files a mapping from filename to contents
 */
export const writeFixtures = async (root: string, files: Record<string, string>) => {
  for (const [relativePath, contents] of Object.entries(files)) {
    const absolutePath = path.join(root, relativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, contents);
  }
};
