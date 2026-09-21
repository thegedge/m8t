import debug from "debug";
import fs from "fs";
import pMap from "p-map";
import path from "path";

import type { Transpiler } from "../../../loader/ModuleLoader.js";
import type { Site } from "../../../site/Site.js";
import { Filesystem } from "../../../utils/Filesystem.js";
import { isNoEntryError } from "../../../utils/is.js";
import { partition } from "../../../utils/partition.js";
import { symProcessedBy, Datum } from "../../Datum.js";
import type { ManyProcessor, SingleProcessor } from "../../index.js";
import { processOne, type DefaultContext } from "../../utils.js";

export type FilesystemLoader = SingleProcessor<Datum>;

const log = debug("m8t:filesystemInitializer");

/**
 * A pipeline stage that can seed a pipeline with data.
 *
 * It takes a single datum with a "filename" property and does one of three things.
 *
 * First, if the filename is a regular file, that file is loaded as is.
 *
 * Second, if the filename points to a directory, the directory is traversed and all the files not
 * included in any ignore lists are loaded as data. Any `_data.*` files are loaded as data and
 * merged in a breadth-first manner. For example, if you have the following directory structure:
 *
 * ```plaintext
 * src/
 *   _data.ts
 *   blog/
 *     _data.ts
 *     post-1.md
 * ```
 *
 * Then `src/_data.ts` will be loaded and merged with `blog/_data.ts`, and then finally we merge in
 * `post-1.md` at the end and `post-1.md` produces a datum to be processed by the rest of the
 * pipeline. Data files *are not* processed, but act as an easy way to provide shared data.
 */
export class FilesystemInitializer implements ManyProcessor {
  readonly #loaders: readonly FilesystemLoader[];

  constructor(options: { loaders: readonly FilesystemLoader[] }) {
    this.#loaders = options.loaders;
  }

  transpilersFor(site: Site): Transpiler[] {
    return this.#loaders.flatMap((loader) => loader.transpilersFor?.(site) ?? []);
  }

  async processMany(data: readonly Datum[], context: DefaultContext): Promise<readonly Datum[]> {
    return (
      await pMap(
        data,
        async (datum) => {
          const pathname = datum.get("filename");
          if (context.site.ignoredFilesMatcher.matches(pathname)) {
            return [];
          }

          let stat: fs.Stats;
          try {
            stat = await fs.promises.stat(pathname);
          } catch (e) {
            if (isNoEntryError(e)) {
              return datum;
            }
            throw e;
          }

          if (stat.isDirectory()) {
            const pipelineRoot = new Filesystem(pathname);
            return await this.initDirectory(context, pipelineRoot, datum);
          } else if (stat.isFile()) {
            return await this.load(datum, context);
          } else {
            // Assume something further in the pipeline will handle it
            return datum;
          }
        },
        { concurrency: 4 },
      )
    )
      .flat()
      .filter(Boolean);
  }

  private async initDirectory(
    context: DefaultContext,
    fileSystem: Filesystem,
    parentData: Datum,
  ): Promise<readonly Datum[]> {
    const listing = await fileSystem.ls();
    const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
    if (dataFile) {
      log("found data file: %s", dataFile.name);
      const dataFilePath = path.join(fileSystem.rootPath, dataFile.name);
      const dataFileDatum = parentData.branch({ filename: dataFilePath, [symProcessedBy]: this });
      parentData = await this.load(dataFileDatum, context);
    }

    // Process files in current dir before descending
    const [dirs, files] = partition(listing, (entry) => entry.isDirectory());
    const results = await pMap(
      [...files, ...dirs],
      async (entry): Promise<readonly Datum[]> => {
        if (entry.name.startsWith(".") || entry === dataFile) {
          // skip hidden files and directories
          return [];
        }

        if (entry.isDirectory()) {
          return await this.initDirectory(context, fileSystem.cd(entry.name), parentData);
        }

        const filePath = path.join(fileSystem.rootPath, entry.name);
        log("found page to process: %s", filePath);
        return [
          await this.load(
            parentData.branch({ filename: filePath, [symProcessedBy]: this }),
            context,
          ),
        ];
      },
      { concurrency: 4 },
    );
    return results.flat();
  }

  private async load(datum: Datum, context: DefaultContext): Promise<Datum> {
    for (const loader of this.#loaders) {
      const loadedData = await processOne(datum, context, loader);
      if (loadedData && !Array.isArray(loadedData)) {
        return loadedData;
      }
    }

    // throw new Error(`Could not load file for datum: ${datum.get("filename")}`);
    return datum;
  }
}
