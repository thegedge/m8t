import type { MaybeArray, Site } from "../index.js";
import type { Datum, DatumShape } from "./Datum.js";
import type { DefaultContext } from "./utils.js";

export { Datum, type DatumShape as DefaultDatumShape } from "./Datum.js";
export { Pipeline, reprocess } from "./Pipeline.js";
export { FilesystemInitializer } from "./processors/initializers/FilesystemInitializer.js";
export { MdxLoader } from "./processors/loaders/mdx.js";
export { ReadFileLoader } from "./processors/loaders/read_file.js";
export { TypescriptLoader } from "./processors/loaders/typescript.js";
export { CssRenderer } from "./processors/renderers/css.js";
export { ReactRenderer } from "./processors/renderers/react.js";
export { StringRenderer } from "./processors/renderers/string.js";
export { StaticJavascriptProcessor } from "./processors/static_javascript.js";
export { ContentFunctionTransformer } from "./processors/transformers/content_function.js";
export { LayoutTransformer } from "./processors/transformers/layout.js";
export { PageDefaultsTransformer } from "./processors/transformers/page_defaults.js";
export { ReadingTimeTransformer } from "./processors/transformers/reading_time.js";
export { SearchTransformer } from "./processors/transformers/search.js";
export { TypesProcessor } from "./processors/types.js";

/**
 * A processing object that can process a single piece of data with a given context.
 */
export interface SingleProcessor<
  DataT = Datum<DatumShape>,
  ResultT = MaybeArray<DataT>,
  ContextT extends DefaultContext = DefaultContext,
> {
  init?(site: Site): void;
  processOne(data: DataT, context: ContextT): Promise<ResultT>;
}

/**
 * A processing object that can process an array of data with a given context.
 */
export interface ManyProcessor<
  DataT = Datum<DatumShape>,
  ResultT = DataT,
  ContextT extends DefaultContext = DefaultContext,
> {
  init?(site: Site): void;
  processMany(data: readonly DataT[], context: ContextT): Promise<readonly ResultT[]>;
}

/**
 * A processing function that can process an array of data with a given context.
 */
export type ManyProcessorFunction<
  DataT = Datum<DatumShape>,
  ResultT = DataT,
  ContextT extends DefaultContext = DefaultContext,
> = (data: readonly DataT[], context: ContextT) => Promise<readonly ResultT[]>;

/**
 * A pipeline stage that takes an array of data, transforms it in some way, and then produces data for the next stage.
 */
export type PipelineStage = ManyProcessor | ManyProcessorFunction | SingleProcessor;
