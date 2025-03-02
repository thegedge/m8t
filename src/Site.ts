import path from "node:path";
import { getSystemErrorName } from "node:util";
import { ConfigType, type ResolvedConfig } from "./Config.ts";
import { Filesystem } from "./Filesystem.ts";
import { Pages } from "./Pages.ts";
import type { Processor, ProcessorConstructor } from "./processors/index.ts";
import type { PageData } from "./types.ts";

export class Site<DataT extends PageData = PageData> {
  static async forRoot<DataT extends PageData = PageData>(root: string): Promise<Site<DataT>> {
    const site = new Site<DataT>(root);
    await site.reload();
    return site;
  }

  readonly root: Filesystem;

  #out!: Filesystem;
  #pages!: Pages<DataT>;
  #config!: ResolvedConfig<DataT>;
  #processors!: Map<ProcessorConstructor<DataT>, Processor<DataT>>;

  constructor(root: string) {
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
   * Reset the processor list + state.
   *
   * TODO: would rather not have this be imperative
   */
  async reload() {
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
      this.#config = ConfigType<DataT>().parse(config);
    }

    this.#out = new Filesystem(path.resolve(this.root.path, this.#config.outDir));
    this.#processors = new Map((this.#config.processors ?? []).map((Clazz) => [Clazz, new Clazz(this)]));
  }

  get processors(): IteratorObject<Processor<DataT>> {
    return this.#processors.values();
  }

  processorForType<T extends ProcessorConstructor<DataT> = ProcessorConstructor<DataT>>(type: T): InstanceType<T> {
    const processor = this.#processors.get(type);
    if (!processor) {
      throw new Error(`No processor registered for "${type.name}"`);
    }

    return processor as InstanceType<T>;
  }

  processorForFile(filename: string): Processor {
    const ext = path.extname(filename).slice(1); // remove the leading "."
    const applicableProcessor = this.#processors
      .values()
      .filter((processor) => processor.handles(ext))
      .toArray();

    if (applicableProcessor.length == 0) {
      throw new Error(`No processor for file "${filename}"`);
    }

    // TODO perhaps have a warn mode about this
    // if (applicableProcessor.length > 1) {
    //   throw new Error(`Multiple processors for file "${filename}"`);
    // }

    return applicableProcessor[0];
  }

  get pagesRoot() {
    return this.root.cd(this.#config.pagesDir);
  }
}
