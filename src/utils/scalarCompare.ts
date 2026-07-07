export type Comparable =
  | {
      [Symbol.toPrimitive](
        hint: "string" | "number" | "default",
      ): string | number | null | undefined;
    }
  | string
  | number
  | bigint
  | boolean
  | null
  | undefined;

/**
 * Compare two scalars.
 *
 * @returns a negative number if `keyA < keyB`, a positive number if `keyA > keyB`, and 0 if `keyA = keyB`.
 */
export const scalarCompare = (keyA: unknown, keyB: unknown): number => {
  if (keyA === keyB) {
    return 0;
  }

  if (keyA === undefined) {
    return -1;
  }

  if (keyB === undefined) {
    return 1;
  }

  if (keyA === null) {
    return -1;
  }

  if (keyB === null) {
    return 1;
  }

  return keyA < keyB ? -1 : 1;
};
