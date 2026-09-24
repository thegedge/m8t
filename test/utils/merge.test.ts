import { describe, expect, test } from "vitest";

import { merge } from "../../src/utils/merge.js";

describe("merge", () => {
  test("returns a shallow copy with a single argument", () => {
    const a = { x: 1, y: [1, 2] };
    const result = merge(a);

    expect(result).toEqual(a);
    expect(result).not.toBe(a);
    expect(result.y).toBe(a.y);
  });

  test("returns a shallow copy with a single argument", () => {
    const a = { x: 1, y: [1, 2] };
    const result = merge(a);

    expect(result).toEqual(a);
    expect(result).not.toBe(a);
    expect(result.y).toBe(a.y);
  });

  test("returns the base object reference when the other argument is null", () => {
    const a = { x: 1 };

    expect(merge(a, null)).toBe(a);
  });

  test("returns the base object reference when the other argument is undefined", () => {
    const a = { x: 1 };

    expect(merge(a, undefined)).toBe(a);
  });

  test("can merge more than two objects", () => {
    const a = { x: 1 };
    const b = { x: 2 };
    const c = { x: 3 };
    const d = { x: 4 };

    expect(merge(a, b, c)).toEqual({ x: 3 });
    expect(merge(a, b, c, d)).toEqual({ x: 4 });
  });

  test("does not mutate the base or argument objects", () => {
    const a = { x: 1, nested: { y: 2 }, arr: [1, 2] };
    const b = { x: 3, nested: { z: 4 }, arr: [3, 4] };
    const aSnapshot = structuredClone(a);
    const bSnapshot = structuredClone(b);

    merge(a, b);

    expect(a).toEqual(aSnapshot);
    expect(b).toEqual(bSnapshot);
  });

  test("prefers values from the second argument", () => {
    const a = { x: 1, y: "a" };
    const b = { x: 2, y: "b" };

    expect(merge(a, b)).toEqual({ x: 2, y: "b" });
  });

  test("concatenates array values", () => {
    const a = { list: ["testing", "stuff"] };
    const b = { list: ["more", "stuff"] };

    const result = merge(a, b);

    expect(result).toEqual({ list: ["testing", "stuff", "more", "stuff"] });
    expect(result.list).not.toBe(a.list);
    expect(result.list).not.toBe(b.list);
  });

  test("deep merges plain object values", () => {
    const a = { nested: { x: 1, y: 2 } };
    const b = { nested: { y: 3, z: 4 } };

    expect(merge(a, b)).toEqual({ nested: { x: 1, y: 3, z: 4 } });
  });

  test("recursively deep merges nested plain objects", () => {
    const a = { nested: { deep: { x: 1 } } };
    const b = { nested: { deep: { y: 2 } } };

    expect(merge(a, b)).toEqual({ nested: { deep: { x: 1, y: 2 } } });
  });

  test("merges nested arrays inside objects", () => {
    const a = { nested: { list: [1, 2] } };
    const b = { nested: { list: [3, 4] } };

    expect(merge(a, b)).toEqual({ nested: { list: [1, 2, 3, 4] } });
  });

  test("concatenates arrays of objects rather than merging their elements", () => {
    const a = { list: [{ a: 1 }] };
    const b = { list: [{ a: 2 }] };

    expect(merge(a, b)).toEqual({ list: [{ a: 1 }, { a: 2 }] });
  });

  describe("mismatched value types", () => {
    test("overwrites a scalar with an array", () => {
      const a = { v: 5 };
      const b = { v: [1, 2] };

      expect(merge(a, b)).toEqual({ v: [1, 2] });
    });

    test("overwrites an array with a scalar", () => {
      const a = { v: [1, 2] };
      const b = { v: 5 };

      expect(merge(a, b)).toEqual({ v: 5 });
    });

    test("overwrites a scalar with a plain object", () => {
      const a = { v: 5 };
      const b = { v: { z: 1 } };

      expect(merge(a, b)).toEqual({ v: { z: 1 } });
    });

    test("overwrites a plain object with a scalar", () => {
      const a = { v: { z: 1 } };
      const b = { v: 5 };

      expect(merge(a, b)).toEqual({ v: 5 });
    });

    test("overwrites an array with a plain object", () => {
      const a = { v: [1, 2] };
      const b = { v: { z: 1 } };

      const result = merge(a, b);

      expect(result).toEqual({ v: { z: 1 } });
      expect(result.v).toBe(b.v);
    });

    test("overwrites a plain object with an array", () => {
      const a = { v: { z: 1 } };
      const b = { v: [1, 2] };

      const result = merge(a, b);

      expect(result).toEqual({ v: [1, 2] });
      expect(result.v).toBe(b.v);
    });

    test("overwrites a scalar with undefined", () => {
      const a = { x: 1 };
      const b = { x: undefined };

      const result = merge(a, b);

      expect(result).toHaveProperty("x", undefined);
    });

    test("overwrites an array with undefined", () => {
      const a = { x: [1, 2] };
      const b = { x: undefined };

      const result = merge(a, b);

      expect(result).toHaveProperty("x", undefined);
    });

    test("overwrites an object with undefined", () => {
      const a = { x: { a: 1 } };
      const b = { x: undefined };

      const result = merge(a, b);

      expect(result).toHaveProperty("x", undefined);
    });
  });

  describe("non-plain objects", () => {
    test("overwrites a Date instance rather than deep merging it", () => {
      const a = { d: new Date(2020, 0, 1) };
      const b = { d: new Date(2021, 0, 1) };

      const result = merge(a, b);

      expect(result.d).toBe(b.d);
      expect(result.d).not.toBe(a.d);
    });

    test("overwrites a class instance rather than deep merging it", () => {
      class Thing {
        value: number;
        constructor(value: number) {
          this.value = value;
        }
      }
      const a = { thing: new Thing(1) };
      const b = { thing: new Thing(2) };

      const result = merge(a, b);

      expect(result.thing).toBe(b.thing);
    });

    test("overwrites a Map instance rather than deep merging it", () => {
      const a = { m: new Map([["a", 1]]) };
      const b = { m: new Map([["b", 2]]) };

      const result = merge(a, b);

      expect(result.m).toBe(b.m);
    });
  });

  describe("symbol keys", () => {
    test("overwrites a symbol-keyed scalar value from the right-hand object", () => {
      const sym = Symbol("key");
      const a = { [sym]: 1 };
      const b = { [sym]: 2 };

      expect(merge(a, b)[sym]).toBe(2);
    });

    test("deep merges symbol-keyed plain object values", () => {
      const sym = Symbol("key");
      const a = { [sym]: { x: 1 } };
      const b = { [sym]: { y: 2 } };

      expect(merge(a, b)[sym]).toEqual({ x: 1, y: 2 });
    });

    test("concatenates symbol-keyed array values", () => {
      const sym = Symbol("key");
      const a = { [sym]: [1] };
      const b = { [sym]: [2] };

      expect(merge(a, b)[sym]).toEqual([1, 2]);
    });

    test("includes a symbol key only present on the right-hand object", () => {
      const sym = Symbol("key");
      const a = {};
      const b = { [sym]: "value" };

      expect(merge(a, b)[sym]).toBe("value");
    });
  });
});
