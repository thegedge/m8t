import debug from "debug";
import pMap from "p-map";

import type { Site } from "../site/Site.js";
import type { MaybeArray } from "../types.js";
import { track } from "../utils/track.js";
import { Datum, symProcessedBy, symProcessingTimeNs, type DatumShape } from "./Datum.js";
import { type Pipeline, type SingleProcessor } from "./index.js";

/** Logging function for pipeline processing */
const log = debug("m8t:processing");

/**
 * The context provided to a pipeline's stages.
 */
export type DefaultContext = {
  /**
   * The pipeline that is processing the incoming data.
   */
  pipeline: Pipeline;

  /**
   * The site providing the data.
   */
  site: Site;

  /**
   * An abort signal that can be used to cancel a processing pipeline
   */
  signal: AbortSignal;

  [key: string | symbol]: unknown;
};

export const processManyWithSingle = async <
  ShapeT extends DatumShape,
  ResultT,
  ContextT extends DefaultContext = DefaultContext,
>(
  data: readonly Datum<ShapeT>[],
  context: ContextT,
  processor: SingleProcessor<Datum<ShapeT>, ResultT, ContextT>,
): Promise<readonly Datum<ShapeT>[]> => {
  const results = await pMap(
    data,
    async (datum) => {
      const result = await processOne(datum, context, processor);
      return result ?? datum;
    },
    { concurrency: 4 },
  );

  // TODO how to avoid this cast?
  return results.flat() as unknown as readonly Datum<ShapeT>[];
};

/**
 * Process a single datum with a given processor.
 *
 * The returned datum will also containing two special keys:
 *  - {@link symProcessedBy}: the processor that processed the datum; and
 *  - {@link symProcessingTimeNs}: the time it took to process the datum.
 *
 * @param datum - The datum to process.
 * @param context - The context to use for the processing.
 * @param processor - The processor to use for the processing.
 *
 * @returns The processed datum, or `null` if the datum was not changed.
 */
export const processOne = async <
  ShapeT extends DatumShape,
  ResultT,
  ContextT extends DefaultContext = DefaultContext,
>(
  datum: Datum<ShapeT>,
  context: ContextT,
  processor: SingleProcessor<Datum<ShapeT>, MaybeArray<ResultT>, ContextT>,
): Promise<MaybeArray<ResultT> | null> => {
  const [result, timing] = await track(async () => {
    return await datum.nullUnlessChanged(() => processor.processOne(datum, context));
  });

  log(
    "processed page %s with %s in %sms",
    datum.get("filename"),
    processor.constructor.name,
    timing,
  );
  if (!result) {
    return null;
  }

  if (Array.isArray(result)) {
    return result.map((newDatum) =>
      newDatum instanceof Datum
        ? newDatum.with_({
            [symProcessedBy]: processor,
            [symProcessingTimeNs]: timing,
          })
        : newDatum,
    );
  }

  return result instanceof Datum
    ? result.with_({
        [symProcessedBy]: processor,
        [symProcessingTimeNs]: timing,
      })
    : result;
};
