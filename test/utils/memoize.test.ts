import { describe, expect, test, vi } from "vitest";

import { memoize } from "../../src/utils/memoize.js";

describe("memoize", () => {
  test("does not recompute functions of arity 0", () => {
    let v = 1;
    const mock = vi.fn(() => v++);
    const memoizedMock = memoize(mock);

    expect(memoizedMock()).toBe(1);
    expect(memoizedMock()).toBe(1);

    expect(mock).toHaveBeenCalledOnce();
  });

  test("does not recompute functions of arity 1 for the same argument", () => {
    let v = 1;
    const mock = vi.fn((a: number) => a + v++);
    const memoizedMock = memoize(mock);

    expect(memoizedMock(5)).toBe(6);
    expect(memoizedMock(8)).toBe(10);
    expect(memoizedMock(5)).toBe(6);
    expect(memoizedMock(8)).toBe(10);

    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("does not recompute functions of arity > 1 for the same arguments", () => {
    let v = 1;
    const mock = vi.fn((a: number, b: string) => `result: ${a + v++} ${b}`);
    const memoizedMock = memoize(mock);

    expect(memoizedMock(5, "five")).toBe("result: 6 five");
    expect(memoizedMock(8, "eight")).toBe("result: 10 eight");

    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("recomputes a value when given an argument with the same value as the default", () => {
    let v = 1;
    const mock = vi.fn((a = 1) => a + v++);
    const memoizedMock = memoize(mock);

    expect(memoizedMock()).toBe(2);
    expect(memoizedMock(1)).toBe(3);
    expect(memoizedMock()).toBe(2);
    expect(memoizedMock(1)).toBe(3);

    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("does not recompute functions for complex arguments", () => {
    let v = 1;
    const mock = vi.fn((stuff: { a: number; b: string }[]) => {
      return stuff.map(({ a, b }) => `result: ${a + v++} ${b}`).join("\n");
    });
    const memoizedMock = memoize(mock);

    expect(
      memoizedMock([
        { a: 5, b: "five" },
        { a: 8, b: "eight" },
      ]),
    ).toBe("result: 6 five\nresult: 10 eight");
    expect(
      memoizedMock([
        { a: 5, b: "five" },
        { a: 8, b: "eight" },
      ]),
    ).toBe("result: 6 five\nresult: 10 eight");

    expect(mock).toHaveBeenCalledOnce();
  });

  test("computes different values for undefined and null", () => {
    let v = 1;
    const mock = vi.fn((_a: null | undefined) => v++);
    const memoizedMock = memoize(mock);

    expect(memoizedMock(null)).toBe(1);
    expect(memoizedMock(undefined)).toBe(2);
    expect(memoizedMock(null)).toBe(1);
    expect(memoizedMock(undefined)).toBe(2);

    expect(mock).toHaveBeenCalledTimes(2);
  });

  test("supports cyclic arguments", () => {
    let v = 1;
    const mock = vi.fn((arg: { a: number; [key: string]: any }) => arg.a + v++);
    const memoizedMock = memoize(mock);

    const a: any = { a: 1 };
    a["test"] = a;

    expect(memoizedMock(a)).toBe(2);
    expect(memoizedMock(a)).toBe(2);

    expect(mock).toHaveBeenCalledTimes(1);
  });
});
