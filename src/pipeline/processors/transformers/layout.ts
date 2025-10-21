import path from "node:path";
import { Pipeline, type PipelineStage, type SingleProcessor } from "../../../index.js";
import { Datum, symProcessedBy } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";
import { noIndex } from "./search.js";

const MAX_ITERATIONS = 10;

/**
 * A symbol that is used to store the filename of the layout on a datum.
 *
 * This is necessary since we delete the layout property during processing, so if you need to know
 * which layout produced some final result in the lineage of a datum, you can look at the value
 * stored under this symbol.
 */
export const symLayoutFilename = Symbol("layoutFilename");

/**
 * A transformer that can render a datum's content and lay it out in a template.
 *
 * Looks for a `layout` value on a datum, which is expected to be a relative path under a layouts
 * directory.
 *
 * This transformer requires a pipeline for processing the layout file. This does not need to be,
 * and typically is not, the original pipeline that is processing the datum. Usually it will be
 * some stage that can load the layout file, and a transformer or two to process any exports (for
 * example, the search transformer can process `search` functions exported from the layout file).
 *
 * Currently assumes that the layout file is a React component, or at least exports a `content`
 * function that takes a single object as an argument with a `children` property.
 */
export class LayoutTransformer implements SingleProcessor {
  // TODO what if layout wasn't a string point to a file, but another kind of content function?
  // TODO detect layout chain loops

  /** The directory containing the layouts, relative to the site root. */
  readonly layoutDir: string;

  /** The pipeline to use to repeatedly process data until there's no longer a layout. */
  readonly #pipeline: Pipeline;

  /**
   * @param layoutDir - The directory containing the layouts, relative to the site root.
   * @param pipeline - The pipeline to use to repeatedly process data until there's no longer a layout
   */
  constructor(layoutDir: string, pipeline: readonly PipelineStage[]) {
    this.layoutDir = layoutDir;
    this.#pipeline = new Pipeline({ stages: pipeline });
  }

  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    let resultDatum = datum;
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const layout = resultDatum.get("layout");
      if (typeof layout !== "string") {
        break;
      }

      // TODO make this a process many so we can feed many datums through the pipeline concurrently
      const layoutFile = context.site.root.absolute(this.layoutDir, layout);
      const [layoutDatum] = await this.#pipeline.add(
        [
          resultDatum
            .branch({
              basePath: this.layoutDir,
              filename: layoutFile,

              /**
               * The sub pipeline will commonly use the {@linkcode SearchTransformer},
               * but we don't want to index the layout datum
               *
               * TODO can you think of a better way to do this?
               */
              [noIndex]: true,
            })
            .delete_(
              // If we don't do this, the final layout will repeat, until we run out of iterations.
              // If the layout itself has a layout, it will get merged in through processing,
              // assuming the user properly set up the pipeline.
              "layout",
            ),
        ],
        {
          ...context,
          pipeline: this.#pipeline,
        },
      );

      const layoutContent = layoutDatum.get("content");
      if (typeof layoutContent === "function") {
        const resultRecord = resultDatum.toRecord();
        const layoutRecord = layoutDatum.toRecord();
        const content = await layoutContent({
          ...layoutRecord,
          ...resultRecord,
          children: resultDatum.get("content"),
        });
        resultDatum = resultDatum.set({
          ...layoutRecord, // layout data is lower priority, so that's why we can't use `with`
          ...resultRecord,
          layout: layoutDatum.get("layout"),
          content,
          [symProcessedBy]: this,
          [symLayoutFilename]: path.basename(layout),
        });
      } else {
        // TODO warn when this happens, or maintain the content and merge in other data?
        return datum;
      }
    }

    return resultDatum;
  }
}
