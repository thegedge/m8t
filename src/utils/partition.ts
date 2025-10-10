/**
 * Partition an array into two arrays based on a predicate.
 *
 * @returns a pair of arrays; the first containing the items that satisfy the predicate, and the second containing the items that do not.
 */
export const partition = <T>(
  array: {
    reduce<U>(callbackfn: (acc: U, currentValue: T) => U, initialValue: U): U;
  },
  predicate: (value: T) => boolean,
): readonly [T[], T[]] => {
  return array.reduce(
    (acc, item) => {
      if (predicate(item)) {
        acc[0].push(item);
      } else {
        acc[1].push(item);
      }
      return acc;
    },
    [[], []] as [T[], T[]],
  );
};
