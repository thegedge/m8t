import debug from "debug";
import path from "node:path";
import { Filesystem } from "./Filesystem.js";
import type { Processor } from "./processors/index.js";
import { Site } from "./Site.js";

type DevServerConfig = {
  port?: number;
  redirectsPath?: string;
};

type ResolvedDevServerConfig = {
  port: number;
  redirectsPath?: string;
};

const log = debug("m8t:site");

export class SiteBuilder {
  static async siteForRoot(root: string): Promise<Site> {
    log("importing site.ts from %s", root);

    const { default: builder } = await import(path.join(root, "site.ts"));
    if (!(builder instanceof SiteBuilder)) {
      throw new Error("site.ts must export a SiteBuilder as the default export");
    }
    return new Site(builder);
  }

  readonly root: Filesystem;

  #mode: "development" | "production";
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

    this.#mode = process.env.PUBLISH ? "production" : "development";
    this.#pagesDir = path.resolve(this.root.path, "pages");
    this.#staticDir = path.resolve(this.root.path, "static");
    this.#outDir = path.resolve(this.root.path, "out");
    this.#devServer = {
      port: 3000,
    };
  }

  mode(value: "development" | "production"): this {
    this.#mode = value;
    return this;
  }

  watch(root: string): this {
    this.#additionalWatchDirs.push(new Filesystem(path.resolve(this.root.path, root)));
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

  /** @private */
  get out(): Filesystem {
    return new Filesystem(this.#outDir);
  }

  /** @private */
  get pages(): Filesystem {
    return new Filesystem(this.#pagesDir);
  }

  /** @private */
  get static(): Filesystem {
    return new Filesystem(this.#staticDir);
  }

  /** @private */
  get typesPath(): string {
    return this.#typesPath;
  }

  /** @private */
  get processorsList(): Processor[] {
    return this.#processors;
  }

  /** @private */
  get devServerConfig(): ResolvedDevServerConfig {
    return this.#devServer;
  }

  /** @private */
  get additionalWatchDirs(): Filesystem[] {
    return this.#additionalWatchDirs;
  }

  /** @private */
  get modeValue(): "development" | "production" {
    return this.#mode;
  }
}
