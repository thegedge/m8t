import type { Filesystem } from "./Filesystem.js";
import { Pages } from "./Pages.js";
import type { Processor } from "./processors/index.js";
import { Search } from "./Search.js";
import type { SiteBuilder } from "./SiteBuilder.js";

export class Site {
  readonly builder: SiteBuilder;
  readonly root: Filesystem;
  readonly out: Filesystem;
  readonly pages: Pages;
  readonly static: Filesystem;
  readonly processors: ReadonlyArray<Processor>;
  readonly watchDirs: ReadonlyArray<Filesystem>;
  readonly mode: "development" | "production";

  constructor(builder: SiteBuilder) {
    this.builder = builder;
    this.root = builder.root;
    this.out = builder.out;
    this.pages = new Pages(this, builder.pages);
    this.static = builder.static;
    this.processors = builder.processorsList;
    this.watchDirs = [this.root, ...builder.additionalWatchDirs];
    this.mode = builder.modeValue;
  }

  get isDevelopment(): boolean {
    return this.mode === "development";
  }

  get search() {
    return new Search(this.pages);
  }
}
