import path from "node:path";
import { Pipeline, type PipelineStage, type SingleProcessor } from "../../../index.js";
import { Datum, symProcessedBy } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";
import { noIndex } from "./search.js";

const MAX_ITERATIONS = 10;

export const symLayoutFilename = Symbol("layoutFilename");

/**
 * A transformer that can render a data's content into another.
 *
 * Will look for a `layout` value on a data blob, a string under a layouts directory, and
 * try to load and process that layout.
 *
 * TODO what if layout wasn't a string point to a file, but another kind of content function?
 * TODO detect layout chain loops
 */
export class LayoutTransformer implements SingleProcessor {
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
