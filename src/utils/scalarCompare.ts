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

  const typeA = a === null ? "null" : typeof a;
  const typeB = b === null ? "null" : typeof b;

  if (typeA == typeB) {
    switch (typeA) {
      case "number":
      case "bigint":
        const isNanA = Number.isNaN(a);
        const isNanB = Number.isNaN(b);
        if (isNanA && isNanB) {
          return 0;
        } else if (isNanA) {
          return -1;
        } else if (isNanB) {
          return 1;
        }

        // @ts-ignore -- a and b are either both number or bigint, given the above if
        return a < b ? -1 : 1;
      case "string":
      case "boolean":
        // @ts-ignore -- a and b are both same type, comparable with <
        return a < b ? -1 : 1;
      case "symbol":
        // @ts-ignore -- a and b are both same type, comparable with <
        return String(a) < String(b) ? -1 : 1;
      case "object":
        if (!a || !b) {
          return TypeOrders[typeA] - TypeOrders[typeB];
        }

        if (Symbol.toPrimitive in (a as object) && Symbol.toPrimitive in (b as object)) {
          return scalarCompare(+a, +b);
        }
    }
  }

  return TypeOrders[typeA] - TypeOrders[typeB];
};

export const TypeOrders = {
  undefined: 100,
  null: 200,
  symbol: 300,
  string: 400,
  bigint: 500,
  number: 600,
  boolean: 700,
  array: 800,
  object: 900,
  function: 950,
};
