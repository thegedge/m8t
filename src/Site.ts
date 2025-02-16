import path from "path";
import { Filesystem } from "./Filesystem.ts";
import { CssProcessor } from "./processors/css.ts";
import type { Processor, ProcessorConstructor } from "./processors/index.ts";
import { JsProcessor } from "./processors/js.ts";
import { JsxProcessor } from "./processors/jsx.ts";
import { MdxProcessor } from "./processors/mdx.ts";
import { StaticJavascriptProcessor } from "./processors/static-javascript.ts";
import type { PageData } from "./types.ts";

export type Config<DataT extends PageData = PageData> = {
  outDir?: string;
  processors?: ProcessorConstructor<DataT>[];
};

type ImportedConfig<DataT extends PageData> =
  | { default: Partial<Config<DataT>> }
  | Partial<Config<DataT>>
  | null
  | undefined;

export class Site<DataT extends PageData = PageData> {
  static async forRoot<DataT extends PageData = PageData>(root: string): Promise<Site<DataT>> {
    let config: Config<DataT> = {};
    try {
      const importedConfig: ImportedConfig<DataT> = await import(path.join(root, "site-config.ts"));
      if (importedConfig && typeof importedConfig === "object") {
        config = "default" in importedConfig ? importedConfig.default : importedConfig;
      }
    } catch (_error) {
      // May not exist, that's okay
      console.log(_error);
    }

    return new Site(root, config);
  }

  readonly root: Filesystem;
  readonly out: Filesystem;

  private processorClasses: ProcessorConstructor[];
  private processors!: Map<ProcessorConstructor, Processor>;

  constructor(root: string, config: Config<DataT>) {
    const resolvedRoot = path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
    this.root = new Filesystem(resolvedRoot);
    this.out = new Filesystem(path.resolve(resolvedRoot, config.outDir ?? "out"));

    this.processorClasses = config.processors ?? [
      JsProcessor,
      JsxProcessor,
      CssProcessor,
      MdxProcessor,
      StaticJavascriptProcessor,
    ];
    this.resetProcessors();
  }

  /**
   * Reset the processor list + state.
   *
   * TODO: would rather not have this be imperative
   */
  resetProcessors() {
    this.processors = new Map(this.processorClasses.map((Clazz) => [Clazz, new Clazz(this)]));
  }

  processorForType<T extends ProcessorConstructor = ProcessorConstructor>(type: T): InstanceType<T> {
    const processor = this.processors.get(type);
    if (!processor) {
      throw new Error(`No processor registered for "${type.name}"`);
    }

    return processor as InstanceType<T>;
  }

  processorForFile(filename: string): Processor {
    const ext = path.extname(filename).slice(1); // remove the leading "."
    const applicableProcessor = this.processors
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
    // TODO have this be specified in the config
    return this.root.cd("src");
  }
}
