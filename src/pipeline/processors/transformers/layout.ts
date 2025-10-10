import { Pipeline, type PipelineStage, type SingleProcessor } from "../../../index.js";
import { Datum } from "../../Datum.js";
import type { DefaultContext } from "../../utils.js";
import { noIndex } from "./search.js";

const MAX_ITERATIONS = 10;

/**
 * A transformer that can render a data's content into another.
 *
 * Will look for a `layout` value on a data blob, a string under a layouts directory, and
 * try to load and process that layout.
 */
export class LayoutTransformer implements SingleProcessor {
  readonly #layoutDir: string;
  readonly #pipeline: Pipeline;

  /**
   * @param layoutDir - The directory containing the layouts, relative to the site root.
   * @param pipeline - The pipeline to use to repeatedly process data until there's no longer a layout
   */
  constructor(layoutDir: string, pipeline: readonly PipelineStage[]) {
    this.#layoutDir = layoutDir;
    this.#pipeline = new Pipeline({ stages: pipeline });
  }

  async processOne(datum: Datum, context: DefaultContext): Promise<Datum> {
    let result = datum.branch();
    for (let iteration = 0; iteration < MAX_ITERATIONS; iteration++) {
      const layout = result.get("layout");
      if (typeof layout !== "string") {
        break;
      }

      const layoutFile = context.site.root.absolute(this.#layoutDir, layout);
      const [layoutData] = await this.#pipeline.add(
        [
          result
            .branch({
              basePath: this.#layoutDir,
              filename: layoutFile,
              /**
               * The sub pipeline will commonly use the {@linkcode SearchTransformer},
               * but we don't want to index the layout datum
               */
              [noIndex]: true,
            })
            .delete(
              // If we don't do this, the final layout will repeat, until we run out of iterations.
              // If the layout itself has a layout, it should get merged in by `this.#pipeline`,
              // assuming the user properly set up the pipeline (TODO: how to ensure that?)
              "layout",
            ),
        ],
        {
          ...context,
          pipeline: this.#pipeline,
        },
      );
      if (!layoutData) {
        break;
      }

      const layoutContent = layoutData.get("content");
      if (layoutContent) {
        if (typeof layoutContent === "function") {
          const resultRecord = result.toRecord();
          const layoutRecord = layoutData.toRecord();
          const content = await layoutContent({
            ...layoutRecord,
            ...resultRecord,
            children: result.get("content"),
          });
          result = result.set({
            ...layoutRecord,
            ...resultRecord,
            layout: layoutData.get("layout"),
            content,
          });
        } else {
          // TODO probably warn instead of bailing and returning the original?
          return datum;
        }
      }
    }

    return result;
  }
}
