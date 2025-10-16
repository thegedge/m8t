import { deepCompare } from "./deepCompare.js";
import { union } from "./union.js";

type ChangedArray<T extends Record<string | symbol, unknown>> = [keyof T, unknown][];

export type Changes<T extends Record<string | symbol, unknown>> = {
  additions: ChangedArray<T>;
  removals: ChangedArray<T>;
  updates: ChangedArray<T>;
  unchanged: ChangedArray<T>;
};

/**
 * Perform a diff of two objects.
 *
 * The diff contains the following properties:
 * - `additions`, entries that were added to the `to` object;
 * - `removals`, entries that were removed from the `from` object;
 * - `updates`, entries whose key exists in both objects but the value is different in `to`; and
 * - `unchanged`, entries whose key exists in both objects and the value is the same in both objects.
 *
 * All entries are sorted alphabetically by key.
 *
 * Entries in the `updates` array contain the value from the `to` object.
 *
 * We "shallow" compare keys, meaning that the changes returned only consider the root-level keys of the given objects.
 * Deep comparisons are still performed on non-scalar values to determine changes (see example below).
 *
 * @example
 * ```ts
 * diffObject({ a: { b: 1 }, s: "test", n: 1 }, { a: { b: 2 }, s: "test", m: 1 });
 * // {
 * //   additions: [["m", 1]],
 * //   removals: [["n", 1]],
 * //   updates: [["a", { b: 2 }]],
 * //   unchanged: [[ "s", "test" ]]
 * // }
 * ```
 *
 * @param from - The object to diff from.
 * @param to - The object to diff to.
 *
 * @returns an object containing the diff between the two objects.
 */
export const diffObject = <T extends Record<string | symbol, unknown>>(from: T, to: T): Changes<T> => {
  const additions: ChangedArray<T> = [];
  const removals: ChangedArray<T> = [];
  const updates: ChangedArray<T> = [];
  const unchanged: ChangedArray<T> = [];

  const allKeys = union(Reflect.ownKeys(to), Reflect.ownKeys(from));
  for (const key of allKeys) {
    const keyInFrom = key in from;
    const keyInTo = key in to;

    if (keyInFrom && keyInTo) {
      const fromValue = from[key];
      const toValue = to[key];
      if (fromValue === toValue || deepCompare(fromValue, toValue) === 0) {
        unchanged.push([key, fromValue]);
      } else {
        updates.push([key, toValue]);
      }
    } else if (keyInTo) {
      const toValue = to[key];
      additions.push([key, toValue]);
    } else if (keyInFrom) {
      const fromValue = from[key];
      removals.push([key, fromValue]);
    }
  }

  return {
    additions: additions.sort(entryKeySort),
    removals: removals.sort(entryKeySort),
    updates: updates.sort(entryKeySort),
    unchanged: unchanged.sort(entryKeySort),
  };
};

export const entryKeySort = (a: [string | number | symbol, unknown], b: [string | number | symbol, unknown]) => {
  return String(a[0]).localeCompare(String(b[0]));
};
