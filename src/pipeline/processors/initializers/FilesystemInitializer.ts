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
            const stat = await fs.promises.stat(pathname);
            if (stat.isDirectory()) {
              const pipelineRoot = new Filesystem(pathname);
              return await Array.fromAsync(this.initData(context, pipelineRoot, datum));
            } else if (stat.isFile()) {
              return await this.load(datum, context);
            } else {
              // Assume something further in the pipeline will handle it
              return datum;
            }
          } catch (error) {
            // Assume "file not found" error
            return datum;
          }
        },
        { concurrency: 1 },
      )
    ).flat();
  }

  private async *initData(context: DefaultContext, fileSystem: Filesystem, parentData: Datum): AsyncGenerator<Datum> {
    const listing = await fileSystem.ls();
    const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
    if (dataFile) {
      log("found data file: %s", dataFile.name);
      try {
        const dataFilePath = path.join(fileSystem.path, dataFile.name);
        const dataFileDatum = parentData.branch({
          filename: dataFilePath,
          [symProcessedBy]: this,
        });
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
        yield* this.initData(context, fileSystem.cd(entry.name), parentData);
      } else {
        try {
          const filePath = path.join(fileSystem.path, entry.name);
          log("found page to process: %s", filePath);
          yield await this.load(parentData.branch({ filename: filePath }), context);
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
