import {
  AsyncLocalStorage,
  createHook,
  executionAsyncResource,
  type AsyncHook,
} from "node:async_hooks";

export type Tracker = {
  depth: number;
  start: bigint;
  cumulativeNanos: bigint;
};

type TrackResource = { [symTracker]: Tracker };

const storage = new AsyncLocalStorage<Tracker>();
const symTracker = Symbol("tracker");
let hook_: AsyncHook;
let hookEnabledCount_ = 0;

const hook = () => {
  const enter = (tracker: Tracker) => {
    if (tracker.depth++ === 0) {
      tracker.start = process.hrtime.bigint();
    }
  };

  const exit = (tracker: Tracker) => {
    if (--tracker.depth === 0) {
      tracker.cumulativeNanos += process.hrtime.bigint() - tracker.start;
    }
  };

  const enable = () => {
    ++hookEnabledCount_;
    if (hookEnabledCount_ == 1) {
      hook_.enable();
    }
  };

  const disable = () => {
    --hookEnabledCount_;
    if (hookEnabledCount_ == 0) {
      hook_.disable();
    }
  };

  hook_ ??= createHook({
    init(_asyncId, _type, _triggerAsyncId, resource: TrackResource) {
      const tracker = storage.getStore();
      if (tracker) {
        try {
          resource[symTracker] = tracker;
        } catch {
          // frozen/proxied resources may not let us set a prop
        }
      }
    },

    before() {
      const tracker = (executionAsyncResource() as TrackResource | undefined)?.[symTracker];
      if (tracker) {
        enter(tracker);
      }
    },

    after() {
      const tracker = (executionAsyncResource() as TrackResource | undefined)?.[symTracker];
      if (tracker) {
        exit(tracker);
      }
    },
  });

  return async <T>(f: () => Promise<T>): Promise<[result: T, timeNanos: bigint]> => {
    const tracker: Tracker = { cumulativeNanos: 0n, depth: 0, start: 0n };

    const result = await storage.run(tracker, async () => {
      enable();
      try {
        // This enter/exit pair tracks the sync time for the "init" of `f` (the initial sync portion)
        enter(tracker);

        let p: Promise<T>;
        try {
          p = f();
        } finally {
          exit(tracker);
        }

        return await p;
      } finally {
        disable();
      }
    });

    return [result, tracker.cumulativeNanos];
  };
};

/**
 * Track the time it takes to do a function call.
 *
 * Note that this is different from a typical wall-clock calculation because it excludes any time
 * where an async task is sitting on a queue, waiting to be executed. In other words, it does not
 * include time spent doing another async task concurrently.
 *
 * @returns A pair, first item being the result of the function and second being the time it took
 *    to run the function, in nanoseconds. The timing will be 0 if NODE_ENV=production.
 */
export async function track<T>(f: () => Promise<T>): Promise<[result: T, timeNanos: bigint]> {
  if (process.env.NODE_ENV == "production") {
    // TODO eventually integrate this with site and site.mode a lot better
    return [await f(), 0n];
  }

  const h = hook();
  return await h(f);
}
