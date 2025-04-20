import type { Filesystem } from "./Filesystem.ts";
import { Pages } from "./Pages.ts";
import type { Processor } from "./processors/index.ts";
import { Search } from "./Search.ts";
import type { SiteBuilder } from "./SiteBuilder.ts";

export class Site {
  readonly root: Filesystem;
  readonly out: Filesystem;
  readonly pages: Pages;
  readonly static: Filesystem;
  readonly processors: ReadonlyArray<Processor>;
  readonly watchDirs: ReadonlyArray<Filesystem>;

  constructor(readonly builder: SiteBuilder) {
    this.root = builder.root;
    this.out = builder.out;
    this.pages = new Pages(this, builder.pages);
    this.static = builder.static;
    this.processors = builder.processorsList;
    this.watchDirs = [this.root, ...builder.additionalWatchDirs];
  }

  get search() {
    return new Search(this.pages);
  }
}
