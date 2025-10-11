import debug from "debug";
import pMap from "p-map";
import type { MaybeArray } from "../index.js";
import type { Site } from "../Site.js";
import type { NonAsyncTimeMeasurement } from "../utils/NonAsyncTimeMeasurement.js";
import { symProcessedBy, symProcessingTimeMs, type DatumShape } from "./Datum.js";
import { Datum, type Pipeline, type SingleProcessor } from "./index.js";

const log = debug("m8t:processing");

export type DefaultContext = {
  performanceTracker: NonAsyncTimeMeasurement;
  pipeline: Pipeline;
  site: Site;
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
  const results = await pMap(data, async (datum) => {
    const result = await processOne(datum, context, processor);
    return result ?? datum;
  });

  // TODO how to avoid this cast?
  return results.flat() as unknown as readonly Datum<ShapeT>[];
};

export const processOne = async <ShapeT extends DatumShape, ResultT, ContextT extends DefaultContext = DefaultContext>(
  datum: Datum<ShapeT>,
  context: ContextT,
  processor: SingleProcessor<Datum<ShapeT>, MaybeArray<ResultT>, ContextT>,
): Promise<MaybeArray<ResultT> | null> => {
  const tracker = context.performanceTracker.track();
  const result = await datum.nullUnlessChanged(async () => await processor.processOne(datum, context));
  if (!result) {
    return null;
  }

  log("processed page %s with %s in %sms", datum.get("filename"), processor.constructor.name, tracker.cumulativeTime);

  if (Array.isArray(result)) {
    return result.map((newDatum) =>
      newDatum instanceof Datum
        ? newDatum.with_({
            [symProcessedBy]: processor,
            [symProcessingTimeMs]: tracker.cumulativeTime,
          })
        : newDatum,
    );
  }

  return result instanceof Datum
    ? result.with_({
        [symProcessedBy]: processor,
        [symProcessingTimeMs]: tracker.cumulativeTime,
      })
    : result;
};
