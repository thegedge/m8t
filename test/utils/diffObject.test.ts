import { describe, expect, test } from "vitest";

import { diffObject } from "../../src/utils/diffObject.js";

describe("diffObject", () => {
  test("gets the changes between two objects", () => {
    const a = { a: 1, b: 2, c: 3 };
    const b = { b: 3, c: 3, d: 4 };

    expect(diffObject(a, b)).toEqual({
      additions: [["d", 4]],
      removals: [["a", 1]],
      updates: [["b", 3]],
      unchanged: [["c", 3]],
    });
  });

  test("only considers own keys", () => {
    const a = { toString: 1 };
    const b = {}; // toString exists on Object.prototype

    expect(diffObject(a, b)).toEqual({
      additions: [],
      removals: [["toString", a.toString]],
      updates: [],
      unchanged: [],
    });
  });

  test("deep compares objects/arrays", () => {
    const a = { a: [1, 2], b: { c: 2 } };
    const b = { a: [2, 3], b: { c: 4 } };

    expect(diffObject(a, b)).toEqual({
      additions: [],
      removals: [],
      updates: [
        ["a", [2, 3]],
        ["b", { c: 4 }],
      ],
      unchanged: [],
    });
  });
});
