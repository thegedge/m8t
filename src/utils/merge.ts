import { isPlainObject } from "lodash-es";

/**
 * Deep merge two objects.
 *
 * Does not mutate the `target` or `source` object.
 *
 * TODO maybe type this better
 */
export function merge<T extends Record<string, unknown>>(base: T, ...objects: T[]): T {
  if (objects.length > 1) {
    const [a, ...rest] = objects;
    return merge(merge(base, a), ...rest);
  }

  const a = base;
  const b = objects[0];

  if (a === (b as any)) {
    return a;
  }

  const merged = { ...a, ...b };
  const keys = [
    ...Object.getOwnPropertyNames(merged),
    ...Object.getOwnPropertySymbols(merged),
  ] as unknown as (keyof typeof a & keyof typeof b)[];

  for (const key of keys) {
    const aValue: unknown = a[key];
    const bValue: unknown = b[key];
    const mergedKey = key as keyof typeof merged;
    if (isPlainObject(aValue) && isPlainObject(bValue)) {
      merged[mergedKey] = merge(
        aValue as unknown as Record<string, unknown>,
        bValue as unknown as Record<string, unknown>,
      ) as (typeof merged)[typeof mergedKey];
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
