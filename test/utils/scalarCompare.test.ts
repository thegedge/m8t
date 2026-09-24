import { inspect } from "node:util";
import { describe, expect, test } from "vitest";

import { scalarCompare } from "../../src/utils/scalarCompare.js";

describe("scalarCompare", () => {
  for (const [a, b] of [
    [0, 1],
    [123n, 555],
    [undefined, 0],
    [Number.NaN, 0],
    ["value", 0],
    ["a", "b"],
    [Symbol("z"), "a"],
    [Symbol("a"), Symbol("b")],
    [undefined, null],
    [null, false],
    [undefined, false],
    [false, true],
    [null, ""],
    ["", Number.POSITIVE_INFINITY],
  ]) {
    const presentA = inspect(a);
    const presentB = inspect(b);
    test(`returns a negative value when comparing ${presentA} to ${presentB}`, () => {
      expect(scalarCompare(a, b)).toBeLessThan(0);
    });

    test(`returns a positive value when comparing ${presentB} to ${presentA}`, () => {
      expect(scalarCompare(b, a)).toBeGreaterThan(0);
    });

    test(`returns zero when comparing ${presentA} to itself`, () => {
      expect(scalarCompare(a, a)).toBe(0);
    });
  }
});
