import { getEventListeners } from "node:events";
import { describe, expect, test } from "vitest";

import { Datum } from "../../src/pipeline/Datum.js";
import { Pipeline, reprocess } from "../../src/pipeline/Pipeline.js";
import type { Site } from "../../src/site/Site.js";

const site = {} as unknown as Site;

const neverSettlingStage = () => new Promise<readonly Datum[]>(() => {});

describe("Pipeline", () => {
  test("passes data through a stage", async () => {
    const pipeline = new Pipeline({
      stages: [async (data: readonly Datum[]) => data],
    });

    const data = [
      new Datum({ basePath: "/", filename: "a.txt", title: "a" }),
      new Datum({ basePath: "/", filename: "b.txt", title: "b" }),
    ];
    const results = await pipeline.add(data, { site });

    expect(results).toEqual(data);
  });

  test("rejects in-flight work when the signal aborts mid-stage", async () => {
    const controller = new AbortController();
    const pipeline = new Pipeline({
      stages: [neverSettlingStage],
    });

    const result = pipeline.add([new Datum({ basePath: "/", filename: "a.txt", title: "a" })], {
      site,
      signal: controller.signal,
    });
    controller.abort();

    await expect(result).rejects.toThrow("work stopped");
  });

  test("rejects when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    const pipeline = new Pipeline({
      stages: [neverSettlingStage],
    });

    await expect(
      pipeline.add([new Datum({ basePath: "/", filename: "a.txt", title: "a" })], {
        site,
        signal: controller.signal,
      }),
    ).rejects.toThrow("work stopped");
  });

  test("removes abort listeners once work settles", async () => {
    const controller = new AbortController();
    const listenerCounts: number[] = [];
    const pipeline = new Pipeline({
      stages: [
        async (data: readonly Datum[]) => {
          listenerCounts.push(getEventListeners(controller.signal, "abort").length);
          return data;
        },
      ],
    });

    const data = [new Datum({ basePath: "/", filename: "a.txt", title: "a" })];
    for (let index = 0; index < 3; index += 1) {
      await pipeline.add(data, { site, signal: controller.signal });
    }

    expect(listenerCounts).toEqual([1, 1, 1]);
    expect(getEventListeners(controller.signal, "abort")).toHaveLength(0);
  });

  test("reprocesses a datum when requested at the last stage", async () => {
    const stage0Calls: string[] = [];
    const stage0 = async (data: readonly Datum[]) => {
      stage0Calls.push(...data.map((datum) => datum.get("filename") as string));
      return data.map((d) => d.branch({ stage0Runs: d.getOr("stage0Runs", 0) + 1 }));
    };
    const stage1 = async (data: readonly Datum[]) => data;
    const stage2 = async (data: readonly Datum[]) =>
      data.map((datum) =>
        datum.get("reprocessed") ? datum : datum.with({ reprocessed: true, [reprocess]: true }),
      );
    const datum = new Datum({ basePath: "/", filename: "a.txt", title: "a" });

    const pipeline = new Pipeline({ stages: [stage0, stage1, stage2] });
    const [result] = await pipeline.add([datum], { site });

    expect(stage0Calls).toEqual(["a.txt", "a.txt"]);
    expect(result.get(reprocess)).toBeFalsy();
    expect(result.get("stage0Runs")).toBe(2);
  });

  test("reprocesses a datum requesting it when a sub-pipeline hits its `until`", async () => {
    const stage0Calls: string[] = [];
    const stage0 = async (data: readonly Datum[]) => {
      stage0Calls.push(...data.map((datum) => datum.get("filename") as string));
      return data.map((d) => d.branch({ stage0Runs: d.getOr("stage0Runs", 0) + 1 }));
    };
    let stage1NumCalls = 0;
    const stage1 = async (data: readonly Datum[]) => {
      stage1NumCalls += 1;
      const shouldReprocess = stage1NumCalls <= 2;
      return data.map((datum) => (shouldReprocess ? datum.with({ [reprocess]: true }) : datum));
    };

    const stage2 = async (data: readonly Datum[]) => data;
    const datum = new Datum({ basePath: "/", filename: "a.txt", title: "a" });

    const pipeline = new Pipeline({ stages: [stage0, stage1, stage2] });
    const [result] = await pipeline.add([datum], { site });

    expect(stage0Calls).toEqual(["a.txt", "a.txt", "a.txt"]);
    expect(result.get(reprocess)).toBeFalsy();
    expect(result.get("stage0Runs")).toBe(3);
  });
});
