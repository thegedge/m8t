import path from "node:path";
import { Filesystem } from "./Filesystem.ts";
import type { Processor } from "./processors/index.ts";
import { Site } from "./Site.ts";

type DevServerConfig = {
  port?: number;
  redirectsPath?: string;
};

type ResolvedDevServerConfig = {
  port: number;
  redirectsPath?: string;
};

export class SiteBuilder {
  static async siteForRoot(root: string): Promise<Site> {
    const { default: builder } = await import(path.join(root, "site.ts"));
    if (!(builder instanceof SiteBuilder)) {
      throw new Error("site.ts must export a SiteBuilder as the default export");
    }
    return new Site(builder);
  }

  readonly root: Filesystem;

  #outDir: string;
  #staticDir: string;
  #pagesDir: string;
  #processors: Processor[] = [];
  #typesPath: string = "";
  #devServer: ResolvedDevServerConfig;
  #additionalWatchDirs: Filesystem[] = [];
  constructor(root: string) {
    const resolvedRoot = path.isAbsolute(root) ? root : path.resolve(process.cwd(), root);
    this.root = new Filesystem(resolvedRoot);
    this.#pagesDir = path.resolve(this.root.path, "pages");
    this.#staticDir = path.resolve(this.root.path, "static");
    this.#outDir = path.resolve(this.root.path, "out");
    this.#devServer = {
      port: 3000,
    };
  }

  get out(): Filesystem {
    return new Filesystem(this.#outDir);
  }

  get pages(): Filesystem {
    return new Filesystem(this.#pagesDir);
  }

  get static(): Filesystem {
    return new Filesystem(this.#staticDir);
  }

  get typesPath(): string {
    return this.#typesPath;
  }

  get processorsList(): Processor[] {
    return this.#processors;
  }

  get devServerConfig(): ResolvedDevServerConfig {
    return this.#devServer;
  }

  get additionalWatchDirs(): Filesystem[] {
    return this.#additionalWatchDirs;
  }

  watch(root: string): this {
    this.#additionalWatchDirs.push(new Filesystem(root));
    return this;
  }

  outputRoot(dir: string): this {
    this.#outDir = path.resolve(this.root.path, dir);
    return this;
  }

  pageRoot(dir: string): this {
    this.#pagesDir = path.resolve(this.root.path, dir);
    return this;
  }

  staticFilesRoot(dir: string): this {
    this.#staticDir = path.resolve(this.root.path, dir);
    return this;
  }

  processors(...processors: Processor[]): this {
    this.#processors.push(...processors);
    return this;
  }

  withTypes(path: string): this {
    this.#typesPath = path;
    return this;
  }

  devServer(config: DevServerConfig): this {
    this.#devServer = {
      port: 3000,
      ...config,
    };
    return this;
  }
}
