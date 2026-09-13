import { describe, expect, test } from "vitest";

import { combinations } from "../../src/utils/combinations.js";

describe("combinations", () => {
  const ARRAY = [5, 1, 8n, "string", true];

  test("returns a single empty set for n=0", () => {
    expect(Array.from(combinations(ARRAY, 0))).toEqual([[]]);
  });

  test("returns each value as a single-item array for n=1", () => {
    expect(Array.from(combinations(ARRAY, 1))).toEqual(ARRAY.map((v) => [v]));
  });

  test("returns array itself for n=length", () => {
    expect(Array.from(combinations(ARRAY, ARRAY.length))).toEqual([ARRAY]);
  });

  test("returns expected items for n=3", () => {
    expect(Array.from(combinations(ARRAY, 3))).toEqual([
      [5, 1, 8n],
      [5, 1, "string"],
      [5, 1, true],
      [5, 8n, "string"],
      [5, 8n, true],
      [5, "string", true],
      [1, 8n, "string"],
      [1, 8n, true],
      [1, "string", true],
      [8n, "string", true],
    ]);
  });

  test("throws with a negative number", () => {
    expect(() => Array.from(combinations(ARRAY, -4))).toThrow();
  });

  test("throws with a number larger than the length", () => {
    expect(() => Array.from(combinations(ARRAY, ARRAY.length + 5))).toThrow();
  });
});
