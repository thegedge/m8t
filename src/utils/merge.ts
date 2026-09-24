import { isPlainObject } from "./is.js";

export type MergeObject = Record<string | symbol, unknown>;
export type MergeArgument = MergeObject | null | undefined;

/**
 * Deep merge multiple objects.
 *
 * Does not mutate any of the objects, which are merged left-to-right as follows:
 *
 * 1. Any scalar values will overwrite keys from previous objects.
 * 2. Arrays are concatenated.
 * 3. Object keys are deep merged.
 *
 * @example
 * ```ts
 * merge({ a: 1, b: ["testing", "stuff"] }, null) //=> null
 * ```
 *
 * @example
 * ```ts
 * merge(
 *   { a: 1, b: ["testing", "stuff"] },
 *   { a: 3, b: ["more", "stuff"], c: true };
 * )
 * //=> { a: 3, b: ["testing", "stuff", "more", "stuff"], c: true }
 * ```
 *
 * @returns a new object with the merged contents of the two objects.
 */
export function merge(base: MergeObject, ...objects: MergeArgument[]): MergeObject {
  if (objects.length == 0) {
    return { ...base };
  }

  if (objects.length > 1) {
    return objects.reduce<MergeObject>((acc, value) => merge(acc, value), base);
  }

  const a = base;
  const b = objects[0];

  if (a === b) {
    return a;
  }

  if (!a || !b) {
    return a ?? b;
  }

  const merged: MergeObject = { ...a, ...b };
  const stringKeys = Object.getOwnPropertyNames(merged);
  const symbolKeys = Object.getOwnPropertySymbols(merged);

  for (const key of [...stringKeys, ...symbolKeys]) {
    const aValue: unknown = a[key];
    const bValue: unknown = b[key];
    if (isPlainObject(aValue) && isPlainObject(bValue)) {
      merged[key] = merge(aValue, bValue);
    } else if (Array.isArray(aValue) && Array.isArray(bValue)) {
      merged[key] = [...aValue, ...bValue];
    }
  }

  return merged;
}
