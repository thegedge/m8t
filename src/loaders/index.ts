import type { Site } from "../Site.ts";
import type { ContentFunction, MaybePromise, PageData } from "../types.ts";

export { MdxLoader } from "./mdx.ts";
export { ReadFileLoader } from "./read_file.ts";
export { StaticJavascriptLoader } from "./static-javascript.ts";
export { TypescriptLoader } from "./typescript.ts";

export type LoadResult<DataT extends PageData = PageData> = {
  filename: string;
  data: Partial<DataT>;
  content: ContentFunction<DataT>;
};

export type Loader<DataT extends PageData = PageData> = {
  handles(extension: string): boolean;
  load(filename: string): Promise<LoadResult<DataT>>;
  afterInitialLoad?(): MaybePromise<LoadResult<DataT>[]>;
};

export type LoaderConstructor<DataT extends PageData = PageData> = new (site: Site<DataT>) => Loader<DataT>;
