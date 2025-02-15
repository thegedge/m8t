import type { Site } from "../Site";
import { PageComponentProps, PageData } from "../types";

export { CssProcessor } from "./css";
export { JsProcessor } from "./js";
export { JsxProcessor } from "./jsx";
export { MdxProcessor } from "./mdx";
export { StaticJavascriptProcessor } from "./static-javascript";

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
