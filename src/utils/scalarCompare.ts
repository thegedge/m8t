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
 * @returns a negative number if `a < b`, a positive number if `a > b`, and 0 if `a == b`.
 */
export const scalarCompare = (a: unknown, b: unknown): number => {
  if (a === b) {
    return 0;
  }

  if (a == undefined) {
    return -1;
  }

  if (b == undefined) {
    return 1;
  }

  if (isNumerical(a) && isNumerical(b)) {
    const isNanA = Number.isNaN(a);
    const isNanB = Number.isNaN(b);
    if (isNanA && isNanB) {
      return 0;
    } else if (isNanA) {
      return -1;
    } else if (isNanB) {
      return 1;
    } else {
      return a < b ? -1 : 1;
    }
  }

  const typeA = typeof a;
  const typeB = typeof b;
  if (typeA != typeB) {
    return TypeOrders[typeA] - TypeOrders[typeB];
  }

  return a < b ? -1 : 1;
};

const isNumerical = (value: unknown): value is number | bigint => {
  const t = typeof value;
  return t == "number" || t == "bigint";
};

export const TypeOrders = {
  string: 100,
  number: 200,
  bigint: 300,
  symbol: 400,
  boolean: 500,
  null: 500,
  undefined: 600,
  array: 700,
  object: 800,
  function: 900,
};
