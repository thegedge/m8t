import { isPlainObject } from "./is.js";

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
 * const a = { a: 1, b: ["testing", "stuff"] };
 * const b = { a: 3, b: ["more", "stuff"], c: "blah" };
 * const merged = merge(a, b);
 * console.log(merged); // => { a: 3, b: ["testing", "stuff", "more", "stuff"], c: "blah" }
 * ```
 *
 * @returns a new object with the merged contents of the two objects.
 */
export function merge<T extends Record<string, unknown> | null | undefined>(
  base: T,
  ...objects: T[]
): T {
  // TODO try to type this so that the return type is the merging of the two

  if (objects.length == 0) {
    // We do a spread of the keys to ensure we return a shallow copy.
    return { ...base };
  }

  if (objects.length > 1) {
    const [a, ...rest] = objects;
    return merge(merge(base, a), ...rest);
  }

  const a = base;
  const b = objects[0];

  if (a === (b as any)) {
    return a;
  }

  if (!a || !b) {
    return a ?? b;
  }

  // TODO this stuff is annoying to type, but give it a try someday
  const merged: any = { ...a, ...b };
  const keys = [
    ...Object.getOwnPropertyNames(merged),
    ...Object.getOwnPropertySymbols(merged),
  ] as unknown as (keyof T)[];

  for (const key of keys) {
    const aValue: unknown = (a as NonNullable<T>)[key];
    const bValue: unknown = (b as NonNullable<T>)[key];
    const mergedKey = key as keyof NonNullable<T>;
    if (isPlainObject(aValue) && isPlainObject(bValue)) {
      merged[mergedKey] = merge(aValue, bValue);
    } else if (Array.isArray(aValue) && Array.isArray(bValue)) {
      merged[mergedKey] = (
        aValue === bValue ? aValue : [...aValue, ...bValue]
      ) as (typeof merged)[typeof mergedKey];
    } else if (mergedKey in b) {
      merged[mergedKey] = bValue as (typeof merged)[typeof mergedKey];
    } else {
      merged[mergedKey] = aValue as (typeof merged)[typeof mergedKey];
    }
  }

  return merged;
}
