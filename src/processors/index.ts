import type { PageData } from "../PageData.js";
import type { Site } from "../Site.js";
import type { MaybeArray } from "../types.js";

export { MdxLoader } from "./loaders/mdx.js";
export { ReadFileLoader } from "./loaders/read_file.js";
export { TypescriptLoader } from "./loaders/typescript.js";
export { CssRenderer } from "./renderers/css.js";
export { ReactRenderer } from "./renderers/react.js";
export { StringRenderer } from "./renderers/string.js";
export { StaticJavascriptProcessor } from "./static_javascript.js";
export { ContentFunctionTransformer } from "./transformers/content_function.js";
export { LayoutTransformer } from "./transformers/layout.js";
export { PageDefaultsTransformer } from "./transformers/page_defaults.js";
export { ReadingTimeTransformer } from "./transformers/reading_time.js";
export { SearchTransformer } from "./transformers/search.js";

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
