import type { Site } from "../Site.ts";
import type { PageComponentProps, PageData } from "../types.ts";

export { CssProcessor } from "./css.ts";
export { JsProcessor } from "./js.ts";
export { JsxProcessor } from "./jsx.ts";
export { MdxProcessor } from "./mdx.ts";
export { StaticJavascriptProcessor } from "./static-javascript.ts";

export type ContentFunction = (props: PageComponentProps) => unknown;

export type LoadResult<DataT = PageData> = {
  data: Partial<DataT>;
  content: ContentFunction;
};

export type Processor<DataT extends PageData = PageData> = {
  handles(extension: string): boolean;
  load(filename: string): Promise<LoadResult<DataT>>;
  render(content: unknown): Promise<string>;
};

export type ProcessorConstructor<DataT extends PageData = PageData> = new (site: Site<DataT>) => Processor<DataT>;
