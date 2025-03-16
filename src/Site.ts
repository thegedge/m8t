import path from "node:path";
import { getSystemErrorName } from "node:util";
import { ConfigType, type ResolvedConfig } from "./Config.ts";
import { Filesystem } from "./Filesystem.ts";
import type { PageData } from "./PageData.ts";
import { Pages } from "./Pages.ts";
import type { Processor, ProcessorConstructor } from "./processors/index.ts";
import type { MaybeArray } from "./types.ts";

export class Site {
  static async forRoot(root: string): Promise<Site> {
    const site = new Site(root);
    await site.init();
    return site;
  }

  readonly root: Filesystem;

  #out!: Filesystem;
  #pages!: Pages;
  #config!: ResolvedConfig;

  #processors!: Map<ProcessorConstructor, Processor>;

  private constructor(root: string) {
    const resolvedRoot = path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
    this.root = new Filesystem(resolvedRoot);
  }

  /**
   * Get the filesystem for output.
   */
  get out() {
    return this.#out;
  }

  /**
   * Get the collection of pages associated with this site.
   */
  get pages() {
    this.#pages ??= new Pages(this);
    return this.#pages;
  }

  /**
   * Get the config for this site
   */
  get config() {
    return this.#config;
  }

  /**
   * Initialize this site.
   */
  async init() {
    let importedConfig: unknown;
    try {
      importedConfig = await import(this.root.absolute("site-config.ts"));
    } catch (error) {
      if (getSystemErrorName(error) !== "ENOENT") {
        throw error;
      }
    }

    if (importedConfig && typeof importedConfig === "object") {
      const config = "default" in importedConfig ? importedConfig.default : importedConfig;
      this.#config = ConfigType().parse(config);
    }

    this.#out = new Filesystem(path.resolve(this.root.path, this.#config.outDir));
    this.#processors = new Map((this.#config.processors ?? []).map((Clazz) => [Clazz, new Clazz(this)]));
  }

  async processData(data: PageData): Promise<MaybeArray<PageData> | null> {
    const processors = this.processorsFor(data);
    for (const processor of processors) {
      const result = await processor.process(data);
      if (result) {
        return result;
      }
    }
    return null;
  }

  private processorsFor(data: PageData): IteratorObject<Processor> {
    const processors = data.processors;
    if (processors) {
      for (const processor of processors) {
        if (!this.#processors.has(processor)) {
          this.#processors.set(processor, new processor(this));
        }
      }

      return this.#processors
        .values()
        .filter((processor) => processors.includes(processor.constructor as ProcessorConstructor));
    }

    return this.#processors.values();
  }

  get pagesRoot() {
    return this.root.cd(this.#config.pagesDir);
  }
}
