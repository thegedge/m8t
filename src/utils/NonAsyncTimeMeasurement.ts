import { createHook, executionAsyncId, type AsyncHook } from "node:async_hooks";
import { performance } from "node:perf_hooks";

export type Tracker = {
  cumulativeTime: number;
};

/**
 * Measure the time for synchronous blocks during the execution of an async function.
 */
export class NonAsyncTimeMeasurement {
  #trackers = new Map<number, Tracker>();
  #starts = new Map<number, number>();
  #hook: AsyncHook;

  constructor() {
    this.#hook = createHook({
      init: (asyncId, _type, triggerAsyncId) => {
        const tracker = this.#trackers.get(triggerAsyncId);
        if (tracker) {
          this.#starts.set(asyncId, performance.now());
          this.#trackers.set(asyncId, tracker);
        }
      },

      before: (asyncId) => {
        this.#starts.set(asyncId, performance.now());
      },

      after: (asyncId) => {
        const startTime = this.#starts.get(asyncId);
        const tracker = this.#trackers.get(asyncId);
        if (startTime && tracker) {
          tracker.cumulativeTime += performance.now() - startTime;
        }
      },

      destroy: (asyncId) => {
        this.#starts.delete(asyncId);
        this.#trackers.delete(asyncId);
      },
    });
  }

  /**
   * Return a tracker for cumulative sync time spent.
   *
   * The `cumulativeTime` property of the returned tracker object is constantly being updated until the parent async
   * is destroyed, so you can ask for the cumulative time spent at any point during the async execution.
   *
   * Note that you can call `end` and still ask for the cumulative time from the tracker object, since the object
   * itself isn't destroyed or reset (as long as you have a strong reference to it).
   *
   * @example
   * ```ts
   * const tracker = NonAsyncTimeMeasurement.track();
   * tracker.start();
   * try {
   *   await asyncFunction();
   * } finally {
   *   tracker.end();
   * }
   *
   * console.log(tracker.cumulativeTime);
   * ```
   *
   * @returns a tracker object containing the cumulative sync time spent.
   */
  track(): Tracker {
    const obj: Tracker = { cumulativeTime: 0 };
    this.#trackers.set(executionAsyncId(), obj);
    return obj;
  }

  /**
   * Start the async hook.
   */
  start(): void {
    this.#hook.enable();
  }

  /**
   * Stop the async hook.
   */
  end(): void {
    this.#hook.disable();
  }
}
