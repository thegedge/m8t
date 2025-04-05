import { writeFile } from "fs/promises";
import { merge, omit } from "lodash-es";
import path from "path";
import { Filesystem } from "./Filesystem.ts";
import type { PageData } from "./PageData.ts";
import type { Site } from "./Site.ts";
import type { MaybeArray } from "./types.ts";
import { counterPromise } from "./utils/counterPromise.ts";
import { javascriptValueToTypescriptType } from "./utils/jsObjectToTypescriptType.ts";
import { restartableTimeout } from "./utils/restartableTimeout.ts";

const OMITTED_KEYS_FOR_TYPES = [
  "components",
  "content",
  "filename",
  "htmlValidateRules",
  "ICONS",
  "layout",
  "mimeType",
  "processors",
  "search",
];

export class Pages {
  /** The filesystem of the pages directory */
  root: Filesystem;

  /** Any pages that have been processed enough to the point that they have a url, but may still be incomplete */
  #pages = new Map<string, PageData>();

  /** Whether the processing pipeline is idle */
  #idle: Promise<void>;
  #idleResolve!: () => void;

  constructor(
    readonly site: Site,
    root: Filesystem,
  ) {
    this.root = root;
    this.#idle = new Promise((resolve) => {
      this.#idleResolve = resolve;
    });
  }

  get pages() {
    return this.#pages;
  }

  async page(url: string): Promise<PageData | undefined> {
    return this.#pages.get(decodeURI(url));
  }

  urls(): string[] {
    return Array.from(this.#pages.keys());
  }

  get idle() {
    return this.#idle;
  }

  async init() {
    // We have an issue where pages that aren't fully rendered aren't in the pages map, so search queries
    // will have trouble finding them. Should search also look through the data we're actively processing?
    // Or should we have rendering be more explicit, perhaps some way of processors being able to say "hey,
    // I will handle this, but not until you've gone as far as you can with everything else".

    const { increment: workStarted, decrement: workCompleted, promise: allWorkDone } = counterPromise();
    const { restart, promise: workTimedOut } = restartableTimeout(5000);

    let processedDataSinceLastCheck = false;
    const interval = setInterval(() => {
      if (processedDataSinceLastCheck) {
        processedDataSinceLastCheck = false;
      } else {
        this.#idleResolve();
        this.#idle = new Promise((resolve) => {
          this.#idleResolve = resolve;
        });
      }
    }, 200);

    const types = new Map<string, string>();

    const processWork = (pageData: PageData) => {
      workStarted();

      Promise.resolve(pageData)
        .then((result) => this.processOnce(result))
        .then((result) => {
          if (result) {
            const newPageData = Array.isArray(result) ? result : [result];
            for (const newPageDatum of newPageData) {
              // Remove the entry for the previous page
              if (typeof pageData.url === "string") {
                this.#pages.delete(pageData.url);
              }

              // We also `addPage` in here to ensure that the page is added to the search index, so intermediate phases
              // can still find pages. This does mean pages will need to largely have searchable metadata available up
              // front in the early stages of processing.
              if (typeof newPageDatum.url === "string") {
                this.#pages.set(newPageDatum.url, newPageDatum);
              }

              // We've finished processing this page, so we can start on the next one
              Promise.resolve().then(() => processWork(newPageDatum));
            }
          } else if (typeof pageData.url === "string") {
            this.#pages.set(pageData.url, pageData);

            // Page finalized, add type information
            const typesPath = path.join(this.site.root.path, this.site.builder.typesPath);
            types.set(
              path.relative(typesPath, pageData.filename),
              `
declare module "${path.relative(path.dirname(typesPath), pageData.filename)}" {
  export type DataProps = ${javascriptValueToTypescriptType(omit(pageData, OMITTED_KEYS_FOR_TYPES), "  ").trim()};
}
`,
            );
          } else {
            // TODO warn during development, throw on build
            console.warn(`Skipping page ${pageData.filename} has no URL`);
          }
        })
        .catch((err) => {
          // Maybe reject if we're building vs in development?
          console.warn(`Error processing page ${pageData.filename}`);
          console.warn(err);
        })
        .finally(() => {
          workCompleted();
          restart();
          processedDataSinceLastCheck = true;
        });
    };

    try {
      for await (const result of this.initData(this.root)) {
        if (Array.isArray(result)) {
          for (const pageData of result) {
            processWork(pageData);
          }
        } else if (result) {
          processWork(result);
        }
      }

      await Promise.race([allWorkDone, workTimedOut]);

      const typesPath = path.join(this.site.root.path, this.site.builder.typesPath);
      await writeFile(typesPath, `import "path";\n\n${Array.from(types.values()).join("")}`);
    } finally {
      clearInterval(interval);
    }
  }

  private async *initData(
    fileSystem: Filesystem,
    parentData: PageData = { filename: fileSystem.path },
  ): AsyncGenerator<MaybeArray<PageData> | undefined> {
    const listing = await fileSystem.ls();

    const dataFile = listing.find((entry) => entry.name.startsWith("_data."));
    if (dataFile) {
      try {
        const dataFilePath = path.join(fileSystem.path, dataFile.name);
        const data: PageData = { ...parentData, filename: dataFilePath };
        const sharedData = (await this.processDataFile(data)) ?? data;
        if (Array.isArray(sharedData)) {
          console.warn(`Processing of data file ${dataFilePath} unexpectedly returned an array. Ignoring...`);
        } else {
          parentData = merge({}, parentData, sharedData);
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
        yield* this.initData(fileSystem.cd(entry.name), parentData);
      } else {
        try {
          const filePath = path.join(fileSystem.path, entry.name);
          yield { ...parentData, filename: filePath };
        } catch (error) {
          console.error(`Error loading ${entry.name} from ${fileSystem.path}`);
          console.error(error);
        }
      }
    }
  }

  async processOnce(data: PageData) {
    const processors = data.processors ?? this.site.processors;
    for (const processor of processors) {
      const result = await processor.process(this.site, data);
      if (result) {
        return result;
      }
    }
    return null;
  }

  private async processDataFile(data: PageData) {
    let result = data;
    for (let i = 0; i < 100; i++) {
      for (const processor of this.site.processors) {
        const newResult = await processor.process(this.site, result);
        if (newResult) {
          if (Array.isArray(newResult)) {
            throw new Error(
              `processor ${processor.constructor.name} unexpectedly returned an array when processing ${data.filename}`,
            );
          }
          result = newResult;
        } else {
          return result;
        }
      }
    }

    throw new Error(`could not process data fully: ${data.filename}`);
  }
}
