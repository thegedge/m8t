import { randomUUIDv7 } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pMap from "p-map";

import { Datum, Pipeline, Site, TypescriptLoader, type SiteOptions } from "../src/index.js";
import { symProcessedBy, type DatumShape } from "../src/pipeline/Datum.js";
import type { FilesystemLoader } from "../src/pipeline/processors/initializers/FilesystemInitializer.js";
import type { DefaultContext } from "../src/pipeline/utils.js";
import { NonAsyncTimeMeasurement } from "../src/utils/NonAsyncTimeMeasurement.js";

/**
 * A loader that parses each fixture file as JSON and merges it into the datum.
 *
 * Files containing invalid JSON make the load throw, which lets tests exercise the error paths.
 */
export class StubLoader implements FilesystemLoader {
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

  /** Create a datum for this context with the given lineage */
  datum(...lineage: Partial<DatumShape>[]): Datum;

  /** Create a datum for this context with the given filename and lineage */
  datum(filename: string, ...lineage: Partial<DatumShape>[]): Datum;

  /** Free up resources allocated to this context */
  [Symbol.asyncDispose]: () => Promise<void>;
};

/**
 * Make a test context.
 */
export const makeContext = async (options?: SiteOptions): Promise<TestContext> => {
  const root = await fixturesRoot("m8t-test-");
  const site = await Site.fromOptions(root, { pipelines: {}, ...options });
  let filenameIndex = 0;
  return {
    performanceTracker: new NonAsyncTimeMeasurement(),
    pipeline: new Pipeline({ stages: Object.values(site.pipelines)[0] }),
    root,
    site,
    signal: new AbortController().signal,

    datum: (filenameOrDatum, ...lineage) => {
      const processor = new TypescriptLoader();

      let initial: Datum;
      if (typeof filenameOrDatum == "string") {
        initial = new Datum({
          [symProcessedBy]: processor,
          basePath: root,
          filename: path.resolve(root, filenameOrDatum),
        });
      } else {
        initial = new Datum({
          [symProcessedBy]: processor,
          basePath: root,
          ...filenameOrDatum,
          filename: path.resolve(root, filenameOrDatum["filename"] || `test-${++filenameIndex}.ts`),
        });
      }

      return lineage.reduce(
        (previous, d) =>
          previous.with({
            [symProcessedBy]: processor,
            ...d,
            filename: path.resolve(root, d["filename"] || `test-${++filenameIndex}.ts`),
          }),
        initial,
      );
    },

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

/**
 * Link a node module from the main project into a different root.
 *
 * Useful
 */
export const linkNodeModules = async (root: string, ...modules: string[]) => {
  const node_modules = path.join(root, "node_modules");
  await fs.mkdir(node_modules, { recursive: true });

  await pMap(
    modules,
    async (mod) => {
      await fs.cp(path.join(__dirname, `../node_modules/${mod}/`), path.join(node_modules, mod), {
        recursive: true,
      });
    },
    { concurrency: 4 },
  );
};

/**
 * Create a datum for test.
 *
 * Automatically inserts required fields, but they can be overridden by the given data.
 */
export const testData = (data: Record<string, unknown>) => {
  return new Datum({
    basePath: "root",
    filename: `${randomUUIDv7()}.txt`,
    ...data,
  });
};
