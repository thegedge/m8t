import { describe, expect, test } from "vitest";

import { SiteData } from "../src/site/SiteData.js";
import { testData } from "./helpers.js";

describe("SiteData", () => {
  test("exposes all data, including data without a url", () => {
    const data = [testData({ url: "/a" }), testData({ title: "no url" })];

    expect(new SiteData(data).data).toEqual(data);
  });

  describe("urls", () => {
    test("return a sorted list of urls for data that have one", () => {
      const siteData = new SiteData([
        testData({ url: "/b" }),
        testData({ title: "no url" }),
        testData({ url: "/a" }),
      ]);

      expect(siteData.urls).toEqual(["/a", "/b"]);
    });
  });

  describe("byUrl", () => {
    test("finds a datum by its url", () => {
      const datum = testData({ url: "/a" });
      const siteData = new SiteData([testData({ url: "/b" }), datum]);

      expect(siteData.byUrl("/a")).toBe(datum);
    });

    test("returns undefined for an unknown url", () => {
      const siteData = new SiteData([testData({ url: "/a" })]);

      expect(siteData.byUrl("/missing")).toBeUndefined();
    });

    test("does not resolve urls to inherited object properties", () => {
      const siteData = new SiteData([testData({ url: "/a" })]);

      expect(siteData.byUrl("constructor")).toBeUndefined();
      expect(siteData.byUrl("__proto__")).toBeUndefined();
    });

    test("uses the last datum when multiple data share a url", () => {
      const last = testData({ url: "/a", title: "last" });
      const siteData = new SiteData([testData({ url: "/a", title: "first" }), last]);

      expect(siteData.urls).toEqual(["/a"]);
      expect(siteData.byUrl("/a")).toBe(last);
    });
  });
});
