import type { Datum, PipelineStage } from "../types.js";

import debug from "debug";
import { partition } from "lodash-es";
import { counterPromise } from "../utils/counterPromise.js";
import { NonAsyncTimeMeasurement } from "../utils/NonAsyncTimeMeasurement.js";
import { type DefaultContext, processManyWithSingle } from "./utils.js";

type Task = {
  stageIndex: number;
  data: readonly Datum[];
  context: DefaultContext;
};

const log = debug("m8t:pipeline");

/** Can be included in a datum to indicate that it should be sent back to the start of the pipeline. */
export const reprocess = Symbol("reprocess");

/**
 * A pipeline stage that repeatedly processes data.
 *
 * This stage will find the first processor that returns data. Every time that happens, the new piece of data will
 * be sent through the list of processors again. This process will continue until there are no more processors that
 * return data.
 */
export class Pipeline {
  #performanceTracker = new NonAsyncTimeMeasurement();
  #stages: readonly PipelineStage[];
  #working: ReturnType<typeof counterPromise>;

  constructor(options: { stages: readonly PipelineStage[] }) {
    this.#stages = options.stages;
    this.#working = counterPromise();
  }

  /**
   * Adds data to the pipeline.
   *
   * @param data - The data to add to the pipeline.
   * @param signal - An optional signal to abort the pipeline.
   *
   * @returns A promise that resolves to the fully processed data, when the data has been fully processed
   */
  async add(
    data: readonly Datum[],
    context: Partial<DefaultContext> & Pick<Required<DefaultContext>, "site">,
  ): Promise<readonly Datum[]> {
    return await this.addTask({
      stageIndex: 0,
      data,
      context: {
        performanceTracker: this.#performanceTracker,
        pipeline: this,
        signal: context.signal ?? new AbortController().signal,
        ...context,
      },
    });
  }

  private async addTask({ stageIndex, data, context }: Task): Promise<readonly Datum[]> {
    if (data.length === 0) {
      return [];
    }

    this.#working.increment();

    const workStopped = new Promise<never>((_resolve, reject) => {
      context.signal?.addEventListener("abort", () => {
        reject(new Error("work stopped"));
      });
    });

    const stage = this.#stages[stageIndex];
    if (!stage) {
      log("pipeline stage %s is undefined, not processing data", stageIndex + 1);
      return data;
    }

    try {
      log("pipeline stage %s (%s)", stageIndex + 1, stage.constructor.name);

      let dataProcessingPromise: Promise<readonly Datum[]>;
      if ("processMany" in stage) {
        dataProcessingPromise = stage.processMany(data, context);
      } else if ("processOne" in stage) {
        dataProcessingPromise = processManyWithSingle(data, context, stage);
      } else {
        dataProcessingPromise = stage(data, context);
      }

      const newData = await Promise.race([dataProcessingPromise, workStopped]);
      if (stageIndex === this.#stages.length - 1) {
        return newData;
      }

      const [newItems, nextStage] = partition(newData, (datum) => !!datum.get(reprocess));
      const [newItemsData, nextStageData] = await Promise.all([
        this.addTask({
          stageIndex: 0,
          data: newItems.map((datum) => datum.delete(reprocess)),
          context,
        }),
        this.addTask({
          stageIndex: stageIndex + 1,
          data: nextStage,
          context,
        }),
      ]);

      return [...newItemsData, ...nextStageData];
    } finally {
      this.#working.decrement();
    }
  }
}
