/**
 * Computes the union of the given arrays.
 *
 * Equivalent to `uniq([...array1, ...array2, ..., ...arrayN])`
 *
 * @returns a new array with no duplicates from all arrays.
 */
export const union = <T>(...arrays: readonly (readonly T[])[]): T[] => {
  return Array.from(new Set(arrays.flat()));
};
