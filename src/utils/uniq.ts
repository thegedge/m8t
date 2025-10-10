/**
 * Remove duplicate items from an array.
 *
 * @returns a new array without any duplicates.
 */
export const uniq = <T>(array: readonly T[]): T[] => {
  return Array.from(new Set(array));
};
