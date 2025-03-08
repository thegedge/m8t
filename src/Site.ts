import path from "node:path";
import { getSystemErrorName } from "node:util";
import { ConfigType, type ResolvedConfig } from "./Config.ts";
import { Filesystem } from "./Filesystem.ts";
import type { Loader, LoaderConstructor } from "./loaders/index.ts";
import { Pages } from "./Pages.ts";
import type { Renderer, RendererConstructor } from "./renderers/index.ts";
import type { PageData } from "./types.ts";

export class Site {
  static async forRoot(root: string): Promise<Site> {
    const site = new Site(root);
    await site.reload();
    return site;
  }

  readonly root: Filesystem;

  #out!: Filesystem;
  #pages!: Pages;
  #config!: ResolvedConfig;

  #loaders!: Map<LoaderConstructor, Loader>;
  #renderers!: Map<RendererConstructor, Renderer>;

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
      this.#config = ConfigType().parse(config);
    }

    this.#out = new Filesystem(path.resolve(this.root.path, this.#config.outDir));
    this.#loaders = new Map((this.#config.loaders ?? []).map((Clazz) => [Clazz, new Clazz(this)]));
    this.#renderers = new Map((this.#config.renderers ?? []).map((Clazz) => [Clazz, new Clazz(this)]));
  }

  get loaders(): IteratorObject<Loader> {
    return this.#loaders.values();
  }

  get renderers(): IteratorObject<Renderer> {
    return this.#renderers.values();
  }

  loaderForType<T extends LoaderConstructor = LoaderConstructor>(type: T): InstanceType<T> {
    const loader = this.#loaders.get(type);
    if (!loader) {
      throw new Error(`No loader registered for "${type.name}"`);
    }

    return loader as InstanceType<T>;
  }

  loaderForFilename(filename: string): Loader {
    for (const loader of this.#loaders.values()) {
      if (loader.handles(filename)) {
        return loader;
      }
    }

    throw new Error(`No loader for extension "${filename}"`);
  }

  rendererForType<T extends RendererConstructor = RendererConstructor>(type: T): InstanceType<T> {
    const renderer = this.#renderers.get(type);
    if (!renderer) {
      throw new Error(`No renderer registered for "${type.name}"`);
    }

    return renderer as InstanceType<T>;
  }

  rendererForPage(page: PageData): Renderer {
    for (const renderer of this.#renderers.values()) {
      if (renderer.handles(page)) {
        return renderer;
      }
    }

    throw new Error(`No processor for "${page.filename}"`);
  }

  get pagesRoot() {
    return this.root.cd(this.#config.pagesDir);
  }
}
