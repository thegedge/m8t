/**
 * Return every combination of N items from a given iterable.
 *
 * @example
 * ```ts
 * combinations([1, 2, 3, 4], 2)
 *   //=> [[1, 2], [1, 3], [1, 4], [2, 3], [2, 4], [3, 4]]
 * combinations([1, 2, 3, 4], 3)
 *   //=> [[1, 2, 3], [1, 2, 4], [1, 3, 4], [2, 3, 4]]
 * ```
 */
export function* combinations<T>(values: T[], n: number): Generator<T[], undefined, undefined> {
  if (n < 0 || n > values.length) {
    throw new RangeError("n must be non-negative and no more than the length");
  }

  if (n == 0) {
    yield [];
    return;
  }

  for (let i = 0; i <= values.length - n; ++i) {
    for (const subChoice of combinations(values.slice(i + 1), n - 1)) {
      yield [values[i], ...subChoice];
    }
  }
}
