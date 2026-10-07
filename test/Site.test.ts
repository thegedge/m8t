import { afterEach, describe, expect, test, vi } from "vitest";

import { AbortError } from "../src/errors/AbortError.js";
import { SiteData } from "../src/site/SiteData.js";
import { makeContext, passthrough, type TestContext } from "./helpers.js";

describe("Site", () => {
  let context: TestContext;

  afterEach(async () => {
    await context[Symbol.asyncDispose]();
  });

  describe("load", () => {
    test("resolves to a snapshot of the processed data", async () => {
      context = await makeContext({
        pipelines: passthrough([
          { url: "/b", content: "b" },
          { url: "/a", content: "a" },
        ]),
      });

      const siteData = await context.site.load();

      expect(siteData).toBeInstanceOf(SiteData);
      expect(siteData.data).toHaveLength(2);
      expect(siteData.urls).toEqual(["/a", "/b"]);
      expect(siteData.byUrl("/a")?.get("content")).toBe("a");
    });

    test("processes the site again on every call", async () => {
      let calls = 0;
      context = await makeContext({
        pipelines: {
          ".": [
            async (data) => {
              calls += 1;
              return data.map((datum) => datum.branch({ url: `/${calls}` }));
            },
          ],
        },
      });

      const first = await context.site.load();
      const second = await context.site.load();

      expect(first.urls).toEqual(["/1"]);
      expect(second.urls).toEqual(["/2"]);
    });

    test("passes the caller's signal to pipeline stages as-is", async () => {
      const signals: AbortSignal[] = [];
      context = await makeContext({
        pipelines: {
          ".": [
            async (data, { signal }) => {
              signals.push(signal);
              return data;
            },
          ],
        },
      });
      const controller = new AbortController();

      await context.site.load({ signal: controller.signal });

      expect(signals).toEqual([controller.signal]);
    });

    test("does not impose a timeout on processing", async () => {
      const timeout = vi.spyOn(AbortSignal, "timeout");
      const signals: AbortSignal[] = [];
      context = await makeContext({
        pipelines: {
          ".": [
            async (data, { signal }) => {
              signals.push(signal);
              return data;
            },
          ],
        },
      });

      await context.site.load();

      expect(timeout).not.toHaveBeenCalled();
      expect(signals).toHaveLength(1);
      expect(signals[0].aborted).toBe(false);
    });

    test("rejects with an AbortError when the signal is already aborted", async () => {
      context = await makeContext({ pipelines: passthrough([{ url: "/" }]) });

      const loading = context.site.load({ signal: AbortSignal.abort(new AbortError("sad")) });

      await expect(loading).rejects.toThrow(AbortError);
      await expect(loading).rejects.toThrow("sad");
    });

    test("rejects with an AbortError when the signal aborts during processing", async () => {
      const controller = new AbortController();
      context = await makeContext({
        pipelines: {
          ".": [
            async () => {
              controller.abort(new AbortError("sad"));
              return await new Promise<never>(() => {});
            },
          ],
        },
      });

      const loading = context.site.load({ signal: controller.signal });

      await expect(loading).rejects.toThrow(AbortError);
      await expect(loading).rejects.toThrow("sad");
    });
  });
});
