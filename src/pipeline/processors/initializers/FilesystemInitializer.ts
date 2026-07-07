import debug from "debug";
import fs from "fs";
import pMap from "p-map";
import path from "path";

import { Filesystem } from "../../../Filesystem.js";
import type { Datum, ManyProcessor, SingleProcessor } from "../../../types.js";
import { symProcessedBy } from "../../Datum.js";
import { processOne, type DefaultContext } from "../../utils.js";

export type Loader = SingleProcessor<Datum>;

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
  readonly #loaders: readonly Loader[];

  constructor(options: { loaders: readonly Loader[] }) {
    this.#loaders = options.loaders;
  }

  async processMany(data: readonly Datum[], context: DefaultContext): Promise<readonly Datum[]> {
    return (
      await pMap(
        data,
        async (datum) => {
          try {
            const pathname = datum.get("filename");
            if (context.site.ignoredFilesMatcher.matches(pathname)) {
              return [];
            }

            const stat = await fs.promises.stat(pathname);
            if (stat.isDirectory()) {
              const pipelineRoot = new Filesystem(pathname);
              return await Array.fromAsync(this.init(context, pipelineRoot, datum));
            } else if (stat.isFile()) {
              return await this.load(datum, context);
            } else {
              // Assume something further in the pipeline will handle it
              return datum;
            }
          } catch {
            // Assume "file not found" error
            return datum;
          }
        },
        { concurrency: 1 },
      )
    ).flat();
  }

  private async *init(
    context: DefaultContext,
    fileSystem: Filesystem,
    parentData: Datum,
  ): AsyncGenerator<Datum> {
    const listing = await fileSystem.ls();
    const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
    if (dataFile) {
      log("found data file: %s", dataFile.name);
      try {
        const dataFilePath = path.join(fileSystem.path, dataFile.name);
        const dataFileDatum = parentData.branch({ filename: dataFilePath, [symProcessedBy]: this });
        const sharedData = await this.load(dataFileDatum, context);
        if (sharedData) {
          parentData = sharedData;
        } else {
          console.warn(`Could not load data file ${dataFilePath}. Ignoring...`);
        }
      } catch (error) {
        console.warn(`Error loading _data from ${fileSystem.path}. Ignoring...`);
        console.warn(error);
      }
    }

    for (const entry of listing) {
      if (entry.name.startsWith(".") || entry === dataFile) {
        // skip hidden files and directories
        continue;
      }

      if (entry.isDirectory()) {
        yield* this.init(context, fileSystem.cd(entry.name), parentData);
      } else {
        try {
          const filePath = path.join(fileSystem.path, entry.name);
          log("found page to process: %s", filePath);
          yield await this.load(
            parentData.branch({ filename: filePath, [symProcessedBy]: this }),
            context,
          );
        } catch (error) {
          console.error(`Error loading ${entry.name} from ${fileSystem.path}`);
          console.error(error);
        }
      }
    }
  }

  private async load(datum: Datum, context: DefaultContext): Promise<Datum> {
    for (const loader of this.#loaders) {
      const loadedData = await processOne(datum, context, loader);
      if (loadedData && !Array.isArray(loadedData)) {
        return loadedData;
      }
    }

    throw new Error(`Could not load file for datum: ${datum.get("filename")}`);
  }
}
