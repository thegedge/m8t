import { getSystemErrorName } from "node:util";

/**
 * Check if a given object is a plain object (i.e., not a class instance).
 *
 * @example
 * ```ts
 * isPlainObject({ a: 1, b: 2 }) // => true
 * isPlainObject(Object.create(null)) // => true
 * isPlainObject(new MyClass()) // => false
 * isPlainObject(new Date()) // => false
 * isPlainObject(null) // => false
 * isPlainObject(true) // => false
 * isPlainObject("test") // => false
 * isPlainObject(runInNewContext("(() => ({ a: 12345 }))()")) // => true
 * ```
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  if (typeof value !== "object") {
    return false;
  }

  if (value === null || Array.isArray(value)) {
    return false;
  }

  if (Object.prototype.toString.call(value) !== "[object Object]") {
    // Deal with cross-realm objects by stringifying the prototype
    return false;
  }

  const constructor = value.constructor;
  if (constructor && constructor.name !== "Object") {
    return false;
  }

  return true;
};

/**
 * Returns true if a given value is an error for ENOENT.
 */
export const isNoEntryError = (e: unknown): boolean => {
  return (
    e instanceof Error &&
    "errno" in e &&
    typeof e.errno == "number" &&
    getSystemErrorName(e.errno) == "ENOENT"
  );
};
