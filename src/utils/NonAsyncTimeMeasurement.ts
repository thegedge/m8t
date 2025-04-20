import { createHook, executionAsyncId, type AsyncHook } from "node:async_hooks";
import { performance } from "node:perf_hooks";

export type Tracker = {
  cumulativeTime: number;
};

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

  track(): Tracker {
    const obj: Tracker = { cumulativeTime: 0 };
    this.#trackers.set(executionAsyncId(), obj);
    return obj;
  }

  start(): void {
    this.#hook.enable();
  }

  end(): void {
    this.#hook.disable();
  }
}
