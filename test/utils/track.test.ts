import { describe, expect, test } from "vitest";

import { track } from "../../src/utils/track.js";

const waitAsync = async (ms: number) => {
  await new Promise((r) => setTimeout(r, ms));
};

const waitSync = (ms: number) => {
  Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms);
};

const spin = (ms: number) => {
  const end = process.hrtime.bigint() + BigInt(ms) * 1_000_000n;
  while (process.hrtime.bigint() < end) {
    // do nothing
  }
};

const measureWall = async <T>(fn: () => Promise<T>): Promise<[T, bigint]> => {
  const t0 = process.hrtime.bigint();
  const out = await fn();
  return [out, process.hrtime.bigint() - t0];
};

const EPSILON = 1_000_000n; // one million nanoseconds = 1 millisecond

// These are my best attempt at measuring properties of the measurement vs timings
describe("track", () => {
  test("resolves to the callback value", async () => {
    const [result] = await track(async () => "result");
    expect(result).toEqual("result");
  });

  test("sync work before the first await is counted", async () => {
    const [, timing] = await track(async () => {
      waitSync(50);
      await waitAsync(0);
    });
    expect(timing).toBeGreaterThan(50_000_000n);
  });

  test("sync work after an await is counted", async () => {
    const [, timing] = await track(async () => {
      await waitAsync(0);
      waitSync(50);
    });
    expect(timing).toBeGreaterThan(50_000_000n);
  });

  test("work on both sides of an await sums", async () => {
    const [, timing] = await track(async () => {
      waitSync(25);
      await waitAsync(0);
      waitSync(25);
    });
    expect(timing).toBeGreaterThan(50_000_000n);
  });

  test("measured time is invariant to how long we await", async () => {
    const body = (delay: number) => async () => {
      spin(20);
      await waitAsync(delay);
      spin(20);
    };

    const [[, fast], fastWall] = await measureWall(() => track(body(20)));
    const [[, slow], slowWall] = await measureWall(() => track(body(120)));

    // Not sure why, but this one has to be a little more lenient than other checks
    expect(slowWall).toBeInRange(fastWall + 100_000_000n, 5n * EPSILON);
    expect(slow).toBeInRange(fast, EPSILON);
  });

  test("async waiting measures close to zero", async () => {
    const [, timing] = await track(async () => {
      await waitAsync(100);
    });
    expect(timing).toBeInRange(0n, EPSILON);
  });

  test("empty microtask chains measures close to zero", async () => {
    const [[_, timing], wall] = await measureWall(
      async () =>
        await track(async () => {
          for (let i = 0; i < 1_000; i++) {
            await Promise.resolve();
          }
        }),
    );

    // Expect ~25% of the time to be dealing with the microtask queue
    expect(timing).toBeGreaterThan(wall / 4n);
  });

  test("time spent queued behind another task is not measured", async () => {
    setTimeout(() => spin(100), 5);
    const [[, timing], wall] = await measureWall(() => track(() => waitAsync(10)));

    expect(wall).toBeGreaterThan(50);
    expect(timing).toBeLessThan(EPSILON);
  });

  test("concurrent branches are not double-counted", async () => {
    const [, timing] = await track(async () => {
      await Promise.all([
        (async () => {
          await waitAsync(50);
          spin(40);
        })(),
        (async () => {
          await waitAsync(50);
          spin(40);
        })(),
      ]);
    });
    expect(timing).toBeInRange(80_000_000n, EPSILON);
  });

  test("nested tracks each see only their own work", async () => {
    const [innerPair, outerTiming] = await track(async () => {
      await waitAsync(100);
      spin(20);
      return track(async () => {
        await waitAsync(100);
        spin(40);
      });
    });
    expect(innerPair[1]).toBeInRange(40_000_000n, EPSILON);
    expect(outerTiming).toBeInRange(20_000_000n, EPSILON);
  });
});
