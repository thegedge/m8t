import { describe, expect, test } from "vitest";

import { cacheKey } from "../../../src/utils/cache/cacheKey.js";

describe("cacheKey", () => {
  test("is a deterministic sha256 hex digest", () => {
    expect(cacheKey("a", new Uint8Array([1, 2]))).toEqual(cacheKey("a", new Uint8Array([1, 2])));
    expect(cacheKey("a")).toMatch(/^[0-9a-f]{64}$/);
  });

  test("separates parts unambiguously", () => {
    expect(cacheKey("ab", "c")).not.toEqual(cacheKey("a", "bc"));
    expect(cacheKey("a", "")).not.toEqual(cacheKey("a"));
    expect(cacheKey("1:a")).not.toEqual(cacheKey("", "a"));
  });

  test("differs when any part differs", () => {
    expect(cacheKey("a", "b")).not.toEqual(cacheKey("a", "c"));
  });
});
