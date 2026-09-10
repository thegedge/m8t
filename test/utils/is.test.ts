import { runInNewContext } from "node:vm";
import { describe, expect, test } from "vitest";

import { isPlainObject } from "../../src/utils/is.js";

class BasicClass {}
class ToStringTagClass {
  get [Symbol.toStringTag]() {
    return "ToStringTagClass";
  }
}

describe("isPlainObject", () => {
  test("should return true for a POJO", () => {
    expect(isPlainObject({ a: 1 })).toEqual(true);
  });

  test("should return true for Object.create() with a POJO prototype", () => {
    expect(isPlainObject(Object.create(null))).toEqual(true);
    expect(isPlainObject(Object.create(Object.prototype))).toEqual(true);
    expect(isPlainObject(Object.create({}))).toEqual(true);
  });

  test("should return true for a cross-realm POJO", () => {
    const value = runInNewContext("(() => ({ a: 12345 }))()");
    expect(isPlainObject(value)).toEqual(true);
  });

  test.each([1, "abc", true, null, undefined])("should return false for %s", (v) => {
    expect(isPlainObject(v)).toBe(false);
  });

  test("should return false for custom classes", () => {
    expect(isPlainObject(new Date())).toEqual(false);
    expect(isPlainObject(new BasicClass())).toEqual(false);
  });

  test("should return false for Object.create() with a non-POJO prototype", () => {
    expect(isPlainObject(Object.create(Date.prototype))).toEqual(false);
    expect(isPlainObject(Object.create(BasicClass.prototype))).toEqual(false);
  });

  test("should return false for custom classes that have a custom toStringTag", () => {
    expect(isPlainObject(new ToStringTagClass())).toEqual(false);
  });
});
