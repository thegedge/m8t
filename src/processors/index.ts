import type { PageData } from "../PageData.ts";
import type { Site } from "../Site.ts";
import type { MaybeArray } from "../types.ts";

export { MdxLoader } from "./loaders/mdx.ts";
export { ReadFileLoader } from "./loaders/read_file.ts";
export { TypescriptLoader } from "./loaders/typescript.ts";
export { CssRenderer } from "./renderers/css.ts";
export { StringRenderer } from "./renderers/string.ts";
export { StaticJavascriptProcessor } from "./static_javascript.ts";
export { ContentFunctionRenderer } from "./transformers/content_function.ts";
export { LayoutTransformer } from "./transformers/layout.ts";
export { PageDefaultsTransformer } from "./transformers/page_defaults.ts";
export { ReactRenderer } from "./transformers/react.ts";
export { ReadingTimeTransformer } from "./transformers/reading_time.ts";
export { SearchTransformer } from "./transformers/search.ts";

/**
 * A processor that takes data, transforms it in some way, and then produces new data.
 *
 * There are three types of processors:
 *
 *   1. **Loaders**, which are the starting point for data. They typically only expect a file name and will produce
 *      a new piece of data that contains the filename, some metadata, and the content from the file.
 *   2. **Transformers**, which take data and transform it in some way, typically adding new metadata.
 *   3. **Renderers**, which take a piece of data and produce something that can be rendered. For example, a React
 *      renderer would expect to have a piece of data where the content is an `Element` and would produce a new piece
 *      of data where the content is a string with mime type `text/html`.
 */
export type Processor = {
  /**
   * Process the given data
   *
   * A processor can take the given data and return a new piece of data, or it can branch out and
   * produce multiple pieces of data (for example, a processor for generator functions could yield
   * many new pieces of data)
   *
   * A processor that does not handle the given data can return `undefined`.
   */
  process(site: Site, data: PageData): Promise<MaybeArray<PageData> | undefined>;
};
