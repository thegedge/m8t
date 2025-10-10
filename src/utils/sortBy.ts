import { scalarCompare, type Comparable } from "./scalarCompare.js";

/**
 * Sort an array by a given set of keys.
 *
 * When comparing two objects, if the keys are the same, the next key is used for comparing, and so on.
 *
 * @returns a new array with the items sorted by the given keys.
 */
export const sortBy = <T>(
  array: { toSorted(comparator: (a: T, b: T) => number): T[] },
  ...keys: ((v: T) => Comparable)[]
): T[] => {
  return array.toSorted((a, b) => {
    for (const key of keys) {
      const keyA = key(a);
      const keyB = key(b);

      const comparison = scalarCompare(keyA, keyB);
      if (comparison !== 0) {
        return comparison;
      }
    }

    return 0;
  });
};
