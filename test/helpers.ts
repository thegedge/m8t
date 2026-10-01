import { randomUUIDv7 } from "node:crypto";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pMap from "p-map";

import {
  Datum,
  PageDefaultsTransformer,
  Pipeline,
  Site,
  TypescriptLoader,
  type SiteOptions,
} from "../src/index.js";
import { symProcessedBy, type DatumShape } from "../src/pipeline/Datum.js";
import type { DefaultContext } from "../src/pipeline/utils.js";
import { dedent } from "../src/utils/dedent.js";

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
 * A pipeline that yields the given data as-is, rooted at the site root.
 *
 * Also has the {@link PageDefaultsTransformer} so the data looks like most data.
 */
export const passthrough = (data: readonly Partial<DatumShape>[]): SiteOptions["pipelines"] => {
  return {
    ".": [
      async (baseData) => {
        const base = baseData[0];
        return data.map((datum) => base.branch(datum));
      },
      new PageDefaultsTransformer(),
    ],
  };
};

/**
 * Make a test context.
 */
export const makeContext = async (options?: SiteOptions): Promise<TestContext> => {
  const root = await fixturesRoot("m8t-test-");
  const site = await Site.fromOptions(root, {
    pipelines: {},
    ...options,
  });

  let filenameIndex = 0;
  return {
    pipeline: new Pipeline({ stages: Object.values(site.pipelines)[0] }),
    root,
    site,
    signal: new AbortController().signal,

    datum: (filenameOrDatum, ...lineage) => {
      const processor = new TypescriptLoader();

      let initial: Datum;
      let filename: string;
      if (typeof filenameOrDatum == "string") {
        filename = path.resolve(root, filenameOrDatum);
        initial = new Datum({
          [symProcessedBy]: processor,
          basePath: root,
          filename,
        });
      } else {
        filename = path.resolve(root, filenameOrDatum["filename"] || `test-${++filenameIndex}.ts`);
        initial = new Datum({
          [symProcessedBy]: processor,
          ...filenameOrDatum,
          basePath: root,
          filename,
        });
      }

      return lineage.reduce(
        (previous, d) =>
          previous.with({
            [symProcessedBy]: processor,
            ...d,
            filename: path.resolve(root, d["filename"] || filename),
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

/**
 * Build content for a `site.ts` fixture whose single pipeline stage produces the given data.
 */
export const siteTsWithPages = (pages: readonly Record<string, unknown>[]) => dedent`
  export default {
    pipelines: {
      ".": [
        async (data) => {
          return data.flatMap((datum) => [
            ${pages.map((page) => `datum.branch(${JSON.stringify(page)})`).join(",\n")}
          ]);
        },
      ],
    },
  };
`;
