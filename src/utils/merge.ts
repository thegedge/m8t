import { isPlainObject } from "./is.js";

/**
 * Deep merge two objects.
 *
 * Does not mutate the `target` or `source` object.
 *
 * TODO try to type this so that the return type is the merging of the two
 */
export function merge<T extends Record<string, unknown> | null | undefined>(base: T, ...objects: T[]): T {
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
      merged[mergedKey] = (aValue === bValue ? aValue : [...aValue, ...bValue]) as (typeof merged)[typeof mergedKey];
    } else if (mergedKey in b) {
      merged[mergedKey] = bValue as (typeof merged)[typeof mergedKey];
    } else {
      merged[mergedKey] = aValue as (typeof merged)[typeof mergedKey];
    }
  }

  return merged;
}
