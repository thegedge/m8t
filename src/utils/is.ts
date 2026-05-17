/**
 * Check if a given object is a plain object (i.e., not a class instance).
 *
 * @example
 * ```ts
 * isPlainObject({ a: 1, b: 2 }) // => true
 * isPlainObject(Object.create(null)) // => true
 * isPlainObject(new Date()) // => false
 * isPlainObject(new Error()) // => false
 * isPlainObject(new Set()) // => false
 * isPlainObject(new Map()) // => false
 * isPlainObject(null) // => false
 * isPlainObject(true) // => false
 * isPlainObject("test") // => false
 */
export const isPlainObject = (value: unknown): value is Record<string, unknown> => {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value) &&
    Object.prototype.toString.call(value) === "[object Object]" // deal with cross-realm objects
  );
};
