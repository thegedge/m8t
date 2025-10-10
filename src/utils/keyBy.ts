/**
 * Group an array of objects by a key.
 *
 * If there are multiple of the same key, the last value with a given key will be used.
 *
 * @returns an object with the keys of the iterable and the values of the iterable.
 */
export const keyBy = <T, R extends string | number | symbol>(
  iterable: {
    reduce<U>(callbackfn: (acc: U, currentValue: T) => U, initialValue: U): U;
  },
  key: (value: T) => R,
): Record<R, T> => {
  return iterable.reduce(
    (acc, value) => {
      acc[key(value)] = value;
      return acc;
    },
    {} as Record<R, T>,
  );
};
