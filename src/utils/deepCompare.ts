import { scalarCompare } from "./scalarCompare.js";

/**
 * Check if two values are equal.
 *
 * **Scalars**
 *
 * Scalar values are compared using the `<` operator. Scalars include:
 *
 *   1. `string`
 *   2. `number`
 *   3. `bigint`
 *   4. `symbol`
 *   5. `boolean`
 *   6. `null`
 *   7. `undefined`
 *   8. `object` that implements the `Symbol.toPrimitive` method
 *
 * **Objects**
 *
 * If we have two objects, `A` and `B`, then `A < B` if either:
 *
 *   1. `A` has fewer keys than `B`; or
 *   2. `A` has the same number of keys as `B`, but the first key with a different value compares less
 *      than the corresponding value in B, when the keys are compared in alphabetical order.
 *
 * If `A` and `B` have the exact same keys and all values compare equal, then `A = B`. Otherwise, `A > B`.
 *
 * **Arrays**
 *
 * If we have two arrays, `A` and `B`, then `A < B` if either:
 *
 *   1. `A` has fewer elements than `B`; or
 *   2. `A` has the same number of elements as `B`, but the first element with a different value compares less
 *      than the corresponding element in `B`.
 *
 * If `A` and `B` have the exact same elements and all elements compare equal, then `A = B`. Otherwise, `A > B`.
 *
 * **Different Types**
 *
 * When two different types are compared, the ordering is `scalar < array < object < function`.
 *
 * @returns a negative number if `a < b`, a positive number if `a > b`, and 0 if `a = b`.
 */
export const deepCompare = (a: unknown, b: unknown): number => {
  if (a === b) {
    return 0;
  }

  const typeA = Array.isArray(a) ? "array" : typeof a;
  const typeB = Array.isArray(b) ? "array" : typeof b;

  const orderA = TypeOrders[typeA];
  const orderB = TypeOrders[typeB];

  if (orderA !== orderB) {
    if (orderA < TypeOrders.array && orderB < TypeOrders.array) {
      return scalarCompare(a, b);
    }

    return orderA - orderB;
  }

  switch (typeA) {
    case "array": {
      const aArray = a as unknown[];
      const bArray = b as unknown[];
      const lengthA = aArray.length;
      const lengthB = bArray.length;
      if (lengthA !== lengthB) {
        return lengthA - lengthB;
      }

      for (let index = 0; index < lengthA; index++) {
        const comparison = deepCompare(aArray[index], bArray[index]);
        if (comparison !== 0) {
          return comparison;
        }
      }

      return 0;
    }
    case "object": {
      const aObject = a as Record<string | symbol, unknown>;
      const bObject = b as Record<string | symbol, unknown>;
      const keysA = sortedKeys(aObject);
      const keysB = sortedKeys(bObject);
      const lengthA = keysA.length;
      const lengthB = keysB.length;
      if (lengthA !== lengthB) {
        return lengthA - lengthB;
      }

      for (const key of keysA) {
        const comparison = deepCompare(aObject[key], bObject[key]);
        if (comparison !== 0) {
          return comparison;
        }
      }
    }
    default:
      return scalarCompare(a, b);
  }
};

const sortedKeys = (obj: Record<string | symbol, unknown>): (string | symbol)[] => {
  return Reflect.ownKeys(obj).sort((a, b) => a.toString().localeCompare(b.toString()));
};

const TypeOrders = {
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
