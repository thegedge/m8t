import { inspect } from "node:util";
import { describe, expect, test } from "vitest";

import { deepCompare } from "../../src/utils/deepCompare.js";

describe("deepCompare", () => {
  for (const [a, b] of [
    [0, 1],
    [
      [1, 2, 3],
      [1, 2, 6],
    ],
    [
      [9, 9],
      [1, 2, 6],
    ],
    [[1, 2, 3], { a: 1 }],
    [{ a: 0 }, { a: 1 }],
    [{ b: 0 }, { t: 1 }],
    [{ c: 1 }, { a: 0, b: 2 }],
    [{ d: 2 }, (v: unknown) => v],
  ]) {
    const presentA = inspect(a);
    const presentB = inspect(b);

    test(`returns -1 when comparing ${presentA} to ${presentB}`, () => {
      expect(deepCompare(a, b)).toBeLessThan(0);
    });

    test(`returns 1 when comparing ${presentB} to ${presentA}`, () => {
      expect(deepCompare(b, a)).toBeGreaterThan(0);
    });

    test(`returns 0 when comparing ${presentA} to itself`, () => {
      expect(deepCompare(a, structuredClone(a))).toBe(0);
    });
  }

  test("doesn't loop infinitely for array cycles", () => {
    const a: any[] = [1, 2, 3];
    const b: any[] = [4, 5, 6];
    a.unshift(a);
    b.unshift(b);
    expect(deepCompare(a, b)).toBe(-1);
    expect(deepCompare(a, a)).toBe(0);
  });

  test("doesn't loop infinitely for object cycles", () => {
    const a: any = { a: 1 };
    const b: any = { a: 2 };
    a.test = a;
    b.test = b;
    expect(deepCompare(a, b)).toBe(-1);
    expect(deepCompare(a, a)).toBe(0);
  });
});
