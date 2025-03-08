import type { Site } from "../Site.ts";
import type { MaybePromise, PageData } from "../types.ts";

export { MdxLoader } from "./mdx.ts";
export { ReadFileLoader } from "./read_file.ts";
export { StaticJavascriptLoader } from "./static-javascript.ts";
export { TypescriptLoader } from "./typescript.ts";

export type Loader = {
  handles(extension: string): boolean;
  load(filename: string): Promise<PageData>;
  afterInitialLoad?(): MaybePromise<PageData[]>;
};

export type LoaderConstructor = new (site: Site) => Loader;
